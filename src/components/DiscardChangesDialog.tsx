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
  return createPortal(<dialog ref={ref} className="stock-state-dialog" aria-labelledby={title} aria-describedby={description}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <div style={{ padding: 24 }}>
      <h2 id={title}>¿Descartar los cambios?</h2>
      <p id={description}>Perderás los datos que todavía no guardaste.</p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 24 }}>
        <button type="button" className="btn btn-primary" autoFocus onClick={onCancel}>Seguir editando</button>
        <button type="button" className="btn btn-ghost" onClick={onDiscard}>Descartar cambios</button>
      </div>
    </div>
  </dialog>, document.body);
}
