import { useEffect, useRef, type ReactNode, type RefObject } from 'react';

export default function MobileNavigation({ open, onClose, triggerRef, children }: {
  open: boolean; onClose: () => void; triggerRef: RefObject<HTMLButtonElement | null>; children: ReactNode;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (!open) return;
    const dialog = dialogRef.current!;
    const trigger = triggerRef.current;
    const bodyOverflow = document.body.style.overflow;
    const scroller = document.querySelector<HTMLElement>('.app-scroll');
    const scrollOverflow = scroller?.style.overflowY ?? '';
    dialog.showModal();
    dialog.focus();
    document.body.style.overflow = 'hidden';
    if (scroller) scroller.style.overflowY = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = bodyOverflow;
      if (scroller) scroller.style.overflowY = scrollOverflow;
      if (trigger?.isConnected && trigger.getClientRects().length) trigger.focus();
    };
  }, [open, triggerRef]);

  return <dialog ref={dialogRef} id="mobile-navigation" className="mobile-navigation" tabIndex={-1}
    aria-label="Menú principal" onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}
    onKeyDown={event => {
      if (event.key !== 'Tab') return;
      const controls = Array.from(event.currentTarget.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'));
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && (document.activeElement === first || document.activeElement === event.currentTarget)) {
        event.preventDefault(); last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault(); first?.focus();
      }
    }}>
    {children}
  </dialog>;
}
