import type { AdminSession } from "@/features/auth/session";
import { assertAvailableStock } from "@/features/inventory/server/stock-rules";
import { prisma } from "@/lib/prisma";

// Keep version claiming, replacement/reservation and approval in one transaction.
export function replaceRequestItems(session: AdminSession, id: string, expectedVersion: number, items: Map<string, number>) {
  return prisma.$transaction(async (tx) => {
      const existing = await tx.uniformRequest.findUnique({
        where: session.role === "STORE_ADMIN" ? { storeId_id: { storeId: session.storeId!, id } } : { id },
      });
      if (!existing) throw new Error("SOLICITACAO_NAO_ENCONTRADA");
      if (existing.status !== "PENDENTE") throw new Error("SOLICITACAO_JA_PROCESSADA");
      if (existing.updatedAt.getTime() !== expectedVersion) throw new Error("SOLICITACAO_ALTERADA");
      // The request's old reservation is replaced, not counted against itself.
      await assertAvailableStock(tx, existing.storeId, items, id);
      const updatedAt = new Date(Math.max(Date.now(), existing.updatedAt.getTime() + 1));
      const claimed = await tx.uniformRequest.updateMany({
        where: { id, storeId: existing.storeId, status: "PENDENTE", updatedAt: existing.updatedAt },
        data: { updatedAt },
      });
      if (claimed.count !== 1) throw new Error("SOLICITACAO_ALTERADA");
      await tx.requestItem.deleteMany({ where: { requestId: id, storeId: existing.storeId } });
      await tx.requestItem.createMany({
        data: [...items].map(([variantId, quantity]) => ({ requestId: id, storeId: existing.storeId, variantId, quantity })),
      });
      return { id, code: existing.code, status: "PENDENTE", updatedAt };
    }, { isolationLevel: "Serializable" });
}

export function processUniformRequest(session: AdminSession, id: string, action: "APROVAR" | "RECUSAR", expectedVersion: string) {
  return prisma.$transaction(async (tx) => {
      const uniformRequest = await tx.uniformRequest.findUnique({
        where: session.role === "STORE_ADMIN"
          ? { storeId_id: { storeId: session.storeId!, id } }
          : { id },
        include: { items: { include: { variant: true } } },
      });
      if (!uniformRequest) throw new Error("SOLICITACAO_NAO_ENCONTRADA");
      if (uniformRequest.status !== "PENDENTE") throw new Error("SOLICITACAO_JA_PROCESSADA");
      if (uniformRequest.updatedAt.getTime() !== Date.parse(expectedVersion)) throw new Error("SOLICITACAO_ALTERADA");

      const claimed = await tx.uniformRequest.updateMany({
        where: { id, storeId: uniformRequest.storeId, status: "PENDENTE", updatedAt: uniformRequest.updatedAt },
        data: { status: action === "APROVAR" ? "APROVADA" : "RECUSADA" },
      });
      if (claimed.count !== 1) throw new Error("SOLICITACAO_ALTERADA");

      if (action === "APROVAR") {
        for (const item of uniformRequest.items) {
          const deducted = await tx.stockLevel.updateMany({
            where: {
              storeId: uniformRequest.storeId,
              variantId: item.variantId,
              quantity: { gte: item.quantity },
            },
            data: { quantity: { decrement: item.quantity } },
          });
          if (deducted.count !== 1) throw new Error(`ESTOQUE_INSUFICIENTE:${item.variant.name} ${item.variant.size}`);
          await tx.stockMovement.create({
            data: {
              storeId: uniformRequest.storeId,
              variantId: item.variantId,
              type: "SAIDA",
              quantity: -item.quantity,
              note: `Atendimento da solicitação ${uniformRequest.code}`,
            },
          });
        }
      }

      return { id, code: uniformRequest.code, status: action === "APROVAR" ? "APROVADA" : "RECUSADA" };
    }, { isolationLevel: "Serializable" });
}
