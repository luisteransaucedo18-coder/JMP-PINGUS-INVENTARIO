import { useEffect, useRef, useState } from "react"

import { useUserProfile } from "../../store/UserProfileContext"

import {
  cargarSistemas,
  personasAsignadas,
  indicePrioridad,
  guardarTarea,
  eliminarTarea,
  ESTADOS,
  PRIORIDADES,
  type Tarea,
  type Persona,
} from "../../services/sistemasService"

import "./sistemas.css"
import ComentariosTarea from './ComentariosTarea'
import MenuTarea from './MenuTarea'
import DetailIcon from './DetailIcon'
import SelectorPropiedad, { type OpcionPropiedad } from './SelectorPropiedad'
import FechasTarea, { rangoFechasInvalido } from './FechasTarea'
import AsignadosTarea, { AvataresAsignados } from './AsignadosTarea'
import AutoSizeTextarea from './AutoSizeTextarea'
import ContextoTarea from './ContextoTarea'
import SeguimientoTarea from './SeguimientoTarea'
import { useSistemasLive } from './useSistemasLive'

function mensaje(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "No se pudo completar la operación."
}

const vacia = (estado: Tarea["estado"] = "Pendiente"): Tarea => ({
  id: crypto.randomUUID(),
  titulo: "",
  capa: "",
  rol: "",
  estado,
  prioridad: "Media",
  responsable: null,
  asignados: [],
  fecha_objetivo: null,
  fecha_inicio: null,
  notas: "",
  revision: 0,
})

