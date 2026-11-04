import { useId, useRef, useState } from 'react';
import UserAvatar from '../../components/UserAvatar';
import type { Persona } from '../../services/sistemasService';
import DetailIcon from './DetailIcon';

export function AvataresAsignados({ ids, personas }: { ids: string[]; personas: Persona[] }) {
  return <span className="sys-assigned-stack" aria-label={ids.length ? `Asignados: ${ids.map(id => personas.find(p => p.id === id)?.nombre ?? 'Usuario').join(', ')}` : 'Sin asignar'}>{ids.length ? ids.map(id => { const p = personas.find(p => p.id === id); return <span className="sys-person-avatar" title={p?.nombre ?? 'Usuario'} key={id}><UserAvatar name={p?.nombre ?? 'Usuario'} src={p?.foto_url} /></span>; }) : <span className="sys-person-avatar" title="Sin asignar"><DetailIcon name="user" size={14} /></span>}</span>;
}
export default function AsignadosTarea({ ids, personas, disabled, onChange }: { ids: string[]; personas: Persona[]; disabled: boolean; onChange: (ids: string[]) => void }) {
  const popoverId = useId();
  const popover = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState({ top: 0, left: 0, width: 280 });
  const toggle = (id: string) => onChange(ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id]);
  const selected = ids.map(id => personas.find(p => p.id === id) ?? { id, nombre: 'Usuario' });
  const matches = personas.filter(p => `${p.nombre} ${p.email ?? ''}`.toLocaleLowerCase().includes(query.toLocaleLowerCase()));
  function avatar(p: Persona) { return <span className="sys-avatar-removable"><span className="sys-person-avatar"><UserAvatar name={p.nombre} src={p.foto_url} /></span><button type="button" className="sys-assignment-remove" title={`Quitar a ${p.nombre}`} aria-label={`Quitar asignación de ${p.nombre}`} disabled={disabled} onClick={() => toggle(p.id)}>×</button></span>; }
  return <div className="sys-assignment-control"><div className="sys-assigned-stack">{selected.map(p => <span key={p.id} title={p.nombre}>{avatar(p)}</span>)}</div>
    <button type="button" className="sys-assignment-trigger" disabled={disabled} popoverTarget={popoverId} aria-label="Asignar personas a la tarea" onClick={e => { const r = e.currentTarget.parentElement!.getBoundingClientRect(); const width = Math.min(320,window.innerWidth-32); setPosition({ top: Math.min(r.bottom+8,window.innerHeight-340), left: Math.max(8,Math.min(r.left,window.innerWidth-width-16)), width }); setQuery(''); }}><span>{ids.length ? `${ids.length} ${ids.length === 1 ? 'persona' : 'personas'}` : 'Sin asignar'}</span><DetailIcon name="chevron" size={14} /></button>
    <div ref={popover} popover="auto" id={popoverId} className="sys-assignment-popover" style={{...position}} role="group" aria-label="Personas de la tarea">
      <label className="sys-assignment-search"><DetailIcon name="user" /><input aria-label="Buscar personas por nombre o correo" placeholder="Busca por nombre o correo…" value={query} onChange={e => setQuery(e.target.value)} /></label>
      {!!selected.length && <><h4>Asignados</h4>{selected.map(p => <div className="sys-person-selected" key={p.id}>{avatar(p)}<span>{p.nombre}</span><span aria-hidden="true">✓</span></div>)}</>}
      <h4>Personas</h4><div className="sys-person-results">{matches.map(p => <button type="button" key={p.id} disabled={disabled} aria-pressed={ids.includes(p.id)} className="sys-person-option" onClick={() => toggle(p.id)}><span className="sys-person-avatar"><UserAvatar name={p.nombre} src={p.foto_url} /></span><span><strong>{p.nombre}</strong>{p.email && <small>{p.email}</small>}</span>{ids.includes(p.id) && <span aria-hidden="true">✓</span>}</button>)}{!matches.length && <p>No se encontraron personas.</p>}</div>
      <button type="button" className="sys-assignment-done" onClick={() => popover.current?.hidePopover()}>Listo</button>
    </div>
  </div>;
}
