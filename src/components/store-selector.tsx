import { ChevronDown } from "lucide-react";

export function StoreSelector({ value, stores, onChange }: {
  value: string; stores: { id: string; name: string }[]; onChange: (id: string) => void;
}) {
  return <div className="store-choice">
    <span aria-hidden="true">{stores.find(store => store.id === value)?.name ?? "Todas as lojas"}</span>
    <ChevronDown size={15} aria-hidden="true" />
    <select aria-label="Selecionar loja" value={value} onChange={event => onChange(event.target.value)}>
      <option value="">Todas as lojas</option>
      {stores.map(store => <option key={store.id} value={store.id}>{store.name}</option>)}
    </select>
  </div>;
}
