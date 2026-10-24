export class ApiResponseError extends Error {
  constructor(message: string, public status: number, public code?: string) {
    super(message);
    this.name = "ApiResponseError";
  }
}

// Read once; preserve status/code for callers that handle conflicts or redirects.
// Never retry automatically: a lost response may represent a successful write.
export async function readApiResponse<T>(response: Response, fallback: string): Promise<T> {
  if (response.status === 429) {
    throw new ApiResponseError("Muitas tentativas em pouco tempo. Aguarde um minuto e tente novamente.", 429);
  }
  if (response.status === 204 && response.ok) return undefined as T;
  const data: unknown = await response.json().catch(() => null);
  const record = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
  if (!response.ok) {
    const message = typeof record?.message === "string" && record.message.trim() ? record.message : fallback;
    throw new ApiResponseError(message, response.status, typeof record?.code === "string" ? record.code : undefined);
  }
  if (!record) throw new ApiResponseError(fallback, response.status);
  return record as T;
}
