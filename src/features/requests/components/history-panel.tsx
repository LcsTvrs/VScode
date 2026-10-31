"use client";

import type { Dashboard, RequestRow } from "@/features/dashboard/types";
import { ClipboardList, Download, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { readApiResponse } from "@/lib/api-response";
import { requestDay } from "../date";
import { RequestHistoryCard } from "./history-card";

type Page = { requests: RequestRow[]; total: number; filteredTotal: number; page: number; pages: number; pageSize: number };
type Props = { dashboard: Dashboard; requestDate: string; setRequestDate: (value: string) => void; processingRequestId: string | null; onEdit: (request: RequestRow) => void; onNewRequest: () => void; onProcess: (request: RequestRow, action: "APROVAR" | "RECUSAR") => Promise<void> };

export function RequestHistoryPanel({ dashboard, requestDate, setRequestDate, processingRequestId, onEdit, onNewRequest, onProcess }: Props) {
  const [end, setEnd] = useState("");
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [result, setResult] = useState<Page | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const paged = dashboard.historyMode === "paged";
  const params = new URLSearchParams({ storeId: dashboard.store.id, start: requestDate, end: end || requestDate, status, search, page: String(page) }).toString();
  const [loadedQuery, setLoadedQuery] = useState("");
  useEffect(() => {
    if (!paged) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    const timer = window.setTimeout(() => {
      void fetch(`/api/requests?${params}`, { signal: controller.signal, cache: "no-store" })
        .then(response => readApiResponse<Page>(response, "Não foi possível consultar o histórico. Tente novamente."))
        .then(data => { if (!controller.signal.aborted) { setResult(data); setLoadedQuery(params); } })
        .catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Falha de conexão. Tente novamente."); })
        .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [paged, params, attempt, dashboard]);
  const filtered = dashboard.requests.filter(row => {
    const day = requestDay(row.createdAt);
    return (!requestDate || day >= requestDate) && (!(end || requestDate) || day <= (end || requestDate))
      && (!status || row.status === status) && `${row.employee} ${row.ldap ?? ""}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR"));
  });
  // Legacy payloads remain readable while old deployments/tabs are being replaced.
  const rows = paged ? (loadedQuery === params ? result?.requests ?? [] : []) : filtered;
  const total = paged ? result?.total : dashboard.requests.length;
  const count = paged ? result?.filteredTotal : filtered.length;
  const waiting = paged && (loading || (!error && loadedQuery !== params));
  const active = !!(requestDate || end || status || search);
  function resetPage() { setPage(1); }
  function clear() { setRequestDate(""); setEnd(""); setStatus(""); setSearch(""); resetPage(); }
  return <section className="content-panel full-panel" aria-busy={waiting}>
    <div className="panel-heading stock-panel-heading"><div><span className="section-kicker">{count !== undefined ? `${count} de ${total} REGISTROS` : "CONSULTA DO HISTÓRICO"}</span><h2>Histórico de solicitações</h2></div><div className="table-actions"><a className="button button-secondary button-small" href={`/api/exports/requests?storeId=${encodeURIComponent(dashboard.store.id)}`}><Download size={15} /> Exportar histórico completo</a><button className="button button-primary button-small" onClick={onNewRequest}><Plus size={16} /> Nova solicitação</button></div></div>
    <div className="request-history-filters">
      <label className="form-field"><span>Nome ou LDAP</span><input type="search" maxLength={120} value={search} onChange={event => { setSearch(event.target.value); resetPage(); }} /></label>
      <label className="form-field"><span>Situação</span><select value={status} onChange={event => { setStatus(event.target.value); resetPage(); }}><option value="">Todas as situações</option><option value="PENDENTE">Pendente</option><option value="APROVADA">Aprovada</option><option value="RECUSADA">Recusada</option></select></label>
      <label className="form-field"><span>Data da solicitação</span><input type="date" value={requestDate} onChange={event => { setRequestDate(event.target.value); resetPage(); }} aria-describedby="request-date-help" /><small id="request-date-help">Dia ou início do período · Horário de Brasília</small></label>
      <label className="form-field"><span>Até a data</span><input type="date" min={requestDate || undefined} value={end} onChange={event => { setEnd(event.target.value); resetPage(); }} /><small>Opcional; sem data final, consulta o dia escolhido.</small></label>
      <button type="button" className="button button-secondary button-small" disabled={!active} onClick={clear}>Limpar filtro</button>
    </div>
    {waiting ? <p className="history-pagination" role="status">Carregando solicitações…</p> : error ? <div className="history-pagination" role="alert"><span>{error}</span><button className="button button-secondary" onClick={() => setAttempt(value => value + 1)}>Tentar novamente</button></div> : <>
      <div className="request-queue">{rows.length ? rows.map(request => <RequestHistoryCard key={request.id} request={request} busy={!!processingRequestId} onEdit={() => onEdit(request)} onProcess={action => void onProcess(request, action)} />) : <div className="empty-state"><ClipboardList size={28} /><strong>{requestDate && !end && !status && !search ? "Nenhuma solicitação neste dia" : active ? "Nenhuma solicitação encontrada" : "Sem solicitações por enquanto"}</strong><span>{active ? "Ajuste ou limpe os filtros para ver outros pedidos." : "Quando a equipe pedir uniformes, eles aparecerão aqui."}</span></div>}</div>
      {paged && result ? <nav className="history-pagination" aria-label="Páginas de solicitações"><span role="status">Página {result.page} de {result.pages} · Exibindo {rows.length} de {result.filteredTotal}</span><div className="table-actions"><button className="button button-secondary" disabled={result.page <= 1} onClick={() => setPage(result.page - 1)}>Anterior</button><button className="button button-secondary" disabled={result.page >= result.pages} onClick={() => setPage(result.page + 1)}>Próxima</button></div></nav> : null}
    </>}
  </section>;
}
