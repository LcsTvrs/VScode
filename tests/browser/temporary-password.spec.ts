import { expect, test, type Page } from "@playwright/test";
import { SignJWT } from "jose";

const store = { id: "store-test", name: "Loja teste", code: "0012" };
const user = { id: "operator", login: "operador", name: "Operador teste", role: "STORE_ADMIN", storeId: store.id, store, mustChangePassword: false, createdAt: "2026-10-23T12:00:00Z" };
const master = { ...user, id: "master", login: "master", role: "MASTER_ADMIN", storeId: null, store: null, isCurrentUser: true };
const temporaryPassword = "Temp-12345";

test.beforeEach(async ({ page, context }) => {
  const token = await new SignJWT({ login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: new Date("2026-10-23T12:00:00Z").getTime() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("master").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
  await page.route("**/api/stores", route => route.fulfill({ json: { stores: [store] } }));
  await page.route("**/api/users", route => route.fulfill({ json: route.request().method() === "POST" ? { user, temporaryPassword } : { users: [master, user] } }));
});

async function openReset(page: Page, login: string, selfReset = false) {
  let resets = 0;
  await page.route(`**/api/users/${selfReset ? "master" : "operator"}/reset`, async route => {
    resets++;
    if (selfReset) {
      const token = await new SignJWT({ login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: true, userUpdatedAt: Date.now() })
        .setProtectedHeader({ alg: "HS256" }).setSubject("master").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
        .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
      await page.context().addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
    }
    return route.fulfill({ json: { temporaryPassword, selfReset } });
  });
  page.on("dialog", dialog => {
    expect(dialog.type()).toBe("confirm");
    void dialog.accept();
  });
  await page.goto("/admin/usuarios");
  await page.getByRole("row").filter({ has: page.getByRole("cell", { name: login, exact: true }) }).getByRole("button", { name: "Resetar senha" }).click();
  const dialog = page.getByRole("dialog", { name: "Senha temporária", exact: true });
  await expect(dialog.getByLabel("Senha temporária", { exact: true })).toHaveValue(temporaryPassword);
  return { dialog, resets: () => resets };
}

test("criação mostra senha selecionável e limpa a janela ao fechar", async ({ page }, testInfo) => {
  await page.goto("/admin/usuarios");
  await page.getByLabel("Login", { exact: true }).fill(user.login);
  await page.getByLabel("Nome do usuário", { exact: true }).fill(user.name);
  await page.getByRole("button", { name: "Criar usuário" }).click();
  const dialog = page.getByRole("dialog", { name: "Senha temporária", exact: true });
  const field = dialog.getByLabel("Senha temporária", { exact: true });
  await expect(field).toHaveValue(temporaryPassword);
  await expect(field).toHaveAttribute("readonly", "");
  await page.screenshot({ path: testInfo.outputPath("temporary-password.png"), animations: "disabled" });
  await field.focus();
  await field.press("ControlOrMeta+A");
  expect(await field.evaluate((element: HTMLInputElement) => element.selectionEnd! - element.selectionStart!)).toBe(temporaryPassword.length);
  await dialog.getByRole("button", { name: "Fechar", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(await page.locator("input").evaluateAll(elements => elements.some(element => element instanceof HTMLInputElement && element.value === "Temp-12345"))).toBe(false);
});

test("reset copia somente a senha sem repetir a operação", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async (value: string) => { (window as Window & { copiedPassword?: string }).copiedPassword = value; } } });
  });
  const { dialog, resets } = await openReset(page, user.login);
  await dialog.getByRole("button", { name: "Copiar senha" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Senha copiada.");
  expect(await page.evaluate(() => (window as Window & { copiedPassword?: string }).copiedPassword)).toBe(temporaryPassword);
  await dialog.press("Escape");
  await expect(dialog).toHaveCount(0);
  expect(resets()).toBe(1);
});

test("falha no clipboard permite cópia manual e reset próprio aguarda fechamento", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText: async () => { throw new Error("Clipboard indisponível"); } } });
  });
  await page.route("**/api/dashboard**", route => route.fulfill({ json: { code: "STORE_SELECTION_REQUIRED", account: { login: "master", role: "MASTER_ADMIN" }, availableStores: [] } }));
  const { dialog } = await openReset(page, master.login, true);
  await expect(page).toHaveURL(/\/admin\/usuarios$/);
  await dialog.getByRole("button", { name: "Copiar senha" }).click();
  await expect(dialog.getByRole("status")).toContainText("A senha está selecionada");
  const field = dialog.getByLabel("Senha temporária", { exact: true });
  await expect(field).toBeFocused();
  expect(await field.evaluate((element: HTMLInputElement) => element.selectionEnd! - element.selectionStart!)).toBe(temporaryPassword.length);
  await dialog.getByRole("button", { name: "Fechar senha temporária" }).click();
  await expect(page).toHaveURL(/\/admin\/trocar-senha$/);
});

test("ações e seletores usam cursor de mão; exclusão própria fica indisponível", async ({ page }) => {
  await page.goto("/admin/usuarios");
  const row = page.getByRole("row").filter({ has: page.getByRole("cell", { name: user.login, exact: true }) });
  for (const name of ["Editar", "Resetar senha", "Excluir"]) {
    await expect(row.getByRole("button", { name, exact: true })).toHaveCSS("cursor", "pointer");
  }
  await expect(page.getByRole("combobox", { name: /^Perfil/ })).toHaveCSS("cursor", "pointer");
  await expect(page.getByRole("link", { name: "Painel", exact: true })).toHaveCSS("cursor", "pointer");
  await expect(page.getByLabel("Login", { exact: true })).toHaveCSS("cursor", "text");
  const ownDelete = page.getByRole("row").filter({ has: page.getByRole("cell", { name: master.login, exact: true }) }).getByRole("button", { name: "Excluir" });
  await expect(ownDelete).toBeDisabled();
  await expect(ownDelete).toHaveCSS("cursor", "not-allowed");
});
