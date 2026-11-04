import { useEffect, useRef, useState } from 'react';
import { actualizarPaso, cargarPasos, crearLista, crearPaso, eliminarLista, eliminarPaso, progresoTarea, type ListaTarea, type PasoTarea } from '../../services/sistemasSeguimientoService';
import { useSistemasLive } from './useSistemasLive';
import DetailIcon from './DetailIcon';
import SubtareaEditor from './SubtareaEditor';
import { PRIORIDADES, type Persona } from '../../services/sistemasService';

function mensaje(e: unknown) { return e && typeof e === 'object' && 'message' in e ? String(e.message) : 'No se pudo actualizar el seguimiento.'; }
export default function SeguimientoTarea({ tareaId, contexto, personas, busy, setBusy }: { tareaId: string; contexto: string; personas: Persona[]; busy: boolean; setBusy: (value: boolean) => void }) {
  const [listas, setListas] = useState<ListaTarea[]>([]);
  const [pasos, setPasos] = useState<PasoTarea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [crearSubtarea, setCrearSubtarea] = useState(false);
  const [crearControl, setCrearControl] = useState(false);
  const [completados, setCompletados] = useState<Record<string, boolean>>({});
  const [confirmar, setConfirmar] = useState('');
  const [orden, setOrden] = useState('creacion');
  const [sugerir, setSugerir] = useState(false);
  const [subtaskDraft, setSubtaskDraft] = useState('');
  const version = useRef(0);
  const avance = progresoTarea(pasos);
  async function refresh() {
    if (busy) return;
    const current = ++version.current;
    try { const data = await cargarPasos(tareaId); if (current === version.current) { setListas(data.listas); setPasos(data.pasos); } }
    catch (e) { if (current === version.current) setError(mensaje(e)); }
    finally { if (current === version.current) setLoading(false); }
  }
  useEffect(() => { void refresh(); return () => { version.current++; }; }, [tareaId, busy]);
  useSistemasLive(['sistemas_pasos', 'sistemas_listas'], refresh);
  async function operar(action: () => Promise<void>) {
    if (busy) return false;
    version.current++; setBusy(true); setError('');
    try { await action(); return true; } catch (e) { setError(mensaje(e)); return false; }
    finally { version.current++; setBusy(false); }
  }
  const subtareas = pasos.filter(p => p.tipo === 'SUBTAREA');
  if (orden === 'titulo') subtareas.sort((a,b) => a.titulo.localeCompare(b.titulo,'es'));
  if (orden === 'fecha') subtareas.sort((a,b) => (a.fecha_objetivo ?? '9999').localeCompare(b.fecha_objetivo ?? '9999'));
  if (orden === 'prioridad') subtareas.sort((a,b) => PRIORIDADES.indexOf(b.prioridad ?? 'Media')-PRIORIDADES.indexOf(a.prioridad ?? 'Media'));
  if (orden === 'estado') subtareas.sort((a,b) => Number(a.completado)-Number(b.completado));
  const sugerencias = [...new Set(contexto.split('\n').filter(line => /^\s*(?:[-*•]|\d+[.)])\s+/.test(line)).map(line => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/,'').trim()).filter(Boolean).slice(0,4))];
  const propuestas = (sugerencias.length ? sugerencias : ['Revisar los requisitos', 'Preparar el trabajo', 'Verificar el resultado']).filter(text => !subtareas.some(p => p.titulo.toLocaleLowerCase() === text.toLocaleLowerCase()));
  function fila(paso: PasoTarea) {
    return <div key={paso.id}>
      {paso.tipo === 'SUBTAREA' && <div className="sys-subtask-metadata">{paso.fecha_objetivo && <span><DetailIcon name="calendar" size={12} />{paso.fecha_objetivo.split('-').reverse().join('/')}</span>}{paso.prioridad && <span className={`sys-subtask-priority-${PRIORIDADES.indexOf(paso.prioridad)}`}><DetailIcon name="flag" size={12} />{paso.prioridad}</span>}{paso.responsable && <span><DetailIcon name="user" size={12} />{personas.find(p => p.id === paso.responsable)?.nombre ?? 'Usuario'}</span>}</div>}
      <FilaPaso paso={paso} busy={busy} onUpdate={(source, campos) => operar(async () => { const saved = await actualizarPaso(source, campos); setPasos(items => items.map(p => p.id === saved.id ? saved : p)); })} onDelete={() => setConfirmar(paso.id)} />
      {confirmar === paso.id && <div className="sys-step-confirm"><p>¿Eliminar «{paso.titulo}»?</p><button disabled={busy} onClick={() => setConfirmar('')}>Conservar elemento</button><button disabled={busy} onClick={() => void operar(async () => { await eliminarPaso(paso); setPasos(items => items.filter(p => p.id !== paso.id)); setConfirmar(''); })}>Confirmar eliminación de elemento</button></div>}
    </div>;
  }
  return <section className="sys-followup" aria-label="Seguimiento de la tarea" aria-busy={loading}>
    <details className="sys-fields" open><summary><DetailIcon name="fields" />Campos</summary><div className="sys-progress-row"><span>Progreso</span><progress aria-label="Progreso de la tarea" max={100} value={avance.porcentaje} /><strong>{avance.porcentaje}%</strong></div><small>{avance.completos} de {avance.total} elementos completados</small></details>
    {loading && <p role="status">Cargando seguimiento…</p>}
    <details className="sys-subtasks" open><summary><DetailIcon name="subtask" />Subtareas <span>{subtareas.length}</span></summary>
      <div className="sys-subtasks-toolbar"><label className="sys-subtask-sort"><DetailIcon name="sort" size={14} /><span>Ordenar</span><select aria-label="Ordenar subtareas" value={orden} onChange={e => setOrden(e.target.value)}><option value="creacion">Creación</option><option value="titulo">Nombre</option><option value="fecha">Fecha</option><option value="prioridad">Prioridad</option><option value="estado">Pendientes primero</option></select></label><button disabled={busy || loading} aria-expanded={sugerir} onClick={() => setSugerir(value => !value)}><DetailIcon name="sparkles" size={14} />Sugerir</button><button disabled={busy || loading} aria-label="Añadir nueva subtarea" title="Añadir subtarea" onClick={() => { setSubtaskDraft(''); setCrearSubtarea(true); }}><DetailIcon name="plus" size={14} /></button></div>
      {sugerir && <div className="sys-subtask-suggestions"><p>{sugerencias.length ? 'Sugerencias a partir del contexto' : 'Pasos sugeridos para organizar el trabajo'}</p>{propuestas.map(text => <button key={text} disabled={busy} onClick={() => { setSubtaskDraft(text.slice(0,200)); setCrearSubtarea(true); setSugerir(false); }}>{text}</button>)}{!propuestas.length && <p>Los pasos sugeridos ya están en la tarea.</p>}</div>}
      {subtareas.map(fila)}
      {!subtareas.length && <p className="sys-followup-empty">Divide la tarea en pasos más pequeños.</p>}
      {crearSubtarea ? <SubtareaEditor key={subtaskDraft} initialTitle={subtaskDraft} personas={personas} busy={busy || loading} onCancel={() => setCrearSubtarea(false)} onAdd={(titulo, propiedades) => operar(async () => { const saved = await crearPaso(tareaId, titulo, undefined, propiedades); setPasos(items => [...items, saved]); setCrearSubtarea(false); })} /> : <button className="sys-followup-add" aria-label="+ Añadir subtarea" disabled={busy || loading} onClick={() => { setSubtaskDraft(''); setCrearSubtarea(true); }}><DetailIcon name="plus" size={14} />Añadir subtarea</button>}
    </details>
    <details className="sys-checklists" open><summary><DetailIcon name="checklist" />Listas de control <span>Completados: {pasos.filter(p => p.tipo === 'CONTROL' && p.completado).length}</span></summary>
      {listas.map(lista => {
        const items = pasos.filter(p => p.lista_id === lista.id);
        const done = items.filter(p => p.completado).length;
        return <div className="sys-checklist" key={lista.id}><div className="sys-checklist-heading"><h4>{lista.titulo}</h4><small>{done}/{items.length}</small><button disabled={busy} className="sys-step-remove" aria-label={`Eliminar lista ${lista.titulo}`} onClick={() => setConfirmar(lista.id)}>×</button></div>
          {confirmar === lista.id && <div className="sys-step-confirm"><p>¿Eliminar esta lista y todos sus elementos?</p><button disabled={busy} onClick={() => setConfirmar('')}>Conservar lista</button><button disabled={busy} onClick={() => void operar(async () => { await eliminarLista(lista); setListas(values => values.filter(l => l.id !== lista.id)); setPasos(values => values.filter(p => p.lista_id !== lista.id)); setConfirmar(''); })}>Confirmar eliminación de lista</button></div>}
          {items.filter(p => !p.completado || completados[lista.id]).map(fila)}
          <AgregarElemento label={`Nuevo elemento en ${lista.titulo}`} action="Añadir elemento" busy={busy || loading} onAdd={titulo => operar(async () => { const saved = await crearPaso(tareaId, titulo, lista.id); setPasos(values => [...values, saved]); })} />
          {!!done && <button className="sys-show-completed" aria-pressed={!!completados[lista.id]} onClick={() => setCompletados(values => ({ ...values, [lista.id]: !values[lista.id] }))}>{completados[lista.id] ? 'Ocultar' : 'Mostrar'} elementos completados ({done})</button>}
        </div>;
      })}
      {crearControl ? <AgregarElemento label="Nombre de la lista de control" action="Crear lista" maxLength={150} busy={busy || loading} onCancel={() => setCrearControl(false)} onAdd={titulo => operar(async () => { const saved = await crearLista(tareaId, titulo); setListas(values => [...values, saved]); setCrearControl(false); })} /> : <button className="sys-followup-add" disabled={busy || loading} onClick={() => setCrearControl(true)}>+ Crear lista de control</button>}
    </details>
    {error && <div className="sys-error" role="alert"><p>{error}</p><button disabled={busy} onClick={() => { setError(''); void refresh(); }}>Actualizar seguimiento</button></div>}
  </section>;
}

