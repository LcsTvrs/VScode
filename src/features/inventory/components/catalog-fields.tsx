"use client";

import { readApiResponse } from "@/lib/api-response";
import type { Variant } from "@/features/dashboard/types";
import { useEffect, useState } from "react";
import { categoryNames } from "../labels";
import { UniformGenderField } from "./gender-field";

export type CatalogOptions = { sectors: string[]; categories: string[] };

export function useCatalogOptions() {
  const [options, setOptions] = useState<CatalogOptions | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/api/catalog/options", { cache: "no-store", signal: controller.signal })
      .then(response => readApiResponse<CatalogOptions>(response, "Não foi possível carregar setores e categorias."))
      .then(setOptions).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha ao carregar opções."); });
    return () => controller.abort();
  }, []);
  return { options, setOptions, error, setError };
}

export function CatalogFields({ variant }: { variant?: Variant | null }) {
  const { options, error } = useCatalogOptions();
  const [sector, setSector] = useState(variant?.sector ?? "");
  const [category, setCategory] = useState(variant?.category ?? "");
  return <div className="form-grid">
    <p className="edit-stock-note span-two">Este cadastro vale para todas as lojas. Quantidade e estoque mínimo são ajustados separadamente no estoque de cada loja.</p>
    {error ? <p className="form-error span-two" role="alert">{error} Feche e reabra o cadastro para tentar novamente.</p> : null}
    <label className="form-field span-two"><span>Setor</span><select aria-label="Setor" name="sector" value={sector} onChange={event => setSector(event.target.value)} required><option value="" disabled>Selecione um setor</option>{options?.sectors.map(name => <option key={name} value={name}>{name}</option>)}</select></label>
    <UniformGenderField value={variant?.gender} />
    <label className="form-field span-two"><span>Nome do uniforme</span><input name="name" defaultValue={variant?.name} required maxLength={100} /></label>
    <label className="form-field"><span>Categoria</span><select aria-label="Categoria" name="category" value={category} onChange={event => setCategory(event.target.value)} required><option value="" disabled>Selecione uma categoria</option>{options?.categories.map(name => <option key={name} value={name}>{categoryNames[name] ?? name}</option>)}</select></label>
    <label className="form-field"><span>SKU</span><input aria-label="SKU" name="sku" defaultValue={variant?.sku} readOnly={!!variant} required maxLength={40} /><small>{variant ? "O SKU identifica o item em todas as lojas." : "Identificador único em todas as lojas."}</small></label>
    <label className="form-field"><span>Tamanho</span><input name="size" defaultValue={variant?.size} required maxLength={20} /></label>
    <small className="span-two">Para acrescentar ou renomear opções, use “Setores e categorias” no estoque.</small>
  </div>;
}
