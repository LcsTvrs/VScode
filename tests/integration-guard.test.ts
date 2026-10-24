import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("integração recusa execução sem autorização, banco remoto, produção e nome de banco inesperado", () => {
  const local = "postgresql://fixture@127.0.0.1:1/uniformes_refactor_test";
  for (const overrides of [
    { ALLOW_LOCAL_INTEGRATION: "" },
    { DATABASE_URL: "postgresql://fixture@remote.invalid/uniformes_refactor_test" },
    { NODE_ENV: "production" },
    { DIRECT_URL: "postgresql://fixture@127.0.0.1:1/outra_base" },
  ] as const) {
    const result = spawnSync(process.execPath, ["scripts/run-integration.mjs"], {
      encoding: "utf8", windowsHide: true,
      env: { ...process.env, VERCEL: "", NODE_ENV: "test", ALLOW_LOCAL_INTEGRATION: "1", DATABASE_URL: local, DIRECT_URL: local, ...overrides },
    });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Integração recusada/);
  }
});
