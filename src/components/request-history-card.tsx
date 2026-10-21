import { Check, Clock3, Pencil, UserRound, X } from "lucide-react";
import { uniformGenderLabel } from "@/lib/uniform-gender";

export type RequestHistoryRow = {
  id: string; code: string; employee: string; ldap: string | null;
  status: "PENDENTE" | "APROVADA" | "RECUSADA";
  createdAt: string; updatedAt: string; itemCount: number; summary: string;
  items: { variantId: string; name: string; sku: string; gender: string | null; size: string; color: string; quantity: number }[];
};
const dateTime = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

export function RequestHistoryCard({ request, busy, onEdit, onProcess }: {
  request: RequestHistoryRow; busy: boolean; onEdit: () => void;
  onProcess: (action: "APROVAR" | "RECUSAR") => void;
}) {
  const statusLabel = request.status === "PENDENTE" ? "Pendente" : request.status === "APROVADA" ? "Aprovada" : "Recusada";
  return <article className="request-card request-history-card" aria-label={`Solicitação de ${request.employee}`}>
    <header className="request-history-heading">
      <span className="request-card-icon"><UserRound size={20} /></span>
      <div className="request-person"><h3>{request.employee}</h3><p>{request.ldap ? `LDAP ${request.ldap}` : "LDAP não informado"}</p></div>
      <span className={`status-pill ${request.status === "PENDENTE" ? "status-pending" : request.status === "APROVADA" ? "status-ok" : "status-rejected"}`}><i />{statusLabel}</span>
    </header>
    <ul className="request-history-items" aria-label="Itens solicitados">{request.items.map((item) => <li key={item.variantId}>
      <div><strong>{item.name}</strong><span>{uniformGenderLabel(item.gender)} · Tam. {item.size} · {item.color}</span><small>SKU {item.sku}</small></div>
      <span className="request-item-quantity"><b>{item.quantity}</b> {item.quantity === 1 ? "unidade" : "unidades"}</span>
    </li>)}</ul>
    <footer className="request-history-footer">
      <div className="request-history-details"><span><Clock3 size={13} />{dateTime.format(new Date(request.createdAt))}</span><strong>Total: {request.itemCount} {request.itemCount === 1 ? "peça" : "peças"}</strong></div>
      {request.status === "PENDENTE" ? <div className="request-history-actions">
        <button className="button button-secondary button-small" disabled={busy} onClick={onEdit} aria-label={`Editar solicitação de ${request.employee}`}><Pencil size={14} />Editar</button>
        <button className="button button-primary button-small" disabled={busy} onClick={() => onProcess("APROVAR")} aria-label={`Aprovar solicitação de ${request.employee}`}><Check size={14} />Aprovar</button>
        <button className="button button-quiet button-small" disabled={busy} onClick={() => onProcess("RECUSAR")} aria-label={`Recusar solicitação de ${request.employee}`}><X size={14} />Recusar</button>
      </div> : null}
    </footer>
  </article>;
}
