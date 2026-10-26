import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

const version = "2026-10-26T12:00:00.000Z";
async function setup(page: Page, context: BrowserContext) {
  const token = await new SignJWT({ login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("master").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
  const stores = [{ id: "a", code: "A", name: "Loja A" }, { id: "b", code: "B", name: "Loja B" }];
  const base = { name: "Camiseta", sector: "Geral", category: "CAMISETA", gender: "MASCULINO", size: "M", color: "", imageId: null, minimum: 3, updatedAt: version, catalogUpdatedAt: version };
  const variants = [{ ...base, id: "va", sku: "CAM-M", storeId: "a", store: stores[0], quantity: 20 }, { ...base, id: "vb", sku: "CAM-M", storeId: "b", store: stores[1], quantity: 7 }, { ...base, id: "vc", sku: "CAM-G", size: "G", storeId: "a", store: stores[0], quantity: 4 }];
  const requests = stores.map((store, i) => ({ id: `r-${store.id}`, code: `R-${store.id}`, storeId: store.id, store, employee: `Pessoa ${store.code}`, ldap: `0012345${i}`, status: "PENDENTE", createdAt: version, updatedAt: version, itemCount: 1, summary: "1x Camiseta", items: [{ variantId: i ? "vb" : "va", sku: "CAM-M", name: "Camiseta", size: "M", gender: "MASCULINO", color: "", quantity: 1 }] }));
  const options = { sectors: ["Geral", "Livre"], categories: ["CAMISETA", "Livre categoria"] };
  await page.route("**/api/catalog/options", route => route.fulfill({ json: options }));
  await page.route("**/api/dashboard**", route => {
    const storeId = new URL(route.request().url()).searchParams.get("storeId") ?? "";
    const rows = variants.filter(v => !storeId || v.storeId === storeId);
    const orders = requests.filter(r => !storeId || r.storeId === storeId);
    return route.fulfill({ json: { role: "MASTER_ADMIN", scope: storeId ? "store" : "all", account: { login: "master", name: "Master", role: "MASTER_ADMIN" }, availableStores: stores,
      store: { ...(stores.find(s => s.id === storeId) ?? { id: "", name: "Todas as lojas", code: "" }), city: "Recife", state: "PE" }, employees: [], variants: rows, requests: orders,
      metrics: { totalUnits: rows.reduce((sum, v) => sum + v.quantity, 0), variantCount: rows.length, lowStockCount: 0, pendingCount: orders.filter(r => r.status === "PENDENTE").length },
    } });
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Visão geral", exact: true })).toBeVisible();
  return { stores, variants, requests, options };
}
const selector = (page: Page) => page.locator(".store-choice:visible").getByRole("combobox");

test("abre em todas as lojas e mantém filtro entre indicadores, estoque, pedidos e CSV", async ({ page, context }, info) => {
  await setup(page, context);
  await expect(selector(page)).toHaveValue("");
  await expect(page.locator(".metric-card").filter({ hasText: "Peças em estoque" }).locator(".metric-value")).toHaveText("31");
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute("href", "/api/exports/inventory?storeId=");
  await selector(page).selectOption("b");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody tr")).toContainText("Loja B");
  await expect(page.getByRole("link", { name: "Exportar CSV" })).toHaveAttribute("href", "/api/exports/inventory?storeId=b");
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await expect(selector(page)).toHaveValue("b");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect(page.getByRole("article")).toContainText("Loja B");
  await expect(page.getByRole("link", { name: "Exportar histórico completo" })).toHaveAttribute("href", "/api/exports/requests?storeId=b");
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(page.locator(".metric-card").filter({ hasText: "Peças em estoque" }).locator(".metric-value")).toHaveText("7");
  await selector(page).selectOption("");
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  await expect(page.locator("tbody tr")).toHaveCount(3);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("all-stores-inventory.png"), fullPage: true });
});

test("exclusão global confirma, permite cancelar e explica vínculos antes de remover", async ({ page, context }) => {
  const { options } = await setup(page, context);
  let deletes = 0;
  await page.route("**/api/catalog/options", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: options });
    deletes++; const body = route.request().postDataJSON();
    if (body.name === "Geral") return route.fulfill({ status: 409, json: { message: "Reclassifique os uniformes vinculados antes de excluir esta opção." } });
    if (body.kind === "sector") options.sectors = options.sectors.filter(v => v !== body.name); else options.categories = options.categories.filter(v => v !== body.name);
    return route.fulfill({ json: { deleted: true } });
  });
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  await page.getByRole("button", { name: "Setores e categorias", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Opção para editar").selectOption("Livre");
  await dialog.getByRole("button", { name: "Excluir", exact: true }).click();
  await dialog.getByRole("button", { name: "Cancelar exclusão" }).click(); expect(deletes).toBe(0);
  await dialog.getByLabel("Opção para editar").selectOption("Geral");
  await dialog.getByRole("button", { name: "Excluir", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Reclassifique");
  await expect(dialog.getByLabel("Opção para editar")).toHaveValue("Geral");
  for (const [kind, name] of [["sector", "Livre"], ["category", "Livre categoria"]]) {
    await dialog.getByLabel("Tipo de opção").selectOption(kind);
    await dialog.getByLabel("Opção para editar").selectOption(name);
    await dialog.getByRole("button", { name: "Excluir", exact: true }).click();
    await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
    await expect(dialog.getByRole("status")).toContainText("Opção excluída");
  }
  expect(deletes).toBe(3);
});

test("edição da linha usa sua loja sem mudar o filtro geral", async ({ page, context }) => {
  const { variants } = await setup(page, context);
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/inventory", route => { payload = route.request().postDataJSON(); variants[1].quantity = Number(payload!.quantity); return route.fulfill({ json: {} }); });
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  await page.getByRole("row").filter({ hasText: "Loja B" }).getByRole("button", { name: "Editar", exact: true }).click();
  const dialog = page.getByRole("dialog"); await expect(dialog).toContainText("B · Loja B");
  await dialog.getByLabel("Quantidade disponível").fill("8");
  await dialog.getByRole("button", { name: "Salvar estoque" }).click();
  await expect(dialog).not.toBeVisible(); await expect(selector(page)).toHaveValue("");
  expect(payload).toMatchObject({ storeId: "b", variantId: "vb", quantity: 8, minimum: 3, updatedAt: version });
  await expect(page.locator("tbody tr")).toHaveCount(3);
});

test("movimentação e importação escolhem uma loja sem alterar o filtro global", async ({ page, context }) => {
  await setup(page, context);
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/inventory", route => { payload = route.request().postDataJSON(); return route.fulfill({ json: {} }); });
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  await page.getByRole("button", { name: "Movimentar estoque", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await dialog.getByLabel("Loja da operação").selectOption("b");
  await expect(dialog.getByRole("combobox", { name: "Uniforme", exact: true }).getByRole("option")).toHaveCount(2);
  await dialog.getByRole("combobox", { name: "Uniforme", exact: true }).selectOption("vb");
  await dialog.getByLabel("Tipo de movimentação").selectOption("SAIDA");
  await dialog.getByRole("button", { name: "Registrar movimentação" }).click();
  await expect(dialog).not.toBeVisible();
  expect(payload).toMatchObject({ storeId: "b", variantId: "vb", type: "SAIDA", quantity: 1 });
  await expect(selector(page)).toHaveValue("");
  await page.getByRole("button", { name: "Importar Excel", exact: true }).click();
  dialog = page.getByRole("dialog");
  await dialog.getByLabel("Loja da importação").selectOption("a");
  await expect(dialog).toContainText("Loja A");
  await expect(dialog.getByLabel("Planilha .xlsx (até 2 MB)")).toBeVisible();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(selector(page)).toHaveValue("");
});

test("lote confere saldos finais por loja e envia apenas selecionados", async ({ page, context }, info) => {
  await setup(page, context);
  let payload: { records: { storeId: string; variantId: string }[]; change: object } | undefined;
  await page.route("**/api/inventory/bulk", route => { payload = route.request().postDataJSON(); return route.fulfill({ json: { updatedCount: 2 } }); });
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  await page.getByLabel("Selecionar CAM-M na loja A", { exact: true }).check();
  await page.getByLabel("Selecionar CAM-M na loja B", { exact: true }).check();
  await page.getByRole("button", { name: "Editar selecionados" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Alteração do saldo").selectOption("SET");
  await dialog.getByLabel("Saldo final", { exact: true }).fill("9");
  await dialog.getByLabel("Novo estoque mínimo").fill("2");
  await dialog.getByRole("button", { name: "Conferir alterações" }).click();
  await expect(dialog.getByRole("status")).toContainText("Definir saldo final em 9");
  await expect(dialog.locator("tbody tr")).toHaveCount(2);
  await expect(dialog).toContainText("20 → 9"); await expect(dialog).toContainText("7 → 9");
  await expect(dialog).not.toContainText("CAM-G"); expect(payload).toBeUndefined();
  await page.screenshot({ path: info.outputPath("bulk-review.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Confirmar alterações" }).click();
  await expect(dialog).not.toBeVisible();
  expect(payload?.records.map(r => [r.storeId, r.variantId])).toEqual([["a", "va"], ["b", "vb"]]);
  expect(payload?.change).toEqual({ mode: "SET", quantity: 9, minimum: 2 });
});

test("lote distingue retirar, adicionar e mínimo; conflito exige recarregar sem reenviar", async ({ page, context }) => {
  await setup(page, context); let writes = 0;
  await page.route("**/api/inventory/bulk", route => { writes++; return route.fulfill({ status: 409, json: { message: "O estoque mudou. Nenhum registro foi alterado." } }); });
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  await page.getByLabel("Selecionar CAM-M na loja B", { exact: true }).check();
  await page.getByRole("button", { name: "Editar selecionados" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Alteração do saldo").selectOption("REMOVE");
  await dialog.getByLabel("Quantidade de peças").fill("8");
  await dialog.getByRole("button", { name: "Conferir alterações" }).click();
  await expect(dialog.getByRole("alert")).toContainText("entre zero"); expect(writes).toBe(0);
  await dialog.getByLabel("Alteração do saldo").selectOption("ADD");
  await dialog.getByLabel("Quantidade de peças").fill("2");
  await dialog.getByRole("button", { name: "Conferir alterações" }).click();
  await expect(dialog).toContainText("7 → 9");
  await dialog.getByRole("button", { name: "Voltar aos valores" }).click();
  await dialog.getByLabel("Alteração do saldo").selectOption("KEEP");
  await dialog.getByLabel("Novo estoque mínimo").fill("0");
  await dialog.getByRole("button", { name: "Conferir alterações" }).click();
  await expect(dialog).toContainText("7 → 7");
  await dialog.getByRole("button", { name: "Confirmar alterações" }).click();
  await expect(dialog.getByRole("alert")).toContainText("O estoque mudou");
  await expect(dialog.getByRole("button", { name: "Confirmar alterações" })).toBeDisabled(); expect(writes).toBe(1);
  await dialog.getByRole("button", { name: "Recarregar estoques" }).click(); await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Editar selecionados" })).toBeDisabled();
});

test("pedidos de lojas distintas são editados e processados na visão geral", async ({ page, context }) => {
  const { requests } = await setup(page, context);
  const processed: string[] = []; let edited: { items: { variantId: string }[] } | undefined;
  await page.route("**/api/requests/r-*", route => {
    const id = route.request().url().split("/").at(-1)!; const order = requests.find(r => r.id === id)!;
    if (route.request().method() === "GET") return route.fulfill({ json: { id, status: "PENDENTE", updatedAt: version, employee: { name: order.employee, ldap: order.ldap }, items: order.items } });
    if (route.request().method() === "PUT") edited = route.request().postDataJSON(); else { processed.push(id); order.status = "APROVADA"; }
    return route.fulfill({ json: {} });
  });
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await page.getByRole("button", { name: "Editar solicitação de Pessoa B" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Item 1").getByRole("option")).toHaveCount(2);
  await dialog.getByLabel("Quantidade 1").fill("2"); await dialog.getByRole("button", { name: "Salvar ajustes" }).click();
  await expect(dialog).not.toBeVisible(); expect(edited?.items[0].variantId).toBe("vb");
  await page.getByRole("button", { name: "Aprovar solicitação de Pessoa A" }).click();
  await expect(page.getByRole("button", { name: "Aprovar solicitação de Pessoa A" })).toHaveCount(0);
  await page.getByRole("button", { name: "Recusar solicitação de Pessoa B" }).click();
  await expect(page.getByRole("button", { name: "Recusar solicitação de Pessoa B" })).toHaveCount(0);
  expect(processed).toEqual(["r-a", "r-b"]); await expect(selector(page)).toHaveValue("");
});