function AgregarElemento({ label, action, busy, onAdd, onCancel, maxLength = 200 }: { label: string; action: string; busy: boolean; onAdd: (titulo: string) => Promise<boolean>; onCancel?: () => void; maxLength?: number }) {
  const [texto, setTexto] = useState('');
  const [submitted, setSubmitted] = useState(false);
  return <form className="sys-add-step" onSubmit={async e => { e.preventDefault(); if (!texto.trim() || busy || submitted) return; setSubmitted(true); try { if (await onAdd(texto.trim())) setTexto(''); } finally { setSubmitted(false); } }}><input aria-label={label} placeholder={label} maxLength={maxLength} required value={texto} disabled={busy} onChange={e => setTexto(e.target.value)} /><button disabled={busy || !texto.trim() || submitted}>{action}</button>{onCancel && <button type="button" disabled={busy} onClick={onCancel}>Cancelar</button>}</form>;
}

function FilaPaso({ paso, busy, onUpdate, onDelete }: { paso: PasoTarea; busy: boolean; onUpdate: (source: PasoTarea, campos: Pick<PasoTarea, 'titulo' | 'completado'>) => Promise<boolean>; onDelete: () => void }) {
  const [edit, setEdit] = useState<PasoTarea>();
  const [titulo, setTitulo] = useState('');
  return <div className={`sys-step${paso.completado ? ' is-complete' : ''}`}>
    <label><input type="checkbox" checked={paso.completado} disabled={busy} aria-label={`Completar ${paso.tipo === 'SUBTAREA' ? 'subtarea' : 'elemento'} ${paso.titulo}`} onChange={e => void onUpdate(paso, { titulo: paso.titulo, completado: e.target.checked })} /><span>{paso.titulo}</span></label>
    {!edit ? <><button className="sys-step-edit" aria-label={`Editar elemento ${paso.titulo}`} disabled={busy} onClick={() => { setEdit(paso); setTitulo(paso.titulo); }}>Editar</button><button className="sys-step-remove" aria-label={`Eliminar elemento ${paso.titulo}`} disabled={busy} onClick={onDelete}>×</button></> : <form className="sys-edit-step" onSubmit={async e => { e.preventDefault(); if (titulo.trim() && await onUpdate(edit, { titulo: titulo.trim(), completado: edit.completado })) setEdit(undefined); }}><input autoFocus aria-label="Editar nombre del elemento" required maxLength={200} value={titulo} onChange={e => setTitulo(e.target.value)} disabled={busy} /><button disabled={busy || !titulo.trim()}>Guardar elemento</button><button type="button" disabled={busy} onClick={() => setEdit(undefined)}>Cancelar</button></form>}
  </div>;
}
