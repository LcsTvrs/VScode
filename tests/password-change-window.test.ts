import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { test, type TestContext } from "node:test";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { middleware } from "../src/middleware";
import { createAdminSession, verifyAdminSession, ADMIN_SESSION_COOKIE, type AdminSession } from "../src/lib/admin-session";
import { POST as login } from "../src/app/api/auth/login/route";
import { POST as changePassword } from "../src/app/api/auth/login/route";
import { GET as dashboard } from "../src/app/api/dashboard/route";
import { POST as reset } from "../src/app/api/users/[id]/reset/route";
import { PUT as editUser } from "../src/app/api/users/[id]/route";
import { POST as createUser } from "../src/app/api/users/route";

function useTestSecret(t: TestContext) {
  const previous = process.env.ADMIN_SESSION_SECRET;
  process.env.ADMIN_SESSION_SECRET = "password-window-test-secret-at-least-32-bytes";
  t.after(() => { if (previous === undefined) delete process.env.ADMIN_SESSION_SECRET; else process.env.ADMIN_SESSION_SECRET = previous; });
}

function replace(t: TestContext, target: object, key: string, value: unknown) {
  const object = target as Record<string, unknown>;
  const original = object[key];
  object[key] = value;
  t.after(() => { object[key] = original; });
}

test("senha temporária bloqueia painel e APIs imediatamente, inclusive com prazo legado futuro", async t => {
  useTestSecret(t);
  for (const role of ["MASTER_ADMIN", "STORE_ADMIN"] as const) {
    for (const deadline of [null, Date.now() - 1000, Date.now() + 48 * 60 * 60 * 1000]) {
      const session: AdminSession = { userId: "admin", login: "admin", role, storeId: role === "STORE_ADMIN" ? "loja" : null, mustChangePassword: true, passwordChangeDeadline: deadline, userUpdatedAt: Date.now() };
      const cookie = `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}`;
      for (const path of ["/", "/admin/usuarios", "/api/dashboard", "/api/inventory"]) {
        const response = await middleware(new NextRequest(`https://app.example${path}`, { headers: { cookie } }));
        if (path.startsWith("/api/")) assert.equal(response.status, 403);
        else assert.equal(new URL(response.headers.get("location")!).pathname, "/admin/trocar-senha");
      }
      for (const path of ["/admin/trocar-senha", "/api/auth/logout", "/api/auth/change-password"]) {
        assert.equal((await middleware(new NextRequest(`https://app.example${path}`, { headers: { cookie } }))).headers.get("x-middleware-next"), "1");
      }
      const patch = new NextRequest("https://app.example/api/auth/login", { method: "PATCH", headers: { cookie, Origin: "https://app.example" } });
      assert.equal((await middleware(patch)).headers.get("x-middleware-next"), "1");
      patch.headers.set("origin", "https://evil.example");
      assert.equal((await middleware(patch)).status, 403);
    }
  }
});

test("APIs recusam a senha temporária com prazo futuro sem depender do middleware", async t => {
  useTestSecret(t);
  const routes = [
    ["../src/app/api/dashboard/route", ["GET"]],
    ["../src/app/api/inventory/route", ["POST", "PATCH"]],
    ["../src/app/api/inventory/import/route", ["POST"]],
    ["../src/app/api/inventory/import/preview/route", ["POST"]],
    ["../src/app/api/variants/route", ["POST"]],
    ["../src/app/api/variants/[id]/image/route", ["GET", "POST"]],
    ["../src/app/api/requests/route", ["POST"]],
    ["../src/app/api/requests/[id]/route", ["GET", "PUT", "PATCH"]],
    ["../src/app/api/exports/inventory/route", ["GET"]],
    ["../src/app/api/exports/requests/route", ["GET"]],
    ["../src/app/api/users/route", ["GET", "POST"]],
    ["../src/app/api/users/[id]/route", ["PUT", "DELETE"]],
    ["../src/app/api/users/[id]/reset/route", ["POST"]],
    ["../src/app/api/stores/route", ["GET", "POST"]],
    ["../src/app/api/stores/[id]/route", ["PUT", "DELETE"]],
  ] as const;
  for (const role of ["MASTER_ADMIN", "STORE_ADMIN"] as const) {
    const user = { id: "admin", login: "admin", name: "Admin", role, storeId: role === "STORE_ADMIN" ? "loja" : null, mustChangePassword: true, passwordChangeDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), updatedAt: new Date() };
    replace(t, prisma.user, "findUnique", async () => user);
    const cookie = `${ADMIN_SESSION_COOKIE}=${await createAdminSession({ userId: user.id, ...user, passwordChangeDeadline: user.passwordChangeDeadline.getTime(), userUpdatedAt: user.updatedAt.getTime() })}`;
    for (const [path, methods] of routes) {
      const handlers = await import(path);
      for (const method of methods) {
        const response = await handlers[method](new Request("https://app.example/api/test", { method, headers: { cookie } }), { params: Promise.resolve({ id: "target" }) });
        assert.equal(response.status, 403, `${role} ${method} ${path}`);
      }
    }
  }
});

