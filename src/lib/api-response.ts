// Proxies and the firewall can return HTML/text instead of the application's JSON.
export async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  if (response.status === 429) {
    throw new Error("Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.");
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = data && typeof data === "object" && "message" in data ? data.message : null;
    throw new Error(typeof message === "string" && message.trim() ? message : fallback);
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error(fallback);
  return data as T;
}
