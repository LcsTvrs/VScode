import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { SignJWT } from "jose";
import sharp from "sharp";

const stores = [
  { id: "a", code: "0012", name: "Leroy Merlin Morumbi Shopping Unidade São Paulo" },
  { id: "b", code: "0013", name: "Leroy Merlin Interlagos" },
];
const variant = { id: "camisa", sku: "CAM-M", name: "Camiseta", category: "CAMISETA", gender: "MASCULINO", size: "M", color: "Verde", quantity: 10, minimum: 2, imageId: null as string | null };
async function imageBuffer() { return sharp({ create: { width: 120, height: 120, channels: 3, background: "green" } }).png().toBuffer(); }
async function panel(page: Page, context: BrowserContext, master: boolean) {
  const role = master ? "MASTER_ADMIN" : "STORE_ADMIN";
  const token = await new SignJWT({ login: "teste", role, storeId: master ? null : "a", mustChangePassword: false, userUpdatedAt: Date.now() })
    .setProtectedHeader({ alg: "HS256" }).setSubject("teste").setIssuer("uniformes-inventory").setAudience("uniformes-admin").setIssuedAt().setExpirationTime("1h")
    .sign(new TextEncoder().encode("local-browser-test-secret-at-least-32-bytes"));
  await context.addCookies([{ name: "uniformes-admin-session", value: token, url: "http://127.0.0.1:3107", httpOnly: true, sameSite: "Strict" }]);
  const current = { ...variant };
  await page.route("**/api/dashboard**", route => {
    const id = new URL(route.request().url()).searchParams.get("storeId") ?? "a";
    return route.fulfill({ json: { role, account: { login: "teste", name: "Operador", role }, availableStores: master ? stores : [],
      store: { ...(stores.find(s => s.id === id) ?? stores[0]), city: "São Paulo", state: "SP" }, employees: [], variants: [current], requests: [],
      metrics: { totalUnits: 10, lowStockCount: 0, pendingCount: 0, variantCount: 1 },
    } });
  });
  await page.route("**/api/uniform-images/**", async route => route.fulfill({ contentType: "image/png", body: await imageBuffer() }));
  await page.goto("/?storeId=a");
  await page.getByRole("button", { name: "Estoque", exact: true }).click();
  return current;
}

test("master vê nome completo e uma seta clicável; confere e replica imagem", async ({ page, context }, info) => {
  const current = await panel(page, context, true);
  const selector = page.locator(".store-choice:visible");
  await expect(selector).toHaveCount(1);
  await expect(selector.locator("svg")).toHaveCount(1);
  await expect(selector.locator("span")).toHaveText(stores[0].name);
  const layout = await selector.evaluate(element => {
    const text = element.querySelector("span")!;
    const arrow = element.querySelector("svg")!.getBoundingClientRect();
    return { noClipping: text.scrollWidth <= text.clientWidth && text.scrollHeight <= text.clientHeight,
      arrowClicksSelect: document.elementFromPoint(arrow.x + arrow.width / 2, arrow.y + arrow.height / 2)?.tagName === "SELECT" };
  });
  expect(layout).toEqual({ noClipping: true, arrowClicksSelect: true });
  await selector.getByRole("combobox").selectOption("b");
  await expect(page).toHaveURL(/storeId=b/);
  await selector.getByRole("combobox").selectOption("a");
  let writes = 0; let payload = "";
  await page.route("**/api/variants/camisa/image", route => {
    if (route.request().method() === "POST") {
      writes++; payload = route.request().postDataBuffer()?.toString() ?? ""; current.imageId = "saved";
      return route.fulfill({ json: { imageId: "saved", updatedCount: 2 } });
    }
    return route.fulfill({ json: { imageId: null, version: "a".repeat(64), matches: stores.map((store, i) => ({ id: i ? "other" : "camisa", imageId: i ? "old" : null, store })) } });
  });
  await page.getByRole("button", { name: "Imagem de Camiseta SKU CAM-M" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("button", { name: "Salvar imagem" })).toBeDisabled();
  await dialog.getByLabel("Escolher imagem").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: await imageBuffer() });
  await expect(dialog.getByRole("img", { name: "Prévia da imagem de Camiseta" })).toBeVisible();
  await dialog.getByRole("checkbox").check();
  await expect(dialog).toContainText(stores[1].name);
  await expect(dialog).toContainText("já possui imagem");
  await page.screenshot({ path: info.outputPath("image-assignment.png"), fullPage: true });
  expect(writes).toBe(0);
  await dialog.getByRole("button", { name: "Cancelar", exact: true }).click();
  expect(writes).toBe(0);
  await page.getByRole("button", { name: "Imagem de Camiseta SKU CAM-M" }).click();
  await dialog.getByLabel("Escolher imagem").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: await imageBuffer() });
  await dialog.getByRole("checkbox").check();
  await dialog.getByRole("button", { name: "Salvar imagem" }).click();
  await expect(dialog).not.toBeVisible();
  expect(writes).toBe(1); expect(payload).toMatch(/name="replicate"\r\n\r\ntrue/);
  await expect(page.getByRole("img", { name: "Foto de Camiseta" })).toBeVisible();
  await page.screenshot({ path: info.outputPath("store-selector.png"), fullPage: true });
});

test("gestor de loja não recebe ação de atribuir imagem", async ({ page, context }) => {
  await panel(page, context, false);
  await expect(page.getByRole("button", { name: /Imagem de/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Editar", exact: true })).toBeVisible();
});

test("catálogo mostra foto e preserva pedido; foto indisponível usa ícone", async ({ page }, info) => {
  await page.route("**/api/requests/public**", route => route.fulfill({ json: { storeName: stores[0].name, variants: [
    { ...variant, available: 10, imageId: "photo" },
    { ...variant, id: "other", name: "Colete", available: 10, imageId: "missing" },
  ] } }));
  await page.route("**/api/uniform-images/**", async route => route.request().url().endsWith("missing") ? route.fulfill({ status: 404 }) : route.fulfill({ contentType: "image/png", body: await imageBuffer() }));
  await page.goto("/solicitar?loja=0012");
  await page.getByLabel(/^LDAP/).fill("00123456"); await page.getByLabel(/^Nome completo/).fill("Ana Silva");
  await page.getByRole("button", { name: "Continuar", exact: true }).click();
  const photo = page.getByRole("img", { name: "Foto de Camiseta" });
  await expect(photo).toBeVisible();
  await expect.poll(() => photo.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await expect(page.locator(".public-variant").filter({ hasText: "Colete" }).getByLabel("Uniforme sem foto")).toBeVisible();
  await page.getByRole("button", { name: "Adicionar uma unidade de Camiseta tamanho M" }).click();
  await expect(page.getByRole("button", { name: /Enviar solicitação.*1 peça/ })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await page.screenshot({ path: info.outputPath("catalog-photos.png"), fullPage: true });
});
