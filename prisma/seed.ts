import { PrismaClient, UniformCategory } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const store = await prisma.store.upsert({
    where: { code: "LM-SP-001" },
    update: {},
    create: {
      code: "LM-SP-001",
      name: "Leroy Merlin Morumbi",
      city: "São Paulo",
      state: "SP",
    },
  });

  const employee = await prisma.employee.upsert({
    where: { email: "marina.souza@exemplo.com" },
    update: { storeId: store.id },
    create: {
      name: "Marina Souza",
      email: "marina.souza@exemplo.com",
      role: "Administradora de loja",
      storeId: store.id,
    },
  });

  const variants = [
    { sku: "CAM-AZ-M", name: "Camiseta operacional", category: UniformCategory.CAMISETA, size: "M", color: "Azul marinho", quantity: 24 },
    { sku: "CAM-AZ-G", name: "Camiseta operacional", category: UniformCategory.CAMISETA, size: "G", color: "Azul marinho", quantity: 18 },
    { sku: "CAM-AZ-GG", name: "Camiseta operacional", category: UniformCategory.CAMISETA, size: "GG", color: "Azul marinho", quantity: 6 },
    { sku: "CAL-CA-40", name: "Calça cargo", category: UniformCategory.CALCA, size: "40", color: "Caqui", quantity: 12 },
    { sku: "CAL-CA-42", name: "Calça cargo", category: UniformCategory.CALCA, size: "42", color: "Caqui", quantity: 3 },
    { sku: "COL-VE-G", name: "Colete de atendimento", category: UniformCategory.COLETE, size: "G", color: "Verde", quantity: 9 },
    { sku: "JAQ-AZ-G", name: "Jaqueta", category: UniformCategory.JAQUETA, size: "G", color: "Azul marinho", quantity: 2 },
  ];

  for (const item of variants) {
    const variant = await prisma.uniformVariant.upsert({
      where: { sku: item.sku },
      update: {},
      create: {
        sku: item.sku,
        name: item.name,
        category: item.category,
        size: item.size,
        color: item.color,
      },
    });
    await prisma.stockLevel.upsert({
      where: { storeId_variantId: { storeId: store.id, variantId: variant.id } },
      update: {},
      create: { storeId: store.id, variantId: variant.id, quantity: item.quantity, minimum: 5 },
    });
  }

  await prisma.uniformRequest.upsert({
    where: { code: "SOL-2026-014" },
    update: {},
    create: {
      code: "SOL-2026-014",
      employeeId: employee.id,
      storeId: store.id,
      notes: "Reposição para início de temporada.",
      items: {
        create: [
          { variantId: (await prisma.uniformVariant.findUniqueOrThrow({ where: { sku: "CAM-AZ-GG" } })).id, quantity: 1 },
          { variantId: (await prisma.uniformVariant.findUniqueOrThrow({ where: { sku: "JAQ-AZ-G" } })).id, quantity: 1 },
        ],
      },
    },
  });
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
