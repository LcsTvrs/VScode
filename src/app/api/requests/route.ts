import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { resolveStoreId } from "@/lib/admin-session";

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
  const code = `SOL-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;

  try {
    const created = await prisma.uniformRequest.create({
      data: {
        code,
        storeId,
        employeeId: input.employeeId,
        notes: typeof input.notes === "string" ? input.notes.trim().slice(0, 500) || null : null,
        items: {
          create: [...aggregated.entries()].map(([variantId, quantity]) => ({ variantId, quantity })),
        },
      },
      select: { id: true, code: true, status: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Não foi possível criar a solicitação. Verifique loja, colaborador e itens." }, { status: 400 });
  }
}
