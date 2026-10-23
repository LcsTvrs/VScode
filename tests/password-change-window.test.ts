import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma";
import { middleware } from "../src/middleware";
import { createAdminSession, verifyAdminSession, ADMIN_SESSION_COOKIE, type AdminSession } from "../src/lib/admin-session";
import { newPasswordChangeDeadline, isPasswordChangeOverdue, PASSWORD_CHANGE_WINDOW_MS } from "../src/lib/password-change-window";
import { POST as login } from "../src/app/api/auth/login/route";
import { PATCH as changePassword } from "../src/app/api/auth/change-password/route";
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

test("prazo dura 48 horas e bloqueia exatamente no vencimento", () => {
  const start = Date.now();
  const deadline = newPasswordChangeDeadline(start).getTime();
  assert.equal(deadline - start, 48 * 60 * 60 * 1000);
  assert.equal(isPasswordChangeOverdue({ mustChangePassword: true, passwordChangeDeadline: deadline }, deadline - 1), false);
  assert.equal(isPasswordChangeOverdue({ mustChangePassword: true, passwordChangeDeadline: deadline }, deadline), true);
  assert.equal(isPasswordChangeOverdue({ mustChangePassword: false, passwordChangeDeadline: deadline }, deadline + 1), false);
  assert.equal(isPasswordChangeOverdue({ mustChangePassword: true }, start), true);
});

test("painel e APIs liberados durante a janela; prazo vencido preserva PATCH de troca e proteção de origem", async t => {
  useTestSecret(t);
  for (const role of ["MASTER_ADMIN", "STORE_ADMIN"] as const) {
    for (const overdue of [false, true]) {
      const session: AdminSession = { userId: "admin", login: "admin", role, storeId: role === "STORE_ADMIN" ? "loja" : null, mustChangePassword: true, passwordChangeDeadline: Date.now() + (overdue ? -1000 : PASSWORD_CHANGE_WINDOW_MS), userUpdatedAt: Date.now() };
      const cookie = `${ADMIN_SESSION_COOKIE}=${await createAdminSession(session)}`;
      for (const path of ["/", "/admin/usuarios", "/api/dashboard", "/api/inventory"]) {
        const response = await middleware(new NextRequest(`https://app.example${path}`, { headers: { cookie } }));
        if (!overdue) assert.equal(response.headers.get("x-middleware-next"), "1");
        else if (path.startsWith("/api/")) assert.equal(response.status, 403);
        else assert.equal(new URL(response.headers.get("location")!).pathname, "/admin/trocar-senha");
      }
      const patch = new NextRequest("https://app.example/api/auth/change-password", { method: "PATCH", headers: { cookie, Origin: "https://app.example" } });
      assert.equal((await middleware(patch)).headers.get("x-middleware-next"), "1");
      patch.headers.set("origin", "https://evil.example");
      assert.equal((await middleware(patch)).status, 403);
    }
  }
});

