import { UserRole } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureUserNameColumn } from "@/lib/ensure-user-name-column";

export const runtime = "nodejs";

export async function POST() {
  // This must remain the first database operation in the bootstrap endpoint.
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    return NextResponse.json({ message: "O provisionamento inicial já foi utilizado." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  await ensureUserNameColumn();

  const login = "admin";
  const password = process.env.ADMIN_PASSWORD;
  if (!password || password.length < 12 || password.length > 128) {
    return NextResponse.json({ message: "Configure ADMIN_PASSWORD com 12 a 128 caracteres antes do provisionamento." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  const passwordHash = await bcrypt.hash(password, 12);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const userCountInTransaction = await tx.user.count();
      if (userCountInTransaction > 0) throw new Error("SETUP_ALREADY_USED");

      const [storeCount, employeeCount, variantCount, stockCount, movementCount, requestCount, requestItemCount] = await Promise.all([
        tx.store.count(),
        tx.employee.count(),
        tx.uniformVariant.count(),
        tx.stockLevel.count(),
        tx.stockMovement.count(),
        tx.uniformRequest.count(),
        tx.requestItem.count(),
      ]);
      if (storeCount + employeeCount + variantCount + stockCount + movementCount + requestCount + requestItemCount > 0) {
        throw new Error("DATABASE_NOT_EMPTY");
      }

      const store = await tx.store.create({
        data: { code: "LM-PRINCIPAL", name: "Loja Principal", city: "A definir", state: "NA" },
        select: { id: true, code: true, name: true },
      });
      await tx.user.create({
        data: {
          login,
          name: "Administrador geral",
          passwordHash,
          role: UserRole.MASTER_ADMIN,
          storeId: null,
          mustChangePassword: false,
        },
      });
      return store;
    }, { isolationLevel: "Serializable" });

    return NextResponse.json({ ok: true, login, store: result }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof Error && (error.message === "SETUP_ALREADY_USED" || error.message === "DATABASE_NOT_EMPTY")) {
      return NextResponse.json({ message: "O provisionamento só é permitido quando o banco está vazio." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      return NextResponse.json({ message: "O provisionamento foi iniciado por outra requisição." }, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ message: "Não foi possível concluir o provisionamento inicial." }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
