import { UniformCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

const categories = Object.values(UniformCategory);

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (
    typeof input.storeId !== "string" ||
    typeof input.sku !== "string" ||
    typeof input.name !== "string" ||
    typeof input.size !== "string" ||
    typeof input.color !== "string" ||
    typeof input.category !== "string" ||
    !categories.includes(input.category as UniformCategory) ||
    !Number.isInteger(input.quantity) ||
    (input.quantity as number) < 0 ||
    !Number.isInteger(input.minimum) ||
    (input.minimum as number) < 0
  ) {
    return NextResponse.json({ message: "Confira os campos do uniforme e as quantidades." }, { status: 400 });
  }

  try {
    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.uniformVariant.create({
        data: {
          sku: input.sku.trim().toUpperCase().slice(0, 40),
          name: input.name.trim().slice(0, 100),
          category: input.category as UniformCategory,
          size: input.size.trim().slice(0, 20),
          color: input.color.trim().slice(0, 40),
        },
      });
      const stock = await tx.stockLevel.create({
        data: {
          storeId: input.storeId,
          variantId: created.id,
          quantity: input.quantity as number,
          minimum: input.minimum as number,
        },
      });
      if (stock.quantity > 0) {
        await tx.stockMovement.create({
          data: {
            storeId: input.storeId,
            variantId: created.id,
            type: "ENTRADA",
            quantity: stock.quantity,
            note: "Saldo inicial do cadastro",
          },
        });
      }
      return { ...created, quantity: stock.quantity, minimum: stock.minimum };
    });
    return NextResponse.json(variant, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Não foi possível cadastrar. Verifique se o SKU já existe." }, { status: 409 });
  }
}
