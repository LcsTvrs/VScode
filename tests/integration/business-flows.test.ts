import { PATCH as bulkStock } from "../../src/app/api/inventory/bulk/route";
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
import { POST as createStore } from "../../src/app/api/stores/route";
import { POST as addOption, PATCH as renameOption, DELETE as deleteOption } from "../../src/app/api/catalog/options/route";
import { PUT as updateVariant, POST as createVariant, DELETE as deleteVariant } from "../../src/app/api/variants/route";
import { POST as moveStock, PATCH as editStock } from "../../src/app/api/inventory/route";
import { GET as publicCatalog, POST as publicRequest } from "../../src/app/api/requests/public/route";
import { POST as adminRequest } from "../../src/app/api/requests/route";
import { GET as history } from "../../src/app/api/requests/route";
import { GET as employees } from "../../src/app/api/employees/route";
import { GET as getRequest, PUT as editRequest, PATCH as processRequest } from "../../src/app/api/requests/[id]/route";
import { POST as importPreview } from "../../src/app/api/inventory/import/preview/route";
import { POST as importConfirm } from "../../src/app/api/inventory/import/route";
import { GET as imageSelection, POST as assignImage } from "../../src/app/api/variants/[id]/image/route";
import { GET as bulkImageSelection, POST as assignBulkImage } from "../../src/app/api/variants/images/route";
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
  const catalogSkus = ["REF-" + namespace, "REF-2-" + namespace];
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
    // Global fixture SKUs also exist in stores that preceded this invocation.
    await prisma.stockLevel.deleteMany({ where: { variant: { sku: { in: catalogSkus } } } });
    await prisma.uniformVariant.deleteMany({ where: { sku: { in: catalogSkus } } });
    await prisma.uniformCatalog.deleteMany({ where: { sku: { in: catalogSkus } } });
    await prisma.uniformCategoryOption.deleteMany({ where: { name: { in: ["Bermuda " + namespace, "Bermudas " + namespace] } } });
    await prisma.uniformSector.deleteMany({ where: { name: { in: ["Setor " + namespace, "Setor novo " + namespace] } } });
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
  const catalogStoreCount = await prisma.store.count();
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
    const payload = { sku: "REF-" + namespace, name: "Uniforme sintético", sector: "Logística", category: "CAMISETA", gender: "MASCULINO", size: "M" };
    assert.equal((await createVariant(request("/api/variants", "POST", payload, storeToken))).status, 403);
    for (const sku of [payload.sku, "REF-2-" + namespace]) {
      const response = await createVariant(request("/api/variants", "POST", { ...payload, sku }, masterToken));
      assert.equal(response.status, 201);
    }
    variantA = (await prisma.uniformVariant.findUniqueOrThrow({ where: { storeId_sku: { storeId: storeA.id, sku: payload.sku } } })).id;
    variantB = (await prisma.uniformVariant.findUniqueOrThrow({ where: { storeId_sku: { storeId: storeB.id, sku: payload.sku } } })).id;
    secondVariant = (await prisma.uniformVariant.findUniqueOrThrow({ where: { storeId_sku: { storeId: storeA.id, sku: "REF-2-" + namespace } } })).id;
    assert.equal(await prisma.stockLevel.count({ where: { storeId: { in: stores }, quantity: 0, minimum: 5 } }), 4);
    for (const [storeId, variantId] of [[storeA.id, variantA], [storeB.id, variantB], [storeA.id, secondVariant]]) {
      assert.equal((await moveStock(request("/api/inventory", "POST", { storeId, variantId, type: "ENTRADA", quantity: 10 }, masterToken))).status, 201);
    }
    assert.equal((await prisma.uniformVariant.findUniqueOrThrow({ where: { id: variantA } })).storeId, storeA.id);
    assert.equal((await moveStock(request("/api/inventory", "POST", { storeId: storeB.id, variantId: variantB, type: "ENTRADA", quantity: 1 }, storeToken))).status, 404);
  });
  await t.test("edicao global e opcoes personalizadas preservam todos os estoques", async () => {
    const before = await prisma.stockLevel.findMany({ where: { storeId: { in: stores } }, orderBy: { id: "asc" } });
    assert.equal((await addOption(request("/api/catalog/options", "POST", { kind: "category", name: "Bermuda " + namespace }, masterToken))).status, 201);
    assert.equal((await addOption(request("/api/catalog/options", "POST", { kind: "sector", name: "Setor " + namespace }, masterToken))).status, 201);
    assert.equal((await addOption(request("/api/catalog/options", "POST", { kind: "category", name: "bermuda " + namespace }, masterToken))).status, 409);
    const current = await prisma.uniformCatalog.findUniqueOrThrow({ where: { sku: "REF-2-" + namespace } });
    const payload = { sku: current.sku, name: current.name, sector: "Setor " + namespace, category: "Bermuda " + namespace, gender: "MASCULINO", size: current.size, updatedAt: current.updatedAt.toISOString() };
    assert.equal((await updateVariant(request("/api/variants", "PUT", payload, masterToken))).status, 200);
    assert.equal((await updateVariant(request("/api/variants", "PUT", payload, masterToken))).status, 409);
    for (const [kind, previous, name] of [["category", payload.category, "Bermudas " + namespace], ["sector", payload.sector, "Setor novo " + namespace]]) {
      assert.equal((await renameOption(request("/api/catalog/options", "PATCH", { kind, previous, name }, storeToken))).status, 403);
      assert.equal((await renameOption(request("/api/catalog/options", "PATCH", { kind, previous, name }, masterToken))).status, 200);
    }
    const copies = await prisma.uniformVariant.findMany({ where: { sku: current.sku } });
    assert.equal(copies.length, catalogStoreCount);
    for (const copy of copies) { assert.equal(copy.category, "Bermudas " + namespace); assert.equal(copy.sector, "Setor novo " + namespace); }
    assert.deepEqual(await prisma.stockLevel.findMany({ where: { storeId: { in: stores } }, orderBy: { id: "asc" } }), before);
    const fresh = await prisma.uniformCatalog.findUniqueOrThrow({ where: { sku: current.sku } });
    assert.equal((await updateVariant(request("/api/variants", "PUT", { ...payload, sector: "Logística", category: "CAMISETA", updatedAt: fresh.updatedAt.toISOString() }, masterToken))).status, 200);
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
    assert.equal(body.updatedCount, catalogStoreCount);
    assert.equal((await prisma.uniformVariant.findUniqueOrThrow({ where: { id: variantB } })).imageId, body.imageId);
    assert.equal((await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeB.id, variantId: variantB } } })).quantity, 10);
  });
  await t.test("nova loja recebe catalogo completo com imagem e saldos independentes", async () => {
    const response = await createStore(request("/api/stores", "POST", { name: "Nova loja " + namespace, city: "Recife", state: "PE" }, masterToken));
    assert.equal(response.status, 201);
    const { store } = await response.json(); stores.push(store.id);
    const stocks = await prisma.stockLevel.findMany({ where: { storeId: store.id }, include: { variant: true } });
    assert.equal(stocks.length, await prisma.uniformCatalog.count());
    for (const stock of stocks) { assert.equal(stock.quantity, 0); assert.equal(stock.minimum, 5); }
    assert.equal(stocks.find(stock => stock.variant.sku === "REF-" + namespace)!.variant.imageId, images[0]);
    const original = await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeA.id, variantId: variantA } } });
    assert.equal((await editStock(request("/api/inventory", "PATCH", { variantId: variantA, quantity: original.quantity + 1, minimum: 3, updatedAt: original.updatedAt.toISOString(), storeId: store.id }, storeToken))).status, 200);
    assert.equal((await prisma.stockLevel.findUniqueOrThrow({ where: { id: stocks[0].id } })).quantity, 0);
  });
  await t.test("foto em lote atualiza vários SKUs atomicamente sem alterar saldos", async () => {
    const selected = [variantA, secondVariant];
    const beforeStocks = await prisma.stockLevel.findMany({ orderBy: { id: "asc" } });
    const details = await bulkImageSelection(request("/api/variants/images?" + selected.map(id => `id=${id}`).join("&"), "GET", undefined, masterToken));
    assert.equal(details.status, 200);
    const preview = await details.json();
    const buffer = await sharp({ create: { width: 20, height: 20, channels: 3, background: "blue" } }).png().toBuffer();
    async function save(version: string) {
      const form = new FormData(); selected.forEach(id => form.append("id", id)); form.set("version", version);
      form.set("image", new File([new Uint8Array(buffer)], "foto.png", { type: "image/png" }));
      return assignBulkImage(new Request("https://app.example/api/variants/images", { method: "POST", headers: { cookie: ADMIN_SESSION_COOKIE + "=" + masterToken }, body: form }));
    }
    assert.equal((await save("0".repeat(64))).status, 409);
    const result = await save(preview.version);
    assert.equal(result.status, 200);
    const body = await result.json(); images.push(body.imageId);
    assert.equal(body.updatedCount, preview.matches.length);
    const variants = await prisma.uniformVariant.findMany({ where: { sku: { in: catalogSkus } } });
    assert.ok(variants.every(variant => variant.imageId === body.imageId));
    const catalog = await prisma.uniformCatalog.findMany({ where: { sku: { in: catalogSkus } } });
    assert.ok(catalog.every(item => item.imageId === body.imageId));
    assert.deepEqual(await prisma.stockLevel.findMany({ orderBy: { id: "asc" } }), beforeStocks);
  });
  await t.test("CSV respeita loja da sessão e inclui classificação e pedidos", async () => {
    const inventory = await inventoryCsv(request("/api/exports/inventory?storeId=" + storeB.id, "GET", undefined, storeToken));
    assert.equal(inventory.status, 200);
    const csv = await inventory.text(); assert.ok(csv.includes(storeA.name)); assert.ok(!csv.includes(storeB.name)); assert.ok(csv.includes("Masculino"));
    const history = await requestsCsv(request("/api/exports/requests", "GET", undefined, storeToken));
    assert.equal(history.status, 200); assert.ok((await history.text()).includes("Pessoa Sintética"));
  });
  await t.test("exclusao global preserva dados e exige reclassificar opcoes vinculadas", async () => {
    const before = await prisma.stockLevel.findMany({ where: { storeId: { in: stores } }, orderBy: { id: "asc" } });
    const counts = [await prisma.uniformVariant.count(), await prisma.uniformRequest.count(), await prisma.stockMovement.count()];
    for (const [kind, name] of [["sector", "Setor novo " + namespace], ["category", "Bermudas " + namespace]]) {
      assert.equal((await deleteOption(request("/api/catalog/options", "DELETE", { kind, name }, storeToken))).status, 403);
      assert.equal((await deleteOption(request("/api/catalog/options", "DELETE", { kind, name }, masterToken))).status, 200);
    }
    for (const [kind, name] of [["sector", "Logística"], ["category", "CAMISETA"]]) {
      const response = await deleteOption(request("/api/catalog/options", "DELETE", { kind, name }, masterToken));
      assert.equal(response.status, 409); assert.match((await response.json()).message, /Reclassifique/);
    }
    assert.deepEqual(await prisma.stockLevel.findMany({ where: { storeId: { in: stores } }, orderBy: { id: "asc" } }), before);
    assert.deepEqual([await prisma.uniformVariant.count(), await prisma.uniformRequest.count(), await prisma.stockMovement.count()], counts);
  });
  await t.test("painel global, indicadores e exportacoes respeitam o filtro e o perfil", async () => {
    const allResponse = await dashboard(request("/api/dashboard", "GET", undefined, masterToken));
    assert.equal(allResponse.status, 200); const all = await allResponse.json(); assert.equal(all.scope, "all");
    const ownResponse = await dashboard(request("/api/dashboard?storeId=" + storeA.id, "GET", undefined, masterToken));
    const own = await ownResponse.json();
    assert.equal(all.metrics.totalUnits, await prisma.stockLevel.aggregate({ _sum: { quantity: true } }).then(result => result._sum.quantity));
    assert.equal(own.metrics.totalUnits, await prisma.stockLevel.aggregate({ where: { storeId: storeA.id }, _sum: { quantity: true } }).then(result => result._sum.quantity));
    assert.ok(all.variants.some((v: { storeId: string }) => v.storeId === storeB.id));
    assert.ok(own.variants.every((v: { storeId: string }) => v.storeId === storeA.id));
    const scoped = await (await dashboard(request("/api/dashboard?storeId=" + storeB.id, "GET", undefined, storeToken))).json();
    assert.ok(scoped.variants.every((v: { storeId: string }) => v.storeId === storeA.id));
    for (const exporter of [inventoryCsv, requestsCsv]) {
      const allCsv = await (await exporter(request("/api/exports", "GET", undefined, masterToken))).text();
      const ownCsv = await (await exporter(request("/api/exports?storeId=" + storeA.id, "GET", undefined, masterToken))).text();
      assert.ok(allCsv.includes(storeA.name)); assert.ok(ownCsv.includes(storeA.name)); assert.ok(!ownCsv.includes(storeB.name));
      if (exporter === inventoryCsv) assert.ok(allCsv.includes(storeB.name));
    }
  });
  await t.test("consulta compacta, paginação integral, filtros e colaboradores preservam escopo e totais", async () => {
    const person = await prisma.employee.create({ data: { storeId: storeA.id, ldap: "00998877", name: "Pessoa de consulta " + namespace } });
    await prisma.uniformRequest.createMany({ data: Array.from({ length: 61 }, (_, i) => ({ storeId: storeA.id, employeeId: person.id, code: `QUERY-${namespace}-${i}`, status: i % 2 ? "RECUSADA" : "APROVADA", createdAt: new Date(i < 30 ? "2026-10-20T02:59:59.999Z" : "2026-10-20T03:00:00Z") })) });
    const queryOrders = await prisma.uniformRequest.findMany({ where: { storeId: storeA.id, employeeId: person.id }, select: { id: true } });
    await prisma.requestItem.createMany({ data: queryOrders.map(row => ({ requestId: row.id, storeId: storeA.id, variantId: variantA, quantity: 1 })) });
    const full = await (await dashboard(request(`/api/dashboard?storeId=${storeA.id}`, "GET", undefined, masterToken))).json();
    const compact = await (await dashboard(request(`/api/dashboard?compact=1&storeId=${storeB.id}`, "GET", undefined, storeToken))).json();
    assert.deepEqual(compact.metrics, full.metrics);
    assert.deepEqual(compact.variants, full.variants);
    assert.deepEqual(compact.employees, []); assert.equal(compact.historyMode, "paged");
    assert.ok(compact.requests.length <= 4); assert.ok(compact.requests.every((row: { status: string }) => row.status === "PENDENTE"));
    const bytes = { full: Buffer.byteLength(JSON.stringify(full)), compact: Buffer.byteLength(JSON.stringify(compact)) };
    assert.ok(bytes.compact < bytes.full); console.log("Payload sintético do dashboard (bytes):", JSON.stringify(bytes));
    const ids = new Set<string>();
    for (let page = 1; page <= 3; page++) {
      const response = await history(request(`/api/requests?storeId=${storeB.id}&search=00998877&page=${page}`, "GET", undefined, storeToken));
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.filteredTotal, 61); assert.equal(body.total, full.requests.length);
      assert.equal(body.requests.length, page === 3 ? 11 : 25);
      for (const row of body.requests) { assert.equal(row.storeId, storeA.id); assert.ok(!ids.has(row.id)); ids.add(row.id); }
    }
    assert.equal(ids.size, 61);
    const filtered = await (await history(request(`/api/requests?storeId=${storeA.id}&search=00998877&start=2026-10-20&end=2026-10-20&status=APROVADA`, "GET", undefined, masterToken))).json();
    assert.equal(filtered.filteredTotal, 16); assert.equal(filtered.total, full.requests.length);
    const staff = await (await employees(request(`/api/employees?storeId=${storeB.id}`, "GET", undefined, storeToken))).json();
    assert.ok(staff.employees.some((row: { id: string }) => row.id === person.id));
    assert.ok(staff.employees.every((row: { storeId: string }) => row.storeId === storeA.id));
    const exported = await (await requestsCsv(request(`/api/exports/requests?storeId=${storeB.id}`, "GET", undefined, storeToken))).text();
    assert.ok(exported.includes(storeA.name)); assert.ok(!exported.includes(storeB.name));
    for (let i = 0; i < 61; i++) assert.ok(exported.includes(`QUERY-${namespace}-${i}`));
  });
  await t.test("lote entre lojas preserva reservas, reversao e concorrencia com baixa unica", async () => {
    const read = async () => {
      const rows = await prisma.stockLevel.findMany({ where: { variantId: { in: [variantA, variantB] } }, orderBy: { storeId: "asc" } });
      return rows.map(row => ({ storeId: row.storeId, variantId: row.variantId, updatedAt: row.updatedAt.toISOString() }));
    };
    const send = (records: Awaited<ReturnType<typeof read>>, change: object, token = masterToken) => bulkStock(request("/api/inventory/bulk", "PATCH", { records, change }, token));
    const unselected = await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: storeA.id, variantId: secondVariant } } });
    assert.equal((await send(await read(), { mode: "ADD", quantity: 1 }, storeToken)).status, 403);
    const records = await read();
    const results = await Promise.all([send(records, { mode: "ADD", quantity: 2 }), send(records, { mode: "ADD", quantity: 2 })]);
    assert.deepEqual(results.map(r => r.status).sort(), [200, 409]);
    const after = await prisma.stockLevel.findMany({ where: { variantId: { in: [variantA, variantB] } }, orderBy: { storeId: "asc" } });
    const audit = await prisma.stockMovement.count();
    const stale = await read(); stale[1].updatedAt = new Date(0).toISOString();
    assert.equal((await send(stale, { mode: "REMOVE", quantity: 1 })).status, 409);
    assert.deepEqual(await prisma.stockLevel.findMany({ where: { variantId: { in: [variantA, variantB] } }, orderBy: { storeId: "asc" } }), after);
    assert.equal(await prisma.stockMovement.count(), audit);
    assert.equal((await send(await read(), { mode: "SET", quantity: 0 })).status, 409);
    const stockA = after.find(row => row.storeId === storeA.id)!;
    assert.equal((await editStock(request("/api/inventory", "PATCH", { variantId: variantA, quantity: 0, minimum: stockA.minimum, updatedAt: stockA.updatedAt.toISOString() }, storeToken))).status, 409);
    assert.equal((await moveStock(request("/api/inventory", "POST", { variantId: variantA, type: "AJUSTE", quantity: 0 }, storeToken))).status, 409);
    assert.equal((await send(await read(), { mode: "KEEP", minimum: 2 })).status, 200);
    assert.equal(await prisma.stockMovement.count(), audit);
    assert.deepEqual(await prisma.stockLevel.findUniqueOrThrow({ where: { id: unselected.id } }), unselected);
  });
  await t.test("Master consulta, edita, aprova e recusa pedidos de lojas diferentes por ID", async () => {
    const employeeB = await prisma.employee.create({ data: { storeId: storeB.id, name: "Pessoa Sintética B", ldap: "87654321" } });
    for (const [storeId, variantId, employee, action] of [[storeA.id, variantA, employeeId, "APROVAR"], [storeB.id, variantB, employeeB.id, "RECUSAR"]]) {
      const response = await adminRequest(request("/api/requests", "POST", { storeId, employeeId: employee, items: [{ variantId, quantity: 1 }] }, masterToken));
      assert.equal(response.status, 201); const orderId = (await response.json()).id;
      const details = await (await getRequest(request("/api/requests/" + orderId, "GET", undefined, masterToken), context(orderId))).json();
      assert.equal((await editRequest(request("/api/requests/" + orderId, "PUT", { updatedAt: details.updatedAt, items: [{ variantId, quantity: 2 }] }, masterToken), context(orderId))).status, 200);
      if (storeId === storeB.id) assert.equal((await getRequest(request("/api/requests/" + orderId, "GET", undefined, storeToken), context(orderId))).status, 404);
      const updated = await prisma.uniformRequest.findUniqueOrThrow({ where: { id: orderId } });
      assert.equal((await processRequest(request("/api/requests/" + orderId, "PATCH", { action, updatedAt: updated.updatedAt.toISOString() }, masterToken), context(orderId))).status, 200);
    }
    const exportAll = await (await requestsCsv(request("/api/exports/requests", "GET", undefined, masterToken))).text();
    assert.ok(exportAll.includes(storeA.name) && exportAll.includes(storeB.name));
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
  await t.test("exclusão global exige saldo zero e preserva pedidos e movimentações", async () => {
    const existing = await prisma.uniformCatalog.findUniqueOrThrow({ where: { sku: catalogSkus[0] } });
    const remove = (sku: string, updatedAt: string, token = masterToken) => deleteVariant(request("/api/variants", "DELETE", { sku, updatedAt }, token));
    assert.equal((await remove(existing.sku, existing.updatedAt.toISOString(), storeToken)).status, 401);
    assert.equal((await remove(existing.sku, existing.updatedAt.toISOString())).status, 409);
    const sku = "DEL-" + namespace;
    catalogSkus.push(sku);
    const created = await createVariant(request("/api/variants", "POST", { sku, name: "Excluir sintético", sector: existing.sector, category: existing.category, gender: "MASCULINO", size: "M" }, masterToken));
    assert.equal(created.status, 201);
    const item = await created.json();
    const copies = await prisma.uniformVariant.findMany({ where: { sku } });
    assert.equal(copies.length, await prisma.store.count());
    const historicalVariant = copies.find(variant => variant.storeId === storeA.id)!;
    const historicalMovement = await prisma.stockMovement.create({ data: { storeId: storeA.id, variantId: historicalVariant.id, type: "AJUSTE", quantity: 0, note: "Histórico sintético para exclusão" } });
    const historicalRequest = await prisma.uniformRequest.create({ data: { storeId: storeA.id, employeeId, code: "DEL-" + namespace, status: "APROVADA" } });
    await prisma.requestItem.create({ data: { storeId: storeA.id, requestId: historicalRequest.id, variantId: historicalVariant.id, quantity: 1 } });
    const stock = await prisma.stockLevel.findUniqueOrThrow({ where: { storeId_variantId: { storeId: copies[0].storeId, variantId: copies[0].id } } });
    await prisma.stockLevel.update({ where: { id: stock.id }, data: { quantity: 1 } });
    assert.equal((await remove(sku, item.updatedAt)).status, 409);
    assert.equal(await prisma.uniformVariant.count({ where: { sku } }), copies.length);
    await prisma.stockLevel.update({ where: { id: stock.id }, data: { quantity: 0 } });
    assert.equal((await remove(sku, new Date(0).toISOString())).status, 409);
    assert.equal((await remove(sku, item.updatedAt)).status, 204);
    assert.ok((await prisma.uniformCatalog.findUniqueOrThrow({ where: { sku } })).deletedAt);
    assert.equal(await prisma.uniformVariant.count({ where: { sku } }), copies.length);
    assert.equal(await prisma.stockLevel.count({ where: { variantId: { in: copies.map(v => v.id) } } }), 0);
    assert.ok(await prisma.stockMovement.findUnique({ where: { id: historicalMovement.id } }));
    const history = await prisma.uniformRequest.findUniqueOrThrow({ where: { id: historicalRequest.id }, include: { items: { include: { variant: true } } } });
    assert.equal(history.items[0].variant.sku, sku);
    const panel = await (await dashboard(request("/api/dashboard", "GET", undefined, masterToken))).json();
    assert.ok(!panel.variants.some((variant: { sku: string }) => variant.sku === sku));
    assert.ok(panel.requests.some((order: { id: string }) => order.id === historicalRequest.id));
    assert.ok(await prisma.uniformCatalog.findUnique({ where: { sku: existing.sku } }));
  });
});
