import { useRef, useState } from 'react';
import { PRIORIDADES, type Persona } from '../../services/sistemasService';
import type { PropiedadesSubtarea } from '../../services/sistemasSeguimientoService';
import DetailIcon from './DetailIcon';

export default function SubtareaEditor({ busy, personas, onAdd, onCancel, initialTitle = '' }: { busy: boolean; personas: Persona[]; onAdd: (titulo: string, propiedades: PropiedadesSubtarea) => Promise<boolean>; onCancel: () => void; initialTitle?: string }) {
  const [titulo, setTitulo] = useState(initialTitle);
  const [fecha, setFecha] = useState('');
  const [prioridad, setPrioridad] = useState<PropiedadesSubtarea['prioridad']>('Media');
  const [responsable, setResponsable] = useState('');
  const [sending, setSending] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  return <form className="sys-subtask-editor" onSubmit={async e => { e.preventDefault(); if (busy || sending || !titulo.trim()) return; setSending(true); try { await onAdd(titulo.trim(), { responsable: responsable || null, fecha_objetivo: fecha || null, prioridad }); } finally { setSending(false); } }}>
    <DetailIcon name="status" /><input ref={input} autoFocus aria-label="Nombre de la subtarea" placeholder="Escribe el nombre de la tarea…" value={titulo} onChange={e => setTitulo(e.target.value)} required maxLength={200} disabled={busy || sending} />
    <div className="sys-subtask-editor-actions"><label className={`sys-icon-picker${fecha ? ' has-value' : ''}`} title={fecha || 'Fecha objetivo'}><DetailIcon name="calendar" /><input aria-label="Fecha objetivo de la subtarea" type="date" value={fecha} disabled={busy} onChange={e => setFecha(e.target.value)} /></label>
      <label className={`sys-icon-picker sys-subtask-priority-${PRIORIDADES.indexOf(prioridad)}`} title={`Prioridad: ${prioridad}`}><DetailIcon name="flag" /><select aria-label="Prioridad de la subtarea" value={prioridad} disabled={busy} onChange={e => setPrioridad(e.target.value as PropiedadesSubtarea['prioridad'])}>{PRIORIDADES.map(p => <option key={p}>{p}</option>)}</select></label>
      <label className={`sys-icon-picker${responsable ? ' has-value' : ''}`} title={personas.find(p => p.id === responsable)?.nombre ?? 'Responsable'}><DetailIcon name="user" /><select aria-label="Responsable de la subtarea" value={responsable} disabled={busy} onChange={e => setResponsable(e.target.value)}><option value="">Sin asignar</option>{personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
      <button type="button" className="sys-subtask-cancel" aria-label="Cancelar subtarea" title="Cancelar" disabled={busy} onClick={onCancel}>×</button><button className="sys-subtask-send" aria-label="Añadir subtarea" title="Añadir subtarea" disabled={busy || sending || !titulo.trim()}><DetailIcon name="send" /></button></div>
    {(fecha || responsable || prioridad !== 'Media') && <small className="sys-subtask-draft-meta">{[fecha, prioridad, personas.find(p => p.id === responsable)?.nombre].filter(Boolean).join(' · ')}</small>}
  </form>;
}
