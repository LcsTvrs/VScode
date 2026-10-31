"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Native modality supplies Tab containment and makes the background inert. */
export function OperationDialog({ children, labelledBy, className = "", busy = false, onClose }: {
  children: ReactNode; labelledBy: string; className?: string; busy?: boolean; onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const dirty = useRef(false);
  const continueButton = useRef<HTMLButtonElement>(null);
  const [confirmClose, setConfirmClose] = useState(false);
  useEffect(() => { if (confirmClose) continueButton.current?.focus(); }, [confirmClose]);
  useEffect(() => {
    const element = dialog.current;
    const opener = document.activeElement as HTMLElement | null;
    element?.showModal();
    element?.querySelector<HTMLElement>("input:not([type=hidden]):not(:disabled), select:not(:disabled), textarea:not(:disabled)")?.focus();
    return () => { element?.close(); if (opener?.isConnected) opener.focus(); };
  }, []);
  return <dialog ref={dialog} tabIndex={-1} className={`modal operation-dialog ${className}`} aria-labelledby={labelledBy} aria-busy={busy}
    onKeyDown={event => {
      if (event.key !== "Tab") return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled):not([type="hidden"]), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
      const first = controls[0], last = controls.at(-1);
      if (!first) { event.preventDefault(); event.currentTarget.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}
    onChangeCapture={() => { dirty.current = true; }}
    onCancel={event => { event.preventDefault(); if (busy) return; if (dirty.current) setConfirmClose(true); else onClose(); }}>
    {children}
    {confirmClose ? <div className="dialog-close-confirmation" role="alert"><p>Fechar e descartar o preenchimento desta janela?</p><div className="modal-actions"><button ref={continueButton} className="button button-secondary" onClick={() => setConfirmClose(false)} disabled={busy}>Continuar preenchendo</button><button className="button button-secondary" onClick={onClose} disabled={busy}>Descartar e fechar</button></div></div> : null}
  </dialog>;
}
