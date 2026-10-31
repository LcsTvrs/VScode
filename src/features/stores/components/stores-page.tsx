"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { BRAZIL_STATES } from "@/features/stores/input";
import { readApiResponse } from "@/lib/api-response";

type Store = { id: string; code: string; name: string; city: string; state: string; createdAt: string };

export default function StoresPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [name, setName] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [code, setCode] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadStores = useCallback(async () => {
    setLoading(true); setError("");
    try { const response = await fetch("/api/stores", { cache: "no-store" }); const data = await readApiResponse<{ stores: Store[] }>(response, "Não foi possível carregar as lojas."); setStores(data.stores ?? []); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar as lojas."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadStores(); }, [loadStores]);

  function clearForm() { setEditingId(null); setName(""); setCode(""); setCity(""); setState(""); }
  async function saveStore(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return; busy.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(editingId ? `/api/stores/${editingId}` : "/api/stores", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(editingId ? { name, code, city, state } : { name, city, state }) });
      const data = await readApiResponse<{ store: Store }>(response, "Não foi possível guardar a loja.");
      if (!data.store) throw new Error("Não foi possível guardar a loja.");
      if (editingId) { setStores((current) => current.map((item) => item.id === editingId ? data.store : item)); setNotice("Loja atualizada."); }
      else { setStores((current) => [data.store, ...current]); setNotice(`Loja criada. Código: ${data.store.code}`); }
      clearForm();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível guardar a loja."); }
    finally { busy.current = false; setSaving(false); }
  }
  async function deleteStore(store: Store) {
    if (busy.current) return;
    if (!window.confirm(`Excluir a loja ${store.name}? A operação só é permitida quando não existem registos vinculados.`)) return;
    busy.current = true; setSaving(true); setError("");
    try { const response = await fetch(`/api/stores/${store.id}`, { method: "DELETE" }); await readApiResponse<void>(response, "Não foi possível excluir a loja."); setStores((current) => current.filter((item) => item.id !== store.id)); if (editingId === store.id) clearForm(); setNotice("Loja excluída."); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir a loja."); }
    finally { busy.current = false; setSaving(false); }
  }

  return <main className="min-h-[calc(100vh-58px)] bg-[var(--paper)] px-4 py-8 sm:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <header><p className="eyebrow">ADMINISTRAÇÃO CENTRAL</p><h1 className="text-2xl font-bold text-[var(--ink)]">Lojas</h1><p className="mt-2 text-sm text-[var(--muted)]">Cadastre e consulte as unidades vinculadas ao sistema.</p></header>
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-base font-semibold text-[var(--ink)]">{editingId ? "Editar loja" : "Nova loja"}</h2><form onSubmit={(event) => void saveStore(event)}><fieldset disabled={saving} className="mt-4 grid min-w-0 gap-3 sm:grid-cols-2 sm:items-end">
      <label className="text-sm font-medium text-[var(--ink)]">Nome<input className="mt-2 block min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={name} onChange={(event) => setName(event.target.value)} minLength={2} maxLength={100} required /></label>
      {editingId ? <label className="text-sm font-medium text-[var(--ink)]">Código<input className="mt-2 block min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm uppercase" value={code} onChange={(event) => setCode(event.target.value.toUpperCase())} minLength={2} maxLength={20} pattern="[A-Za-z0-9-]{2,20}" required /></label> : null}
      <label className="text-sm font-medium">Cidade<input className="mt-2 block min-h-10 w-full rounded-md border px-3" value={city} onChange={(event) => setCity(event.target.value)} minLength={2} maxLength={100} required /></label>
      <label className="text-sm font-medium">UF<select className="mt-2 block min-h-10 w-full rounded-md border px-3" value={state} onChange={(event) => setState(event.target.value)} required><option value="">Selecione</option>{BRAZIL_STATES.map((uf) => <option key={uf} value={uf}>{uf}</option>)}</select></label>
      <button className="button button-primary min-h-10" disabled={saving}>{saving ? "Salvando…" : editingId ? "Salvar alterações" : "Criar loja"}</button>{editingId ? <button type="button" className="button button-secondary min-h-10" onClick={clearForm}>Cancelar</button> : null}
    </fieldset></form>{notice ? <p className="mt-3 rounded-md bg-[var(--green-pale)] p-3 text-sm text-[var(--green-dark)]" role="status">{notice}</p> : null}{error ? <p className="mt-3 rounded-md bg-[var(--red-pale)] p-3 text-sm text-[var(--red)]" role="alert">{error}</p> : null}</section>
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-sm"><div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><h2 className="text-base font-semibold text-[var(--ink)]">Unidades cadastradas</h2><span className="text-xs text-[var(--muted)]">{stores.length} loja(s)</span></div>
      {loading ? <p className="p-6 text-sm text-[var(--muted)]">Carregando lojas…</p> : stores.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="bg-[#f8f9f6] text-xs uppercase text-[var(--muted)]"><tr>{["Nome", "Código", "Localização", "Criada em", "Ações"].map((label) => <th key={label} className="px-5 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{stores.map((store) => <tr key={store.id} className="hover:bg-[#fbfcfa]"><td className="px-5 py-4 font-semibold text-[var(--ink)]">{store.name}</td><td className="px-5 py-4 font-mono text-xs text-[var(--muted)]">{store.code}</td><td className="px-5 py-4 text-[var(--muted)]">{store.city} · {store.state}</td><td className="px-5 py-4 text-[var(--muted)]">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium", timeZone: "America/Sao_Paulo" }).format(new Date(store.createdAt))}</td><td className="px-5 py-4"><div className="flex gap-3"><button className="text-xs font-semibold text-[var(--blue)]" disabled={saving} onClick={() => { setEditingId(store.id); setName(store.name); setCode(store.code); setCity(store.city); setState(BRAZIL_STATES.includes(store.state) ? store.state : ""); setError(""); }}>Editar</button><button className="text-xs font-semibold text-[var(--red)]" disabled={saving} onClick={() => void deleteStore(store)}>Excluir</button></div></td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-[var(--muted)]">Nenhuma loja cadastrada.</p>}
    </section>
  </div></main>;
}
