"use client";

import { OperationDialog } from "@/components/operation-dialog";

import { useRef, useState } from "react";
import { readApiResponse } from "@/lib/api-response";
import type { Variant } from "@/features/dashboard/types";

export function DeleteCatalogDialog({ variant, onClose, onSaved }: { variant: Variant; onClose: () => void; onSaved: () => void }) {
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  async function remove() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      await readApiResponse(await fetch("/api/variants", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sku: variant.sku, updatedAt: variant.catalogUpdatedAt }) }), "Não foi possível excluir o cadastro.");
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao excluir."); }
    finally { busy.current = false; setSaving(false); }
  }
  return <OperationDialog labelledBy="delete-catalog-title" className="" busy={saving} onClose={onClose}>
    <div className="modal-heading"><h2 id="delete-catalog-title">Excluir cadastro</h2><button className="icon-button" aria-label="Fechar exclusão" disabled={saving} onClick={onClose}>×</button></div>
    <p>Excluir <strong>{variant.name} · {variant.size} · {variant.sku}</strong> do catálogo de todas as lojas?</p>
    <p>A exclusão será bloqueada apenas se houver saldo em alguma loja. O histórico de solicitações e movimentações será preservado.</p>
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="modal-actions"><button className="button button-secondary" disabled={saving} onClick={onClose}>Cancelar exclusão</button><button className="button button-primary" disabled={saving} onClick={() => void remove()}>{saving ? "Excluindo…" : "Confirmar exclusão"}</button></div>
  </OperationDialog>;
}
