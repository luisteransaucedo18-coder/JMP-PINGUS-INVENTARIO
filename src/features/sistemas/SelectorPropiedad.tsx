import { useId, useRef, useState } from 'react';
import DetailIcon, { type DetailIconName } from './DetailIcon';

export type OpcionPropiedad<T extends string> = { value: T; label: string; group?: string; tone: string; icon: DetailIconName; shortcut?: string };
export default function SelectorPropiedad<T extends string>({ label, value, options, disabled, clearable, completeValue, onChange }: { label: string; value: T | null; options: OpcionPropiedad<T>[]; disabled: boolean; clearable?: boolean; completeValue?: T; onChange: (value: T | null) => void }) {
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const [query,setQuery] = useState('');
  const [open,setOpen] = useState(false);
  const [position,setPosition] = useState({ top: 0,left: 0,width: 280 });
  const selected = options.find(o=>o.value===value);
  const normalize = (s: string) => s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
  const filtered = options.filter(o=>normalize(o.label).includes(normalize(query)));
  const groups = [...new Set(filtered.map(o=>o.group ?? ''))];
  function select(next:T|null) { onChange(next); panel.current?.hidePopover(); }
  function focusOption() { panel.current?.querySelector<HTMLButtonElement>('[role=option]')?.focus(); }
  return <div className="sys-property-control">
    <button type="button" role="combobox" aria-haspopup="listbox" aria-label={label} aria-expanded={open} aria-controls={`${id}-options`} className="sys-property-trigger" disabled={disabled} popoverTarget={id} onClick={e=>{ const r=e.currentTarget.getBoundingClientRect(); const width=Math.min(280,window.innerWidth-24); setPosition({top:Math.max(8,Math.min(r.bottom+6,window.innerHeight-360)),left:Math.max(8,Math.min(r.left,window.innerWidth-width-12)),width}); setQuery(''); }}>
      {selected ? <span className={`sys-property-pill sys-tone-${selected.tone}`}><DetailIcon name={selected.icon} size={14}/>{selected.label}</span> : <span className="sys-property-unset"><DetailIcon name="flag" size={14}/>Sin prioridad</span>}<DetailIcon name="chevron" size={12}/>
    </button>
    {clearable && value !== null && <button type="button" className="sys-property-clear" disabled={disabled} aria-label={`Borrar ${label.toLocaleLowerCase()}`} title="Borrar" onClick={()=>onChange(null)}>×</button>}
    {completeValue && <button type="button" className="sys-state-complete" disabled={disabled || value===completeValue} aria-label="Marcar tarea como completada" title="Marcar como completada" onClick={()=>onChange(completeValue)}>✓</button>}
    <div id={id} ref={panel} popover="auto" className="sys-property-popover" style={position} onToggle={e=>{ const shown=e.currentTarget.matches(':popover-open'); setOpen(shown); if(shown) search.current?.focus(); }} onKeyDown={e=>{if(e.ctrlKey||e.metaKey){const option=options.find(o=>o.shortcut===`Ctrl ${e.key}`);if(option){e.preventDefault();select(option.value);}else if(clearable&&e.key==='0'){e.preventDefault();select(null);}}}}>
      <input ref={search} type="search" aria-label={`Buscar ${label.toLocaleLowerCase()}`} placeholder="Buscar…" value={query} onChange={e=>setQuery(e.target.value)} onKeyDown={e=>{if(e.key==='ArrowDown'){e.preventDefault();focusOption();}}}/>
      <div id={`${id}-options`} role="listbox" aria-label={`Opciones de ${label.toLocaleLowerCase()}`} onKeyDown={e=>{
        const buttons=Array.from(e.currentTarget.querySelectorAll<HTMLButtonElement>('[role=option]'));
        const index=buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next=e.key==='ArrowDown'?(index+1)%buttons.length:e.key==='ArrowUp'?(index+buttons.length-1)%buttons.length:e.key==='Home'?0:e.key==='End'?buttons.length-1:-1;
        if(next>=0){e.preventDefault();buttons[next]?.focus();}
      }}>
        {groups.map(group=><div role="group" aria-label={group || label} key={group}>{group && <p className="sys-property-group-title">{group}</p>}{filtered.filter(o=>(o.group ?? '')===group).map(o=><button type="button" role="option" key={o.value} aria-selected={o.value===value} className={`sys-property-option sys-tone-${o.tone}`} onClick={()=>select(o.value)}><DetailIcon name={o.icon} size={14}/><span>{o.label}</span>{o.value===value && <span className="sys-property-check" aria-hidden="true">✓</span>}{o.shortcut && <small aria-hidden="true">{o.shortcut}</small>}</button>)}</div>)}
        {!filtered.length && <p className="sys-property-no-results">Sin coincidencias.</p>}
        {clearable && <button type="button" role="option" aria-selected={value===null} className="sys-property-option" onClick={()=>select(null)}><span aria-hidden="true">⊘</span>Sin prioridad</button>}
      </div>
    </div>
  </div>;
}
