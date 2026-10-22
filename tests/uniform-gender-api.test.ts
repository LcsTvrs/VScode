import assert from "node:assert/strict";
import { test } from "node:test";
import { prisma } from "../src/lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSession, type AdminSession } from "../src/lib/admin-session";
import { POST as createVariant } from "../src/app/api/variants/route";
import { PATCH as editStock } from "../src/app/api/inventory/route";
import { GET as dashboard } from "../src/app/api/dashboard/route";
import { GET as publicCatalog } from "../src/app/api/requests/public/route";
import { GET as exportStock } from "../src/app/api/exports/inventory/route";
import { GET as exportRequests } from "../src/app/api/exports/requests/route";

test("classificação dos uniformes: cadastro, edição, escopo e leitura", async (t) => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "uniform-gender-test-secret-at-least-32-bytes";
  const restores: (() => void)[] = [];
  function replace(target: object, key: string, value: unknown) {
    const object = target as Record<string, unknown>;
    const original = object[key];
    object[key] = value;
    restores.push(() => { object[key] = original; });
  }
  const version = new Date("2026-10-20T10:00:00Z");
  const session: AdminSession = { userId: "admin", login: "teste", role: "STORE_ADMIN", storeId: "loja-a", mustChangePassword: false, userUpdatedAt: version.getTime() };
  replace(prisma, "$executeRawUnsafe", async () => 0);
  replace(prisma.user, "findUnique", async () => ({ ...session, name: "Operador", updatedAt: version }));
  const store = { id: "loja-a", name: "Loja A", code: "0012", city: "São Paulo", state: "SP" };
  const legacy = { id: "camisa", storeId: store.id, name: "Camiseta", sku: "CAM-M", category: "CAMISETA", gender: null as string | null, size: "M", color: "Azul" };
  let variant = { ...legacy };
  let stock = { id: "saldo", storeId: store.id, variantId: variant.id, quantity: 10, minimum: 2, updatedAt: version };
  let movements = 0;
  let transactions = 0;
  let conflict = false;
  replace(prisma, "$transaction", async (callback: (tx: object) => Promise<unknown>) => {
    transactions++;
    const draftVariant = { ...variant };
    const draftStock = { ...stock };
    let draftMovements = movements;
    const result = await callback({
      uniformVariant: {
        create: async ({ data }: { data: typeof variant & { store: { connect: { id: string } } } }) => {
          assert.equal(data.store.connect.id, store.id);
          Object.assign(draftVariant, data);
          return draftVariant;
        },
        updateMany: async ({ where, data }: { where: { id: string; storeId: string }; data: { gender: string | null } }) => {
          assert.deepEqual(where, { id: variant.id, storeId: store.id });
          draftVariant.gender = data.gender;
          return { count: 1 };
        },
      },
      stockLevel: {
        create: async ({ data }: { data: Partial<typeof stock> }) => { Object.assign(draftStock, data); return draftStock; },
        findUnique: async ({ where }: { where: { storeId_variantId: { storeId: string; variantId: string } } }) => {
          assert.equal(where.storeId_variantId.storeId, store.id);
          return where.storeId_variantId.variantId === variant.id ? { ...stock } : null;
        },
        updateMany: async ({ where, data }: { where: { updatedAt: Date }; data: Partial<typeof stock> }) => {
          assert.equal(where.updatedAt.getTime(), stock.updatedAt.getTime());
          if (conflict) return { count: 0 };
          Object.assign(draftStock, data);
          return { count: 1 };
        },
      },
      stockMovement: { create: async () => { draftMovements++; return { id: "movimento" }; } },
    });
    variant = draftVariant; stock = draftStock; movements = draftMovements;
    return result;
  });
  async function request(path: string, method = "GET", body?: object) {
    return new Request(`http://localhost${path}`, { method, headers: { cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}`, "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}) });
  }
  const payload = { sku: "CAM-M", name: "Camiseta", category: "CAMISETA", size: "M", color: "Azul", quantity: 10, minimum: 2 };
  try {
    await t.test("novo item exige Masculino ou Feminino; não aceita ausente, nulo ou valor arbitrário", async () => {
      for (const gender of [undefined, null, "", "UNISSEX", 1]) {
        assert.equal((await createVariant(await request("/api/variants", "POST", { ...payload, gender }))).status, 400);
      }
      assert.equal(transactions, 0);
      for (const gender of ["MASCULINO", "FEMININO"]) {
        const response = await createVariant(await request("/api/variants", "POST", { ...payload, gender, storeId: "loja-invasora" }));
        assert.equal(response.status, 201);
        assert.equal((await response.json()).gender, gender);
      }
    });
    await t.test("classifica legado sem movimentar saldo, atualiza versão e preserva escopo", async () => {
      variant = { ...legacy };
      const before = movements;
      const response = await editStock(await request("/api/inventory", "PATCH", { variantId: variant.id, quantity: 10, minimum: 2, gender: "FEMININO", storeId: "outra-loja" }));
      assert.equal(response.status, 200);
      assert.equal(variant.gender, "FEMININO");
      assert.equal(stock.quantity, 10);
      assert.ok(stock.updatedAt > version, "classificação deve invalidar prévias antigas de importação");
      assert.equal(movements, before);
      assert.equal((await editStock(await request("/api/inventory", "PATCH", { variantId: variant.id, quantity: 10, minimum: 2 }))).status, 200);
      assert.equal(variant.gender, "FEMININO", "campo omitido preserva classificação");
      assert.equal((await editStock(await request("/api/inventory", "PATCH", { variantId: variant.id, quantity: 10, minimum: 2, gender: null }))).status, 200);
      assert.equal(variant.gender, null);
    });
    await t.test("recusa classificação inválida, item de outra loja e conflito sem gravação parcial", async () => {
      const beforeStock = { ...stock };
      const beforeMovements = movements;
      for (const [data, status] of [
        [{ variantId: variant.id, gender: "OUTRO" }, 400],
        [{ variantId: "item-outra-loja", gender: "FEMININO" }, 404],
      ] as const) {
        assert.equal((await editStock(await request("/api/inventory", "PATCH", { ...data, quantity: 12, minimum: 2 }))).status, status);
      }
      conflict = true;
      assert.equal((await editStock(await request("/api/inventory", "PATCH", { variantId: variant.id, gender: "MASCULINO", quantity: 12, minimum: 2 }))).status, 409);
      assert.deepEqual(stock, beforeStock);
      assert.equal(variant.gender, null);
      assert.equal(movements, beforeMovements);
    });
    await t.test("catálogo, painel e CSV expõem classificação e histórico estruturado da loja", async () => {
      const variants = [null, "MASCULINO", "FEMININO"].map((gender, i) => ({ ...legacy, id: `item-${i}`, gender, imageId: i ? "photo" : null }));
      const stocks = variants.map((v) => ({ ...stock, variant: v, variantId: v.id, store }));
      const items = variants.map((v, i) => ({ variantId: v.id, variant: v, quantity: i + 1 }));
      const order = { id: "pedido", code: "SOL-TEST", store, employee: { name: "Ana Silva", ldap: "00123456" }, status: "PENDENTE", createdAt: version, updatedAt: version, items };
      replace(prisma.store, "findFirst", async ({ where }: { where: { id: string } }) => {
        assert.equal(where.id, store.id);
        return { ...store, stockLevels: stocks, requests: [order], employees: [] };
      });
      replace(prisma.store, "findUnique", async () => store);
      replace(prisma.stockLevel, "findMany", async ({ where }: { where: { storeId: string } }) => { assert.equal(where.storeId, store.id); return stocks; });
      replace(prisma.uniformRequest, "findMany", async ({ where }: { where: { storeId: string } }) => { assert.equal(where.storeId, store.id); return [order]; });
      replace(prisma.uniformRequest, "count", async () => 1);
      replace(prisma.requestItem, "groupBy", async () => []);
      const panel = await (await dashboard(await request("/api/dashboard?storeId=outra-loja"))).json();
      assert.deepEqual(panel.variants.map((v: { gender: string | null }) => v.gender), [null, "MASCULINO", "FEMININO"]);
      assert.deepEqual(panel.variants.map((v: { imageId: string | null }) => v.imageId), [null, "photo", "photo"]);
      assert.deepEqual(panel.requests[0].items.map((i: { name: string; gender: string | null; quantity: number }) => [i.name, i.gender, i.quantity]), [["Camiseta", null, 1], ["Camiseta", "MASCULINO", 2], ["Camiseta", "FEMININO", 3]]);
      const catalog = await (await publicCatalog(await request("/api/requests/public?storeCode=0012"))).json();
      assert.deepEqual(catalog.variants.map((v: { gender: string | null }) => v.gender), [null, "MASCULINO", "FEMININO"]);
      assert.deepEqual(catalog.variants.map((v: { imageId: string | null }) => v.imageId), [null, "photo", "photo"]);
      for (const exportRoute of [exportStock, exportRequests]) {
        const csv = await (await exportRoute(await request("/api/exports?storeId=outra-loja"))).text();
        for (const label of ["Classificação", "Não informado", "Masculino", "Feminino"]) assert.ok(csv.includes(label));
      }
    });
  } finally {
    while (restores.length) restores.pop()!();
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
