import { readJsonBody } from "@/lib/json-body";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { ADMIN_SESSION_COOKIE, createAdminSession, sessionCookieOptions } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { validNewPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida. Entre novamente." }, { status: 401 });
  if (!session.mustChangePassword) return NextResponse.json({ message: "A troca obrigatória de senha já foi concluída." }, { status: 409 });

  const body: unknown = await readJsonBody(request);
  const password = body && typeof body === "object" ? (body as Record<string, unknown>).novaSenha : null;
  if (!validNewPassword(password)) {
    return NextResponse.json({ message: PASSWORD_POLICY_MESSAGE }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return NextResponse.json({ message: "Usuário não encontrado. Entre novamente." }, { status: 401 });
  if (user.updatedAt.getTime() !== session.userUpdatedAt || !user.mustChangePassword) return NextResponse.json({ message: "O acesso foi alterado. Entre novamente antes de trocar a senha." }, { status: 409 });
  if (await bcrypt.compare(password, user.passwordHash)) {
    return NextResponse.json({ message: "Escolha uma senha diferente da atual." }, { status: 400 });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const updatedAt = new Date(Math.max(Date.now(), user.updatedAt.getTime() + 1));
  const claimed = await prisma.user.updateMany({
    where: { id: user.id, updatedAt: user.updatedAt, mustChangePassword: true },
    data: { passwordHash, mustChangePassword: false, updatedAt },
  });
  if (claimed.count !== 1) return NextResponse.json({ message: "O acesso foi alterado por outra operação. Entre novamente." }, { status: 409 });
  const updated = { ...user, updatedAt };
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
