import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { ImageInputError, imageSelectionVersion } from "./image";

export const matchSelect = { id: true, imageId: true, store: { select: { name: true, code: true } } } as const;

type Assignment = { id: string; version: string; replicate: FormDataEntryValue | null; data: Uint8Array<ArrayBuffer> | null };

export function assignUniformImage({ id, version, replicate, data }: Assignment) {
  return prisma.$transaction(async tx => {
      const source = await tx.uniformVariant.findUnique({ where: { id }, select: { id: true, sku: true, imageId: true } });
      if (!source) throw new ImageInputError("Uniforme não encontrado.", 404);
      const matches = await tx.uniformVariant.findMany({ where: { sku: source.sku }, select: matchSelect, orderBy: { id: "asc" } });
      if (imageSelectionVersion(matches) !== version) throw new ImageInputError("As imagens ou lojas mudaram. Reabra a janela para conferir novamente.", 409);
      const targets = replicate === "true" ? matches : matches.filter(v => v.id === id);
      const imageId = data ? (await tx.uniformImage.create({ data: { data }, select: { id: true } })).id : source.imageId;
      if (!imageId) throw new ImageInputError("Selecione uma imagem antes de replicar.");
      const updated = await tx.uniformVariant.updateMany({ where: { id: { in: targets.map(v => v.id) } }, data: { imageId } });
      const previousIds = targets.flatMap(v => v.imageId && v.imageId !== imageId ? [v.imageId] : []);
      if (previousIds.length) await tx.uniformImage.deleteMany({ where: { id: { in: previousIds }, variants: { none: {} } } });
      return { imageId, updatedCount: updated.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
