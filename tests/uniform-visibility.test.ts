import assert from "node:assert/strict";
import { test } from "node:test";
import type { Prisma } from "@prisma/client";
import { compareUniforms } from "../src/features/inventory/order";
import { assertAvailableStock } from "../src/features/inventory/server/stock-rules";
import { prisma } from "../src/lib/prisma";
import { createAdminSession, ADMIN_SESSION_COOKIE } from "../src/features/auth/session";
import { PATCH } from "../src/app/api/variants/visibility/route";

test("estoque ordena nome, classificação e tamanhos naturais", () => {
  const rows = [
    { name: "Camisa", gender: "MASCULINO" as const, size: "P", sku: "4" },
    ...["GG", "M", "PP", "G", "P"].map(size => ({ name: "Camisa", gender: "FEMININO" as const, size, sku: size })),
    ...["40", "8", "38"].map(size => ({ name: "Calça", gender: "FEMININO" as const, size, sku: size })),
  ];
  assert.deepEqual(rows.sort(compareUniforms).map(row => `${row.name}/${row.gender}/${row.size}`), [
    "Calça/FEMININO/8", "Calça/FEMININO/38", "Calça/FEMININO/40",
    "Camisa/FEMININO/PP", "Camisa/FEMININO/P", "Camisa/FEMININO/M", "Camisa/FEMININO/G", "Camisa/FEMININO/GG", "Camisa/MASCULINO/P",
  ]);
});

test("pedido recusa item oculto mesmo com saldo, nos dois escopos", async () => {
  for (const global of [false, true]) {
    const tx = {
      stockLevel: { findMany: async ({ where }: { where: Prisma.StockLevelWhereInput }) => {
        assert.equal(where.storeId, "loja-a");
        assert.deepEqual(where.variant, { hiddenFromRequests: false, catalog: { deletedAt: null, hiddenFromRequests: false } });
        const variant = { hiddenFromRequests: !global, catalog: { hiddenFromRequests: global } };
        return variant.hiddenFromRequests || variant.catalog.hiddenFromRequests ? [] : [{ variantId: "item", quantity: 100 }];
      } },
      requestItem: { groupBy: async () => [] },
    } as unknown as Prisma.TransactionClient;
    await assert.rejects(assertAvailableStock(tx, "loja-a", new Map([["item", 1]])), /ESTOQUE_INSUFICIENTE/);
  }
});

test("visibilidade autoriza gestor somente na própria loja e master nos dois escopos", async () => {
  const original = { user: prisma.user.findUnique, transaction: prisma.$transaction, raw: prisma.$executeRawUnsafe };
  const secret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "test-secret-with-at-least-32-bytes-long";
  const updatedAt = new Date();
  let role: "STORE_ADMIN" | "MASTER_ADMIN" = "STORE_ADMIN";
  let writes: unknown[] = [];
  prisma.user.findUnique = (async () => ({ id: "admin", login: "admin", role, storeId: "loja-a", mustChangePassword: false, updatedAt })) as unknown as typeof original.user;
  prisma.$executeRawUnsafe = (async () => 0) as unknown as typeof original.raw;
  const tx = {
    $executeRaw: async () => 0,
    uniformCatalog: {
      findUnique: async () => ({ sku: "CAM-P", deletedAt: null }),
      update: async (args: unknown) => { writes.push(args); return {}; },
    },
    uniformVariant: { updateMany: async (args: unknown) => { writes.push(args); return { count: 1 }; } },
  };
  prisma.$transaction = (async (callback: (client: typeof tx) => unknown) => callback(tx)) as unknown as typeof original.transaction;
  async function call(body: unknown, authenticated = true) {
    const token = await createAdminSession({ userId: "admin", login: "admin", role, storeId: "loja-a", mustChangePassword: false, userUpdatedAt: updatedAt.getTime() });
    return PATCH(new Request("http://localhost/api/variants/visibility", {
      method: "PATCH", headers: { "Content-Type": "application/json", ...(authenticated ? { cookie: `${ADMIN_SESSION_COOKIE}=${token}` } : {}) }, body: JSON.stringify(body),
    }));
  }
  try {
    const body = { sku: "CAM-P", hidden: true, scope: "store", storeId: "loja-a" };
    assert.equal((await call(body, false)).status, 401);
    assert.equal((await call({ ...body, storeId: "loja-b" })).status, 403);
    assert.equal((await call({ ...body, scope: "all" })).status, 403);
    assert.deepEqual(writes, []);
    assert.equal((await call(body)).status, 200);
    assert.deepEqual(writes, [{ where: { sku: "CAM-P", storeId: "loja-a" }, data: { hiddenFromRequests: true } }]);
    role = "MASTER_ADMIN"; writes = [];
    assert.equal((await call({ ...body, storeId: "loja-b", hidden: false })).status, 200);
    assert.equal((await call({ ...body, scope: "all" })).status, 200);
    assert.deepEqual(writes, [
      { where: { sku: "CAM-P", storeId: "loja-b" }, data: { hiddenFromRequests: false } },
      { where: { sku: "CAM-P" }, data: { hiddenFromRequests: true } },
    ]);
    assert.equal((await call({ ...body, hidden: "true" })).status, 400);
  } finally {
    prisma.user.findUnique = original.user;
    prisma.$transaction = original.transaction;
    prisma.$executeRawUnsafe = original.raw;
    if (secret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = secret;
  }
});
