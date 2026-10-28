import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ImageInputError, imageSelectionVersion } from "./image";
import { lockCatalog } from "./catalog";

export const matchSelect = { id: true, imageId: true, store: { select: { name: true, code: true } } } as const;

type Assignment = { id: string; version: string; replicate: FormDataEntryValue | null; data: Uint8Array<ArrayBuffer> | null };

export function assignUniformImage({ id, version, data }: Assignment) {
  return prisma.$transaction(async tx => {
      await lockCatalog(tx);
      const source = await tx.uniformVariant.findUnique({ where: { id }, select: { id: true, sku: true, imageId: true } });
      if (!source) throw new ImageInputError("Uniforme não encontrado.", 404);
      const catalog = await tx.uniformCatalog.findUnique({ where: { sku: source.sku }, select: { deletedAt: true } });
      if (!catalog || catalog.deletedAt) throw new ImageInputError("Uniforme excluído do catálogo.", 404);
      const matches = await tx.uniformVariant.findMany({ where: { sku: source.sku }, select: matchSelect, orderBy: { id: "asc" } });
      if (imageSelectionVersion(matches) !== version) throw new ImageInputError("As imagens ou lojas mudaram. Reabra a janela para conferir novamente.", 409);
      const targets = matches;
      const imageId = data ? (await tx.uniformImage.create({ data: { data }, select: { id: true } })).id : source.imageId;
      if (!imageId) throw new ImageInputError("Selecione uma imagem antes de replicar.");
      const updated = await tx.uniformVariant.updateMany({ where: { id: { in: targets.map(v => v.id) } }, data: { imageId } });
      await tx.uniformCatalog.update({ where: { sku: source.sku }, data: { imageId } });
      const previousIds = targets.flatMap(v => v.imageId && v.imageId !== imageId ? [v.imageId] : []);
      if (previousIds.length) await tx.uniformImage.deleteMany({ where: { id: { in: previousIds }, variants: { none: {} }, catalog: { none: {} } } });
      return { imageId, updatedCount: updated.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export function parseImageIds(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 200 || value.some(id => typeof id !== "string" || !id.trim() || id.length > 100) || new Set(value).size !== value.length) {
    throw new ImageInputError("Selecione de 1 a 200 registros do estoque.");
  }
  return value;
}

export async function bulkImageTargets(db: Pick<Prisma.TransactionClient, "uniformVariant">, ids: string[]) {
  const sources = await db.uniformVariant.findMany({ where: { id: { in: ids }, catalog: { deletedAt: null }, stockLevels: { some: {} } }, select: { sku: true } });
  if (sources.length !== ids.length) throw new ImageInputError("A seleção mudou. Atualize o estoque e selecione novamente.", 409);
  return db.uniformVariant.findMany({
    where: { sku: { in: [...new Set(sources.map(source => source.sku))] }, catalog: { deletedAt: null } },
    select: { ...matchSelect, sku: true, name: true, size: true }, orderBy: { id: "asc" },
  });
}

export function assignBulkUniformImage(ids: string[], version: string, data: Uint8Array<ArrayBuffer>) {
  return prisma.$transaction(async tx => {
    await lockCatalog(tx);
    const targets = await bulkImageTargets(tx, ids);
    if (imageSelectionVersion(targets) !== version) throw new ImageInputError("As imagens ou lojas mudaram. Reabra a janela para conferir novamente.", 409);
    const image = await tx.uniformImage.create({ data: { data }, select: { id: true } });
    const updated = await tx.uniformVariant.updateMany({ where: { id: { in: targets.map(target => target.id) } }, data: { imageId: image.id } });
    await tx.uniformCatalog.updateMany({ where: { sku: { in: [...new Set(targets.map(target => target.sku))] } }, data: { imageId: image.id } });
    const previousIds = targets.flatMap(target => target.imageId ? [target.imageId] : []);
    if (previousIds.length) await tx.uniformImage.deleteMany({ where: { id: { in: previousIds }, variants: { none: {} }, catalog: { none: {} } } });
    return { imageId: image.id, updatedCount: updated.count };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
