import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await prisma.store.findFirst({
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
    return NextResponse.json({ message: "Nenhuma loja cadastrada." }, { status: 404 });
  }

  const totalUnits = store.stockLevels.reduce((sum, stock) => sum + stock.quantity, 0);
  const lowStockCount = store.stockLevels.filter((stock) => stock.quantity <= stock.minimum).length;
  const pendingCount = await prisma.uniformRequest.count({
    where: { storeId: store.id, status: "PENDENTE" },
  });

  return NextResponse.json({
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
