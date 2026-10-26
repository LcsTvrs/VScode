import { prisma } from "@/lib/prisma";
import { bulkResult, type BulkChange, type BulkRecord } from "../bulk";
import { editStockInTransaction } from "./operations";

export function editInventoryBulk(records: BulkRecord[], change: BulkChange) {
  return prisma.$transaction(async tx => {
    // Fixed order reduces deadlocks for overlapping selections. No unselected row is written.
    const ordered = [...records].sort((a, b) => a.storeId.localeCompare(b.storeId) || a.variantId.localeCompare(b.variantId));
    for (const record of ordered) {
      const current = await tx.stockLevel.findUnique({ where: { storeId_variantId: { storeId: record.storeId, variantId: record.variantId } } });
      if (!current) throw new Error("SALDO_NAO_ENCONTRADO");
      const next = bulkResult(current.quantity, current.minimum, change);
      await editStockInTransaction(tx, { storeId: record.storeId, variantId: record.variantId, expectedVersion: Date.parse(record.updatedAt), ...next }, `Edição em massa: ${change.mode === "SET" ? "definir saldo final" : change.mode === "ADD" ? "adicionar peças" : change.mode === "REMOVE" ? "retirar peças" : "alterar mínimo"}`, change.mode === "ADD" ? "ENTRADA" : change.mode === "REMOVE" ? "SAIDA" : "AJUSTE");
    }
    return { updatedCount: records.length };
  }, { isolationLevel: "Serializable", timeout: 20000 });
}
