export type UniformGenderValue = "MASCULINO" | "FEMININO";

export function isUniformGender(value: unknown): value is UniformGenderValue {
  return value === "MASCULINO" || value === "FEMININO";
}

export function uniformGenderLabel(value: string | null | undefined) {
  return value === "MASCULINO" ? "Masculino" : value === "FEMININO" ? "Feminino" : "Não informado";
}
