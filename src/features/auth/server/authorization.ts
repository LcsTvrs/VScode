import type { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getRequestAdminSession } from "./session";

type AccessOptions = {
  role?: UserRole;
  forbiddenMessage?: string;
  passwordMessage?: string;
  passwordCode?: string;
  headers?: Record<string, string>;
};
type Session = NonNullable<Awaited<ReturnType<typeof getRequestAdminSession>>>;
type AccessResult = { ok: true; session: Session } | { ok: false; response: NextResponse };

// Every call verifies the current database account. Middleware keeps its JWT
// check independent and must never import this server module.
export async function requireAdmin(request: Request, options: AccessOptions = {}): Promise<AccessResult> {
  const session = await getRequestAdminSession(request);
  const deny = (message: string, status: number, code?: string): AccessResult => ({
    ok: false,
    response: NextResponse.json({ message, ...(code ? { code } : {}) }, { status, headers: options.headers }),
  });
  if (!session) return deny("Sessão inválida.", 401);
  if (options.role && session.role !== options.role) {
    return deny(options.forbiddenMessage ?? "Acesso não permitido.", 403);
  }
  if (session.mustChangePassword) {
    return deny(options.passwordMessage ?? "Troque sua senha antes de continuar.", 403, options.passwordCode);
  }
  return { ok: true, session };
}
