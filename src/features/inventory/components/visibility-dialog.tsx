"use client";

import { useRef, useState } from "react";
import { OperationDialog } from "@/components/operation-dialog";
import { readApiResponse } from "@/lib/api-response";
import type { Variant } from "@/features/dashboard/types";

export function VisibilityDialog({ variant, storeId, isMasterAdmin, onClose, onSaved }: {
  variant: Variant; storeId: string; isMasterAdmin: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [scope, setScope] = useState("store");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const busy = useRef(false);
  const hidden = scope === "all" ? variant.hiddenGlobally : variant.hiddenInStore;
  async function save() {
    if (busy.current) return;
    busy.current = true; setSaving(true); setError("");
    try {
      await readApiResponse(await fetch("/api/variants/visibility", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sku: variant.sku, storeId, scope, hidden: !hidden }),
      }), "Não foi possível alterar a visibilidade.");
      onSaved();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Falha ao salvar."); }
    finally { busy.current = false; setSaving(false); }
  }
  return <OperationDialog labelledBy="visibility-title" busy={saving} onClose={onClose}>
    <div className="modal-heading"><h2 id="visibility-title">Visibilidade nas solicitações</h2><button className="icon-button" aria-label="Fechar" disabled={saving} onClick={onClose}>×</button></div>
    <p><strong>{variant.name} · {variant.size} · {variant.sku}</strong></p>
    {isMasterAdmin ? <label className="form-field"><span>Aplicar em</span><select value={scope} disabled={saving} onChange={event => setScope(event.target.value)}><option value="store">Somente nesta loja: {variant.store?.code} · {variant.store?.name}</option><option value="all">Todas as lojas, inclusive futuras</option></select></label> : <p>A alteração vale somente para sua loja.</p>}
    <p>O item continuará no estoque, com o saldo e o histórico preservados. O ocultamento impede novas solicitações, mesmo com estoque disponível.</p>
    {scope === "all" ? <p>Ao liberar globalmente, as lojas que ocultaram o item individualmente continuarão com ele oculto.</p> : variant.hiddenGlobally ? <p>Este item está oculto globalmente pelo master admin. A configuração desta loja só terá efeito após a liberação global.</p> : null}
    {error ? <p className="form-error" role="alert">{error}</p> : null}
    <div className="modal-actions"><button className="button button-secondary" disabled={saving} onClick={onClose}>Cancelar</button><button className="button button-primary" disabled={saving} onClick={() => void save()}>{saving ? "Salvando…" : hidden ? "Liberar exibição" : "Ocultar nas solicitações"}</button></div>
  </OperationDialog>;
}
