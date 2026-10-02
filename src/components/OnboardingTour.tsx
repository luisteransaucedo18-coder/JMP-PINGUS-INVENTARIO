import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Role } from '../domain/types';
import { buildTourSteps, saveTourStatus } from '../app/onboarding';

type Bounds = { x: number; y: number; width: number; height: number };

export default function OnboardingTour({ role, userId, navigate, onClose, onStorageError }: {
  role: Role; userId: string; navigate: (view: string) => void;
  onClose: () => void; onStorageError: () => void;
}) {
  const steps = useMemo(() => buildTourSteps(role), [role]);
  const [index, setIndex] = useState(0);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [bounds, setBounds] = useState<Bounds | null>(null);
  const [position, setPosition] = useState({ x: 16, y: 16 });
  const dialog = useRef<HTMLDialogElement>(null);
  const card = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const step = steps[index];
  const last = index === steps.length - 1;

  const finish = (skipped: boolean) => {
    if (!saveTourStatus(userId, skipped ? 'skipped' : 'completed')) onStorageError();
    navigate('dashboard');
    onClose();
  };

  useEffect(() => {
    const element = dialog.current!;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    element.showModal();
    heading.current?.focus();
    return () => {
      element.close();
      if (previous?.isConnected && previous.getClientRects().length) previous.focus();
      else Array.from(document.querySelectorAll<HTMLElement>('.mobile-menu-trigger, .sidebar-link'))
        .find(control => control.getClientRects().length)?.focus();
    };
  }, []);

  useEffect(() => {
    setReady(false);
    setTimedOut(false);
    setBounds(null);
    navigate(step.view);
    heading.current?.focus();
    let frame = 0;
    let target: HTMLElement | null = null;
    let scrolled = false;
    const timeout = window.setTimeout(() => setTimedOut(true), 8000);
    const measure = () => {
      const root = document.querySelector<HTMLElement>(`[data-tour-view="${step.view}"]`);
      if (!root || root.querySelector('[aria-busy="true"]')) return;
      const selector = step.target === 'navigation'
        ? (window.matchMedia('(max-width: 768px)').matches ? '.mobile-menu-trigger' : '.desktop-sidebar .sidebar-nav')
        : step.target;
      target = selector ? document.querySelector<HTMLElement>(selector) : null;
      if (selector && (!target || !target.getClientRects().length)) return;
      if (target && !scrolled) { target.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'instant' }); scrolled = true; }
      const rect = target?.getBoundingClientRect();
      const width = window.innerWidth;
      const height = window.innerHeight;
      if (rect) {
        const x = Math.max(8, rect.left - 6);
        const y = Math.max(8, rect.top - 6);
        setBounds({ x, y, width: Math.max(0, Math.min(width - 8, rect.right + 6) - x), height: Math.max(0, Math.min(height - 8, rect.bottom + 6) - y) });
      } else setBounds(null);
      setReady(true);
      setTimedOut(false);
      clearTimeout(timeout);
    };
    const schedule = () => { cancelAnimationFrame(frame); frame = requestAnimationFrame(measure); };
    const root = document.querySelector('.app-main');
    const observer = new MutationObserver(schedule);
    if (root) observer.observe(root, { childList: true, subtree: true, attributes: true });
    const resize = new ResizeObserver(schedule);
    if (root) resize.observe(root);
    window.addEventListener('resize', schedule);
    window.addEventListener('scroll', schedule, true);
    schedule();
    return () => {
      cancelAnimationFrame(frame); clearTimeout(timeout); observer.disconnect(); resize.disconnect();
      window.removeEventListener('resize', schedule); window.removeEventListener('scroll', schedule, true);
    };
  }, [step, navigate, attempt]);

  useLayoutEffect(() => {
    if (!card.current) return;
    const { width, height } = card.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = (vw - width) / 2;
    let y = (vh - height) / 2;
    if (bounds && ready) {
      if (vw > 768 && bounds.x + bounds.width + width + 28 < vw) {
        x = bounds.x + bounds.width + 16; y = bounds.y;
      } else if (vw > 768 && bounds.x - width - 16 > 8) {
        x = bounds.x - width - 16; y = bounds.y;
      } else if (bounds.y + bounds.height + height + 28 < vh) {
        y = bounds.y + bounds.height + 16;
      } else if (bounds.y - height - 16 > 8) {
        y = bounds.y - height - 16;
      } else { x = vw > 768 ? vw - width - 20 : (vw - width) / 2; y = vh - height - 16; }
    }
    setPosition({ x: Math.max(8, Math.min(x, vw - width - 8)), y: Math.max(8, Math.min(y, vh - height - 8)) });
  }, [bounds, ready, step, timedOut]);

  return createPortal(<dialog ref={dialog} className="onboarding-dialog" aria-labelledby="tour-heading" aria-describedby="tour-description"
    onCancel={event => { event.preventDefault(); finish(true); }}
    onKeyDown={event => {
      if (event.key === 'ArrowRight' && ready && !last) { event.preventDefault(); setIndex(i => i + 1); }
      if (event.key === 'ArrowLeft' && index > 0) { event.preventDefault(); setIndex(i => i - 1); }
    }}>
    {bounds && ready ? <div className="onboarding-spotlight" aria-hidden="true" style={{ left: bounds.x, top: bounds.y, width: bounds.width, height: bounds.height }} />
      : <div className="onboarding-shade" aria-hidden="true" />}
    <section ref={card} className="onboarding-card" style={{ left: position.x, top: position.y }}>
      <div className="onboarding-topline"><span>RECORRIDO JIP</span><button type="button" className="onboarding-skip" onClick={() => finish(true)}>Omitir tutorial</button></div>
      <p className="onboarding-step" aria-live="polite">Paso {index + 1} de {steps.length}</p>
      <div className="onboarding-progress" role="progressbar" aria-label="Progreso del tutorial" aria-valuenow={index + 1} aria-valuemin={0} aria-valuemax={steps.length}><span style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
      <h2 id="tour-heading" ref={heading} tabIndex={-1}>{step.title}</h2>
      <p id="tour-description">{ready ? step.description : timedOut ? 'No pudimos ubicar esta sección. Puedes reintentar la carga o volver al paso anterior.' : 'Preparando la sección del recorrido…'}</p>
      <div className="onboarding-actions">
        <button type="button" className="btn btn-ghost" disabled={index === 0} onClick={() => setIndex(i => i - 1)}>Anterior</button>
        {!ready && timedOut ? <button type="button" className="btn btn-primary" onClick={() => setAttempt(i => i + 1)}>Reintentar</button>
          : <button type="button" className="btn btn-primary" disabled={!ready} onClick={() => last ? finish(false) : setIndex(i => i + 1)}>{last ? 'Comenzar a usar el sistema' : 'Siguiente'}</button>}
      </div>
      <p className="onboarding-keyboard">Usa Tab para elegir un botón, Enter para activarlo o las flechas para cambiar de paso. Escape omite el tutorial.</p>
    </section>
  </dialog>, document.body);
}
