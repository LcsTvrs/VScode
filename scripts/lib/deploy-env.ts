export function deploymentEnvironmentErrors(env: Record<string, string | undefined>): string[] {
  const errors: string[] = [];
  for (const key of ["DATABASE_URL", "DIRECT_URL"]) {
    if (!env[key]) {
      errors.push(`${key}: variável obrigatória ausente.`);
      continue;
    }
    try {
      const url = new URL(env[key]);
      if (!["postgres:", "postgresql:"].includes(url.protocol) || !url.hostname || url.pathname.length <= 1) {
        errors.push(`${key}: informe uma conexão PostgreSQL válida com host e banco.`);
      } else if (env.VERCEL === "1" && /^(localhost|127\..*|\[::1\])$/i.test(url.hostname)) {
        errors.push(`${key}: a Vercel precisa de um banco acessível pela rede, fora do localhost.`);
      }
    } catch {
      // Never print the URL or the exception: either may contain credentials.
      errors.push(`${key}: formato de conexão inválido.`);
    }
  }
  if (Buffer.byteLength(env.ADMIN_SESSION_SECRET ?? "", "utf8") < 32) {
    errors.push("ADMIN_SESSION_SECRET: configure uma chave aleatória de pelo menos 32 bytes.");
  }
  // Existing accounts authenticate with their stored hash; this is only needed for provisioning.
  if (env.ADMIN_PASSWORD !== undefined && (env.ADMIN_PASSWORD.length < 12 || env.ADMIN_PASSWORD.length > 128)) {
    errors.push("ADMIN_PASSWORD: quando definida, deve conter de 12 a 128 caracteres.");
  }
  return errors;
}
