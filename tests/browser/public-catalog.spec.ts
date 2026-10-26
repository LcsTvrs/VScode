import { expect, test } from "@playwright/test";
import { chooseUniform } from "./fixtures/catalog";

const base = { category: "CAMISETA", color: "Verde", imageId: null };
const variants = [
  { ...base, id: "shirt-m", name: "Camiseta", sector: "Logística", gender: "MASCULINO", size: "M" },
  { ...base, id: "shirt-g", name: "Camiseta", sector: "Logística", gender: "MASCULINO", size: "G" },
  { ...base, id: "shirt-f", name: "Camiseta", sector: "Logística", gender: "FEMININO", size: "P" },
  { ...base, id: "shirt-caixa", name: "Camiseta", sector: "Caixas", gender: "FEMININO", size: "M" },
];
async function identify(page: import("@playwright/test").Page) {
  await page.goto("/solicitar?loja=0012");
  await page.getByLabel(/^LDAP/).fill("00123456");
  await page.getByLabel(/^Nome completo/).fill("Ana Silva");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
}

test("uniforme de Todos aparece em cada setor, inclusive sem saldo próprio, e mantém o mesmo item no pedido", async ({ page }) => {
  const common = { ...base, id: "pants-38", name: "Calça", sector: " Todos ", gender: "FEMININO", size: "38" };
  let submitted: unknown;
  await page.route("**/api/requests/public**", route => {
    if (route.request().method() === "POST") { submitted = route.request().postDataJSON(); return route.fulfill({ status: 201, json: { code: "SOL-COMUM" } }); }
    return route.fulfill({ json: { sectors: ["Logística", "Caixas", "B2B", "TODOS"], variants: [...variants, common] } });
  });
  await identify(page);
  await expect(page.getByLabel("1. Setor").locator("option")).toHaveText(["Selecione o setor", "B2B", "Caixas", "Logística"]);
  await chooseUniform(page, "Logística", "Calça", "Verde", "FEMININO", "pants-38");
  await page.getByRole("button", { name: "Adicionar ao pedido", exact: true }).click();
  await chooseUniform(page, "B2B", "Calça", "Verde", "FEMININO", "pants-38");
  await expect(page.getByLabel("2. Uniforme").locator("option")).toHaveText(["Selecione o uniforme", "Calça · Verde"]);
  await page.getByRole("button", { name: "Adicionar ao pedido", exact: true }).click();
  await chooseUniform(page, "Caixas", "Calça", "Verde", "FEMININO", "pants-38");
  await expect(page.getByLabel("4. Tamanho")).toHaveValue("pants-38");
  await page.getByRole("button", { name: /Enviar solicitação/ }).click();
  expect(submitted).toMatchObject({ items: [{ variantId: "pants-38", quantity: 2 }] });
});

test("catálogo somente com uniformes comuns permite solicitar sem escolher setor", async ({ page }) => {
  await page.route("**/api/requests/public**", route => route.fulfill({ json: { sectors: [], variants: [{ ...base, id: "common", name: "Calça", sector: "TODOS", gender: "MASCULINO", size: "M" }] } }));
  await identify(page);
  await expect(page.getByLabel("1. Setor")).toHaveCount(0);
  await page.getByLabel("2. Uniforme").selectOption({ label: "Calça · Verde" });
  await page.getByLabel("3. Classificação").selectOption("MASCULINO");
  await page.getByLabel("4. Tamanho").selectOption("common");
  await page.getByRole("button", { name: "Adicionar ao pedido", exact: true }).click();
  await expect(page.getByRole("region", { name: "Itens do seu pedido" })).toContainText("Calça");
});

test("99 modelos ficam em seletores e mudanças limpam apenas as escolhas dependentes", async ({ page }, info) => {
  const catalog = [...variants, ...Array.from({ length: 98 }, (_, i) => ({ ...base, id: "other-" + i, name: "Uniforme " + (i + 1), sector: "Logística", gender: "MASCULINO", size: "M" }))];
  await page.route("**/api/requests/public**", route => route.fulfill({ json: { storeName: "Loja de teste", variants: catalog } }));
  await identify(page);
  await expect(page.locator(".public-variant")).toHaveCount(0);
  await chooseUniform(page, "Logística", "Camiseta", "Verde", "MASCULINO", "shirt-m");
  await expect(page.getByLabel("2. Uniforme").locator("option")).toHaveCount(100);
  await expect(page.getByLabel("4. Tamanho").locator("option")).toHaveCount(3);
  await page.getByRole("button", { name: "Adicionar ao pedido", exact: true }).click();
  await page.getByLabel("3. Classificação").selectOption("FEMININO");
  await expect(page.getByLabel("4. Tamanho")).toHaveValue("");
  await expect(page.getByLabel("4. Tamanho").locator("option")).toHaveText(["Selecione o tamanho", "P"]);
  await page.getByLabel("1. Setor").selectOption("Caixas");
  await expect(page.getByLabel("2. Uniforme")).toHaveValue("");
  await expect(page.getByLabel("3. Classificação")).toBeDisabled();
  await expect(page.getByLabel("4. Tamanho")).toBeDisabled();
  await expect(page.getByRole("region", { name: "Itens do seu pedido" })).toContainText("Tam. M · Camiseta");
  await expect(page.getByText(/\d+ disponíve/)).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("catalog-by-sector.png"), fullPage: true });
});

test("conflito recarrega disponibilidade, preserva pedido e exige remover item indisponível", async ({ page }) => {
  let writes = 0;
  await page.route("**/api/requests/public**", route => {
    if (route.request().method() === "POST") { writes++; return route.fulfill({ status: 409, json: { message: "Saldo insuficiente. Atualize a lista e tente novamente." } }); }
    return route.fulfill({ json: { variants: writes ? [variants[3]] : variants } });
  });
  await identify(page);
  await chooseUniform(page, "Logística", "Camiseta", "Verde", "MASCULINO", "shirt-m");
  await page.getByRole("button", { name: "Adicionar ao pedido", exact: true }).click();
  await page.getByRole("button", { name: /Enviar solicitação/ }).click();
  await expect(page.getByRole("status")).toContainText("Indisponível");
  await expect(page.getByRole("button", { name: /Enviar solicitação/ })).toBeDisabled();
  expect(writes).toBe(1);
  await page.getByRole("button", { name: "Remover uma unidade de Camiseta tamanho M" }).click();
  await expect(page.getByRole("region", { name: "Itens do seu pedido" })).toHaveCount(0);
  await chooseUniform(page, "Caixas", "Camiseta", "Verde", "FEMININO", "shirt-caixa");
  await page.getByRole("button", { name: "Adicionar ao pedido", exact: true }).click();
  await expect(page.getByRole("button", { name: /Enviar solicitação/ })).toBeEnabled();
  expect(writes).toBe(1);
});
