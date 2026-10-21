"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { InventoryImportDialog } from "@/components/inventory-import-dialog";
import { RequestEditDialog } from "@/components/request-edit-dialog";
import { UniformGenderField } from "@/components/uniform-gender-field";
import { RequestHistoryCard, type RequestHistoryRow } from "@/components/request-history-card";
import { uniformGenderLabel, type UniformGenderValue } from "@/lib/uniform-gender";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowDownUp,
  ArrowRight,
  Boxes,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  Download,
  LogOut,
  Building2,
  Pencil,
  Plus,
  Search,
  UsersRound,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  Upload,
  X,
} from "lucide-react";

type Tab = "visao-geral" | "estoque" | "solicitacoes";
type Modal = "novo-item" | "movimentacao" | "editar-estoque" | "solicitacao" | null;

type Variant = {
  id: string;
  sku: string;
  name: string;
  category: string;
  gender: UniformGenderValue | null;
  size: string;
  color: string;
  quantity: number;
  minimum: number;
};

type RequestRow = RequestHistoryRow;

type Dashboard = {
  role: "MASTER_ADMIN" | "STORE_ADMIN";
  account: Account;
  availableStores: { id: string; name: string; code: string }[];
  store: { id: string; name: string; code: string; city: string; state: string };
  employees: { id: string; name: string; email: string | null; ldap: string | null }[];
  variants: Variant[];
  requests: RequestRow[];
  metrics: { totalUnits: number; lowStockCount: number; pendingCount: number; variantCount: number };
};

type Account = { login: string; name: string; role: "MASTER_ADMIN" | "STORE_ADMIN" };

type RequestLine = { variantId: string; quantity: number };

const categoryNames: Record<string, string> = {
  CAMISETA: "Camiseta",
  CALCA: "Calça",
  JAQUETA: "Jaqueta",
  COLETE: "Colete",
  OUTRO: "Outro",
};

const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });

