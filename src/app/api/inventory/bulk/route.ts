import { requireMasterAdmin } from "@/features/auth/server/master-admin";
import { parseBulkInput } from "@/features/inventory/bulk";
import { editInventoryBulk } from "@/features/inventory/server/bulk";
import { readJsonBody } from "@/lib/json-body";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  let input;
  try { input = parseBulkInput(await readJsonBody(request)); }
  catch (error) { return NextResponse.json({ message: error instanceof Error ? error.message : "Dados inválidos." }, { status: 400 }); }
  try { return NextResponse.json(await editInventoryBulk(input.records, input.change)); }
  catch (error) {
    const message = error instanceof Error ? error.message : "";
    return NextResponse.json({ message: message === "SALDO_NAO_ENCONTRADO" ? "Um registro não pertence à loja informada ou não existe mais. Nenhum registro foi alterado." : message === "ESTOQUE_RESERVADO" ? "Uma alteração reduziria o saldo abaixo das reservas pendentes. Nenhum registro foi alterado." : "O lote não foi salvo: confira os saldos e recarregue as versões atuais antes de tentar novamente." }, { status: 409, headers: { "Cache-Control": "no-store" } });
  }
}
