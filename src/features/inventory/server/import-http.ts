import { NextResponse } from "next/server";
import { InventoryImportError } from "../import-types";

export async function boundedImportRequest(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit) throw new InventoryImportError("Arquivo ou requisição muito grande.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InventoryImportError("Envie os dados da importação.");
  let length = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) {
        await reader.cancel();
        throw new InventoryImportError("Arquivo ou requisição muito grande.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return new Response(Buffer.concat(chunks), { headers: { "Content-Type": request.headers.get("content-type") ?? "" } });
}

export function importErrorResponse(error: unknown) {
  return NextResponse.json({ message: error instanceof InventoryImportError ? error.message : "Não foi possível concluir a importação. Tente novamente com a mesma prévia." }, { status: error instanceof InventoryImportError ? error.status : 500, headers: { "Cache-Control": "no-store" } });
}
