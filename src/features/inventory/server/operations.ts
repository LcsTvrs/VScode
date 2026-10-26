import { prisma } from "@/lib/prisma";
import type { MovementType, Prisma } from "@prisma/client";
import { assertReservationCoverage, movementDelta } from "./stock-rules";

type MovementInput = { storeId: string; variantId: string; type: MovementType; quantity: number; note: unknown };
type StockEditInput = { storeId: string; variantId: string; expectedVersion: number; quantity: number; minimum: number };

// The transaction owns both the stock write and its audit movement.
export function moveInventory({ storeId, variantId, type, quantity, note }: MovementInput) {
  return prisma.$transaction(async (tx) => {
      const stock = await tx.stockLevel.findUnique({
        where: { storeId_variantId: { storeId, variantId } },
      });
      if (!stock) throw new Error("SALDO_NAO_ENCONTRADO");

      const delta = movementDelta(type as MovementType, quantity as number, stock.quantity);
      const nextQuantity = stock.quantity + delta;
      if (nextQuantity < 0) throw new Error("SALDO_INSUFICIENTE");
      if (delta < 0) await assertReservationCoverage(tx, storeId, variantId, nextQuantity);

      const updated = await tx.stockLevel.updateMany({
        where: { id: stock.id, quantity: stock.quantity },
        data: { quantity: nextQuantity },
      });
      if (updated.count !== 1) throw new Error("SALDO_CONCORRENTE");
      const movement = await tx.stockMovement.create({
        data: {
          storeId,
          variantId,
          type: type as MovementType,
          quantity: delta,
          note: typeof note === "string" ? note.trim().slice(0, 300) || null : null,
        },
      });
      return { quantity: nextQuantity, movementId: movement.id };
    }, { isolationLevel: "Serializable" });
}

export async function editStockInTransaction(tx: Prisma.TransactionClient, { storeId, variantId, expectedVersion, quantity, minimum }: StockEditInput, note = "Edição direta do saldo pelo painel administrativo", movementType: MovementType = "AJUSTE") {
      const current = await tx.stockLevel.findUnique({
        where: { storeId_variantId: { storeId, variantId } },
      });
      if (!current) throw new Error("SALDO_NAO_ENCONTRADO");
      if (current.updatedAt.getTime() !== expectedVersion) throw new Error("SALDO_CONCORRENTE");

      const nextQuantity = quantity as number;
      const delta = nextQuantity - current.quantity;
      if (delta < 0) await assertReservationCoverage(tx, storeId, variantId, nextQuantity);
      const updated = await tx.stockLevel.updateMany({
        where: { id: current.id, quantity: current.quantity, minimum: current.minimum, updatedAt: current.updatedAt },
        data: { quantity: nextQuantity, minimum: minimum as number, updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) },
      });
      if (updated.count !== 1) throw new Error("SALDO_CONCORRENTE");
      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            storeId,
            variantId,
            type: movementType,
            quantity: delta,
            note,
          },
        });
      }
      return { quantity: nextQuantity, minimum: minimum as number };
}

export function editInventory(input: StockEditInput) {
  return prisma.$transaction(tx => editStockInTransaction(tx, input), { isolationLevel: "Serializable" });
}
