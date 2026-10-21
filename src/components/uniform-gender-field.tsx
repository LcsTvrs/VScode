import type { UniformGenderValue } from "@/lib/uniform-gender";

export function UniformGenderField({ value, allowUnknown = false }: { value?: UniformGenderValue | null; allowUnknown?: boolean }) {
  return <label className="form-field"><span>Classificação do uniforme</span>
    <select name="gender" required={!allowUnknown} defaultValue={value ?? ""}>
      <option value="" disabled={!allowUnknown}>{allowUnknown ? "Não informado" : "Selecione Masculino ou Feminino"}</option>
      <option value="MASCULINO">Masculino</option><option value="FEMININO">Feminino</option>
    </select>
  </label>;
}
