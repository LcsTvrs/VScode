import { loadEnvConfig } from "@next/env";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";

loadEnvConfig(process.cwd());

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12 || password.length > 128) {
    throw new Error("Configure ADMIN_PASSWORD com 12 a 128 caracteres no ambiente.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.$transaction(async (tx) => {
    const users = await tx.user.count();
    if (users !== 0) {
      throw new Error("O banco já possui usuários; nenhum acesso foi criado.");
    }

    const [stores, employees, variants, stockLevels, movements, requests, requestItems] = await Promise.all([
      tx.store.count(),
      tx.employee.count(),
      tx.uniformVariant.count(),
      tx.stockLevel.count(),
      tx.stockMovement.count(),
      tx.uniformRequest.count(),
      tx.requestItem.count(),
    ]);
    if (stores + employees + variants + stockLevels + movements + requests + requestItems === 0) {
      throw new Error("O banco está vazio; use POST /api/setup para o provisionamento inicial.");
    }

    await tx.user.create({
      data: {
        login: "admin",
        passwordHash,
        role: UserRole.MASTER_ADMIN,
        storeId: null,
        mustChangePassword: false,
      },
    });
  }, { isolationLevel: "Serializable" });

  console.log("MASTER_ADMIN admin criado sem alterar os dados existentes. A senha não foi exibida.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Falha ao criar o MASTER_ADMIN.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
