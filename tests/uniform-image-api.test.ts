import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import { Prisma } from "@prisma/client";
import { prisma } from "../src/lib/prisma";
import { ADMIN_SESSION_COOKIE, createAdminSession, type AdminSession } from "../src/features/auth/session";
import { GET as details, POST as save } from "../src/app/api/variants/[id]/image/route";
import { GET as photo } from "../src/app/api/uniform-images/[id]/route";
import { GET as bulkDetails, POST as bulkSave } from "../src/app/api/variants/images/route";
import { imageSelectionVersion, normalizeUniformImage, readImageForm, MAX_IMAGE_BODY } from "../src/features/inventory/server/image";

async function png() { return sharp({ create: { width: 1200, height: 600, channels: 3, background: "green" } }).png().toBuffer(); }

test("fotos são decodificadas, reduzidas e regravadas como WebP", async () => {
  const output = await normalizeUniformImage(new File([new Uint8Array(await png())], "foto.png", { type: "image/png" }));
  const metadata = await sharp(output).metadata();
  assert.equal(metadata.format, "webp"); assert.equal(metadata.width, 1000); assert.equal(metadata.height, 500);
  assert.equal(metadata.exif, undefined); assert.ok(output.length < 512 * 1024);
  for (const [body, type] of [["<svg></svg>", "image/svg+xml"], ["<svg></svg>", "image/png"], ["not a photo", "image/jpeg"]]) {
    await assert.rejects(normalizeUniformImage(new File([body], "fake.png", { type })), /Use|inválida/);
  }
  await assert.rejects(normalizeUniformImage(new File([new Uint8Array(2 * 1024 * 1024 + 1)], "big.png", { type: "image/png" })), /2 MB/);
  const huge = await sharp({ create: { width: 5000, height: 4000, channels: 3, background: "white" } }).png().toBuffer();
  await assert.rejects(normalizeUniformImage(new File([new Uint8Array(huge)], "huge.png", { type: "image/png" })), /16 megapixels/);
});

