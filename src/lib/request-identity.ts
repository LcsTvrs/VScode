// Keep LDAP as text so leading zeroes remain part of the employee identifier.
export const LDAP_PATTERN = "[0-9]{8}";
export const FULL_NAME_PATTERN = String.raw` *(?:\p{L}\p{M}*)+(?: +(?:\p{L}\p{M}*)+)* *`;

const fullNameRegex = new RegExp(`^(?:${FULL_NAME_PATTERN})$`, "u");

type IdentityResult =
  | { ok: true; ldap: string; name: string }
  | { ok: false; message: string };

export function validateRequestIdentity(ldap: unknown, name: unknown): IdentityResult {
  if (typeof ldap !== "string" || ldap.length !== 8 || !/^[0-9]{8}$/.test(ldap)) {
    return { ok: false, message: "O LDAP deve conter exatamente 8 números." };
  }
  if (typeof name !== "string" || !name || fullNameRegex.exec(name)?.[0] !== name) {
    return { ok: false, message: "Informe o nome completo usando apenas letras, acentos e espaços." };
  }
  return { ok: true, ldap, name: name.normalize("NFC").trim().replace(/ +/g, " ") };
}
