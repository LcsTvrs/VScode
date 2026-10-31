import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

const version = "2026-10-30T12:00:00.000Z";
const store = { id: "a", code: "0012", name: "Loja sintética", city: "São Paulo", state: "SP" };
const variant = { id: "v", storeId: "a", store, sku: "CAM-M", name: "Camiseta", category: "CAMISETA", sector: "Geral", gender: "MASCULINO", size: "M", color: "", imageId: null, quantity: 5, minimum: 5, updatedAt: version };
const orders = Array.from({ length: 61 }, (_, i) => ({ id: `r-${i}`, code: `R-${i}`, storeId: "a", store, employee: `Pessoa ${i}`, ldap: `001234${String(i).padStart(2, "0")}`, status: "PENDENTE", createdAt: version, updatedAt: version, itemCount: 1, summary: "1x Camiseta", items: [{ variantId: "v", name: "Camiseta", sku: "CAM-M", size: "M", gender: "MASCULINO", color: "", quantity: 1 }] }));
const payload = { role: "STORE_ADMIN", scope: "store", historyMode: "paged", employeesDeferred: true, account: { login: "gestor", name: "Gestor sintético", role: "STORE_ADMIN" }, availableStores: [], store, employees: [], variants: [variant], requests: orders.slice(0, 4), metrics: { totalUnits: 5, lowStockCount: 1, pendingCount: 61, variantCount: 1 } };

async function setup(page: Page, context: BrowserContext) {
  const token = await new SignJWT({ login: "gestor", role: "STORE_ADMIN", storeId: "a", mustChangePassword: false, userUpdatedAt: Date.now() }).setProtectedHeader({ alg: "HS256" }).setSubject("gestor").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h").sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
  await page.route("**/api/dashboard**", route => route.fulfill({ json: payload }));
}

test("falha do painel informa estado real, sem carga inicial, e permite recuperar", async ({ page, context }) => {
  await setup(page, context);
  let calls = 0;
  await page.route("**/api/dashboard**", route => ++calls === 1 ? route.fulfill({ status: 503, json: { message: "Serviço indisponível." } }) : route.fulfill({ json: payload }));
  await page.goto("/");
  await expect(page.locator("main").getByRole("alert")).toContainText("Tente novamente");
  await expect(page.locator("footer")).toContainText("atualização falhou");
  await expect(page.locator("body")).not.toContainText("execute a carga inicial");
  await expect(page.locator("footer")).not.toContainText("sincronizados");
  await page.getByRole("button", { name: "Tentar novamente" }).click();
  await expect(page.locator("footer")).toContainText("Dados do filtro carregados");
  await expect(page.getByText("No mínimo ou abaixo", { exact: true })).toBeVisible();
});

