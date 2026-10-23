import assert from "node:assert/strict";
import { test } from "node:test";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { middleware } from "../src/middleware";
import { safeLocalRedirect } from "../src/lib/safe-redirect";
import { validNewPassword } from "../src/lib/password-policy";
import { readJsonBody, JSON_BODY_LIMIT } from "../src/lib/json-body";
import { assertSafeSeed } from "../scripts/lib/seed-safety";
import { movementDelta } from "../src/lib/stock-rules";
import { prisma } from "../src/lib/prisma";
import { createAdminSession, verifyAdminSession, ADMIN_SESSION_COOKIE } from "../src/lib/admin-session";
import { getCurrentAdminSession } from "../src/lib/admin-auth";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as changePassword } from "../src/app/api/auth/change-password/route";
import { readApiResponse } from "../src/lib/api-response";
import { GET as exportRequests } from "../src/app/api/exports/requests/route";

test("redirecionamento de login só permite caminhos da própria origem", () => {
  const origin = "https://app.example";
  for (const path of [null, "https://evil.example", "//evil.example", "/\\evil.example", "/\t/evil.example", "/\n/evil.example", "javascript:alert(1)"]) assert.equal(safeLocalRedirect(path, origin), "/");
  assert.equal(safeLocalRedirect("/?storeId=loja#estoque", origin), "/?storeId=loja#estoque");
});

test("senhas novas respeitam o limite de bytes do bcrypt e saldo final tem teto", () => {
  assert.equal(validNewPassword("A".repeat(72)), true);
  assert.equal(validNewPassword("A".repeat(73)), false);
  assert.equal(validNewPassword("á".repeat(36)), true);
  assert.equal(validNewPassword("á".repeat(37)), false);
  assert.equal(validNewPassword("curta"), false);
  assert.throws(() => movementDelta("ENTRADA", 1, 1_000_000), /LIMITE_SALDO/);
});

test("resposta HTML na troca de senha apresenta orientação em vez de erro de JSON", async () => {
  for (const status of [200, 502, 503]) {
    await assert.rejects(readApiResponse(new Response("<!DOCTYPE html><html>Unavailable</html>", { status }), "Tente novamente com a mesma nova senha."), { message: "Tente novamente com a mesma nova senha." });
  }
});

test("seed bloqueia banco remoto e produção mesmo com flag de liberação", () => {
  const local = { DATABASE_URL: "postgresql://test:test@127.0.0.1/test", ALLOW_DESTRUCTIVE_SEED: "true" };
  assert.doesNotThrow(() => assertSafeSeed(local));
  for (const env of [
    { ...local, ALLOW_DESTRUCTIVE_SEED: undefined }, { ...local, NODE_ENV: "production" }, { ...local, VERCEL: "1" },
    { ...local, DATABASE_URL: "postgresql://test:test@db.example/test" }, { ...local, DIRECT_URL: "postgresql://test:test@db.example/test" },
  ]) assert.throws(() => assertSafeSeed(env));
});

test("JSON é limitado pelo corpo real e rejeita formulário ou texto simples", async () => {
  const request = (body: string, type = "application/json") => new Request("https://app.example/api/test", { method: "POST", headers: { "Content-Type": type }, body });
  assert.deepEqual(await readJsonBody(request('{"quantity":2}')), { quantity: 2 });
  assert.equal(await readJsonBody(request('{"quantity":2}', "text/plain")), null);
  assert.equal(await readJsonBody(request("[]")), null);
  assert.equal(await readJsonBody(request("{")), null);
  assert.equal(await readJsonBody(request(JSON.stringify({ name: "A".repeat(JSON_BODY_LIMIT) }))), null);
});

test("middleware bloqueia gravações cross-site e preserva leitura pública de imagens", async () => {
  for (const origin of ["https://evil.example", "null"]) {
    const response = await middleware(new NextRequest("https://app.example/api/auth/login", { method: "POST", headers: { Origin: origin } }));
    assert.equal(response.status, 403);
  }
  const same = await middleware(new NextRequest("https://app.example/api/auth/login", { method: "POST", headers: { Origin: "https://app.example" } }));
  assert.equal(same.headers.get("x-middleware-next"), "1");
  assert.equal((await middleware(new NextRequest("https://app.example/api/uniform-images/photo"))).headers.get("x-middleware-next"), "1");
  assert.equal((await middleware(new NextRequest("https://app.example/api/variants/variant/image", { method: "POST" }))).status, 401);
});

