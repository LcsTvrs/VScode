import { NextResponse } from "next/server";
import { csvDownload, type CsvValue } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { uniformGenderLabel } from "@/lib/uniform-gender";

export const dynamic = "force-dynamic";

const statusLabels = { PENDENTE: "Pendente", APROVADA: "Aprovada", RECUSADA: "Recusada" } as const;

export async function GET(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (session.mustChangePassword) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
  const requestedStoreId = new URL(request.url).searchParams.get("storeId");
  const storeId = session.role === "STORE_ADMIN" ? session.storeId : requestedStoreId;

  const requests = await prisma.uniformRequest.findMany({
    where: storeId ? { storeId } : undefined,
    include: { employee: true, store: true, items: { include: { variant: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rows: CsvValue[][] = [
    ["Código", "Data da solicitação", "Status", "Colaborador", "LDAP", "Loja", "Código da loja", "SKU", "Uniforme", "Categoria", "Classificação", "Cor", "Tamanho", "Quantidade", "Observação"],
    ...requests.flatMap((request) => request.items.map((item) => [
      request.code,
      request.createdAt,
      statusLabels[request.status],
      request.employee.name,
      request.employee.ldap,
      request.store.name,
      request.store.code,
      item.variant.sku,
      item.variant.name,
      item.variant.category,
      uniformGenderLabel(item.variant.gender),
      item.variant.color,
      item.variant.size,
      item.quantity,
      request.notes,
    ])),
  ];
  const day = new Date().toISOString().slice(0, 10);
  return csvDownload(rows, `historico-solicitacoes-${day}.csv`);
}
