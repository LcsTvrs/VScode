"use client";

import Link from "next/link";
import Image from "next/image";
import { FormEvent, useState } from "react";
import { safeLocalRedirect } from "@/lib/safe-redirect";
import { submitAuth } from "@/lib/auth-client";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { PasswordInput } from "@/components/password-input";

export default function AdminLoginPage() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await submitAuth({ login, senha: password }, "Não foi possível iniciar a sessão. Tente novamente em instantes.");

      const next = new URLSearchParams(window.location.search).get("next");
      const destination = safeLocalRedirect(next, window.location.origin);
      window.location.assign(destination);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível iniciar a sessão.");
      setLoading(false);
    }
  }

  return (
    <main className="admin-login-shell">
      <header className="admin-login-header">
        <Link href="/solicitar" className="request-brand">
          <Image className="brand-logo" src="/leroy-merlin.svg" alt="Leroy Merlin" width={56} height={34} />
          <span><strong>Gestão Uniformes</strong></span>
        </Link>
        <Link href="/solicitar" className="login-public-link"><ArrowLeft size={14} /> Solicitação de uniformes</Link>
      </header>
      <section className="admin-login-content">
        <div className="admin-login-emblem"><ShieldCheck size={23} /></div>
        <p className="eyebrow">ÁREA RESTRITA</p>
        <h1>Acesso administrativo</h1>
        <p className="admin-login-subtitle">Entre para gerenciar estoque e solicitações da loja.</p>
        <form className="admin-login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="public-field"><span>Login</span><input autoComplete="username" value={login} onChange={(event) => setLogin(event.target.value)} placeholder="Matrícula ou e-mail" required maxLength={254} /></label>
          <label className="public-field" htmlFor="login-password"><span>Senha</span><PasswordInput id="login-password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" required /></label>
          {error ? <p className="public-error" role="alert">{error}</p> : null}
          <button type="submit" className="public-primary-button" disabled={loading}>{loading ? "Verificando…" : "Entrar no painel"}<ArrowRight size={16} /></button>
        </form>
        <Link href="/solicitar" className="admin-login-back"><ArrowLeft size={14} /> Voltar à solicitação de uniformes</Link>
      </section>
    </main>
  );
}
