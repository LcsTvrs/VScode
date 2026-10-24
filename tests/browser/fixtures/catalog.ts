import type { Page } from "@playwright/test";
export async function chooseUniform(page: Page, sector: string, name: string, color: string, gender: string, id: string) {
  await page.getByLabel("1. Setor").selectOption(sector);
  await page.getByLabel("2. Uniforme").selectOption({ label: name + " · " + color });
  await page.getByLabel("3. Classificação").selectOption(gender);
  await page.getByLabel("4. Tamanho").selectOption(id);
}
