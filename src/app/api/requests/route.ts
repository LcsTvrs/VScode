import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { resolveStoreId } from "@/lib/admin-session";

import { assertAvailableStock } from "@/lib/stock-rules";

type RequestItemInput = { variantId: string; quantity: number };

export async function POST(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const items = input.items;
  const storeId = resolveStoreId(session, input.storeId);
  if (
    !storeId ||
    typeof input.employeeId !== "string" ||
    !Array.isArray(items) ||
    items.length === 0 ||
    items.length > 20 ||
    !items.every((item): item is RequestItemInput =>
      Boolean(item) &&
      typeof item === "object" &&
      typeof item.variantId === "string" &&
      Number.isInteger(item.quantity) &&
      item.quantity > 0 &&
      item.quantity <= 20,
    )
  ) {
    return NextResponse.json({ message: "Informe solicitante e pelo menos um item com quantidade válida." }, { status: 400 });
  }

  const aggregated = new Map<string, number>();
  for (const item of items) aggregated.set(item.variantId, (aggregated.get(item.variantId) ?? 0) + item.quantity);
  if ([...aggregated.values()].some((quantity) => quantity > 20)) return NextResponse.json({ message: "A quantidade por uniforme não pode passar de 20 peças." }, { status: 400 });
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
