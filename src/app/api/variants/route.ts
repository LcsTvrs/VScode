import { requireMasterAdmin } from "@/features/auth/server/master-admin";
import { CatalogError, deleteCatalog, saveCatalog } from "@/features/inventory/server/catalog";
import { readJsonBody } from "@/lib/json-body";
import { NextResponse } from "next/server";

async function save(request: Request, editing: boolean) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  const input = await readJsonBody(request);
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  try {
    return NextResponse.json(await saveCatalog(input as Record<string, unknown>, editing), { status: editing ? 200 : 201 });
  } catch (error) {
    if (error instanceof CatalogError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "Não foi possível salvar. Confira se o SKU já existe ou se o catálogo mudou e tente novamente." }, { status: 409 });
  }
}
export function POST(request: Request) { return save(request, false); }
export function PUT(request: Request) { return save(request, true); }

export async function DELETE(request: Request) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  const input = await readJsonBody(request);
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  try {
    await deleteCatalog(input as Record<string, unknown>);
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof CatalogError) return NextResponse.json({ message: error.message }, { status: error.status });
    return NextResponse.json({ message: "O cadastro ou seus vínculos mudaram. Atualize o estoque antes de tentar excluir novamente." }, { status: 409 });
  }
}
