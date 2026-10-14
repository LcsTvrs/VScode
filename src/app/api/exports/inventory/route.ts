import { NextResponse } from "next/server";
import { csvDownload, type CsvValue } from "@/lib/csv";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const store = await prisma.store.findFirst({ orderBy: { createdAt: "asc" } });
  if (!store) return NextResponse.json({ message: "Nenhuma loja cadastrada." }, { status: 404 });

  const stock = await prisma.stockLevel.findMany({
    where: { storeId: store.id },
    include: { variant: true },
    orderBy: [{ variant: { name: "asc" } }, { variant: { size: "asc" } }],
  });

  const rows: CsvValue[][] = [
    ["Loja", "Código da loja", "SKU", "Uniforme", "Categoria", "Cor", "Tamanho", "Quantidade disponível", "Estoque mínimo", "Atualizado em"],
    ...stock.map(({ variant, quantity, minimum, updatedAt }) => [
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
