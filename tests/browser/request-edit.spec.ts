import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { SignJWT } from "jose";

const originalVersion = "2026-10-20T10:00:00.000Z";
const newVersion = "2026-10-20T10:01:00.000Z";
const variants = [
  { id: "camisa", sku: "CAM-M", name: "Camiseta", category: "CAMISETA", size: "M", color: "Azul", quantity: 20, minimum: 5 },
  { id: "calca", sku: "CAL-42", name: "Calça", category: "CALCA", size: "42", color: "Preto", quantity: 10, minimum: 5 },
];
const details = { id: "pedido", code: "SOL-TEST", status: "PENDENTE", updatedAt: originalVersion, employee: { name: "Ana Silva", ldap: "00123456" }, items: [{ variantId: "camisa", quantity: 2 }] };

async function adminPanel(page: Page, context: BrowserContext) {
  const token = await new SignJWT({ login: "teste", role: "STORE_ADMIN", storeId: "loja", mustChangePassword: false, userUpdatedAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("teste").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3107", httpOnly: true, sameSite: "Strict" }]);
  const current = { updatedAt: originalVersion, summary: "2x Camiseta M", itemCount: 2, status: "PENDENTE" };
  await page.route("**/api/dashboard**", (route) => route.fulfill({ json: {
    role: "STORE_ADMIN", account: { login: "teste", name: "Operador", role: "STORE_ADMIN" }, availableStores: [],
    store: { id: "loja", name: "Loja de teste", code: "0012", city: "São Paulo", state: "SP" }, employees: [], variants,
    requests: [
      { id: "pedido", code: "SOL-TEST", employee: "Ana Silva", ldap: "00123456", createdAt: originalVersion, ...current },
      { id: "finalizado", code: "SOL-FINAL", employee: "Ana Silva", ldap: "00123456", createdAt: originalVersion, updatedAt: originalVersion, status: "APROVADA", summary: "1x Calça", itemCount: 1 },
    ],
    metrics: { totalUnits: 30, lowStockCount: 0, pendingCount: 1, variantCount: 2 },
  } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await expect(page.getByRole("button", { name: "Editar SOL-FINAL" })).toHaveCount(0);
  return current;
}

test("colaborador solicita até 3 por item ou o saldo menor disponível", async ({ page }) => {
  let submitted: { items: { variantId: string; quantity: number }[] } | undefined;
  await page.route("**/api/requests/public**", (route) => {
    if (route.request().method() === "POST") {
      submitted = route.request().postDataJSON();
      return route.fulfill({ json: { code: "SOL-PUBLICO" } });
    }
    return route.fulfill({ json: { storeName: "Loja de teste", variants: variants.map((variant, i) => ({ ...variant, available: i === 0 ? 20 : 2 })) } });
  });
  await page.goto("/solicitar?loja=0012");
  await page.getByLabel(/^LDAP/).fill("00123456");
  await page.getByLabel(/^Nome completo/).fill("Ana Silva");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByText(/até 3 unidades de cada item/)).toBeVisible();
  const shirt = page.getByRole("button", { name: "Adicionar uma unidade de Camiseta tamanho M" });
  for (let n = 0; n < 3; n++) await shirt.click();
  await expect(shirt).toBeDisabled();
  const pants = page.getByRole("button", { name: "Adicionar uma unidade de Calça tamanho 42" });
  await pants.click(); await pants.click();
  await expect(pants).toBeDisabled();
  await page.getByRole("button", { name: /Enviar solicitação/ }).click();
  await expect(page.getByText("Solicitação registrada", { exact: true })).toBeVisible();
  expect(submitted?.items).toEqual([{ variantId: "camisa", quantity: 3 }, { variantId: "calca", quantity: 2 }]);
});

test("admin troca itens, ajusta acima de 3 e aprova a versão salva", async ({ page, context }, testInfo) => {
  const current = await adminPanel(page, context);
  let saved: unknown;
  let approved: unknown;
  await page.route("**/api/requests/pedido", (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      saved = route.request().postDataJSON();
      Object.assign(current, { updatedAt: newVersion, summary: "5x Calça 42, 2x Camiseta M", itemCount: 7 });
      return route.fulfill({ json: { ...details, updatedAt: newVersion } });
    }
    if (method === "PATCH") {
      approved = route.request().postDataJSON();
      current.status = "APROVADA";
      return route.fulfill({ json: { status: "APROVADA" } });
    }
    return route.fulfill({ json: details });
  });
  await page.getByRole("button", { name: "Editar SOL-TEST" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Item 1", exact: true }).selectOption("calca");
  await dialog.getByLabel("Quantidade 1").fill("5");
  await dialog.getByRole("button", { name: "Adicionar item" }).click();
  await dialog.getByRole("combobox", { name: "Item 2", exact: true }).selectOption("camisa");
  await dialog.getByLabel("Quantidade 2").fill("2");
  await page.screenshot({ path: testInfo.outputPath("request-edit.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Salvar ajustes" }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByText("5x Calça 42, 2x Camiseta M", { exact: true })).toBeVisible();
  expect(saved).toEqual({ updatedAt: originalVersion, items: [{ variantId: "calca", quantity: 5 }, { variantId: "camisa", quantity: 2 }] });
  await page.getByRole("button", { name: "Aprovar SOL-TEST" }).click();
  await expect(page.getByRole("button", { name: "Editar SOL-TEST" })).toHaveCount(0);
  expect(approved).toEqual({ action: "APROVAR", updatedAt: newVersion });
});

test("conflito de edição exige recarregar e não sobrescreve outra versão", async ({ page, context }) => {
  await adminPanel(page, context);
  let reads = 0;
  let writes = 0;
  await page.route("**/api/requests/pedido", (route) => {
    if (route.request().method() === "PUT") {
      writes++;
      return route.fulfill({ status: 409, json: { message: "A solicitação mudou. Recarregue os dados.", code: "REQUEST_CHANGED" } });
    }
    reads++;
    return route.fulfill({ json: reads === 1 ? details : { ...details, updatedAt: newVersion, items: [{ variantId: "calca", quantity: 4 }] } });
  });
  await page.getByRole("button", { name: "Editar SOL-TEST" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quantidade 1").fill("3");
  await dialog.getByRole("button", { name: "Salvar ajustes" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Recarregue");
  await expect(dialog.getByRole("button", { name: "Salvar ajustes" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Recarregar solicitação" }).click();
  await expect(dialog.getByLabel("Quantidade 1")).toHaveValue("4");
  await expect(dialog.getByRole("combobox", { name: "Item 1", exact: true })).toHaveValue("calca");
  expect(writes).toBe(1);
});

test("cancelamento e remoção de linhas só mudam o formulário até salvar", async ({ page, context }) => {
  await adminPanel(page, context);
  let writes = 0;
  await page.route("**/api/requests/pedido", (route) => {
    if (route.request().method() !== "GET") writes++;
    return route.fulfill({ json: { ...details, items: [...details.items, { variantId: "calca", quantity: 1 }] } });
  });
  await page.getByRole("button", { name: "Editar SOL-TEST" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Remover item 1" }).click();
  await expect(dialog.getByRole("combobox", { name: "Item 1", exact: true })).toHaveValue("calca");
  await expect(dialog.getByRole("button", { name: "Remover item 1" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(0);
  await expect(page.getByText("2x Camiseta M", { exact: true })).toBeVisible();
});
