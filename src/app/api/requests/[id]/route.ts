import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as Record<string, unknown>).action : null;
  if (action !== "APROVAR" && action !== "RECUSAR") {
    return NextResponse.json({ message: "Ação inválida." }, { status: 400 });
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const uniformRequest = await tx.uniformRequest.findUnique({
        where: { id },
        include: { items: { include: { variant: true } } },
      });
      if (!uniformRequest) throw new Error("SOLICITACAO_NAO_ENCONTRADA");
      if (uniformRequest.status !== "PENDENTE") throw new Error("SOLICITACAO_JA_PROCESSADA");

      const claimed = await tx.uniformRequest.updateMany({
        where: { id, status: "PENDENTE" },
        data: { status: action === "APROVAR" ? "APROVADA" : "RECUSADA" },
      });
      if (claimed.count !== 1) throw new Error("SOLICITACAO_JA_PROCESSADA");

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
    });
    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERRO_INTERNO";
    if (message === "SOLICITACAO_NAO_ENCONTRADA") {
      return NextResponse.json({ message: "Solicitação não encontrada." }, { status: 404 });
    }
    if (message === "SOLICITACAO_JA_PROCESSADA") {
      return NextResponse.json({ message: "Esta solicitação já foi processada." }, { status: 409 });
    }
    if (message.startsWith("ESTOQUE_INSUFICIENTE:")) {
      return NextResponse.json({ message: `Saldo insuficiente para ${message.split(":")[1]}.` }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível processar a solicitação." }, { status: 500 });
  }
}
