import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSession, type AdminSession } from "../src/features/auth/session";
import { POST, PUT, DELETE } from "../src/app/api/variants/route";
import { POST as addOption, PATCH as renameOption } from "../src/app/api/catalog/options/route";

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
          uniformCatalog: { create: async ({ data }: { data: object }) => { writes++; return data; } },
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
    await t.test("exclusão global bloqueia saldo, histórico e versão antiga antes de remover réplicas", async () => {
      assert.equal((await DELETE(new Request("https://app.example", { method: "DELETE" }))).status, 401);
      assert.equal((await DELETE(await request({ sku: "CAM-M" }, "DELETE"))).status, 400);
      let stock = 0, requests = 0, movements = 0;
      const removed: string[] = [];
      prisma.$transaction = (async (callback: (tx: object) => Promise<unknown>, options: { isolationLevel: string }) => {
        assert.equal(options.isolationLevel, "Serializable");
        return callback({
          $executeRaw: async () => 1,
          uniformCatalog: { findUnique: async () => ({ sku: "CAM-M", updatedAt: time }), delete: async () => { removed.push("catalog"); } },
          stockLevel: { count: async () => stock, deleteMany: async () => { removed.push("stocks"); } },
          requestItem: { count: async () => requests },
          stockMovement: { count: async () => movements },
          uniformVariant: { deleteMany: async () => { removed.push("variants"); } },
        });
      }) as typeof prisma.$transaction;
      const body = { sku: "CAM-M", updatedAt: time.toISOString() };
      assert.equal((await DELETE(await request({ ...body, updatedAt: new Date(time.getTime() - 1).toISOString() }, "DELETE"))).status, 409);
      stock = 1;
      assert.equal((await DELETE(await request(body, "DELETE"))).status, 409);
      stock = 0; requests = 1;
      assert.equal((await DELETE(await request(body, "DELETE"))).status, 409);
      requests = 0; movements = 1;
      assert.equal((await DELETE(await request(body, "DELETE"))).status, 409);
      assert.deepEqual(removed, []);
      movements = 0;
      assert.equal((await DELETE(await request(body, "DELETE"))).status, 204);
      assert.deepEqual(removed, ["stocks", "variants", "catalog"]);
    });
  } finally {
    prisma.user.findUnique = restoreUser;
    prisma.$transaction = restoreTransaction;
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