export default function SistemasView() {
  const { profile } = useUserProfile()

  const [tareas, setTareas] = useState<Tarea[]>([])

  const [personas, setPersonas] = useState<Persona[]>([])

  const [vista, setVista] = useState("Tablero")

  const [busqueda, setBusqueda] = useState("")

  const [estado, setEstado] = useState("")

  const [prioridad, setPrioridad] = useState("")

  const [responsable, setResponsable] = useState("")

  const [orden, setOrden] = useState("recientes")
  const [filtros, setFiltros] = useState(false)

  const [cargando, setCargando] = useState(true)

  const [error, setError] = useState("")

  const [seleccion, setSeleccion] = useState<{ tarea: Tarea; nueva: boolean; eliminar?: boolean }>()

  const [moviendo, setMoviendo] = useState(false)

  const drag = useRef<string | null>(null)
  const readVersion = useRef(0)

  async function cargar(silent = false) {
    const version = ++readVersion.current
    if (!silent) setCargando(true)
    if (!silent) setError("")

    try {
      const data = await cargarSistemas()
      if (version !== readVersion.current) return
      setTareas(data.tareas)
      setPersonas(data.personas)
    } catch (e) {
      if (version !== readVersion.current) return
      setError(mensaje(e))
    } finally {
      if (version === readVersion.current) setCargando(false)
    }
  }

  useEffect(() => {
    void cargar()
    return () => { readVersion.current++ }
  }, [])
  useSistemasLive(['sistemas_tareas', 'perfiles'], () => cargar(true))

  const nombre = (id: string | null) =>
    personas.find((p) => p.id === id)?.nombre ?? "Sin asignar"

  const visibles = tareas.filter(
    (t) =>
      (!busqueda ||
        `${t.titulo} ${t.notas} ${t.capa} ${t.rol}`
          .toLocaleLowerCase()
          .includes(busqueda.toLocaleLowerCase())) &&
      (!estado || t.estado === estado) &&
      (!prioridad || t.prioridad === prioridad) &&
      (!responsable || personasAsignadas(t).includes(responsable)),
  )

  if (orden === "fecha")
    visibles.sort((a, b) =>
      (a.fecha_objetivo ?? "9999").localeCompare(b.fecha_objetivo ?? "9999"),
    )

  if (orden === "prioridad")
    visibles.sort(
      (a, b) =>
        indicePrioridad(b.prioridad) - indicePrioridad(a.prioridad),
    )

  async function mover(id: string, destino: Tarea["estado"]) {
    const tarea = tareas.find((t) => t.id === id)

    if (!tarea || tarea.estado === destino || moviendo) return

    setMoviendo(true)
    setError("")

    try {
      const saved = await guardarTarea({ ...tarea, estado: destino }, false)
      readVersion.current++
      setTareas((items) => items.map((t) => (t.id === id ? saved : t)))
    } catch (e) {
      setError(mensaje(e))
    } finally {
      setMoviendo(false)
    }
  }

  return (
    <section className="analyst-workspace sistemas">
      <nav className="sistemas-menu" aria-label="Menú de Sistemas">
        <button aria-pressed={!responsable} onClick={() => setResponsable('')}>Tareas del equipo</button>
        <button
          aria-pressed={responsable === profile.id}
          onClick={() =>
            setResponsable(responsable === profile.id ? "" : profile.id)
          }
        >
          Mis tareas
        </button>
      </nav>
      <header className="analyst-workspace-heading sistemas-heading">
        <div>
          <h2>Tareas del equipo</h2>
          <p>Organiza las tareas del equipo y da seguimiento a su avance.</p>
        </div>
        <button
          className="btn btn-primary sys-primary"
          disabled={cargando || !!error}
          onClick={() => setSeleccion({ tarea: vacia(), nueva: true })}
        >
          + Nueva tarea
        </button>
      </header>
      <div className="panel sistemas-tools">
        <div className="sys-views" aria-label="Vista de tareas">
          {["Tabla", "Tablero"].map((v) => (
            <button
              key={v}
              aria-pressed={vista === v}
              onClick={() => setVista(v)}
            >
              {v}
            </button>
          ))}
        </div>
        <label>
          Buscar
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar tareas"
          />
        </label>
        <button aria-expanded={filtros} aria-controls="sys-filter-controls" onClick={() => setFiltros(value => !value)}>Filtros{[estado, prioridad, responsable].filter(Boolean).length ? ` (${[estado, prioridad, responsable].filter(Boolean).length})` : ''}</button>
        <button onClick={() => void cargar()} disabled={cargando || moviendo}>
          Actualizar
        </button>
        {(busqueda || estado || prioridad || responsable) && <button className="sys-clear" onClick={() => { setBusqueda(''); setEstado(''); setPrioridad(''); setResponsable(''); }}>Limpiar filtros</button>}
        <div id="sys-filter-controls" className="sys-filter-controls" hidden={!filtros}>
        <label>
          Estado
          <select value={estado} onChange={(e) => setEstado(e.target.value)}>
            <option value="">Todos</option>
            {ESTADOS.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Prioridad
          <select
            value={prioridad}
            onChange={(e) => setPrioridad(e.target.value)}
          >
            <option value="">Todas</option>
            {PRIORIDADES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label>
          Responsable
          <select
            value={responsable}
            onChange={(e) => setResponsable(e.target.value)}
          >
            <option value="">Todos</option>
            {personas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre}
              </option>
            ))}
          </select>
        </label>
        <label>
          Ordenar
          <select value={orden} onChange={(e) => setOrden(e.target.value)}>
            <option value="recientes">Más recientes</option>
            <option value="fecha">Fecha objetivo</option>
            <option value="prioridad">Prioridad</option>
          </select>
        </label>
        </div>
      </div>
      {error && (
        <p className="sys-error" role="alert">
          {error}
        </p>
      )}
      {cargando ? (
        <p role="status">Cargando tareas…</p>
      ) : (
        <>
          <div className="sys-board-summary"><p className="sys-count" role="status">{visibles.length} {visibles.length === 1 ? 'tarea' : 'tareas'}{moviendo ? ' · Guardando estado…' : ''}</p><div className="sys-completion"><span>{tareas.filter(t => t.estado === 'Completado').length} de {tareas.length} completadas</span><progress aria-label="Avance del equipo" max={tareas.length || 1} value={tareas.filter(t => t.estado === 'Completado').length} /></div></div>
          {vista === "Tablero" ? (
            <div className="panel sys-board">
              {ESTADOS.map((s, i) => (
                <section
                  key={s}
                  className={`sys-column sys-state-${i}`}
                  onDragOver={(e) => {
                    e.preventDefault()
                  }}
                  onDrop={(e) => {
                    e.preventDefault()
                    const id = drag.current
                    drag.current = null
                    if (id) void mover(id, s)
                  }}
                >
                  <h3>
                    <span className="sys-column-label"><span className="sys-status-dot" aria-hidden="true" />{s}</span><span className="sys-column-count">{visibles.filter((t) => t.estado === s).length}</span><button className="sys-column-new" aria-label={`Nueva tarea en ${s}`} disabled={moviendo} onClick={() => setSeleccion({ tarea: vacia(s), nueva: true })}>+</button>
                  </h3>
                  {visibles
                    .filter((t) => t.estado === s)
                    .map((t) => (
                      <article
                        className="sys-card"
                        data-selected={seleccion?.tarea.id === t.id}
                        key={t.id}
                        draggable={!moviendo}
                        onDragStart={() => {
                          drag.current = t.id
                        }}
                        onDragEnd={() => {
                          drag.current = null
                        }}
                      >
                        <div className="sys-card-heading">
                        <button
                          className="sys-task-title"
                          onClick={() =>
                            setSeleccion({ tarea: t, nueva: false })
                          }
                        >
                          {t.titulo}
                        </button>
                        <MenuTarea titulo={t.titulo} disabled={moviendo} onOpen={() => setSeleccion({ tarea: t, nueva: false })} onDelete={() => setSeleccion({ tarea: t, nueva: false, eliminar: true })} />
                        </div>
                        {t.notas && <p className="sys-card-description">{t.notas}</p>}
                        {(t.capa || t.rol) && <div className="sys-tags">{t.capa && <span>{t.capa}</span>}{t.rol && <span>{t.rol}</span>}</div>}
                        <div className="sys-card-bottom">
                        <div className="sys-card-meta"><AvataresAsignados ids={personasAsignadas(t)} personas={personas} /><span className="sys-card-date" title="Fecha objetivo">{t.fecha_objetivo ? t.fecha_objetivo.split('-').reverse().join('/') : 'Sin fecha'}</span><span className={`sys-priority sys-priority-${indicePrioridad(t.prioridad)}`}><DetailIcon name="flag" size={12}/> {t.prioridad ?? 'Sin prioridad'}</span></div>
                        <label className="sys-move">
                          Estado
                          <select
                            aria-label={`Estado de ${t.titulo}`}
                            disabled={moviendo}
                            value={t.estado}
                            onChange={(e) =>
                              void mover(
                                t.id,
                                e.target.value as Tarea["estado"],
                              )
                            }
                          >
                            {ESTADOS.map((x) => (
                              <option key={x}>{x}</option>
                            ))}
                          </select>
                        </label>
                        </div>
                      </article>
                    ))}
                  <button
                    className="sys-add"
                    disabled={moviendo}
                    onClick={() =>
                      setSeleccion({ tarea: vacia(s), nueva: true })
                    }
                  >
                    + Nueva tarea
                  </button>
                </section>
              ))}
            </div>
          ) : (
            <div className="panel sys-table-wrap">
              <table>
                <thead>
                  <tr>
                    {[
                      "Tarea",
                      "Capa",
                      "Fecha objetivo",
                      "Estado",
                      "Notas",
                      "Prioridad",
                      "Asignados",
                      "Rol",
                    ].map((h) => (
                      <th key={h} scope="col">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visibles.map((t) => (
                    <tr key={t.id}>
                      <td>
                        <MenuTarea titulo={t.titulo} disabled={moviendo} onOpen={() => setSeleccion({ tarea: t, nueva: false })} onDelete={() => setSeleccion({ tarea: t, nueva: false, eliminar: true })} />
                        <button
                          className="sys-task-title"
                          onClick={() =>
                            setSeleccion({ tarea: t, nueva: false })
                          }
                        >
                          {t.titulo}
                        </button>
                      </td>
                      <td data-label="Capa">{t.capa || "—"}</td>
                      <td data-label="Fecha objetivo">{t.fecha_objetivo || "—"}</td>
                      <td data-label="Estado">
                        <select
                          aria-label={`Estado de ${t.titulo}`}
                          value={t.estado}
                          disabled={moviendo}
                          onChange={(e) =>
                            void mover(t.id, e.target.value as Tarea["estado"])
                          }
                        >
                          {ESTADOS.map((s) => (
                            <option key={s}>{s}</option>
                          ))}
                        </select>
                      </td>
                      <td className="sys-notes" data-label="Notas">{t.notas || "—"}</td>
                      <td data-label="Prioridad"><span className={`sys-priority sys-priority-${indicePrioridad(t.prioridad)}`}><DetailIcon name="flag" size={14}/>{t.prioridad ?? "Sin prioridad"}</span></td>
                      <td data-label="Asignados"><AvataresAsignados ids={personasAsignadas(t)} personas={personas} /><span className="sys-assigned-names">{personasAsignadas(t).map(id => nombre(id)).join(", ") || "Sin asignar"}</span></td>
                      <td data-label="Rol">{t.rol || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {!visibles.length && (
            <div className="sys-empty">
              <h3>
                {tareas.length
                  ? "No hay coincidencias"
                  : "El equipo aún no tiene tareas"}
              </h3>
              <p>
                {tareas.length
                  ? "Ajusta los filtros para ver otras tareas."
                  : "Crea la primera tarea para comenzar a organizar el trabajo."}
              </p>
            </div>
          )}
        </>
      )}
      {seleccion && (
        <Detalle
          key={seleccion.tarea.id}
          {...seleccion}
          personas={personas}
          remoteChanged={!seleccion.nueva && tareas.find(t => t.id === seleccion.tarea.id)?.revision !== seleccion.tarea.revision}
          onClose={() => setSeleccion(undefined)}
          onDelete={() => {
            readVersion.current++
            setTareas(items => items.filter(t => t.id !== seleccion.tarea.id))
            setSeleccion(undefined)
          }}
          onSave={(saved) => {
            readVersion.current++
            setTareas((items) =>
              seleccion.nueva
                ? [saved, ...items.filter(t => t.id !== saved.id)]
                : items.map((t) => (t.id === saved.id ? saved : t)),
            )
            setSeleccion(undefined)
          }}
        />
      )}
    </section>
  )
}

const OPCIONES_ESTADO: OpcionPropiedad<Tarea['estado']>[] = [
  {value:'Pendiente',label:'Pendiente',group:'Sin iniciar',tone:'pending',icon:'status'},
  {value:'En curso',label:'En curso',group:'Activa',tone:'active',icon:'status'},
  {value:'En revisión',label:'En revisión',group:'Activa',tone:'review',icon:'status'},
  {value:'Completado',label:'Completado',group:'Terminada',tone:'complete',icon:'status'},
  {value:'Cancelado',label:'Cancelado',group:'Cerrada',tone:'cancelled',icon:'status'},
];
const OPCIONES_PRIORIDAD: OpcionPropiedad<NonNullable<Tarea['prioridad']>>[] = [...PRIORIDADES].reverse().map((value,index)=>({value,label:value,group:'Prioridad',icon:'flag',shortcut:`Ctrl ${index+1}`,tone:value==='Urgente'?'urgent':value==='Alta'?'high':value==='Media'?'normal':'low'}));

function Detalle({
  tarea,
  nueva,
  personas,
  onClose,
  onSave,
  onDelete,
  remoteChanged,
  eliminar = false,
}: {
  tarea: Tarea
  nueva: boolean
  personas: Persona[]
  onClose: () => void
  onSave: (t: Tarea) => void
  onDelete: () => void
  remoteChanged: boolean
  eliminar?: boolean
}) {
  const [draft, setDraft] = useState(tarea)
  const rangoInvalido = rangoFechasInvalido(draft.fecha_inicio,draft.fecha_objetivo)



  const [error, setError] = useState("")

  const [busy, setBusy] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(eliminar)


  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current!
    const trigger = document.activeElement as HTMLElement
    const desktop = window.matchMedia('(min-width: 1100px)')
    const open = () => { d.close(); if (desktop.matches && !nueva) d.show(); else d.showModal(); }
    open()
    desktop.addEventListener('change', open)
    return () => {
      desktop.removeEventListener('change', open)
      d.close()
      trigger?.focus()
    }
  }, [nueva])

  const campo = <K extends keyof Tarea>(key: K, value: Tarea[K]) =>
    setDraft((t) => ({ ...t, [key]: value }))

  return (
    <dialog
      ref={dialog}
      className={`panel sys-detail${nueva ? " sys-create" : ""}`}
      aria-labelledby="sys-detail-title"
      onKeyDown={e => {
        if (e.key === 'Escape' && !busy && !dialog.current?.querySelector(':popover-open')) { e.preventDefault(); onClose(); }
      }}
      onCancel={(e) => {
        e.preventDefault()
        if (!busy) onClose()
      }}
    >
      <header>
        <span className="sys-detail-type"><DetailIcon name="status" /> {nueva ? 'Crear nueva tarea' : 'Tarea'}</span>
        {!nueva && <MenuTarea titulo={tarea.titulo} disabled={busy} onDelete={() => setConfirmarEliminar(true)} />}
        <button onClick={onClose} disabled={busy} aria-label="Cerrar detalle">
          ×
        </button>
      </header>
      {remoteChanged && <p role="status" className="sys-error">La tarea cambió en otra sesión o fue eliminada. Cierra el detalle y vuelve a abrirla antes de guardar. Tus cambios escritos se conservan aquí.</p>}
      <form className="sys-detail-form"
        onSubmit={async (e) => {
          e.preventDefault()
          if (busy) return
          if (rangoInvalido) { setError('La fecha de inicio no puede ser posterior al vencimiento.'); return; }
          setBusy(true)
          setError("")
          try {
            onSave(
              await guardarTarea(
                { ...draft, titulo: draft.titulo.trim() },
                nueva,
              ),
            )
          } catch (err) {
            setError(mensaje(err))
          } finally {
            setBusy(false)
          }
        }}
      >
        <fieldset disabled={busy}>
          <label className="sys-detail-task-title">
            <span id="sys-detail-title">{nueva ? 'Nueva tarea' : 'Detalle de tarea'}</span>
            <AutoSizeTextarea
              aria-label="Tarea"
              placeholder="Escribe el nombre de la tarea"
              autoFocus
              required
              maxLength={200}
              value={draft.titulo}
              onChange={(e) => campo("titulo", e.target.value)}
            />
          </label>
          {nueva && <label className="sys-create-description"><span className="sys-property-name"><DetailIcon name="context" />Descripción</span><AutoSizeTextarea aria-label="Descripción" placeholder="Añade una descripción de la tarea…" maxLength={10000} value={draft.notas} onChange={e=>campo('notas',e.target.value)} /></label>}
          <div className="sys-create-properties">
          <div className="sys-detail-property"><span className="sys-property-name"><DetailIcon name="status" />Estado</span><SelectorPropiedad label="Estado" completeValue="Completado" value={draft.estado} options={OPCIONES_ESTADO} disabled={busy} onChange={value=>{if(value) campo('estado',value);}} /></div>
          <div className="sys-detail-assignees"><span className="sys-property-name"><DetailIcon name="user" />Asignados</span><AsignadosTarea ids={personasAsignadas(draft)} personas={personas} disabled={busy} onChange={ids => setDraft(value => ({ ...value, asignados: ids, responsable: ids[0] ?? null }))} /></div>
          <div className="sys-detail-property"><span className="sys-property-name"><DetailIcon name="calendar" />Fechas</span><FechasTarea inicio={draft.fecha_inicio ?? null} fin={draft.fecha_objetivo} closed={draft.estado === 'Completado' || draft.estado === 'Cancelado'} disabled={busy} onChange={(inicio,fin)=>setDraft(value=>({...value,fecha_inicio:inicio,fecha_objetivo:fin}))} /></div>
          <div className="sys-detail-property"><span className="sys-property-name"><DetailIcon name="flag" />Prioridad</span><SelectorPropiedad label="Prioridad" value={draft.prioridad} options={OPCIONES_PRIORIDAD} disabled={busy} clearable onChange={value=>campo('prioridad',value)} /></div>
          </div>
          <details className="sys-create-fields" open={!nueva}><summary><DetailIcon name="fields" />Campos adicionales</summary>
          <label>
            <span className="sys-property-name"><DetailIcon name="layers" />Capa</span>
            <input
              maxLength={100}
              value={draft.capa}
              onChange={(e) => campo("capa", e.target.value)}
            />
          </label>
          <label>
            <span className="sys-property-name"><DetailIcon name="tag" />Rol</span>
            <input
              maxLength={100}
              value={draft.rol}
              onChange={(e) => campo("rol", e.target.value)}
            />
          </label>
          </details>
          {!nueva && <ContextoTarea value={draft.notas} onChange={value => campo('notas', value)} disabled={busy} />}
        </fieldset>
        {(error || rangoInvalido) && <p role="alert" className="sys-error">{rangoInvalido ? 'La fecha de inicio no puede ser posterior al vencimiento.' : error}</p>}
        <footer className="sys-task-form-footer">
        {nueva && <button type="button" disabled={busy} onClick={onClose}>Cancelar</button>}
        <button className="btn btn-primary sys-primary" disabled={busy || !draft.titulo.trim() || rangoInvalido}>
          {busy ? "Guardando…" : nueva ? "Crear tarea" : "Guardar tarea"}
        </button>
        </footer>
      </form>
      {!nueva && <SeguimientoTarea tareaId={tarea.id} contexto={draft.notas} personas={personas} busy={busy} setBusy={setBusy} />}
      {!nueva && confirmarEliminar && <section className="sys-delete" aria-label="Eliminar tarea">
          <p>¿Eliminar «{tarea.titulo}» y todos sus comentarios? Esta acción no se puede deshacer. Primero elimina los archivos de sus comentarios.</p>
          <button type="button" disabled={busy} onClick={() => setConfirmarEliminar(false)}>Conservar tarea</button>
          <button type="button" className="sys-danger" disabled={busy} onClick={async () => {
            if (busy) return
            setBusy(true); setError('')
            try { await eliminarTarea(tarea); onDelete() }
            catch (err) { setError(mensaje(err)) }
            finally { setBusy(false) }
          }}>{busy ? 'Eliminando…' : 'Confirmar eliminación'}</button>
      </section>}
      {!nueva && <ComentariosTarea tareaId={tarea.id} personas={personas} busy={busy} setBusy={setBusy} />}
    </dialog>
  )
}
