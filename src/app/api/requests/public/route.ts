import { assertAvailableStock } from "@/lib/stock-rules";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateRequestIdentity } from "@/lib/request-identity";

import { parseRequestItems, PUBLIC_ITEM_LIMIT } from "@/lib/request-items";

async function findPublicStore(storeCode: string | null) {
  if (storeCode) return prisma.store.findUnique({ where: { code: storeCode.trim().toUpperCase() }, select: { id: true, name: true, code: true } });
  const count = await prisma.store.count();
  if (count > 1) throw new Error("STORE_CODE_REQUIRED");
  if (count === 0) return null;
  return prisma.store.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, code: true } });
}

export async function GET(request: Request) {
  const storeCode = new URL(request.url).searchParams.get("storeCode");
  if (!storeCode && await prisma.store.count() > 1) {
    const stores = await prisma.store.findMany({ orderBy: { name: "asc" }, select: { code: true, name: true, city: true, state: true } });
    return NextResponse.json({ requiresStoreSelection: true, stores });
  }
  let store;
  try {
    store = await findPublicStore(storeCode);
  } catch {
    return NextResponse.json({ message: "Informe o código da loja no endereço de solicitação." }, { status: 400 });
  }

  if (!store) return NextResponse.json({ message: "Nenhuma loja cadastrada." }, { status: 404 });

  const stockLevels = await prisma.stockLevel.findMany({
    where: { storeId: store.id, quantity: { gt: 0 } },
    include: { variant: true },
    orderBy: { variant: { name: "asc" } },
  });
  const pendingItems = await prisma.requestItem.groupBy({
    by: ["variantId"],
    where: { request: { storeId: store.id, status: "PENDENTE" } },
    _sum: { quantity: true },
  });
  const pendingByVariant = new Map(pendingItems.map((item) => [item.variantId, item._sum.quantity ?? 0]));

  return NextResponse.json({
    storeName: store.name,
    storeCode: store.code,
    variants: stockLevels.map(({ variant, quantity }) => ({
      id: variant.id,
      name: variant.name,
      category: variant.category,
      gender: variant.gender,
      imageId: variant.imageId ?? null,
      size: variant.size,
      color: variant.color,
      available: Math.max(0, quantity - (pendingByVariant.get(variant.id) ?? 0)),
    })).filter((variant) => variant.available > 0),
  });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const storeCode = typeof input.storeCode === "string" ? input.storeCode : null;
  const identity = validateRequestIdentity(input.ldap, input.name);
  if (!identity.ok) return NextResponse.json({ message: identity.message }, { status: 400 });
  const { ldap, name } = identity;
  let aggregatedItems: Map<string, number>;
  try { aggregatedItems = parseRequestItems(input.items, PUBLIC_ITEM_LIMIT); }
  catch (error) {
    return NextResponse.json({ message: (error as Error).message }, { status: 400 });
  }

  let store;
  try {
    store = await findPublicStore(storeCode);
  } catch {
    return NextResponse.json({ message: "Informe o código da loja no endereço de solicitação." }, { status: 400 });
  }
  if (!store) return NextResponse.json({ message: "Nenhuma loja cadastrada." }, { status: 404 });

  try {
    const created = await prisma.$transaction(async (tx) => {
      const requestedVariants = [...aggregatedItems.entries()];
      await assertAvailableStock(tx, store.id, aggregatedItems);

      const employee = await tx.employee.upsert({
        where: { storeId_ldap: { storeId: store.id, ldap } },
        create: { ldap, name, storeId: store.id },
        update: { name, storeId: store.id },
        select: { id: true },
      });
      const code = `SOL-${new Date().getFullYear()}-${crypto.randomUUID().slice(0, 6).toUpperCase()}`;
      const uniformRequest = await tx.uniformRequest.create({
        data: {
          code,
          employeeId: employee.id,
          storeId: store.id,
          items: {
            create: requestedVariants.map(([variantId, quantity]) => ({ variantId, quantity })),
          },
        },
        select: { id: true, code: true, status: true },
      });
      return uniformRequest;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.startsWith("ESTOQUE_INSUFICIENTE:")) {
      return NextResponse.json({ message: `Saldo insuficiente para ${message.split(":")[1]}. Atualize a lista e tente novamente.` }, { status: 409 });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return NextResponse.json({ message: "O estoque foi atualizado por outra solicitação. Atualize a lista e tente novamente." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível registrar a solicitação." }, { status: 500 });
  }
}
