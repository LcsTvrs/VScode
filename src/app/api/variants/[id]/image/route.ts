import { isPasswordChangeOverdue } from "@/lib/password-change-window";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestAdminSession } from "@/lib/admin-auth";
import { ImageInputError, imageSelectionVersion, normalizeUniformImage, readImageForm } from "@/lib/uniform-image";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
const matchSelect = { id: true, imageId: true, store: { select: { name: true, code: true } } } as const;

async function authorize(request: Request) {
  const session = await getRequestAdminSession(request);
  if (!session) return NextResponse.json({ message: "Sessão inválida." }, { status: 401 });
  if (session.role !== "MASTER_ADMIN" || isPasswordChangeOverdue(session)) return NextResponse.json({ message: "Somente o administrador geral pode atribuir imagens." }, { status: 403 });
}

export async function GET(request: Request, { params }: Context) {
  const denied = await authorize(request);
  if (denied) return denied;
  const { id } = await params;
  const variant = await prisma.uniformVariant.findUnique({ where: { id }, select: { id: true, sku: true, imageId: true } });
  if (!variant) return NextResponse.json({ message: "Uniforme não encontrado." }, { status: 404 });
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
    const result = await prisma.$transaction(async tx => {
      const source = await tx.uniformVariant.findUnique({ where: { id }, select: { id: true, sku: true, imageId: true } });
      if (!source) throw new ImageInputError("Uniforme não encontrado.", 404);
      const matches = await tx.uniformVariant.findMany({ where: { sku: source.sku }, select: matchSelect, orderBy: { id: "asc" } });
      if (imageSelectionVersion(matches) !== version) throw new ImageInputError("As imagens ou lojas mudaram. Reabra a janela para conferir novamente.", 409);
      const targets = replicate === "true" ? matches : matches.filter(v => v.id === id);
      const imageId = data ? (await tx.uniformImage.create({ data: { data }, select: { id: true } })).id : source.imageId;
      if (!imageId) throw new ImageInputError("Selecione uma imagem antes de replicar.");
      const updated = await tx.uniformVariant.updateMany({ where: { id: { in: targets.map(v => v.id) } }, data: { imageId } });
      const previousIds = targets.flatMap(v => v.imageId && v.imageId !== imageId ? [v.imageId] : []);
      if (previousIds.length) await tx.uniformImage.deleteMany({ where: { id: { in: previousIds }, variants: { none: {} } } });
      return { imageId, updatedCount: updated.count };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ImageInputError) return NextResponse.json({ message: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ message: "Outra alteração ocorreu. Reabra a janela e confira novamente." }, { status: 409 });
    return NextResponse.json({ message: "Não foi possível salvar a imagem. Reabra a janela para conferir o estado atual." }, { status: 500 });
  }
}
