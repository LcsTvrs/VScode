import { spawnSync } from "node:child_process";
import { databaseEnvironment } from "../src/lib/database-environment";

try {
  const env = { ...process.env, ...databaseEnvironment(process.env) };
  const npm = process.env.npm_execpath;
  if (!npm) throw new Error("Execute o build com npm run vercel-build.");
  if (env.VERCEL_ENV === "preview") console.log("Preview: conexões Neon consistentes e endpoint diferente de produção.");
  for (const script of ["check:deploy-env", "verify"]) {
    const result = spawnSync(process.execPath, [npm, "run", script], { env, stdio: "inherit", windowsHide: true });
    if (result.status !== 0) { process.exitCode = result.status ?? 1; break; }
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : "Não foi possível validar o ambiente de build.");
  process.exitCode = 1;
}
