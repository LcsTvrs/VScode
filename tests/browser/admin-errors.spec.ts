import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

const store = { id: "store-test", name: "Loja teste", code: "0012", city: "São Paulo", state: "SP", createdAt: "2026-10-23T12:00:00Z" };

test.beforeEach(async ({ page, context }) => {
  const token = await new SignJWT({ login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: new Date("2026-10-23T12:00:00Z").getTime() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("master").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
  await page.route("**/api/stores", route => route.fulfill({ json: { stores: [store] } }));
});

test("criação de usuário preserva campos após HTML sem reenviar automaticamente", async ({ page }) => {
  let creates = 0;
  await page.route("**/api/users", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: { users: [] } });
    creates++;
    if (creates === 1) return route.fulfill({ status: 502, contentType: "text/html", body: "<html>Proxy indisponível</html>" });
    return route.fulfill({ json: { user: { id: "new-user", ...route.request().postDataJSON(), store, mustChangePassword: true, createdAt: store.createdAt }, temporaryPassword: "Temp-12345" } });
  });
  await page.goto("/admin/usuarios");
  await page.getByLabel("Login", { exact: true }).fill("novo");
  await page.getByLabel("Nome do usuário", { exact: true }).fill("Novo usuário");
  await page.getByRole("button", { name: "Criar usuário", exact: true }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("Não foi possível guardar o utilizador.");
  await expect(page.getByLabel("Login", { exact: true })).toHaveValue("novo");
  await expect(page.getByLabel("Nome do usuário", { exact: true })).toHaveValue("Novo usuário");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(creates).toBe(1);
  await page.getByRole("button", { name: "Criar usuário", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Senha temporária", exact: true })).toBeVisible();
  expect(creates).toBe(2);
});

test("edição de loja preserva alterações após 429 e só envia de novo por ação do usuário", async ({ page }) => {
  let updates = 0;
  await page.route("**/api/stores/store-test", route => {
    updates++;
    return updates === 1
      ? route.fulfill({ status: 429, contentType: "text/html", body: "<html>Firewall</html>" })
      : route.fulfill({ json: { store: { ...store, ...route.request().postDataJSON() } } });
  });
  await page.goto("/admin/lojas");
  await page.getByRole("button", { name: "Editar", exact: true }).click();
  await page.getByLabel("Nome", { exact: true }).fill("Loja atualizada");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Aguarde um minuto");
  await expect(page.getByLabel("Nome", { exact: true })).toHaveValue("Loja atualizada");
  expect(updates).toBe(1);
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("cell", { name: "Loja atualizada", exact: true })).toBeVisible();
  expect(updates).toBe(2);
});