test("autenticação, revogação, senha temporária e reset concorrente", async t => {
  const oldSecret = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "security-readiness-test-secret-at-least-32-bytes";
  const originalFind = prisma.user.findUnique;
  const originalUpdate = prisma.user.updateMany;
  const originalDDL = prisma.$executeRawUnsafe;
  const time = new Date("2026-10-22T12:00:00Z");
  const originalHash = await bcrypt.hash("Temporary-12345", 12);
  const user = { id: "admin", login: "admin", name: "Admin", role: "MASTER_ADMIN" as const, storeId: null, mustChangePassword: true, updatedAt: time, passwordHash: originalHash };
  let found = true; let dbUnavailable = false; let concurrentReset = false; let writes = 0;
  let failWrite = false; let loseWriteResponse = false; let failSigning = false;
  Object.assign(prisma.user, { findUnique: async () => { if (dbUnavailable) throw new Error("Private database failure details"); if (failSigning) delete process.env.ADMIN_SESSION_SECRET; return found ? { ...user } : null; },
    updateMany: async ({ where, data }: { where: { updatedAt: Date; mustChangePassword: boolean }; data: Partial<typeof user> }) => {
      assert.equal(where.updatedAt.getTime(), time.getTime()); assert.equal(where.mustChangePassword, true);
      if (concurrentReset) return { count: 0 };
      if (failWrite) throw new Error("Private write failure");
      Object.assign(user, data); writes++;
      if (loseWriteResponse) throw new Error("Connection lost after commit");
      return { count: 1 };
    },
  });
  Object.assign(prisma, { $executeRawUnsafe: async () => { throw new Error("DDL must never execute during authentication"); } });
  const session = { userId: user.id, login: user.login, role: user.role, storeId: null, mustChangePassword: true, userUpdatedAt: time.getTime() };
  const token = await createAdminSession(session);
  const request = (path: string, body: object) => new Request(`https://app.example${path}`, { method: "POST", headers: { "Content-Type": "application/json", cookie: `${ADMIN_SESSION_COOKIE}=${token}` }, body: JSON.stringify(body) });
  const changeViaLogin = (novaSenha: string) => login(request("/api/auth/login", { acao: "trocar-senha", novaSenha }));
  try {
    await t.test("credenciais erradas e conta inexistente têm mesma resposta; login não executa DDL", async () => {
      const invalid = await login(request("/api/auth/login", { login: "admin", senha: "wrong" }));
      found = false;
      const missing = await login(request("/api/auth/login", { login: "missing", senha: "wrong" }));
      assert.equal(invalid.status, 401); assert.equal(missing.status, 401); assert.deepEqual(await invalid.json(), await missing.json());
      found = true;
      const success = await login(request("/api/auth/login", { login: "admin", senha: "Temporary-12345" }));
      assert.equal(success.status, 200); assert.match(success.headers.get("set-cookie")!, /HttpOnly/); assert.match(success.headers.get("set-cookie")!, /SameSite=strict/i);
      dbUnavailable = true;
      const unavailable = await login(request("/api/auth/login", { login: "admin", senha: "Temporary-12345" }));
      assert.equal(unavailable.status, 503); assert.ok(!(await unavailable.text()).includes("Private database")); dbUnavailable = false;
    });
    await t.test("senha temporária não exporta; token adulterado e usuário removido são recusados", async () => {
      assert.equal((await exportRequests(request("/api/exports/requests", {}))).status, 403);
      assert.equal(await verifyAdminSession(token.slice(0, -10) + "invalidJWT"), null);
      found = false; assert.equal(await getCurrentAdminSession(token), null); found = true;
    });
    await t.test("falhas e validações permitem novas tentativas sem consumir a senha temporária", async () => {
      for (const novaSenha of ["curta", "á".repeat(37), "Temporary-12345", "Temporary-12345"]) {
        assert.equal((await changePassword(request("/api/auth/change-password", { novaSenha }))).status, 400);
        assert.ok(await getCurrentAdminSession(token));
      }
      dbUnavailable = true;
      const unavailable = await changePassword(request("/api/auth/change-password", { novaSenha: "New-password-12345" }));
      assert.equal(unavailable.status, 503);
      assert.ok(!(await unavailable.text()).includes("Private database"));
      dbUnavailable = false;
      failWrite = true;
      assert.equal((await changePassword(request("/api/auth/change-password", { novaSenha: "New-password-12345" }))).status, 503);
      failWrite = false;
      failSigning = true;
      assert.equal((await changePassword(request("/api/auth/change-password", { novaSenha: "New-password-12345" }))).status, 503);
      process.env.ADMIN_SESSION_SECRET = "security-readiness-test-secret-at-least-32-bytes";
      failSigning = false;
      assert.equal(writes, 0);
      assert.equal(user.passwordHash, originalHash);
      assert.ok(await getCurrentAdminSession(token));
    });
    await t.test("troca pela URL de login recusa truncamento e reset simultâneo; resposta perdida permite recuperação", async () => {
      assert.equal((await changeViaLogin("á".repeat(37))).status, 400);
      concurrentReset = true;
      assert.equal((await changeViaLogin("New-password-12345")).status, 409);
      assert.equal(writes, 0); assert.equal(user.passwordHash, originalHash);
      concurrentReset = false;
      loseWriteResponse = true;
      assert.equal((await changeViaLogin("New-password-12345")).status, 503);
      loseWriteResponse = false;
      assert.equal(writes, 1); assert.equal(await getCurrentAdminSession(token), null);
      assert.equal(await bcrypt.compare("New-password-12345", user.passwordHash), true);
      assert.equal((await changeViaLogin("Wrong-password-12345")).status, 409);
      const recovered = await changeViaLogin("New-password-12345");
      assert.equal(recovered.status, 200);
      const renewedToken = recovered.cookies.get(ADMIN_SESSION_COOKIE)?.value;
      const renewedSession = await getCurrentAdminSession(renewedToken);
      assert.equal(renewedSession?.mustChangePassword, false);
      assert.equal(writes, 1);
      // Also recover when the cookie arrived but the response body was lost.
      const renewedRequest = request("/api/auth/login", { acao: "trocar-senha", novaSenha: "New-password-12345" });
      renewedRequest.headers.set("cookie", `${ADMIN_SESSION_COOKIE}=${renewedToken}`);
      assert.equal((await login(renewedRequest)).status, 200);
      assert.equal((await changePassword(request("/api/auth/change-password", { novaSenha: "New-password-12345" }))).status, 200);
      user.mustChangePassword = true;
      user.updatedAt = new Date(user.updatedAt.getTime() + 1);
      assert.equal((await changeViaLogin("New-password-12345")).status, 409);
      assert.equal(writes, 1);
    });
  } finally {
    Object.assign(prisma.user, { findUnique: originalFind, updateMany: originalUpdate });
    Object.assign(prisma, { $executeRawUnsafe: originalDDL });
    if (oldSecret === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = oldSecret;
  }
});
