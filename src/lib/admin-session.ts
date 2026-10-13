import { SignJWT } from "jose/jwt/sign";
import { jwtVerify } from "jose/jwt/verify";

export const ADMIN_SESSION_COOKIE = "uniformes-admin-session";
export const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8;

const issuer = "uniformes-inventory";
const audience = "uniformes-admin";

function getSessionKey() {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) return null;
  const key = new TextEncoder().encode(secret);
  if (key.byteLength < 32) return null;
  return key;
}

export function isAdminLoginConfigured() {
  const password = process.env.ADMIN_PASSWORD;
  return Boolean(password && password.length >= 20 && getSessionKey());
}

export async function createAdminSession() {
  const key = getSessionKey();
  if (!key) throw new Error("ADMIN_SESSION_NOT_CONFIGURED");

  return new SignJWT({ role: "admin" })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" })
    .setIssuer(issuer)
    .setAudience(audience)
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(key);
}

export async function verifyAdminSession(token: string | undefined) {
  const key = getSessionKey();
  if (!key || !token) return false;

  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
      issuer,
      audience,
    });
    return payload.role === "admin";
  } catch {
    return false;
  }
}
