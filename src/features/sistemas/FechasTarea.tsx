import { useId, useRef, useState } from 'react';
import { limaDate } from '../../utils/limaDate';
import DetailIcon from './DetailIcon';

const date = (iso: string) => new Date(`${iso}T12:00:00Z`);
const iso = (value: Date) => value.toISOString().slice(0,10);
const addDays = (value: string,days: number) => { const d=date(value);d.setUTCDate(d.getUTCDate()+days);return iso(d); };
const monthStart = (value: string) => {const d=date(value);d.setUTCDate(1);return iso(d);};
const short = (value: string) => `${Number(value.slice(8,10))}/${Number(value.slice(5,7))}`;
export function rangoFechasInvalido(inicio: string|null|undefined,fin: string|null|undefined) { return Boolean(inicio && fin && inicio>fin); }

export default function FechasTarea({ inicio,fin,closed,disabled,onChange }: { inicio:string|null;fin:string|null;closed:boolean;disabled:boolean;onChange:(inicio:string|null,fin:string|null)=>void }) {
  const id=useId();const panel=useRef<HTMLDivElement>(null);
  const today=limaDate();
  const [target,setTarget]=useState<'inicio'|'fin'>('fin');
  const [month,setMonth]=useState(()=>monthStart(fin||inicio||today));
  const [focusDate,setFocusDate]=useState(fin||inicio||today);
  const [position,setPosition]=useState({top:0,left:0,width:360});
  const [open,setOpen]=useState(false);
  const first=date(month);const offset=(first.getUTCDay()+6)%7;
  const cells=Array.from({length:42},(_,i)=>addDays(month,i-offset));
  const invalid=rangoFechasInvalido(inicio,fin);
  function choose(value:string) {if(target==='inicio'){onChange(value,fin);setTarget('fin');}else onChange(inicio,value);setFocusDate(value);}
  function moveMonth(delta:number){const d=date(month);d.setUTCMonth(d.getUTCMonth()+delta);setMonth(iso(d));setFocusDate(iso(d));}
  return <div className="sys-dates-control"><button type="button" className="sys-dates-trigger" aria-label="Elegir fechas de la tarea" aria-expanded={open} aria-controls={id} popoverTarget={id} disabled={disabled} onClick={e=>{const r=e.currentTarget.getBoundingClientRect();const width=Math.min(380,window.innerWidth-24);setPosition({top:Math.max(8,Math.min(r.bottom+6,window.innerHeight-440)),left:Math.max(8,Math.min(r.left,window.innerWidth-width-12)),width});setMonth(monthStart(fin||inicio||today));setFocusDate(fin||inicio||today);}}><span><DetailIcon name="calendar" size={14}/>{inicio?short(inicio):'Inicio'}</span><span aria-hidden="true">→</span><span className={fin && fin<today && !closed?'is-overdue':''}><DetailIcon name="calendar" size={14}/>{fin?short(fin):'Vencimiento'}</span></button>
    {(inicio||fin) && <button type="button" className="sys-property-clear" title="Borrar fechas" aria-label="Borrar fechas de la tarea" disabled={disabled} onClick={()=>onChange(null,null)}>×</button>}
    <div id={id} ref={panel} popover="auto" className="sys-dates-popover" style={position} onToggle={e=>setOpen(e.currentTarget.matches(':popover-open'))} role="group" aria-label="Calendario de la tarea">
      <div className="sys-date-fields"><label className={target==='inicio'?'is-active':''}>Fecha de inicio<input type="date" value={inicio??''} aria-label="Fecha de inicio" onFocus={()=>setTarget('inicio')} onChange={e=>{const value=e.target.value;onChange(value||null,fin);if(value){setMonth(monthStart(value));setFocusDate(value);}}}/></label><label className={target==='fin'?'is-active':''}>Fecha límite<input type="date" value={fin??''} aria-label="Fecha límite" onFocus={()=>setTarget('fin')} onChange={e=>{const value=e.target.value;onChange(inicio,value||null);if(value){setMonth(monthStart(value));setFocusDate(value);}}}/></label></div>
      <div className="sys-date-quick">{[['Hoy',0],['Mañana',1],['En una semana',7],['En dos semanas',14]].map(([label,days])=><button type="button" key={label} onClick={()=>{choose(addDays(today,Number(days)));setMonth(monthStart(addDays(today,Number(days))));}}>{label}</button>)}</div>
      <div className="sys-calendar-heading"><strong>{date(month).toLocaleDateString('es-PE',{month:'long',year:'numeric',timeZone:'UTC'})}</strong><button type="button" aria-label="Ir al mes actual" onClick={()=>{setMonth(monthStart(today));setFocusDate(today);}}>Hoy</button><button type="button" aria-label="Mes anterior" onClick={()=>moveMonth(-1)}>‹</button><button type="button" aria-label="Mes siguiente" onClick={()=>moveMonth(1)}>›</button></div>
      <div className="sys-calendar-grid" role="group" aria-label="Días del mes">{['lu','ma','mi','ju','vi','sá','do'].map(day=><span key={day} aria-hidden="true">{day}</span>)}{cells.map(day=><button key={day} type="button" data-date={day} tabIndex={day===focusDate?0:-1} aria-label={`Elegir ${day.split('-').reverse().join('/')}`} aria-pressed={day===inicio||day===fin} className={`${day.slice(0,7)!==month.slice(0,7)?'is-other-month ':''}${day===today?'is-today ':''}${inicio&&fin&&day>inicio&&day<fin?'is-in-range':''}`} onFocus={()=>setFocusDate(day)} onClick={()=>choose(day)} onKeyDown={e=>{
        const offset=e.key==='ArrowLeft'?-1:e.key==='ArrowRight'?1:e.key==='ArrowUp'?-7:e.key==='ArrowDown'?7:0;
        if(offset){e.preventDefault();const next=addDays(day,offset);setFocusDate(next);setMonth(monthStart(next));requestAnimationFrame(()=>panel.current?.querySelector<HTMLButtonElement>(`[data-date="${next}"]`)?.focus());}
      }}>{Number(day.slice(8,10))}</button>)}</div>
      {invalid && <p role="alert" className="sys-date-error">La fecha de inicio no puede ser posterior al vencimiento.</p>}
      <div className="sys-calendar-footer"><small>Seleccionando {target==='inicio'?'inicio':'vencimiento'}</small><button type="button" disabled={invalid} onClick={()=>panel.current?.hidePopover()}>Listo</button></div>
    </div>
  </div>;
}
