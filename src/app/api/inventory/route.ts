import { readJsonBody } from "@/lib/json-body";
import { MovementType } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { resolveStoreId } from "@/lib/admin-session";

import { movementDelta } from "@/lib/stock-rules";
import { isUniformGender } from "@/lib/uniform-gender";

const movementTypes = Object.values(MovementType);

export async function POST(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (session.mustChangePassword) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
  const body: unknown = await readJsonBody(request);
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
    ((quantity as number) < 0 || (quantity as number) > 1_000_000)
  ) {
    return NextResponse.json({ message: "Confira loja, uniforme, tipo e quantidade." }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const stock = await tx.stockLevel.findUnique({
        where: { storeId_variantId: { storeId, variantId } },
      });
      if (!stock) throw new Error("SALDO_NAO_ENCONTRADO");

      const delta = movementDelta(type as MovementType, quantity as number, stock.quantity);
      const nextQuantity = stock.quantity + delta;
      if (nextQuantity < 0) throw new Error("SALDO_INSUFICIENTE");

      const updated = await tx.stockLevel.updateMany({
        where: { id: stock.id, quantity: stock.quantity },
        data: { quantity: nextQuantity },
      });
      if (updated.count !== 1) throw new Error("SALDO_CONCORRENTE");
      const movement = await tx.stockMovement.create({
        data: {
          storeId,
          variantId,
          type: type as MovementType,
          quantity: delta,
          note: typeof note === "string" ? note.trim().slice(0, 300) || null : null,
        },
      });
      return { quantity: nextQuantity, movementId: movement.id };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERRO_INTERNO";
    if (message === "SALDO_NAO_ENCONTRADO") {
      return NextResponse.json({ message: "Item sem saldo cadastrado para esta loja." }, { status: 404 });
    }
    if (message === "SALDO_CONCORRENTE") {
      return NextResponse.json({ message: "O saldo mudou. Atualize a página e tente novamente." }, { status: 409 });
    }
    if (message === "SALDO_INSUFICIENTE") {
      return NextResponse.json({ message: "O ajuste não pode deixar o saldo negativo." }, { status: 409 });
    }
    if (message === "LIMITE_SALDO") return NextResponse.json({ message: "O saldo final não pode ultrapassar 1.000.000 de peças." }, { status: 400 });
    return NextResponse.json({ message: "Não foi possível registrar a movimentação." }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (session.mustChangePassword) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
  const body: unknown = await readJsonBody(request);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const { variantId, quantity, minimum } = input;
  if (typeof input.updatedAt !== "string" || !Number.isFinite(Date.parse(input.updatedAt))) {
    return NextResponse.json({ message: "Reabra a edição de estoque para carregar a versão atual." }, { status: 400 });
  }
  const expectedVersion = Date.parse(input.updatedAt);
  const gender = input.gender;
  if (gender !== undefined && gender !== null && !isUniformGender(gender)) {
    return NextResponse.json({ message: "Selecione Masculino, Feminino ou Não informado." }, { status: 400 });
  }
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
      if (current.updatedAt.getTime() !== expectedVersion) throw new Error("SALDO_CONCORRENTE");

      const nextQuantity = quantity as number;
      const delta = nextQuantity - current.quantity;
      const updated = await tx.stockLevel.updateMany({
        where: { id: current.id, quantity: current.quantity, minimum: current.minimum, updatedAt: current.updatedAt },
        data: { quantity: nextQuantity, minimum: minimum as number, updatedAt: new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1)) },
      });
      if (updated.count !== 1) throw new Error("SALDO_CONCORRENTE");
      if (gender !== undefined) {
        const classified = await tx.uniformVariant.updateMany({ where: { id: variantId, storeId }, data: { gender } });
        if (classified.count !== 1) throw new Error("SALDO_NAO_ENCONTRADO");
      }
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
