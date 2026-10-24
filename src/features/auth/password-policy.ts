export const PASSWORD_POLICY_MESSAGE = "Use pelo menos 12 caracteres e no máximo 72 bytes (acentos e emojis ocupam mais de um byte).";

export function validNewPassword(value: unknown): value is string {
  return typeof value === "string" && value.length >= 12 && new TextEncoder().encode(value).byteLength <= 72;
}
