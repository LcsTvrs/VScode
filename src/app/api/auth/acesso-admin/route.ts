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

export async function GET(request: Request) {
  if (!isAdminLoginConfigured()) {
    return NextResponse.json(
      { message: "Configure ADMIN_PASSWORD e ADMIN_SESSION_SECRET no ambiente." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const match = /^Basic\s+([A-Za-z0-9+/]+={0,2})$/i.exec(authorization);
  if (!match) {
    return NextResponse.json(
      { message: "Informe as credenciais administrativas." },
      { status: 401, headers: { "Cache-Control": "no-store", Vary: "Authorization" } },
    );
  }

  let credentials: string;
  try {
    credentials = Buffer.from(match[1], "base64").toString("utf8");
  } catch {
    return NextResponse.json({ message: "Credenciais inválidas." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }
  const separator = credentials.indexOf(":");
  const username = separator < 0 ? "" : credentials.slice(0, separator);
  const password = separator < 0 ? "" : credentials.slice(separator + 1);
  if (username !== "admin" || password.length > 512) {
    return NextResponse.json({ message: "Credenciais inválidas." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const expectedPassword = process.env.ADMIN_PASSWORD!;
  if (!matchesPassword(password, expectedPassword)) {
    return NextResponse.json({ message: "Credenciais inválidas." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  }

  const token = await createAdminSession();
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store", Vary: "Authorization" } });
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