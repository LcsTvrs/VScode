import { NextResponse } from "next/server";
import { csvDownload, type CsvValue } from "@/lib/csv";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  const requestedStoreId = new URL(request.url).searchParams.get("storeId");
  const storeId = session.role === "STORE_ADMIN" ? session.storeId : requestedStoreId;

  const stock = await prisma.stockLevel.findMany({
    where: storeId ? { storeId } : undefined,
    include: { variant: true, store: true },
    orderBy: [{ variant: { name: "asc" } }, { variant: { size: "asc" } }],
  });

  const rows: CsvValue[][] = [
    ["Loja", "Código da loja", "SKU", "Uniforme", "Categoria", "Cor", "Tamanho", "Quantidade disponível", "Estoque mínimo", "Atualizado em"],
    ...stock.map(({ variant, quantity, minimum, updatedAt, store }) => [
      store.name,
      store.code,
      variant.sku,
      variant.name,
      variant.category,
      variant.color,
      variant.size,
      quantity,
      minimum,
      updatedAt,
    ]),
  ];
  const day = new Date().toISOString().slice(0, 10);
  return csvDownload(rows, `estoque-${day}.csv`);
}
