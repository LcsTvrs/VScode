import { prisma } from "./prisma";
import type { AdminSession } from "./admin-session";
import { signImportPreview, verifyImportPreview, type ImportSnapshot } from "./inventory-import-token";
import { IMPORT_MAX_QUANTITY, InventoryImportError, type ImportLine, type ImportPreview, type ImportPreviewRow } from "./inventory-import-types";

export async function previewInventoryImport(session: AdminSession, storeId: string, lines: ImportLine[]): Promise<ImportPreview> {
  const variants = await prisma.uniformVariant.findMany({
    where: { storeId, sku: { in: lines.map((line) => line.sku) } },
    include: { stockLevels: { where: { storeId } } },
  });
  const bySku = new Map(variants.map((variant) => [variant.sku, variant]));
  const snapshots: ImportSnapshot[] = [];
  const rows: ImportPreviewRow[] = lines.map((line) => {
    const variant = bySku.get(line.sku);
    const stock = variant?.stockLevels[0];
    const finalQuantity = stock ? stock.quantity + line.quantity : null;
    const error = !variant ? "SKU não cadastrado nesta loja." : !stock ? "Item sem saldo cadastrado." : finalQuantity! > IMPORT_MAX_QUANTITY || stock.quantity < 0 ? "O saldo final deve estar entre 0 e 1.000.000." : null;
    if (variant && stock && !error) snapshots.push({ variantId: variant.id, stockId: stock.id, sku: variant.sku, quantity: line.quantity, currentQuantity: stock.quantity, updatedAt: stock.updatedAt.toISOString() });
    return { ...line, variantId: variant?.id ?? null, name: variant?.name ?? "Item não encontrado", category: variant?.category ?? "", gender: variant?.gender ?? null, size: variant?.size ?? "", color: variant?.color ?? "", currentQuantity: stock?.quantity ?? null, finalQuantity, error };
  });
  const signed = rows.some((row) => row.error) ? { token: null, expiresAt: null } : await signImportPreview(session, storeId, snapshots);
  return { rows, ...signed, totalQuantity: lines.reduce((total, line) => total + line.quantity, 0) };
}

export async function confirmInventoryImport(session: AdminSession, token: unknown, reviewedVariantIds: unknown) {
  const preview = await verifyImportPreview(token, session);
  if (!Array.isArray(reviewedVariantIds) || reviewedVariantIds.length !== preview.rows.length || new Set(reviewedVariantIds).size !== preview.rows.length || preview.rows.some((row) => !reviewedVariantIds.includes(row.variantId))) {
    throw new InventoryImportError("Confira e marque todos os itens antes de confirmar a importação.");
  }
  const movementIds = preview.rows.map((row) => `inventory-import:${preview.importId}:${row.variantId}`);
  const conflict = () => new InventoryImportError("O estoque mudou desde a conferência. Atualize a prévia e confira todos os itens novamente.", 409);
  try {
    const alreadyApplied = await prisma.$transaction(async (tx) => {
      // Existing movement IDs act as a durable receipt for this specific preview.
      const receipts = await tx.stockMovement.count({ where: { storeId: preview.storeId, id: { in: movementIds } } });
      if (receipts === preview.rows.length) return true;
      if (receipts) throw conflict();
      if (preview.expiresAt <= Date.now()) throw new InventoryImportError("A prévia expirou. Gere uma nova prévia e confira os itens novamente.", 409);
      for (const row of preview.rows) {
        const result = await tx.stockLevel.updateMany({
          where: { id: row.stockId, storeId: preview.storeId, variantId: row.variantId, quantity: row.currentQuantity, updatedAt: new Date(row.updatedAt), variant: { sku: row.sku } },
          data: { quantity: { increment: row.quantity } },
        });
        if (result.count !== 1) throw conflict();
      }
      await tx.stockMovement.createMany({ data: preview.rows.map((row, index) => ({
        id: movementIds[index], storeId: preview.storeId, variantId: row.variantId, type: "ENTRADA" as const, quantity: row.quantity,
        note: `Importação Excel ${preview.importId} por ${session.login}`.slice(0, 300),
      })) });
      return false;
    }, { isolationLevel: "Serializable", timeout: 20_000 });
    return { importId: preview.importId, alreadyApplied, itemCount: preview.rows.length, totalQuantity: preview.rows.reduce((total, row) => total + row.quantity, 0) };
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && ["P2034", "P2002"].includes(String(error.code))) {
      // A concurrent retry can lose the race after another request committed.
      const receipts = await prisma.stockMovement.count({ where: { storeId: preview.storeId, id: { in: movementIds } } });
      if (receipts === preview.rows.length) return { importId: preview.importId, alreadyApplied: true, itemCount: preview.rows.length, totalQuantity: preview.rows.reduce((total, row) => total + row.quantity, 0) };
      throw conflict();
    }
    throw error;
  }
}
