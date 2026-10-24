import type { MovementType, Prisma } from "@prisma/client";

export function movementDelta(type: MovementType, quantity: number, current: number) {
  if (!Number.isInteger(quantity) || quantity < 0 || quantity > 1_000_000) throw new Error("QUANTIDADE_INVALIDA");
  const delta = type === "AJUSTE" ? quantity - current : type === "SAIDA" ? -quantity : quantity;
  if (current + delta < 0) throw new Error("SALDO_INSUFICIENTE");
  if (current + delta > 1_000_000) throw new Error("LIMITE_SALDO");
  return delta;
}

// Both request flows must read reservations inside the same Serializable transaction.
export async function assertAvailableStock(tx: Prisma.TransactionClient, storeId: string, items: Map<string, number>, excludedRequestId?: string) {
  const variantIds = [...items.keys()];
  const stocks = await tx.stockLevel.findMany({ where: { storeId, variantId: { in: variantIds } } });
  const pending = await tx.requestItem.groupBy({
    by: ["variantId"],
    where: { variantId: { in: variantIds }, request: { storeId, status: "PENDENTE", ...(excludedRequestId ? { id: { not: excludedRequestId } } : {}) } },
    _sum: { quantity: true },
  });
  const reserved = new Map(pending.map((item) => [item.variantId, item._sum.quantity ?? 0]));
  const balances = new Map(stocks.map((stock) => [stock.variantId, stock.quantity]));
  for (const [variantId, quantity] of items) {
    if (!balances.has(variantId) || (balances.get(variantId)! - (reserved.get(variantId) ?? 0)) < quantity) {
      throw new Error("ESTOQUE_INSUFICIENTE:item selecionado");
    }
  }
}
