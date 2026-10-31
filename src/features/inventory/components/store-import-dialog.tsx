"use client";

import { OperationDialog } from "@/components/operation-dialog";

import { useState } from "react";
import { InventoryImportDialog } from "./import-dialog";

export function StoreImportDialog({ stores, onClose, onSuccess }: { stores: { id: string; code: string; name: string }[]; onClose: () => void; onSuccess: (message: string) => void }) {
  const [storeId, setStoreId] = useState("");
  const store = stores.find(store => store.id === storeId);
  if (store) return <InventoryImportDialog store={store} onClose={onClose} onSuccess={onSuccess} />;
  return <OperationDialog labelledBy="import-store-title" onClose={onClose}><div className="modal-heading"><h2 id="import-store-title">Importar estoque de uma loja</h2></div><div className="bulk-content"><p>A planilha altera somente a loja escolhida. O filtro geral do painel será mantido.</p><label className="form-field"><span>Loja da importação</span><select value={storeId} onChange={event => setStoreId(event.target.value)}><option value="">Selecione a loja</option>{stores.map(store => <option key={store.id} value={store.id}>{store.code} · {store.name}</option>)}</select></label><div className="modal-actions"><button className="button button-secondary" onClick={onClose}>Cancelar</button></div></div></OperationDialog>;
}