test("histórico carrega sob demanda, pagina sem omitir totais e envia filtros ao servidor", async ({ page, context }, info) => {
  await setup(page, context);
  const queries: URLSearchParams[] = [];
  await page.route("**/api/requests?**", route => {
    const params = new URL(route.request().url()).searchParams; queries.push(params);
    const pageNumber = Number(params.get("page"));
    const rows = params.get("search") ? orders.filter(row => row.ldap.includes(params.get("search")!)) : orders;
    return route.fulfill({ json: { requests: rows.slice((pageNumber - 1) * 25, pageNumber * 25), total: 61, filteredTotal: rows.length, page: pageNumber, pages: Math.max(1, Math.ceil(rows.length / 25)), pageSize: 25 } });
  });
  await page.goto("/");
  await expect(page.locator(".recent-row")).toHaveCount(4);
  expect(queries).toHaveLength(0);
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(25);
  await expect(page.getByText("61 de 61 REGISTROS", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByRole("article").first()).toContainText("Pessoa 25");
  await page.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(11);
  await expect(page.getByRole("button", { name: "Próxima", exact: true })).toBeDisabled();
  await page.getByLabel("Nome ou LDAP").fill("00123460");
  await page.getByRole("combobox", { name: "Situação", exact: true }).selectOption("PENDENTE");
  await page.getByLabel("Data da solicitação").fill("2026-10-29");
  await page.getByLabel("Até a data").fill("2026-10-30");
  await expect(page.getByRole("article")).toHaveCount(1);
  await expect.poll(() => queries.at(-1)?.get("end")).toBe("2026-10-30");
  expect(Object.fromEntries(queries.at(-1)!)).toEqual({ storeId: "a", page: "1", search: "00123460", status: "PENDENTE", start: "2026-10-29", end: "2026-10-30" });
  await expect(page.getByRole("link", { name: "Exportar histórico completo" })).toHaveAttribute("href", "/api/exports/requests?storeId=a");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("history-filtered.png"), fullPage: true });
  await page.getByRole("button", { name: "Limpar filtro", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(25);
});

test("histórico distingue erro de lista vazia e recupera sem perder filtros", async ({ page, context }) => {
  await setup(page, context);
  let fail = true;
  await page.route("**/api/requests?**", route => fail ? route.fulfill({ status: 503, json: { message: "Não foi possível consultar. Tente novamente." } }) : route.fulfill({ json: { requests: [], total: 61, filteredTotal: 0, page: 1, pages: 1, pageSize: 25 } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await page.getByLabel("Nome ou LDAP").fill("Sem resultado");
  await expect(page.locator("main").getByRole("alert")).toContainText("Tente novamente");
  await expect(page.getByText("Nenhuma solicitação encontrada", { exact: true })).toHaveCount(0);
  fail = false;
  await page.getByRole("button", { name: "Tentar novamente", exact: true }).click();
  await expect(page.getByText("Nenhuma solicitação encontrada", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Nome ou LDAP")).toHaveValue("Sem resultado");
});

test("operação contém foco, protege preenchimento e bloqueia fechamento e envio duplicado ao salvar", async ({ page, context }, info) => {
  await setup(page, context);
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>(resolve => { release = resolve; });
  await page.route("**/api/inventory", async route => { calls++; await gate; await route.fulfill({ status: 409, json: { message: "Saldo alterado. Confira o estoque antes de tentar novamente." } }); });
  await page.goto("/");
  const opener = page.getByRole("button", { name: "Registrar entrada de estoque" });
  await opener.click();
  const dialog = page.getByRole("dialog", { name: "Movimentar estoque", exact: true });
  await expect(dialog.getByRole("combobox", { name: "Uniforme", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0); await expect(opener).toBeFocused();
  await opener.click();
  await dialog.getByRole("combobox", { name: "Uniforme", exact: true }).selectOption("v");
  await dialog.getByLabel("Observação", { exact: true }).fill("Entrada sintética");
  await page.keyboard.press("Escape");
  await expect(dialog.getByText("Fechar e descartar o preenchimento desta janela?", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Continuar preenchendo" }).click();
  await dialog.getByRole("button", { name: "Registrar movimentação", exact: true }).focus();
  await page.keyboard.press("Tab");
  expect(await page.evaluate(() => !!document.activeElement?.closest("dialog"))).toBe(true);
  await dialog.getByRole("button", { name: "Registrar movimentação", exact: true }).click();
  await expect(dialog.getByRole("button", { name: "Salvando…", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Cancelar", exact: true })).toBeDisabled();
  expect(calls).toBe(1);
  release();
  await expect(dialog.getByRole("alert")).toContainText("Saldo alterado");
  await expect(dialog.getByLabel("Observação", { exact: true })).toHaveValue("Entrada sintética");
  await page.screenshot({ path: info.outputPath("operation-error.png"), fullPage: true });
});

test("colaboradores são consultados somente ao abrir solicitação, na loja correta", async ({ page, context }) => {
  await setup(page, context);
  let calls = 0;
  await page.route("**/api/employees?**", route => { calls++; expect(new URL(route.request().url()).searchParams.get("storeId")).toBe("a"); return route.fulfill({ json: { employees: [{ id: "e", name: "Pessoa sintética", ldap: "00123456", email: null, storeId: "a" }] } }); });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Visão geral", exact: true })).toBeVisible();
  expect(calls).toBe(0);
  await page.getByRole("button", { name: "Criar solicitação para colaborador" }).click();
  await expect(page.getByRole("option", { name: "Pessoa sintética · LDAP 00123456" })).toHaveCount(1);
  expect(calls).toBe(1);
});

test("seleção entre filtros não trunca silenciosamente quando excede 200 registros", async ({ page, context }) => {
  await setup(page, context);
  await page.route("**/api/dashboard**", route => route.fulfill({ json: { ...payload, role: "MASTER_ADMIN", account: { ...payload.account, role: "MASTER_ADMIN" }, availableStores: [store], variants: Array.from({ length: 250 }, (_, i) => ({ ...variant, id: `v-${i}`, sku: `SKU-${i}`, category: i < 100 ? "CAMISETA" : "CALCA" })) } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  const category = page.getByRole("combobox", { name: "Filtrar por categoria" });
  const all = page.getByRole("checkbox", { name: "Selecionar todos os registros visíveis" });
  await expect(all).toBeDisabled();
  await category.selectOption("CAMISETA"); await all.check();
  await expect(page.getByText("100 registros selecionados · limite de 200 por lote", { exact: true })).toBeVisible();
  await category.selectOption("CALCA"); await all.click();
  await expect(page.locator("main").getByRole("alert")).toContainText("Nenhuma seleção foi alterada");
  await expect(page.getByText("100 registros selecionados · limite de 200 por lote", { exact: true })).toBeVisible();
  await expect(page.locator("tbody input:checked")).toHaveCount(0);
  await page.getByRole("button", { name: "Limpar seleção", exact: true }).click(); await all.check();
  await expect(page.locator("tbody input:checked")).toHaveCount(150);
});

test("resposta inválida após movimento bloqueia reenvio e orienta conferir o resultado", async ({ page, context }) => {
  await setup(page, context);
  let calls = 0;
  await page.route("**/api/inventory", route => { calls++; return route.fulfill({ status: 200, contentType: "text/html", body: "<html>Resposta intermediária</html>" }); });
  await page.goto("/");
  await page.getByRole("button", { name: "Registrar entrada de estoque" }).click();
  const dialog = page.getByRole("dialog", { name: "Movimentar estoque", exact: true });
  await dialog.getByRole("combobox", { name: "Uniforme", exact: true }).selectOption("v");
  await dialog.getByRole("button", { name: "Registrar movimentação", exact: true }).click();
  await expect(dialog.getByRole("alert")).toContainText("confira o estoque ou o histórico");
  await expect(dialog.getByRole("button", { name: "Registrar movimentação", exact: true })).toBeDisabled();
  expect(calls).toBe(1);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
});
