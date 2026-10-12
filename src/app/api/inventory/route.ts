import { MovementType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const movementTypes = Object.values(MovementType);

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const { storeId, variantId, type, quantity, note } = input;
  if (
    typeof storeId !== "string" ||
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
