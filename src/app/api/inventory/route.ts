import { requireAdmin } from "@/features/auth/server/authorization";
import { resolveStoreId } from "@/features/auth/session";
import { editInventory, moveInventory } from "@/features/inventory/server/operations";
import { readJsonBody } from "@/lib/json-body";
import { MovementType } from "@prisma/client";
import { NextResponse } from "next/server";



const movementTypes = Object.values(MovementType);

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;
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
    const result = await moveInventory({ storeId, variantId, type: type as MovementType, quantity: quantity as number, note });
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "ERRO_INTERNO";
    if (message === "ESTOQUE_RESERVADO") return NextResponse.json({ message: "O saldo não pode ficar abaixo das reservas dos pedidos pendentes." }, { status: 409 });
    if ((error as { code?: string })?.code === "P2034") return NextResponse.json({ message: "O estoque ou as reservas mudaram. Atualize e tente novamente." }, { status: 409 });
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
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const { session } = auth;
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
  if (["gender", "sector", "name", "sku", "category", "size", "color"].some(key => key in input)) {
    return NextResponse.json({ message: "Altere os dados do item no catálogo global, disponível ao MASTER_ADMIN." }, { status: 403 });
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
    const result = await editInventory({ storeId, variantId, expectedVersion, quantity: quantity as number, minimum: minimum as number });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message === "ESTOQUE_RESERVADO") return NextResponse.json({ message: "O saldo não pode ficar abaixo das reservas dos pedidos pendentes." }, { status: 409 });
    if ((error as { code?: string })?.code === "P2034") return NextResponse.json({ message: "O estoque ou as reservas mudaram. Atualize e tente novamente." }, { status: 409 });
    if (error instanceof Error && error.message === "SALDO_NAO_ENCONTRADO") {
      return NextResponse.json({ message: "Item sem saldo cadastrado para esta loja." }, { status: 404 });
    }
    if (error instanceof Error && error.message === "SALDO_CONCORRENTE") {
      return NextResponse.json({ message: "O saldo foi alterado por outra operação. Atualize a página e tente novamente." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível atualizar o estoque." }, { status: 500 });
  }
}
