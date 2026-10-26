import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { isUniformGender } from "../gender";

export class CatalogError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function catalogInput(input: Record<string, unknown>) {
  const text = (key: string, limit: number) => {
    const value = typeof input[key] === "string" ? input[key].normalize("NFC").trim() : "";
    if (!value || value.length > limit) throw new CatalogError(`Confira o campo ${key} (até ${limit} caracteres).`);
    return value;
  };
  if (!isUniformGender(input.gender)) throw new CatalogError("Selecione Masculino ou Feminino.");
  if (input.quantity !== undefined && input.quantity !== 0) throw new CatalogError("Cadastre o item sem saldo; ajuste o estoque em cada loja.");
  if (input.minimum !== undefined || input.color !== undefined) throw new CatalogError("Cor e estoque não fazem parte do cadastro global. Reabra o formulário.");
  const sku = text("sku", 40).toUpperCase();
  if (sku.length > 40) throw new CatalogError("Informe um SKU de até 40 caracteres.");
  return { sku, name: text("name", 100), sector: text("sector", 80), category: text("category", 80), size: text("size", 20), gender: input.gender };
}

export async function lockCatalog(tx: Prisma.TransactionClient) {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(240102026)`;
}

export async function deleteCatalog(input: Record<string, unknown>) {
  if (typeof input.sku !== "string" || !input.sku.trim() || input.sku.length > 40 || typeof input.updatedAt !== "string" || !Number.isFinite(Date.parse(input.updatedAt))) {
    throw new CatalogError("Reabra o cadastro para conferir o SKU e a versão atual.");
  }
  const sku = input.sku;
  return prisma.$transaction(async tx => {
    await lockCatalog(tx);
    const current = await tx.uniformCatalog.findUnique({ where: { sku } });
    if (!current) throw new CatalogError("Item não encontrado. Atualize o estoque.", 404);
    if (current.updatedAt.getTime() !== Date.parse(input.updatedAt as string)) throw new CatalogError("O cadastro mudou. Reabra para conferir.", 409);
    const variants = { variant: { sku } };
    if (await tx.stockLevel.count({ where: { ...variants, quantity: { not: 0 } } })) throw new CatalogError("Existe saldo deste uniforme em uma loja. Zere o saldo antes de excluir.", 409);
    if (await tx.requestItem.count({ where: variants }) || await tx.stockMovement.count({ where: variants })) throw new CatalogError("Este uniforme possui pedidos ou movimentações. O cadastro deve ser mantido para preservar o histórico.", 409);
    await tx.stockLevel.deleteMany({ where: variants });
    await tx.uniformVariant.deleteMany({ where: { sku } });
    await tx.uniformCatalog.delete({ where: { sku } });
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function validateOptions(tx: Prisma.TransactionClient, data: { sector: string; category: string }) {
  const sector = await tx.uniformSector.findUnique({ where: { name: data.sector } });
  const category = await tx.uniformCategoryOption.findUnique({ where: { name: data.category } });
  if (!sector || !category) throw new CatalogError("Selecione setor e categoria cadastrados. Atualize as opções.");
}

export async function populateStoreCatalog(tx: Prisma.TransactionClient, storeId: string) {
  const items = await tx.uniformCatalog.findMany();
  for (const item of items) {
    const variant = await tx.uniformVariant.create({ data: { sku: item.sku, name: item.name, sector: item.sector, category: item.category, gender: item.gender, size: item.size, imageId: item.imageId, storeId } });
    await tx.stockLevel.create({ data: { storeId, variantId: variant.id, quantity: 0, minimum: 5 } });
  }
}

export async function saveCatalog(input: Record<string, unknown>, editing: boolean) {
  const data = catalogInput(input);
  if (editing && (typeof input.updatedAt !== "string" || !Number.isFinite(Date.parse(input.updatedAt)))) throw new CatalogError("Reabra o cadastro para carregar a versão atual.");
  return prisma.$transaction(async tx => {
    await lockCatalog(tx);
    await validateOptions(tx, data);
    if (editing) {
      const current = await tx.uniformCatalog.findUnique({ where: { sku: data.sku } });
      if (!current) throw new CatalogError("Item não encontrado.", 404);
      if (current.updatedAt.getTime() !== Date.parse(input.updatedAt as string)) throw new CatalogError("O cadastro mudou. Reabra para conferir.", 409);
      const updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
      const item = await tx.uniformCatalog.update({ where: { sku: data.sku }, data: { ...data, updatedAt } });
      await tx.uniformVariant.updateMany({ where: { sku: data.sku }, data });
      return item;
    }
    const item = await tx.uniformCatalog.create({ data });
    const stores = await tx.store.findMany({ select: { id: true } });
    for (const store of stores) {
      const variant = await tx.uniformVariant.create({ data: { ...data, storeId: store.id } });
      await tx.stockLevel.create({ data: { storeId: store.id, variantId: variant.id, quantity: 0, minimum: 5 } });
    }
    return item;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
}
