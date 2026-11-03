import { useId, useRef, useState } from 'react';

export default function MenuTarea({ titulo, disabled, onOpen, onDelete }: { titulo: string; disabled?: boolean; onOpen?: () => void; onDelete: () => void }) {
  const id = useId();
  const popover = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const close = () => popover.current?.hidePopover();
  return <span className="sys-task-menu">
    <button type="button" className="sys-menu-trigger" aria-label={`Opciones de tarea ${titulo}`} title="Opciones de tarea" disabled={disabled} popoverTarget={id} onClick={e => {
      const rect = e.currentTarget.getBoundingClientRect();
      setPosition({ top: Math.min(rect.bottom + 4, window.innerHeight - 100), left: Math.max(8, Math.min(rect.right - 180, window.innerWidth - 188)) });
    }}>···</button>
    <div id={id} ref={popover} popover="auto" className="sys-task-menu-items" style={{ top: position.top, left: position.left }} role="group" aria-label={`Acciones de ${titulo}`}>
      {onOpen && <button type="button" disabled={disabled} onClick={() => { close(); onOpen(); }}>Abrir tarea</button>}
      <button type="button" className="sys-danger" disabled={disabled} onClick={() => { close(); onDelete(); }}>Eliminar tarea</button>
    </div>
  </span>;
}
