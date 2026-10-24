"use client";

import { readApiResponse } from "@/lib/api-response";
import { useState, type FormEvent } from "react";
import { categoryNames } from "../labels";
import { useCatalogOptions } from "./catalog-fields";

export function CatalogOptionsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { options, setOptions, error, setError } = useCatalogOptions();
  const [kind, setKind] = useState("sector");
  const [previous, setPrevious] = useState("");
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const names = kind === "sector" ? options?.sectors : options?.categories;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !options) return;
    setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/catalog/options", { method: previous ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, previous, name }) });
      const saved = await readApiResponse<{ name: string }>(response, "Não foi possível salvar a opção.");
      const key = kind === "sector" ? "sectors" : "categories";
      setOptions({ ...options, [key]: [...options[key].filter(value => value !== previous), saved.name].sort((a, b) => a.localeCompare(b, "pt-BR")) });
      setPrevious(""); setName(""); setNotice("Opção salva em todas as lojas."); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar."); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop"><section className="modal catalog-options-dialog" role="dialog" aria-modal="true" aria-labelledby="catalog-options-title">
    <div className="modal-heading"><h2 id="catalog-options-title">Setores e categorias</h2><button className="icon-button" aria-label="Fechar opções" disabled={saving} onClick={onClose}>×</button></div>
    <p>As opções são compartilhadas por todas as lojas. Renomear atualiza os cadastros vinculados e preserva seus estoques.</p>
    <form onSubmit={event => void save(event)}><fieldset disabled={!options || saving} className="form-grid">
      <legend className="sr-only">Gerenciar opções do catálogo</legend>
      <label className="form-field"><span>Tipo de opção</span><select value={kind} onChange={event => { setKind(event.target.value); setPrevious(""); setName(""); }}><option value="sector">Setor</option><option value="category">Categoria</option></select></label>
      <label className="form-field"><span>Opção para editar</span><select value={previous} onChange={event => { const value = event.target.value; setPrevious(value); setName(kind === "category" ? categoryNames[value] ?? value : value); }}><option value="">Adicionar nova opção</option>{names?.map(value => <option key={value} value={value}>{kind === "category" ? categoryNames[value] ?? value : value}</option>)}</select></label>
      <label className="form-field span-two"><span>Nome da opção</span><input value={name} onChange={event => setName(event.target.value)} maxLength={80} required /></label>
      <button className="button button-primary" type="submit">{saving ? "Salvando…" : previous ? "Salvar nome" : "Adicionar opção"}</button>
    </fieldset></form>
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    <div className="modal-actions"><button className="button button-secondary" disabled={saving} onClick={onClose}>Concluir</button></div>
  </section></div>;
}
