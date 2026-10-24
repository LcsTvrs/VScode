import { StoreSelector } from "@/features/stores/components/store-selector";
import { Activity, Boxes, Building2, ClipboardList, LogOut, UsersRound } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import type { Account, Dashboard, Tab } from "../types";

type Props = { account: Account | null; dashboard: Dashboard | null; availableStores: Dashboard["availableStores"]; selectedStoreId: string; loading: boolean; tab: Tab; setTab: (tab: Tab) => void; selectStore: (id: string) => void; logout: () => Promise<void> };

export function DashboardSidebar({ account, dashboard, availableStores, selectedStoreId, loading, tab, setTab, selectStore, logout }: Props) {
  const isMasterAdmin = account?.role === "MASTER_ADMIN";
  const accountLabel = isMasterAdmin ? "Administrador geral" : "Gestor da loja";
  const accountInitials = (account?.name ?? "?").split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase();
  return <aside className="sidebar">
        <div className="brand-lockup">
          <Image className="brand-logo" src="/leroy-merlin.svg" alt="Leroy Merlin" width={56} height={34} />
          <div className="brand-copy"><strong>Gestão Uniformes</strong></div>
        </div>
        <div className="store-switcher">
          <span className="store-indicator" />
          <div><small>{isMasterAdmin ? "VISUALIZAR LOJA" : "LOJA ATIVA"}</small>{isMasterAdmin
            ? <StoreSelector value={selectedStoreId} stores={availableStores} onChange={selectStore} />
            : <strong>{dashboard?.store.name ?? (loading ? "Carregando..." : "Nenhuma loja")}</strong>}</div>
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
      </aside>;
}
