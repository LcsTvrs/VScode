import { requireAdmin } from "@/features/auth/server/authorization";
import { ADMIN_ITEM_LIMIT, parseRequestItems } from "@/features/requests/items";
import { processUniformRequest, replaceRequestItems } from "@/features/requests/server/operations";
import { readJsonBody } from "@/lib/json-body";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

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
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;
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
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const { id } = await context.params;
  const body = await readJsonBody(request);
  if (!body || !validVersion(body.updatedAt)) return NextResponse.json({ message: "Reabra a solicitação para carregar sua versão atual." }, { status: 400 });
  const expectedVersion = Date.parse(body.updatedAt);
  let items: Map<string, number>;
  try { items = parseRequestItems(body.items, ADMIN_ITEM_LIMIT); }
  catch (error) { return NextResponse.json({ message: (error as Error).message }, { status: 400 }); }
  try {
    const result = await replaceRequestItems(session, id, expectedVersion, items);
    return NextResponse.json(result);
  } catch (error) { return requestError(error); }
}

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const { id } = await context.params;
  const body: unknown = await readJsonBody(request);
  const action = body && typeof body === "object" ? (body as Record<string, unknown>).action : null;
  if (action !== "APROVAR" && action !== "RECUSAR") {
    return NextResponse.json({ message: "Ação inválida." }, { status: 400 });
  }
  const expectedVersion = (body as Record<string, unknown>).updatedAt;
  if (!validVersion(expectedVersion)) return NextResponse.json({ message: "Atualize o painel antes de processar a solicitação." }, { status: 400 });

  try {
    const updated = await processUniformRequest(session, id, action, expectedVersion);
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
