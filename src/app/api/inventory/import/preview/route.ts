import { isPasswordChangeOverdue } from "@/lib/password-change-window";
import { NextResponse } from "next/server";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { resolveStoreId } from "@/lib/admin-session";
import { parseInventoryWorkbook } from "@/lib/inventory-import-excel";
import { previewInventoryImport } from "@/lib/inventory-import";
import { boundedImportRequest, importErrorResponse } from "@/lib/inventory-import-http";
import { IMPORT_MAX_BYTES, InventoryImportError } from "@/lib/inventory-import-types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const session = await getRequestAdminSession(request);
    if (!session) throw new InventoryImportError("Sessão inválida.", 401);
    if (isPasswordChangeOverdue(session)) throw new InventoryImportError("Troque sua senha antes de importar.", 403);
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
