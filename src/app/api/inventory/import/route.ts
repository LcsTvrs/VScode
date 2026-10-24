import { requireAdmin } from "@/features/auth/server/authorization";
import { InventoryImportError } from "@/features/inventory/import-types";
import { confirmInventoryImport } from "@/features/inventory/server/import";
import { boundedImportRequest, importErrorResponse } from "@/features/inventory/server/import-http";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request, { passwordMessage: "Troque sua senha antes de importar.", headers: { "Cache-Control": "no-store" } });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const body = await (await boundedImportRequest(request, 200_000)).json().catch(() => null);
    if (!body || typeof body !== "object") throw new InventoryImportError("Dados de confirmação inválidos.");
    return NextResponse.json(await confirmInventoryImport(session, body.token, body.reviewedVariantIds), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return importErrorResponse(error); }
}
