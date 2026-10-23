import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { requireMasterAdmin } from "@/lib/master-admin";
import { prisma } from "@/lib/prisma";
import { generateTemporaryPassword } from "@/lib/temporary-password";
import { newPasswordChangeDeadline } from "@/lib/password-change-window";
import { ADMIN_SESSION_COOKIE, createAdminSession, sessionCookieOptions } from "@/lib/admin-session";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const target = await prisma.user.findUnique({ where: { id }, select: { id: true, login: true, role: true, storeId: true } });
  if (!target) return NextResponse.json({ message: "Utilizador não encontrado." }, { status: 404 });
  const temporaryPassword = generateTemporaryPassword(10);
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  const user = await prisma.user.update({ where: { id }, data: { passwordHash, mustChangePassword: true, passwordChangeDeadline: newPasswordChangeDeadline() }, select: { id: true, login: true, role: true, storeId: true, mustChangePassword: true, passwordChangeDeadline: true, updatedAt: true } });
  const response = NextResponse.json({ temporaryPassword, selfReset: id === auth.session.userId }, { headers: { "Cache-Control": "no-store" } });
  if (id === auth.session.userId) {
    const token = await createAdminSession({ userId: user.id, login: user.login, role: user.role, storeId: user.storeId, mustChangePassword: true, passwordChangeDeadline: user.passwordChangeDeadline?.getTime() ?? null, userUpdatedAt: user.updatedAt.getTime() });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions());
  }
  return response;
}
