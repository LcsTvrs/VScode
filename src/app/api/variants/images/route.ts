import { requireMasterAdmin } from "@/features/auth/server/master-admin";
import { assignBulkUniformImage, bulkImageTargets, parseImageIds } from "@/features/inventory/server/image-assignment";
import { ImageInputError, imageSelectionVersion, normalizeUniformImage, readImageForm } from "@/features/inventory/server/image";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

function failure(error: unknown) {
  if (error instanceof ImageInputError) return NextResponse.json({ message: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") return NextResponse.json({ message: "Outra alteração ocorreu. Reabra a janela para conferir novamente." }, { status: 409 });
  return NextResponse.json({ message: "Não foi possível aplicar a foto. Reabra a janela e tente novamente." }, { status: 500 });
}

export async function GET(request: Request) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const ids = parseImageIds(new URL(request.url).searchParams.getAll("id"));
    const matches = await bulkImageTargets(prisma, ids);
    return NextResponse.json({ version: imageSelectionVersion(matches), matches }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return failure(error); }
}

export async function POST(request: Request) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  try {
    const form = await readImageForm(request);
    const ids = parseImageIds(form.getAll("id"));
    const version = form.get("version");
    if (typeof version !== "string" || !/^[a-f0-9]{64}$/.test(version)) throw new ImageInputError("Reabra a janela para conferir a seleção.");
    const file = form.get("image");
    if (!(file instanceof File)) throw new ImageInputError("Selecione uma imagem para aplicar aos uniformes.");
    const data = await normalizeUniformImage(file);
    return NextResponse.json(await assignBulkUniformImage(ids, version, data));
  } catch (error) { return failure(error); }
}
