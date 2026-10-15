import { UniformCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { resolveStoreId } from "@/lib/admin-session";

const categories = Object.values(UniformCategory);

export async function POST(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  if (
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

  const sku = input.sku as string;
  const name = input.name as string;
  const size = input.size as string;
  const color = input.color as string;
  const storeId = resolveStoreId(session, input.storeId);
  if (!storeId) return NextResponse.json({ message: "Selecione uma loja para esta operação." }, { status: 400 });
  const quantity = input.quantity as number;
  const minimum = input.minimum as number;

  try {
    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.uniformVariant.create({
        data: {
          sku: sku.trim().toUpperCase().slice(0, 40),
          name: name.trim().slice(0, 100),
          category: input.category as UniformCategory,
          size: size.trim().slice(0, 20),
          color: color.trim().slice(0, 40),
          store: { connect: { id: storeId } },
        },
      });
      const stock = await tx.stockLevel.create({
        data: {
          storeId,
          variantId: created.id,
          quantity,
          minimum,
        },
      });
      if (stock.quantity > 0) {
        await tx.stockMovement.create({
          data: {
            storeId,
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
