import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_MAX_AGE,
  createAdminSession,
  isAdminLoginConfigured,
} from "@/lib/admin-session";

export const runtime = "nodejs";

function matchesPassword(provided: string, expected: string) {
  const providedHash = createHash("sha256").update(provided).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(providedHash, expectedHash);
}

export async function POST(request: Request) {
  if (!isAdminLoginConfigured()) {
    return NextResponse.json({ message: "Configure ADMIN_PASSWORD e ADMIN_SESSION_SECRET no ambiente." }, { status: 503 });
  }

  const body: unknown = await request.json().catch(() => null);
  const password = body && typeof body === "object" ? (body as Record<string, unknown>).password : null;
  if (typeof password !== "string" || password.length > 512) {
    return NextResponse.json({ message: "Informe a senha administrativa." }, { status: 400 });
  }

  const expectedPassword = process.env.ADMIN_PASSWORD!;
  if (!matchesPassword(password, expectedPassword)) {
    return NextResponse.json({ message: "Senha inválida." }, { status: 401 });
  }

  const token = await createAdminSession();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
    priority: "high",
  });
  return response;
}
