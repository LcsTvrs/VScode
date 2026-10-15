import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  const requestedStoreId = new URL(request.url).searchParams.get("storeId");
  const storeId = session.role === "STORE_ADMIN" ? session.storeId : requestedStoreId;
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
    }, { status: 404 });
  }

  const totalUnits = store.stockLevels.reduce((sum, stock) => sum + stock.quantity, 0);
  const lowStockCount = store.stockLevels.filter((stock) => stock.quantity <= stock.minimum).length;
  const pendingCount = await prisma.uniformRequest.count({
    where: { storeId: store.id, status: "PENDENTE" },
  });

  return NextResponse.json({
    role: session.role,
    store: { id: store.id, name: store.name, code: store.code, city: store.city, state: store.state },
    employees: store.employees,
    variants: store.stockLevels.map((stock) => ({
      id: stock.variant.id,
      sku: stock.variant.sku,
      name: stock.variant.name,
      category: stock.variant.category,
      size: stock.variant.size,
      color: stock.variant.color,
      quantity: stock.quantity,
      minimum: stock.minimum,
    })),
    requests: store.requests.map((request) => ({
      id: request.id,
      code: request.code,
      employee: request.employee.name,
      ldap: request.employee.ldap,
      status: request.status,
      createdAt: request.createdAt,
      itemCount: request.items.reduce((sum, item) => sum + item.quantity, 0),
      summary: request.items.map((item) => `${item.quantity}x ${item.variant.name} ${item.variant.size}`).join(", "),
    })),
    metrics: { totalUnits, lowStockCount, pendingCount, variantCount: store.stockLevels.length },
  });
}