test("login temporário bloqueia painel; troca POST libera acesso sem repetir a assinatura bloqueada", async t => {
  useTestSecret(t);
  const version = new Date(Date.now() - 1000);
  const user = { id: "admin", login: "admin", name: "Admin", role: "MASTER_ADMIN" as const, storeId: null, mustChangePassword: true, passwordChangeDeadline: new Date(Date.now() + 48 * 60 * 60 * 1000), updatedAt: version, passwordHash: await bcrypt.hash("Temporary-12345", 4) };
  replace(t, prisma.user, "findUnique", async () => ({ ...user }));
  replace(t, prisma.store, "findMany", async () => []);
  replace(t, prisma.user, "updateMany", async ({ data }: { data: object }) => { Object.assign(user, data); return { count: 1 }; });
  const loginRequest = () => new Request("https://app.example/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: "admin", senha: "Temporary-12345" }) });
  let token = "";
  let loginBody = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await login(loginRequest());
    assert.equal(response.status, 200);
    token = response.cookies.get(ADMIN_SESSION_COOKIE)!.value;
    loginBody = await response.text();
    assert.equal((await verifyAdminSession(token))?.passwordChangeDeadline, user.passwordChangeDeadline.getTime());
  }
  const request = () => new Request("https://app.example/api/dashboard", { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` } });
  const panel = await dashboard(request());
  assert.equal(panel.status, 403);
  assert.equal((await panel.json()).code, "PASSWORD_CHANGE_REQUIRED");
  // Legacy past/future deadlines never grant access while change is pending.
  user.passwordChangeDeadline = new Date(Date.now() - 1000);
  assert.equal((await dashboard(request())).status, 403);
  const changed = await changePassword(new Request("https://app.example/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json", cookie: `${ADMIN_SESSION_COOKIE}=${token}` }, body: JSON.stringify({ acao: "trocar-senha", novaSenha: "New-password-12345" }) }));
  assert.equal(changed.status, 200);
  const changedBody = await changed.text();
  assert.deepEqual(JSON.parse(changedBody), { ...JSON.parse(loginBody), mustChangePassword: false });
  assert.notEqual(createHash("sha256").update(changedBody).digest("hex"), "4062edaf750fb8074e7e83e0c9028c94e32468a8b6f1614774328ef045150f93", "A resposta não deve repetir o corpo genérico identificado na lista externa.");
  assert.equal(user.mustChangePassword, false);
  assert.equal(user.passwordChangeDeadline, null);
  const definitiveLogin = await login(new Request("https://app.example/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: "admin", senha: "New-password-12345" }) }));
  assert.equal(definitiveLogin.status, 200);
  assert.equal(await definitiveLogin.text(), changedBody);
  token = changed.cookies.get(ADMIN_SESSION_COOKIE)!.value;
  assert.equal((await verifyAdminSession(token))?.passwordChangeDeadline, null);
  assert.equal((await dashboard(request())).status, 200);
});

test("cadastro/reset exigem troca sem carência e reset próprio bloqueia edição até concluir troca", async t => {
  useTestSecret(t);
  const version = new Date();
  const user = { id: "admin", login: "admin", name: "Admin", role: "MASTER_ADMIN" as const, storeId: null, mustChangePassword: false, passwordChangeDeadline: null as Date | null, updatedAt: version };
  replace(t, prisma.user, "findUnique", async () => ({ ...user }));
  replace(t, prisma.user, "update", async ({ data }: { data: object }) => { Object.assign(user, data); user.updatedAt = new Date(user.updatedAt.getTime() + 1); return { ...user }; });
  let createdData: { passwordChangeDeadline: null; mustChangePassword: boolean } | undefined;
  replace(t, prisma.user, "create", async ({ data }: { data: { passwordChangeDeadline: null; mustChangePassword: boolean } }) => { createdData = data; return { ...data, id: "created" }; });
  let token = await createAdminSession({ userId: user.id, login: user.login, role: user.role, storeId: null, mustChangePassword: false, userUpdatedAt: version.getTime() });
  const request = (url: string, method: string, body?: object) => new Request(`https://app.example${url}`, { method, headers: { "Content-Type": "application/json", cookie: `${ADMIN_SESSION_COOKIE}=${token}` }, body: body ? JSON.stringify(body) : undefined });
  assert.equal((await createUser(request("/api/users", "POST", { login: "novo", name: "Novo admin", role: "MASTER_ADMIN" }))).status, 201);
  assert.equal(createdData?.passwordChangeDeadline, null);
  assert.equal(createdData?.mustChangePassword, true);
  const resetResponse = await reset(request("/api/users/admin/reset", "POST"), { params: Promise.resolve({ id: "admin" }) });
  assert.equal(resetResponse.status, 200);
  assert.equal(user.passwordChangeDeadline, null);
  assert.equal(user.mustChangePassword, true);
  token = resetResponse.cookies.get(ADMIN_SESSION_COOKIE)!.value;
  assert.equal((await verifyAdminSession(token))?.mustChangePassword, true);
  assert.equal((await editUser(request("/api/users/admin", "PUT", { login: "admin", name: "Admin editado", role: "MASTER_ADMIN" }), { params: Promise.resolve({ id: "admin" }) })).status, 403);
  assert.equal(user.passwordChangeDeadline, null);
});
