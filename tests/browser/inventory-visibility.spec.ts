import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

test("estoque mostra 101 registros, seleciona 48 filtrados e permite recuperar a lista completa", async ({ page, context }) => {
  const token = await new SignJWT({ login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("master").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
  const store = { id: "a", code: "0012", name: "Loja sintética", city: "São Paulo", state: "SP" };
  const variants = Array.from({ length: 101 }, (_, index) => ({
    id: `variant-${index}`, sku: `SKU-${index}`, name: `Uniforme ${index}`, sector: "Geral", category: index < 48 ? "Camisa" : index < 74 ? "Calça" : index < 100 ? "JAQUETA" : "OUTRO",
    gender: "MASCULINO", size: "M", color: "", imageId: null, quantity: index < 70 ? 10 : 0, minimum: 5,
    updatedAt: "2026-10-28T12:00:00.000Z", storeId: store.id, store,
  }));
  await page.route("**/api/dashboard**", route => route.fulfill({ json: {
    role: "MASTER_ADMIN", scope: "all", account: { login: "master", name: "Master", role: "MASTER_ADMIN" }, availableStores: [store],
    store: { ...store, id: "", name: "Todas as lojas" }, employees: [], requests: [], variants,
    metrics: { totalUnits: 700, lowStockCount: 31, pendingCount: 0, variantCount: 101 },
  } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  const rows = page.locator("tbody tr");
  const all = page.getByRole("checkbox", { name: "Selecionar todos os registros visíveis" });
  await expect(rows).toHaveCount(101);
  await expect(page.getByText("101 de 101 registros", { exact: true })).toBeVisible();
  await expect(rows.last()).toContainText("SKU-100");
  await expect(rows.last().locator(".quantity-low")).toHaveText("0");
  await all.check();
  await expect(page.getByText("101 registros selecionados · limite de 200 por lote", { exact: true })).toBeVisible();
  await expect(page.locator("tbody input:checked")).toHaveCount(101);
  await page.getByRole("button", { name: "Limpar seleção", exact: true }).click();
  await page.getByRole("combobox", { name: "Filtrar por categoria" }).selectOption("Camisa");
  await expect(rows).toHaveCount(48);
  await expect(page.getByText("48 de 101 registros", { exact: true })).toBeVisible();
  await expect(page.locator(".inventory-filter-note")).toContainText("Filtros ativos");
  await all.check();
  await expect(page.getByText("48 registros selecionados · limite de 200 por lote", { exact: true })).toBeVisible();
  await page.getByPlaceholder("Buscar por setor, nome, SKU, tamanho…").fill("inexistente");
  await expect(rows).toHaveCount(0);
  await expect(page.getByText("0 de 101 registros", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtros", exact: true }).click();
  await expect(rows).toHaveCount(101);
  await expect(page.getByRole("combobox", { name: "Filtrar por categoria" })).toHaveValue("TODAS");
  await expect(page.getByPlaceholder("Buscar por setor, nome, SKU, tamanho…")).toHaveValue("");
  await all.check();
  await expect(page.locator("tbody input:checked")).toHaveCount(101);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
