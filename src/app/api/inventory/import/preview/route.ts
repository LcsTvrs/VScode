import { requireAdmin } from "@/features/auth/server/authorization";
import { resolveStoreId } from "@/features/auth/session";
import { IMPORT_MAX_BYTES, InventoryImportError } from "@/features/inventory/import-types";
import { previewInventoryImport } from "@/features/inventory/server/import";
import { parseInventoryWorkbook } from "@/features/inventory/server/import-excel";
import { boundedImportRequest, importErrorResponse } from "@/features/inventory/server/import-http";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin(request, { passwordMessage: "Troque sua senha antes de importar.", headers: { "Cache-Control": "no-store" } });
    if (!auth.ok) return auth.response;
    const { session } = auth;
    const body = await boundedImportRequest(request, IMPORT_MAX_BYTES + 64 * 1024);
    const form = await body.formData().catch(() => { throw new InventoryImportError("Envie um arquivo Excel."); });
    const storeId = resolveStoreId(session, form.get("storeId"));
    if (!storeId) throw new InventoryImportError("Selecione a loja do estoque.");
    if (session.role === "STORE_ADMIN" && form.get("storeId") && form.get("storeId") !== storeId) throw new InventoryImportError("Você só pode importar para sua loja.", 403);
    const file = form.get("file");
    if (!(file instanceof File)) throw new InventoryImportError("Selecione a planilha Excel.");
    const lines = await parseInventoryWorkbook(new Uint8Array(await file.arrayBuffer()), file.name);
    return NextResponse.json(await previewInventoryImport(session, storeId, lines), { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return importErrorResponse(error); }
}
