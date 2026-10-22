import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { join } from "node:path";

const probe = createServer();
await new Promise((resolve, reject) => {
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", resolve);
});
const port = probe.address().port;
await new Promise((resolve) => probe.close(resolve));

const server = spawn(process.execPath, [join("node_modules", "next", "dist", "bin", "next"), "start", "--hostname", "127.0.0.1", "--port", String(port)], {
  stdio: "ignore",
  windowsHide: true,
  env: {
    ...process.env,
    NODE_ENV: "production",
    // These checks must never reach a real database, even if local .env files point to one.
    DATABASE_URL: "postgresql://smoke:smoke@127.0.0.1:1/unused?connect_timeout=1",
    DIRECT_URL: "postgresql://smoke:smoke@127.0.0.1:1/unused?connect_timeout=1",
    ADMIN_SESSION_SECRET: "local-smoke-test-secret-with-at-least-32-bytes",
  },
});
let startupError;
server.once("error", (error) => { startupError = error; });
const base = `http://127.0.0.1:${port}`;
let checks = 0;

async function check(path, status, options = {}) {
  const response = await fetch(`${base}${path}`, { ...options, redirect: "manual", signal: AbortSignal.timeout(10000) });
  assert.equal(response.status, status, `${options.method ?? "GET"} ${path}`);
  checks++;
  return response;
}

try {
  let ready = false;
  for (let attempt = 0; attempt < 60; attempt++) {
    if (startupError || server.exitCode !== null) throw new Error("O servidor de teste não iniciou.");
    try {
      const response = await fetch(`${base}/solicitar`, { signal: AbortSignal.timeout(1000) });
      if (response.status === 200) { ready = true; break; }
    } catch { /* Server is still starting. */ }
    await delay(500);
  }
  assert.ok(ready, "O build não ficou disponível para os testes HTTP.");
  const page = await check("/solicitar", 200);
  const html = await page.text();
  assert.ok(html.includes("Exatamente 8 números"));
  assert.ok(html.includes("Nome completo"));
  const cssFiles = [...new Set([...html.matchAll(/href="([^\"]*\/_next\/static\/css\/[^\"]+)"/g)].map((match) => match[1].replaceAll("&amp;", "&")))];
  assert.ok(cssFiles.length, "O formulário deve carregar o CSS compilado.");
  for (const css of cssFiles) {
    const response = await check(css, 200);
    assert.match(response.headers.get("content-type") ?? "", /text\/css/);
  }
  await check("/admin/login", 200);
  await check("/leroy-merlin.svg", 200);
  const redirect = await check("/", 307);
  assert.ok(redirect.headers.get("location")?.includes("/admin/login"));
  await check("/api/dashboard", 401);
  await check("/api/variants/item/image", 401, { method: "POST" });
  await check("/api/auth/login", 403, { method: "POST", headers: { Origin: "https://untrusted.example", "Content-Type": "application/json" }, body: "{}" });
  await check("/api/requests/public", 403, { method: "POST", headers: { Origin: "null", "Content-Type": "application/json" }, body: "{}" });
  await check("/api/requests/smoke-request", 401);
  await check("/api/requests/smoke-request", 401, { method: "PUT" });
  await check("/api/requests/public", 400, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ldap: "00123456", name: "Ana Silva", items: [{ variantId: "camisa", quantity: 4 }] }),
  });
  await check("/api/inventory/import/preview", 401, { method: "POST" });
  await check("/api/inventory/import", 401, { method: "POST" });
  const template = await check("/modelo-entrada-estoque.xlsx", 200);
  assert.match(template.headers.get("content-type") ?? "", /spreadsheetml/);
  for (const input of [{ ldap: "123", name: "Ana Silva" }, { ldap: "00123456", name: "Ana2" }]) {
    await check("/api/requests/public", 400, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
    });
  }
  console.log(`${checks} verificações HTTP passaram: páginas, CSS, logo, proteção de acesso e validação de identificação. Banco real inacessível ao teste.`);
} finally {
  server.kill();
}
