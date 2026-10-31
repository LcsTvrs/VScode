import type { UniformGenderValue } from "@/features/inventory/gender";
import type { RequestHistoryRow } from "@/features/requests/components/history-card";

export type Tab = "visao-geral" | "estoque" | "solicitacoes";
export type Modal = "editar-item" | "novo-item" | "movimentacao" | "editar-estoque" | "solicitacao" | null;

export type Variant = {
  id: string;
  storeId?: string;
  store?: { id: string; code: string; name: string };
  sku: string;
  catalogUpdatedAt?: string;
  name: string;
  sector: string;
  category: string;
  gender: UniformGenderValue | null;
  imageId: string | null;
  size: string;
  color: string;
  quantity: number;
  minimum: number;
  updatedAt: string;
};

export type RequestRow = RequestHistoryRow;

export type Dashboard = {
  historyMode?: "paged";
  employeesDeferred?: boolean;
  scope?: "all" | "store";
  role: "MASTER_ADMIN" | "STORE_ADMIN";
  account: Account;
  availableStores: { id: string; name: string; code: string }[];
  store: { id: string; name: string; code: string; city: string; state: string };
  employees: { storeId?: string; id: string; name: string; email: string | null; ldap: string | null }[];
  variants: Variant[];
  requests: RequestRow[];
  metrics: { totalUnits: number; lowStockCount: number; pendingCount: number; variantCount: number };
};

export type Account = { login: string; name: string; role: "MASTER_ADMIN" | "STORE_ADMIN" };

export type RequestLine = { variantId: string; quantity: number };

