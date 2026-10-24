"use client";

import { submitAuth } from "@/features/auth/client";
import { PasswordInput } from "@/features/auth/components/password-input";
import { PASSWORD_POLICY_MESSAGE, validNewPassword } from "@/features/auth/password-policy";
import { useId, useState, type FormEvent } from "react";

export function PasswordChangeForm({ onSuccess, onSavingChange }: { onSuccess: () => void; onSavingChange?: (saving: boolean) => void }) {
  const id = useId();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError("");
    if (!validNewPassword(password)) { setError(PASSWORD_POLICY_MESSAGE); return; }
    if (password !== confirmation) { setError("As senhas não coincidem."); return; }
    setSaving(true);
    onSavingChange?.(true);
    try {
      await submitAuth({ acao: "trocar-senha", novaSenha: password }, "Não foi possível confirmar a troca. Tente novamente com a mesma nova senha.");
      onSuccess();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível alterar a senha.");
    } finally {
      setSaving(false);
      onSavingChange?.(false);
    }
  }

  return <form className="admin-login-form" onSubmit={(event) => void submit(event)}>
    <label className="public-field" htmlFor={`${id}-new`}><span>Nova senha</span><PasswordInput id={`${id}-new`} visibilityLabel="nova senha" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={12} maxLength={128} disabled={saving} required /></label>
    <label className="public-field" htmlFor={`${id}-confirm`}><span>Confirmar nova senha</span><PasswordInput id={`${id}-confirm`} visibilityLabel="confirmação da senha" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} maxLength={128} disabled={saving} required /></label>
    {error ? <p className="public-error" role="alert">{error}</p> : null}
    <button type="submit" className="public-primary-button" disabled={saving}>{saving ? "Salvando…" : "Salvar nova senha"}</button>
  </form>;
}
