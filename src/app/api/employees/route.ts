import { requireAdmin } from "@/features/auth/server/authorization";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;
  const storeId = auth.session.role === "STORE_ADMIN" ? auth.session.storeId : new URL(request.url).searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ message: "Selecione a loja da solicitação." }, { status: 400 });
  const employees = await prisma.employee.findMany({ where: { storeId }, orderBy: [{ name: "asc" }, { id: "asc" }], select: { id: true, name: true, ldap: true, email: true, storeId: true } });
  return NextResponse.json({ employees });
}
