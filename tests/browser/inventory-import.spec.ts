import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";
import type { ImportPreview } from "../../src/lib/inventory-import-types";

const preview: ImportPreview = {
  token: "signed-preview-test", expiresAt: new Date(Date.now() + 900_000).toISOString(), totalQuantity: 15,
  rows: [
    { sku: "CAM-AZ-M", quantity: 10, sourceRows: [2], variantId: "camisa", name: "Camiseta operacional", category: "CAMISETA", gender: "MASCULINO", size: "M", color: "Azul", currentQuantity: 20, finalQuantity: 30, error: null },
    { sku: "CAL-PRE-42", quantity: 5, sourceRows: [3], variantId: "calca", name: "Calça operacional", category: "CALCA", gender: "FEMININO", size: "42", color: "Preto", currentQuantity: 8, finalQuantity: 13, error: null },
  ],
};

test.beforeEach(async ({ page, context }) => {
  const token = await new SignJWT({ login: "teste", role: "STORE_ADMIN", storeId: "loja", mustChangePassword: false, userUpdatedAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("teste").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
  await page.route("**/api/dashboard**", (route) => route.fulfill({ json: {
    role: "STORE_ADMIN", account: { login: "teste", name: "Operador de teste", role: "STORE_ADMIN" }, availableStores: [],
    store: { id: "loja", name: "Loja de teste", code: "0012", city: "São Paulo", state: "SP" }, employees: [], requests: [],
    variants: preview.rows.map((row) => ({ id: row.variantId, ...row, quantity: row.currentQuantity, minimum: 5 })),
    metrics: { totalUnits: 28, lowStockCount: 0, pendingCount: 0, variantCount: 2 },
  } }));
  await page.route("**/api/inventory/import/preview", (route) => route.fulfill({ json: preview }));
  await page.goto("/");
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  await page.getByRole("button", { name: "Importar Excel" }).click();
});

test("conferência individual libera a soma e envia somente uma confirmação", async ({ page }, testInfo) => {
  const requests: unknown[] = [];
  await page.route("**/api/inventory/import", async (route) => {
    requests.push(route.request().postDataJSON());
    await route.fulfill({ json: { itemCount: 2, totalQuantity: 15, alreadyApplied: false } });
  });
  const dialog = page.getByRole("dialog");
  const confirm = dialog.getByRole("button", { name: "Confirmar e somar ao estoque" });
  await expect(confirm).toBeDisabled();
  await dialog.getByLabel("Planilha .xlsx (até 2 MB)").setInputFiles("public/modelo-entrada-estoque.xlsx");
  await dialog.getByRole("button", { name: "Gerar prévia" }).click();
  await expect(dialog.getByText("0 de 2 itens conferidos")).toBeVisible();
  await expect(dialog.getByRole("cell", { name: "30", exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("inventory-import.png"), fullPage: true });
  await dialog.getByRole("checkbox").nth(0).check();
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("checkbox").nth(1).check();
  await expect(confirm).toBeEnabled();
  await dialog.getByRole("checkbox").nth(0).uncheck();
  await expect(confirm).toBeDisabled();
  await dialog.getByRole("checkbox").nth(0).check();
  expect(requests).toHaveLength(0);
  await confirm.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
  await expect(dialog.getByText(/Importação concluída: 15 peças/)).toBeVisible();
  expect(requests).toEqual([{ token: preview.token, reviewedVariantIds: ["calca", "camisa"] }]);
  await dialog.getByRole("button", { name: "Voltar ao estoque" }).click();
  await expect(dialog).not.toBeVisible();
});

test("cancelar não confirma; SKU inválido bloqueia todo o lote", async ({ page }) => {
  let confirmations = 0;
  await page.route("**/api/inventory/import", (route) => { confirmations++; return route.abort(); });
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(confirmations).toBe(0);
  await page.getByRole("button", { name: "Importar Excel" }).click();
  await page.route("**/api/inventory/import/preview", (route) => route.fulfill({ json: { ...preview, token: null, rows: [preview.rows[0], { ...preview.rows[1], variantId: null, error: "SKU não cadastrado nesta loja." }] } }));
  await dialog.getByLabel("Planilha .xlsx (até 2 MB)").setInputFiles("public/modelo-entrada-estoque.xlsx");
  await dialog.getByRole("button", { name: "Gerar prévia" }).click();
  await expect(dialog.getByText("SKU não cadastrado nesta loja.")).toBeVisible();
  await expect(dialog.getByRole("checkbox").nth(0)).toBeDisabled();
  await expect(dialog.getByRole("button", { name: "Confirmar e somar ao estoque" })).toBeDisabled();
  expect(confirmations).toBe(0);
});

test("saldo alterado exige nova prévia e nova conferência de todos os itens", async ({ page }) => {
  await page.route("**/api/inventory/import", (route) => route.fulfill({ status: 409, json: { message: "O estoque mudou desde a conferência." } }));
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Planilha .xlsx (até 2 MB)").setInputFiles("public/modelo-entrada-estoque.xlsx");
  await dialog.getByRole("button", { name: "Gerar prévia" }).click();
  await dialog.getByRole("checkbox").nth(0).check();
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog.getByRole("button", { name: "Confirmar e somar ao estoque" }).click();
  await expect(dialog.getByText("O estoque mudou desde a conferência.")).toBeVisible();
  await expect(dialog.getByRole("checkbox").nth(0)).not.toBeChecked();
  await expect(dialog.getByRole("checkbox").nth(0)).toBeDisabled();
  await page.route("**/api/inventory/import/preview", (route) => route.fulfill({ json: { ...preview, token: "refreshed", rows: [{ ...preview.rows[0], currentQuantity: 25, finalQuantity: 35 }, preview.rows[1]] } }));
  await dialog.getByRole("button", { name: "Atualizar prévia" }).click();
  await expect(dialog.getByRole("cell", { name: "35", exact: true })).toBeVisible();
  await expect(dialog.getByText("0 de 2 itens conferidos")).toBeVisible();
  await expect(dialog.getByRole("button", { name: "Confirmar e somar ao estoque" })).toBeDisabled();
});

test("erro de rede preserva a mesma confirmação para recuperar o recibo", async ({ page }) => {
  const tokens: string[] = [];
  await page.route("**/api/inventory/import", (route) => {
    tokens.push(route.request().postDataJSON().token);
    return tokens.length === 1 ? route.abort("failed") : route.fulfill({ json: { itemCount: 2, totalQuantity: 15, alreadyApplied: true } });
  });
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Planilha .xlsx (até 2 MB)").setInputFiles("public/modelo-entrada-estoque.xlsx");
  await dialog.getByRole("button", { name: "Gerar prévia" }).click();
  await dialog.getByRole("checkbox").nth(0).check();
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog.getByRole("button", { name: "Confirmar e somar ao estoque" }).click();
  await expect(dialog.getByRole("button", { name: "Atualizar prévia" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Verificar confirmação" }).click();
  await expect(dialog.getByText(/Importação já registrada: 15 peças/)).toBeVisible();
  expect(tokens).toEqual([preview.token, preview.token]);
});
