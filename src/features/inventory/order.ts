import { uniformGenderLabel } from "./gender";
import type { UniformGenderValue } from "./gender";

const collator = new Intl.Collator("pt-BR", { numeric: true, sensitivity: "base" });
const sizes = ["PP", "P", "M", "G", "GG", "XG", "XGG", "EXG", "EXGG"];
type OrderedUniform = { name: string; gender: UniformGenderValue | null; size: string; sku: string };

export function compareUniforms(a: OrderedUniform, b: OrderedUniform) {
  const name = collator.compare(a.name, b.name);
  const gender = collator.compare(uniformGenderLabel(a.gender), uniformGenderLabel(b.gender));
  const left = a.size.trim().toUpperCase();
  const right = b.size.trim().toUpperCase();
  const size = sizes.includes(left) && sizes.includes(right)
    ? sizes.indexOf(left) - sizes.indexOf(right) : collator.compare(left, right);
  return name || gender || size || collator.compare(a.sku, b.sku);
}
