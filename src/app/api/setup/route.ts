import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ message: "Dados inválidos." }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const code = typeof input.code === "string" ? input.code.trim().toUpperCase() : "";
  const name = typeof input.name === "string" ? input.name.trim() : "";
  const city = typeof input.city === "string" ? input.city.trim() : "";
  const state = typeof input.state === "string" ? input.state.trim().toUpperCase() : "";

  if (
    !/^[A-Z0-9-]{2,20}$/.test(code) ||
    name.length < 2 || name.length > 100 ||
    city.length < 2 || city.length > 80 ||
    !/^[A-Z]{2}$/.test(state)
  ) {
    return NextResponse.json({ message: "Informe código, nome, cidade e UF válidos." }, { status: 400 });
  }

  try {
    const store = await prisma.$transaction(async (tx) => {
      if (await tx.store.count()) throw new Error("STORE_ALREADY_CONFIGURED");
      return tx.store.create({ data: { code, name, city, state } });
    }, { isolationLevel: "Serializable" });
    return NextResponse.json({ id: store.id, name: store.name }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message === "STORE_ALREADY_CONFIGURED" || (error && typeof error === "object" && "code" in error && error.code === "P2034")) {
      return NextResponse.json({ message: "A loja já foi configurada. Atualize o painel." }, { status: 409 });
    }
    return NextResponse.json({ message: "Não foi possível cadastrar a loja. Verifique se o código já existe." }, { status: 409 });
  }
}
