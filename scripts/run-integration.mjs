import { readFileSync, existsSync } from "node:fs";
import { parseEnv } from "node:util";
import { spawnSync } from "node:child_process";

const local = existsSync(".env.local") ? parseEnv(readFileSync(".env.local", "utf8")) : {};
const env = { ...local, ...process.env };
function safeDatabase(value) {
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol)
      && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      && url.pathname === "/uniformes_refactor_test";
  } catch { return false; }
}
if (env.ALLOW_LOCAL_INTEGRATION !== "1" || env.VERCEL || env.NODE_ENV === "production"
    || !safeDatabase(env.DATABASE_URL) || !safeDatabase(env.DIRECT_URL)
    || new URL(env.DATABASE_URL).host !== new URL(env.DIRECT_URL).host) {
  console.error("Integração recusada: exige autorização local e o banco isolado uniformes_refactor_test, com conexões coincidentes.");
  process.exit(1);
}
const result = spawnSync(process.execPath, ["node_modules/tsx/dist/cli.mjs", "--test", "tests/integration/business-flows.test.ts"], {
  env: { ...env, NODE_ENV: "test" }, stdio: "inherit", windowsHide: true,
});
process.exit(result.status ?? 1);
