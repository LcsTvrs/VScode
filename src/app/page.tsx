"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  ArrowDownUp,
  ArrowRight,
  Bell,
  Boxes,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock3,
  LogOut,
  Pencil,
  Plus,
  Search,
  Shirt,
  SlidersHorizontal,
  Sparkles,
  UserRound,
  X,
} from "lucide-react";

type Tab = "visao-geral" | "estoque" | "solicitacoes";
type Modal = "novo-item" | "movimentacao" | "editar-estoque" | "solicitacao" | null;

type Variant = {
  id: string;
  sku: string;
  name: string;
  category: string;
  size: string;
  color: string;
  quantity: number;
  minimum: number;
};

type RequestRow = {
  id: string;
  code: string;
  employee: string;
  ldap: string | null;
  status: "PENDENTE" | "APROVADA" | "RECUSADA";
  createdAt: string;
  itemCount: number;
  summary: string;
};

type Dashboard = {
  store: { id: string; name: string; code: string; city: string; state: string };
  employees: { id: string; name: string; email: string | null; ldap: string | null }[];
  variants: Variant[];
  requests: RequestRow[];
  metrics: { totalUnits: number; lowStockCount: number; pendingCount: number; variantCount: number };
};

type RequestLine = { variantId: string; quantity: number };

const categoryNames: Record<string, string> = {
  CAMISETA: "Camiseta",
  CALCA: "Calça",
  JAQUETA: "Jaqueta",
  COLETE: "Colete",
  OUTRO: "Outro",
};

const dateLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short" });
const dateTimeLabel = new Intl.DateTimeFormat("pt-BR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

export default function Home() {
  const [tab, setTab] = useState<Tab>("visao-geral");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [requestLines, setRequestLines] = useState<RequestLine[]>([{ variantId: "", quantity: 1 }]);

  async function loadDashboard() {
    setLoading(true);
    try {
      const response = await fetch("/api/dashboard", { cache: "no-store" });
      const data = await response.json();
      if (response.status === 404 && data.code === "STORE_NOT_CONFIGURED") {
        setDashboard(null);
        setNeedsSetup(true);
        setLoadError("");
        return;
      }
      if (!response.ok) throw new Error(data.message ?? "Não foi possível carregar o painel.");
      setDashboard(data as Dashboard);
      setNeedsSetup(false);
      setLoadError("");
    } catch (error) {
      setNeedsSetup(false);
      setLoadError(error instanceof Error ? error.message : "Falha de conexão com o banco de dados.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  function showNotice(message: string) {
    setNotice(message);
    window.setTimeout(() => setNotice(""), 3600);
  }

  async function handleStoreSetup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: form.get("code"),
          name: form.get("name"),
          city: form.get("city"),
          state: form.get("state"),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Não foi possível cadastrar a loja.");
      showNotice("Loja cadastrada. Agora inclua os uniformes e saldos reais.");
      await loadDashboard();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível cadastrar a loja.");
    } finally {
      setSaving(false);
    }
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
        storeId: dashboard.store.id,
        sku: form.get("sku"),
        name: form.get("name"),
        category: form.get("category"),
        size: form.get("size"),
        color: form.get("color"),
        quantity: Number(form.get("quantity")),
        minimum: Number(form.get("minimum")),
      };
      successMessage = "Uniforme cadastrado no estoque.";
    } else if (modal === "movimentacao") {
      endpoint = "/api/inventory";
      payload = {
        storeId: dashboard.store.id,
        variantId: form.get("variantId"),
        type: form.get("type"),
        quantity: Number(form.get("quantity")),
        note: form.get("note"),
      };
      successMessage = "Movimentação registrada.";
    } else if (modal === "editar-estoque" && editingVariant) {
      endpoint = "/api/inventory";
      payload = {
        storeId: dashboard.store.id,
        variantId: editingVariant.id,
        quantity: Number(form.get("quantity")),
        minimum: Number(form.get("minimum")),
      };
      successMessage = "Saldo e estoque mínimo atualizados.";
    } else if (modal === "solicitacao") {
      endpoint = "/api/requests";
      payload = {
        storeId: dashboard.store.id,
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
      await loadDashboard();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível concluir esta ação.");
    } finally {
      setSaving(false);
    }
  }

  async function processRequest(id: string, action: "APROVAR" | "RECUSAR") {
    try {
      const response = await fetch(`/api/requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Não foi possível processar o pedido.");
      showNotice(action === "APROVAR" ? "Solicitação aprovada e estoque atualizado." : "Solicitação recusada.");
      await loadDashboard();
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Não foi possível processar o pedido.");
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => undefined);
    window.location.assign("/admin/login");
  }

  const title = needsSetup ? "Configuração inicial" : tab === "visao-geral" ? "Visão geral" : tab === "estoque" ? "Estoque de uniformes" : "Solicitações";
  const subtitle = needsSetup
    ? "Cadastre os dados reais da sua unidade para iniciar o controle de uniformes."
    : tab === "visao-geral"
      ? "Acompanhe o que entra, sai e precisa de atenção."
      : tab === "estoque"
        ? "Consulte saldos e mantenha cada item em dia."
        : "Pedidos da equipe, do envio à aprovação.";
  const filteredVariants = dashboard?.variants.filter((variant) => {
    const searchMatch = `${variant.name} ${variant.sku} ${variant.size} ${variant.color}`.toLowerCase().includes(search.toLowerCase());
    return searchMatch && (categoryFilter === "TODAS" || variant.category === categoryFilter);
  }) ?? [];
  const lowStockItems = dashboard?.variants.filter((variant) => variant.quantity <= variant.minimum) ?? [];

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">L<span>M</span></div>
          <div className="brand-copy"><strong>uniformes</strong><span>gestão de loja</span></div>
        </div>
        <div className="store-switcher">
          <span className="store-indicator" />
          <div><small>LOJA ATIVA</small><strong>{dashboard?.store.name ?? "Leroy Merlin"}</strong></div>
          <ChevronDown size={15} aria-hidden="true" />
        </div>
        <span className="nav-caption">OPERAÇÃO</span>
        <nav className="main-nav" aria-label="Navegação principal">
          <button className={tab === "visao-geral" ? "nav-item active" : "nav-item"} onClick={() => setTab("visao-geral")}>
            <Activity size={18} /><span>Visão geral</span>
          </button>
          <button className={tab === "estoque" ? "nav-item active" : "nav-item"} onClick={() => setTab("estoque")}>
            <Boxes size={18} /><span>Estoque</span>
            {dashboard?.metrics.lowStockCount ? <span className="nav-count">{dashboard.metrics.lowStockCount}</span> : null}
          </button>
          <button className={tab === "solicitacoes" ? "nav-item active" : "nav-item"} onClick={() => setTab("solicitacoes")}>
            <ClipboardList size={18} /><span>Solicitações</span>
            {dashboard?.metrics.pendingCount ? <span className="nav-count">{dashboard.metrics.pendingCount}</span> : null}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="profile-row"><div className="avatar">AD</div><div><strong>Administrador</strong><span>Sessão administrativa</span></div><button className="logout-button" onClick={() => void logout()} aria-label="Sair do painel" title="Sair"><LogOut size={15} /></button></div>
          <div className="sidebar-footnote">CONTROLE INTERNO <span>•</span> v1.0</div>
        </div>
      </aside>

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Operação</span><span className="crumb-divider">/</span><strong>{title}</strong></div>
          <div className="topbar-actions">
            <span className="topbar-store">{dashboard?.store.code ?? "LM-SP-001"}</span>
            <button className="icon-button notification-button" aria-label="Notificações"><Bell size={18} /><i /></button>
            <div className="top-avatar">MS</div>
          </div>
        </header>

        <div className="page-content">
          {!needsSetup ? <div className="page-heading">
            <div><p className="eyebrow">{dashboard?.store.city ?? "SÃO PAULO"} · {dashboard?.store.state ?? "SP"}</p><h1>{title}</h1><p className="page-subtitle">{subtitle}</p></div>
            <div className="heading-actions">
              <Link className="button button-secondary" href="/solicitar"><Plus size={16} /> Área de solicitação</Link>
              <button className="button button-primary" onClick={() => setModal("novo-item")}><Plus size={17} /> Cadastrar item</button>
            </div>
          </div> : null}

          {needsSetup ? <section className="store-setup-panel">
            <div className="store-setup-heading"><span className="public-step-icon"><Boxes size={19} /></span><div><h2>Cadastre sua loja</h2><p>Os próximos cadastros e solicitações serão vinculados a esta unidade.</p></div></div>
            <form className="form-grid" onSubmit={(event) => void handleStoreSetup(event)}>
              <label className="form-field"><span>Código da loja</span><input name="code" placeholder="Ex.: LM-SP-001" minLength={2} maxLength={20} pattern="[A-Za-z0-9-]{2,20}" required /></label>
              <label className="form-field"><span>Nome da unidade</span><input name="name" placeholder="Nome da loja" minLength={2} maxLength={100} required /></label>
              <label className="form-field"><span>Cidade</span><input name="city" placeholder="Cidade" minLength={2} maxLength={80} required /></label>
              <label className="form-field"><span>Estado (UF)</span><input name="state" placeholder="SP" minLength={2} maxLength={2} pattern="[A-Za-z]{2}" required /></label>
              <button type="submit" className="button button-primary span-two" disabled={saving}>{saving ? "Salvando…" : "Salvar loja"}<ArrowRight size={15} /></button>
            </form>
          </section> : null}

          {loadError ? <div className="connection-banner"><AlertTriangle size={19} /><div><strong>Não foi possível carregar os dados</strong><span>{loadError} Verifique a conexão com o PostgreSQL e execute a carga inicial.</span></div><button onClick={() => void loadDashboard()}>Tentar novamente</button></div> : null}
          {loading && !dashboard ? <div className="loading-panel"><span className="spinner" /> Carregando dados da loja…</div> : null}

          {dashboard ? <>
            <div className="welcome-strip"><div className="welcome-icon"><Sparkles size={18} /></div><div><strong>Bom dia, Marina</strong><span>Confira o resumo da operação de uniformes da sua loja.</span></div><span className="welcome-date">{new Intl.DateTimeFormat("pt-BR", { weekday: "long", day: "numeric", month: "long" }).format(new Date())}</span></div>

            {tab === "visao-geral" ? <>
              <section className="metrics-grid" aria-label="Indicadores de estoque">
                <MetricCard label="Peças em estoque" value={dashboard.metrics.totalUnits.toLocaleString("pt-BR")} icon={<Shirt size={18} />} detail={`${dashboard.metrics.variantCount} variações cadastradas`} tone="green" />
                <MetricCard label="Abaixo do mínimo" value={dashboard.metrics.lowStockCount.toString().padStart(2, "0")} icon={<AlertTriangle size={18} />} detail="Itens que precisam de reposição" tone="amber" />
                <MetricCard label="Aguardando aprovação" value={dashboard.metrics.pendingCount.toString().padStart(2, "0")} icon={<Clock3 size={18} />} detail="Solicitações da equipe" tone="blue" />
                <MetricCard label="Loja" value={dashboard.store.code} icon={<Activity size={18} />} detail={`${dashboard.store.city} · ${dashboard.store.state}`} tone="charcoal" compact />
              </section>

              <div className="overview-grid">
                <section className="content-panel inventory-panel">
                  <div className="panel-heading"><div><span className="section-kicker">PONTO DE ATENÇÃO</span><h2>Reposição necessária</h2></div><button className="text-link" onClick={() => setTab("estoque")}>Ver estoque <ArrowRight size={15} /></button></div>
                  {lowStockItems.length ? <div className="attention-list">{lowStockItems.slice(0, 4).map((variant) => <div className="attention-row" key={variant.id}><div className="item-glyph"><Shirt size={17} /></div><div className="item-main"><strong>{variant.name}</strong><span>{variant.color} · Tam. {variant.size}</span></div><div className="stock-level"><strong>{variant.quantity}</strong><span>mín. {variant.minimum}</span></div><span className="low-pill">Repor</span></div>)}</div> : <div className="empty-inline"><CheckCircle2 size={18} /> Todos os itens estão acima do mínimo.</div>}
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
              <div className="panel-heading stock-panel-heading"><div><span className="section-kicker">{filteredVariants.length} ITENS</span><h2>Saldo por uniforme</h2></div><div className="table-actions"><button className="button button-secondary button-small" onClick={() => setModal("movimentacao")}><ArrowDownUp size={15} /> Movimentar estoque</button><button className="button button-primary button-small" onClick={() => setModal("novo-item")}><Plus size={16} /> Novo item</button></div></div>
              <div className="filter-bar"><label className="search-field"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por nome, SKU, tamanho…" /></label><label className="select-filter"><SlidersHorizontal size={15} /><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}><option value="TODAS">Todas as categorias</option><option value="CAMISETA">Camisetas</option><option value="CALCA">Calças</option><option value="JAQUETA">Jaquetas</option><option value="COLETE">Coletes</option><option value="OUTRO">Outros</option></select><ChevronDown size={14} /></label></div>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>UNIFORME</th><th>SKU</th><th>CATEGORIA</th><th>TAMANHO</th><th>DISPONÍVEL</th><th>ESTOQUE MÍNIMO</th><th>STATUS</th><th>AÇÃO</th></tr></thead>
                  <tbody>{filteredVariants.map((variant) => <tr key={variant.id}>
                    <td><div className="table-product"><div className="item-glyph"><Shirt size={16} /></div><div><strong>{variant.name}</strong><span>{variant.color}</span></div></div></td>
                    <td><span className="sku-label">{variant.sku}</span></td>
                    <td>{categoryNames[variant.category] ?? variant.category}</td>
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
              <div className="panel-heading stock-panel-heading"><div><span className="section-kicker">{dashboard.requests.length} REGISTROS</span><h2>Pedidos da equipe</h2></div><button className="button button-primary button-small" onClick={() => { setRequestLines([{ variantId: "", quantity: 1 }]); setModal("solicitacao"); }}><Plus size={16} /> Nova solicitação</button></div>
              <div className="request-queue">{dashboard.requests.length ? dashboard.requests.map((request) => <article className="request-card" key={request.id}><div className="request-card-icon"><ClipboardList size={19} /></div><div className="request-card-main"><div className="request-card-title"><strong>{request.code}</strong><span className={request.status === "PENDENTE" ? "status-pill status-pending" : request.status === "APROVADA" ? "status-pill status-ok" : "status-pill status-rejected"}><i />{statusLabel(request.status)}</span></div><p>{request.summary}</p><div className="request-meta"><span><UserRound size={13} /> {request.employee}{request.ldap ? ` · LDAP ${request.ldap}` : ""}</span><span><Clock3 size={13} /> {dateTimeLabel.format(new Date(request.createdAt))}</span><span>{request.itemCount} {request.itemCount === 1 ? "peça" : "peças"}</span></div></div>{request.status === "PENDENTE" ? <div className="request-actions"><button className="icon-action approve-action" onClick={() => void processRequest(request.id, "APROVAR")} aria-label={`Aprovar ${request.code}`} title="Aprovar"><Check size={17} /></button><button className="icon-action reject-action" onClick={() => void processRequest(request.id, "RECUSAR")} aria-label={`Recusar ${request.code}`} title="Recusar"><X size={17} /></button></div> : null}</article>) : <div className="empty-state"><ClipboardList size={28} /><strong>Sem solicitações por enquanto</strong><span>Quando a equipe pedir uniformes, eles aparecerão aqui.</span></div>}</div>
            </section> : null}
          </> : null}
          <footer className="page-footer"><span>Uniformes · Controle de estoque</span><span>Dados da loja <b>●</b> sincronizados</span></footer>
        </div>
      </section>

      {modal ? <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div className="modal-heading"><div><span className="section-kicker">{modal === "solicitacao" ? "PEDIDO DA EQUIPE" : modal === "movimentacao" ? "CONTROLE DE SALDO" : modal === "editar-estoque" ? "EDIÇÃO DE ESTOQUE" : "CATÁLOGO DE UNIFORMES"}</span><h2 id="modal-title">{modal === "solicitacao" ? "Solicitar uniforme" : modal === "movimentacao" ? "Movimentar estoque" : modal === "editar-estoque" ? "Editar saldos" : "Cadastrar item"}</h2></div><button className="icon-button modal-close" onClick={() => setModal(null)} aria-label="Fechar"><X size={18} /></button></div>
        <form onSubmit={(event) => void handleSubmit(event)}>
          {modal === "novo-item" ? <div className="form-grid"><label className="form-field span-two"><span>Nome do uniforme</span><input name="name" placeholder="Ex.: Camiseta operacional" required maxLength={100} /></label><label className="form-field"><span>Categoria</span><select name="category" required defaultValue="CAMISETA"><option value="CAMISETA">Camiseta</option><option value="CALCA">Calça</option><option value="JAQUETA">Jaqueta</option><option value="COLETE">Colete</option><option value="OUTRO">Outro</option></select></label><label className="form-field"><span>SKU</span><input name="sku" placeholder="Ex.: CAM-AZ-M" required maxLength={40} /></label><label className="form-field"><span>Tamanho</span><input name="size" placeholder="Ex.: M, G, 42" required maxLength={20} /></label><label className="form-field"><span>Cor</span><input name="color" placeholder="Ex.: Azul marinho" required maxLength={40} /></label><label className="form-field"><span>Saldo inicial</span><input name="quantity" type="number" min="0" step="1" defaultValue="0" required /></label><label className="form-field"><span>Estoque mínimo</span><input name="minimum" type="number" min="0" step="1" defaultValue="5" required /></label></div> : null}
          {modal === "movimentacao" ? <div className="form-grid"><label className="form-field span-two"><span>Uniforme</span><select name="variantId" required defaultValue=""><option value="" disabled>Selecione um item</option>{dashboard?.variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.name} · {variant.color} · {variant.size} (saldo {variant.quantity})</option>)}</select></label><label className="form-field"><span>Tipo de movimentação</span><select name="type" defaultValue="ENTRADA"><option value="ENTRADA">Entrada de peças</option><option value="AJUSTE">Ajuste para saldo contado</option></select></label><label className="form-field"><span>Quantidade</span><input name="quantity" type="number" min="0" step="1" defaultValue="1" required /><small>No ajuste, informe o saldo total contado.</small></label><label className="form-field span-two"><span>Observação</span><input name="note" placeholder="Ex.: Recebimento do fornecedor" maxLength={300} /></label></div> : null}
          {modal === "editar-estoque" && editingVariant ? <div className="form-grid"><div className="edit-stock-identity span-two"><span className="item-glyph"><Shirt size={17} /></span><div><strong>{editingVariant.name}</strong><small>{editingVariant.color} · Tam. {editingVariant.size} · SKU {editingVariant.sku}</small></div></div><label className="form-field"><span>Quantidade disponível</span><input name="quantity" type="number" min="0" max="1000000" step="1" defaultValue={editingVariant.quantity} required /></label><label className="form-field"><span>Estoque mínimo</span><input name="minimum" type="number" min="0" max="1000000" step="1" defaultValue={editingVariant.minimum} required /></label><p className="edit-stock-note span-two">Alterações no saldo disponível ficam registradas no histórico de movimentações.</p></div> : null}
          {modal === "solicitacao" ? <div className="request-form-content"><label className="form-field"><span>Colaborador</span><select name="employeeId" required defaultValue=""><option value="" disabled>Selecione quem está solicitando</option>{dashboard?.employees.map((employee) => <option value={employee.id} key={employee.id}>{employee.name} · {employee.ldap ? `LDAP ${employee.ldap}` : employee.email ?? "Sem e-mail"}</option>)}</select></label><div className="line-items-heading"><span>ITENS DO PEDIDO</span><button type="button" className="add-line-button" onClick={() => setRequestLines((lines) => [...lines, { variantId: "", quantity: 1 }])}><Plus size={14} /> Adicionar item</button></div><div className="request-lines">{requestLines.map((line, index) => <div className="request-line" key={index}><label className="form-field"><span>Uniforme</span><select value={line.variantId} onChange={(event) => setRequestLines((lines) => lines.map((item, itemIndex) => itemIndex === index ? { ...item, variantId: event.target.value } : item))} required><option value="" disabled>Selecione uma peça</option>{dashboard?.variants.map((variant) => <option value={variant.id} key={variant.id}>{variant.name} · {variant.size}</option>)}</select></label><label className="form-field quantity-field"><span>Qtd.</span><input type="number" min="1" max="20" value={line.quantity} onChange={(event) => setRequestLines((lines) => lines.map((item, itemIndex) => itemIndex === index ? { ...item, quantity: Number(event.target.value) } : item))} required /></label>{requestLines.length > 1 ? <button type="button" className="remove-line" onClick={() => setRequestLines((lines) => lines.filter((_, itemIndex) => itemIndex !== index))} aria-label="Remover item"><X size={16} /></button> : null}</div>)}</div><label className="form-field"><span>Observação <em>opcional</em></span><textarea name="notes" placeholder="Informe motivo, data de início ou outra observação" rows={3} maxLength={500} /></label><div className="form-hint"><Clock3 size={15} /> O pedido ficará pendente até a aprovação da loja.</div></div> : null}
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(null)}>Cancelar</button><button type="submit" className="button button-primary" disabled={saving}>{saving ? "Salvando…" : modal === "solicitacao" ? "Enviar solicitação" : modal === "movimentacao" ? "Registrar movimentação" : modal === "editar-estoque" ? "Salvar saldos" : "Salvar item"}<ArrowRight size={15} /></button></div>
        </form>
      </section></div> : null}
      {notice ? <div className="toast" role="status"><CheckCircle2 size={17} />{notice}</div> : null}
    </main>
  );
}

function MetricCard({ label, value, icon, detail, tone, compact = false }: { label: string; value: string; icon: React.ReactNode; detail: string; tone: string; compact?: boolean }) {
  return <article className={`metric-card metric-${tone}`}><div className="metric-top"><span>{label}</span><div className="metric-icon">{icon}</div></div><strong className={compact ? "metric-value metric-value-compact" : "metric-value"}>{value}</strong><span className="metric-detail">{detail}</span></article>;
}

function RequestListItem({ request }: { request: RequestRow }) {
  return <div className="recent-row"><div className="recent-avatar"><UserRound size={16} /></div><div className="recent-info"><strong>{request.employee}</strong><span>{request.ldap ? `LDAP ${request.ldap} · ` : ""}{request.code} · {dateLabel.format(new Date(request.createdAt))}</span></div><span className={request.status === "PENDENTE" ? "status-pill status-pending" : request.status === "APROVADA" ? "status-pill status-ok" : "status-pill status-rejected"}><i />{statusLabel(request.status)}</span></div>;
}

function statusLabel(status: RequestRow["status"]) {
  return status === "PENDENTE" ? "Pendente" : status === "APROVADA" ? "Aprovada" : "Recusada";
}
