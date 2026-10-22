import { readJsonBody } from "@/lib/json-body";
import { UniformCategory } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { resolveStoreId } from "@/lib/admin-session";
import { isUniformGender } from "@/lib/uniform-gender";

const categories = Object.values(UniformCategory);

export async function POST(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (session.mustChangePassword) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
  const body: unknown = await readJsonBody(request);
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
    !isUniformGender(input.gender) ||
    !Number.isInteger(input.quantity) ||
    (input.quantity as number) < 0 ||
    (input.quantity as number) > 1_000_000 ||
    !Number.isInteger(input.minimum) ||
    (input.minimum as number) < 0
    || (input.minimum as number) > 1_000_000
  ) {
    return NextResponse.json({ message: "Confira os campos do uniforme e as quantidades." }, { status: 400 });
  }

  const sku = (input.sku as string).trim().toUpperCase();
  const name = (input.name as string).trim();
  const size = (input.size as string).trim();
  const color = (input.color as string).trim();
  if (!sku || sku.length > 40 || !name || name.length > 100 || !size || size.length > 20 || !color || color.length > 40) {
    return NextResponse.json({ message: "Preencha SKU (até 40), nome (até 100), tamanho (até 20) e cor (até 40 caracteres)." }, { status: 400 });
  }
  const storeId = resolveStoreId(session, input.storeId);
  if (!storeId) return NextResponse.json({ message: "Selecione uma loja para esta operação." }, { status: 400 });
  const quantity = input.quantity as number;
  const minimum = input.minimum as number;

  try {
    const variant = await prisma.$transaction(async (tx) => {
      const created = await tx.uniformVariant.create({
        data: {
          sku,
          name,
          category: input.category as UniformCategory,
          gender: input.gender as "MASCULINO" | "FEMININO",
          size,
          color,
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
