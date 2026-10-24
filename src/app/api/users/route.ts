import { requireAdmin } from "@/features/auth/server/authorization";
import { generateTemporaryPassword } from "@/features/auth/server/temporary-password";
import { readJsonBody } from "@/lib/json-body";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

async function masterAdminAuthorization(request: Request) {
  const auth = await requireAdmin(request, {
    role: "MASTER_ADMIN",
    forbiddenMessage: "Apenas MASTER_ADMIN pode gerir utilizadores.",
    passwordMessage: "Apenas MASTER_ADMIN pode gerir utilizadores.",
  });
  return auth.ok ? { session: auth.session, response: null } : { session: null, response: auth.response };
}

export async function GET(request: Request) {
  const authorization = await masterAdminAuthorization(request);
  if (authorization.response) return authorization.response;

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      login: true,
      name: true,
      role: true,
      storeId: true,
      mustChangePassword: true,
      createdAt: true,
      store: { select: { name: true, code: true } },
    },
  });
  return NextResponse.json({ users: users.map((user) => ({ ...user, isCurrentUser: user.id === authorization.session?.userId })) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const authorization = await masterAdminAuthorization(request);
  if (authorization.response) return authorization.response;

  const body: unknown = await readJsonBody(request);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Informe login e perfil." }, { status: 400 });
  }
  const input = body as Record<string, unknown>;
  const login = typeof input.login === "string" ? input.login.trim().toLowerCase() : "";
  const name = typeof input.name === "string" ? input.name.trim().replace(/\s+/g, " ") : "";
  const role = input.role;
  if (!/^[a-z0-9._@+-]{2,254}$/.test(login) || (role !== "MASTER_ADMIN" && role !== "STORE_ADMIN")) {
    return NextResponse.json({ message: "Informe um login válido e um perfil permitido." }, { status: 400 });
  }
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ message: "Informe o nome do usuário com 2 a 100 caracteres." }, { status: 400 });
  }

  let storeId: string | null = null;
  if (role === "STORE_ADMIN") {
    if (typeof input.storeId !== "string" || !input.storeId) {
      return NextResponse.json({ message: "Selecione a loja do STORE_ADMIN." }, { status: 400 });
    }
    const store = await prisma.store.findUnique({ where: { id: input.storeId }, select: { id: true } });
    if (!store) return NextResponse.json({ message: "A loja selecionada não existe." }, { status: 404 });
    storeId = store.id;
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);
  try {
    const user = await prisma.user.create({
      data: { login, name, role, storeId, passwordHash, mustChangePassword: true, passwordChangeDeadline: null },
      select: {
        id: true,
        login: true,
        name: true,
        role: true,
        storeId: true,
        mustChangePassword: true,
        createdAt: true,
        store: { select: { name: true, code: true } },
      },
    });
    return NextResponse.json({ user, temporaryPassword }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") {
      return NextResponse.json({ message: "Este login já está cadastrado." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível criar o utilizador." }, { status: 500 });
  }
}