export default function Home() {
  const [tab, setTab] = useState<Tab>("visao-geral");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [account, setAccount] = useState<Account | null>(null);
  const [availableStores, setAvailableStores] = useState<Dashboard["availableStores"]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [showStoreOverview, setShowStoreOverview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [processingRequestId, setProcessingRequestId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [requestLines, setRequestLines] = useState<RequestLine[]>([{ variantId: "", quantity: 1 }]);

  const loadDashboard = useCallback(async (storeId: string) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/dashboard${storeId ? `?storeId=${encodeURIComponent(storeId)}` : ""}`, { cache: "no-store" });
      const data = await response.json();
      if (data.account) setAccount(data.account as Account);
      if (Array.isArray(data.availableStores)) setAvailableStores(data.availableStores);
      if (response.ok && data.code === "STORE_SELECTION_REQUIRED") {
        setDashboard(null);
        setSelectedStoreId("");
        setShowStoreOverview(true);
        setNeedsSetup(false);
        setLoadError("");
        return;
      }
      if (response.status === 404 && data.code === "STORE_NOT_CONFIGURED") {
        setDashboard(null);
        setNeedsSetup(true);
        setShowStoreOverview(false);
        setLoadError("");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Não foi possível carregar o painel.");
      setDashboard(data as Dashboard);
      setSelectedStoreId(data.store.id);
      setShowStoreOverview(false);
      setNeedsSetup(false);
      setLoadError("");
    } catch (error) {
      setDashboard(null);
      setNeedsSetup(false);
      setLoadError(error instanceof Error ? error.message : "Falha de conexão com o banco de dados.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard(new URLSearchParams(window.location.search).get("storeId") ?? "");
  }, [loadDashboard]);

  function selectStore(storeId: string) {
    setImportOpen(false);
    setEditingRequestId(null);
    const url = new URL(window.location.href);
    if (storeId) url.searchParams.set("storeId", storeId);
    else url.searchParams.delete("storeId");
    window.history.replaceState(null, "", url.pathname + url.search);
    setSelectedStoreId(storeId);
    void loadDashboard(storeId);
  }

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dashboard) return;
    setSaving(true);
    const form = new FormData(event.currentTarget);
    let endpoint = "";
    let payload: Record<string, unknown> = {};
    let successMessage = "";

    if (modal === "novo-item") {
      endpoint = "/api/variants";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? dashboard.store.id : undefined,
        sku: form.get("sku"),
        name: form.get("name"),
        category: form.get("category"),
        gender: form.get("gender"),
        size: form.get("size"),
        color: form.get("color"),
        quantity: Number(form.get("quantity")),
        minimum: Number(form.get("minimum")),
      };
      successMessage = "Uniforme cadastrado no estoque.";
    } else if (modal === "movimentacao") {
      endpoint = "/api/inventory";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? dashboard.store.id : undefined,
        variantId: form.get("variantId"),
        type: form.get("type"),
        quantity: Number(form.get("quantity")),
        note: form.get("note"),
      };
      successMessage = "Movimentação registrada.";
    } else if (modal === "editar-estoque" && editingVariant) {
      endpoint = "/api/inventory";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? dashboard.store.id : undefined,
        variantId: editingVariant.id,
        gender: form.get("gender") || null,
        quantity: Number(form.get("quantity")),
        minimum: Number(form.get("minimum")),
      };
      successMessage = "Estoque e classificação atualizados.";
    } else if (modal === "solicitacao") {
      endpoint = "/api/requests";
      payload = {
        storeId: dashboard.role === "MASTER_ADMIN" ? dashboard.store.id : undefined,
        employeeId: form.get("employeeId"),
        notes: form.get("notes"),
        items: requestLines.filter((line) => line.variantId && line.quantity > 0),
      };
      successMessage = "Solicitação enviada para aprovação.";
    }

    try {
      const response = await fetch(endpoint, {
        method: modal === "editar-estoque" ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Não foi possível concluir esta ação.");
      setModal(null);
      setRequestLines([{ variantId: "", quantity: 1 }]);
      showNotice(successMessage);
      await loadDashboard(selectedStoreId);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível concluir esta ação.");
    } finally {
      setSaving(false);
    }
  }

  async function processRequest(request: RequestRow, action: "APROVAR" | "RECUSAR") {
    if (processingRequestId) return;
    setProcessingRequestId(request.id);
    try {
      const response = await fetch(`/api/requests/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, updatedAt: request.updatedAt }),
      });
      const data = await response.json();
      if (!response.ok) {
        if (response.status === 409) await loadDashboard(selectedStoreId);
        throw new Error(data.message ?? "Não foi possível processar o pedido.");
      }
      showNotice(action === "APROVAR" ? "Solicitação aprovada e estoque atualizado." : "Solicitação recusada.");
      await loadDashboard(selectedStoreId);
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível processar o pedido.");
    } finally { setProcessingRequestId(null); }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/admin/login");
  }

  const title = showStoreOverview ? "Todas as lojas" : needsSetup ? "Configuração inicial" : tab === "visao-geral" ? "Visão geral" : tab === "estoque" ? "Estoque de uniformes" : "Solicitações";
  const subtitle = needsSetup
    ? "Cadastre os dados reais da sua unidade para iniciar o controle de uniformes."
    : tab === "visao-geral"
      ? "Acompanhe o que entra, sai e precisa de atenção."
      : tab === "estoque"
        ? "Consulte saldos e mantenha cada item em dia."
        : "Pedidos da equipe, do envio à aprovação.";
  const filteredVariants = dashboard?.variants.filter((variant) => {
    const searchMatch = `${variant.name} ${variant.sku} ${variant.size} ${variant.color} ${uniformGenderLabel(variant.gender)}`.toLowerCase().includes(search.toLowerCase());
    return searchMatch && (categoryFilter === "TODAS" || variant.category === categoryFilter);
  }) ?? [];
  const lowStockItems = dashboard?.variants.filter((variant) => variant.quantity <= variant.minimum) ?? [];
  const isMasterAdmin = account?.role === "MASTER_ADMIN";
  const accountLabel = isMasterAdmin ? "Administrador geral" : "Gestor da loja";
  const accountInitials = (account?.name ?? "?").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <Image className="brand-logo" src="/leroy-merlin.svg" alt="Leroy Merlin" width={56} height={34} />
          <div className="brand-copy"><strong>Gestão Uniformes</strong></div>
        </div>
        <div className="store-switcher">
          <span className="store-indicator" />
          <div><small>{isMasterAdmin ? "VISUALIZAR LOJA" : "LOJA ATIVA"}</small>{isMasterAdmin
            ? <select aria-label="Selecionar loja" value={selectedStoreId} onChange={(event) => selectStore(event.target.value)}>
                <option value="">Todas as lojas</option>
                {availableStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
              </select>
            : <strong>{dashboard?.store.name ?? (loading ? "Carregando..." : "Nenhuma loja")}</strong>}</div>
          {isMasterAdmin ? <ChevronDown size={15} aria-hidden="true" /> : null}
        </div>
        <span className="nav-caption">OPERAÇÃO</span>
        <nav className="main-nav" aria-label="Navegação principal">
          <button aria-label="Visão geral" className={tab === "visao-geral" ? "nav-item active" : "nav-item"} onClick={() => setTab("visao-geral")}>
            <Activity size={18} /><span>Visão geral</span>
          </button>
          <button aria-label="Estoque" className={tab === "estoque" ? "nav-item active" : "nav-item"} onClick={() => setTab("estoque")}>
            <Boxes size={18} /><span>Estoque</span>
            {dashboard?.metrics.lowStockCount ? <span className="nav-count">{dashboard.metrics.lowStockCount}</span> : null}
          </button>
          <button aria-label="Solicitações" className={tab === "solicitacoes" ? "nav-item active" : "nav-item"} onClick={() => setTab("solicitacoes")}>
            <ClipboardList size={18} /><span>Solicitações</span>
            {dashboard?.metrics.pendingCount ? <span className="nav-count">{dashboard.metrics.pendingCount}</span> : null}
          </button>
        </nav>
        {isMasterAdmin ? <>
          <span className="nav-caption">ADMINISTRAÇÃO</span>
          <nav className="main-nav" aria-label="Administração central">
            <Link className="nav-item" href="/admin/lojas" aria-label="Gerenciar lojas"><Building2 size={18} /><span>Gerenciar lojas</span></Link>
            <Link className="nav-item" href="/admin/usuarios" aria-label="Gerenciar usuários"><UsersRound size={18} /><span>Gerenciar usuários</span></Link>
          </nav>
        </> : null}
        <div className="sidebar-bottom">
          <div className="profile-row"><div className="avatar">{accountInitials}</div><div><strong>{account?.name ?? "Carregando..."}</strong><span>{accountLabel}</span></div><button className="logout-button" onClick={() => void logout()} aria-label="Sair do painel" title="Sair"><LogOut size={15} /></button></div>
          <div className="sidebar-footnote">CONTROLE INTERNO <span>•</span> v1.0</div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Operação</span><span className="crumb-divider">/</span><strong>{title}</strong></div>
          <div className="topbar-actions">
            {isMasterAdmin ? <select className="mobile-store-select" aria-label="Selecionar loja" value={selectedStoreId} onChange={(event) => selectStore(event.target.value)}>
              <option value="">Todas as lojas</option>
              {availableStores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
            </select> : null}
            {dashboard ? <span className="topbar-store">{dashboard.store.name}</span> : null}
            <div className="top-avatar" aria-label={account?.name ?? "Usuário"}>{accountInitials}</div>
          </div>
        </header>

        <div className="page-content">
          {showStoreOverview ? <section className="store-overview">
            <div className="store-overview-heading"><div><p className="eyebrow">ADMINISTRAÇÃO CENTRAL</p><h1>Todas as lojas</h1><p>Escolha uma loja para consultar o estoque e as solicitações. Há {availableStores.length} {availableStores.length === 1 ? "loja cadastrada" : "lojas cadastradas"}.</p></div><Link className="button button-secondary" href="/admin/lojas"><Building2 size={16} /> Gerenciar lojas</Link></div>
            {availableStores.length ? <div className="store-overview-grid">{availableStores.map((store) => <button className="store-overview-card" key={store.id} onClick={() => selectStore(store.id)}><span className="store-overview-icon"><Building2 size={20} /></span><span className="store-overview-name">{store.name}</span><span className="store-overview-action">Abrir painel <ArrowRight size={15} /></span></button>)}</div> : <div className="store-overview-empty"><p>Nenhuma loja cadastrada.</p><Link className="button button-primary" href="/admin/lojas">Cadastrar loja <ArrowRight size={15} /></Link></div>}
          </section> : null}
          {!needsSetup && dashboard ? <div className="page-heading">
            <div><p className="eyebrow">{dashboard.store.city} · {dashboard.store.state}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>
            <div className="heading-actions">
              <Link className="button button-secondary" href={`/solicitar?loja=${encodeURIComponent(dashboard?.store.code ?? "")}`}><Plus size={16} /> Área de solicitação</Link>
              <button className="button button-primary" onClick={() => setModal("novo-item")}><Plus size={17} /> Cadastrar item</button>
            </div>
          </div> : null}

          {needsSetup ? <section className="store-setup-panel">
            <div className="store-setup-heading"><span className="public-step-icon"><Boxes size={19} /></span><div><h2>Loja não configurada</h2><p>Peça a um MASTER_ADMIN para criar ou vincular uma loja antes de usar este painel.</p></div></div>
            <Link className="button button-primary" href="/admin/lojas">Abrir gestão de lojas<ArrowRight size={15} /></Link>
          </section> : null}

          {loadError ? <div className="connection-banner"><AlertTriangle size={19} /><div><strong>Não foi possível carregar os dados</strong><span>{loadError} Verifique a conexão com o PostgreSQL e execute a carga inicial.</span></div><button onClick={() => void loadDashboard(selectedStoreId)}>Tentar novamente</button></div> : null}
          {loading && !dashboard ? <div className="loading-panel"><span className="spinner" /> Carregando dados da loja…</div> : null}

          {dashboard ? <>
            <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={18} /></div><div><strong>Olá, {account?.name}</strong><span>{accountLabel} · Confira o resumo da operação de uniformes da loja.</span></div><span className="welcome-date">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span></div>

            {tab === "visao-geral" ? <>
              <section className="metrics-grid" aria-label="Indicadores de estoque">
                <MetricCard label="Peças em estoque" value={dashboard.metrics.totalUnits.toLocaleString("pt-BR")} icon={<Shirt size={18} />} detail={`${dashboard.metrics.variantCount} variações cadastradas`} tone="green" />
                <MetricCard label="Abaixo do mínimo" value={dashboard.metrics.lowStockCount.toString().padStart(2, "0")} icon={<AlertTriangle size={18} />} detail="Itens que precisam de reposição" tone="amber" />
                <MetricCard label="Aguardando aprovação" value={dashboard.metrics.pendingCount.toString().padStart(2, "0")} icon={<Clock3 size={18} />} detail="Solicitações da equipe" tone="blue" />
                <MetricCard label="Loja" value={dashboard.store.name} icon={<Activity size={18} />} detail={`${dashboard.store.city} · ${dashboard.store.state}`} tone="charcoal" compact />
              </section>

              <div className="overview-grid">
                <section className="content-panel inventory-panel">
                  <div className="panel-heading"><div><span className="section-kicker">PONTO DE ATENÇÃO</span><h2>Reposição necessária</h2></div><button className="text-link" onClick={() => setTab("estoque")}>Ver estoque <ArrowRight size={15} /></button></div>
                  {lowStockItems.length ? <div className="attention-list">{lowStockItems.slice(0, 4).map((variant) => <div className="attention-row" key={variant.id}><div className="item-glyph"><Shirt size={17} /></div><div className="item-main"><strong>{variant.name}</strong><span>{uniformGenderLabel(variant.gender)} · {variant.color} · Tam. {variant.size}</span></div><div className="stock-level"><strong>{variant.quantity}</strong><span>mín. {variant.minimum}</span></div><span className="low-pill">Repor</span></div>)}</div> : <div className="empty-inline"><CheckCircle2 size={18} /> Todos os itens estão acima do mínimo.</div>}
                  <button className="panel-footer-link" onClick={() => setModal("movimentacao")}><ArrowDownToLine size={16} /> Registrar entrada de estoque <ArrowRight size={14} /></button>
                </section>

                <section className="content-panel request-panel">
                  <div className="panel-heading"><div><span className="section-kicker">FLUXO DA EQUIPE</span><h2>Solicitações recentes</h2></div><button className="text-link" onClick={() => setTab("solicitacoes")}>Ver todas <ArrowRight size={15} /></button></div>
                  {dashboard.requests.length ? <div className="recent-list">{dashboard.requests.slice(0, 4).map((request) => <RequestListItem key={request.id} request={request} />)}</div> : <div className="empty-inline">Nenhuma solicitação registrada.</div>}
                  <button className="panel-footer-link" onClick={() => { setRequestLines([{ variantId: "", quantity: 1 }]); setModal("solicitacao"); }}><Plus size={16} /> Criar solicitação para colaborador <ArrowRight size={14} /></button>
                </section>
              </div>
            </> : null}

            {tab === "estoque" ? <section className="content-panel full-panel">
              <div className="panel-heading stock-panel-heading"><div><span className="section-kicker">{filteredVariants.length} ITENS</span><h2>Saldo por uniforme</h2></div><div className="table-actions"><a className="button button-secondary button-small" href={`/api/exports/inventory?storeId=${encodeURIComponent(dashboard.store.id)}`}><Download size={15} /> Exportar CSV</a><button className="button button-secondary button-small" onClick={() => setImportOpen(true)}><Upload size={15} /> Importar Excel</button><button className="button button-secondary button-small" onClick={() => setModal("movimentacao")}><ArrowDownUp size={15} /> Movimentar estoque</button><button className="button button-primary button-small" onClick={() => setModal("novo-item")}><Plus size={16} /> Novo item</button></div></div>
              <div className="filter-bar"><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, SKU, tamanho…" /></label><label className="select-filter"><SlidersHorizontal size={15} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="TODAS">Todas as categorias</option><option value="CAMISETA">Camisetas</option><option value="CALCA">Calças</option><option value="JAQUETA">Jaquetas</option><option value="COLETE">Coletes</option><option value="OUTRO">Outros</option></select><ChevronDown size={14} /></label></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>UNIFORME</th><th>SKU</th><th>CATEGORIA</th><th>CLASSIFICAÇÃO</th><th>TAMANHO</th><th>DISPONÍVEL</th><th>ESTOQUE MÍNIMO</th><th>STATUS</th><th>AÇÃO</th></tr></thead>
                  <tbody>{filteredVariants.map((variant) => <tr key={variant.id}>
                    <td><div className="table-product"><div className="item-glyph"><Shirt size={16} /></div><div><strong>{variant.name}</strong><span>{variant.color}</span></div></div></td>
                    <td><span className="sku-label">{variant.sku}</span></td>
                    <td>{categoryNames[variant.category] ?? variant.category}</td>
                    <td>{uniformGenderLabel(variant.gender)}</td>
                    <td><span className="size-chip">{variant.size}</span></td>
                    <td><strong className={variant.quantity <= variant.minimum ? "quantity-low" : "quantity-good"}>{variant.quantity}</strong> <span className="unit-label">peças</span></td>
                    <td>{variant.minimum} peças</td>
                    <td><span className={variant.quantity <= variant.minimum ? "status-pill status-warn" : "status-pill status-ok"}><i />{variant.quantity <= variant.minimum ? "Repor" : "Adequado"}</span></td>
                    <td><button className="edit-row-button" onClick={() => { setEditingVariant(variant); setModal("editar-estoque"); }}><Pencil size={14} /> Editar</button></td>
                  </tr>)}</tbody>
                </table>
                {!filteredVariants.length ? <div className="table-empty">Nenhum uniforme encontrado para esse filtro.</div> : null}
              </div>
              <div className="table-note"><span><i className="legend-dot" /> Saldo igual ou abaixo do mínimo</span><span>Atualizado agora</span></div>
            </section> : null}

            {tab === "solicitacoes" ? <section className="content-panel full-panel">
              <div className="panel-heading stock-panel-heading"><div><span className="section-kicker">{dashboard.requests.length} REGISTROS</span><h2>Histórico de solicitações</h2></div><div className="table-actions"><a className="button button-secondary button-small" href={`/api/exports/requests?storeId=${encodeURIComponent(dashboard.store.id)}`}><Download size={15} /> Exportar histórico</a><button className="button button-primary button-small" onClick={() => { setRequestLines([{ variantId: "", quantity: 1 }]); setModal("solicitacao"); }}><Plus size={16} /> Nova solicitação</button></div></div>
              <div className="request-queue">{dashboard.requests.length ? dashboard.requests.map((request) => <RequestHistoryCard key={request.id} request={request} busy={!!processingRequestId} onEdit={() => setEditingRequestId(request.id)} onProcess={(action) => void processRequest(request, action)} />) : <div className="empty-state"><ClipboardList size={28} /><strong>Sem solicitações por enquanto</strong><span>Quando a equipe pedir uniformes, eles aparecerão aqui.</span></div>}</div>
            </section> : null}
          </> : null}
          <footer className="page-footer"><span>Uniformes · Controle de estoque</span><span>Dados da loja <b>●</b> sincronizados</span></footer>
        </div>
      </section>

      {modal ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="section-kicker">{modal === "solicitacao" ? "PEDIDO DA EQUIPE" : modal === "movimentacao" ? "CONTROLE DE SALDO" : modal === "editar-estoque" ? "EDIÇÃO DE ESTOQUE" : "CATÁLOGO DE UNIFORMES"}</span><h2 id="modal-title">{modal === "solicitacao" ? "Solicitar uniforme" : modal === "movimentacao" ? "Movimentar estoque" : modal === "editar-estoque" ? "Editar estoque" : "Cadastrar item"}</h2></div><button className="icon-button modal-close" onClick={() => setModal(null)} aria-label="Fechar"><X size={18} /></button></div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          {modal === "novo-item" ? <div className="form-grid"><UniformGenderField /><label className="form-field span-two"><span>Nome do uniforme</span><input name="name" placeholder="Ex.: Camiseta operacional" required maxLength={100} /></label><label className="form-field"><span>Categoria</span><select name="category" required defaultValue="CAMISETA"><option value="CAMISETA">Camiseta</option><option value="CALCA">Calça</option><option value="JAQUETA">Jaqueta</option><option value="COLETE">Colete</option><option value="OUTRO">Outro</option></select></label><label className="form-field"><span>SKU</span><input name="sku" placeholder="Ex.: CAM-AZ-M" required maxLength={40} /></label><label className="form-field"><span>Tamanho</span><input name="size" placeholder="Ex.: M, G, 42" required maxLength={20} /></label><label className="form-field"><span>Cor</span><input name="color" placeholder="Ex.: Azul marinho" required maxLength={40} /></label><label className="form-field"><span>Saldo inicial</span><input name="quantity" type="number" min="0" step="1" defaultValue="0" required /></label><label className="form-field"><span>Estoque mínimo</span><input name="minimum" type="number" min="0" step="1" defaultValue="5" required /></label></div> : null}
          {modal === "movimentacao" ? <div className="form-grid"><label className="form-field span-two"><span>Uniforme</span><select name="variantId" required defaultValue=""><option value="" disabled>Selecione um item</option>{dashboard?.variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.name} · {uniformGenderLabel(variant.gender)} · {variant.color} · {variant.size} (saldo {variant.quantity})</option>)}</select></label><label className="form-field"><span>Tipo de movimentação</span><select name="type" defaultValue="ENTRADA"><option value="ENTRADA">Entrada de peças</option><option value="AJUSTE">Ajuste para saldo contado</option></select></label><label className="form-field"><span>Quantidade</span><input name="quantity" type="number" min="0" step="1" defaultValue="1" required /><small>No ajuste, informe o saldo total contado.</small></label><label className="form-field span-two"><span>Observação</span><input name="note" placeholder="Ex.: Recebimento do fornecedor" maxLength={300} /></label></div> : null}
          {modal === "editar-estoque" && editingVariant ? <div className="form-grid"><UniformGenderField value={editingVariant.gender} allowUnknown /><div className="edit-stock-identity span-two"><span className="item-glyph"><Shirt size={17} /></span><div><strong>{editingVariant.name}</strong><small>{editingVariant.color} · Tam. {editingVariant.size} · SKU {editingVariant.sku}</small></div></div><label className="form-field"><span>Quantidade disponível</span><input name="quantity" type="number" min="0" max="1000000" step="1" defaultValue={editingVariant.quantity} required /></label><label className="form-field"><span>Estoque mínimo</span><input name="minimum" type="number" min="0" max="1000000" step="1" defaultValue={editingVariant.minimum} required /></label><p className="edit-stock-note span-two">Alterações no saldo disponível ficam registradas no histórico de movimentações.</p></div> : null}
          {modal === "solicitacao" ? <div className="request-form-content"><label className="form-field"><span>Colaborador</span><select name="employeeId" required defaultValue=""><option value="" disabled>Selecione quem está solicitando</option>{dashboard?.employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name} · {employee.ldap ? `LDAP ${employee.ldap}` : employee.email ?? "Sem e-mail"}</option>)}</select></label><div className="line-items-heading"><span>ITENS DO PEDIDO</span><button type="button" className="add-line-button" onClick={() => setRequestLines((lines) => [...lines, { variantId: "", quantity: 1 }])}><Plus size={14} /> Adicionar item</button></div><div className="request-lines">{requestLines.map((line, index) => <div className="request-line" key={index}><label className="form-field"><span>Uniforme</span><select value={line.variantId} onChange={(event) => setRequestLines((lines) => lines.map((item, itemIndex) => itemIndex === index ? { ...item, variantId: event.target.value } : item))} required><option value="" disabled>Selecione uma peça</option>{dashboard?.variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.name} · {uniformGenderLabel(variant.gender)} · {variant.size}</option>)}</select></label><label className="form-field quantity-field"><span>Qtd.</span><input type="number" min="1" max="20" value={line.quantity} onChange={(event) => setRequestLines((lines) => lines.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} required /></label>{requestLines.length > 1 ? <button type="button" className="remove-line" onClick={() => setRequestLines((lines) => lines.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remover item"><X size={16} /></button> : null}</div>)}</div><label className="form-field"><span>Observação <em>opcional</em></span><textarea name="notes" placeholder="Informe motivo, data de início ou outra observação" rows={3} maxLength={500} /></label><div className="form-hint"><Clock3 size={15} /> O pedido ficará pendente até a aprovação da loja.</div></div> : null}
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Salvando…" : modal === "solicitacao" ? "Enviar solicitação" : modal === "movimentacao" ? "Registrar movimentação" : modal === "editar-estoque" ? "Salvar estoque" : "Salvar item"}<ArrowRight size={15} /></button></div>
        </form>
      </section></div> : null}
      {importOpen && dashboard ? <InventoryImportDialog key={dashboard.store.id} store={dashboard.store} onClose={() => setImportOpen(false)} onSuccess={(message) => { setImportOpen(false); showNotice(message); void loadDashboard(dashboard.store.id); }} /> : null}
      {editingRequestId && dashboard ? <RequestEditDialog key={`${dashboard.store.id}:${editingRequestId}`} requestId={editingRequestId} variants={dashboard.variants} onClose={() => setEditingRequestId(null)} onSaved={() => { setEditingRequestId(null); showNotice("Solicitação ajustada. O pedido continua pendente de aprovação."); void loadDashboard(dashboard.store.id); }} /> : null}
      {notice ? <div className="toast" role="status"><CheckCircle2 size={17} />{notice}</div> : null}
    </main>
  );
}

function MetricCard({ label, value, icon, detail, tone, compact = false }: { label: string; value: string; icon: React.ReactNode; detail: string; tone: string; compact?: boolean }) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><div className="metric-icon">{icon}</div></div><strong className={compact ? "metric-value metric-value-compact" : "metric-value"}>{value}</strong><span className="metric-detail">{detail}</span></article>;
}

function RequestListItem({ request }: { request: RequestRow }) {
  return <div className="recent-row"><div className="recent-avatar"><UserRound size={16} /></div><div className="recent-info"><strong>{request.employee}</strong><span>{request.ldap ? `LDAP ${request.ldap} · ` : ""}{dateLabel.format(new Date(request.createdAt))}</span><span className="recent-items">{request.items.map((item) => `${item.quantity}x ${item.name} · ${uniformGenderLabel(item.gender)} · Tam. ${item.size}`).join("; ")}</span></div><span className={request.status === "PENDENTE" ? "status-pill status-pending" : request.status === "APROVADA" ? "status-pill status-ok" : "status-pill status-rejected"}><i />{statusLabel(request.status)}</span></div>;
}

function statusLabel(status: RequestRow["status"]) {
  return status === "PENDENTE" ? "Pendente" : status === "APROVADA" ? "Aprovada" : "Recusada";
}
