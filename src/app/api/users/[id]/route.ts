import { requireMasterAdmin } from "@/features/auth/server/master-admin";
import { ADMIN_SESSION_COOKIE, createAdminSession, sessionCookieOptions } from "@/features/auth/session";
import { readJsonBody } from "@/lib/json-body";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const body: unknown = await readJsonBody(request);
  if (!body || typeof body !== "object") return NextResponse.json({ message: "Informe login e perfil." }, { status: 400 });
  const input = body as Record<string, unknown>;
  const login = typeof input.login === "string" ? input.login.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const role = input.role;
  if (!/^[a-z0-9._@+-]{2,254}$/.test(login) || (role !== UserRole.MASTER_ADMIN && role !== UserRole.STORE_ADMIN)) return NextResponse.json({ message: "Login ou perfil inválido." }, { status: 400 });
  if (name.length < 2 || name.length > 100) return NextResponse.json({ message: "Informe o nome do usuário com 2 a 100 caracteres." }, { status: 400 });
  if (id === auth.session.userId && role !== auth.session.role) return NextResponse.json({ message: "Não é permitido alterar o próprio perfil." }, { status: 409 });
  let storeId: string | null = null;
  if (role === UserRole.STORE_ADMIN) {
    if (typeof input.storeId !== "string" || !input.storeId) return NextResponse.json({ message: "Selecione a loja do STORE_ADMIN." }, { status: 400 });
    const store = await prisma.store.findUnique({ where: { id: input.storeId }, select: { id: true } });
    if (!store) return NextResponse.json({ message: "A loja selecionada não existe." }, { status: 404 });
    storeId = store.id;
  }
  try {
    const user = await prisma.user.update({ where: { id }, data: { login, name, role, storeId }, select: { id: true, login: true, name: true, role: true, storeId: true, mustChangePassword: true, passwordChangeDeadline: true, createdAt: true, updatedAt: true, store: { select: { name: true, code: true } } } });
    const response = NextResponse.json({ user: { ...user, isCurrentUser: id === auth.session.userId } }, { headers: { "Cache-Control": "no-store" } });
    if (id === auth.session.userId) {
      const token = await createAdminSession({ userId: user.id, login: user.login, role: user.role, storeId: user.storeId, mustChangePassword: user.mustChangePassword, passwordChangeDeadline: user.passwordChangeDeadline?.getTime() ?? null, userUpdatedAt: user.updatedAt.getTime() });
      response.cookies.set(ADMIN_SESSION_COOKIE, token, sessionCookieOptions());
    }
    return response;
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2025") return NextResponse.json({ message: "Utilizador não encontrado." }, { status: 404 });
      if (error.code === "P2002") return NextResponse.json({ message: "Este login já está cadastrado." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível atualizar o utilizador." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  if (id === auth.session.userId) return NextResponse.json({ message: "Não é permitido excluir o próprio utilizador." }, { status: 409 });
  try {
    await prisma.user.delete({ where: { id } });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2025") return NextResponse.json({ message: "Utilizador não encontrado." }, { status: 404 });
    return NextResponse.json({ message: "Não foi possível excluir o utilizador." }, { status: 500 });
  }
}
