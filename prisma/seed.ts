import { PrismaClient, UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { assertSafeSeed } from "../scripts/lib/seed-safety";
import { validNewPassword, PASSWORD_POLICY_MESSAGE } from "../src/features/auth/password-policy";

const prisma = new PrismaClient();

async function main() {
  assertSafeSeed(process.env);
  const password = process.env.ADMIN_PASSWORD;
  if (!validNewPassword(password)) throw new Error(`Configure ADMIN_PASSWORD. ${PASSWORD_POLICY_MESSAGE}`);
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.$transaction(async (tx) => {
    await tx.requestItem.deleteMany();
    await tx.uniformRequest.deleteMany();
    await tx.stockMovement.deleteMany();
    await tx.stockLevel.deleteMany();
    await tx.uniformVariant.deleteMany();
    await tx.uniformCatalog.deleteMany();
    await tx.uniformImage.deleteMany();
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
        name: "Administrador geral",
        passwordHash,
        role: UserRole.MASTER_ADMIN,
        storeId: null,
        mustChangePassword: true,
        passwordChangeDeadline: null,
      },
    });

    const variants = [
      { sku: "CAM-AZ-M", name: "Camiseta operacional", category: "CAMISETA", size: "M", color: "Azul marinho", quantity: 24, minimum: 5 },
      { sku: "CAL-CA-40", name: "Calça cargo", category: "CALCA", size: "40", color: "Caqui", quantity: 12, minimum: 3 },
    ];

    for (const item of variants) {
      await tx.uniformCatalog.create({ data: { sku: item.sku, name: item.name, sector: "Geral", category: item.category, size: item.size } });
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
