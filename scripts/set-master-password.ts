import { loadEnvConfig } from "@next/env";
import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { validNewPassword, PASSWORD_POLICY_MESSAGE } from "../src/lib/password-policy";

loadEnvConfig(process.cwd());

async function main() {
  const password = process.env.ADMIN_PASSWORD;
  if (!validNewPassword(password)) {
    throw new Error(`Configure ADMIN_PASSWORD. ${PASSWORD_POLICY_MESSAGE}`);
  }

  const admin = await prisma.user.findUnique({ where: { login: "admin" }, select: { id: true, role: true } });
  if (!admin || admin.role !== UserRole.MASTER_ADMIN) {
    throw new Error("Não foi encontrado o utilizador admin com perfil MASTER_ADMIN.");
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.user.update({
    where: { id: admin.id },
    data: { passwordHash, mustChangePassword: false },
  });
  console.log("Senha do MASTER_ADMIN admin sincronizada; a senha em texto não foi exibida.");
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "Falha ao atualizar a senha do MASTER_ADMIN.");
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
