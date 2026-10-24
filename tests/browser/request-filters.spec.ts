import { expect, test } from "@playwright/test";
import { SignJWT } from "jose";

test.use({ timezoneId: "UTC" });

function request(id: string, employee: string, createdAt: string, status = "PENDENTE") {
  return {
    id, code: id, employee, ldap: "00123456", createdAt, updatedAt: createdAt, status,
    itemCount: 2, summary: "2x Camiseta M",
    items: [{ variantId: "camisa", sku: "CAM-M", name: "Camiseta", gender: "MASCULINO", size: "M", color: "Azul", quantity: 2 }],
  };
}

test.beforeEach(async ({ page, context }) => {
  const token = await new SignJWT({ login: "teste", role: "STORE_ADMIN", storeId: "loja", mustChangePassword: false, userUpdatedAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("teste").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
  await page.route("**/api/dashboard**", (route) => route.fulfill({ json: {
    role: "STORE_ADMIN", account: { login: "teste", name: "Operador", role: "STORE_ADMIN" }, availableStores: [],
    store: { id: "loja", name: "Loja de teste", code: "0012", city: "São Paulo", state: "SP" }, employees: [], variants: [],
    requests: [
      ...Array.from({ length: 6 }, (_, i) => request(`finalizado-${i}`, `Finalizado ${i}`, "2026-10-22T10:00:00.000Z", i % 2 ? "RECUSADA" : "APROVADA")),
      request("ana", "Ana Silva", "2026-10-21T03:00:00.000Z"),
      request("bruna", "Bruna Lima", "2026-10-21T02:59:59.999Z"),
      request("carlos", "Carlos Souza", "2026-10-20T03:00:00.000Z", "APROVADA"),
      request("diego", "Diego Alves", "2026-10-19T10:00:00.000Z"),
    ],
    metrics: { totalUnits: 0, lowStockCount: 0, pendingCount: 3, variantCount: 0 },
  } }));
  await page.goto("/");
});

test("filtra pela data de Brasília, informa dia vazio e permite limpar", async ({ page }, testInfo) => {
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await expect(page.getByRole("article")).toHaveCount(10);
  const date = page.getByLabel("Data da solicitação");
  await date.fill("2026-10-20");
  await expect(page.getByRole("article")).toHaveCount(2);
  await expect(page.getByText("2 de 10 REGISTROS", { exact: true })).toBeVisible();
  await expect(page.getByRole("article", { name: "Solicitação de Bruna Lima" })).toContainText("23:59");
  await expect(page.getByRole("article", { name: "Solicitação de Carlos Souza" })).toBeVisible();
  await expect(page.getByRole("article", { name: "Solicitação de Ana Silva" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Exportar histórico completo" })).toHaveAttribute("href", "/api/exports/requests?storeId=loja");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("request-date-filter.png"), fullPage: true });
  await date.fill("2026-10-18");
  await expect(page.getByRole("article")).toHaveCount(0);
  await expect(page.getByText("Nenhuma solicitação neste dia", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Limpar filtro" }).click();
  await expect(date).toHaveValue("");
  await expect(page.getByRole("article")).toHaveCount(10);
});

test("visão geral mantém pendências antigas e ignora o filtro do histórico", async ({ page }, testInfo) => {
  const panel = page.locator(".request-panel");
  await expect(panel.getByRole("heading", { name: "Solicitações pendentes" })).toBeVisible();
  await expect(panel.locator(".recent-row")).toHaveCount(3);
  await expect(panel).toContainText("Diego Alves");
  await expect(panel).not.toContainText("Finalizado");
  await expect(panel).not.toContainText("Carlos Souza");
  await page.getByRole("button", { name: "Solicitações", exact: true }).click();
  await page.getByLabel("Data da solicitação").fill("2026-10-18");
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await expect(panel.locator(".recent-row")).toHaveCount(3);
  await expect(panel).toContainText("Diego Alves");
  await page.screenshot({ path: testInfo.outputPath("pending-overview.png"), fullPage: true });
  await panel.getByRole("button", { name: "Ver todas" }).click();
  await expect(page.getByLabel("Data da solicitação")).toHaveValue("");
  await expect(page.getByRole("article")).toHaveCount(10);
});
