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
