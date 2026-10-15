import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSession, sessionCookieOptions } from "@/lib/admin-session";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Informe login e senha." }, { status: 400, headers: { "Cache-Control": "no-store" } });
  }

  const input = body as Record<string, unknown>;
  const login = typeof input.login === "string" ? input.login.trim() : "";
  const password = typeof input.senha === "string" ? input.senha : "";
  if (!login || login.length > 254 || !password || password.length > 512) {
    return NextResponse.json({ message: "Credenciais inválidas." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const user = await prisma.user.findUnique({ where: { login } });
  const validPassword = user ? await bcrypt.compare(password, user.passwordHash) : false;
  const validMembership = Boolean(user && (user.role !== "STORE_ADMIN" || user.storeId));
  if (!user || !validPassword || !validMembership) {
    return NextResponse.json({ message: "Login ou senha inválidos." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  try {
    const token = await createAdminSession({
      userId: user.id,
      login: user.login,
      role: user.role,
      storeId: user.storeId,
      mustChangePassword: user.mustChangePassword,
      userUpdatedAt: user.updatedAt.getTime(),
    });
    const response = NextResponse.json({ ok: true, mustChangePassword: user.mustChangePassword }, { headers: { "Cache-Control": "no-store" } });
    response.cookies.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions());
    return response;
  } catch {
    return NextResponse.json({ message: "A autenticação não está configurada corretamente." }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
