import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { SignJWT } from "jose";

const originalVersion = "2026-10-20T10:00:00.000Z";
const newVersion = "2026-10-20T10:01:00.000Z";
const variants = [
  { id: "camisa", sku: "CAM-M", name: "Camiseta", category: "CAMISETA", gender: "MASCULINO", size: "M", color: "Azul", quantity: 20, minimum: 5 },
  { id: "calca", sku: "CAL-42", name: "Calça", category: "CALCA", gender: "FEMININO", size: "42", color: "Preto", quantity: 10, minimum: 5 },
];
const details = { id: "pedido", code: "SOL-TEST", status: "PENDENTE", updatedAt: originalVersion, employee: { name: "Ana Silva", ldap: "00123456" }, items: [{ variantId: "camisa", quantity: 2 }] };

async function adminPanel(page: Page, context: BrowserContext, inventory: (Omit<typeof variants[number], "gender"> & { gender: string | null })[] = variants) {
  const token = await new SignJWT({ login: "teste", role: "STORE_ADMIN", storeId: "loja", mustChangePassword: false, userUpdatedAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("teste").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3107", httpOnly: true, sameSite: "Strict" }]);
  const current = { updatedAt: originalVersion, summary: "2x Camiseta M", itemCount: 2, status: "PENDENTE", items: [{ ...variants[0], variantId: "camisa", quantity: 2 }] };
  await page.route("**/api/dashboard**", (route) => route.fulfill({ json: {
    role: "STORE_ADMIN", account: { login: "teste", name: "Operador", role: "STORE_ADMIN" }, availableStores: [],
    store: { id: "loja", name: "Loja de teste", code: "0012", city: "São Paulo", state: "SP" }, employees: [], variants: inventory,
    requests: [
      { id: "pedido", code: "SOL-TEST", employee: "Ana Silva", ldap: "00123456", createdAt: originalVersion, ...current },
      { id: "finalizado", code: "SOL-FINAL", employee: "Bruno Lima", ldap: "00123457", createdAt: originalVersion, updatedAt: originalVersion, status: "APROVADA", summary: "1x Calça", itemCount: 1, items: [{ ...variants[1], variantId: "calca", quantity: 1 }] },
    ],
    metrics: { totalUnits: 30, lowStockCount: 0, pendingCount: 1, variantCount: 2 },
  } }));
  await page.goto("/");
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await expect(page.getByRole("button", { name: "Editar solicitação de Bruno Lima" })).toHaveCount(0);
  await expect(page.getByText(/SOL-TEST|SOL-FINAL/)).toHaveCount(0);
  return current;
}

test("colaborador solicita até 3 por item ou o saldo menor disponível", async ({ page }, testInfo) => {
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
  await expect(page.getByText("Masculino", { exact: true })).toBeVisible();
  await expect(page.getByText("Feminino", { exact: true })).toBeVisible();
  await expect(page.getByText("Tam. M · Camiseta", { exact: true })).toBeVisible();
  await expect(page.getByText("Tam. 42 · Calça", { exact: true })).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath("request-catalog.png"), fullPage: true });
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

test("estoque exige classificação no cadastro e permite classificar legado sem alterar saldo", async ({ page, context }, testInfo) => {
  const legacy = { ...variants[0], id: "legado", sku: "CAM-LEG", name: "Camiseta antiga", gender: null as string | null };
  const inventory = [...variants, legacy];
  await adminPanel(page, context, inventory);
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  const row = page.getByRole("row").filter({ hasText: "CAM-LEG" });
  await expect(row).toContainText("Não informado");
  let edited: unknown;
  await page.route("**/api/inventory", (route) => {
    edited = route.request().postDataJSON();
    legacy.gender = "FEMININO";
    return route.fulfill({ json: { quantity: 20, minimum: 5 } });
  });
  await row.getByRole("button", { name: "Editar", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Classificação do uniforme")).toHaveValue("");
  await dialog.getByLabel("Classificação do uniforme").selectOption("FEMININO");
  await dialog.getByRole("button", { name: "Salvar estoque" }).click();
  await expect(dialog).not.toBeVisible();
  expect(edited).toEqual({ variantId: "legado", gender: "FEMININO", quantity: 20, minimum: 5 });
  await expect(row).toContainText("Feminino");
  await page.getByRole("button", { name: "Novo item", exact: true }).click();
  await dialog.getByLabel("Nome do uniforme").fill("Colete novo");
  await dialog.getByLabel("SKU", { exact: true }).fill("COL-G");
  await dialog.getByLabel("Tamanho", { exact: true }).fill("G");
  await dialog.getByLabel("Cor", { exact: true }).fill("Verde");
  let created: Record<string, unknown> | undefined;
  await page.route("**/api/variants", (route) => {
    created = route.request().postDataJSON();
    return route.fulfill({ status: 201, json: { id: "novo", ...created } });
  });
  await dialog.getByRole("button", { name: "Salvar item" }).click();
  expect(created).toBeUndefined();
  expect(await dialog.getByLabel("Classificação do uniforme").evaluate((select: HTMLSelectElement) => select.validity.valueMissing)).toBe(true);
  await dialog.getByLabel("Classificação do uniforme").selectOption("MASCULINO");
  await page.screenshot({ path: testInfo.outputPath("uniform-classification.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Salvar item" }).click();
  await expect(dialog).not.toBeVisible();
  expect(created?.gender).toBe("MASCULINO");
});

test("admin troca itens, ajusta acima de 3 e aprova a versão salva", async ({ page, context }, testInfo) => {
  const current = await adminPanel(page, context);
  let saved: unknown;
  let approved: unknown;
  await page.route("**/api/requests/pedido", (route) => {
    const method = route.request().method();
    if (method === "PUT") {
      saved = route.request().postDataJSON();
      Object.assign(current, { updatedAt: newVersion, summary: "5x Calça 42, 2x Camiseta M", itemCount: 7, items: [{ ...variants[1], variantId: "calca", quantity: 5 }, { ...variants[0], variantId: "camisa", quantity: 2 }] });
      return route.fulfill({ json: { ...details, updatedAt: newVersion } });
    }
    if (method === "PATCH") {
      approved = route.request().postDataJSON();
      current.status = "APROVADA";
      return route.fulfill({ json: { status: "APROVADA" } });
    }
    return route.fulfill({ json: details });
  });
  await page.getByRole("button", { name: "Editar solicitação de Ana Silva" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("combobox", { name: "Item 1", exact: true }).selectOption("calca");
  await dialog.getByLabel("Quantidade 1").fill("5");
  await dialog.getByRole("button", { name: "Adicionar item" }).click();
  await dialog.getByRole("combobox", { name: "Item 2", exact: true }).selectOption("camisa");
  await dialog.getByLabel("Quantidade 2").fill("2");
  await page.screenshot({ path: testInfo.outputPath("request-edit.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Salvar ajustes" }).click();
  await expect(dialog).not.toBeVisible();
  const history = page.getByRole("article", { name: "Solicitação de Ana Silva" });
  await expect(history.getByRole("heading", { name: "Ana Silva" })).toBeVisible();
  await expect(history).toContainText("LDAP 00123456");
  await expect(history.getByRole("listitem").filter({ hasText: "Calça" })).toContainText("5 unidades");
  await expect(history.getByRole("listitem").filter({ hasText: "Calça" })).toContainText("Feminino");
  await expect(history.getByRole("listitem").filter({ hasText: "Camiseta" })).toContainText("2 unidades");
  await expect(history.getByText("Tam. 42 · Calça", { exact: true })).toBeVisible();
  await expect(history.getByText(/^Total:/)).toHaveCount(0);
  const rowLayout = await history.getByRole("listitem").first().evaluate((row) => {
    const name = row.querySelector("strong")!.getBoundingClientRect();
    const metadata = row.querySelector(".request-item-description > span")!.getBoundingClientRect();
    const quantity = row.querySelector(".request-item-quantity")!.getBoundingClientRect();
    const description = row.querySelector(".request-item-description")!.getBoundingClientRect();
    return { sameLine: Math.abs(name.top - metadata.top) < 3, quantityOnRight: quantity.left >= description.right, withinViewport: quantity.right <= document.documentElement.clientWidth };
  });
  expect(rowLayout).toEqual({ sameLine: true, quantityOnRight: true, withinViewport: true });
  await page.screenshot({ path: testInfo.outputPath("request-history.png"), fullPage: true });
  expect(saved).toEqual({ updatedAt: originalVersion, items: [{ variantId: "calca", quantity: 5 }, { variantId: "camisa", quantity: 2 }] });
  await page.getByRole("button", { name: "Aprovar solicitação de Ana Silva" }).click();
  await expect(page.getByRole("button", { name: "Editar solicitação de Ana Silva" })).toHaveCount(0);
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
  await page.getByRole("button", { name: "Editar solicitação de Ana Silva" }).click();
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
  await page.getByRole("button", { name: "Editar solicitação de Ana Silva" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Remover item 1" }).click();
  await expect(dialog.getByRole("combobox", { name: "Item 1", exact: true })).toHaveValue("calca");
  await expect(dialog.getByRole("button", { name: "Remover item 1" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(0);
  await expect(page.getByRole("article", { name: "Solicitação de Ana Silva" }).getByRole("listitem")).toContainText("2 unidades");
});
