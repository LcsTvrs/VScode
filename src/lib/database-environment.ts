import { createHash } from "node:crypto";

type Environment = Record<string, string | undefined>;

function neonEndpoint(value: string | undefined): string {
  try {
    const url = new URL(value ?? "");
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname.endsWith(".neon.tech") || url.pathname.length < 2) throw new Error();
    return url.hostname.toLowerCase().replace(/-pooler(?=\.)/, "");
  } catch {
    throw new Error("Preview exige uma conexão Neon válida fornecida pela integração.");
  }
}

export function databaseEnvironment(env: Environment): Environment {
  if (env.VERCEL_ENV !== "preview") return env;
  // The existing native integration injects these per-deployment branch URLs.
  // Never fall back to manually copied DATABASE_URL or DIRECT_URL in Preview.
  const pooled = env.DIRECT_DATABASE_URL;
  const direct = env.DIRECT_DATABASE_URL_UNPOOLED;
  const endpoint = neonEndpoint(pooled);
  if (endpoint !== neonEndpoint(direct)) throw new Error("As conexões de Preview devem apontar para o mesmo endpoint Neon.");
  const production = env.PREVIEW_PRODUCTION_ENDPOINT_SHA256;
  if (!production || !/^[a-f0-9]{64}$/.test(production)) throw new Error("Configure a identificação do endpoint de produção antes de usar Preview.");
  if (createHash("sha256").update(endpoint).digest("hex") === production) throw new Error("Preview bloqueado: a integração forneceu o endpoint de produção.");
  return { ...env, DATABASE_URL: pooled, DIRECT_URL: direct };
}
