import { InventoryFields } from "@/features/inventory/components/inventory-fields";
import { RequestFields } from "@/features/requests/components/request-fields";
import { ArrowRight, X } from "lucide-react";
import type { Dispatch, FormEvent, SetStateAction } from "react";
import type { Dashboard, Modal, RequestLine, Variant } from "../types";

type Props = { modal: Modal; dashboard: Dashboard | null; editingVariant: Variant | null; requestLines: RequestLine[]; setRequestLines: Dispatch<SetStateAction<RequestLine[]>>; saving: boolean; onClose: () => void; onSubmit: (event: FormEvent<HTMLFormElement>) => Promise<void> };

export function ActionDialog({ modal, dashboard, editingVariant, requestLines, setRequestLines, saving, onClose, onSubmit }: Props) {
  return modal ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="section-kicker">{modal === "solicitacao" ? "PEDIDO DA EQUIPE" : modal === "movimentacao" ? "CONTROLE DE SALDO" : modal === "editar-estoque" ? "EDIÇÃO DE ESTOQUE" : "CATÁLOGO DE UNIFORMES"}</span><h2 id="modal-title">{modal === "solicitacao" ? "Solicitar uniforme" : modal === "movimentacao" ? "Movimentar estoque" : modal === "editar-estoque" ? "Editar estoque" : "Cadastrar item"}</h2></div><button className="icon-button modal-close" onClick={() => onClose()} aria-label="Fechar"><X size={18} /></button></div>
        <form onSubmit={(event) => void onSubmit(event)}>
          <InventoryFields modal={modal} variants={dashboard?.variants ?? []} editingVariant={editingVariant} />
          {modal === "solicitacao" ? <RequestFields dashboard={dashboard} requestLines={requestLines} setRequestLines={setRequestLines} /> : null}
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => onClose()}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Salvando…" : modal === "solicitacao" ? "Enviar solicitação" : modal === "movimentacao" ? "Registrar movimentação" : modal === "editar-estoque" ? "Salvar estoque" : "Salvar item"}<ArrowRight size={15} /></button></div>
        </form>
      </section></div> : null;
}
