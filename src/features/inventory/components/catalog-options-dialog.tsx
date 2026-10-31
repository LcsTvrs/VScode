"use client";

import { OperationDialog } from "@/components/operation-dialog";

import { readApiResponse } from "@/lib/api-response";
import { useRef, useState, type FormEvent } from "react";
import { categoryNames } from "../labels";
import { useCatalogOptions } from "./catalog-fields";

export function CatalogOptionsDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { options, setOptions, error, setError } = useCatalogOptions();
  const [kind, setKind] = useState("sector");
  const [previous, setPrevious] = useState("");
  const [name, setName] = useState("");
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const names = kind === "sector" ? options?.sectors : options?.categories;
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy.current || !options) return;
    busy.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/catalog/options", { method: previous ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, previous, name }) });
      const saved = await readApiResponse<{ name: string }>(response, "Não foi possível salvar a opção.");
      const key = kind === "sector" ? "sectors" : "categories";
      setOptions({ ...options, [key]: [...options[key].filter(value => value !== previous), saved.name].sort((a, b) => a.localeCompare(b, "pt-BR")) });
      setPrevious(""); setName(""); setNotice("Opção salva em todas as lojas."); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar."); }
    finally { busy.current = false; setSaving(false); }
  }
  async function remove() {
    if (!previous || !options || busy.current) return;
    busy.current = true; setSaving(true); setError(""); setNotice("");
    try {
      await readApiResponse(await fetch("/api/catalog/options", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kind, name: previous }) }), "Não foi possível excluir a opção.");
      const key = kind === "sector" ? "sectors" : "categories";
      setOptions({ ...options, [key]: options[key].filter(value => value !== previous) });
      setPrevious(""); setName(""); setConfirmDelete(false); setNotice("Opção excluída em todas as lojas."); onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao excluir."); setConfirmDelete(false); }
    finally { busy.current = false; setSaving(false); }
  }
  return <OperationDialog labelledBy="catalog-options-title" className="catalog-options-dialog" busy={saving} onClose={onClose}>
    <div className="modal-heading"><h2 id="catalog-options-title">Setores e categorias</h2><button className="icon-button" aria-label="Fechar opções" disabled={saving} onClick={onClose}>×</button></div>
    <p>As opções são compartilhadas por todas as lojas. Renomear atualiza os cadastros vinculados e preserva seus estoques.</p>
    <form onSubmit={event => void save(event)}><fieldset disabled={!options || saving || confirmDelete} className="form-grid">
      <legend className="sr-only">Gerenciar opções do catálogo</legend>
      <label className="form-field"><span>Tipo de opção</span><select value={kind} onChange={event => { setKind(event.target.value); setPrevious(""); setName(""); }}><option value="sector">Setor</option><option value="category">Categoria</option></select></label>
      <label className="form-field"><span>Opção para editar</span><select value={previous} onChange={event => { const value = event.target.value; setPrevious(value); setName(kind === "category" ? categoryNames[value] ?? value : value); }}><option value="">Adicionar nova opção</option>{names?.map(value => <option key={value} value={value}>{kind === "category" ? categoryNames[value] ?? value : value}</option>)}</select></label>
      <label className="form-field span-two"><span>Nome da opção</span><input value={name} onChange={event => setName(event.target.value)} maxLength={80} required /></label>
      <button className="button button-primary" type="submit">{saving ? "Salvando…" : previous ? "Salvar nome" : "Adicionar opção"}</button>
      {previous ? <button className="button button-secondary" type="button" onClick={() => { setError(""); setConfirmDelete(true); }}>Excluir</button> : null}
    </fieldset></form>
    {confirmDelete ? <div className="delete-confirmation" role="alert"><p>Excluir {kind === "sector" ? "o setor" : "a categoria"} <strong>{kind === "category" ? categoryNames[previous] ?? previous : previous}</strong> de todas as lojas? Uniformes e estoques serão preservados. A exclusão será bloqueada se houver uniformes vinculados.</p><button className="button button-secondary" disabled={saving} onClick={() => setConfirmDelete(false)}>Cancelar exclusão</button><button className="button button-primary" disabled={saving} onClick={() => void remove()}>{saving ? "Excluindo…" : "Confirmar exclusão"}</button></div> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}{notice ? <p role="status">{notice}</p> : null}
    <div className="modal-actions"><button className="button button-secondary" disabled={saving} onClick={onClose}>Concluir</button></div>
  </OperationDialog>;
}
