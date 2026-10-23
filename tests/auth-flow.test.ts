import assert from "node:assert/strict";
import { test } from "node:test";
import { POST as login } from "../src/app/api/auth/login/route";
import { submitAuth } from "../src/lib/auth-client";

test("troca pela URL de login continua exigindo sessão; ação desconhecida é recusada", async () => {
  for (const cookie of ["", "uniformes-admin-session=invalid-token"]) {
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
});

test("login e troca enviam JSON e cookies pelo mesmo endpoint, com nova tentativa após HTML", async t => {
  const sent: { url: unknown; options: RequestInit | undefined }[] = [];
  let fail = false;
  t.mock.method(globalThis, "fetch", async (url: unknown, options?: RequestInit) => {
    sent.push({ url, options });
    return fail
      ? new Response("<!DOCTYPE html><html>Unavailable</html>", { status: 502 })
      : Response.json({ ok: true });
  });
  const credentials = { login: "admin", senha: "Temporary-12345" };
  const change = { acao: "trocar-senha" as const, novaSenha: "New-password-12345" };
  await submitAuth(credentials, "Falha de login.");
  fail = true;
  await assert.rejects(submitAuth(change, "Tente novamente."), { message: "Tente novamente." });
  fail = false;
  assert.deepEqual(await submitAuth(change, "Tente novamente."), { ok: true });
  for (const [index, { url, options }] of sent.entries()) {
    assert.equal(url, "/api/auth/login");
    assert.equal(options?.method, "POST");
    assert.equal(options?.credentials, "same-origin");
    assert.equal(options?.cache, "no-store");
    assert.equal(new Headers(options?.headers).get("content-type"), "application/json");
    assert.deepEqual(JSON.parse(String(options?.body)), index === 0 ? credentials : change);
  }
});
