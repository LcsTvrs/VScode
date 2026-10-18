import { loadEnvConfig } from "@next/env";
import { UserRole } from "@prisma/client";
import { prisma } from "../src/lib/prisma";

loadEnvConfig(process.cwd());

async function main() {
  const [users, masterAdmins, admin, stores, employees, variants, stockLevels, movements, requests, requestItems] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { role: UserRole.MASTER_ADMIN } }),
    prisma.user.findUnique({ where: { login: "admin" }, select: { role: true } }),
    prisma.store.count(),
    prisma.employee.count(),
    prisma.uniformVariant.count(),
    prisma.stockLevel.count(),
    prisma.stockMovement.count(),
    prisma.uniformRequest.count(),
    prisma.requestItem.count(),
  ]);

  console.log(JSON.stringify({
    users,
    masterAdmins,
    adminRole: admin?.role ?? null,
    stores,
    hasBusinessData: employees + variants + stockLevels + movements + requests + requestItems > 0,
  }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Falha ao consultar o banco.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
