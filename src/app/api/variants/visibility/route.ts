import { requireAdmin } from "@/features/auth/server/authorization";
import { lockCatalog } from "@/features/inventory/server/catalog";
import { readJsonBody } from "@/lib/json-body";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function PATCH(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const input = await readJsonBody(request);
  if (!input || typeof input !== "object" || Array.isArray(input)) return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  const { sku, hidden, scope, storeId: requestedStoreId } = input as Record<string, unknown>;
  if (typeof sku !== "string" || !sku.trim() || sku.length > 40 || typeof hidden !== "boolean" || (scope !== "store" && scope !== "all")) {
    return NextResponse.json({ message: "Confira o uniforme, a visibilidade e o alcance da alteração." }, { status: 400 });
  }
  const { session } = auth;
  if (session.role === "STORE_ADMIN" && (scope === "all" || (requestedStoreId !== undefined && requestedStoreId !== session.storeId))) {
    return NextResponse.json({ message: "Você pode alterar somente a visibilidade da própria loja." }, { status: 403 });
  }
  const storeId = session.role === "STORE_ADMIN" ? session.storeId : requestedStoreId;
  if (scope === "store" && (typeof storeId !== "string" || !storeId)) return NextResponse.json({ message: "Selecione uma loja." }, { status: 400 });
  try {
    const found = await prisma.$transaction(async tx => {
      await lockCatalog(tx);
      const catalog = await tx.uniformCatalog.findUnique({ where: { sku } });
      if (!catalog || catalog.deletedAt) return false;
      if (scope === "all") {
        await tx.uniformCatalog.update({ where: { sku }, data: { hiddenFromRequests: hidden } });
      } else {
        const result = await tx.uniformVariant.updateMany({ where: { sku, storeId: storeId as string }, data: { hiddenFromRequests: hidden } });
        if (!result.count) return false;
      }
      return true;
    }, { isolationLevel: "Serializable" });
    if (!found) return NextResponse.json({ message: "Uniforme não encontrado nesta loja ou no catálogo." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ message: "Não foi possível alterar a visibilidade. Atualize a lista e tente novamente." }, { status: 409 });
  }
}
