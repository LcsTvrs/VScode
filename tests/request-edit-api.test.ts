import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { createAdminSession, ADMIN_SESSION_COOKIE, type AdminSession } from "../src/features/auth/session";
import { GET, PATCH, PUT } from "../src/app/api/requests/[id]/route";
import { ADMIN_ITEM_LIMIT, parseRequestItems, PUBLIC_ITEM_LIMIT } from "../src/features/requests/items";

test("limites por item distinguem colaborador e administrador e agregam duplicatas", () => {
  assert.deepEqual([...parseRequestItems([{ variantId: "a", quantity: 3 }, { variantId: "b", quantity: 3 }], PUBLIC_ITEM_LIMIT)], [["a", 3], ["b", 3]]);
  assert.throws(() => parseRequestItems([{ variantId: "a", quantity: 2 }, { variantId: "a", quantity: 2 }], PUBLIC_ITEM_LIMIT), /3 unidades/);
  assert.equal(parseRequestItems([{ variantId: "a", quantity: 20 }], ADMIN_ITEM_LIMIT).get("a"), 20);
  for (const items of [[], null, [{ variantId: "", quantity: 1 }], [{ variantId: "a", quantity: 21 }], [{ variantId: "a", quantity: 11 }, { variantId: "a", quantity: 10 }], Array(21).fill({ variantId: "a", quantity: 1 })]) {
    assert.throws(() => parseRequestItems(items, ADMIN_ITEM_LIMIT));
  }
});

