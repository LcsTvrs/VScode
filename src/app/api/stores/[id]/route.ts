import { NextResponse } from "next/server";
import { requireMasterAdmin } from "@/lib/master-admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

export async function PUT(request: Request, context: Context) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  const body: unknown = await request.json().catch(() => null);
  const input = body && typeof body === "object" ? body as Record<string, unknown> : {};
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  if (name.length < 2 || name.length > 100 || !/^[A-Z0-9-]{2,20}$/.test(code)) return NextResponse.json({ message: "Informe nome (2 a 100 caracteres) e código válido (2 a 20 letras, números ou hífen)." }, { status: 400 });
  try {
    const store = await prisma.store.update({ where: { id }, data: { name, code }, select: { id: true, code: true, name: true, city: true, state: true, createdAt: true } });
    return NextResponse.json({ store });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error) {
      if (error.code === "P2025") return NextResponse.json({ message: "Loja não encontrada." }, { status: 404 });
      if (error.code === "P2002") return NextResponse.json({ message: "Este código já está em uso." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível atualizar a loja." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  const { id } = await context.params;
  try {
    await prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({ where: { id }, select: { id: true, _count: { select: { users: true, employees: true, uniformVariants: true, stockLevels: true, stockMovements: true, requests: true, requestItems: true } } } });
      if (!store) throw new Error("STORE_NOT_FOUND");
      const linked = Object.values(store._count).some((count) => count > 0);
      if (linked) throw new Error("STORE_HAS_DEPENDENCIES");
      await tx.store.delete({ where: { id } });
    }, { isolationLevel: "Serializable" });
    return new NextResponse(null, { status: 204 });
  } catch (error) {
    if (error instanceof Error && error.message === "STORE_NOT_FOUND") return NextResponse.json({ message: "Loja não encontrada." }, { status: 404 });
    if (error instanceof Error && error.message === "STORE_HAS_DEPENDENCIES") return NextResponse.json({ message: "Não é possível excluir: existem utilizadores, estoque ou registos vinculados a esta loja." }, { status: 409 });
    if (error && typeof error === "object" && "code" in error && (error.code === "P2003" || error.code === "P2034")) return NextResponse.json({ message: "A loja recebeu novos registos e não pode ser excluída. Atualize a lista e tente novamente." }, { status: 409 });
    return NextResponse.json({ message: "Não foi possível excluir a loja." }, { status: 500 });
  }
}
