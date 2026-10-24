"use client";

import { X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export function TemporaryPasswordDialog({ login, password, onClose }: { login: string; password: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const passwordInput = useRef<HTMLInputElement>(null);
  const [copyStatus, setCopyStatus] = useState("");
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(password);
      setCopyStatus("Senha copiada.");
    } catch {
      passwordInput.current?.focus();
      passwordInput.current?.select();
      setCopyStatus("Não foi possível copiar automaticamente. A senha está selecionada: use Ctrl+C ou a opção Copiar do dispositivo.");
    }
  }

  return <dialog ref={dialog} className="modal request-edit-dialog" aria-labelledby="temporary-password-title" aria-describedby="temporary-password-help" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="modal-heading"><div><span className="section-kicker">ACESSO DO USUÁRIO</span><h2 id="temporary-password-title">Senha temporária</h2></div><button type="button" className="icon-button" aria-label="Fechar senha temporária" onClick={onClose}><X size={18} /></button></div>
    <div className="space-y-4 p-5">
      <p className="text-sm">Login: <strong className="break-all select-text">{login}</strong></p>
      <label className="flex min-w-0 flex-col gap-2 text-sm font-medium"><span>Senha temporária</span><input ref={passwordInput} type="text" value={password} readOnly autoComplete="off" spellCheck={false} className="w-full min-w-0 rounded-md border border-[var(--line)] p-3 font-mono text-lg select-text" /></label>
      <p id="temporary-password-help" className="text-sm text-[var(--muted)]">Copie a senha antes de fechar esta janela. Ela não poderá ser consultada novamente. Informe-a por um canal seguro. O usuário deverá trocá-la no próximo login, antes de acessar o painel.</p>
      <p role="status" className="text-sm text-[var(--green-dark)]">{copyStatus}</p>
      <div className="modal-actions flex-wrap"><button type="button" className="button button-secondary" onClick={onClose}>Fechar</button><button type="button" className="button button-primary" onClick={() => void copyPassword()}>Copiar senha</button></div>
    </div>
  </dialog>;
}
