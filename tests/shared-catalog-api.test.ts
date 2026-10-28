import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSession, type AdminSession } from "../src/features/auth/session";
import { POST, PUT, DELETE } from "../src/app/api/variants/route";
import { POST as addOption, PATCH as renameOption } from "../src/app/api/catalog/options/route";
import { populateStoreCatalog } from "../src/features/inventory/server/catalog";
import type { Prisma } from "@prisma/client";

test("catálogo global exige MasterAdmin e valida cadastro sem estoque ou cor", async t => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "catalog-test-session-secret-at-least-32-bytes";
  const time = new Date("2026-10-24T12:00:00Z");
  const session: AdminSession = { userId: "master", login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: time.getTime() };
  const restoreUser = prisma.user.findUnique;
  const restoreTransaction = prisma.$transaction;
  let writes = 0;
  prisma.user.findUnique = (async () => ({ ...session, updatedAt: time })) as unknown as typeof prisma.user.findUnique;
  const payload = { sku: "cam-m", name: "Camiseta", sector: "Logística", category: "CAMISETA", gender: "MASCULINO", size: "M" };
  async function request(body: object, method = "POST") {
    return new Request("https://app.example/api/variants", { method, headers: { "Content-Type": "application/json", cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}` }, body: JSON.stringify(body) });
  }
  try {
    await t.test("visitante, gestor e senha pendente não escrevem em catálogo nem opções", async () => {
      assert.equal((await POST(new Request("https://app.example", { method: "POST" }))).status, 401);
      for (const pending of [false, true]) {
        session.role = pending ? "MASTER_ADMIN" : "STORE_ADMIN";
        session.storeId = pending ? null : "a";
        session.mustChangePassword = pending;
        for (const handler of [POST, PUT, DELETE, addOption, renameOption]) assert.equal((await handler(await request(payload))).status, 403);
      }
      session.role = "MASTER_ADMIN"; session.storeId = null; session.mustChangePassword = false;
    });
    await t.test("validação recusa campos inválidos, cor e estoque no cadastro", async () => {
      for (const invalid of [{ sector: "" }, { sector: "A".repeat(81) }, { category: "" }, { sku: "A".repeat(41) }, { name: " " }, { size: "" }, { gender: null }, { gender: "OUTRO" }, { quantity: 10 }, { minimum: 5 }, { color: "Azul" }]) {
        assert.equal((await POST(await request({ ...payload, ...invalid }))).status, 400);
      }
      assert.equal((await PUT(await request(payload, "PUT"))).status, 400);
    });
    await t.test("setor ou categoria fora das opções cadastradas é recusado", async () => {
      prisma.$transaction = (async (callback: (tx: object) => Promise<unknown>) => callback({
        $executeRaw: async () => 1,
        uniformSector: { findUnique: async () => null },
        uniformCategoryOption: { findUnique: async () => ({ name: "CAMISETA" }) },
      })) as typeof prisma.$transaction;
      assert.equal((await POST(await request(payload))).status, 400);
    });
    await t.test("cadastro cria um item em cada loja, sempre com saldo zero", async () => {
      const stocks: object[] = [], variants: object[] = [];
      prisma.$transaction = (async (callback: (tx: object) => Promise<unknown>, options: { isolationLevel: string }) => {
        assert.equal(options.isolationLevel, "Serializable");
        return callback({
          $executeRaw: async () => 1,
          uniformSector: { findUnique: async () => ({ name: "Logística" }) },
          uniformCategoryOption: { findUnique: async () => ({ name: "CAMISETA" }) },
          uniformCatalog: { findUnique: async () => null, create: async ({ data }: { data: object }) => { writes++; return data; } },
          store: { findMany: async () => [{ id: "a" }, { id: "b" }] },
          uniformVariant: { create: async ({ data }: { data: object }) => { variants.push(data); return { id: `v-${variants.length}` }; } },
          stockLevel: { create: async ({ data }: { data: object }) => { stocks.push(data); } },
        });
      }) as typeof prisma.$transaction;
      const response = await POST(await request(payload));
      assert.equal(response.status, 201);
      assert.equal((await response.json()).sku, "CAM-M");
      assert.equal(variants.length, 2);
      assert.deepEqual(stocks, [{ storeId: "a", variantId: "v-1", quantity: 0, minimum: 5 }, { storeId: "b", variantId: "v-2", quantity: 0, minimum: 5 }]);
      assert.equal(writes, 1);
    });
    await t.test("edição desatualizada não sobrescreve o catálogo", async () => {
      prisma.$transaction = (async (callback: (tx: object) => Promise<unknown>) => callback({
        $executeRaw: async () => 1,
        uniformSector: { findUnique: async () => ({ name: "Logística" }) },
        uniformCategoryOption: { findUnique: async () => ({ name: "CAMISETA" }) },
        uniformCatalog: { findUnique: async () => ({ ...payload, updatedAt: time }) },
      })) as typeof prisma.$transaction;
      assert.equal((await PUT(await request({ ...payload, updatedAt: new Date(time.getTime() - 1).toISOString() }, "PUT"))).status, 409);
    });
    await t.test("exclusão global bloqueia saldo e versão antiga, preservando histórico", async () => {
      assert.equal((await DELETE(new Request("https://app.example", { method: "DELETE" }))).status, 401);
      assert.equal((await DELETE(await request({ sku: "CAM-M" }, "DELETE"))).status, 400);
      let stock = 0;
      const removed: string[] = [];
      prisma.$transaction = (async (callback: (tx: object) => Promise<unknown>, options: { isolationLevel: string }) => {
        assert.equal(options.isolationLevel, "Serializable");
        return callback({
          $executeRaw: async () => 1,
          uniformCatalog: { findUnique: async () => ({ sku: "CAM-M", updatedAt: time }), update: async ({ data }: { data: { deletedAt: Date } }) => { assert.ok(data.deletedAt instanceof Date); removed.push("archive"); } },
          stockLevel: { count: async () => stock, deleteMany: async () => { removed.push("stocks"); } },
          requestItem: { count: async () => 1, deleteMany: async () => assert.fail("Histórico de pedidos deve permanecer") },
          stockMovement: { count: async () => 1, deleteMany: async () => assert.fail("Histórico de estoque deve permanecer") },
          uniformVariant: { deleteMany: async () => assert.fail("Vínculos históricos devem permanecer") },
        });
      }) as typeof prisma.$transaction;
      const body = { sku: "CAM-M", updatedAt: time.toISOString() };
      assert.equal((await DELETE(await request({ ...body, updatedAt: new Date(time.getTime() - 1).toISOString() }, "DELETE"))).status, 409);
      stock = 1;
      assert.equal((await DELETE(await request(body, "DELETE"))).status, 409);
      assert.deepEqual(removed, []);
      stock = 0;
      assert.equal((await DELETE(await request(body, "DELETE"))).status, 204);
      assert.deepEqual(removed, ["stocks", "archive"]);
    });
    await t.test("recadastrar SKU excluído reutiliza vínculos e cria saldo zero em todas as lojas", async () => {
      const stocks: object[] = [], stores: string[] = [];
      prisma.$transaction = (async (callback: (tx: object) => Promise<unknown>) => callback({
        $executeRaw: async () => 1,
        uniformSector: { findUnique: async () => ({ name: "Logística" }) },
        uniformCategoryOption: { findUnique: async () => ({ name: "CAMISETA" }) },
        uniformCatalog: {
          findUnique: async () => ({ ...payload, sku: "CAM-M", deletedAt: time }),
          update: async ({ data }: { data: object }) => { assert.equal((data as { deletedAt: unknown }).deletedAt, null); return { ...data, imageId: "photo" }; },
        },
        store: { findMany: async () => [{ id: "a" }, { id: "nova" }] },
        uniformVariant: { upsert: async ({ where, create, update }: { where: { storeId_sku: { storeId: string; sku: string } }; create: object; update: object }) => {
          stores.push(where.storeId_sku.storeId); assert.equal(where.storeId_sku.sku, "CAM-M");
          assert.deepEqual(create, update); assert.equal((update as { imageId: string }).imageId, "photo");
          return { id: `${where.storeId_sku.storeId}-variant` };
        } },
        stockLevel: { create: async ({ data }: { data: object }) => { stocks.push(data); } },
      })) as typeof prisma.$transaction;
      assert.equal((await POST(await request(payload))).status, 201);
      assert.deepEqual(stores, ["a", "nova"]);
      assert.deepEqual(stocks, [{ storeId: "a", variantId: "a-variant", quantity: 0, minimum: 5 }, { storeId: "nova", variantId: "nova-variant", quantity: 0, minimum: 5 }]);
    });
    await t.test("loja nova recebe somente catálogo ativo", async () => {
      const tx = {
        uniformCatalog: { findMany: async ({ where }: { where: object }) => { assert.deepEqual(where, { deletedAt: null }); return []; } },
        uniformVariant: { create: async () => assert.fail("Não deve criar uniforme excluído") },
      };
      await populateStoreCatalog(tx as unknown as Prisma.TransactionClient, "nova");
    });
  } finally {
    prisma.user.findUnique = restoreUser;
    prisma.$transaction = restoreTransaction;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
