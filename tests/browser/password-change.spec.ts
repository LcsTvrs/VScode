import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

test("senha temporária abre painel e troca pelo mesmo POST do login, preservando tentativas", async ({ page, context }, testInfo) => {
  const deadline = Date.now() + 48 * 60 * 60 * 1000;
  const token = await new SignJWT({ login: "teste", role: "MASTER_ADMIN", storeId: null, mustChangePassword: true, passwordChangeDeadline: deadline, userUpdatedAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("teste").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3107", httpOnly: true, sameSite: "Strict" }]);
  let pending = true;
  const methods: string[] = [];
  await page.route("**/api/dashboard**", route => route.fulfill({ json: {
    code: "STORE_SELECTION_REQUIRED", account: { login: "teste", name: "Operador", role: "MASTER_ADMIN", mustChangePassword: pending, passwordChangeDeadline: pending ? new Date(deadline).toISOString() : null }, availableStores: [],
  } }));
  await page.route("**/api/auth/change-password", () => { throw new Error("O formulário não deve usar a URL anterior."); });
  await page.route("**/api/auth/login", route => {
    expect(route.request().method()).toBe("POST");
    methods.push(route.request().method());
    expect(route.request().postDataJSON().novaSenha).toBe("New-password-12345");
    if (methods.length === 1) return route.fulfill({ status: 502, contentType: "text/html", body: "<!DOCTYPE html><html>Gateway error</html>" });
    pending = false;
    return route.fulfill({ json: { ok: true, mustChangePassword: false } });
  });
  await page.goto("/");
  const notice = page.getByRole("region", { name: "Troca de senha pendente" });
  await expect(notice).toContainText("horário de Brasília");
  await page.getByRole("button", { name: "Alterar minha senha" }).click();
  const dialog = page.getByRole("dialog", { name: "Alterar senha temporária" });
  await dialog.getByLabel("Nova senha", { exact: true }).fill("New-password-12345");
  await dialog.getByLabel("Confirmar nova senha", { exact: true }).fill("Other-password-12345");
  await dialog.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("As senhas não coincidem.");
  expect(methods).toEqual([]);
  await dialog.getByLabel("Confirmar nova senha", { exact: true }).fill("New-password-12345");
  await dialog.getByRole("button", { name: "Mostrar nova senha", exact: true }).click();
  await expect(dialog.getByLabel("Nova senha", { exact: true })).toHaveAttribute("type", "text");
  await dialog.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Tente novamente com a mesma nova senha");
  await expect(dialog.getByLabel("Nova senha", { exact: true })).toHaveValue("New-password-12345");
  await page.screenshot({ path: testInfo.outputPath("password-change.png") });
  await dialog.getByRole("button", { name: "Salvar nova senha" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(notice).toHaveCount(0);
  await expect(page.getByRole("status")).toContainText("Senha alterada com sucesso");
  expect(methods).toEqual(["POST", "POST"]);
  await expect(page).toHaveURL(/\/$/);
});
