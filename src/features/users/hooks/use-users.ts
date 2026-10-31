"use client";

import { readApiResponse } from "@/lib/api-response";
import { useRouter } from "next/navigation";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import type { AdminUser, Store } from "../types";

export function useUsers() {
  const router = useRouter();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [login, setLogin] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<AdminUser["role"]>("STORE_ADMIN");
  const [storeId, setStoreId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const busy = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [temporaryCredential, setTemporaryCredential] = useState<{ login: string; password: string; selfReset?: boolean } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [ur, sr] = await Promise.all([fetch("/api/users", { cache: "no-store" }), fetch("/api/stores", { cache: "no-store" })]);
      const [ud, sd] = await Promise.all([
        readApiResponse<{ users: AdminUser[] }>(ur, "Não foi possível carregar os utilizadores."),
        readApiResponse<{ stores: Store[] }>(sr, "Não foi possível carregar as lojas."),
      ]);
      setUsers(ud.users ?? []); setStores(sd.stores ?? []);
      setStoreId((current) => current || sd.stores?.[0]?.id || "");
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível carregar os dados."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void loadData(); }, [loadData]);

  function clearForm() { setEditingId(null); setLogin(""); setName(""); setRole("STORE_ADMIN"); setStoreId(stores[0]?.id ?? ""); }

  async function saveUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy.current) return; busy.current = true; setSaving(true); setError(""); setNotice("");
    try {
      const response = await fetch(editingId ? `/api/users/${editingId}` : "/api/users", { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ login, name, role, ...(role === "STORE_ADMIN" ? { storeId } : {}) }) });
      const data = await readApiResponse<{ user: AdminUser; temporaryPassword: string }>(response, "Não foi possível guardar o utilizador.");
      if (!data.user) throw new Error("Não foi possível guardar o utilizador.");
      if (editingId) { setUsers((current) => current.map((item) => item.id === editingId ? data.user : item)); setNotice("Utilizador atualizado."); if (data.user.isCurrentUser) router.refresh(); }
      else { setUsers((current) => [{ ...data.user, isCurrentUser: false }, ...current]); setNotice(`Utilizador ${data.user.login} criado. A senha temporária é mostrada apenas agora.`); setTemporaryCredential({ login: data.user.login, password: data.temporaryPassword }); }
      clearForm();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível guardar o utilizador."); }
    finally { busy.current = false; setSaving(false); }
  }

  async function deleteUser(user: AdminUser) {
    if (busy.current) return;
    if (!window.confirm(`Excluir o utilizador ${user.login}?`)) return;
    busy.current = true; setSaving(true); setError("");
    try { const response = await fetch(`/api/users/${user.id}`, { method: "DELETE" }); await readApiResponse<void>(response, "Não foi possível excluir."); setUsers((current) => current.filter((item) => item.id !== user.id)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível excluir o utilizador."); }
    finally { busy.current = false; setSaving(false); }
  }

  async function resetPassword(user: AdminUser) {
    if (busy.current) return;
    if (!window.confirm(`Gerar uma nova senha temporária para ${user.login}?`)) return;
    busy.current = true; setSaving(true); setError("");
    try { const response = await fetch(`/api/users/${user.id}/reset`, { method: "POST" }); const data = await readApiResponse<{ temporaryPassword: string; selfReset: boolean }>(response, "Não foi possível resetar a senha."); setTemporaryCredential({ login: user.login, password: data.temporaryPassword, selfReset: data.selfReset }); if (!data.selfReset) await loadData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Não foi possível resetar a senha."); }
    finally { busy.current = false; setSaving(false); }
  }


  function editUser(user: AdminUser) { setEditingId(user.id); setLogin(user.login); setName(user.name ?? ""); setRole(user.role); setStoreId(user.storeId ?? ""); setError(""); }
  function closeCredential() { const selfReset = temporaryCredential?.selfReset; setTemporaryCredential(null); if (selfReset) window.location.assign("/admin/trocar-senha"); }
  return { users, stores, login, setLogin, name, setName, role, setRole, storeId, setStoreId, editingId, loading, saving, error, notice, temporaryCredential, saveUser, deleteUser, resetPassword, clearForm, editUser, closeCredential };
}
