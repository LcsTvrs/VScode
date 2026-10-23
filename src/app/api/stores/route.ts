import { isPasswordChangeOverdue } from "@/lib/password-change-window";
import { readJsonBody } from "@/lib/json-body";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

import { parseStoreLocation } from "@/lib/store-input";

export const runtime = "nodejs";

async function masterAdminError(request: Request): Promise<NextResponse | null> {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (isPasswordChangeOverdue(session)) return NextResponse.json({ message: "Troque sua senha antes de continuar." }, { status: 403 });
  if (session.role !== "MASTER_ADMIN") {
    return NextResponse.json({ message: "Apenas MASTER_ADMIN pode gerir lojas." }, { status: 403 });
  }
  return null;
}

export async function GET(request: Request) {
  const denied = await masterAdminError(request);
  if (denied) return denied;

  const stores = await prisma.store.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, code: true, name: true, city: true, state: true, createdAt: true },
  });
  return NextResponse.json({ stores }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const denied = await masterAdminError(request);
  if (denied) return denied;

  const body: unknown = await readJsonBody(request);
  const name = body && typeof body === "object" && typeof (body as Record<string, unknown>).name === "string"
    ? ((body as Record<string, string>).name).trim()
    : "";
  if (name.length < 2 || name.length > 100) {
    return NextResponse.json({ message: "O nome da loja deve ter entre 2 e 100 caracteres." }, { status: 400 });
  }

  const location = parseStoreLocation(body as Record<string, unknown>);
  if (!location) return NextResponse.json({ message: "Informe cidade (2 a 100 caracteres) e uma UF brasileira válida." }, { status: 400 });

  const code = `LOJA-${randomBytes(5).toString("hex").toUpperCase()}`;
  const store = await prisma.store.create({
    data: { code, name, ...location },
    select: { id: true, code: true, name: true, city: true, state: true, createdAt: true },
  });
  return NextResponse.json({ store }, { status: 201, headers: { "Cache-Control": "no-store" } });
}
