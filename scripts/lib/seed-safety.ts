export function assertSafeSeed(env: Record<string, string | undefined>) {
  if (env.NODE_ENV === "production" || env.VERCEL || env.ALLOW_DESTRUCTIVE_SEED !== "true") {
    throw new Error("Seed bloqueado. Permitido somente em banco local descartável com ALLOW_DESTRUCTIVE_SEED=true.");
  }
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (key === "DIRECT_URL" && !env[key]) continue;
    let url: URL;
    try { url = new URL(env[key] ?? ""); } catch { throw new Error("Conexão local inválida para seed."); }
    if (!["postgres:", "postgresql:"].includes(url.protocol) || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) || !url.pathname.slice(1)) {
      throw new Error("Seed bloqueado: o banco deve ser local e descartável.");
    }
  }
}
