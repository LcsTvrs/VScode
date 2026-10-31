import { OperationDialog } from "@/components/operation-dialog";
import { readApiResponse } from "@/lib/api-response";
import { useEffect, useState } from "react";
import { InventoryFields } from "@/features/inventory/components/inventory-fields";
import { RequestFields } from "@/features/requests/components/request-fields";
import { ArrowRight, X } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { Dashboard, Modal, RequestLine, Variant } from "../types";

type Props = { modal: Modal; dashboard: Dashboard | null; editingVariant: Variant | null; requestLines: RequestLine[]; setRequestLines: Dispatch<SetStateAction<RequestLine[]>>; saving: boolean; error: string; uncertain: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> };

export function ActionDialog({ modal, dashboard, editingVariant, requestLines, setRequestLines, saving, error, uncertain, onClose, onSubmit }: Props) {
  const [operationStoreId, setOperationStoreId] = useState(dashboard?.store.id ?? "");
  const [employees, setEmployees] = useState<Dashboard["employees"]>([]);
  const [employeeError, setEmployeeError] = useState("");
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (modal !== "solicitacao" || !dashboard?.employeesDeferred || !operationStoreId) return;
    const controller = new AbortController();
    setLoadingEmployees(true); setEmployeeError(""); setEmployees([]);
    void fetch(`/api/employees?storeId=${encodeURIComponent(operationStoreId)}`, { signal: controller.signal, cache: "no-store" })
      .then(response => readApiResponse<{ employees: Dashboard["employees"] }>(response, "Não foi possível carregar os colaboradores. Tente novamente."))
      .then(data => { if (!controller.signal.aborted) setEmployees(data.employees); })
      .catch(cause => { if (!controller.signal.aborted) setEmployeeError(cause instanceof Error ? cause.message : "Falha de conexão."); })
      .finally(() => { if (!controller.signal.aborted) setLoadingEmployees(false); });
    return () => controller.abort();
  }, [modal, dashboard?.employeesDeferred, operationStoreId, attempt]);
  const scoped = dashboard ? { ...dashboard, variants: dashboard.variants.filter(v => (v.storeId ?? dashboard.store.id) === operationStoreId), employees: (dashboard.employeesDeferred ? employees : dashboard.employees).filter(e => (e.storeId ?? dashboard.store.id) === operationStoreId) } : null;
  const chooseStore = dashboard?.scope === "all" && (modal === "movimentacao" || modal === "solicitacao");
  return modal ? <OperationDialog labelledBy="modal-title" busy={saving} onClose={onClose}><div className="modal-heading"><div><span className="section-kicker">{modal === "solicitacao" ? "PEDIDO DA EQUIPE" : modal === "movimentacao" ? "CONTROLE DE SALDO" : modal === "editar-estoque" ? "EDIÇÃO DE ESTOQUE" : "CATÁLOGO DE UNIFORMES"}</span><h2 id="modal-title">{modal === "solicitacao" ? "Solicitar uniforme" : modal === "movimentacao" ? "Movimentar estoque" : modal === "editar-estoque" ? "Editar estoque" : modal === "editar-item" ? "Editar cadastro global" : "Cadastrar item"}</h2></div><button className="icon-button modal-close" disabled={saving} onClick={onClose} aria-label="Fechar"><X size={18} /></button></div>
        <form onSubmit={(event) => void onSubmit(event)}><fieldset disabled={saving || uncertain}>
          {chooseStore ? <label className="form-field operation-store-field"><span>Loja da operação</span><select name="storeId" value={operationStoreId} onChange={event => { setOperationStoreId(event.target.value); setRequestLines([{ variantId: "", quantity: 1 }]); }} required><option value="" disabled>Selecione a loja</option>{dashboard.availableStores.map(store => <option key={store.id} value={store.id}>{store.code} · {store.name}</option>)}</select></label> : <input type="hidden" name="storeId" value={dashboard?.store.id ?? ""} />}
          {modal === "editar-estoque" && editingVariant?.store ? <p className="operation-store-field">{editingVariant.store.code} · {editingVariant.store.name}</p> : null}
          <InventoryFields key={`${modal}:${editingVariant?.id ?? "new"}:${operationStoreId}`} modal={modal} variants={scoped?.variants ?? []} editingVariant={editingVariant} />
          {modal === "solicitacao" ? <RequestFields key={operationStoreId} dashboard={scoped} requestLines={requestLines} setRequestLines={setRequestLines} /> : null}
          </fieldset>
          {loadingEmployees ? <p role="status">Carregando colaboradores…</p> : null}
          {employeeError ? <p role="alert">{employeeError} <button type="button" className="text-link" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></p> : null}
          {error ? <p role="alert" className="form-error">{error}</p> : null}
          <div className="modal-actions"><button type="button" className="button button-quiet" disabled={saving} onClick={onClose}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving || uncertain || loadingEmployees || !!employeeError}>{saving ? "Salvando…" : modal === "solicitacao" ? "Enviar solicitação" : modal === "movimentacao" ? "Registrar movimentação" : modal === "editar-estoque" ? "Salvar estoque" : "Salvar item"}<ArrowRight size={15} /></button></div>
        </form>
      </OperationDialog> : null;
}
