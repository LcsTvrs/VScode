import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

const stores = [
  { id: "one", name: "Interlagos", code: "001", city: "São Paulo", state: "SP", createdAt: "2026-10-23T12:00:00Z" },
  { id: "two", name: "Niterói", code: "002", city: "Niterói", state: "RJ", createdAt: "2026-10-23T12:00:00Z" },
];

test.beforeEach(async ({ page, context }) => {
  const token = await new SignJWT({ login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: new Date("2026-10-23T12:00:00Z").getTime() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("master").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
  await page.route("**/api/stores", route => route.fulfill({ json: { stores } }));
  await page.route("**/api/users", route => route.fulfill({ json: { users: [
    { id: "ana", name: "Ana Silva", login: "ana", role: "STORE_ADMIN", store: stores[0], mustChangePassword: false, createdAt: stores[0].createdAt },
    { id: "bruno", name: "Bruno Souza", login: "bruno", role: "MASTER_ADMIN", store: null, mustChangePassword: false, createdAt: stores[0].createdAt },
  ] } }));
  await page.route("**/api/dashboard**", route => route.fulfill({ json: {
    account: { name: "Master teste", login: "master", role: "MASTER_ADMIN" }, availableStores: stores, store: stores[0],
    variants: [], employees: [], requests: [], metrics: { totalUnits: 0, lowStockCount: 0, pendingCount: 0, variantCount: 0 },
  } }));
});

test("busca lojas por localização e restaura a lista", async ({ page }, testInfo) => {
  await page.goto("/admin/lojas");
  await expect(page.getByRole("cell", { name: "Interlagos", exact: true })).toBeVisible();
  await page.getByLabel("Buscar lojas").fill("rj");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.getByRole("cell", { name: "Niterói", exact: true })).toBeVisible();
  await page.getByLabel("Buscar lojas").fill("inexistente");
  await expect(page.getByText("Nenhuma loja encontrada para esta busca.")).toBeVisible();
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("lojas.png"), fullPage: true });
});

test("busca usuários por loja e perfil mantendo navegação ativa", async ({ page }, testInfo) => {
  await page.goto("/admin/usuarios");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await expect(page.getByRole("navigation", { name: "Administração", exact: true }).getByRole("link", { name: "Usuários", exact: true })).toHaveAttribute("aria-current", "page");
  await page.getByLabel("Buscar usuários").fill("interlagos");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await expect(page.locator("tbody")).toContainText("Ana Silva");
  await page.getByLabel("Buscar usuários").fill("administrador geral");
  await expect(page.locator("tbody")).toContainText("Bruno Souza");
  await expect(page.locator("tbody tr")).toHaveCount(1);
  await page.getByRole("button", { name: "Limpar busca" }).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("usuarios.png"), fullPage: true });
});

test("indicadores navegam e atualização mantém a seção ativa", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Ver peças em estoque", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Estoque de uniformes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Atualizar painel" }).click();
  await expect(page.getByRole("heading", { name: "Estoque de uniformes", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page.getByRole("button", { name: "Ver aguardando aprovação", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Solicitações", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(page.getByRole("button", { name: "Sair do painel" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("painel.png"), fullPage: true });
});
