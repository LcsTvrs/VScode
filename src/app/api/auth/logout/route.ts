import { ADMIN_SESSION_COOKIE } from "@/features/auth/session";
import { NextResponse } from "next/server";

export async function POST() {
  const response = NextResponse.json({ ok: true, authenticated: false }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: 0,
  });
  return response;
}
