"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { PasswordChangeForm } from "@/components/password-change-form";

export function PasswordChangeDialog({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  return <dialog ref={dialog} className="modal request-edit-dialog" aria-labelledby="password-change-title" onCancel={(event) => { event.preventDefault(); if (!saving) onClose(); }}>
    <div className="modal-heading"><div><span className="section-kicker">SUA CONTA</span><h2 id="password-change-title">Alterar senha temporária</h2></div><button type="button" className="icon-button" aria-label="Fechar troca de senha" disabled={saving} onClick={onClose}><X size={18} /></button></div>
    <PasswordChangeForm onSuccess={onSuccess} onSavingChange={setSaving} />
  </dialog>;
}
