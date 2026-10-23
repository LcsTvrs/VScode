"use client";

import { FormEvent, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { PasswordInput } from "@/components/password-input";
import { readApiResponse } from "@/lib/api-response";
import { validNewPassword, PASSWORD_POLICY_MESSAGE } from "@/lib/password-policy";

export default function ChangePasswordPage() {
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!validNewPassword(newPassword)) { setError(PASSWORD_POLICY_MESSAGE); return; }
    if (newPassword !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ novaSenha: newPassword }),
        cache: "no-store",
      });
      await readApiResponse(response, "Não foi possível confirmar a troca. Tente novamente com a mesma nova senha. Não é necessário solicitar outro reset.");
      window.location.assign("/");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível alterar a senha.");
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-shell">
      <section className="admin-login-content">
        <div className="admin-login-emblem"><ShieldCheck size={23} /></div>
        <p className="eyebrow">PRIMEIRO ACESSO</p>
        <h1>Crie sua nova senha</h1>
        <p className="admin-login-subtitle">Para continuar, defina uma senha pessoal com pelo menos 12 caracteres.</p>
        <form className="admin-login-form" onSubmit={(event) => void submit(event)}>
          <label className="public-field" htmlFor="new-password"><span>Nova senha</span><PasswordInput id="new-password" visibilityLabel="nova senha" autoComplete="new-password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={12} maxLength={128} required /></label>
          <label className="public-field" htmlFor="confirm-password"><span>Confirmar nova senha</span><PasswordInput id="confirm-password" visibilityLabel="confirmação da senha" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} minLength={12} maxLength={128} required /></label>
          {error ? <p className="public-error" role="alert">{error}</p> : null}
          <button type="submit" className="public-primary-button" disabled={loading}>{loading ? "Salvando…" : "Salvar nova senha"}</button>
        </form>
      </section>
    </main>
  );
}
