import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

export default function DiscardChangesDialog({ onCancel, onDiscard }: { onCancel: () => void; onDiscard: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const title = useId();
  const description = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => { dialog?.close(); if (previous instanceof HTMLElement && previous.isConnected) previous.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className="discard-dialog" aria-labelledby={title} aria-describedby={description}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <button type="button" className="discard-dialog-close" aria-label="Cerrar y seguir editando" onClick={onCancel}>
      <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
    </button>
    <div className="discard-dialog-icon" aria-hidden="true">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" /><path d="M12 7v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="16.5" r="1" fill="currentColor" /></svg>
    </div>
    <h2 id={title}>¿Descartar los cambios?</h2>
    <p id={description}>Los datos sin guardar se perderán.</p>
    <div className="discard-dialog-actions">
      <button type="button" className="discard-dialog-keep" autoFocus onClick={onCancel}>Seguir editando</button>
      <button type="button" className="discard-dialog-confirm" onClick={onDiscard}>Descartar cambios</button>
    </div>
  </dialog>, document.body);
}
