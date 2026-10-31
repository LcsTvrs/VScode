"use client";

import { OperationDialog } from "@/components/operation-dialog";

import type { Variant } from "@/features/dashboard/types";
import { readApiResponse } from "@/lib/api-response";
import { useRef, useState, type FormEvent } from "react";
import { bulkResult, parseBulkInput, type BulkChange } from "../bulk";

export function BulkStockDialog({ variants, onClose, onSaved, onReload }: { variants: Variant[]; onClose: () => void; onSaved: () => void; onReload: () => void }) {
  const [records] = useState(variants);
  const [mode, setMode] = useState<BulkChange["mode"]>("KEEP");
  const [quantity, setQuantity] = useState("");
  const [minimum, setMinimum] = useState("");
  const [review, setReview] = useState<BulkChange | null>(null);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [stale, setStale] = useState(false);
  const [error, setError] = useState("");
  const selected = records.map(v => ({ storeId: v.storeId!, variantId: v.id, updatedAt: v.updatedAt }));
  function prepare(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError("");
    try {
      const change: BulkChange = { mode, ...(mode === "KEEP" ? {} : { quantity: quantity === "" ? NaN : Number(quantity) }), ...(minimum === "" ? {} : { minimum: Number(minimum) }) };
      parseBulkInput({ records: selected, change });
      records.forEach(record => bulkResult(record.quantity, record.minimum, change));
      setReview(change);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Confira os valores."); }
  }
  async function save() {
    if (!review || busy.current || stale) return;
    busy.current = true; setSaving(true); setError("");
    try {
      await readApiResponse(await fetch("/api/inventory/bulk", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ records: selected, change: review }) }), "Não foi possível confirmar o lote. Recarregue os estoques antes de tentar novamente.");
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao confirmar. Confira os estoques antes de tentar novamente."); setStale(true); }
    finally { busy.current = false; setSaving(false); }
  }
  const description = review?.mode === "SET" ? `Definir saldo final em ${review.quantity} peças` : review?.mode === "ADD" ? `Adicionar ${review.quantity} peças ao saldo de cada registro` : review?.mode === "REMOVE" ? `Retirar ${review.quantity} peças do saldo de cada registro` : "Preservar saldo atual";
  return <OperationDialog labelledBy="bulk-title" className="bulk-stock-dialog" busy={saving} onClose={onClose}>
    <div className="modal-heading"><h2 id="bulk-title">Editar estoque em massa</h2><button aria-label="Fechar edição em massa" className="icon-button" disabled={saving} onClick={onClose}>×</button></div>
    <div className="bulk-content"><p>{records.length} registros selecionados. O lote será salvo por inteiro ou nenhuma alteração será aplicada.</p>
    {!review ? <form onSubmit={prepare} className="form-grid">
      <label className="form-field span-two"><span>Alteração do saldo</span><select value={mode} onChange={event => setMode(event.target.value as BulkChange["mode"])}><option value="KEEP">Preservar saldo atual</option><option value="SET">Definir saldo final</option><option value="ADD">Adicionar peças</option><option value="REMOVE">Retirar peças</option></select></label>
      {mode !== "KEEP" ? <label className="form-field"><span>{mode === "SET" ? "Saldo final" : "Quantidade de peças"}</span><input value={quantity} onChange={event => setQuantity(event.target.value)} type="number" min="0" max="1000000" step="1" required /></label> : null}
      <label className="form-field"><span>Novo estoque mínimo</span><input value={minimum} onChange={event => setMinimum(event.target.value)} type="number" min="0" max="1000000" step="1" /><small>Deixe vazio para preservar o mínimo de cada registro.</small></label>
      <p className="span-two">Definir saldo final substitui o saldo atual. Adicionar ou retirar aplica a quantidade a cada registro selecionado.</p><button type="submit" className="button button-primary span-two">Conferir alterações</button>
    </form> : <>
      <p role="status"><strong>{description}</strong>{review.minimum !== undefined ? `; definir mínimo em ${review.minimum} peças.` : "; preservar os mínimos atuais."}</p>
      <div className="table-wrap bulk-preview"><table><thead><tr><th>LOJA</th><th>UNIFORME / SKU</th><th>SALDO ATUAL → FINAL</th><th>MÍNIMO ATUAL → FINAL</th></tr></thead><tbody>{records.map(record => { const next = bulkResult(record.quantity, record.minimum, review); return <tr key={record.id}><td data-label="Loja">{record.store?.code} · {record.store?.name}</td><td data-label="Uniforme / SKU">{record.name} · {record.sku} · Tam. {record.size}</td><td data-label="Saldo atual → final">{record.quantity} → {next.quantity}</td><td data-label="Mínimo atual → final">{record.minimum} → {next.minimum}</td></tr>; })}</tbody></table></div>
      <p>Apenas os registros acima serão alterados. Reservas pendentes, saldos negativos e conflitos serão verificados novamente ao salvar.</p>
      <div className="modal-actions"><button className="button button-secondary" disabled={saving || stale} onClick={() => setReview(null)}>Voltar aos valores</button><button className="button button-primary" disabled={saving || stale} onClick={() => void save()}>{saving ? "Salvando…" : "Confirmar alterações"}</button></div>
    </>}
    {error ? <p role="alert" className="form-error">{error}</p> : null}{stale ? <button className="button button-secondary" onClick={onReload}>Recarregar estoques</button> : null}
    </div></OperationDialog>;
}
