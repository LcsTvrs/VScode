import { isPasswordChangeOverdue } from "@/lib/password-change-window";
import { readJsonBody } from "@/lib/json-body";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { resolveStoreId } from "@/lib/admin-session";

import { assertAvailableStock } from "@/lib/stock-rules";

import { ADMIN_ITEM_LIMIT, parseRequestItems } from "@/lib/request-items";

export async function POST(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (isPasswordChangeOverdue(session)) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
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
    const created = await prisma.$transaction(async (tx) => {
      await assertAvailableStock(tx, storeId, aggregated);
      return tx.uniformRequest.create({
        data: {
          code,
          storeId,
          employeeId: input.employeeId as string,
          notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 500) || null : null,
          items: {
            create: [...aggregated.entries()].map(([variantId, quantity]) => ({ variantId, quantity })),
          },
        },
        select: { id: true, code: true, status: true },
      });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if ((error instanceof Error && error.message.startsWith("ESTOQUE_INSUFICIENTE:")) || (error && typeof error === "object" && "code" in error && error.code === "P2034")) {
      return NextResponse.json({ message: "Saldo indisponível ou alterado por outra solicitação. Atualize a lista e tente novamente." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível criar a solicitação. Verifique loja, colaborador e itens." }, { status: 400 });
  }
}
