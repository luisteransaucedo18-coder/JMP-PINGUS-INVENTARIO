import { useEffect, useRef, useState } from "react"
import type { Role } from "../../domain/types"
import { useAppStore } from "../../store/AppContext"
import { useUserProfile } from "../../store/UserProfileContext"
import { limaDate } from "../../utils/limaDate"
import {
  actualizarPerfil,
  obtenerPerfiles,
  type Perfil,
} from "../../services/perfilService"
import {
  CHECKLIST,
  DOCUMENTS,
  ANALYST_DOCUMENTS,
  STATE_LABELS,
  checklistErrors,
  laborAmount,
  money,
  netAmount,
  type Valuation,
  type Evidence,
  type ValuationEvent,
  type CheckAnswer,
  type Discount,
  type DocumentKind,
} from "./domain"
import {
  compressPhoto,
  documentUrl,
  loadValuations,
  loadValuationDetails,
  operateValuation,
  uploadEvidence,
} from "../../services/valorizacionService"
import "./valorizaciones.css"

type Props = {
  role: Role
  onToast: (message: string) => void
  projectId?: string
}
export default function ValorizacionesView({
  role,
  onToast,
  projectId,
}: Props) {
  const { state, refreshRemoteData } = useAppStore()
  const { profile } = useUserProfile()
  const [rows, setRows] = useState<Valuation[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [documents, setDocuments] = useState<Evidence[]>([])
  const [events, setEvents] = useState<ValuationEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const pending = useRef(false)
  const [error, setError] = useState("")
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState("")
  const [creating, setCreating] = useState(false)
  const [quoteId, setQuoteId] = useState("")
  const [stage, setStage] = useState<Valuation["etapa"]>("INTERNA")
  const [kind, setKind] = useState<Valuation["tipo"]>("FINAL")
  const [technician, setTechnician] = useState("")
  const [dni, setDni] = useState("")
  const [advance, setAdvance] = useState("")
  const [reason, setReason] = useState("")
  const [answers, setAnswers] = useState<Record<string, CheckAnswer>>({})
  const [discounts, setDiscounts] = useState<Discount[]>([])
  const [detail, setDetail] = useState("")
  const [conform, setConform] = useState(false)
  const [photoPoint, setPhotoPoint] = useState("fachada")
  const [photoDate, setPhotoDate] = useState(limaDate())
  const [photoLocation, setPhotoLocation] = useState("")
  const [docKind, setDocKind] = useState<DocumentKind>("ISOMETRICO_FINAL")
  const [payDate, setPayDate] = useState(limaDate())
  const [reference, setReference] = useState("")
  const [tab, setTab] = useState("expediente")
  const [dirty, setDirty] = useState(false)
  const [accounts, setAccounts] = useState<Perfil[]>([])
  const [accountId, setAccountId] = useState("")
  const [manageTreasury, setManageTreasury] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const photoRef = useRef<HTMLInputElement>(null)
  const v = rows.find((r) => r.id === selected)
  const quote = state.cotizaciones.find(
    (q) => q.id === (v?.cotizacion_id ?? quoteId),
  )
  const projectName = (id: string) =>
    state.proyectos.find((p) => (p.dbId ?? p.id) === id)?.nombre ??
    state.cotizaciones.find((q) => q.proyecto_id === id)?.proyecto_snapshot
      .nombre ??
    "Instalación"
  const options = state.cotizaciones.filter(
    (q) =>
      q.estado === "ACEPTADA" &&
      q.creado_por === profile.id &&
      q.presupuesto.moneda === "PEN" &&
      (!projectId || q.proyecto_id === projectId),
  )
  const editable =
    role === "analista" &&
    v &&
    ["BORRADOR", "OBSERVADA", "RETENIDA"].includes(v.estado)
  const treasury =
    role === "tesoreria" && v && ["EN_TESORERIA", "RETENIDA"].includes(v.estado)
  const discountsDirty = Boolean(
    v && JSON.stringify(discounts) !== JSON.stringify(v.descuentos),
  )
  const errors = v?.tipo === "FINAL" ? checklistErrors(answers, documents) : []
  async function reload(id: string | null = selected) {
    const list = await loadValuations()
    setRows(list)
    if (id) {
      const d = await loadValuationDetails(id)
      setDocuments(d.documents)
      setEvents(d.events)
      const next = list.find((r) => r.id === id)
      setAnswers(next?.checklist ?? {})
      setDiscounts(next?.descuentos ?? [])
      setDirty(false)
      setConform(false)
    }
  }
  useEffect(() => {
    let active = true
    void loadValuations()
      .then((data) => {
        if (active) setRows(data)
      })
      .catch((e) => {
        if (active) setError(e.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])
  async function run(work: () => Promise<void>) {
    if (pending.current) return
    pending.current = true
    setBusy(true)
    setError("")
    try {
      await work()
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "No se pudo completar la operación.",
      )
    } finally {
      pending.current = false
      setBusy(false)
    }
  }
  function choose(row: Valuation) {
    void run(async () => {
      setLoading(true)
      try {
        const d = await loadValuationDetails(row.id)
        setSelected(row.id)
        setDocuments(d.documents)
        setEvents(d.events)
        setAnswers(row.checklist)
        setDiscounts(row.descuentos)
        setDetail("")
        setConform(false)
        setDirty(false)
        setTab("expediente")
        setDocKind(
          role === "tesoreria"
            ? row.estado === "AUTORIZADA"
              ? "PAGO"
              : "FIRMADA"
            : "ISOMETRICO_FINAL",
        )
        setPhotoLocation("")
      } finally {
        setLoading(false)
      }
    })
  }
  async function op(action: string, data: Record<string, unknown> = {}) {
    if (!v) return
    await operateValuation(action, v.id, v.revision, data)
    await reload(v.id)
    await refreshRemoteData()
    onToast("Expediente actualizado.")
  }
  const clientIncome = v
    ? state.gastosProyecto
        .filter(
          (g) =>
            g.naturaleza === "ABONO" &&
            g.estado === "REGISTRADO" &&
            state.cotizaciones.some(
              (q) => q.id === g.cotizacion_id && q.serie_id === v.serie_id,
            ),
        )
        .reduce((s, g) => s + g.monto, 0)
    : 0
  const visible = rows.filter(
    (r) =>
      (!projectId || r.proyecto_id === projectId) &&
      (!filter || r.estado === filter) &&
      `${r.codigo} ${r.tecnico} ${projectName(r.proyecto_id)}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  )
  const openFile = (path: string) =>
    void run(async () => {
      const url = await documentUrl(path)
      const a = document.createElement("a")
      a.href = url
      a.target = "_blank"
      a.rel = "noopener noreferrer"
      a.click()
    })
  function changeDiscount(index: number, patch: Partial<Discount>) {
    setDiscounts((ds) =>
      ds.map((d, i) => (i === index ? { ...d, ...patch } : d)),
    )
    setConform(false)
  }
  return (
    <main className="valuation-view" aria-busy={busy || loading}>
      <div className="valuation-heading">
        <div>
          <p className="valuation-eyebrow">INSTALACIONES DE GAS</p>
          <h1>Trabajos y valorizaciones</h1>
          <p>
            Evidencias, revisión y pagos por construcción interna y
            habilitación.
          </p>
        </div>
        <div className="valuation-actions">
          <button
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => void run(() => reload())}
          >
            Actualizar
          </button>
          {role === "analista" && !selected && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setCreating(true)
                setError("")
              }}
              disabled={busy}
            >
              Nueva valorización
            </button>
          )}
        </div>
      </div>
      {error && (
        <div className="valuation-error" role="alert">
          {error}
        </div>
      )}
      {loading && <p role="status">Cargando expediente…</p>}
      {!selected && (
        <>
          {role === "gerente" && (
            <section className="panel valuation-form">
              <div className="valuation-actions">
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  aria-expanded={manageTreasury}
                  onClick={() =>
                    void run(async () => {
                      if (!manageTreasury) setAccounts(await obtenerPerfiles())
                      setManageTreasury(!manageTreasury)
                    })
                  }
                >
                  Configurar responsable de Tesorería
                </button>
              </div>
              {manageTreasury && (
                <>
                  <p>
                    Asigna Tesorería a una cuenta activa existente. La persona
                    tendrá acceso a expedientes y pagos; la autorización de
                    pagos seguirá correspondiendo al gerente.
                  </p>
                  <label>
                    Cuenta activa
                    <select
                      value={accountId}
                      onChange={(e) => setAccountId(e.target.value)}
                    >
                      <option value="">Selecciona una cuenta</option>
                      {accounts
                        .filter(
                          (a) =>
                            a.estado === "ACTIVO" &&
                            ["analista", "tesoreria"].includes(a.rol),
                        )
                        .map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nombre} · {a.email} · {a.rol}
                          </option>
                        ))}
                    </select>
                  </label>
                  <div className="valuation-actions">
                    <button
                      className="btn btn-primary"
                      disabled={busy || !accountId}
                      onClick={() =>
                        void run(async () => {
                          await actualizarPerfil(accountId, {
                            rol: "tesoreria",
                          })
                          setAccounts(await obtenerPerfiles())
                          onToast(
                            "Rol Tesorería asignado. La cuenta debe volver a iniciar sesión.",
                          )
                        })
                      }
                    >
                      Asignar rol Tesorería
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={
                        busy ||
                        !accountId ||
                        accounts.find((a) => a.id === accountId)?.rol !==
                          "tesoreria"
                      }
                      onClick={() =>
                        void run(async () => {
                          await actualizarPerfil(accountId, { rol: "analista" })
                          setAccounts(await obtenerPerfiles())
                          onToast("Cuenta devuelta al rol Analista.")
                        })
                      }
                    >
                      Restablecer rol Analista
                    </button>
                  </div>
                </>
              )}
            </section>
          )}
          <div className="valuation-kpis">
            {[
              [
                "En revisión",
                visible.filter((r) =>
                  ["EN_TESORERIA", "EN_GERENCIA"].includes(r.estado),
                ).length,
              ],
              [
                "Observadas o retenidas",
                visible.filter((r) =>
                  ["OBSERVADA", "RETENIDA"].includes(r.estado),
                ).length,
              ],
              [
                "Por pagar",
                money(
                  visible
                    .filter((r) => r.estado === "AUTORIZADA")
                    .reduce((s, r) => s + r.neto, 0),
                ),
              ],
              [
                "Pagado",
                money(
                  visible
                    .filter((r) => r.estado === "PAGADA")
                    .reduce((s, r) => s + r.neto, 0),
                ),
              ],
            ].map(([label, value]) => (
              <div className="panel" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          {creating && (
            <form
              className="panel valuation-form"
              onSubmit={(e) => {
                e.preventDefault()
                void run(async () => {
                  const id = crypto.randomUUID()
                  await operateValuation("crear", id, 0, {
                    cotizacion_id: quoteId,
                    etapa: stage,
                    tipo: kind,
                    tecnico: technician,
                    dni,
                    monto: Number(advance),
                    motivo: reason,
                  })
                  await reload(id)
                  setSelected(id)
                  setCreating(false)
                  setDocKind("ISOMETRICO_FINAL")
                  onToast("Valorización creada.")
                })
              }}
            >
              <h2>Nueva valorización</h2>
              <div className="valuation-grid">
                <label>
                  Cotización aceptada
                  <select
                    required
                    value={quoteId}
                    onChange={(e) => {
                      setQuoteId(e.target.value)
                      setTechnician(
                        options.find((q) => q.id === e.target.value)
                          ?.presupuesto.tecnico ?? "",
                      )
                    }}
                  >
                    <option value="">Selecciona una instalación</option>
                    {options.map((q) => (
                      <option key={q.id} value={q.id}>
                        {q.codigo} · {q.proyecto_snapshot.nombre}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Etapa
                  <select
                    value={stage}
                    onChange={(e) =>
                      setStage(e.target.value as Valuation["etapa"])
                    }
                  >
                    <option value="INTERNA">Construcción interna</option>
                    <option value="HABILITACION">
                      Habilitación de equipos y medidor
                    </option>
                  </select>
                </label>
                <label>
                  Tipo
                  <select
                    value={kind}
                    onChange={(e) =>
                      setKind(e.target.value as Valuation["tipo"])
                    }
                  >
                    <option value="FINAL">
                      Valorización final de la etapa
                    </option>
                    <option value="ADELANTO">Adelanto excepcional</option>
                  </select>
                </label>
                <label>
                  Técnico responsable
                  <input
                    required
                    value={technician}
                    onChange={(e) => setTechnician(e.target.value)}
                    maxLength={150}
                  />
                </label>
                <label>
                  DNI del técnico
                  <input
                    required
                    inputMode="numeric"
                    pattern="[0-9]{8}"
                    maxLength={8}
                    value={dni}
                    onChange={(e) => setDni(e.target.value)}
                  />
                </label>
                {kind === "ADELANTO" && (
                  <label>
                    Monto del adelanto (S/)
                    <input
                      type="number"
                      required
                      min="0.01"
                      step="0.01"
                      value={advance}
                      onChange={(e) => setAdvance(e.target.value)}
                    />
                  </label>
                )}
              </div>
              {quote && (
                <p>
                  Mano de obra presupuestada para esta etapa:{" "}
                  <strong>{money(laborAmount(quote, stage))}</strong>. Los
                  adelantos pagados se descontarán de la valorización final.
                </p>
              )}
              {kind === "ADELANTO" && (
                <label>
                  Motivo de la excepción
                  <textarea
                    required
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    maxLength={2000}
                  />
                </label>
              )}
              <div className="valuation-actions">
                <button
                  className="btn btn-primary"
                  disabled={busy || !options.length}
                >
                  Crear expediente
                </button>
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => setCreating(false)}
                >
                  Cancelar
                </button>
              </div>
              {!options.length && (
                <p>
                  No hay cotizaciones aceptadas propias en soles disponibles.
                </p>
              )}
            </form>
          )}
          <section className="panel valuation-list">
            <div className="valuation-filters">
              <label>
                Buscar
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Proyecto, técnico o código"
                />
              </label>
              <label>
                Estado
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                >
                  <option value="">Todos los estados</option>
                  {Object.entries(STATE_LABELS).map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="valuation-table">
              <table>
                <thead>
                  <tr>
                    <th>Instalación / expediente</th>
                    <th>Técnico responsable</th>
                    <th>Etapa</th>
                    <th>Estado</th>
                    <th>Neto</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.id}>
                      <td>
                        <strong>{projectName(r.proyecto_id)}</strong>
                        <small>
                          {r.codigo} ·{" "}
                          {r.tipo === "ADELANTO"
                            ? "Adelanto excepcional"
                            : "Final de etapa"}
                        </small>
                      </td>
                      <td>{r.tecnico}</td>
                      <td>
                        {r.etapa === "INTERNA" ? "Interna" : "Habilitación"}
                      </td>
                      <td>
                        <span className={`valuation-state state-${r.estado}`}>
                          {STATE_LABELS[r.estado]}
                        </span>
                      </td>
                      <td>{money(r.neto)}</td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() => choose(r)}
                        >
                          Ver expediente
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!visible.length && !loading && (
              <p className="valuation-empty">
                No hay valorizaciones para estos filtros. El analista puede
                crear un expediente desde una cotización aceptada.
              </p>
            )}
          </section>
          <p className="valuation-storage">
            Planificación inicial: 10 instalaciones por mes. Hasta 40 fotos
            comprimidas por expediente, 1 MB por foto y 15 MB por PDF. Las
            evidencias se conservan sin borrado automático.
          </p>
        </>
      )}
      {v && (
        <>
          <button
            className="btn btn-ghost"
            disabled={busy || dirty}
            onClick={() => {
              setSelected(null)
              setDocuments([])
              setEvents([])
              setError("")
            }}
          >
            ← Volver a valorizaciones
          </button>
          <section className="panel valuation-summary">
            <div>
              <h2>{projectName(v.proyecto_id)}</h2>
              <p>
                {v.codigo} ·{" "}
                {v.etapa === "INTERNA"
                  ? "Construcción interna"
                  : "Habilitación"}{" "}
                ·{" "}
                {v.tipo === "ADELANTO"
                  ? "Adelanto excepcional"
                  : "Valorización final"}
              </p>
              <p>
                {v.tecnico} · DNI {v.dni}
              </p>
              <span className={`valuation-state state-${v.estado}`}>
                {STATE_LABELS[v.estado]}
              </span>
              {v.motivo && <p>Motivo del adelanto: {v.motivo}</p>}
              {v.observacion && (
                <p className="valuation-notice">Observación: {v.observacion}</p>
              )}
            </div>
            <div className="valuation-totals">
              <span>
                Mano de obra <strong>{money(v.monto)}</strong>
              </span>
              <span>
                Adelantos pagados <strong>{money(v.adelantos)}</strong>
              </span>
              <span>
                Descuentos{" "}
                <strong>
                  {money(discounts.reduce((s, d) => s + d.monto, 0))}
                </strong>
              </span>
              <span>
                Neto a pagar{" "}
                <strong>
                  {money(netAmount(v.monto, v.adelantos, discounts))}
                </strong>
              </span>
            </div>
          </section>
          <nav className="valuation-tabs" aria-label="Secciones del expediente">
            {[
              ["expediente", "Checklist y evidencias"],
              ["pagos", "Revisión y pago"],
              ["historial", "Historial"],
            ].map(([id, label]) => (
              <button
                key={id}
                className="btn"
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
              >
                {label}
              </button>
            ))}
          </nav>
          {tab === "expediente" && (
            <>
              {v.tipo === "FINAL" && (
                <section className="panel valuation-form">
                  <h2>Checklist de instalación</h2>
                  <p>
                    El analista confirma la calidad de la obra bajo su
                    responsabilidad. Cada “No aplica” requiere justificación.
                  </p>
                  {CHECKLIST.map(([id, label, min]) => (
                    <div key={id} className="valuation-check">
                      <label>
                        {label}
                        {min > 0 && (
                          <small>
                            Mínimo {min} foto{min > 1 ? "s" : ""} con fecha y
                            ubicación
                          </small>
                        )}
                        <select
                          disabled={!editable || busy}
                          value={answers[id]?.estado ?? ""}
                          onChange={(e) => {
                            setAnswers((a) => ({
                              ...a,
                              [id]: {
                                estado: e.target.value as CheckAnswer["estado"],
                                nota: a[id]?.nota ?? "",
                              },
                            }))
                            setDirty(true)
                          }}
                        >
                          <option value="">Pendiente de evaluar</option>
                          <option value="CONFORME">Conforme</option>
                          <option value="OBSERVADO">Observado</option>
                          <option value="NO_APLICA">No aplica</option>
                        </select>
                      </label>
                      <label>
                        Observación o justificación
                        <input
                          disabled={!editable || busy}
                          required={answers[id]?.estado === "NO_APLICA"}
                          value={answers[id]?.nota ?? ""}
                          onChange={(e) => {
                            setAnswers((a) => ({
                              ...a,
                              [id]: {
                                estado: a[id]?.estado ?? "",
                                nota: e.target.value,
                              },
                            }))
                            setDirty(true)
                          }}
                          maxLength={1000}
                        />
                      </label>
                    </div>
                  ))}
                  {editable && (
                    <div className="valuation-actions">
                      <button
                        className="btn btn-primary"
                        disabled={busy || !dirty}
                        onClick={() =>
                          void run(() =>
                            op("checklist", { checklist: answers }),
                          )
                        }
                      >
                        Guardar checklist
                      </button>
                      {dirty && (
                        <>
                          <span role="status">Hay cambios sin guardar.</span>
                          <button
                            className="btn btn-ghost"
                            disabled={busy}
                            onClick={() => {
                              setAnswers(v.checklist)
                              setDirty(false)
                            }}
                          >
                            Descartar cambios
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </section>
              )}
              {editable && v.tipo === "FINAL" && (
                <section className="panel valuation-form">
                  <h2>Fotos del checklist</h2>
                  <p>
                    Las fotos se comprimen conservando las marcas visibles.
                    Declara su fecha real y ubicación; el sistema no verifica
                    automáticamente la georreferenciación.
                  </p>
                  <div className="valuation-grid">
                    <label>
                      Punto del checklist
                      <select
                        value={photoPoint}
                        onChange={(e) => setPhotoPoint(e.target.value)}
                      >
                        {CHECKLIST.filter(([, , n]) => n > 0).map(
                          ([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ),
                        )}
                      </select>
                    </label>
                    <label>
                      Fecha de la fotografía
                      <input
                        type="date"
                        value={photoDate}
                        max={limaDate()}
                        onChange={(e) => setPhotoDate(e.target.value)}
                      />
                    </label>
                    <label>
                      Ubicación / coordenadas
                      <input
                        value={photoLocation}
                        onChange={(e) => setPhotoLocation(e.target.value)}
                        maxLength={180}
                        placeholder="Latitud, longitud o referencia verificable"
                      />
                    </label>
                    <label>
                      Fotografía
                      <input
                        ref={photoRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        disabled={busy || dirty}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f)
                            void run(async () => {
                              if (!photoDate || !photoLocation.trim())
                                throw new Error(
                                  "Completa fecha y ubicación antes de subir la foto.",
                                )
                              await uploadEvidence(
                                v,
                                await compressPhoto(f),
                                f.name,
                                "FOTO",
                                {
                                  punto: photoPoint,
                                  fecha: photoDate,
                                  ubicacion: photoLocation,
                                },
                              )
                              await reload(v.id)
                              if (photoRef.current) photoRef.current.value = ""
                            })
                        }}
                      />
                    </label>
                  </div>
                </section>
              )}
              <section className="panel valuation-form">
                <h2>Documentos del expediente</h2>
                <p>
                  Conserva las versiones de cada documento. Los siete formatos
                  pueden cargarse como PDFs separados o adjuntarse por categoría
                  desde el mismo expediente completo.
                </p>
                {(editable ||
                  treasury ||
                  (role === "tesoreria" && v.estado === "AUTORIZADA")) && (
                  <div className="valuation-grid">
                    <label>
                      Documento
                      <select
                        value={docKind}
                        disabled={busy || dirty}
                        onChange={(e) =>
                          setDocKind(e.target.value as DocumentKind)
                        }
                      >
                        {(editable
                          ? ANALYST_DOCUMENTS
                          : v.estado === "AUTORIZADA"
                            ? ["PAGO"] as DocumentKind[]
                            : ["FIRMADA", "HONORARIOS"] as DocumentKind[]
                        ).map((k) => (
                          <option key={k} value={k}>
                            {DOCUMENTS[k]}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      PDF (máximo 15 MB)
                      <input
                        ref={fileRef}
                        type="file"
                        accept="application/pdf"
                        disabled={busy || dirty}
                        onChange={(e) => {
                          const f = e.target.files?.[0]
                          if (f)
                            void run(async () => {
                              await uploadEvidence(v, f, f.name, docKind)
                              await reload(v.id)
                              if (fileRef.current) fileRef.current.value = ""
                            })
                        }}
                      />
                    </label>
                  </div>
                )}
                <ul className="valuation-documents">
                  {documents.map((d) => (
                    <li key={d.id}>
                      <div>
                        <strong>
                          {d.tipo === "FOTO"
                            ? CHECKLIST.find((c) => c[0] === d.punto)?.[1]
                            : DOCUMENTS[d.tipo]}
                        </strong>
                        <small>
                          {d.nombre}
                          {d.fecha ? ` · ${d.fecha} · ${d.ubicacion}` : ""} ·{" "}
                          {new Date(d.created_at).toLocaleString("es-PE", {
                            timeZone: "America/Lima",
                          })}
                        </small>
                      </div>
                      <button
                        className="btn btn-ghost"
                        disabled={busy}
                        onClick={() => openFile(d.path)}
                      >
                        Abrir
                      </button>
                    </li>
                  ))}
                </ul>
                {!documents.length && <p>Aún no hay documentos cargados.</p>}
                {editable && v.tipo === "FINAL" && (
                  <button
                    className="btn btn-primary"
                    disabled={busy || dirty}
                    onClick={() =>
                      void run(async () => {
                        if (errors.length) throw new Error(errors.join(" "))
                        const { photographicReport, savePdf } = await import(
                          "./pdf"
                        )
                        const blob = await photographicReport(
                          v,
                          projectName(v.proyecto_id),
                          documents,
                        )
                        await uploadEvidence(
                          v,
                          blob,
                          `${v.codigo}-reporte-fotografico.pdf`,
                          "REPORTE",
                        )
                        await reload(v.id)
                        savePdf(blob, `${v.codigo}-reporte-fotografico.pdf`)
                      })
                    }
                  >
                    Generar y guardar reporte fotográfico PDF
                  </button>
                )}
              </section>
              {editable && (
                <section className="panel valuation-form">
                  <h2>Enviar a Tesorería</h2>
                  {v.tipo === "FINAL" && (
                    <p>
                      {errors.length
                        ? `${errors.length} puntos pendientes. Completa el checklist, los documentos y genera el reporte antes de enviar.`
                        : "Checklist completo. Verifica los siete formatos y genera el reporte después de la última modificación."}
                    </p>
                  )}
                  {v.tipo === "ADELANTO" && (
                    <p>
                      Adelanto excepcional: requiere revisión de Tesorería,
                      autorización del gerente y documentos firmados; el
                      checklist se completará en la valorización final.
                    </p>
                  )}
                  <button
                    className="btn btn-primary"
                    disabled={busy || dirty}
                    onClick={() => void run(() => op("enviar"))}
                  >
                    Enviar expediente a Tesorería
                  </button>
                </section>
              )}
            </>
          )}
          {tab === "pagos" && (
            <>
              <section className="panel valuation-form">
                <h2>Control de cierre del proyecto</h2>
                <p>
                  Cobrado al cliente: <strong>{money(clientIncome)}</strong> de{" "}
                  {money(quote?.importe_aceptado ?? 0)}. Se exige el cobro del
                  100% y las valorizaciones finales pagadas de ambas etapas
                  presupuestadas, además de los controles operativos existentes.
                </p>
                <p>
                  Los pagos registrados aquí se incorporan automáticamente a los
                  costos reales de la cotización. Evita registrarlos también
                  como gastos manuales.
                </p>
              </section>
              <section className="panel valuation-form">
                <h2>Valorización para firma digital</h2>
                <p>
                  Guarda primero los descuentos y descarga el PDF con el neto
                  definitivo para firma digital. Tesorería carga el PDF firmado
                  y el recibo por honorarios en “Checklist y evidencias”.
                </p>
                <button
                  className="btn btn-ghost"
                  disabled={busy || discountsDirty}
                  onClick={() =>
                    void run(async () => {
                      const { valuationPdf, savePdf } = await import("./pdf")
                      savePdf(
                        await valuationPdf(
                          v,
                          projectName(v.proyecto_id),
                          discounts,
                        ),
                        `${v.codigo}-valorizacion.pdf`,
                      )
                    })
                  }
                >
                  Descargar valorización PDF
                </button>
              </section>
              {treasury && (
                <section className="panel valuation-form">
                  <h2>Revisión de Tesorería</h2>
                  <p>
                    Comprueba contrato, formatos, materiales utilizados y
                    devoluciones. El consumo de obra no es un sobrante
                    pendiente. El monto de descuento es el total por ítem,
                    incluyendo el margen que corresponda.
                  </p>
                  {v.tipo === "FINAL" && (
                    <>
                      <div className="valuation-actions">
                        <button
                          className="btn btn-ghost"
                          disabled={busy}
                          onClick={() =>
                            setDiscounts((ds) => [
                              ...ds,
                              {
                                sku: "",
                                nombre: "",
                                cantidad: 1,
                                referencia: 0,
                                monto: 0,
                                motivo: "",
                              },
                            ])
                          }
                        >
                          Agregar material sobrante no devuelto
                        </button>
                      </div>
                      {discounts.map((d, i) => (
                        <div className="valuation-discount" key={i}>
                          <label>
                            Material
                            <select
                              value={d.sku}
                              onChange={(e) => {
                                const m = state.materials.find(
                                  (m) => m.id === e.target.value,
                                )
                                changeDiscount(i, {
                                  sku: e.target.value,
                                  nombre: m?.nombre ?? "",
                                  referencia: m?.precioUnitario ?? 0,
                                })
                              }}
                            >
                              <option value="">Selecciona material</option>
                              {state.materials.map((m) => (
                                <option key={m.id} value={m.id}>
                                  {m.nombre} · {m.id}
                                </option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Cantidad no devuelta
                            <input
                              type="number"
                              min="0.001"
                              step="0.001"
                              value={d.cantidad}
                              onChange={(e) =>
                                changeDiscount(i, {
                                  cantidad: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <p>
                            Referencia por unidad:{" "}
                            <strong>{money(d.referencia)}</strong>
                            <br />
                            Referencia total: {money(d.referencia * d.cantidad)}
                          </p>
                          <label>
                            Descuento total del ítem (S/)
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              value={d.monto}
                              onChange={(e) =>
                                changeDiscount(i, {
                                  monto: Number(e.target.value),
                                })
                              }
                            />
                          </label>
                          <label>
                            Motivo / sustento
                            <input
                              value={d.motivo}
                              onChange={(e) =>
                                changeDiscount(i, { motivo: e.target.value })
                              }
                            />
                          </label>
                          <button
                            className="btn btn-ghost"
                            onClick={() => {
                              setDiscounts((ds) =>
                                ds.filter((_, index) => index !== i),
                              )
                              setConform(false)
                            }}
                          >
                            Quitar descuento
                          </button>
                        </div>
                      ))}
                      <div className="valuation-actions">
                        <button
                          className="btn btn-primary"
                          disabled={busy || !discountsDirty}
                          onClick={() =>
                            void run(() =>
                              op("descuentos", { descuentos: discounts }),
                            )
                          }
                        >
                          Guardar descuentos y neto definitivo
                        </button>
                        {discountsDirty && (
                          <span role="status">
                            Guarda antes de descargar y solicitar la firma.
                          </span>
                        )}
                      </div>
                    </>
                  )}
                  <label>
                    Observaciones de revisión
                    <textarea
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                      maxLength={2000}
                    />
                  </label>
                  <label className="valuation-confirm">
                    <input
                      type="checkbox"
                      checked={conform}
                      onChange={(e) => setConform(e.target.checked)}
                    />
                    Confirmo documentación, devoluciones y descuentos; el neto
                    del PDF firmado y del recibo coincide con{" "}
                    {money(netAmount(v.monto, v.adelantos, discounts))}.
                  </label>
                  <div className="valuation-actions">
                    <button
                      className="btn btn-primary"
                      disabled={busy || !conform || discountsDirty}
                      onClick={() =>
                        void run(() =>
                          op("revisar", {
                            descuentos: discounts,
                            documentacionConforme: conform,
                            detalle: detail,
                          }),
                        )
                      }
                    >
                      Solicitar autorización del gerente
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={busy || !detail.trim()}
                      onClick={() =>
                        void run(() => op("observar", { detalle: detail }))
                      }
                    >
                      Devolver al analista
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={busy || !detail.trim()}
                      onClick={() =>
                        void run(() => op("retener", { detalle: detail }))
                      }
                    >
                      Retener valorización
                    </button>
                  </div>
                </section>
              )}
              {role === "gerente" && v.estado === "EN_GERENCIA" && (
                <section className="panel valuation-form">
                  <h2>Autorización del gerente</h2>
                  <p>
                    Revisa el expediente y el neto solicitado de{" "}
                    <strong>{money(v.neto)}</strong> antes de autorizar.
                  </p>
                  <label>
                    Comentario o motivo de devolución
                    <textarea
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                    />
                  </label>
                  <div className="valuation-actions">
                    <button
                      className="btn btn-primary"
                      disabled={busy}
                      onClick={() =>
                        void run(() => op("autorizar", { detalle: detail }))
                      }
                    >
                      Autorizar pago de {money(v.neto)}
                    </button>
                    <button
                      className="btn btn-ghost"
                      disabled={busy || !detail.trim()}
                      onClick={() =>
                        void run(() => op("devolver", { detalle: detail }))
                      }
                    >
                      Devolver a Tesorería
                    </button>
                  </div>
                </section>
              )}
              {role === "gerente" && v.estado === "AUTORIZADA" && (
                <section className="panel valuation-form">
                  <h2>Pago autorizado pendiente de registro</h2>
                  <p>
                    Si el presupuesto o el expediente necesitan corregirse,
                    devuelve la autorización a Tesorería antes de registrar el
                    pago.
                  </p>
                  <label>
                    Motivo de revocación
                    <textarea
                      value={detail}
                      onChange={(e) => setDetail(e.target.value)}
                    />
                  </label>
                  <button
                    className="btn btn-ghost"
                    disabled={busy || !detail.trim()}
                    onClick={() =>
                      void run(() => op("revocar", { detalle: detail }))
                    }
                  >
                    Revocar autorización y devolver a Tesorería
                  </button>
                </section>
              )}
              {role === "tesoreria" && v.estado === "AUTORIZADA" && (
                <form
                  className="panel valuation-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void run(() =>
                      op("pagar", { fecha: payDate, referencia: reference }),
                    )
                  }}
                >
                  <h2>Registrar pago realizado</h2>
                  <p>
                    Adjunta primero el comprobante PDF en “Checklist y
                    evidencias”. Importe autorizado: {money(v.neto)}.
                  </p>
                  <div className="valuation-grid">
                    <label>
                      Fecha del pago
                      <input
                        type="date"
                        required
                        max={limaDate()}
                        value={payDate}
                        onChange={(e) => setPayDate(e.target.value)}
                      />
                    </label>
                    <label>
                      Número de operación / referencia
                      <input
                        required
                        value={reference}
                        onChange={(e) => setReference(e.target.value)}
                        maxLength={150}
                      />
                    </label>
                  </div>
                  <button className="btn btn-primary" disabled={busy}>
                    Registrar pago de {money(v.neto)}
                  </button>
                </form>
              )}
              {v.estado === "PAGADA" && (
                <section className="panel valuation-form">
                  <h2>Pago completado</h2>
                  <p>
                    {money(v.neto)} · Fecha: {v.pago_fecha} · Referencia:{" "}
                    {v.pago_referencia}
                  </p>
                  <p>
                    La valorización está pagada. El cierre del proyecto también
                    requiere el cobro completo al cliente y los demás pagos de
                    las etapas.
                  </p>
                </section>
              )}
            </>
          )}
          {tab === "historial" && (
            <section className="panel valuation-form">
              <h2>Trazabilidad del expediente</h2>
              <ol className="valuation-history">
                {events.map((e) => (
                  <li key={e.id}>
                    <strong>
                      {e.accion} · {e.actor_nombre}
                    </strong>
                    <small>
                      {new Date(e.created_at).toLocaleString("es-PE", {
                        timeZone: "America/Lima",
                      })}
                    </small>
                    {e.detalle && <p>{e.detalle}</p>}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </>
      )}
    </main>
  )
}
