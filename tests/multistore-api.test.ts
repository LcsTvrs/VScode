import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSession, type AdminSession } from "../src/features/auth/session";
import { DELETE as deleteOption } from "../src/app/api/catalog/options/route";
import { PATCH as bulk } from "../src/app/api/inventory/bulk/route";
import { GET as dashboard } from "../src/app/api/dashboard/route";
import { parseBulkInput, bulkResult } from "../src/features/inventory/bulk";

test("opções globais: exclusão exige master e bloqueia vínculos sem remover dados operacionais", async t => {
  const oldSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "multi-store-test-secret-at-least-32-bytes";
  const restores: (() => void)[] = [];
  function replace(target: object, key: string, value: unknown) { const obj = target as Record<string, unknown>, old = obj[key]; obj[key] = value; restores.push(() => { obj[key] = old; }); }
  const time = new Date("2026-10-26T12:00:00Z");
  const session: AdminSession = { userId: "master", login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: time.getTime() };
  replace(prisma.user, "findUnique", async () => ({ ...session, updatedAt: time }));
  let catalogLinks = 0, replicaLinks = 0, exists = true, deleted = 0, transactions = 0;
  replace(prisma, "$transaction", async (callback: (tx: object) => Promise<unknown>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable"); transactions++;
    const table = { findUnique: async () => exists ? { name: "Livre" } : null, delete: async () => { deleted++; return {}; } };
    // No delete method for uniforms/stock/requests is provided: only options may be removed.
    return callback({ $executeRaw: async () => 1, uniformSector: table, uniformCategoryOption: table, uniformCatalog: { count: async () => catalogLinks }, uniformVariant: { count: async () => replicaLinks } });
  });
  async function request(body: object) { return new Request("https://app.example/api/catalog/options", { method: "DELETE", headers: { "Content-Type": "application/json", cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}` }, body: JSON.stringify(body) }); }
  try {
    await t.test("visitante, gestor e senha pendente são recusados", async () => {
      assert.equal((await deleteOption(new Request("https://app.example"))).status, 401);
      session.role = "STORE_ADMIN"; session.storeId = "a";
      assert.equal((await deleteOption(await request({ kind: "sector", name: "Livre" }))).status, 403);
      session.role = "MASTER_ADMIN"; session.storeId = null; session.mustChangePassword = true;
      assert.equal((await deleteOption(await request({ kind: "category", name: "Livre" }))).status, 403);
      session.mustChangePassword = false; assert.equal(transactions, 0);
    });
    await t.test("exclui setor e categoria livres sem exigir loja", async () => {
      for (const kind of ["sector", "category"]) assert.equal((await deleteOption(await request({ kind, name: "Livre" }))).status, 200);
      assert.equal(deleted, 2);
    });
    await t.test("vínculo no catálogo sem lojas ou em réplica bloqueia com orientação", async () => {
      for (const kind of ["sector", "category"]) {
        for (const [canonical, replica] of [[1, 0], [0, 1]]) {
          catalogLinks = canonical; replicaLinks = replica;
          const response = await deleteOption(await request({ kind, name: "Livre" }));
          assert.equal(response.status, 409); assert.match((await response.json()).message, /Reclassifique/);
        }
      }
      assert.equal(deleted, 2); catalogLinks = replicaLinks = 0;
    });
    await t.test("opção removida retorna 404 e payload inválido retorna 400", async () => {
      exists = false;
      assert.equal((await deleteOption(await request({ kind: "sector", name: "Livre" }))).status, 404);
      assert.equal((await deleteOption(await request({ kind: "store", name: "Livre" }))).status, 400);
      assert.equal(deleted, 2);
    });
  } finally { while (restores.length) restores.pop()!(); if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = oldSecret; }
});

test("painel consolida lojas, mantém saldos separados e isola STORE_ADMIN", async () => {
  const oldSecret = process.env.ADMIN_SESSION_SECRET; process.env.ADMIN_SESSION_SECRET = "multi-store-dashboard-secret-at-least-32-bytes";
  const restores: (() => void)[] = [];
  function replace(target: object, key: string, value: unknown) { const obj = target as Record<string, unknown>, old = obj[key]; obj[key] = value; restores.push(() => { obj[key] = old; }); }
  const time = new Date("2026-10-26T12:00:00Z");
  const session: AdminSession = { userId: "master", login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: time.getTime() };
  const stores = ["a", "b"].map((id, i) => ({ id, code: `00${i}`, name: `Loja ${id}`, city: "Recife", state: "PE", employees: [],
    stockLevels: [{ quantity: 4 + i * 8, minimum: 5, updatedAt: time, variant: { id: `v-${id}`, sku: "SAME", catalog: { updatedAt: time }, name: "Camisa", sector: "Geral", category: "CAMISETA", size: "M", gender: "MASCULINO", color: "" } }],
    requests: [{ id: `r-${id}`, code: `R-${id}`, status: "PENDENTE", employee: { name: `Pessoa ${id}`, ldap: "00123456" }, createdAt: new Date(time.getTime() + i), updatedAt: time, items: [] }],
  }));
  replace(prisma.user, "findUnique", async () => ({ ...session, updatedAt: time }));
  replace(prisma.store, "findMany", async () => stores);
  replace(prisma.store, "findFirst", async ({ where }: { where: { id: string } }) => stores.find(store => store.id === where.id));
  async function get(query = "") { return dashboard(new Request(`https://app.example/api/dashboard${query}`, { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}` } })); }
  try {
    const all = await (await get()).json();
    assert.equal(all.scope, "all"); assert.equal(all.store.id, "");
    assert.deepEqual(all.metrics, { totalUnits: 16, lowStockCount: 1, pendingCount: 2, variantCount: 2 });
    assert.deepEqual(all.variants.map((v: { storeId: string; quantity: number }) => [v.storeId, v.quantity]), [["a", 4], ["b", 12]]);
    assert.deepEqual(all.requests.map((r: { storeId: string }) => r.storeId), ["b", "a"]);
    const single = await (await get("?storeId=b")).json(); assert.equal(single.scope, "store"); assert.equal(single.metrics.totalUnits, 12);
    assert.equal((await get("?storeId=unknown")).status, 404);
    session.role = "STORE_ADMIN"; session.storeId = "a";
    const scoped = await (await get("?storeId=b")).json(); assert.equal(scoped.metrics.totalUnits, 4); assert.equal(scoped.requests[0].storeId, "a"); assert.deepEqual(scoped.availableStores, []);
    session.role = "MASTER_ADMIN"; session.storeId = null; replace(prisma.store, "findMany", async () => []);
    const empty = await (await get()).json(); assert.equal(empty.scope, "all"); assert.equal(empty.metrics.totalUnits, 0); assert.deepEqual(empty.variants, []);
  } finally { while (restores.length) restores.pop()!(); if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = oldSecret; }
});

test("edição em massa é atômica, explícita e restrita ao MasterAdmin", async t => {
  const oldSecret = process.env.ADMIN_SESSION_SECRET; process.env.ADMIN_SESSION_SECRET = "multi-store-bulk-secret-at-least-32-bytes";
  const restores: (() => void)[] = [];
  function replace(target: object, key: string, value: unknown) { const obj = target as Record<string, unknown>, old = obj[key]; obj[key] = value; restores.push(() => { obj[key] = old; }); }
  const time = new Date("2026-10-26T12:00:00Z");
  const session: AdminSession = { userId: "master", login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: time.getTime() };
  replace(prisma.user, "findUnique", async () => ({ ...session, updatedAt: time }));
  let stocks = ["a", "b", "c"].map((id, i) => ({ id: `s-${id}`, storeId: id, variantId: `v-${id}`, quantity: 10 + i * 10, minimum: i + 1, updatedAt: time }));
  let movements: { storeId: string; quantity: number; type: string }[] = [];
  let reserved = 0, failSecond = false, transactions = 0;
  replace(prisma, "$transaction", async (callback: (tx: object) => Promise<unknown>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable"); transactions++;
    const draft = structuredClone(stocks), audit = structuredClone(movements);
    const result = await callback({
      stockLevel: {
        findUnique: async ({ where }: { where: { storeId_variantId: { storeId: string; variantId: string } } }) => draft.find(row => row.storeId === where.storeId_variantId.storeId && row.variantId === where.storeId_variantId.variantId),
        updateMany: async ({ where, data }: { where: { id: string }; data: Partial<typeof stocks[number]> }) => { if (failSecond && where.id === "s-b") return { count: 0 }; Object.assign(draft.find(row => row.id === where.id)!, data); return { count: 1 }; },
      },
      requestItem: { aggregate: async () => ({ _sum: { quantity: reserved } }) },
      stockMovement: { create: async ({ data }: { data: typeof movements[number] }) => { audit.push(data); return {}; } },
    });
    stocks = draft; movements = audit; return result;
  });
  const records = () => stocks.slice(0, 2).map(row => ({ storeId: row.storeId, variantId: row.variantId, updatedAt: row.updatedAt.toISOString() }));
  async function run(change: object, selected = records()) { return bulk(new Request("https://app.example/api/inventory/bulk", { method: "PATCH", headers: { "Content-Type": "application/json", cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}` }, body: JSON.stringify({ records: selected, change }) })); }
  try {
    await t.test("gestor e visitante não podem enviar lotes de nenhuma loja", async () => {
      assert.equal((await bulk(new Request("https://app.example"))).status, 401);
      session.role = "STORE_ADMIN"; session.storeId = "a"; assert.equal((await run({ mode: "SET", quantity: 2 })).status, 403);
      session.role = "MASTER_ADMIN"; session.storeId = null; assert.equal(transactions, 0);
    });
    await t.test("define saldo e mínimo apenas nos dois selecionados, com auditoria por loja", async () => {
      const other = structuredClone(stocks[2]);
      assert.equal((await run({ mode: "SET", quantity: 7, minimum: 4 })).status, 200);
      assert.deepEqual(stocks.map(row => row.quantity), [7, 7, 30]); assert.deepEqual(stocks[2], other);
      assert.deepEqual(movements.map(m => [m.storeId, m.quantity]), [["a", -3], ["b", -13]]);
    });
    await t.test("adicionar, retirar e alterar só mínimo são operações distintas", async () => {
      assert.equal((await run({ mode: "ADD", quantity: 3 })).status, 200);
      assert.deepEqual(stocks.map(row => row.quantity), [10, 10, 30]);
      assert.equal((await run({ mode: "REMOVE", quantity: 2 })).status, 200);
      const count = movements.length;
      assert.equal((await run({ mode: "KEEP", minimum: 0 })).status, 200);
      assert.deepEqual(stocks.map(row => row.quantity), [8, 8, 30]); assert.equal(movements.length, count);
    });
    await t.test("reserva, negativo, conflito e loja adulterada revertem todo o lote", async () => {
      const before = structuredClone(stocks), audit = structuredClone(movements);
      reserved = 8; assert.equal((await run({ mode: "SET", quantity: 7 })).status, 409); reserved = 0;
      assert.equal((await run({ mode: "REMOVE", quantity: 9 })).status, 409);
      failSecond = true; assert.equal((await run({ mode: "ADD", quantity: 2 })).status, 409); failSecond = false;
      assert.equal((await run({ mode: "ADD", quantity: 2 }, [{ ...records()[0], storeId: "b" }])).status, 409);
      assert.equal((await run({ mode: "ADD", quantity: 2 }, [{ ...records()[0], updatedAt: time.toISOString() }])).status, 409);
      assert.deepEqual(stocks, before); assert.deepEqual(movements, audit);
    });
    await t.test("payload vazio, repetido, excessivo ou sem alteração é recusado antes da transação", async () => {
      const before = transactions;
      for (const selected of [[], [records()[0], records()[0]], Array.from({ length: 201 }, (_, i) => ({ ...records()[0], variantId: `v-${i}` }))]) assert.equal((await run({ mode: "SET", quantity: 1 }, selected)).status, 400);
      assert.equal((await run({ mode: "KEEP" })).status, 400);
      assert.equal((await run({ mode: "SET", quantity: -1 })).status, 400);
      assert.equal(transactions, before);
      assert.throws(() => parseBulkInput({ records: records(), change: { mode: "KEEP", minimum: 1, quantity: 9 } }));
      assert.throws(() => bulkResult(999999, 0, { mode: "ADD", quantity: 2 }));
    });
  } finally { while (restores.length) restores.pop()!(); if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = oldSecret; }
});
