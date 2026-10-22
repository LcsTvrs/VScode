import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (session.mustChangePassword) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
  const requestedStoreId = new URL(request.url).searchParams.get("storeId");
  const storeId = session.role === "STORE_ADMIN" ? session.storeId : requestedStoreId;
  const availableStores = session.role === "MASTER_ADMIN"
    ? await prisma.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } })
    : [];
  if (session.role === "MASTER_ADMIN" && !requestedStoreId) {
    return NextResponse.json({
      code: "STORE_SELECTION_REQUIRED",
      account: { login: session.login, name: session.name, role: session.role },
      availableStores,
    });
  }
  if (session.role === "STORE_ADMIN" && !session.storeId) {
    return NextResponse.json({
      code: "STORE_NOT_CONFIGURED",
      message: "Sua conta precisa ser vinculada a uma loja.",
      account: { login: session.login, name: session.name, role: session.role },
      availableStores,
    }, { status: 404 });
  }
  if (session.role === "MASTER_ADMIN" && !availableStores.some((store) => store.id === requestedStoreId)) {
    return NextResponse.json({ message: "Loja não encontrada." }, { status: 404 });
  }
  const store = await prisma.store.findFirst({
    where: storeId ? { id: storeId } : undefined,
    orderBy: { createdAt: "asc" },
    include: {
      stockLevels: {
        include: { variant: true },
        orderBy: { variant: { name: "asc" } },
      },
      requests: {
        include: {
          employee: true,
          items: { include: { variant: true } },
        },
        orderBy: { createdAt: "desc" },
      },
      employees: { orderBy: { name: "asc" } },
    },
  });

  if (!store) {
    return NextResponse.json({
      code: "STORE_NOT_CONFIGURED",
      message: "Cadastre a loja para começar a configurar o estoque.",
      account: { login: session.login, name: session.name, role: session.role },
      availableStores,
    }, { status: 404 });
  }

  const totalUnits = store.stockLevels.reduce((sum, stock) => sum + stock.quantity, 0);
  const lowStockCount = store.stockLevels.filter((stock) => stock.quantity <= stock.minimum).length;
  const pendingCount = await prisma.uniformRequest.count({
    where: { storeId: store.id, status: "PENDENTE" },
  });

  return NextResponse.json({
    role: session.role,
    account: { login: session.login, name: session.name, role: session.role },
    availableStores,
    store: { id: store.id, name: store.name, code: store.code, city: store.city, state: store.state },
    employees: store.employees,
    variants: store.stockLevels.map((stock) => ({
      id: stock.variant.id,
      sku: stock.variant.sku,
      name: stock.variant.name,
      category: stock.variant.category,
      gender: stock.variant.gender,
      imageId: stock.variant.imageId ?? null,
      size: stock.variant.size,
      color: stock.variant.color,
      quantity: stock.quantity,
      minimum: stock.minimum,
      updatedAt: stock.updatedAt.toISOString(),
    })),
    requests: store.requests.map((request) => ({
      id: request.id,
      code: request.code,
      employee: request.employee.name,
      ldap: request.employee.ldap,
      status: request.status,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      itemCount: request.items.reduce((sum, item) => sum + item.quantity, 0),
      summary: request.items.map((item) => `${item.quantity}x ${item.variant.name} ${item.variant.size}`).join(", "),
      items: request.items.map((item) => ({
        variantId: item.variantId, name: item.variant.name, sku: item.variant.sku,
        gender: item.variant.gender, size: item.variant.size, color: item.variant.color, quantity: item.quantity,
      })),
    })),
    metrics: { totalUnits, lowStockCount, pendingCount, variantCount: store.stockLevels.length },
  });
}
