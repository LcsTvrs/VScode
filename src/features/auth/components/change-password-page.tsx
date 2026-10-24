"use client";

import { PasswordChangeForm } from "@/features/auth/components/password-change-form";
import { ShieldCheck } from "lucide-react";

export default function ChangePasswordPage() {
  return (
    <main className="admin-login-shell">
      <section className="admin-login-content">
        <div className="admin-login-emblem"><ShieldCheck size={23} /></div>
        <p className="eyebrow">TROCA DE SENHA</p>
        <h1>Crie sua nova senha</h1>
        <p className="admin-login-subtitle">Troque sua senha temporária para acessar o painel. Defina uma senha pessoal com pelo menos 12 caracteres.</p>
        <PasswordChangeForm onSuccess={() => window.location.assign("/")} />
      </section>
    </main>
  );
}
