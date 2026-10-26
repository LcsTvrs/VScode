"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { uniformGenderLabel } from "@/features/inventory/gender";
import { UniformPhoto } from "@/features/inventory/components/uniform-photo";
import { isSharedSector, requestSectors } from "../sectors";

export type CatalogVariant = {
  id: string; name: string; sector: string; category: string;
  gender: string | null; imageId: string | null; size: string; color: string;
};
const modelKey = (variant: CatalogVariant) => JSON.stringify([variant.name, variant.category, variant.color]);
const sorted = (values: string[]) => [...new Set(values)].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));

type Props = { variants: CatalogVariant[]; sectors?: string[]; quantities: Record<string, number>; limit: number; disabled: boolean; onAdd: (variant: CatalogVariant) => void };

export function UniformSelector({ variants, sectors, quantities, limit, disabled, onAdd }: Props) {
  const [sector, setSector] = useState("");
  const [model, setModel] = useState("");
  const [gender, setGender] = useState("");
  const [variantId, setVariantId] = useState("");
  const availableSectors = requestSectors(sectors ?? variants.map(variant => variant.sector));
  const needsSector = availableSectors.length > 0;
  const sectorVariants = variants.filter((variant) => variant.sector === sector || isSharedSector(variant.sector));
  const models = [...new Map(sectorVariants.map((variant) => [modelKey(variant), variant])).entries()];
  const modelVariants = sectorVariants.filter((variant) => modelKey(variant) === model);
  const genderVariants = modelVariants.filter((variant) => (variant.gender ?? "NAO_INFORMADO") === gender);
  const selected = genderVariants.find((variant) => variant.id === variantId);

  return <div className="uniform-picker">
    <div className="uniform-picker-fields">
      {needsSector ? <label className="public-field"><span>1. Setor</span><select value={sector} disabled={disabled} onChange={(event) => { setSector(event.target.value); setModel(""); setGender(""); setVariantId(""); }}><option value="">Selecione o setor</option>{availableSectors.map((value) => <option key={value} value={value}>{value}</option>)}</select></label> : <p className="request-limit-note">Uniformes disponíveis para todos os setores.</p>}
      <label className="public-field"><span>2. Uniforme</span><select value={model} disabled={disabled || (needsSector && !sector)} onChange={(event) => { setModel(event.target.value); setGender(""); setVariantId(""); }}><option value="">Selecione o uniforme</option>{models.map(([key, variant]) => <option key={key} value={key}>{[variant.name, variant.color].filter(Boolean).join(" · ")}</option>)}</select></label>
      <label className="public-field"><span>3. Classificação</span><select value={gender} disabled={disabled || !modelVariants.length} onChange={(event) => { setGender(event.target.value); setVariantId(""); }}><option value="">Selecione a classificação</option>{sorted(modelVariants.map((variant) => variant.gender ?? "NAO_INFORMADO")).map((value) => <option key={value} value={value}>{uniformGenderLabel(value)}</option>)}</select></label>
      <label className="public-field"><span>4. Tamanho</span><select value={selected?.id ?? ""} disabled={disabled || !genderVariants.length} onChange={(event) => setVariantId(event.target.value)}><option value="">Selecione o tamanho</option>{[...genderVariants].sort((a, b) => a.size.localeCompare(b.size, "pt-BR", { numeric: true }) || a.id.localeCompare(b.id)).map((variant) => <option key={variant.id} value={variant.id}>{variant.size}</option>)}</select></label>
    </div>
    {selected ? <div className="uniform-picker-preview"><UniformPhoto imageId={selected.imageId} name={selected.name} large /><div><strong>{selected.name}</strong><span>{[selected.sector, selected.color].filter(Boolean).join(" · ")}</span><small>{uniformGenderLabel(selected.gender)} · Tam. {selected.size}</small></div><button type="button" className="public-primary-button" disabled={disabled || (quantities[selected.id] ?? 0) >= limit} onClick={() => onAdd(selected)}><Plus size={16} /> Adicionar ao pedido</button></div> : <p className="request-limit-note">{needsSector ? "Selecione o setor para encontrar as peças. Apenas opções disponíveis são apresentadas." : "Selecione o uniforme para encontrar as peças. Apenas opções disponíveis são apresentadas."}</p>}
  </div>;
}
