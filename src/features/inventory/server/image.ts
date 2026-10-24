import { createHash } from "node:crypto";
import sharp from "sharp";

export const MAX_IMAGE_UPLOAD = 2 * 1024 * 1024;
export const MAX_IMAGE_BODY = MAX_IMAGE_UPLOAD + 64 * 1024;

export class ImageInputError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export async function readImageForm(request: Request): Promise<FormData> {
  const type = request.headers.get("content-type") ?? "";
  if (!type.startsWith("multipart/form-data;")) throw new ImageInputError("Envie a imagem pelo formulário.");
  if (Number(request.headers.get("content-length")) > MAX_IMAGE_BODY) throw new ImageInputError("Envie uma imagem de até 2 MB.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new ImageInputError("Selecione uma imagem.");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_IMAGE_BODY) {
        await reader.cancel();
        throw new ImageInputError("Envie uma imagem de até 2 MB.", 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  try { return await new Response(Buffer.concat(chunks), { headers: { "content-type": type } }).formData(); }
  catch { throw new ImageInputError("Arquivo ou formulário inválido."); }
}

export async function normalizeUniformImage(file: File): Promise<Uint8Array<ArrayBuffer>> {
  if (!file.size || file.size > MAX_IMAGE_UPLOAD) throw new ImageInputError("Envie uma imagem de até 2 MB.", 413);
  const formats: Record<string, string> = { "image/jpeg": "jpeg", "image/png": "png", "image/webp": "webp" };
  if (!formats[file.type]) throw new ImageInputError("Use uma imagem JPG, PNG ou WebP.");
  try {
    const input = Buffer.from(await file.arrayBuffer());
    // Reject non-raster payloads before handing them to any decoder.
    const signature = input.subarray(0, 12);
    const raster = signature[0] === 0xff && signature[1] === 0xd8 && signature[2] === 0xff
      || signature.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      || signature.subarray(0, 4).toString() === "RIFF" && signature.subarray(8, 12).toString() === "WEBP";
    if (!raster) throw new Error("Invalid signature");
    const image = sharp(input, { limitInputPixels: 16_000_000, failOn: "warning" });
    const metadata = await image.metadata();
    if (metadata.format !== formats[file.type] || (metadata.pages ?? 1) > 1) throw new Error("Unsupported format");
    const data = await image.rotate().resize(1000, 1000, { fit: "inside", withoutEnlargement: true }).webp({ quality: 80 }).toBuffer();
    if (data.length > 512 * 1024) throw new ImageInputError("A imagem ficou muito grande. Escolha uma foto mais simples ou com resolução menor.");
    return new Uint8Array(data);
  } catch (error) {
    if (error instanceof ImageInputError) throw error;
    throw new ImageInputError("Imagem inválida. Use JPG, PNG ou WebP sem animação, com até 16 megapixels.");
  }
}

export function imageSelectionVersion(variants: { id: string; imageId: string | null }[]): string {
  return createHash("sha256").update(JSON.stringify(variants.map(v => [v.id, v.imageId]).sort((a, b) => a[0]!.localeCompare(b[0]!)))).digest("hex");
}
