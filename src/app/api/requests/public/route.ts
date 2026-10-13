import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RequestItemInput = { variantId: string; quantity: number };

export async function GET() {
  const store = await prisma.store.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true },
  });

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
    variants: stockLevels.map(({ variant, quantity }) => ({
      id: variant.id,
      name: variant.name,
      category: variant.category,
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
  const ldap = typeof input.ldap === "string" ? input.ldap.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const items = input.items;

  if (
    !/^[a-z0-9._-]{2,64}$/.test(ldap) ||
    name.length < 2 ||
    name.length > 100 ||
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
    return NextResponse.json({ message: "Informe LDAP, nome e pelo menos um uniforme com quantidade válida." }, { status: 400 });
  }

  const aggregatedItems = new Map<string, number>();
  for (const item of items) {
    aggregatedItems.set(item.variantId, (aggregatedItems.get(item.variantId) ?? 0) + item.quantity);
  }
  if ([...aggregatedItems.values()].some((quantity) => quantity > 20)) {
    return NextResponse.json({ message: "A quantidade por uniforme não pode passar de 20 peças." }, { status: 400 });
  }

  const store = await prisma.store.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });
  if (!store) return NextResponse.json({ message: "Nenhuma loja cadastrada." }, { status: 404 });

  try {
    const created = await prisma.$transaction(async (tx) => {
      const requestedVariants = [...aggregatedItems.entries()];
      const stockLevels = await tx.stockLevel.findMany({
        where: {
          storeId: store.id,
          variantId: { in: requestedVariants.map(([variantId]) => variantId) },
        },
        include: { variant: true },
      });
      const stockByVariant = new Map(stockLevels.map((stock) => [stock.variantId, stock]));
      const pendingItems = await tx.requestItem.groupBy({
        by: ["variantId"],
        where: {
          variantId: { in: requestedVariants.map(([variantId]) => variantId) },
          request: { storeId: store.id, status: "PENDENTE" },
        },
        _sum: { quantity: true },
      });
      const pendingByVariant = new Map(pendingItems.map((item) => [item.variantId, item._sum.quantity ?? 0]));

      for (const [variantId, quantity] of requestedVariants) {
        const stock = stockByVariant.get(variantId);
        const available = (stock?.quantity ?? 0) - (pendingByVariant.get(variantId) ?? 0);
        if (!stock || available < quantity) {
          throw new Error(`ESTOQUE_INSUFICIENTE:${stock?.variant.name ?? "item selecionado"}`);
        }
      }

      const employee = await tx.employee.upsert({
        where: { ldap },
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