test("edição e aprovação de solicitações respeitam loja, reservas, status e versão", async (t) => {
  const oldSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "request-edit-test-secret-with-at-least-32-bytes";
  const restores: Array<() => void> = [];
  function replace(target: object, name: string, value: unknown) {
    const obj = target as Record<string, unknown>; const original = obj[name]; obj[name] = value;
    restores.push(() => { obj[name] = original; });
  }
  const version = new Date("2026-10-20T10:00:00Z");
  const session: AdminSession = { userId: "admin", login: "admin", role: "STORE_ADMIN", storeId: "loja-a", mustChangePassword: false, userUpdatedAt: version.getTime() };
  let user = session;
  type Item = { requestId: string; storeId: string; variantId: string; quantity: number };
  const initial = {
    id: "pedido", storeId: "loja-a", employeeId: "pessoa", code: "SOL-TEST", status: "PENDENTE",
    notes: "Observação original", updatedAt: version, employee: { name: "Ana Silva", ldap: "00123456" },
    items: [{ requestId: "pedido", storeId: "loja-a", variantId: "camisa", quantity: 3 }] as Item[],
  };
  let state = structuredClone(initial);
  let balances = { camisa: 5, calca: 10 };
  let movements: number[] = [];
  let otherReserved = 0;
  let claimConflict = false;
  let insertFailure = false;
  let transactions = 0;
  type Where = { id?: string; storeId_id?: { storeId: string; id: string } };
  const scoped = (query: { where: Where }) => query.where.storeId_id ? query.where.storeId_id.storeId === state.storeId && query.where.storeId_id.id === state.id : query.where.id === state.id;
  const find = async (query: { where: Where }) => scoped(query) ? { ...state, items: state.items.map((item) => ({ ...item, variant: { name: item.variantId, size: "M" } })) } : null;
  replace(prisma, "$executeRawUnsafe", async () => 0);
  replace(prisma.user, "findUnique", async () => ({ ...user, updatedAt: version, name: "Admin" }));
  replace(prisma.uniformRequest, "findUnique", find);
  function client(draft: typeof state, stocks: typeof balances, moves: number[]) {
    return {
      uniformRequest: {
        findUnique: find,
        updateMany: async ({ where, data }: { where: { id: string; storeId: string; status: string; updatedAt: Date }; data: { updatedAt?: Date; status?: string } }) => {
          assert.equal(where.storeId, state.storeId);
          assert.equal(where.updatedAt.getTime(), state.updatedAt.getTime());
          if (claimConflict) return { count: 0 };
          Object.assign(draft, data);
          return { count: 1 };
        },
      },
      stockLevel: {
        findMany: async ({ where }: { where: { storeId: string; variantId: { in: string[] } } }) => {
          assert.equal(where.storeId, state.storeId);
          return Object.entries(stocks).filter(([id]) => where.variantId.in.includes(id)).map(([variantId, quantity]) => ({ variantId, quantity }));
        },
        updateMany: async ({ where, data }: { where: { storeId: string; variantId: keyof typeof balances; quantity: { gte: number } }; data: { quantity: { decrement: number } } }) => {
          assert.equal(where.storeId, state.storeId);
          if (stocks[where.variantId] < where.quantity.gte) return { count: 0 };
          stocks[where.variantId] -= data.quantity.decrement; return { count: 1 };
        },
      },
      requestItem: {
        groupBy: async ({ where }: { where: { request: { storeId: string; status: string; id: { not: string } } } }) => {
          assert.deepEqual(where.request, { storeId: state.storeId, status: "PENDENTE", id: { not: "pedido" } });
          return [{ variantId: "camisa", _sum: { quantity: otherReserved } }];
        },
        deleteMany: async ({ where }: { where: { storeId: string; requestId: string } }) => {
          assert.deepEqual(where, { storeId: state.storeId, requestId: "pedido" }); draft.items = [];
        },
        createMany: async ({ data }: { data: Item[] }) => {
          if (insertFailure) throw new Error("insert failed");
          draft.items = data;
        },
      },
      stockMovement: { create: async ({ data }: { data: { quantity: number } }) => { moves.push(data.quantity); } },
    };
  }
  replace(prisma, "$transaction", async (fn: (tx: ReturnType<typeof client>) => Promise<unknown>, options: { isolationLevel: string }) => {
    transactions++; assert.equal(options.isolationLevel, "Serializable");
    const draft = structuredClone(state), stocks = { ...balances }, moves = [...movements];
    const result = await fn(client(draft, stocks, moves));
    state = draft; balances = stocks; movements = moves;
    return result;
  });
  const context = { params: Promise.resolve({ id: "pedido" }) };
  async function req(method: string, body?: unknown) {
    return new Request("http://localhost/api/requests/pedido", { method, headers: { cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(user)}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  async function edit(items: unknown, updatedAt = state.updatedAt.toISOString()) { return PUT(await req("PUT", { items, updatedAt, storeId: "loja-b" }), context); }
  const reset = () => { state = structuredClone(initial); balances = { camisa: 5, calca: 10 }; movements = []; otherReserved = 0; claimConflict = false; insertFailure = false; transactions = 0; user = session; };
  try {
    await t.test("consulta e edição recusam visitante, outra loja e troca de senha pendente", async () => {
      reset();
      assert.equal((await GET(new Request("http://localhost"), context)).status, 401);
      assert.equal((await PUT(new Request("http://localhost", { method: "PUT" }), context)).status, 401);
      user = { ...session, storeId: "loja-b" };
      assert.equal((await GET(await req("GET"), context)).status, 404);
      assert.equal((await edit([{ variantId: "camisa", quantity: 1 }])).status, 404);
      user = { ...session, mustChangePassword: true };
      assert.equal((await edit([{ variantId: "camisa", quantity: 1 }])).status, 403);
      assert.deepEqual(state, initial);
    });
    await t.test("admin substitui itens, soma duplicatas e ultrapassa 3 sem baixar estoque", async () => {
      reset();
      assert.equal((await GET(await req("GET"), context)).status, 200);
      assert.equal((await edit([{ variantId: "calca", quantity: 2 }, { variantId: "calca", quantity: 3 }])).status, 200);
      assert.deepEqual(state.items, [{ requestId: "pedido", storeId: "loja-a", variantId: "calca", quantity: 5 }]);
      assert.equal(state.status, "PENDENTE"); assert.equal(state.employeeId, initial.employeeId); assert.equal(state.notes, initial.notes);
      assert.notEqual(state.updatedAt.getTime(), version.getTime());
      assert.deepEqual(balances, { camisa: 5, calca: 10 }); assert.deepEqual(movements, []);
    });
    await t.test("reserva própria é liberada e reservas de outros pedidos são respeitadas", async () => {
      reset(); otherReserved = 2;
      assert.equal((await edit([{ variantId: "camisa", quantity: 3 }])).status, 200);
      const before = structuredClone(state);
      assert.equal((await edit([{ variantId: "camisa", quantity: 4 }])).status, 409);
      assert.deepEqual(state, before);
      assert.equal((await edit([{ variantId: "item-de-outra-loja", quantity: 1 }])).status, 409);
      assert.deepEqual(state, before);
    });
    await t.test("pedidos processados, versões antigas e conflito de gravação são bloqueados", async () => {
      reset();
      for (const status of ["APROVADA", "RECUSADA"]) {
        state.status = status; assert.equal((await edit([{ variantId: "camisa", quantity: 1 }])).status, 409);
      }
      state.status = "PENDENTE";
      assert.equal((await edit([{ variantId: "camisa", quantity: 1 }], new Date(0).toISOString())).status, 409);
      claimConflict = true;
      assert.equal((await edit([{ variantId: "camisa", quantity: 1 }])).status, 409);
      assert.deepEqual(state, initial);
    });
    await t.test("lote inválido é recusado antes da transação e falha de inserção reverte exclusão", async () => {
      reset();
      for (const items of [[], [{ variantId: "calca", quantity: 21 }], [{ variantId: "calca", quantity: 0 }], [{ variantId: "calca", quantity: 1.5 }]]) assert.equal((await edit(items)).status, 400);
      assert.equal(transactions, 0);
      insertFailure = true;
      assert.equal((await edit([{ variantId: "calca", quantity: 5 }])).status, 500);
      assert.deepEqual(state, initial);
    });
    await t.test("aprovação recusa versão anterior e baixa somente os itens corrigidos", async () => {
      reset();
      assert.equal((await edit([{ variantId: "calca", quantity: 5 }])).status, 200);
      assert.equal((await PATCH(await req("PATCH", { action: "APROVAR", updatedAt: version.toISOString() }), context)).status, 409);
      assert.deepEqual(movements, []);
      assert.equal((await PATCH(await req("PATCH", { action: "APROVAR", updatedAt: state.updatedAt.toISOString() }), context)).status, 200);
      assert.deepEqual(balances, { camisa: 5, calca: 5 }); assert.deepEqual(movements, [-5]); assert.equal(state.status, "APROVADA");
    });
    await t.test("MASTER_ADMIN edita na loja do pedido, sem aceitar troca de loja pelo corpo", async () => {
      reset(); user = { ...session, role: "MASTER_ADMIN", storeId: null };
      assert.equal((await edit([{ variantId: "calca", quantity: 4 }])).status, 200);
      assert.equal(state.items[0].storeId, "loja-a");
    });
  } finally {
    while (restores.length) restores.pop()!();
    if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = oldSecret;
  }
});
