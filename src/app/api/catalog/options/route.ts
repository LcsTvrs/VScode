import { requireAdmin } from "@/features/auth/server/authorization";
import { requireMasterAdmin } from "@/features/auth/server/master-admin";
import { CatalogError, lockCatalog } from "@/features/inventory/server/catalog";
import { categoryNames } from "@/features/inventory/labels";
import { readJsonBody } from "@/lib/json-body";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const [sectors, categories] = await Promise.all([
    prisma.uniformSector.findMany({ orderBy: { name: "asc" } }),
    prisma.uniformCategoryOption.findMany({ orderBy: { name: "asc" } }),
  ]);
  return NextResponse.json({ sectors: sectors.map(v => v.name), categories: categories.map(v => v.name) }, { headers: { "Cache-Control": "no-store" } });
}

async function save(request: Request, editing: boolean) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request);
  const input = body as Record<string, unknown> | null;
  const name = typeof input?.name === "string" ? input.name.normalize("NFC").trim().replace(/\s+/g, " ") : "";
  if (!name || name.length > 80 || !["sector", "category"].includes(String(input?.kind)) || (editing && typeof input?.previous !== "string")) return NextResponse.json({ message: "Informe o tipo e um nome de até 80 caracteres." }, { status: 400 });
  try {
    await prisma.$transaction(async tx => {
      await lockCatalog(tx);
      const sector = input!.kind === "sector";
      const existing = sector ? await tx.uniformSector.findMany() : await tx.uniformCategoryOption.findMany();
      const normalize = (value: string) => value.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("pt-BR");
      const displayName = (value: string) => sector ? value : categoryNames[value] ?? value;
      if (existing.some(option => (!editing || option.name !== input!.previous) && normalize(displayName(option.name)) === normalize(displayName(name)))) throw new CatalogError("Já existe uma opção com esse nome.", 409);
      if (editing) {
        const previous = input!.previous as string;
        const current = sector ? await tx.uniformSector.findUnique({ where: { name: previous } }) : await tx.uniformCategoryOption.findUnique({ where: { name: previous } });
        if (!current) throw new CatalogError("Opção não encontrada. Atualize a lista.", 404);
        if (sector) await tx.uniformSector.update({ where: { name: previous }, data: { name } });
        else await tx.uniformCategoryOption.update({ where: { name: previous }, data: { name } });
        const where = sector ? { sector: previous } : { category: previous };
        const data = sector ? { sector: name } : { category: name };
        const items = await tx.uniformCatalog.findMany({ where, select: { sku: true, updatedAt: true } });
        for (const item of items) await tx.uniformCatalog.update({ where: { sku: item.sku }, data: { ...data, updatedAt: new Date(Math.max(Date.now(), item.updatedAt.getTime() + 1)) } });
        await tx.uniformVariant.updateMany({ where, data });
      } else {
        if (sector) await tx.uniformSector.create({ data: { name } });
        else await tx.uniformCategoryOption.create({ data: { name } });
      }
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    return NextResponse.json({ name }, { status: editing ? 200 : 201 });
  } catch (error) {
    return NextResponse.json({ message: error instanceof CatalogError ? error.message : "Já existe uma opção com esse nome ou a lista mudou. Confira e tente novamente." }, { status: error instanceof CatalogError ? error.status : 409 });
  }
}
export function POST(request: Request) { return save(request, false); }
export function PATCH(request: Request) { return save(request, true); }

export async function DELETE(request: Request) {
  const auth = await requireMasterAdmin(request);
  if (!auth.ok) return auth.response;
  const body = await readJsonBody(request) as Record<string, unknown> | null;
  if (!body || !["sector", "category"].includes(String(body.kind)) || typeof body.name !== "string" || !body.name || body.name.length > 80) return NextResponse.json({ message: "Selecione um setor ou categoria para excluir." }, { status: 400 });
  const name = body.name;
  try {
    await prisma.$transaction(async tx => {
      await lockCatalog(tx);
      const sector = body.kind === "sector";
      const option = sector ? await tx.uniformSector.findUnique({ where: { name } }) : await tx.uniformCategoryOption.findUnique({ where: { name } });
      if (!option) throw new CatalogError("Opção não encontrada. Atualize a lista.", 404);
      const where = sector ? { sector: name } : { category: name };
      // Check the canonical catalog even when there are no stores, and legacy replicas too.
      if (await tx.uniformCatalog.count({ where }) || await tx.uniformVariant.count({ where })) throw new CatalogError("Esta opção está vinculada a uniformes. Reclassifique todos os uniformes antes de excluí-la.", 409);
      if (sector) await tx.uniformSector.delete({ where: { name } });
      else await tx.uniformCategoryOption.delete({ where: { name } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 20000 });
    return NextResponse.json({ deleted: true });
  } catch (error) {
    return NextResponse.json({ message: error instanceof CatalogError ? error.message : "A lista ou seus vínculos mudaram. Atualize e tente novamente." }, { status: error instanceof CatalogError ? error.status : 409 });
  }
}
