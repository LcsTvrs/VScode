import type { UserRole } from "@prisma/client";
import { SignJWT, jwtVerify } from "jose";

export const ADMIN_SESSION_COOKIE = "uniformes-admin-session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

const issuer = "uniformes-inventory";
const audience = "uniformes-admin";

export type AdminSession = {
  userId: string;
  login: string;
  role: UserRole;
  storeId: string | null;
  mustChangePassword: boolean;
  passwordChangeDeadline?: number | null;
  userUpdatedAt: number;
};

function getSessionKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const key = new TextEncoder().encode(secret);
  return key.byteLength >= 32 ? key : null;
}

export async function createAdminSession(session: AdminSession) {
  const key = getSessionKey();
  if (!key) throw new Error("ADMIN_SESSION_NOT_CONFIGURED");

  return new SignJWT({
    login: session.login,
    role: session.role,
    storeId: session.storeId,
    mustChangePassword: session.mustChangePassword,
    passwordChangeDeadline: session.passwordChangeDeadline ?? null,
    userUpdatedAt: session.userUpdatedAt,
  })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setSubject(session.userId)
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key);
}

export async function verifyAdminSession(token: string | undefined): Promise<AdminSession | null> {
  const key = getSessionKey();
  if (!key || !token) return null;

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer,
      audience,
    });
    if (
      typeof payload.sub !== "string" ||
      typeof payload.login !== "string" ||
      (payload.role !== "MASTER_ADMIN" && payload.role !== "STORE_ADMIN") ||
      (payload.storeId !== null && typeof payload.storeId !== "string") ||
      typeof payload.mustChangePassword !== "boolean" ||
      typeof payload.userUpdatedAt !== "number" ||
      (payload.passwordChangeDeadline != null && (typeof payload.passwordChangeDeadline !== "number" || !Number.isFinite(payload.passwordChangeDeadline))) ||
      (payload.role === "STORE_ADMIN" && !payload.storeId)
    ) return null;

    return {
      userId: payload.sub,
      login: payload.login,
      role: payload.role,
      storeId: payload.storeId,
      mustChangePassword: payload.mustChangePassword,
      passwordChangeDeadline: typeof payload.passwordChangeDeadline === "number" ? payload.passwordChangeDeadline : null,
      userUpdatedAt: payload.userUpdatedAt,
    };
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict" as const,
    path: "/",
    maxAge: ADMIN_SESSION_MAX_AGE,
    priority: "high" as const,
  };
}

export function resolveStoreId(session: AdminSession, requestedStoreId?: unknown): string | null {
  if (session.role === "STORE_ADMIN") return session.storeId;
  return typeof requestedStoreId === "string" && requestedStoreId.length > 0 ? requestedStoreId : null;
}
