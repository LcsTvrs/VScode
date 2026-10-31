"use client";

import { useUsers } from "../hooks/use-users";
import { TemporaryPasswordDialog } from "./temporary-password-dialog";
import { UsersForm } from "./users-form";
import { UsersTable } from "./users-table";

export function UsersPage() {
  const model = useUsers();
  return <main className="min-h-[calc(100vh-58px)] bg-[var(--paper)] px-4 py-8 sm:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <header><p className="eyebrow">ADMINISTRAÇÃO CENTRAL</p><h1 className="text-2xl font-bold text-[var(--ink)]">Usuários</h1><p className="mt-2 text-sm text-[var(--muted)]">Consulte todos os acessos, perfis e lojas vinculadas. O administrador geral pode criar usuários e lojas.</p></header>

    <UsersForm model={model} />
    <UsersTable users={model.users} loading={model.loading} saving={model.saving} onEdit={model.editUser} onReset={model.resetPassword} onDelete={model.deleteUser} />
  </div>{model.temporaryCredential ? <TemporaryPasswordDialog login={model.temporaryCredential.login} password={model.temporaryCredential.password} onClose={model.closeCredential} /> : null}</main>;
}
