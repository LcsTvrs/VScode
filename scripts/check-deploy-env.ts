import { existsSync, readFileSync } from "node:fs";
import { parseEnv } from "node:util";
import { deploymentEnvironmentErrors } from "./lib/deploy-env";

try {
  // Match the local production build's precedence; hosted builds use only platform variables.
  let fileEnv: Record<string, string | undefined> = {};
  if (process.env.VERCEL !== "1") {
    for (const file of [".env", ".env.production", ".env.local", ".env.production.local"]) {
      if (existsSync(file)) fileEnv = { ...fileEnv, ...parseEnv(readFileSync(file, "utf8")) };
    }
  }
  const errors = deploymentEnvironmentErrors({ ...fileEnv, ...process.env });
  if (errors.length) {
    console.error("Configuração de deploy incompleta:");
    for (const error of errors) console.error(`- ${error}`);
    process.exitCode = 1;
  } else {
    console.log("Configuração de deploy válida (formato e presença; sem conexão ao banco e sem exibir valores).");
  }
} catch {
  console.error("Não foi possível ler a configuração local de deploy. Revise os arquivos de ambiente.");
  process.exitCode = 1;
}
