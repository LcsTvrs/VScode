import { isPasswordChangeOverdue } from "@/lib/password-change-window";
import { NextResponse } from "next/server";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { confirmInventoryImport } from "@/lib/inventory-import";
import { boundedImportRequest, importErrorResponse } from "@/lib/inventory-import-http";
import { InventoryImportError } from "@/lib/inventory-import-types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const session = await getRequestAdminSession(request);
    if (!session) throw new InventoryImportError("Sessão inválida.", 401);
    if (isPasswordChangeOverdue(session)) throw new InventoryImportError("Troque sua senha antes de importar.", 403);
    const body = await (await boundedImportRequest(request, 200_000)).json().catch(() => null);
    if (!body || typeof body !== "object") throw new InventoryImportError("Dados de confirmação inválidos.");
    return NextResponse.json(await confirmInventoryImport(session, body.token, body.reviewedVariantIds), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return importErrorResponse(error); }
}
