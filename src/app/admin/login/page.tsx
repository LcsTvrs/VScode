"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { ArrowLeft, ArrowRight, LockKeyhole, ShieldCheck } from "lucide-react";

export default function AdminLoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/acesso-admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
        cache: "no-store",
        redirect: "manual",
      });
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.toLowerCase().includes("application/json")) {
        const status = response.status || "redirecionamento";
        throw new Error(`A API de acesso administrativo retornou uma resposta inesperada (HTTP ${status}, ${contentType || "sem Content-Type"}). Verifique se o último deploy da Vercel inclui /api/auth/acesso-admin.`);
      }
      const data: { message?: string } = await response.json();
      if (!response.ok) throw new Error(data.message ?? "Não foi possível iniciar a sessão.");

      const next = new URLSearchParams(window.location.search).get("next");
      const destination = next?.startsWith("/") && !next.startsWith("//") ? next : "/";
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
          <span className="brand-mark">L<span>M</span></span>
          <span><strong>uniformes</strong><small>gestão de loja</small></span>
        </Link>
        <Link href="/solicitar" className="login-public-link"><ArrowLeft size={14} /> Solicitação de uniformes</Link>
      </header>
      <section className="admin-login-content">
        <div className="admin-login-emblem"><ShieldCheck size={23} /></div>
        <p className="eyebrow">ÁREA RESTRITA</p>
        <h1>Acesso administrativo</h1>
        <p className="admin-login-subtitle">Entre para gerenciar estoque e solicitações da loja.</p>
        <form className="admin-login-form" onSubmit={(event) => void handleSubmit(event)}>
          <label className="public-field"><span>Senha administrativa</span><div className="password-field"><LockKeyhole size={16} /><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Digite sua senha" required /></div></label>
          {error ? <p className="public-error" role="alert">{error}</p> : null}
          <button type="submit" className="public-primary-button" disabled={loading}>{loading ? "Verificando…" : "Entrar no painel"}<ArrowRight size={16} /></button>
        </form>
        <Link href="/solicitar" className="admin-login-back"><ArrowLeft size={14} /> Voltar à solicitação de uniformes</Link>
      </section>
    </main>
  );
}