test("login não prorroga prazo; banco controla painel e PATCH funciona mesmo depois das 48 horas", async t => {
  useTestSecret(t);
  const version = new Date(Date.now() - 1000);
  const user = { id: "admin", login: "admin", name: "Admin", role: "MASTER_ADMIN" as const, storeId: null, mustChangePassword: true, passwordChangeDeadline: newPasswordChangeDeadline(), updatedAt: version, passwordHash: await bcrypt.hash("Temporary-12345", 4) };
  replace(t, prisma.user, "findUnique", async () => ({ ...user }));
  replace(t, prisma.store, "findMany", async () => []);
  replace(t, prisma.user, "updateMany", async ({ data }: { data: object }) => { Object.assign(user, data); return { count: 1 }; });
  const loginRequest = () => new Request("https://app.example/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login: "admin", senha: "Temporary-12345" }) });
  let token = "";
  for (let attempt = 0; attempt < 2; attempt++) {
    const response = await login(loginRequest());
    assert.equal(response.status, 200);
    token = response.cookies.get(ADMIN_SESSION_COOKIE)!.value;
    assert.equal((await verifyAdminSession(token))?.passwordChangeDeadline, user.passwordChangeDeadline.getTime());
  }
  const request = () => new Request("https://app.example/api/dashboard", { headers: { cookie: `${ADMIN_SESSION_COOKIE}=${token}` } });
  const panel = await dashboard(request());
  assert.equal(panel.status, 200);
  assert.equal((await panel.json()).account.passwordChangeDeadline, user.passwordChangeDeadline.toISOString());
  // Even a token claiming a future deadline cannot bypass the database deadline.
  user.passwordChangeDeadline = new Date(Date.now() - 1000);
  assert.equal((await dashboard(request())).status, 403);
  const changed = await changePassword(new Request("https://app.example/api/auth/change-password", { method: "PATCH", headers: { "Content-Type": "application/json", cookie: `${ADMIN_SESSION_COOKIE}=${token}` }, body: JSON.stringify({ novaSenha: "New-password-12345" }) }));
  assert.equal(changed.status, 200);
  assert.equal(user.mustChangePassword, false);
  assert.equal(user.passwordChangeDeadline, null);
  assert.equal((await verifyAdminSession(changed.cookies.get(ADMIN_SESSION_COOKIE)!.value))?.passwordChangeDeadline, null);
});

test("cadastro/reset persistem prazo de 48h; editar cadastro não reinicia o prazo", async t => {
  useTestSecret(t);
  const version = new Date();
  const user = { id: "admin", login: "admin", name: "Admin", role: "MASTER_ADMIN" as const, storeId: null, mustChangePassword: false, passwordChangeDeadline: null as Date | null, updatedAt: version };
  replace(t, prisma.user, "findUnique", async () => ({ ...user }));
  replace(t, prisma.user, "update", async ({ data }: { data: object }) => { Object.assign(user, data); user.updatedAt = new Date(user.updatedAt.getTime() + 1); return { ...user }; });
  let createdDeadline: Date | null = null;
  replace(t, prisma.user, "create", async ({ data }: { data: { passwordChangeDeadline: Date } }) => { createdDeadline = data.passwordChangeDeadline; return { ...data, id: "created" }; });
  let token = await createAdminSession({ userId: user.id, login: user.login, role: user.role, storeId: null, mustChangePassword: false, userUpdatedAt: version.getTime() });
  const request = (url: string, method: string, body?: object) => new Request(`https://app.example${url}`, { method, headers: { "Content-Type": "application/json", cookie: `${ADMIN_SESSION_COOKIE}=${token}` }, body: body ? JSON.stringify(body) : undefined });
  const start = Date.now();
  assert.equal((await createUser(request("/api/users", "POST", { login: "novo", name: "Novo admin", role: "MASTER_ADMIN" }))).status, 201);
  assert.ok(createdDeadline && new Date(createdDeadline).getTime() >= start + PASSWORD_CHANGE_WINDOW_MS);
  const resetResponse = await reset(request("/api/users/admin/reset", "POST"), { params: Promise.resolve({ id: "admin" }) });
  assert.equal(resetResponse.status, 200);
  const deadline = user.passwordChangeDeadline!.getTime();
  assert.ok(deadline >= start + PASSWORD_CHANGE_WINDOW_MS && deadline <= Date.now() + PASSWORD_CHANGE_WINDOW_MS);
  token = resetResponse.cookies.get(ADMIN_SESSION_COOKIE)!.value;
  assert.equal((await verifyAdminSession(token))?.passwordChangeDeadline, deadline);
  assert.equal((await editUser(request("/api/users/admin", "PUT", { login: "admin", name: "Admin editado", role: "MASTER_ADMIN" }), { params: Promise.resolve({ id: "admin" }) })).status, 200);
  assert.equal(user.passwordChangeDeadline!.getTime(), deadline);
});
