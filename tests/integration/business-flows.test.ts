import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { test } from "node:test";
import bcrypt from "bcryptjs";
import sharp from "sharp";
import { prisma } from "../../src/lib/prisma";
import { ADMIN_SESSION_COOKIE } from "../../src/features/auth/session";
import { POST as login } from "../../src/app/api/auth/login/route";
import { GET as dashboard } from "../../src/app/api/dashboard/route";
import { POST as createUser } from "../../src/app/api/users/route";
import { POST as resetPassword } from "../../src/app/api/users/[id]/reset/route";
import { POST as createVariant } from "../../src/app/api/variants/route";
import { POST as moveStock, PATCH as editStock } from "../../src/app/api/inventory/route";
import { GET as publicCatalog, POST as publicRequest } from "../../src/app/api/requests/public/route";
import { POST as adminRequest } from "../../src/app/api/requests/route";
import { GET as getRequest, PUT as editRequest, PATCH as processRequest } from "../../src/app/api/requests/[id]/route";
import { POST as importPreview } from "../../src/app/api/inventory/import/preview/route";
import { POST as importConfirm } from "../../src/app/api/inventory/import/route";
import { GET as imageSelection, POST as assignImage } from "../../src/app/api/variants/[id]/image/route";
import { GET as inventoryCsv } from "../../src/app/api/exports/inventory/route";
import { GET as requestsCsv } from "../../src/app/api/exports/requests/route";
import { inventoryWorkbook } from "../fixtures/inventory-workbook";

