import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const image = await prisma.uniformImage.findFirst({ where: { id, variants: { some: {} } }, select: { data: true } });
  if (!image) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
  return new Response(new Uint8Array(image.data), { headers: {
    "Content-Type": "image/webp", "Content-Length": String(image.data.byteLength),
    "Cache-Control": "public, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff",
  } });
}
