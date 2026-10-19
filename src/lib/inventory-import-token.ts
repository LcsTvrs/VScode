import { randomUUID } from "node:crypto";
import { jwtVerify, SignJWT } from "jose";
import type { AdminSession } from "./admin-session";
import { IMPORT_MAX_QUANTITY, IMPORT_MAX_ROWS, InventoryImportError } from "./inventory-import-types";

export type ImportSnapshot = {
  variantId: string;
  stockId: string;
  sku: string;
  quantity: number;
  currentQuantity: number;
  updatedAt: string;
};
const audience = "uniformes-inventory-import";
const issuer = "uniformes-inventory";

function key() {
  const secret = new TextEncoder().encode(process.env.ADMIN_SESSION_SECRET ?? "");
  if (secret.byteLength < 32) throw new Error("ADMIN_SESSION_NOT_CONFIGURED");
  return secret;
}

export async function signImportPreview(session: AdminSession, storeId: string, rows: ImportSnapshot[]) {
  const expires = Math.floor(Date.now() / 1000) + 15 * 60;
  const token = await new SignJWT({ storeId, userUpdatedAt: session.userUpdatedAt, rows })
    .setProtectedHeader({ alg: "HS256", typ: "JWT" }).setIssuer(issuer).setAudience(audience)
    .setSubject(session.userId).setJti(randomUUID()).setIssuedAt().setExpirationTime(expires).sign(key());
  return { token, expiresAt: new Date(expires * 1000).toISOString() };
}

export async function verifyImportPreview(token: unknown, session: AdminSession) {
  const invalid = () => new InventoryImportError("A prévia expirou ou é inválida. Gere uma nova prévia e confira os itens novamente.", 409);
  if (typeof token !== "string" || token.length > 150_000) throw invalid();
  try {
    // An expired preview may only retrieve an existing receipt, never add stock.
    // Keep receipt lookup possible for the lifetime of the admin session.
    const { payload } = await jwtVerify(token, key(), { issuer, audience, algorithms: ["HS256"], clockTolerance: 8 * 60 * 60 });
    if (payload.sub !== session.userId || payload.userUpdatedAt !== session.userUpdatedAt || typeof payload.exp !== "number" || typeof payload.storeId !== "string" || !payload.storeId || typeof payload.jti !== "string" || !/^[\da-f-]{36}$/.test(payload.jti) || !Array.isArray(payload.rows) || !payload.rows.length || payload.rows.length > IMPORT_MAX_ROWS) throw invalid();
    if (session.role === "STORE_ADMIN" && payload.storeId !== session.storeId) throw invalid();
    const rows = payload.rows as ImportSnapshot[];
    if (rows.some((row) => !row || typeof row.variantId !== "string" || typeof row.stockId !== "string" || typeof row.sku !== "string" || !Number.isInteger(row.quantity) || row.quantity < 1 || !Number.isInteger(row.currentQuantity) || row.currentQuantity < 0 || row.currentQuantity + row.quantity > IMPORT_MAX_QUANTITY || typeof row.updatedAt !== "string" || !Number.isFinite(Date.parse(row.updatedAt))) || new Set(rows.map((row) => row.variantId)).size !== rows.length) throw invalid();
    return { importId: payload.jti, storeId: payload.storeId, rows, expiresAt: payload.exp * 1000 };
  } catch { throw invalid(); }
}
