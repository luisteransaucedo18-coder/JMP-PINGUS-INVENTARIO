import { useEffect, useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export type AlertTone = 'info' | 'warning' | 'danger' | 'success';
export function AlertIcon({ tone = 'info' }: { tone?: AlertTone }) {
  return <div className="discard-dialog-icon system-alert-icon" data-tone={tone} aria-hidden="true">
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
      {tone === 'success' ? <path d="m7.5 12 3 3 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /> : <><path d="M12 7v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="16.5" r="1" fill="currentColor" /></>}
    </svg>
  </div>;
}
export default function SystemAlert({ title, children, tone = 'info', onClose, onConfirm, confirmLabel = 'Entendido', cancelLabel = 'Cancelar', busy = false }: {
  title: string; children: ReactNode; tone?: AlertTone; onClose: () => void; onConfirm?: () => void;
  confirmLabel?: string; cancelLabel?: string; busy?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className="discard-dialog system-alert" data-tone={tone} aria-labelledby={titleId} aria-describedby={bodyId}
    role={tone === 'danger' || tone === 'warning' ? 'alertdialog' : 'dialog'} aria-busy={busy}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <button type="button" className="discard-dialog-close" aria-label="Cerrar aviso" disabled={busy} onClick={onClose}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </button>
    <AlertIcon tone={tone} />
    <h2 id={titleId}>{title}</h2>
    <div id={bodyId} className="system-alert-body">{children}</div>
    <div className={`discard-dialog-actions${onConfirm ? '' : ' system-alert-single'}`}>
      {onConfirm && <button type="button" className="discard-dialog-keep" autoFocus disabled={busy} onClick={onClose}>{cancelLabel}</button>}
      <button type="button" className="discard-dialog-confirm" autoFocus={!onConfirm} disabled={busy} onClick={onConfirm || onClose}>{busy ? 'Procesando…' : confirmLabel}</button>
    </div>
  </dialog>, document.body);
}
