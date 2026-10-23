import { expect, test } from "@playwright/test";

test("olhinho alterna a senha sem apagar o conteúdo nem enviar o formulário", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/auth/login", route => { attempts++; return route.fulfill({ status: 401, json: { message: "Credenciais inválidas." } }); });
  await page.goto("/admin/login");
  const password = page.getByLabel("Senha", { exact: true });
  await page.getByLabel("Login", { exact: true }).fill("operador");
  await password.fill("senha-de-teste");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Mostrar senha", exact: true }).click();
  await expect(password).toHaveAttribute("type", "text");
  await expect(password).toHaveValue("senha-de-teste");
  await page.getByRole("button", { name: "Ocultar senha", exact: true }).press("Enter");
  await expect(password).toHaveAttribute("type", "password");
  expect(attempts).toBe(0);
});

test("login explica bloqueio do firewall e indisponibilidade sem perder o formulário", async ({ page }) => {
  let status = 429;
  await page.route("**/api/auth/login", route => route.fulfill({ status, contentType: "text/html", body: "<html>Gateway response</html>" }));
  await page.goto("/admin/login");
  await page.getByLabel("Login", { exact: true }).fill("operador");
  await page.getByLabel("Senha", { exact: true }).fill("senha-de-teste");
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Aguarde um minuto");
  await expect(page.getByLabel("Login", { exact: true })).toHaveValue("operador");
  status = 502;
  await page.getByRole("button", { name: "Entrar no painel" }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Não foi possível iniciar a sessão");
});

test("pedido preserva seleção após 429 e não reenvia automaticamente em falha de rede", async ({ page }) => {
  let attempts = 0;
  await page.route("**/api/requests/public**", route => {
    if (route.request().method() === "POST") {
      attempts++;
      if (attempts === 1) return route.fulfill({ status: 429, contentType: "text/plain", body: "Too many requests" });
      return route.abort("failed");
    }
    return route.fulfill({ json: { storeName: "Loja de teste", variants: [{ id: "camisa", name: "Camiseta", category: "CAMISETA", gender: null, imageId: null, size: "M", color: "Azul", available: 10 }] } });
  });
  await page.goto("/solicitar?loja=0012");
  await page.getByLabel(/^LDAP/).fill("00123456");
  await page.getByLabel(/^Nome completo/).fill("Ana Silva");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  await page.getByRole("button", { name: "Adicionar uma unidade de Camiseta tamanho M" }).click();
  const submit = page.getByRole("button", { name: "Enviar solicitação · 1 peça", exact: true });
  await submit.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Aguarde um minuto");
  await expect(submit).toBeEnabled();
  await expect(page.getByText("Ana Silva", { exact: true })).toBeVisible();
  expect(attempts).toBe(1);
  await submit.click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Consulte a equipe da loja antes de repetir");
  await expect(submit).toBeEnabled();
  expect(attempts).toBe(2);
});

test("catálogo indisponível apresenta orientação e impede avançar sem dados", async ({ page }) => {
  await page.route("**/api/requests/public**", route => route.fulfill({ status: 503, contentType: "text/html", body: "<html>Unavailable</html>" }));
  await page.goto("/solicitar");
  await expect(page.getByRole("main").getByRole("alert")).toContainText("Atualize a página");
  await expect(page.getByRole("button", { name: "Continuar", exact: true })).toBeDisabled();
});
