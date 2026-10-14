import { NextResponse } from "next/server";
import { csvDownload, type CsvValue } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const statusLabels = { PENDENTE: "Pendente", APROVADA: "Aprovada", RECUSADA: "Recusada" } as const;

export async function GET() {
  const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
  if (!store) return NextResponse.json({ message: "Nenhuma loja cadastrada." }, { status: 404 });

  const requests = await prisma.uniformRequest.findMany({
    where: { storeId: store.id },
    include: { employee: true, items: { include: { variant: true } } },
    orderBy: { createdAt: "asc" },
  });

  const rows: CsvValue[][] = [
    ["Código", "Data da solicitação", "Status", "Colaborador", "LDAP", "Loja", "Código da loja", "SKU", "Uniforme", "Categoria", "Cor", "Tamanho", "Quantidade", "Observação"],
    ...requests.flatMap((request) => request.items.map((item) => [
      request.code,
      request.createdAt,
      statusLabels[request.status],
      request.employee.name,
      request.employee.ldap,
      store.name,
      store.code,
      item.variant.sku,
      item.variant.name,
      item.variant.category,
      item.variant.color,
      item.variant.size,
      item.quantity,
      request.notes,
    ])),
  ];
  const day = new Date().toISOString().slice(0, 10);
  return csvDownload(rows, `historico-solicitacoes-${day}.csv`);
}
