import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { assertAvailableStock } from "@/lib/stock-rules";
import { ADMIN_ITEM_LIMIT, parseRequestItems } from "@/lib/request-items";

type RouteContext = { params: Promise<{ id: string }> };

function validVersion(value: unknown): value is string {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function requestError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  if (message === "SOLICITACAO_NAO_ENCONTRADA") return NextResponse.json({ message: "Solicitação não encontrada." }, { status: 404 });
  if (message === "SOLICITACAO_JA_PROCESSADA") return NextResponse.json({ message: "Somente solicitações pendentes podem ser alteradas.", code: "REQUEST_PROCESSED" }, { status: 409 });
  if (message === "SOLICITACAO_ALTERADA" || (error && typeof error === "object" && "code" in error && error.code === "P2034")) {
    return NextResponse.json({ message: "A solicitação ou o estoque mudou. Recarregue os dados e confira novamente.", code: "REQUEST_CHANGED" }, { status: 409 });
  }
  if (message.startsWith("ESTOQUE_INSUFICIENTE:")) return NextResponse.json({ message: "Saldo insuficiente para os itens selecionados, considerando as outras solicitações pendentes." }, { status: 409 });
  return NextResponse.json({ message: "Não foi possível atualizar a solicitação." }, { status: 500 });
}

export async function GET(request: Request, context: RouteContext) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (session.mustChangePassword) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
  const { id } = await context.params;
  try {
    const existing = await prisma.uniformRequest.findUnique({
      where: session.role === "STORE_ADMIN" ? { storeId_id: { storeId: session.storeId!, id } } : { id },
      select: {
        id: true, code: true, status: true, updatedAt: true,
        employee: { select: { name: true, ldap: true } },
        items: { select: { variantId: true, quantity: true } },
      },
    });
    if (!existing) throw new Error("SOLICITACAO_NAO_ENCONTRADA");
    return NextResponse.json(existing, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return requestError(error); }
}

export async function PUT(request: Request, context: RouteContext) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (session.mustChangePassword) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body || !validVersion(body.updatedAt)) return NextResponse.json({ message: "Reabra a solicitação para carregar sua versão atual." }, { status: 400 });
  let items: Map<string, number>;
  try { items = parseRequestItems(body.items, ADMIN_ITEM_LIMIT); }
  catch (error) { return NextResponse.json({ message: (error as Error).message }, { status: 400 }); }
  try {
    const result = await prisma.$transaction(async (tx) => {
      const existing = await tx.uniformRequest.findUnique({
        where: session.role === "STORE_ADMIN" ? { storeId_id: { storeId: session.storeId!, id } } : { id },
      });
      if (!existing) throw new Error("SOLICITACAO_NAO_ENCONTRADA");
      if (existing.status !== "PENDENTE") throw new Error("SOLICITACAO_JA_PROCESSADA");
      if (existing.updatedAt.getTime() !== Date.parse(body.updatedAt)) throw new Error("SOLICITACAO_ALTERADA");
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
    return NextResponse.json(result);
  } catch (error) { return requestError(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (session.mustChangePassword) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const action = body && typeof body === "object" ? (body as Record<string, unknown>).action : null;
  if (action !== "APROVAR" && action !== "RECUSAR") {
    return NextResponse.json({ message: "Ação inválida." }, { status: 400 });
  }
  const expectedVersion = (body as Record<string, unknown>).updatedAt;
  if (!validVersion(expectedVersion)) return NextResponse.json({ message: "Atualize o painel antes de processar a solicitação." }, { status: 400 });

  try {
    const updated = await prisma.$transaction(async (tx) => {
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
    return NextResponse.json(updated);
  } catch (error) {
    if ((error instanceof Error && error.message === "SOLICITACAO_ALTERADA") || (error && typeof error === "object" && "code" in error && error.code === "P2034")) return requestError(error);
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
