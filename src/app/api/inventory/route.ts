import { MovementType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { resolveStoreId } from "@/lib/admin-session";

const movementTypes = Object.values(MovementType);

export async function POST(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const { variantId, type, quantity, note } = input;
  const storeId = resolveStoreId(session, input.storeId);
  if (
    !storeId ||
    typeof variantId !== "string" ||
    typeof type !== "string" ||
    !movementTypes.includes(type as MovementType) ||
    !Number.isInteger(quantity) ||
    (quantity as number) < 0
  ) {
    return NextResponse.json({ message: "Confira loja, uniforme, tipo e quantidade." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stock = await tx.stockLevel.findUnique({
        where: { storeId_variantId: { storeId, variantId } },
      });
      if (!stock) throw new Error("SALDO_NAO_ENCONTRADO");

      const delta = type === "AJUSTE" ? (quantity as number) - stock.quantity : quantity as number;
      const nextQuantity = stock.quantity + delta;
      if (nextQuantity < 0) throw new Error("SALDO_INSUFICIENTE");

      const updated = await tx.stockLevel.update({
        where: { id: stock.id },
        data: { quantity: nextQuantity },
      });
      const movement = await tx.stockMovement.create({
        data: {
          storeId,
          variantId,
          type: type as MovementType,
          quantity: delta,
          note: typeof note === "string" ? note.trim().slice(0, 300) || null : null,
        },
      });
      return { quantity: updated.quantity, movementId: movement.id };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERRO_INTERNO";
    if (message === "SALDO_NAO_ENCONTRADO") {
      return NextResponse.json({ message: "Item sem saldo cadastrado para esta loja." }, { status: 404 });
    }
    if (message === "SALDO_INSUFICIENTE") {
      return NextResponse.json({ message: "O ajuste não pode deixar o saldo negativo." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível registrar a movimentação." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const { variantId, quantity, minimum } = input;
  const storeId = resolveStoreId(session, input.storeId);
  if (
    !storeId ||
    typeof variantId !== "string" ||
    !Number.isInteger(quantity) ||
    (quantity as number) < 0 ||
    (quantity as number) > 1_000_000 ||
    !Number.isInteger(minimum) ||
    (minimum as number) < 0 ||
    (minimum as number) > 1_000_000
  ) {
    return NextResponse.json({ message: "Informe saldos válidos para o uniforme." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.stockLevel.findUnique({
        where: { storeId_variantId: { storeId, variantId } },
      });
      if (!current) throw new Error("SALDO_NAO_ENCONTRADO");

      const nextQuantity = quantity as number;
      const delta = nextQuantity - current.quantity;
      const updated = await tx.stockLevel.updateMany({
        where: { id: current.id, quantity: current.quantity, minimum: current.minimum },
        data: { quantity: nextQuantity, minimum: minimum as number },
      });
      if (updated.count !== 1) throw new Error("SALDO_CONCORRENTE");
      if (delta !== 0) {
        await tx.stockMovement.create({
          data: {
            storeId,
            variantId,
            type: "AJUSTE",
            quantity: delta,
            note: "Edição direta do saldo pelo painel administrativo",
          },
        });
      }
      return { quantity: nextQuantity, minimum: minimum as number };
    });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "SALDO_NAO_ENCONTRADO") {
      return NextResponse.json({ message: "Item sem saldo cadastrado para esta loja." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "SALDO_CONCORRENTE") {
      return NextResponse.json({ message: "O saldo foi alterado por outra operação. Atualize a página e tente novamente." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível atualizar o estoque." }, { status: 500 });
  }
}
