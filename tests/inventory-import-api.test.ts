import assert from "node:assert/strict";
import { test } from "node:test";
import { SignJWT } from "jose";
import { prisma } from "../src/lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSession, type AdminSession } from "../src/lib/admin-session";
import { POST as previewRoute } from "../src/app/api/inventory/import/preview/route";
import { POST as confirmRoute } from "../src/app/api/inventory/import/route";
import type { ImportPreview } from "../src/lib/inventory-import-types";
import { inventoryWorkbook, type ExcelCell } from "./fixtures/inventory-workbook";

test("importação Excel: APIs autorizam, conferem e registram o lote atomicamente", async (t) => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "inventory-import-test-secret-with-32-bytes";
  const restores: Array<() => void> = [];
  function replace(target: object, name: string, value: unknown) {
    const object = target as Record<string, unknown>;
    const original = object[name]; object[name] = value;
    restores.push(() => { object[name] = original; });
  }
  const updatedAt = new Date("2026-10-19T12:00:00.000Z");
  const session: AdminSession = { userId: "admin", login: "operador", role: "STORE_ADMIN", storeId: "loja-a", mustChangePassword: false, userUpdatedAt: updatedAt.getTime() };
  let currentSession = session;
  replace(prisma, "$executeRawUnsafe", async () => 0);
  replace(prisma.user, "findUnique", async () => ({ ...currentSession, updatedAt, name: "Operador" }));
  const variants = [
    { id: "camisa", storeId: "loja-a", sku: "CAM-M", name: "Camiseta", category: "CAMISETA", size: "M", color: "Azul" },
    { id: "calca", storeId: "loja-a", sku: "CAL-42", name: "Calça", category: "CALCA", size: "42", color: "Preto" },
    { id: "outra", storeId: "loja-b", sku: "CAM-M", name: "Camiseta outra loja", category: "CAMISETA", size: "M", color: "Verde" },
  ];
  type Stock = { id: string; variantId: string; storeId: string; quantity: number; updatedAt: Date };
  type Movement = { id: string; variantId: string; storeId: string; type: string; quantity: number; note: string };
  const initialStock: Stock[] = variants.map((v, index) => ({ id: `stock-${v.id}`, variantId: v.id, storeId: v.storeId, quantity: 10 + index, updatedAt }));
  let stocks = structuredClone(initialStock);
  let movements: Movement[] = [];
  let transactions = 0;
  let failVariant = "";
  type ReceiptQuery = { where: { storeId: string; id: { in: string[] } } };
  const receipts = (source: Movement[], query: ReceiptQuery) => source.filter((m) => m.storeId === query.where.storeId && query.where.id.in.includes(m.id)).length;
  replace(prisma.stockMovement, "count", async (args: ReceiptQuery) => receipts(movements, args));
  replace(prisma.uniformVariant, "findMany", async ({ where }: { where: { storeId: string; sku: { in: string[] } } }) => variants.filter((v) => v.storeId === where.storeId && where.sku.in.includes(v.sku)).map((v) => ({ ...v, stockLevels: stocks.filter((s) => s.variantId === v.id && s.storeId === where.storeId) })));
  type Update = { where: Stock & { variant: { sku: string } }; data: { quantity: { increment: number } } };
  function transactionClient(draftStocks: Stock[], draftMovements: Movement[]) {
    return {
      stockLevel: { updateMany: async ({ where, data }: Update) => {
        const stock = draftStocks.find((s) => s.id === where.id && s.variantId === where.variantId && s.storeId === where.storeId && s.quantity === where.quantity && s.updatedAt.getTime() === where.updatedAt.getTime());
        const variant = variants.find((v) => v.id === where.variantId && v.sku === where.variant.sku);
        if (!stock || !variant || failVariant === where.variantId) return { count: 0 };
        stock.quantity += data.quantity.increment;
        stock.updatedAt = new Date(updatedAt.getTime() + 1000);
        return { count: 1 };
      } },
      stockMovement: {
        count: async (args: ReceiptQuery) => receipts(draftMovements, args),
        createMany: async ({ data }: { data: Movement[] }) => { draftMovements.push(...data); return { count: data.length }; },
      },
    };
  }
  replace(prisma, "$transaction", async (callback: (tx: ReturnType<typeof transactionClient>) => Promise<unknown>, options: { isolationLevel: string }) => {
    transactions++;
    assert.equal(options.isolationLevel, "Serializable");
    const draftStocks = structuredClone(stocks);
    const draftMovements = structuredClone(movements);
    const result = await callback(transactionClient(draftStocks, draftMovements));
    stocks = draftStocks; movements = draftMovements;
    return result;
  });
  async function upload(rows: ExcelCell[][] = [["SKU", "Quantidade"], ["CAM-M", 2], ["CAL-42", 3]], storeId = "loja-a") {
    const form = new FormData();
    form.set("storeId", storeId);
    form.set("file", new File([inventoryWorkbook(rows).buffer as ArrayBuffer], "entrada.xlsx"));
    return previewRoute(new Request("http://localhost/api/inventory/import/preview", { method: "POST", body: form, headers: { cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(currentSession)}` } }));
  }
  async function confirm(preview: ImportPreview, reviewedVariantIds: unknown = preview.rows.map((r) => r.variantId)) {
    return confirmRoute(new Request("http://localhost/api/inventory/import", { method: "POST", body: JSON.stringify({ token: preview.token, reviewedVariantIds }), headers: { "Content-Type": "application/json", cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(currentSession)}` } }));
  }
  const reset = () => { stocks = structuredClone(initialStock); movements = []; failVariant = ""; currentSession = session; transactions = 0; };
  try {
    await t.test("prévia traz metadados e saldos, agrupa duplicatas e não movimenta estoque", async () => {
      reset();
      const response = await upload([["SKU", "Quantidade"], ["CAM-M", 2], ["CAM-M", 3]]);
      assert.equal(response.status, 200);
      const preview = await response.json() as ImportPreview;
      assert.equal(preview.rows.length, 1);
      assert.deepEqual(preview.rows[0], { sku: "CAM-M", quantity: 5, sourceRows: [2, 3], variantId: "camisa", name: "Camiseta", category: "CAMISETA", size: "M", color: "Azul", currentQuantity: 10, finalQuantity: 15, error: null });
      assert.ok(preview.token);
      assert.equal(transactions, 0);
      assert.deepEqual(stocks, initialStock);
      assert.equal(movements.length, 0);
    });
    await t.test("SKU desconhecido e saldo final excessivo impedem assinatura da prévia inteira", async () => {
      reset();
      const preview = await (await upload([["SKU", "Quantidade"], ["CAM-M", 1_000_000], ["INEXISTENTE", 2]])).json() as ImportPreview;
      assert.equal(preview.token, null);
      assert.ok(preview.rows.every((r) => r.error));
      assert.equal((await confirm(preview)).status, 409);
      assert.equal(transactions, 0);
    });
    await t.test("somente todos os itens conferidos permitem somar; reenvio não duplica", async () => {
      reset();
      const preview = await (await upload()).json() as ImportPreview;
      assert.equal((await confirm(preview, ["camisa"])).status, 400);
      assert.equal((await confirm(preview, ["camisa", "camisa"])).status, 400);
      assert.equal(transactions, 0);
      assert.equal((await confirm(preview)).status, 200);
      assert.deepEqual(stocks.map((s) => s.quantity), [12, 14, 12]);
      assert.deepEqual(movements.map((m) => [m.storeId, m.type, m.quantity]), [["loja-a", "ENTRADA", 2], ["loja-a", "ENTRADA", 3]]);
      assert.ok(movements.every((m) => m.note.includes("operador")));
      const retry = await confirm(preview);
      assert.equal(retry.status, 200);
      assert.equal((await retry.json()).alreadyApplied, true);
      assert.deepEqual(stocks.map((s) => s.quantity), [12, 14, 12]);
      assert.equal(movements.length, 2);
    });
    await t.test("conflito no segundo item reverte o primeiro e não grava movimentações", async () => {
      reset();
      const preview = await (await upload()).json() as ImportPreview;
      failVariant = "calca";
      assert.equal((await confirm(preview)).status, 409);
      assert.deepEqual(stocks, initialStock);
      assert.equal(movements.length, 0);
    });
    await t.test("mudança de saldo ou versão desde a prévia exige nova conferência", async () => {
      reset();
      const preview = await (await upload()).json() as ImportPreview;
      stocks[0].quantity++;
      assert.equal((await confirm(preview)).status, 409);
      stocks[0].quantity--;
      stocks[0].updatedAt = new Date(updatedAt.getTime() + 1);
      assert.equal((await confirm(preview)).status, 409);
      assert.equal(movements.length, 0);
    });
    await t.test("recusa token adulterado, outro usuário, sessão sem acesso e outra loja", async () => {
      reset();
      assert.equal((await previewRoute(new Request("http://localhost", { method: "POST" }))).status, 401);
      assert.equal((await confirmRoute(new Request("http://localhost", { method: "POST" }))).status, 401);
      assert.equal((await upload(undefined, "loja-b")).status, 403);
      const preview = await (await upload()).json() as ImportPreview;
      const segments = preview.token!.split(".");
      const payload = JSON.parse(Buffer.from(segments[1], "base64url").toString());
      payload.rows[0].quantity = 999;
      segments[1] = Buffer.from(JSON.stringify(payload)).toString("base64url");
      assert.equal((await confirm({ ...preview, token: segments.join(".") })).status, 409);
      currentSession = { ...session, userId: "outro" };
      assert.equal((await confirm(preview)).status, 409);
      currentSession = { ...session, storeId: "loja-b" };
      assert.equal((await confirm(preview)).status, 409);
      currentSession = { ...session, mustChangePassword: true };
      assert.equal((await upload()).status, 403);
      assert.equal((await confirm(preview)).status, 403);
      assert.equal(transactions, 0);
    });
    await t.test("MASTER_ADMIN precisa selecionar loja e só soma na loja assinada", async () => {
      reset();
      currentSession = { ...session, role: "MASTER_ADMIN", storeId: null };
      assert.equal((await upload(undefined, "")).status, 400);
      const preview = await (await upload([["SKU", "Quantidade"], ["CAM-M", 4]], "loja-b")).json() as ImportPreview;
      assert.equal(preview.rows[0].name, "Camiseta outra loja");
      assert.equal((await confirm(preview)).status, 200);
      assert.deepEqual(stocks.map((s) => s.quantity), [10, 11, 16]);
    });
    await t.test("prévia expirada não soma; recibo permite recuperar confirmação já concluída", async () => {
      reset();
      const preview = await (await upload()).json() as ImportPreview;
      const payload = JSON.parse(Buffer.from(preview.token!.split(".")[1], "base64url").toString());
      const expired = await new SignJWT({ ...payload, exp: Math.floor(Date.now() / 1000) - 60 }).setProtectedHeader({ alg: "HS256" }).sign(new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET));
      assert.equal((await confirm({ ...preview, token: expired })).status, 409);
      assert.equal(movements.length, 0);
      assert.equal((await confirm(preview)).status, 200);
      const receipt = await confirm({ ...preview, token: expired });
      assert.equal(receipt.status, 200);
      assert.equal((await receipt.json()).alreadyApplied, true);
      assert.equal(movements.length, 2);
    });
  } finally {
    while (restores.length) restores.pop()!();
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET;
    else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
