"use client";

import { Search, UsersRound, ShieldCheck, Building2 } from "lucide-react";
import { useState } from "react";
import { useUsers } from "../hooks/use-users";
import { TemporaryPasswordDialog } from "./temporary-password-dialog";
import { UsersForm } from "./users-form";
import { UsersTable } from "./users-table";

export function UsersPage() {
  const model = useUsers();
  const [search, setSearch] = useState("");
  const filteredUsers = model.users.filter(user => `${user.name ?? ""} ${user.login} ${user.store?.name ?? ""} ${user.role === "MASTER_ADMIN" ? "Administrador geral" : "Gestor da loja"}`.toLocaleLowerCase("pt-BR").includes(search.trim().toLocaleLowerCase("pt-BR")));
  return <main className="admin-management"><div className="admin-management-content">
    <header className="admin-management-heading"><p className="eyebrow">ADMINISTRAÇÃO CENTRAL</p><h1 className="text-2xl font-bold text-[var(--ink)]">Usuários</h1><p className="mt-2 text-sm text-[var(--muted)]">Consulte todos os acessos, perfis e lojas vinculadas. O administrador geral pode criar usuários e lojas.</p></header>

    <section className="admin-summary" aria-label="Resumo de usuários">
      <div><UsersRound size={21} /><span>Usuários cadastrados<strong>{model.loading ? "—" : model.users.length}</strong></span></div>
      <div><ShieldCheck size={21} /><span>Administradores gerais<strong>{model.loading ? "—" : model.users.filter(user => user.role === "MASTER_ADMIN").length}</strong></span></div>
      <div><Building2 size={21} /><span>Lojas disponíveis<strong>{model.loading ? "—" : model.stores.length}</strong></span></div>
    </section>
    <UsersForm model={model} />
    <div className="admin-list-search"><label className="search-field"><Search size={18} /><input aria-label="Buscar usuários" placeholder="Buscar por nome, login, perfil ou loja…" value={search} onChange={event => setSearch(event.target.value)} /></label>{search ? <button className="button button-secondary" onClick={() => setSearch("")}>Limpar busca</button> : null}<span role="status">{filteredUsers.length} de {model.users.length} usuários</span></div>
    <UsersTable users={filteredUsers} loading={model.loading} saving={model.saving} onEdit={model.editUser} onReset={model.resetPassword} onDelete={model.deleteUser} />
  </div>{model.temporaryCredential ? <TemporaryPasswordDialog login={model.temporaryCredential.login} password={model.temporaryCredential.password} onClose={model.closeCredential} /> : null}</main>;
}