test("upload limita o corpo real mesmo sem Content-Length", async () => {
  await assert.rejects(readImageForm(new Request("http://localhost", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x" }, body: new Uint8Array(MAX_IMAGE_BODY + 1) })), /2 MB/);
});

test("imagens exigem master, replicam SKU exato e preservam dados de estoque", async t => {
  const previousSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "uniform-image-test-secret-at-least-32-bytes";
  const restores: (() => void)[] = [];
  function replace(target: object, key: string, value: unknown) {
    const object = target as Record<string, unknown>;
    const old = object[key]; object[key] = value; restores.push(() => { object[key] = old; });
  }
  const time = new Date("2026-10-21T12:00:00Z");
  const session: AdminSession = { userId: "admin", login: "admin", role: "MASTER_ADMIN", storeId: null, mustChangePassword: false, userUpdatedAt: time.getTime() };
  let variants = [
    { id: "a", sku: "CAM-M", imageId: null as string | null, quantity: 10, store: { name: "Loja A", code: "A" } },
    { id: "b", sku: "CAM-M", imageId: null as string | null, quantity: 20, store: { name: "Loja B", code: "B" } },
    { id: "c", sku: "CAM-G", imageId: null as string | null, quantity: 30, store: { name: "Loja C", code: "C" } },
  ];
  let images = new Map<string, Uint8Array>();
  let serial = 0; let transactions = 0; let conflict = false;
  const matching = () => variants.filter(v => v.sku === "CAM-M");
  function selectVariants(rows: typeof variants, where: { id?: { in: string[] }; sku?: string | { in: string[] } }) {
    return rows.filter(v => where.id ? where.id.in.includes(v.id) : typeof where.sku === "string" ? v.sku === where.sku : where.sku!.in.includes(v.sku));
  }
  const version = () => imageSelectionVersion(matching());
  replace(prisma, "$executeRawUnsafe", async () => 0);
  replace(prisma.user, "findUnique", async () => ({ ...session, name: "Master", updatedAt: time }));
  replace(prisma.uniformCatalog, "findUnique", async () => ({ deletedAt: null }));
  replace(prisma.uniformVariant, "findUnique", async ({ where }: { where: { id: string } }) => variants.find(v => v.id === where.id) ?? null);
  replace(prisma.uniformVariant, "findMany", async ({ where }: { where: Parameters<typeof selectVariants>[1] }) => selectVariants(variants, where));
  replace(prisma.uniformImage, "findFirst", async ({ where }: { where: { id: string; variants: unknown } }) => {
    assert.deepEqual(where.variants, { some: {} });
    return images.has(where.id) && variants.some(v => v.imageId === where.id) ? { data: images.get(where.id) } : null;
  });
  replace(prisma, "$transaction", async (callback: (tx: object) => Promise<unknown>, options: { isolationLevel: string }) => {
    assert.equal(options.isolationLevel, "Serializable"); transactions++;
    const draft = variants.map(v => ({ ...v })); const draftImages = new Map(images);
    const result = await callback({
      $executeRaw: async () => 1,
      uniformCatalog: { findUnique: async () => ({ deletedAt: null }), update: async () => ({}), updateMany: async () => ({ count: 2 }) },
      uniformVariant: {
        findUnique: async ({ where }: { where: { id: string } }) => draft.find(v => v.id === where.id) ?? null,
        findMany: async ({ where }: { where: Parameters<typeof selectVariants>[1] }) => selectVariants(draft, where).map(v => ({ ...v })),
        updateMany: async ({ where, data }: { where: { id: { in: string[] } }; data: { imageId: string } }) => {
          if (conflict) throw new Prisma.PrismaClientKnownRequestError("conflict", { code: "P2034", clientVersion: "test" });
          const targets = draft.filter(v => where.id.in.includes(v.id)); targets.forEach(v => { v.imageId = data.imageId; });
          return { count: targets.length };
        },
      },
      uniformImage: {
        create: async ({ data }: { data: { data: Uint8Array } }) => { const id = `photo-${++serial}`; draftImages.set(id, data.data); return { id }; },
        deleteMany: async ({ where }: { where: { id: { in: string[] }; variants: unknown } }) => {
          assert.deepEqual(where.variants, { none: {} });
          where.id.in.forEach(id => { if (!draft.some(v => v.imageId === id)) draftImages.delete(id); });
        },
      },
    });
    variants = draft; images = draftImages; return result;
  });
  const context = { params: Promise.resolve({ id: "a" }) };
  async function request(method: string, replicate = false, upload = true, expected = version()) {
    const headers = { cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}` };
    const form = new FormData(); form.set("replicate", String(replicate)); form.set("version", expected);
    if (upload) form.set("image", new File([new Uint8Array(await png())], "foto.png", { type: "image/png" }));
    return new Request("http://localhost/api/variants/a/image", { method, headers, ...(method === "POST" ? { body: form } : {}) });
  }
  try {
    await t.test("visitante, gestor de loja e senha temporária não podem consultar ou salvar", async () => {
      assert.equal((await save(new Request("http://localhost", { method: "POST" }), context)).status, 401);
      session.role = "STORE_ADMIN"; session.storeId = "loja";
      assert.equal((await details(await request("GET"), context)).status, 403);
      assert.equal((await save(await request("POST", true), context)).status, 403);
      session.role = "MASTER_ADMIN"; session.storeId = null; session.mustChangePassword = true;
      assert.equal((await save(await request("POST"), context)).status, 403);
      session.mustChangePassword = false; assert.equal(transactions, 0);
    });
    await t.test("prévia lista somente lojas com mesmo SKU; cadastro inexistente é recusado", async () => {
      const result = await (await details(await request("GET"), context)).json();
      assert.deepEqual(result.matches.map((v: { id: string }) => v.id), ["a", "b"]); assert.equal(result.version, version());
      assert.equal((await save(await request("POST"), { params: Promise.resolve({ id: "missing" }) })).status, 404);
      assert.equal(images.size, 0);
    });
    await t.test("salva em todas as lojas mesmo com cliente antigo; reutiliza foto sem duplicar arquivo", async () => {
      assert.equal((await save(await request("POST"), context)).status, 200);
      const photoId = variants[0].imageId;
      assert.ok(photoId); assert.equal(variants[1].imageId, photoId);
      const replicated = await (await save(await request("POST", true, false), context)).json();
      assert.equal(replicated.updatedCount, 2); assert.equal(variants[1].imageId, photoId); assert.equal(variants[2].imageId, null);
      assert.equal(images.size, 1); assert.deepEqual(variants.map(v => v.quantity), [10, 20, 30]);
    });
    await t.test("substituir foto compartilhada atualiza todas as lojas e limpa arquivos sem uso", async () => {
      const shared = variants[0].imageId!;
      await save(await request("POST"), context);
      assert.ok(!images.has(shared)); assert.equal(images.size, 1); assert.equal(variants[1].imageId, variants[0].imageId);
      await save(await request("POST", true), context);
      assert.equal(images.size, 1); assert.equal(variants[0].imageId, variants[1].imageId);
    });
    await t.test("prévia desatualizada e conflito revertem a operação inteira", async () => {
      const before = structuredClone(variants); const beforeImages = new Map(images);
      assert.equal((await save(await request("POST", true, true, "0".repeat(64)), context)).status, 409);
      conflict = true;
      assert.equal((await save(await request("POST", true), context)).status, 409);
      conflict = false;
      assert.deepEqual(variants, before); assert.deepEqual(images, beforeImages);
    });
    await t.test("foto pública serve somente WebP existente, com cache e sem autenticação", async () => {
      const id = variants[0].imageId!;
      const response = await photo(new Request("http://localhost"), { params: Promise.resolve({ id }) });
      assert.equal(response.status, 200); assert.equal(response.headers.get("content-type"), "image/webp");
      assert.match(response.headers.get("cache-control")!, /immutable/);
      assert.equal((await sharp(Buffer.from(await response.arrayBuffer())).metadata()).format, "webp");
      assert.equal((await photo(new Request("http://localhost"), { params: Promise.resolve({ id: "missing" }) })).status, 404);
    });
    await t.test("foto em lote valida permissões e seleção, replica SKUs e reverte conflitos", async () => {
      async function bulkRequest(method: string, ids = ["a", "c"], expected = imageSelectionVersion(variants)) {
        const headers = { cookie: `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}` };
        const form = new FormData(); ids.forEach(id => form.append("id", id)); form.set("version", expected);
        form.set("image", new File([new Uint8Array(await png())], "foto.png", { type: "image/png" }));
        const query = ids.map(id => `id=${id}`).join("&");
        return new Request(`http://localhost/api/variants/images?${query}`, { method, headers, ...(method === "POST" ? { body: form } : {}) });
      }
      assert.equal((await bulkSave(new Request("http://localhost", { method: "POST" }))).status, 401);
      session.role = "STORE_ADMIN"; session.storeId = "loja";
      assert.equal((await bulkDetails(await bulkRequest("GET"))).status, 403);
      assert.equal((await bulkSave(await bulkRequest("POST"))).status, 403);
      session.role = "MASTER_ADMIN"; session.storeId = null;
      for (const ids of [[], ["a", "a"], Array.from({ length: 201 }, (_, i) => String(i))]) {
        assert.equal((await bulkDetails(await bulkRequest("GET", ids))).status, 400);
      }
      assert.equal((await bulkSave(await bulkRequest("POST", ["missing"]))).status, 409);
      const preview = await (await bulkDetails(await bulkRequest("GET"))).json();
      assert.equal(preview.version, imageSelectionVersion(variants));
      assert.deepEqual(preview.matches.map((v: { id: string }) => v.id), ["a", "b", "c"]);
      const before = structuredClone(variants), beforeImages = new Map(images);
      assert.equal((await bulkSave(await bulkRequest("POST", ["a", "c"], "0".repeat(64)))).status, 409);
      conflict = true;
      assert.equal((await bulkSave(await bulkRequest("POST"))).status, 409);
      conflict = false;
      assert.deepEqual(variants, before); assert.deepEqual(images, beforeImages);
      const result = await bulkSave(await bulkRequest("POST"));
      assert.equal(result.status, 200); assert.equal((await result.json()).updatedCount, 3);
      assert.ok(variants.every(v => v.imageId === variants[0].imageId));
      assert.equal(images.size, 1); assert.deepEqual(variants.map(v => v.quantity), [10, 20, 30]);
      const otherImage = variants[2].imageId;
      assert.equal((await bulkSave(await bulkRequest("POST", ["a"], imageSelectionVersion(matching())))).status, 200);
      assert.equal(variants[2].imageId, otherImage);
      assert.notEqual(variants[0].imageId, otherImage);
      assert.equal(variants[1].imageId, variants[0].imageId);
      assert.equal(images.size, 2);
    });
  } finally {
    while (restores.length) restores.pop()!();
    if (previousSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previousSecret;
  }
});
