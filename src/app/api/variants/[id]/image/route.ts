import { requireAdmin } from "@/features/auth/server/authorization";
import { ImageInputError, imageSelectionVersion, normalizeUniformImage, readImageForm } from "@/features/inventory/server/image";
import { assignUniformImage, matchSelect } from "@/features/inventory/server/image-assignment";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

async function authorize(request: Request) {
  const auth = await requireAdmin(request, {
    role: "MASTER_ADMIN",
    forbiddenMessage: "Somente o administrador geral pode atribuir imagens.",
    passwordMessage: "Somente o administrador geral pode atribuir imagens.",
  });
  return auth.ok ? undefined : auth.response;
}

export async function GET(request: Request, { params }: Context) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { id } = await params;
  const variant = await prisma.uniformVariant.findUnique({ where: { id }, select: { id: true, sku: true, imageId: true } });
  if (!variant) return NextResponse.json({ message: "Uniforme não encontrado." }, { status: 404 });
  const catalog = await prisma.uniformCatalog.findUnique({ where: { sku: variant.sku }, select: { deletedAt: true } });
  if (!catalog || catalog.deletedAt) return NextResponse.json({ message: "Uniforme excluído do catálogo." }, { status: 404 });
  const matches = await prisma.uniformVariant.findMany({ where: { sku: variant.sku }, select: matchSelect, orderBy: { id: "asc" } });
  return NextResponse.json({ imageId: variant.imageId, version: imageSelectionVersion(matches), matches }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request, { params }: Context) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { id } = await params;
  try {
    const form = await readImageForm(request);
    const replicate = form.get("replicate");
    const version = form.get("version");
    if (!["true", "false"].includes(String(replicate)) || typeof version !== "string" || !/^[a-f0-9]{64}$/.test(version)) throw new ImageInputError("Reabra a janela e confira as lojas antes de salvar.");
    const file = form.get("image");
    if (file !== null && !(file instanceof File)) throw new ImageInputError("Selecione uma imagem válida.");
    const data = file instanceof File ? await normalizeUniformImage(file) : null;
    if (!data && replicate !== "true") throw new ImageInputError("Selecione uma imagem para salvar.");
    const result = await assignUniformImage({ id, version, replicate, data });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImageInputError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ message: "Outra alteração ocorreu. Reabra a janela e confira novamente." }, { status: 409 });
    return NextResponse.json({ message: "Não foi possível salvar a imagem. Reabra a janela para conferir o estado atual." }, { status: 500 });
  }
}
