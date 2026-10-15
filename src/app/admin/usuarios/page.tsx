"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";

type Store = { id: string; code: string; name: string };
type AdminUser = { id: string; login: string; role: "MASTER_ADMIN" | "STORE_ADMIN"; storeId: string | null; mustChangePassword: boolean; createdAt: string; store: { name: string; code: string } | null; isCurrentUser?: boolean };

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [login, setLogin] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("STORE_ADMIN");
  const [storeId, setStoreId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [ur, sr] = await Promise.all([fetch("/api/users", { cache: "no-store" }), fetch("/api/stores", { cache: "no-store" })]);
      const [ud, sd] = await Promise.all([ur.json(), sr.json()]);
      if (!ur.ok) throw new Error(ud.message ?? "Não foi possível carregar os utilizadores.");
      if (!sr.ok) throw new Error(sd.message ?? "Não foi possível carregar as lojas.");
      setUsers(ud.users ?? []); setStores(sd.stores ?? []);
      setStoreId((current) => current || sd.stores?.[0]?.id || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar os dados."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadData(); }, [loadData]);

  function clearForm() { setEditingId(null); setLogin(""); setRole("STORE_ADMIN"); setStoreId(stores[0]?.id ?? ""); }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(editingId ? `/api/users/${editingId}` : "/api/users", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, role, ...(role === "STORE_ADMIN" ? { storeId } : {}) }) });
      const data = await response.json();
      if (!response.ok || !data.user) throw new Error(data.message ?? "Não foi possível guardar o utilizador.");
      if (editingId) { setUsers((current) => current.map((item) => item.id === editingId ? data.user : item)); setNotice("Utilizador atualizado."); }
      else { setUsers((current) => [{ ...data.user, isCurrentUser: false }, ...current]); setNotice(`Utilizador ${data.user.login} criado. A senha temporária é mostrada apenas agora.`); window.alert(`Utilizador: ${data.user.login}\nSenha temporária: ${data.temporaryPassword}\n\nInforme-a por um canal seguro. Será obrigatória a troca no primeiro acesso.`); }
      clearForm();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível guardar o utilizador."); }
    finally { setSaving(false); }
  }

  async function deleteUser(user: AdminUser) {
    if (!window.confirm(`Excluir o utilizador ${user.login}?`)) return;
    setError("");
    try { const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" }); const data = response.status === 204 ? {} : await response.json(); if (!response.ok) throw new Error(data.message ?? "Não foi possível excluir."); setUsers((current) => current.filter((item) => item.id !== user.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir o utilizador."); }
  }

  async function resetPassword(user: AdminUser) {
    if (!window.confirm(`Gerar uma nova senha temporária para ${user.login}?`)) return;
    setError("");
    try { const response = await fetch(`/api/users/${user.id}/reset`, { method: "POST" }); const data = await response.json(); if (!response.ok) throw new Error(data.message ?? "Não foi possível resetar a senha."); window.alert(`Utilizador: ${user.login}\nNova senha temporária: ${data.temporaryPassword}\n\nInforme-a por um canal seguro. A troca será obrigatória no próximo acesso.`); if (data.selfReset) window.location.assign("/admin/trocar-senha"); else await loadData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível resetar a senha."); }
  }

  return <main className="min-h-[calc(100vh-58px)] bg-[var(--paper)] px-4 py-8 sm:px-8"><div className="mx-auto max-w-6xl space-y-6">
    <header><p className="eyebrow">ADMINISTRAÇÃO CENTRAL</p><h1 className="text-2xl font-bold text-[var(--ink)]">Utilizadores</h1><p className="mt-2 text-sm text-[var(--muted)]">Acessos individuais com permissões vinculadas ao perfil e à loja.</p></header>
    <section className="rounded-lg border border-[var(--line)] bg-white p-5 shadow-sm sm:p-6"><h2 className="text-base font-semibold text-[var(--ink)]">{editingId ? "Editar utilizador" : "Novo utilizador"}</h2>
      <form className="mt-4 grid gap-4 md:grid-cols-3" onSubmit={(event) => void saveUser(event)}>
        <label className="text-sm font-medium text-[var(--ink)]">Login<input className="mt-2 block min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={login} onChange={(event) => setLogin(event.target.value)} autoComplete="off" minLength={2} maxLength={254} required /></label>
        <label className="text-sm font-medium text-[var(--ink)]">Perfil<select className="mt-2 block min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value as AdminUser["role"])}><option value="STORE_ADMIN">STORE_ADMIN</option><option value="MASTER_ADMIN">MASTER_ADMIN</option></select></label>
        {role === "STORE_ADMIN" ? <label className="text-sm font-medium text-[var(--ink)]">Loja<select className="mt-2 block min-h-10 w-full rounded-md border border-[var(--line)] bg-white px-3 text-sm" value={storeId} onChange={(event) => setStoreId(event.target.value)} required><option value="" disabled>Selecione uma loja</option>{stores.map((store) => <option key={store.id} value={store.id}>{store.name} · {store.code}</option>)}</select></label> : <div className="flex items-end text-xs text-[var(--muted)]">Acesso central sem vínculo a uma loja específica.</div>}
        <div className="flex gap-2 md:col-span-3"><button className="button button-primary min-h-10" disabled={saving || (role === "STORE_ADMIN" && !stores.length)}>{saving ? "Salvando…" : editingId ? "Salvar alterações" : "Criar utilizador"}</button>{editingId ? <button type="button" className="button button-secondary min-h-10" onClick={clearForm}>Cancelar</button> : null}</div>
      </form>{notice ? <p className="mt-3 rounded-md bg-[var(--green-pale)] p-3 text-sm text-[var(--green-dark)]" role="status">{notice}</p> : null}{error ? <p className="mt-3 rounded-md bg-[var(--red-pale)] p-3 text-sm text-[var(--red)]" role="alert">{error}</p> : null}<p className="mt-3 text-xs text-[var(--muted)]">As senhas temporárias têm 10 caracteres e exigem troca no primeiro acesso.</p>
    </section>
    <section className="overflow-hidden rounded-lg border border-[var(--line)] bg-white shadow-sm"><div className="flex items-center justify-between border-b border-[var(--line)] px-5 py-4"><h2 className="text-base font-semibold text-[var(--ink)]">Acessos cadastrados</h2><span className="text-xs text-[var(--muted)]">{users.length} utilizador(es)</span></div>
      {loading ? <p className="p-6 text-sm text-[var(--muted)]">Carregando utilizadores…</p> : users.length ? <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-left text-sm"><thead className="bg-[#f8f9f6] text-xs uppercase text-[var(--muted)]"><tr>{["Login", "Perfil", "Loja", "Estado", "Criado em", "Ações"].map((label) => <th key={label} className="px-4 py-3 font-semibold">{label}</th>)}</tr></thead><tbody className="divide-y divide-[var(--line)]">{users.map((user) => <tr key={user.id} className="hover:bg-[#fbfcfa]"><td className="px-4 py-4 font-semibold text-[var(--ink)]">{user.login}{user.isCurrentUser ? " (você)" : ""}</td><td className="px-4 py-4">{user.role}</td><td className="px-4 py-4 text-[var(--muted)]">{user.store?.name ?? "Todas as lojas"}</td><td className="px-4 py-4 text-xs">{user.mustChangePassword ? "Troca de senha pendente" : "Ativo"}</td><td className="px-4 py-4 text-[var(--muted)]">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(user.createdAt))}</td><td className="px-4 py-4"><div className="flex gap-2"><button className="text-xs font-semibold text-[var(--blue)]" onClick={() => { setEditingId(user.id); setLogin(user.login); setRole(user.role); setStoreId(user.storeId ?? ""); setError(""); }}>Editar</button><button className="text-xs font-semibold text-[var(--amber)]" onClick={() => void resetPassword(user)}>Resetar senha</button><button className="text-xs font-semibold text-[var(--red)] disabled:opacity-40" disabled={user.isCurrentUser} title={user.isCurrentUser ? "Não pode excluir a própria conta" : undefined} onClick={() => void deleteUser(user)}>Excluir</button></div></td></tr>)}</tbody></table></div> : <p className="p-6 text-sm text-[var(--muted)]">Nenhum utilizador cadastrado.</p>}
    </section>
  </div></main>;
}
