"use client";

import { CatalogOptionsDialog } from "@/features/inventory/components/catalog-options-dialog";
import { InventoryPanel } from "@/features/inventory/components/inventory-panel";
import { RequestHistoryPanel } from "@/features/requests/components/history-panel";
import { useDashboard } from "../hooks/use-dashboard";
import { useDashboardActions } from "../hooks/use-dashboard-actions";
import { ActionDialog } from "./action-dialog";
import { OverviewPanel } from "./overview-panel";
import { DashboardSidebar } from "./sidebar";

import { UniformImageDialog } from "@/features/inventory/components/image-dialog";
import { InventoryImportDialog } from "@/features/inventory/components/import-dialog";
import { uniformGenderLabel } from "@/features/inventory/gender";
import { RequestEditDialog } from "@/features/requests/components/edit-dialog";
import { requestDay } from "@/features/requests/date";
import { StoreSelector } from "@/features/stores/components/store-selector";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  Building2,
  CheckCircle2,
  Plus,
  Sparkles
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { Modal, RequestLine, Tab, Variant } from "../types";

export function DashboardPage() {
  const [tab, setTab] = useState<Tab>("visao-geral");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<Modal>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editingRequestId, setEditingRequestId] = useState<string | null>(null);
  const [editingVariant, setEditingVariant] = useState<Variant | null>(null);
  const [imageVariant, setImageVariant] = useState<Variant | null>(null);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("TODAS");
  const [requestDate, setRequestDate] = useState("");
  const [requestLines, setRequestLines] = useState<RequestLine[]>([{ variantId: "", quantity: 1 }]);

  const { dashboard, account, availableStores, selectedStoreId, setSelectedStoreId, loading, needsSetup, showStoreOverview, loadError, loadDashboard } = useDashboard();

  function selectStore(storeId: string) {
    setImageVariant(null);
    setRequestDate("");
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

  const { saving, processingRequestId, handleSubmit, processRequest, logout } = useDashboardActions({ dashboard, selectedStoreId, modal, editingVariant, requestLines, setModal, setRequestLines, showNotice, loadDashboard });
  function openNewRequest() { setRequestLines([{ variantId: "", quantity: 1 }]); setModal("solicitacao"); }

  const title = showStoreOverview ? "Todas as lojas" : needsSetup ? "Configuração inicial" : tab === "visao-geral" ? "Visão geral" : tab === "estoque" ? "Estoque de uniformes" : "Solicitações";
  const subtitle = needsSetup
    ? "Cadastre os dados reais da sua unidade para iniciar o controle de uniformes."
    : tab === "visao-geral"
      ? "Acompanhe o que entra, sai e precisa de atenção."
      : tab === "estoque"
        ? "Consulte saldos e mantenha cada item em dia."
        : "Pedidos da equipe, do envio à aprovação.";
  const filteredVariants = dashboard?.variants.filter((variant) => {
    const searchMatch = `${variant.sector ?? "Geral"} ${variant.name} ${variant.sku} ${variant.size} ${variant.color} ${uniformGenderLabel(variant.gender)}`.toLowerCase().includes(search.toLowerCase());
    return searchMatch && (categoryFilter === "TODAS" || variant.category === categoryFilter);
  }) ?? [];
  const filteredRequests = dashboard?.requests.filter((request) => !requestDate || requestDay(request.createdAt) === requestDate) ?? [];
  const isMasterAdmin = account?.role === "MASTER_ADMIN";
  const accountLabel = isMasterAdmin ? "Administrador geral" : "Gestor da loja";
  const accountInitials = (account?.name ?? "?").split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

  return (
    <main className="app-shell">
      <DashboardSidebar account={account} dashboard={dashboard} availableStores={availableStores} selectedStoreId={selectedStoreId} loading={loading} tab={tab} setTab={setTab} selectStore={selectStore} logout={logout} />

      <section className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Operação</span><span className="crumb-divider">/</span><strong>{title}</strong></div>
          <div className="topbar-actions">
            {isMasterAdmin ? <div className="mobile-store-control"><StoreSelector value={selectedStoreId} stores={availableStores} onChange={selectStore} /></div> : null}
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
              {isMasterAdmin ? <button className="button button-primary" onClick={() => setModal("novo-item")}><Plus size={17} /> Cadastrar item</button> : null}
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

            {tab === "visao-geral" ? <OverviewPanel dashboard={dashboard} onStock={() => setTab("estoque")} onMovement={() => setModal("movimentacao")} onRequests={() => { setRequestDate(""); setTab("solicitacoes"); }} onNewRequest={openNewRequest} /> : null}
            {tab === "estoque" ? <InventoryPanel dashboard={dashboard} filteredVariants={filteredVariants} search={search} setSearch={setSearch} categoryFilter={categoryFilter} setCategoryFilter={setCategoryFilter} isMasterAdmin={isMasterAdmin} onImport={() => setImportOpen(true)} onMovement={() => setModal("movimentacao")} onNew={() => setModal("novo-item")} onEdit={(variant) => { setEditingVariant(variant); setModal("editar-estoque"); }} onImage={setImageVariant} onCatalogEdit={(variant) => { setEditingVariant(variant); setModal("editar-item"); }} onOptions={() => setOptionsOpen(true)} /> : null}
            {tab === "solicitacoes" ? <RequestHistoryPanel dashboard={dashboard} filteredRequests={filteredRequests} requestDate={requestDate} setRequestDate={setRequestDate} processingRequestId={processingRequestId} onEdit={setEditingRequestId} onNewRequest={openNewRequest} onProcess={processRequest} /> : null}
          </> : null}
          <footer className="page-footer"><span>Uniformes · Controle de estoque</span><span>Dados da loja <b>●</b> sincronizados</span></footer>
        </div>
      </section>

      {optionsOpen && isMasterAdmin ? <CatalogOptionsDialog onClose={() => setOptionsOpen(false)} onSaved={() => { setCategoryFilter("TODAS"); void loadDashboard(selectedStoreId); }} /> : null}
      <ActionDialog modal={modal} dashboard={dashboard} editingVariant={editingVariant} requestLines={requestLines} setRequestLines={setRequestLines} saving={saving} onClose={() => setModal(null)} onSubmit={handleSubmit} />
      {importOpen && dashboard ? <InventoryImportDialog key={dashboard.store.id} store={dashboard.store} onClose={() => setImportOpen(false)} onSuccess={(message) => { setImportOpen(false); showNotice(message); void loadDashboard(dashboard.store.id); }} /> : null}
      {imageVariant && dashboard && isMasterAdmin ? <UniformImageDialog key={imageVariant.id} variant={imageVariant} onClose={() => setImageVariant(null)} onSaved={(count) => { setImageVariant(null); showNotice(`Imagem salva em ${count} ${count === 1 ? "loja" : "lojas"}.`); void loadDashboard(dashboard.store.id); }} /> : null}
      {editingRequestId && dashboard ? <RequestEditDialog key={`${dashboard.store.id}:${editingRequestId}`} requestId={editingRequestId} variants={dashboard.variants} onClose={() => setEditingRequestId(null)} onSaved={() => { setEditingRequestId(null); showNotice("Solicitação ajustada. O pedido continua pendente de aprovação."); void loadDashboard(dashboard.store.id); }} /> : null}
      {notice ? <div className="toast" role="status"><CheckCircle2 size={17} />{notice}</div> : null}
    </main>
  );
}
