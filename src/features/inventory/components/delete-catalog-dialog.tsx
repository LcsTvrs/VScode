"use client";

import { useState } from "react";
import { readApiResponse } from "@/lib/api-response";
import type { Variant } from "@/features/dashboard/types";

export function DeleteCatalogDialog({ variant, onClose, onSaved }: { variant: Variant; onClose: () => void; onSaved: () => void }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (saving) return;
    setSaving(true); setError("");
    try {
      await readApiResponse(await fetch("/api/variants", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku: variant.sku, updatedAt: variant.catalogUpdatedAt }) }), "Não foi possível excluir o cadastro.");
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao excluir."); }
    finally { setSaving(false); }
  }
  return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="delete-catalog-title">
    <div className="modal-heading"><h2 id="delete-catalog-title">Excluir cadastro</h2><button className="icon-button" aria-label="Fechar exclusão" disabled={saving} onClick={onClose}>×</button></div>
    <p>Excluir <strong>{variant.name} · {variant.size} · {variant.sku}</strong> do catálogo de todas as lojas?</p>
    <p>A exclusão é definitiva e será bloqueada se houver saldo, pedidos ou movimentações em qualquer loja.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="modal-actions"><button className="button button-secondary" disabled={saving} onClick={onClose}>Cancelar exclusão</button><button className="button button-primary" disabled={saving} onClick={() => void remove()}>{saving ? "Excluindo…" : "Confirmar exclusão"}</button></div>
  </section></div>;
}
