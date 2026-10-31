import { requireAdmin } from "@/features/auth/server/authorization";
import { resolveStoreId } from "@/features/auth/session";
import { createAdminRequest } from "@/features/requests/server/create-request";
import { readJsonBody } from "@/lib/json-body";
import { NextResponse } from "next/server";
import { historyQuery, readHistory } from "@/features/requests/server/history";


import { ADMIN_ITEM_LIMIT, parseRequestItems } from "@/features/requests/items";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const params = new URL(request.url).searchParams;
  const storeId = auth.session.role === "STORE_ADMIN" ? auth.session.storeId : params.get("storeId");
  if (auth.session.role === "STORE_ADMIN" && !storeId) return NextResponse.json({ message: "Sua conta precisa ser vinculada a uma loja." }, { status: 403 });
  let query;
  try { query = historyQuery(params, storeId); }
  catch (error) { return NextResponse.json({ message: (error as Error).message }, { status: 400 }); }
  try { return NextResponse.json(await readHistory(query)); }
  catch { return NextResponse.json({ message: "Não foi possível consultar as solicitações. Tente novamente." }, { status: 503 }); }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const body: unknown = await readJsonBody(request);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const storeId = resolveStoreId(session, input.storeId);
  if (!storeId || typeof input.employeeId !== "string") {
    return NextResponse.json({ message: "Informe solicitante e pelo menos um item com quantidade válida." }, { status: 400 });
  }

  let aggregated: Map<string, number>;
  try { aggregated = parseRequestItems(input.items, ADMIN_ITEM_LIMIT); }
  catch (error) { return NextResponse.json({ message: (error as Error).message }, { status: 400 }); }
  const code = `SOL-${new Date().getFullYear()}-${crypto.randomUUID()}`;

  try {
    const created = await createAdminRequest({ storeId, code, employeeId: input.employeeId as string, notes: input.notes, aggregated });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if ((error instanceof Error && error.message.startsWith("ESTOQUE_INSUFICIENTE:")) || (error && typeof error === "object" && "code" in error && error.code === "P2034")) {
      return NextResponse.json({ message: "Saldo indisponível ou alterado por outra solicitação. Atualize a lista e tente novamente." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível criar a solicitação. Verifique loja, colaborador e itens." }, { status: 400 });
  }
}
