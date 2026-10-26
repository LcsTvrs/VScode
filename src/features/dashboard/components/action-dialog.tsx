import { useState } from "react";
import { InventoryFields } from "@/features/inventory/components/inventory-fields";
import { RequestFields } from "@/features/requests/components/request-fields";
import { ArrowRight, X } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { Dashboard, Modal, RequestLine, Variant } from "../types";

type Props = { modal: Modal; dashboard: Dashboard | null; editingVariant: Variant | null; requestLines: RequestLine[]; setRequestLines: Dispatch<SetStateAction<RequestLine[]>>; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> };

export function ActionDialog({ modal, dashboard, editingVariant, requestLines, setRequestLines, saving, onClose, onSubmit }: Props) {
  const [operationStoreId, setOperationStoreId] = useState(dashboard?.store.id ?? "");
  const scoped = dashboard ? { ...dashboard, variants: dashboard.variants.filter(v => (v.storeId ?? dashboard.store.id) === operationStoreId), employees: dashboard.employees.filter(e => (e.storeId ?? dashboard.store.id) === operationStoreId) } : null;
  const chooseStore = dashboard?.scope === "all" && (modal === "movimentacao" || modal === "solicitacao");
  return modal ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="section-kicker">{modal === "solicitacao" ? "PEDIDO DA EQUIPE" : modal === "movimentacao" ? "CONTROLE DE SALDO" : modal === "editar-estoque" ? "EDIÇÃO DE ESTOQUE" : "CATÁLOGO DE UNIFORMES"}</span><h2 id="modal-title">{modal === "solicitacao" ? "Solicitar uniforme" : modal === "movimentacao" ? "Movimentar estoque" : modal === "editar-estoque" ? "Editar estoque" : modal === "editar-item" ? "Editar cadastro global" : "Cadastrar item"}</h2></div><button className="icon-button modal-close" onClick={() => onClose()} aria-label="Fechar"><X size={18} /></button></div>
        <form onSubmit={(event) => void onSubmit(event)}>
          {chooseStore ? <label className="form-field operation-store-field"><span>Loja da operação</span><select name="storeId" value={operationStoreId} onChange={event => { setOperationStoreId(event.target.value); setRequestLines([{ variantId: "", quantity: 1 }]); }} required><option value="" disabled>Selecione a loja</option>{dashboard.availableStores.map(store => <option key={store.id} value={store.id}>{store.code} · {store.name}</option>)}</select></label> : <input type="hidden" name="storeId" value={dashboard?.store.id ?? ""} />}
          {modal === "editar-estoque" && editingVariant?.store ? <p className="operation-store-field">{editingVariant.store.code} · {editingVariant.store.name}</p> : null}
          <InventoryFields key={`${modal}:${editingVariant?.id ?? "new"}:${operationStoreId}`} modal={modal} variants={scoped?.variants ?? []} editingVariant={editingVariant} />
          {modal === "solicitacao" ? <RequestFields key={operationStoreId} dashboard={scoped} requestLines={requestLines} setRequestLines={setRequestLines} /> : null}
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => onClose()}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Salvando…" : modal === "solicitacao" ? "Enviar solicitação" : modal === "movimentacao" ? "Registrar movimentação" : modal === "editar-estoque" ? "Salvar estoque" : "Salvar item"}<ArrowRight size={15} /></button></div>
        </form>
      </section></div> : null;
}
