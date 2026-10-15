import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE, createAdminSession, sessionCookieOptions } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida. Entre novamente." }, { status: 401 });
  if (!session.mustChangePassword) return NextResponse.json({ message: "A troca obrigatória de senha já foi concluída." }, { status: 409 });

  const body: unknown = await request.json().catch(() => null);
  const password = body && typeof body === "object" ? (body as Record<string, unknown>).novaSenha : null;
  if (typeof password !== "string" || password.length < 12 || password.length > 128) {
    return NextResponse.json({ message: "A nova senha deve ter entre 12 e 128 caracteres." }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ message: "Usuário não encontrado. Entre novamente." }, { status: 401 });
  if (await bcrypt.compare(password, user.passwordHash)) {
    return NextResponse.json({ message: "Escolha uma senha diferente da atual." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, mustChangePassword: false },
  });
  const token = await createAdminSession({
    userId: updated.id,
    login: updated.login,
    role: updated.role,
    storeId: updated.storeId,
    mustChangePassword: false,
    userUpdatedAt: updated.updatedAt.getTime(),
  });

  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions());
  return response;
}
