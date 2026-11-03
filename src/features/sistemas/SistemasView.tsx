import { useEffect, useRef, useState } from "react"

import { useUserProfile } from "../../store/UserProfileContext"

import {
  cargarSistemas,
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
  fecha_objetivo: null,
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
      (!responsable || t.responsable === responsable),
  )

  if (orden === "fecha")
    visibles.sort((a, b) =>
      (a.fecha_objetivo ?? "9999").localeCompare(b.fecha_objetivo ?? "9999"),
    )

  if (orden === "prioridad")
    visibles.sort(
      (a, b) =>
        PRIORIDADES.indexOf(b.prioridad) - PRIORIDADES.indexOf(a.prioridad),
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
    <section className="sistemas">
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
      <header className="sistemas-heading">
        <div>
          <p className="sys-breadcrumb">Sistemas <span aria-hidden="true">/</span> Gestión del equipo</p>
          <h2>Tareas del equipo</h2>
          <span>
            Todo el trabajo del equipo, de pendiente a completado.
          </span>
        </div>
        <button
          className="sys-primary"
          disabled={cargando || !!error}
          onClick={() => setSeleccion({ tarea: vacia(), nueva: true })}
        >
          + Nueva tarea
        </button>
      </header>
      <div className="sistemas-tools">
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
            <div className="sys-board">
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
                        <div className="sys-card-meta"><span className="sys-assignee" title={nombre(t.responsable)} aria-label={`Responsable: ${nombre(t.responsable)}`}>{t.responsable ? nombre(t.responsable).split(' ').map(part => part[0]).slice(0,2).join('') : '—'}</span><span className="sys-card-date" title="Fecha objetivo">{t.fecha_objetivo ? t.fecha_objetivo.split('-').reverse().join('/') : 'Sin fecha'}</span><span className={`sys-priority sys-priority-${PRIORIDADES.indexOf(t.prioridad)}`}><span aria-hidden="true">⚑</span> {t.prioridad}</span></div>
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
            <div className="sys-table-wrap">
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
                      "Responsable",
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
                      <td>{t.capa || "—"}</td>
                      <td>{t.fecha_objetivo || "—"}</td>
                      <td>
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
                      <td className="sys-notes">{t.notas || "—"}</td>
                      <td>{t.prioridad}</td>
                      <td>{nombre(t.responsable)}</td>
                      <td>{t.rol || "—"}</td>
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



  const [error, setError] = useState("")

  const [busy, setBusy] = useState(false)
  const [confirmarEliminar, setConfirmarEliminar] = useState(eliminar)


  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = dialog.current!
    const trigger = document.activeElement as HTMLElement
    const desktop = window.matchMedia('(min-width: 1100px)')
    const open = () => { d.close(); if (desktop.matches) d.show(); else d.showModal(); }
    open()
    desktop.addEventListener('change', open)
    return () => {
      desktop.removeEventListener('change', open)
      d.close()
      trigger?.focus()
    }
  }, [])

  const campo = <K extends keyof Tarea>(key: K, value: Tarea[K]) =>
    setDraft((t) => ({ ...t, [key]: value }))

  return (
    <dialog
      ref={dialog}
      className="sys-detail"
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
        <span className="sys-detail-type"><span aria-hidden="true">☑</span> {nueva ? 'Nueva tarea' : 'Tarea'}</span>
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
            <textarea
              rows={2}
              aria-label="Tarea"
              placeholder="Escribe el nombre de la tarea"
              autoFocus
              required
              maxLength={200}
              value={draft.titulo}
              onChange={(e) => campo("titulo", e.target.value)}
            />
          </label>
          <label>
            Estado
            <select
              value={draft.estado}
              onChange={(e) =>
                campo("estado", e.target.value as Tarea["estado"])
              }
            >
              {ESTADOS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Responsable
            <select
              value={draft.responsable ?? ""}
              onChange={(e) => campo("responsable", e.target.value || null)}
            >
              <option value="">Sin asignar</option>
              {personas.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </label>
          <label>
            Fecha objetivo
            <input
              type="date"
              value={draft.fecha_objetivo ?? ""}
              onChange={(e) => campo("fecha_objetivo", e.target.value || null)}
            />
          </label>
          <label>
            Prioridad
            <select
              value={draft.prioridad}
              onChange={(e) =>
                campo("prioridad", e.target.value as Tarea["prioridad"])
              }
            >
              {PRIORIDADES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </label>
          <label>
            Capa
            <input
              maxLength={100}
              value={draft.capa}
              onChange={(e) => campo("capa", e.target.value)}
            />
          </label>
          <label>
            Rol
            <input
              maxLength={100}
              value={draft.rol}
              onChange={(e) => campo("rol", e.target.value)}
            />
          </label>
          <label className="sys-detail-context">
            <span>Contexto</span>
            <textarea
              aria-label="Notas"
              placeholder="Describe el objetivo, los acuerdos o los pasos necesarios…"
              rows={4}
              maxLength={10000}
              value={draft.notas}
              onChange={(e) => campo("notas", e.target.value)}
            />
          </label>
        </fieldset>
        {error && (
          <p role="alert" className="sys-error">
            {error}
          </p>
        )}
        <button className="sys-primary" disabled={busy || !draft.titulo.trim()}>
          {busy ? "Guardando…" : "Guardar tarea"}
        </button>
      </form>
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
      {nueva ? <p>Guarda la tarea para agregar comentarios y archivos.</p> : <ComentariosTarea tareaId={tarea.id} personas={personas} busy={busy} setBusy={setBusy} />}
    </dialog>
  )
}
