"use client";

import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { ADMIN_ITEM_LIMIT, parseRequestItems, REQUEST_LINE_LIMIT } from "@/lib/request-items";
import { uniformGenderLabel } from "@/lib/uniform-gender";

type Line = { variantId: string; quantity: number };
type Details = {
  id: string; code: string; status: string; updatedAt: string;
  employee: { name: string; ldap: string | null }; items: Line[];
};
type Variant = { id: string; name: string; sku: string; size: string; color: string; gender: string | null };

export function RequestEditDialog({ requestId, variants, onClose, onSaved }: {
  requestId: string; variants: Variant[]; onClose: () => void; onSaved: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const busy = useRef(false);
  const [details, setDetails] = useState<Details | null>(null);
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [stale, setStale] = useState(false);

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoading(true); setError(""); setStale(false); setDetails(null);
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(requestId)}`, { cache: "no-store", signal });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Não foi possível carregar a solicitação.");
      setDetails(data);
      setLines(data.items);
      if (data.status !== "PENDENTE") setError("Esta solicitação já foi processada e não pode ser editada.");
    } catch (cause) {
      if (!signal?.aborted) setError(cause instanceof Error ? cause.message : "Falha ao carregar a solicitação.");
    } finally { if (!signal?.aborted) setLoading(false); }
  }, [requestId]);

  useEffect(() => {
    const element = dialog.current;
    const controller = new AbortController();
    element?.showModal();
    void load(controller.signal);
    return () => { controller.abort(); element?.close(); };
  }, [load]);

  function close() { if (!busy.current) onClose(); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!details || stale || details.status !== "PENDENTE" || busy.current) return;
    let items: Map<string, number>;
    try { items = parseRequestItems(lines, ADMIN_ITEM_LIMIT); }
    catch (cause) { setError((cause as Error).message); return; }
    busy.current = true; setSaving(true); setError("");
    try {
      const response = await fetch(`/api/requests/${encodeURIComponent(requestId)}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updatedAt: details.updatedAt, items: [...items].map(([variantId, quantity]) => ({ variantId, quantity })) }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (data.code === "REQUEST_CHANGED" || data.code === "REQUEST_PROCESSED") setStale(true);
        throw new Error(data.message ?? "Não foi possível salvar os ajustes.");
      }
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Falha de conexão ao salvar.");
    } finally { busy.current = false; setSaving(false); }
  }

  const editable = !loading && details?.status === "PENDENTE" && !stale;
  return <dialog ref={dialog} className="modal request-edit-dialog" aria-labelledby="request-edit-title" onCancel={(event) => { event.preventDefault(); close(); }}>
    <div className="modal-heading"><div><span className="section-kicker">AJUSTE DO PEDIDO</span><h2 id="request-edit-title">Editar solicitação</h2></div><button className="icon-button" aria-label="Fechar edição" disabled={saving} onClick={close}><X size={18} /></button></div>
    <form onSubmit={(event) => void save(event)}>
      {loading ? <p role="status">Carregando solicitação…</p> : null}
      {details ? <div className="request-edit-identity"><strong>{details.employee.name}</strong><p>{details.employee.ldap ? `LDAP ${details.employee.ldap}` : "LDAP não informado"}</p></div> : null}
      {editable ? <>
        <p className="request-limit-note">Ajuste os uniformes e as quantidades. O administrador pode informar até {ADMIN_ITEM_LIMIT} unidades por item, conforme o saldo disponível. A solicitação continuará pendente.</p>
        <fieldset disabled={saving}>
          <legend className="sr-only">Itens da solicitação</legend>
          <div className="request-lines">{lines.map((line, index) => <div className="request-line" key={index}>
            <label className="form-field"><span>Item {index + 1}</span><select required value={line.variantId} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, variantId: event.target.value } : item))}>
              <option value="" disabled>Selecione um uniforme</option>
              {line.variantId && !variants.some((variant) => variant.id === line.variantId) ? <option value={line.variantId} disabled>Item indisponível — selecione outro</option> : null}
              {variants.map((variant) => <option key={variant.id} value={variant.id}>{variant.name} · {uniformGenderLabel(variant.gender)} · {variant.size} · {variant.color} · {variant.sku}</option>)}
            </select></label>
            <label className="form-field quantity-field"><span>Quantidade {index + 1}</span><input type="number" required min={1} max={ADMIN_ITEM_LIMIT} step={1} value={line.quantity || ""} onChange={(event) => setLines((current) => current.map((item, i) => i === index ? { ...item, quantity: Number(event.target.value) } : item))} /></label>
            <button type="button" className="remove-line" aria-label={`Remover item ${index + 1}`} disabled={lines.length === 1} onClick={() => setLines((current) => current.filter((_, i) => i !== index))}><X size={16} /></button>
          </div>)}</div>
          <button type="button" className="add-line-button" disabled={lines.length >= REQUEST_LINE_LIMIT} onClick={() => setLines((current) => [...current, { variantId: "", quantity: 1 }])}><Plus size={15} /> Adicionar item</button>
        </fieldset>
      </> : null}
      {error ? <p className="request-edit-error" role="alert">{error}</p> : null}
      {!loading && (stale || !details) ? <button type="button" className="button button-secondary" onClick={() => void load()}>Recarregar solicitação</button> : null}
      <div className="modal-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={close}>Cancelar</button><button type="submit" className="button button-primary" disabled={!editable || saving}>{saving ? "Salvando…" : "Salvar ajustes"}</button></div>
    </form>
  </dialog>;
}
