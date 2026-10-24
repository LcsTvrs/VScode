import type { AdminUser } from "./types";

export function roleLabel(role: AdminUser["role"]) {
  return role === "MASTER_ADMIN" ? "Administrador geral" : "Gestor da loja";
}

export function accessLabel(user: AdminUser) {
  return user.role === "MASTER_ADMIN"
    ? "Todas as lojas, estoque, solicitações e gestão de usuários"
    : `Estoque e solicitações de ${user.store?.name ?? "loja não vinculada"}`;
}

