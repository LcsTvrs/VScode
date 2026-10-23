import { readApiResponse } from "@/lib/api-response";

type AuthInput = { login: string; senha: string } | { acao: "trocar-senha"; novaSenha: string };

export async function submitAuth(input: AuthInput, fallback: string) {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(input),
    cache: "no-store",
  });
  return readApiResponse<{ ok: boolean; mustChangePassword?: boolean }>(response, fallback);
}
