import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as login, PATCH as changeViaLogin } from "../src/app/api/auth/login/route";
import { submitAuth } from "../src/features/auth/client";
import { PATCH as changePassword } from "../src/app/api/auth/change-password/route";
import { POST as logout } from "../src/app/api/auth/logout/route";

test("logout informa sessão encerrada e expira o cookie sem repetir a resposta genérica bloqueada", async () => {
  const response = await logout();
  assert.deepEqual(await response.json(), { ok: true, authenticated: false });
  assert.match(response.headers.get("set-cookie")!, /Max-Age=0/i);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("troca pela URL de login continua exigindo sessão; ação desconhecida é recusada", async () => {
  for (const cookie of ["", "uniformes-admin-session=invalid-token"]) {
    const current = await changeViaLogin(new Request("https://app.example/api/auth/login", {
      method: "PATCH", headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ acao: "trocar-senha", novaSenha: "New-password-12345" }),
    }));
    assert.equal(current.status, 401);
    assert.equal(current.headers.get("set-cookie"), null);
    const patched = await changePassword(new Request("https://app.example/api/auth/change-password", {
      method: "PATCH", headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ novaSenha: "New-password-12345" }),
    }));
    assert.equal(patched.status, 401);
    const response = await login(new Request("https://app.example/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json", cookie },
      body: JSON.stringify({ acao: "trocar-senha", novaSenha: "New-password-12345" }),
    }));
    assert.equal(response.status, 401);
    assert.match((await response.json()).message, /Sessão inválida/);
    assert.equal(response.headers.get("set-cookie"), null);
  }
  const response = await login(new Request("https://app.example/api/auth/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ acao: "invalid", login: "admin", senha: "Temporary-12345" }),
  }));
  assert.equal(response.status, 400);
  for (const body of [{}, { login: "admin", senha: "Temporary-12345" }, { acao: "invalid", novaSenha: "New-password-12345" }]) {
    assert.equal((await changeViaLogin(new Request("https://app.example/api/auth/login", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }))).status, 400);
  }
});

test("troca e login usam o mesmo POST JSON com cookies e permitem nova tentativa após HTML", async t => {
  const sent: { url: unknown; options: RequestInit | undefined }[] = [];
  let fail = false;
  t.mock.method(globalThis, "fetch", async (url: unknown, options?: RequestInit) => {
    sent.push({ url, options });
    return fail
      ? new Response("<!DOCTYPE html><html>Unavailable</html>", { status: 502 })
      : Response.json({ ok: true, mustChangePassword: false });
  });
  const credentials = { login: "admin", senha: "Temporary-12345" };
  const change = { acao: "trocar-senha" as const, novaSenha: "New-password-12345" };
  await submitAuth(credentials, "Falha de login.");
  fail = true;
  await assert.rejects(submitAuth(change, "Tente novamente."), { message: "Tente novamente." });
  fail = false;
  assert.deepEqual(await submitAuth(change, "Tente novamente."), { ok: true, mustChangePassword: false });
  for (const [index, { url, options }] of sent.entries()) {
    assert.equal(url, "/api/auth/login");
    assert.equal(options?.method, "POST");
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.cache, "no-store");
    assert.equal(new Headers(options?.headers).get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(String(options?.body)), index === 0 ? credentials : change);
  }
});
