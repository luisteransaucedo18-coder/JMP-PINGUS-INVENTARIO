import { useLayoutEffect, useRef, useState } from 'react';
import AutoSizeTextarea from './AutoSizeTextarea';
import DetailIcon from './DetailIcon';

export default function ContextoTarea({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const preview = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (editing || !preview.current) return;
    const element = preview.current;
    const measure = () => setOverflows(element.scrollHeight > parseFloat(getComputedStyle(element).lineHeight) * 3 + 2);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [value, editing, expanded]);
  return <section className="sys-detail-context" aria-labelledby="sys-context-title">
    <div className="sys-context-heading"><h3 id="sys-context-title"><DetailIcon name="context" /> Contexto</h3>{!!value.trim() && !editing && <button type="button" disabled={disabled} onClick={() => setEditing(true)}>Editar contexto</button>}</div>
    <div id="sys-context-content">
      {editing ? <><AutoSizeTextarea aria-label="Notas" maxLength={10000} maxAutoHeight={360} placeholder="Describe el objetivo, los acuerdos o los pasos necesarios…" value={value} onChange={e => onChange(e.target.value)} disabled={disabled} /><button type="button" className="sys-context-finish" disabled={disabled} onClick={() => setEditing(false)}>Terminar edición</button></>
        : <><div ref={preview} className={`sys-context-preview${expanded ? ' is-expanded' : overflows ? ' is-truncated' : ''}`}>{value.trim() ? value : <span className="sys-context-placeholder">Añade el objetivo, los acuerdos o los pasos necesarios.</span>}</div>
          {!value.trim() && <button type="button" className="sys-context-finish" disabled={disabled} onClick={() => setEditing(true)}>Agregar contexto</button>}
          {overflows && <div className="sys-context-fold"><button type="button" className="sys-context-expand" aria-expanded={expanded} aria-controls="sys-context-content" disabled={disabled} onClick={() => setExpanded(v => !v)}><DetailIcon name="chevron" size={12} />{expanded ? 'Contraer' : 'Expandir'}</button></div>}
        </>}
    </div>
  </section>;
}
