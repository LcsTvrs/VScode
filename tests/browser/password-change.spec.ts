import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

for (const role of ["MASTER_ADMIN", "STORE_ADMIN"] as const) {
  test(`${role}: login temporário exige troca e preserva tentativas pelo mesmo POST do login`, async ({ page, context }, testInfo) => {
    const setSession = async (pending: boolean) => {
      // Include a future legacy deadline to prove it cannot grant panel access.
      const token = await new SignJWT({ login: "teste", role, storeId: role === "STORE_ADMIN" ? "loja" : null, mustChangePassword: pending, passwordChangeDeadline: Date.now() + 48 * 60 * 60 * 1000, userUpdatedAt: Date.now() })
        .setProtectedHeader({ alg: "HS256" }).setSubject("teste").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
        .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
      // Next normalizes loopback redirect URLs to localhost. Keep the simulated
      // session on both local names so redirects exercise authorization.
      await context.addCookies(["127.0.0.1", "localhost"].map(host => ({ name: "uniformes-admin-session", value: token, url: `http://${host}:3107`, httpOnly: true, sameSite: "Strict" as const })));
    };
    let dashboardReads = 0;
    const changes: string[] = [];
    await page.route("**/api/dashboard**", route => {
      dashboardReads++;
      const account = { login: "teste", name: "Operador", role };
      return route.fulfill({ json: role === "MASTER_ADMIN" ? { code: "STORE_SELECTION_REQUIRED", account, availableStores: [] } : {
        role, account, availableStores: [], store: { id: "loja", name: "Loja teste", code: "0012", city: "São Paulo", state: "SP" },
        employees: [], variants: [], requests: [], metrics: { totalUnits: 0, lowStockCount: 0, pendingCount: 0, variantCount: 0 },
      } });
    });
    await page.route("**/api/auth/change-password", () => { throw new Error("O formulário não deve usar a URL anterior."); });
    await page.route("**/api/auth/login", async route => {
      expect(route.request().method()).toBe("POST");
      const body = route.request().postDataJSON();
      if (!body.acao) {
        expect(body).toEqual({ login: "teste", senha: "Temporary-12345" });
        await setSession(true);
        return route.fulfill({ json: { ok: true, mustChangePassword: true } });
      }
      expect(body.acao).toBe("trocar-senha");
      expect(body.novaSenha).toBe("New-password-12345");
      changes.push(route.request().method());
      if (changes.length === 1) return route.fulfill({ status: 502, contentType: "text/html", body: "<!DOCTYPE html><html>Gateway error</html>" });
      await setSession(false);
      return route.fulfill({ json: { ok: true, mustChangePassword: false } });
    });
    await page.goto("/admin/login?next=/admin/usuarios");
    await page.getByLabel("Login", { exact: true }).fill("teste");
    await page.getByLabel("Senha", { exact: true }).fill("Temporary-12345");
    await page.getByRole("button", { name: "Entrar no painel" }).click();
    await expect(page).toHaveURL(/\/admin\/trocar-senha$/);
    await expect(page.getByRole("heading", { name: "Crie sua nova senha" })).toBeVisible();
    await expect(page.getByRole("navigation", { name: "Administração" })).toHaveCount(0);
    for (const path of ["/", "/admin/usuarios", "/admin/lojas"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/admin\/trocar-senha$/);
    }
    expect(dashboardReads).toBe(0);
    await page.getByLabel("Nova senha", { exact: true }).fill("New-password-12345");
    await page.getByLabel("Confirmar nova senha", { exact: true }).fill("Other-password-12345");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.locator("form").getByRole("alert")).toHaveText("As senhas não coincidem.");
    expect(changes).toEqual([]);
    await page.getByLabel("Confirmar nova senha", { exact: true }).fill("New-password-12345");
    await page.getByRole("button", { name: "Mostrar nova senha", exact: true }).click();
    await expect(page.getByLabel("Nova senha", { exact: true })).toHaveAttribute("type", "text");
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page.locator("form").getByRole("alert")).toContainText("Tente novamente com a mesma nova senha");
    await expect(page.getByLabel("Nova senha", { exact: true })).toHaveValue("New-password-12345");
    await page.screenshot({ path: testInfo.outputPath("password-change.png"), animations: "disabled" });
    await page.getByRole("button", { name: "Salvar nova senha" }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole("heading", { name: role === "MASTER_ADMIN" ? "Todas as lojas" : "Visão geral", exact: true })).toBeVisible();
    expect(changes).toEqual(["POST", "POST"]);
    expect(dashboardReads).toBe(1);
  });
}
