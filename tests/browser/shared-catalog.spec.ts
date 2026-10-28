import { expect, test, type Page, type BrowserContext } from "@playwright/test";
import { SignJWT } from "jose";

const version = "2026-10-24T12:00:00.000Z";

test("exclusão de cadastro confirma alcance global, permite cancelar e apresenta bloqueio", async ({ page, context }) => {
  await panel(page, context);
  let writes = 0;
  await page.route("**/api/variants", route => {
    expect(route.request().method()).toBe("DELETE");
    expect(route.request().postDataJSON()).toEqual({ sku: "CAM-M", updatedAt: version });
    writes++;
    return route.fulfill({ status: 409, json: { message: "Existe saldo deste uniforme em uma loja." } });
  });
  await page.getByRole("button", { name: "Excluir cadastro", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("todas as lojas");
  await dialog.getByRole("button", { name: "Cancelar exclusão" }).click();
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Excluir cadastro", exact: true }).click();
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Existe saldo");
  expect(writes).toBe(1);
  await page.route("**/api/variants", route => route.fulfill({ status: 204 }));
  await dialog.getByRole("button", { name: "Confirmar exclusão" }).click();
  await expect(dialog).not.toBeVisible();
});
async function panel(page: Page, context: BrowserContext) {
  const token = await new SignJWT({ login: "master", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("master").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3137", httpOnly: true, sameSite: "Strict" }]);
  const options = { sectors: ["Geral", "Logística", "Atendimento"], categories: ["CAMISETA", "CALCA", "JAQUETA", "COLETE", "OUTRO"] };
  const variant = { id: "v", sku: "CAM-M", name: "Camiseta", sector: "Logística", category: "CAMISETA", gender: "MASCULINO", size: "M", color: "", quantity: 17, minimum: 3, updatedAt: version, catalogUpdatedAt: version, imageId: null };
  await page.route("**/api/catalog/options", route => route.fulfill({ json: options }));
  await page.route("**/api/dashboard**", route => route.fulfill({ json: {
    role: "MASTER_ADMIN", account: { login: "master", name: "Master", role: "MASTER_ADMIN" }, availableStores: [{ id: "a", code: "0012", name: "Loja A" }],
    store: { id: "a", code: "0012", name: "Loja A", city: "Recife", state: "PE" }, employees: [], variants: [variant], requests: [],
    metrics: { totalUnits: 17, lowStockCount: 0, pendingCount: 0, variantCount: 1 },
  } }));
  await page.goto("/?storeId=a");
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  return { options, variant };
}

test("master cadastra com seletores, classificação obrigatória e sem cor ou saldo", async ({ page, context }, info) => {
  await panel(page, context);
  let created: Record<string, unknown> | undefined;
  await page.route("**/api/variants", route => { created = route.request().postDataJSON(); return route.fulfill({ status: 201, json: created }); });
  await page.getByRole("button", { name: "Novo item", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("combobox", { name: "Setor", exact: true })).toBeVisible();
  await expect(dialog.getByLabel("Cor", { exact: true })).toHaveCount(0);
  await expect(dialog.getByLabel("Saldo inicial")).toHaveCount(0);
  await expect(dialog.getByLabel("Estoque mínimo")).toHaveCount(0);
  await dialog.getByLabel("Setor", { exact: true }).selectOption("Atendimento");
  await dialog.getByLabel("Categoria", { exact: true }).selectOption("COLETE");
  await dialog.getByLabel("Nome do uniforme").fill("Colete de atendimento");
  await dialog.getByLabel("SKU", { exact: true }).fill("COL-G");
  await dialog.getByLabel("Tamanho", { exact: true }).fill("G");
  await dialog.getByRole("button", { name: "Salvar item" }).click();
  expect(created).toBeUndefined();
  await dialog.getByLabel("Classificação do uniforme").selectOption("FEMININO");
  await page.screenshot({ path: info.outputPath("shared-catalog-create.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Salvar item" }).click();
  await expect(dialog).not.toBeVisible();
  expect(created).toMatchObject({ sku: "COL-G", sector: "Atendimento", category: "COLETE", gender: "FEMININO" });
  for (const field of ["color", "quantity", "minimum"]) expect(created).not.toHaveProperty(field);
});

test("master acrescenta categoria e renomeia setor com efeitos globais", async ({ page, context }, info) => {
  const { options, variant } = await panel(page, context);
  const changes: Record<string, unknown>[] = [];
  await page.route("**/api/catalog/options", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: options });
    const body = route.request().postDataJSON(); changes.push(body);
    if (body.kind === "category") options.categories.push(body.name);
    else { options.sectors = options.sectors.map(value => value === body.previous ? body.name : value); variant.sector = body.name; }
    return route.fulfill({ json: { name: body.name } });
  });
  await page.getByRole("button", { name: "Setores e categorias", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Tipo de opção").selectOption("category");
  await dialog.getByLabel("Nome da opção").fill("Bermuda");
  await dialog.getByRole("button", { name: "Adicionar opção" }).click();
  await expect(dialog.getByRole("status")).toContainText("Opção salva");
  await dialog.getByLabel("Tipo de opção").selectOption("sector");
  await dialog.getByLabel("Opção para editar").selectOption("Logística");
  await dialog.getByLabel("Nome da opção").fill("Operações");
  await dialog.getByRole("button", { name: "Salvar nome" }).click();
  await expect(dialog.getByLabel("Nome da opção")).toHaveValue("");
  await page.screenshot({ path: info.outputPath("shared-catalog-options.png"), fullPage: true });
  await dialog.getByRole("button", { name: "Concluir" }).click();
  await expect(page.getByRole("cell", { name: "Operações", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Novo item", exact: true }).click();
  await expect(dialog.getByLabel("Categoria", { exact: true }).getByRole("option", { name: "Bermuda", exact: true })).toHaveCount(1);
  await dialog.getByLabel("Categoria", { exact: true }).selectOption("Bermuda");
  expect(changes).toEqual([{ kind: "category", previous: "", name: "Bermuda" }, { kind: "sector", previous: "Logística", name: "Operações" }]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("edição global usa versão do catálogo e mantém estoque fora do formulário", async ({ page, context }) => {
  await panel(page, context);
  let payload: Record<string, unknown> | undefined;
  await page.route("**/api/variants", route => {
    expect(route.request().method()).toBe("PUT"); payload = route.request().postDataJSON();
    return route.fulfill({ json: payload });
  });
  await page.getByRole("button", { name: "Cadastro global", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Setor", { exact: true })).toHaveValue("Logística");
  await expect(dialog.getByLabel("Categoria", { exact: true })).toHaveValue("CAMISETA");
  await expect(dialog.getByLabel("SKU", { exact: true })).toHaveAttribute("readonly", "");
  await dialog.getByLabel("Nome do uniforme").fill("Camiseta atualizada");
  await dialog.getByRole("button", { name: "Salvar item" }).click();
  await expect(dialog).not.toBeVisible();
  expect(payload).toMatchObject({ updatedAt: version, sku: "CAM-M", name: "Camiseta atualizada" });
  expect(payload).not.toHaveProperty("quantity");
});

test("falha ao salvar opção preserva nome e exige nova ação do usuário", async ({ page, context }) => {
  const { options } = await panel(page, context);
  let writes = 0;
  await page.route("**/api/catalog/options", route => {
    if (route.request().method() === "GET") return route.fulfill({ json: options });
    writes++;
    return route.fulfill({ status: 409, json: { message: "Já existe uma opção com esse nome." } });
  });
  await page.getByRole("button", { name: "Setores e categorias", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome da opção").fill("Geral");
  await dialog.getByRole("button", { name: "Adicionar opção" }).click();
  await expect(dialog.getByRole("alert")).toContainText("Já existe");
  await expect(dialog.getByLabel("Nome da opção")).toHaveValue("Geral");
  expect(writes).toBe(1);
});
