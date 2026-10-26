import type { Modal, Variant } from "@/features/dashboard/types";
import { Shirt } from "lucide-react";
import { uniformGenderLabel } from "../gender";
import { CatalogFields } from "./catalog-fields";

type Props = { modal: Modal; variants: Variant[]; editingVariant: Variant | null };

export function InventoryFields({ modal, variants, editingVariant }: Props) {
  return <>
          {modal === "novo-item" || modal === "editar-item" ? <CatalogFields variant={modal === "editar-item" ? editingVariant : null} /> : null}
          {modal === "movimentacao" ? <div className="form-grid"><label className="form-field span-two"><span>Uniforme</span><select name="variantId" required defaultValue=""><option value="" disabled>Selecione um item</option>{variants.map((variant) => <option value={variant.id} key={variant.id}>{[variant.name, uniformGenderLabel(variant.gender), variant.color, variant.size].filter(Boolean).join(" · ")} (saldo {variant.quantity})</option>)}</select></label><label className="form-field"><span>Tipo de movimentação</span><select name="type" defaultValue="ENTRADA"><option value="ENTRADA">Entrada de peças</option><option value="SAIDA">Retirada de peças</option><option value="AJUSTE">Ajuste para saldo contado</option></select></label><label className="form-field"><span>Quantidade</span><input name="quantity" type="number" min="0" step="1" defaultValue="1" required /><small>No ajuste, informe o saldo total contado.</small></label><label className="form-field span-two"><span>Observação</span><input name="note" placeholder="Ex.: Recebimento do fornecedor" maxLength={300} /></label></div> : null}
          {modal === "editar-estoque" && editingVariant ? <div className="form-grid"><div className="edit-stock-identity span-two"><span className="item-glyph"><Shirt size={17} /></span><div><strong>{editingVariant.name}</strong><small>{[editingVariant.color, `Tam. ${editingVariant.size}`, `SKU ${editingVariant.sku}`].filter(Boolean).join(" · ")}</small></div></div><label className="form-field"><span>Quantidade disponível</span><input name="quantity" type="number" min="0" max="1000000" step="1" defaultValue={editingVariant.quantity} required /></label><label className="form-field"><span>Estoque mínimo</span><input name="minimum" type="number" min="0" max="1000000" step="1" defaultValue={editingVariant.minimum} required /></label><p className="edit-stock-note span-two">Alterações no saldo disponível ficam registradas no histórico de movimentações.</p></div> : null}
  </>;
}
