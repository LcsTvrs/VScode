import { uniformGenderLabel } from "@/features/inventory/gender";
import { REQUEST_TIME_ZONE } from "@/features/requests/date";
import { Activity, AlertTriangle, ArrowDownToLine, ArrowRight, CheckCircle2, Clock3, Plus, Shirt, UserRound } from "lucide-react";
import type { Dashboard, RequestRow } from "../types";

const dateLabel = new Intl.DateTimeFormat("pt-BR", { timeZone: REQUEST_TIME_ZONE, day: "2-digit", month: "short" });

type Props = { dashboard: Dashboard; onStock: () => void; onMovement: () => void; onRequests: () => void; onNewRequest: () => void };

export function OverviewPanel({ dashboard, onStock, onMovement, onRequests, onNewRequest }: Props) {
  const lowStockItems = dashboard.variants.filter(variant => variant.quantity <= variant.minimum);
  const recentPendingRequests = dashboard.requests.filter(request => request.status === "PENDENTE").slice(0, 4);
  return <>
              <section className="metrics-grid" aria-label="Indicadores de estoque">
                <MetricCard label="Peças em estoque" value={dashboard.metrics.totalUnits.toLocaleString("pt-BR")} icon={<Shirt size={18} />} detail={`${dashboard.metrics.variantCount} variações cadastradas`} tone="green" />
                <MetricCard label="Abaixo do mínimo" value={dashboard.metrics.lowStockCount.toString().padStart(2, "0")} icon={<AlertTriangle size={18} />} detail="Itens que precisam de reposição" tone="amber" />
                <MetricCard label="Aguardando aprovação" value={dashboard.metrics.pendingCount.toString().padStart(2, "0")} icon={<Clock3 size={18} />} detail="Solicitações da equipe" tone="blue" />
                <MetricCard label="Loja" value={dashboard.store.name} icon={<Activity size={18} />} detail={dashboard.scope === "all" ? `${dashboard.availableStores.length} lojas cadastradas` : `${dashboard.store.code} · ${dashboard.store.city} · ${dashboard.store.state}`} tone="charcoal" compact />
              </section>

              <div className="overview-grid">
                <section className="content-panel inventory-panel">
                  <div className="panel-heading"><div><span className="section-kicker">PONTO DE ATENÇÃO</span><h2>Reposição necessária</h2></div><button className="text-link" onClick={onStock}>Ver estoque <ArrowRight size={15} /></button></div>
                  {lowStockItems.length ? <div className="attention-list">{lowStockItems.slice(0, 4).map((variant) => <div className="attention-row" key={variant.id}><div className="item-glyph"><Shirt size={17} /></div><div className="item-main"><strong>{variant.name}</strong>{variant.store ? <span>{variant.store.code} · {variant.store.name}</span> : null}<span>{[uniformGenderLabel(variant.gender), variant.color, `Tam. ${variant.size}`].filter(Boolean).join(" · ")}</span></div><div className="stock-level"><strong>{variant.quantity}</strong><span>mín. {variant.minimum}</span></div><span className="low-pill">Repor</span></div>)}</div> : <div className="empty-inline"><CheckCircle2 size={18} /> Todos os itens estão acima do mínimo.</div>}
                  <button className="panel-footer-link" onClick={onMovement}><ArrowDownToLine size={16} /> Registrar entrada de estoque <ArrowRight size={14} /></button>
                </section>

                <section className="content-panel request-panel">
                  <div className="panel-heading"><div><span className="section-kicker">FLUXO DA EQUIPE</span><h2>Solicitações pendentes</h2></div><button className="text-link" onClick={onRequests}>Ver todas <ArrowRight size={15} /></button></div>
                  {recentPendingRequests.length ? <div className="recent-list">{recentPendingRequests.map((request) => <RequestListItem key={request.id} request={request} />)}</div> : <div className="empty-inline">Nenhuma solicitação pendente.</div>}
                  <button className="panel-footer-link" onClick={onNewRequest}><Plus size={16} /> Criar solicitação para colaborador <ArrowRight size={14} /></button>
                </section>
              </div>
            </>;
}

function MetricCard({ label, value, icon, detail, tone, compact = false }: { label: string; value: string; icon: React.ReactNode; detail: string; tone: string; compact?: boolean }) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><div className="metric-icon">{icon}</div></div><strong className={compact ? "metric-value metric-value-compact" : "metric-value"}>{value}</strong><span className="metric-detail">{detail}</span></article>;
}

function RequestListItem({ request }: { request: RequestRow }) {
  return <div className="recent-row"><div className="recent-avatar"><UserRound size={16} /></div><div className="recent-info"><strong>{request.employee}</strong>{request.store ? <span>{request.store.code} · {request.store.name}</span> : null}<span>{request.ldap ? `LDAP ${request.ldap} · ` : ""}{dateLabel.format(new Date(request.createdAt))}</span><span className="recent-items">{request.items.map((item) => `${item.quantity}x Tam. ${item.size} · ${item.name} · ${uniformGenderLabel(item.gender)}`).join("; ")}</span></div><span className={request.status === "PENDENTE" ? "status-pill status-pending" : request.status === "APROVADA" ? "status-pill status-ok" : "status-pill status-rejected"}><i />{statusLabel(request.status)}</span></div>;
}

function statusLabel(status: RequestRow["status"]) {
  return status === "PENDENTE" ? "Pendente" : status === "APROVADA" ? "Aprovada" : "Recusada";
}
