import type { Dashboard, RequestRow } from "@/features/dashboard/types";
import { ClipboardList, Download, Plus } from "lucide-react";
import { RequestHistoryCard } from "./history-card";

type Props = { dashboard: Dashboard; filteredRequests: RequestRow[]; requestDate: string; setRequestDate: (value: string) => void; processingRequestId: string | null; onEdit: (id: string) => void; onNewRequest: () => void; onProcess: (request: RequestRow, action: "APROVAR" | "RECUSAR") => Promise<void> };

export function RequestHistoryPanel({ dashboard, filteredRequests, requestDate, setRequestDate, processingRequestId, onEdit, onNewRequest, onProcess }: Props) {
  return <section className="content-panel full-panel">
              <div className="panel-heading stock-panel-heading"><div><span className="section-kicker">{filteredRequests.length} de {dashboard.requests.length} REGISTROS</span><h2>Histórico de solicitações</h2></div><div className="table-actions"><a className="button button-secondary button-small" href={`/api/exports/requests?storeId=${encodeURIComponent(dashboard.store.id)}`}><Download size={15} /> Exportar histórico completo</a><button className="button button-primary button-small" onClick={onNewRequest}><Plus size={16} /> Nova solicitação</button></div></div>
              <div className="request-date-filter"><label className="form-field"><span>Data da solicitação</span><input type="date" value={requestDate} onChange={(event) => setRequestDate(event.target.value)} aria-describedby="request-date-help" /><small id="request-date-help">Data de criação · Horário de Brasília</small></label><button type="button" className="button button-secondary button-small" disabled={!requestDate} onClick={() => setRequestDate("")}>Limpar filtro</button></div>
              <div className="request-queue">{filteredRequests.length ? filteredRequests.map((request) => <RequestHistoryCard key={request.id} request={request} busy={!!processingRequestId} onEdit={() => onEdit(request.id)} onProcess={(action) => void onProcess(request, action)} />) : <div className="empty-state"><ClipboardList size={28} /><strong>{requestDate ? "Nenhuma solicitação neste dia" : "Sem solicitações por enquanto"}</strong><span>{requestDate ? "Escolha outra data ou limpe o filtro para ver todos os pedidos." : "Quando a equipe pedir uniformes, eles aparecerão aqui."}</span></div>}</div>
            </section>;
}