test("fluxos críticos com PostgreSQL isolado e dados sintéticos", async t => {
  const url = new URL(process.env.DATABASE_URL!);
  assert.ok(process.env.ALLOW_LOCAL_INTEGRATION === "1" && ["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) && url.pathname === "/uniformes_refactor_test");
  const namespace = randomUUID().slice(0, 8).toUpperCase();
  const stores: string[] = [];
  const users: string[] = [];
  const images: string[] = [];
  const context = (id: string) => ({ params: Promise.resolve({ id }) });
  const request = (path: string, method = "GET", body?: object, token?: string) => new Request("https://app.example" + path, {
    method, headers: { "Content-Type": "application/json", ...(token ? { cookie: ADMIN_SESSION_COOKIE + "=" + token } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  t.after(async () => {
    // Delete only fixtures owned by this invocation; never clear a whole table.
    await prisma.requestItem.deleteMany({ where: { storeId: { in: stores } } });
    await prisma.uniformRequest.deleteMany({ where: { storeId: { in: stores } } });
    await prisma.stockMovement.deleteMany({ where: { storeId: { in: stores } } });
    await prisma.stockLevel.deleteMany({ where: { storeId: { in: stores } } });
    await prisma.uniformVariant.deleteMany({ where: { storeId: { in: stores } } });
    await prisma.uniformImage.deleteMany({ where: { id: { in: images }, variants: { none: {} } } });
    await prisma.employee.deleteMany({ where: { storeId: { in: stores } } });
    await prisma.user.deleteMany({ where: { id: { in: users } } });
    await prisma.store.deleteMany({ where: { id: { in: stores } } });
    await prisma.$disconnect();
  });
  const storeA = await prisma.store.create({ data: { code: "REF-A-" + namespace, name: "Refatoração A", city: "São Paulo", state: "SP" } });
  stores.push(storeA.id);
  const storeB = await prisma.store.create({ data: { code: "REF-B-" + namespace, name: "Refatoração B", city: "Curitiba", state: "PR" } });
  stores.push(storeB.id);
  const initialPassword = "Synthetic-temporary-12345";
  const definitivePassword = "Synthetic-personal-12345";
  const master = await prisma.user.create({ data: { login: "ref-master-" + namespace, name: "Master sintético", role: "MASTER_ADMIN", mustChangePassword: false, passwordHash: await bcrypt.hash(initialPassword, 4) } });
  users.push(master.id);
  const masterLogin = await login(request("/api/auth/login", "POST", { login: master.login, senha: initialPassword }));
  assert.equal(masterLogin.status, 200);
  const masterToken = masterLogin.cookies.get(ADMIN_SESSION_COOKIE)!.value;
  let storeToken = "", temporaryPassword = "", userId = "";
  await t.test("criação, login temporário, bloqueio e troca com resposta preservada", async () => {
    const created = await createUser(request("/api/users", "POST", { login: "ref-store-" + namespace, name: "Gestor sintético", role: "STORE_ADMIN", storeId: storeA.id }, masterToken));
    assert.equal(created.status, 201);
    const body = await created.json();
    userId = body.user.id; users.push(userId); temporaryPassword = body.temporaryPassword;
    const entered = await login(request("/api/auth/login", "POST", { login: body.user.login, senha: temporaryPassword }));
    assert.equal(entered.status, 200);
    const pendingToken = entered.cookies.get(ADMIN_SESSION_COOKIE)!.value;
    assert.equal((await dashboard(request("/api/dashboard", "GET", undefined, pendingToken))).status, 403);
    const changed = await login(request("/api/auth/login", "POST", { acao: "trocar-senha", novaSenha: definitivePassword }, pendingToken));
    assert.equal(changed.status, 200);
    const responseText = await changed.text();
    assert.deepEqual(JSON.parse(responseText), { ok: true, mustChangePassword: false });
    assert.notEqual(createHash("sha256").update(responseText).digest("hex"), "4062edaf750fb8074e7e83e0c9028c94e32468a8b6f1614774328ef045150f93");
    storeToken = changed.cookies.get(ADMIN_SESSION_COOKIE)!.value;
    assert.equal((await dashboard(request("/api/dashboard", "GET", undefined, storeToken))).status, 200);
    const recovered = await login(request("/api/auth/login", "POST", { acao: "trocar-senha", novaSenha: definitivePassword }, pendingToken));
    assert.equal(recovered.status, 200);
    assert.equal(await recovered.text(), responseText);
    assert.equal((await dashboard(request("/api/dashboard", "GET", undefined, pendingToken))).status, 401);
  });
  let variantA = "", variantB = "", secondVariant = "";
  await t.test("cadastro, classificação e escopo de loja", async () => {
    for (const [token, target, sku, setId] of [
      [storeToken, storeB.id, "REF-" + namespace, (id: string) => { variantA = id; }],
      [masterToken, storeB.id, "REF-" + namespace, (id: string) => { variantB = id; }],
      [storeToken, storeA.id, "REF-2-" + namespace, (id: string) => { secondVariant = id; }],
    ] as const) {
      const response = await createVariant(request("/api/variants", "POST", { storeId: target, sku, name: "Uniforme sintético", sector: "Logística", category: "CAMISETA", gender: "MASCULINO", size: "M", color: "Verde", quantity: 10, minimum: 2 }, token));
      assert.equal(response.status, 201);
      const data = await response.json(); setId(data.id);
    }
    assert.equal((await prisma.uniformVariant.findUniqueOrThrow({ where: { id: variantA } })).storeId, storeA.id);
    assert.equal((await moveStock(request("/api/inventory", "POST", { storeId: storeB.id, variantId: variantB, type: "ENTRADA", quantity: 1 }, storeToken))).status, 404);
  });
  await t.test("catálogo público informa setor e disponibilidade sem divulgar saldos", async () => {
    const response = await publicCatalog(request("/api/requests/public?storeCode=" + storeA.code));
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.variants.length, 2);
    for (const variant of body.variants) {
      assert.equal(variant.sector, "Logística");
      assert.ok(!("quantity" in variant) && !("available" in variant) && !("minimum" in variant));
    }
  });
  await t.test("movimentação e edição detectam versão antiga e preservam saldo", async () => {
    const stock = await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeA.id, variantId: variantA } } });
    assert.equal((await moveStock(request("/api/inventory", "POST", { variantId: variantA, type: "ENTRADA", quantity: 2 }, storeToken))).status, 201);
    assert.equal((await editStock(request("/api/inventory", "PATCH", { variantId: variantA, quantity: 8, minimum: 2, updatedAt: stock.updatedAt.toISOString() }, storeToken))).status, 409);
    assert.equal((await prisma.stockLevel.findUniqueOrThrow({ where: { id: stock.id } })).quantity, 12);
  });
  let employeeId = "", pendingId = "";
  await t.test("pedido público respeita limite e aprovação concorrente baixa uma única vez", async () => {
    const payload = { storeCode: storeA.code, ldap: "00123456", name: "Pessoa Sintética", items: [{ variantId: variantA, quantity: 3 }] };
    assert.equal((await publicRequest(request("/api/requests/public", "POST", { ...payload, items: [{ variantId: variantA, quantity: 4 }] }))).status, 400);
    const created = await publicRequest(request("/api/requests/public", "POST", payload));
    assert.equal(created.status, 201);
    pendingId = (await created.json()).id;
    const pending = await prisma.uniformRequest.findUniqueOrThrow({ where: { id: pendingId } });
    employeeId = pending.employeeId;
    const before = (await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeA.id, variantId: variantA } } })).quantity;
    const approvals = await Promise.all([1, 2].map(() => processRequest(request("/api/requests/" + pendingId, "PATCH", { action: "APROVAR", updatedAt: pending.updatedAt.toISOString() }, storeToken), context(pendingId))));
    assert.deepEqual(approvals.map(response => response.status).sort(), [200, 409]);
    assert.equal((await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeA.id, variantId: variantA } } })).quantity, before - 3);
    assert.equal(await prisma.stockMovement.count({ where: { storeId: storeA.id, type: "SAIDA" } }), 1);
  });
  await t.test("edição de pedido substitui reserva e conflito não sobrescreve a versão", async () => {
    const created = await adminRequest(request("/api/requests", "POST", { employeeId, items: [{ variantId: variantA, quantity: 2 }] }, storeToken));
    assert.equal(created.status, 201);
    const id = (await created.json()).id;
    const loaded = await getRequest(request("/api/requests/" + id, "GET", undefined, storeToken), context(id));
    const version = (await loaded.json()).updatedAt;
    const update = () => editRequest(request("/api/requests/" + id, "PUT", { updatedAt: version, items: [{ variantId: variantA, quantity: 4 }] }, storeToken), context(id));
    assert.equal((await update()).status, 200);
    assert.equal((await update()).status, 409);
    assert.equal((await prisma.requestItem.findFirstOrThrow({ where: { requestId: id } })).quantity, 4);
  });
  await t.test("falha no segundo item reverte status, primeira baixa e movimentações", async () => {
    const response = await adminRequest(request("/api/requests", "POST", { employeeId, items: [{ variantId: variantA, quantity: 1 }, { variantId: secondVariant, quantity: 1 }] }, storeToken));
    assert.equal(response.status, 201);
    const id = (await response.json()).id;
    const pending = await prisma.uniformRequest.findUniqueOrThrow({ where: { id } });
    const firstStock = await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeA.id, variantId: variantA } } });
    const movements = await prisma.stockMovement.count({ where: { storeId: storeA.id } });
    await prisma.stockLevel.update({ where: { storeId_variantId: { storeId: storeA.id, variantId: secondVariant } }, data: { quantity: 0 } });
    const processed = await processRequest(request("/api/requests/" + id, "PATCH", { action: "APROVAR", updatedAt: pending.updatedAt.toISOString() }, storeToken), context(id));
    assert.equal(processed.status, 409);
    assert.equal((await prisma.stockLevel.findUniqueOrThrow({ where: { id: firstStock.id } })).quantity, firstStock.quantity);
    assert.equal((await prisma.uniformRequest.findUniqueOrThrow({ where: { id } })).status, "PENDENTE");
    assert.equal(await prisma.stockMovement.count({ where: { storeId: storeA.id } }), movements);
  });
  await t.test("Excel real tem prévia e recibo persistido sem somar novamente", async () => {
    const bytes = inventoryWorkbook([["SKU", "Quantidade"], ["REF-" + namespace, 5]]);
    const form = new FormData();
    form.set("storeId", storeA.id);
    form.set("file", new File([new Uint8Array(bytes)], "entrada.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
    const preview = await importPreview(new Request("https://app.example/api/inventory/import/preview", { method: "POST", headers: { cookie: ADMIN_SESSION_COOKIE + "=" + storeToken }, body: form }));
    assert.equal(preview.status, 200);
    const data = await preview.json();
    const payload = { token: data.token, reviewedVariantIds: [variantA] };
    const before = (await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeA.id, variantId: variantA } } })).quantity;
    const confirm = () => importConfirm(request("/api/inventory/import", "POST", payload, storeToken));
    const first = await confirm(); assert.equal(first.status, 200); assert.equal((await first.json()).alreadyApplied, false);
    const again = await confirm(); assert.equal(again.status, 200); assert.equal((await again.json()).alreadyApplied, true);
    assert.equal((await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeA.id, variantId: variantA } } })).quantity, before + 5);
  });
  await t.test("imagem replica por SKU entre lojas sem alterar estoque", async () => {
    const details = await imageSelection(request("/api/variants/" + variantA + "/image", "GET", undefined, masterToken), context(variantA));
    assert.equal(details.status, 200);
    const version = (await details.json()).version;
    const buffer = await sharp({ create: { width: 20, height: 20, channels: 3, background: "green" } }).png().toBuffer();
    const form = new FormData(); form.set("version", version); form.set("replicate", "true"); form.set("image", new File([new Uint8Array(buffer)], "uniforme.png", { type: "image/png" }));
    const response = await assignImage(new Request("https://app.example/api/variants/" + variantA + "/image", { method: "POST", headers: { cookie: ADMIN_SESSION_COOKIE + "=" + masterToken }, body: form }), context(variantA));
    assert.equal(response.status, 200);
    const body = await response.json(); images.push(body.imageId);
    assert.equal(body.updatedCount, 2);
    assert.equal((await prisma.uniformVariant.findUniqueOrThrow({ where: { id: variantB } })).imageId, body.imageId);
    assert.equal((await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeB.id, variantId: variantB } } })).quantity, 10);
  });
  await t.test("CSV respeita loja da sessão e inclui classificação e pedidos", async () => {
    const inventory = await inventoryCsv(request("/api/exports/inventory?storeId=" + storeB.id, "GET", undefined, storeToken));
    assert.equal(inventory.status, 200);
    const csv = await inventory.text(); assert.ok(csv.includes(storeA.name)); assert.ok(!csv.includes(storeB.name)); assert.ok(csv.includes("Masculino"));
    const history = await requestsCsv(request("/api/exports/requests", "GET", undefined, storeToken));
    assert.equal(history.status, 200); assert.ok((await history.text()).includes("Pessoa Sintética"));
  });
  await t.test("novo reset revoga sessão definitiva e volta a exigir troca", async () => {
    const reset = await resetPassword(request("/api/users/" + userId + "/reset", "POST", undefined, masterToken), context(userId));
    assert.equal(reset.status, 200);
    assert.equal((await dashboard(request("/api/dashboard", "GET", undefined, storeToken))).status, 401);
    const body = await reset.json();
    const account = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
    const entered = await login(request("/api/auth/login", "POST", { login: account.login, senha: body.temporaryPassword }));
    assert.equal(entered.status, 200);
    const token = entered.cookies.get(ADMIN_SESSION_COOKIE)!.value;
    assert.equal((await dashboard(request("/api/dashboard", "GET", undefined, token))).status, 403);
    assert.equal(account.passwordChangeDeadline, null);
  });
});
