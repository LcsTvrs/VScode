import { requireAdmin } from "@/features/auth/server/authorization";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAdmin(request, {"passwordMessage":"Troque sua senha temporária para acessar o painel.","passwordCode":"PASSWORD_CHANGE_REQUIRED"});
  if (!auth.ok) return auth.response;
  const { session } = auth;
  const account = {
    login: session.login, name: session.name, role: session.role,
    mustChangePassword: session.mustChangePassword,
    passwordChangeDeadline: session.passwordChangeDeadline ? new Date(session.passwordChangeDeadline).toISOString() : null,
  };
  const params = new URL(request.url).searchParams;
  const compact = params.get("compact") === "1";
  const requestedStoreId = params.get("storeId");
  const storeId = session.role === "STORE_ADMIN" ? session.storeId : requestedStoreId;
  const availableStores = session.role === "MASTER_ADMIN"
    ? await prisma.store.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true, code: true } })
    : [];
  if (session.role === "STORE_ADMIN" && !session.storeId) {
    return NextResponse.json({
      code: "STORE_NOT_CONFIGURED",
      message: "Sua conta precisa ser vinculada a uma loja.",
      account,
      availableStores,
    }, { status: 404 });
  }
  if (session.role === "MASTER_ADMIN" && requestedStoreId && !availableStores.some((store) => store.id === requestedStoreId)) {
    return NextResponse.json({ message: "Loja não encontrada." }, { status: 404 });
  }
  const include = {
      stockLevels: {
        include: { variant: { include: { catalog: { select: { updatedAt: true } } } } },
        orderBy: { variant: { name: "asc" } },
      },
      requests: {
        include: {
          employee: { select: { name: true, ldap: true } },
          items: { select: { variantId: true, quantity: true, variant: { select: { name: true, size: true, sku: true, gender: true, color: true } } } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        ...(compact ? { where: { status: "PENDENTE" as const }, take: 4 } : {}),
      },
      employees: compact ? false : { orderBy: { name: "asc" }, select: { id: true, name: true, ldap: true, email: true } },
  } satisfies Prisma.StoreInclude;
  const stores = storeId
    ? [await prisma.store.findFirst({ where: { id: storeId }, include })].filter((store): store is NonNullable<typeof store> => !!store)
    : await prisma.store.findMany({ orderBy: { name: "asc" }, include });
  const store = stores[0];

  if (storeId && !store) {
    return NextResponse.json({
      code: "STORE_NOT_CONFIGURED",
      message: "Cadastre a loja para começar a configurar o estoque.",
      account,
      availableStores,
    }, { status: 404 });
  }

  const stocks = stores.flatMap(store => store.stockLevels.map(stock => ({ ...stock, owner: { id: store.id, code: store.code, name: store.name } })));
  const requests = stores.flatMap(store => store.requests.map(request => ({ ...request, owner: { id: store.id, code: store.code, name: store.name } }))).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const totalUnits = stocks.reduce((sum, stock) => sum + stock.quantity, 0);
  const lowStockCount = stocks.filter(stock => stock.quantity <= stock.minimum).length;
  const pendingCount = compact ? await prisma.uniformRequest.count({ where: { ...(storeId ? { storeId } : {}), status: "PENDENTE" } }) : requests.filter(request => request.status === "PENDENTE").length;
  return NextResponse.json({
    scope: storeId ? "store" : "all",
    ...(compact ? { historyMode: "paged", employeesDeferred: true } : {}),
    role: session.role,
    account,
    availableStores,
    store: storeId && store ? { id: store.id, name: store.name, code: store.code, city: store.city, state: store.state } : { id: "", name: "Todas as lojas", code: "", city: "", state: "" },
    employees: compact ? [] : stores.flatMap(store => store.employees.map(employee => ({ ...employee, storeId: store.id }))),
    variants: stocks.map((stock) => ({
      id: stock.variant.id,
      storeId: stock.owner.id,
      store: stock.owner,
      sku: stock.variant.sku,
      catalogUpdatedAt: stock.variant.catalog?.updatedAt.toISOString(),
      name: stock.variant.name,
      category: stock.variant.category,
      sector: stock.variant.sector,
      gender: stock.variant.gender,
      imageId: stock.variant.imageId ?? null,
      size: stock.variant.size,
      color: stock.variant.color,
      quantity: stock.quantity,
      minimum: stock.minimum,
      updatedAt: stock.updatedAt.toISOString(),
    })),
    requests: (compact ? requests.slice(0, 4) : requests).map((request) => ({
      id: request.id,
      storeId: request.owner.id,
      store: request.owner,
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
    metrics: { totalUnits, lowStockCount, pendingCount, variantCount: stocks.length },
  });
}
