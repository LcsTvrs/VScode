import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requestDay } from "../date";

export const historyInclude = {
  store: { select: { id: true, code: true, name: true } },
  employee: { select: { name: true, ldap: true } },
  items: { select: { variantId: true, quantity: true, variant: { select: { name: true, sku: true, gender: true, size: true, color: true } } } },
} satisfies Prisma.UniformRequestInclude;

export function historyRow(row: Prisma.UniformRequestGetPayload<{ include: typeof historyInclude }>) {
  return {
    id: row.id, storeId: row.storeId, store: row.store, code: row.code,
    employee: row.employee.name, ldap: row.employee.ldap, status: row.status,
    createdAt: row.createdAt, updatedAt: row.updatedAt,
    itemCount: row.items.reduce((sum, item) => sum + item.quantity, 0),
    summary: row.items.map(item => `${item.quantity}x ${item.variant.name} ${item.variant.size}`).join(", "),
    items: row.items.map(item => ({ variantId: item.variantId, quantity: item.quantity, ...item.variant })),
  };
}

// Find the start of a civil day in São Paulo, including historical DST changes.
export function dayBoundary(day: string) {
  const utc = new Date(`${day}T00:00:00.000Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || !Number.isFinite(utc.getTime()) || utc.toISOString().slice(0, 10) !== day) throw new Error("Informe uma data válida.");
  let low = utc.getTime() - 12 * 3600000, high = utc.getTime() + 12 * 3600000;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (requestDay(new Date(middle)) < day) low = middle + 1;
    else high = middle;
  }
  return new Date(low);
}

export function historyQuery(params: URLSearchParams, storeId: string | null) {
  const status = params.get("status") || "";
  const search = (params.get("search") || "").trim();
  const start = params.get("start") || "", end = params.get("end") || "";
  const rawPage = params.get("page") || "1";
  if (!/^\d+$/.test(rawPage) || !Number.isSafeInteger(Number(rawPage)) || Number(rawPage) < 1 || Number(rawPage) > 1000000) throw new Error("Página inválida.");
  if (status && !["PENDENTE", "APROVADA", "RECUSADA"].includes(status)) throw new Error("Situação inválida.");
  if (search.length > 120) throw new Error("Use até 120 caracteres na busca.");
  const createdAt: Prisma.DateTimeFilter = {};
  if (start) createdAt.gte = dayBoundary(start);
  if (end) {
    dayBoundary(end);
    const next = new Date(`${end}T12:00:00Z`);
    next.setUTCDate(next.getUTCDate() + 1);
    createdAt.lt = dayBoundary(next.toISOString().slice(0, 10));
  }
  if (start && end && start > end) throw new Error("A data final deve ser igual ou posterior à inicial.");
  const scope: Prisma.UniformRequestWhereInput = storeId ? { storeId } : {};
  const where: Prisma.UniformRequestWhereInput = { ...scope,
    ...(status ? { status: status as "PENDENTE" | "APROVADA" | "RECUSADA" } : {}),
    ...(start || end ? { createdAt } : {}),
    ...(search ? { employee: { OR: [{ name: { contains: search, mode: "insensitive" } }, { ldap: { contains: search } }] } } : {}),
  };
  return { scope, where, page: Number(rawPage) };
}

export async function readHistory(query: ReturnType<typeof historyQuery>) {
  // Count and page use one snapshot, so concurrent decisions cannot mix totals.
  return prisma.$transaction(async tx => {
    const total = await tx.uniformRequest.count({ where: query.scope });
    const filteredTotal = await tx.uniformRequest.count({ where: query.where });
    const pageSize = 25;
    const pages = Math.max(1, Math.ceil(filteredTotal / pageSize));
    const page = Math.min(query.page, pages);
    const rows = await tx.uniformRequest.findMany({ where: query.where, include: historyInclude,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: pageSize, skip: (page - 1) * pageSize });
    return { requests: rows.map(historyRow), total, filteredTotal, page, pages, pageSize };
  }, { isolationLevel: "RepeatableRead" });
}
