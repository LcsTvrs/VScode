import { UserRole } from "@prisma/client";
import { NextResponse } from "next/server";
import { getRequestAdminSession } from "@/lib/admin-auth";
import type { AdminSession } from "@/lib/admin-session";

type MasterAdminResult =
  | { ok: true; session: AdminSession }
  | { ok: false; response: NextResponse };

export async function requireMasterAdmin(request: Request): Promise<MasterAdminResult> {
  const session = await getRequestAdminSession(request);
  if (!session) {
    return { ok: false, response: NextResponse.json({ message: "Sessão inválida." }, { status: 401 }) };
  }
  if (session.role !== UserRole.MASTER_ADMIN || session.mustChangePassword) {
    return { ok: false, response: NextResponse.json({ message: "Apenas MASTER_ADMIN pode executar esta ação." }, { status: 403 }) };
  }
  return { ok: true, session };
}
