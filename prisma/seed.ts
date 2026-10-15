import { PrismaClient, UniformCategory, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error("Seed destrutiva bloqueada em produção. Defina ALLOW_DESTRUCTIVE_SEED=true apenas se pretende apagar todos os dados.");
  }

  const passwordHash = await bcrypt.hash("admin123", 12);

  await prisma.$transaction(async (tx) => {
    await tx.requestItem.deleteMany();
    await tx.uniformRequest.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.stockLevel.deleteMany();
    await tx.uniformVariant.deleteMany();
    await tx.employee.deleteMany();
    await tx.user.deleteMany();
    await tx.store.deleteMany();

    const store = await tx.store.create({
      data: {
        code: "LM-SP-001",
        name: "Leroy Merlin Morumbi",
        city: "São Paulo",
        state: "SP",
      },
    });

    await tx.user.create({
      data: {
        login: "admin",
        passwordHash,
        role: UserRole.MASTER_ADMIN,
        storeId: store.id,
        mustChangePassword: false,
      },
    });

    const variants = [
      { sku: "CAM-AZ-M", name: "Camiseta operacional", category: UniformCategory.CAMISETA, size: "M", color: "Azul marinho", quantity: 24, minimum: 5 },
      { sku: "CAL-CA-40", name: "Calça cargo", category: UniformCategory.CALCA, size: "40", color: "Caqui", quantity: 12, minimum: 3 },
    ];

    for (const item of variants) {
      const variant = await tx.uniformVariant.create({
        data: {
          storeId: store.id,
          sku: item.sku,
          name: item.name,
          category: item.category,
          size: item.size,
          color: item.color,
        },
      });

      await tx.stockLevel.create({
        data: {
          storeId: store.id,
          variantId: variant.id,
          quantity: item.quantity,
          minimum: item.minimum,
        },
      });

      await tx.stockMovement.create({
        data: {
          storeId: store.id,
          variantId: variant.id,
          type: "ENTRADA",
          quantity: item.quantity,
          note: "Saldo inicial de demonstração criado pelo seed",
        },
      });
    }
  });

  console.log("Seed concluída: loja, admin e duas variantes de demonstração criadas.");
}

main()
  .then(async () => prisma.$disconnect())
  .catch(async (error: unknown) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
