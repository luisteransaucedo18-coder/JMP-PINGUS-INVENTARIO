import ValidatedForm from "../../components/ValidatedForm";
import { publicCode } from "../../utils/publicCode";
import { useEffect, useRef, useState, type ReactNode } from "react"

import type { Role } from "../../domain/types"

import { useAppStore } from "../../store/AppContext"

import { useUserProfile } from "../../store/UserProfileContext"

import { operarCotizacion } from "../../services/cotizacionService"
import QuoteProjectInfo from './QuoteProjectInfo'

import QuoteEditor, { Field, NumberField, Totals } from "./QuoteEditor"

import QuotationReport from "./QuotationReport"

import BudgetContext from "./BudgetContext"

import { EXCEL_LABELS, EXCEL_MODALIDADES } from "./excelVariables"

import {
  ESTADOS_COTIZACION,
  ESTADO_LABELS,
  executionSummary,
  money,
  remainingMaterial,
  RUBROS,
  RUBRO_LABELS,
  type EstadoCotizacion,
  type ProjectExpense,
} from "./domain"

type Props = {
  role: Role

  onToast: (message: string) => void

  onNav?: (view: string) => void

  projectId?: string

  nueva?: boolean
}

const date = (value: string) =>
  new Date(value).toLocaleString("es-PE", { timeZone: "America/Lima" })

type Operation = {
  title: string

  action: string

  target?: EstadoCotizacion

  expense?: ProjectExpense
}

function Dialog({
  title,

  children,

  onClose,

  destructive = false,
}: {
  title: string

  children: ReactNode

  onClose: () => void

  destructive?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current

    dialog?.showModal()

    return () => dialog?.close()
  }, [])

  return (
    <dialog
      className="quote-dialog"
      ref={ref}
      aria-labelledby="quote-dialog-title"
      role={destructive ? "alertdialog" : undefined}
      onCancel={(e) => {
        e.preventDefault()

        onClose()
      }}
    >
      <h2 id="quote-dialog-title">{title}</h2>
      {children}
    </dialog>
  )
}

export function QuotationSummary({ onNav }: { onNav: (view: string) => void }) {
  const { state } = useAppStore()

  const accepted = state.cotizaciones.filter((q) =>
    ["ACEPTADA", "CERRADA"].includes(q.estado),
  )

  return (
    <section className="panel quote-summary">
      <div>
        <strong>Cotizaciones de proyectos</strong>
        <p className="quote-muted">
          {state.cotizaciones.filter((q) => q.estado === "PRESENTADA").length}{" "}
          esperando al cliente ·{" "}
          {accepted.filter((q) => q.estado === "ACEPTADA").length} en ejecución
          · {accepted.filter((q) => q.estado === "CERRADA").length} cerradas
        </p>
        {(["PEN", "USD"] as const)

          .filter((currency) =>
            accepted.some((q) => q.presupuesto.moneda === currency),
          )

          .map((currency) => (
            <p key={currency}>
              Aceptado en {currency}:{" "}
              <strong>
                {money(
                  accepted

                    .filter((q) => q.presupuesto.moneda === currency)

                    .reduce((sum, q) => sum + (q.importe_aceptado ?? 0), 0),

                  currency,
                )}
              </strong>
            </p>
          ))}
        {state.cotizacionesError && (
          <p role="status">Cotizaciones temporalmente no disponibles.</p>
        )}
      </div>
      <button className="btn btn-ghost" onClick={() => onNav("cotizaciones")}>
        Ver cotizaciones →
      </button>
    </section>
  )
}

export default function CotizacionesView({
  role,

  onToast,

  onNav,

  projectId,

  nueva = false,
}: Props) {
  const { state, refreshRemoteData } = useAppStore()

  const { profile } = useUserProfile()

  const [selected, setSelected] = useState<string | null>(null)

  const [editor, setEditor] = useState<"quote" | null>(
    nueva ? "quote" : null,
  )

  const [search, setSearch] = useState("")

  const [filter, setFilter] = useState("")

  const [projectFilter, setProjectFilter] = useState("")

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [tab, setTab] = useState("presupuesto")

  const [operation, setOperation] = useState<Operation | null>(null)

  const [detail, setDetail] = useState("")

  const [amount, setAmount] = useState(0)

  const [requestAmounts, setRequestAmounts] = useState<Record<string, number>>(
    {},
  )

  const [operationId, setOperationId] = useState("")

  const [operationRevision, setOperationRevision] = useState(0)

  const [habilitationDate, setHabilitationDate] = useState(
    new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }),
  )

  const [draftId, setDraftId] = useState(() =>
    nueva ? crypto.randomUUID() : "",
  )

  const [expense, setExpense] = useState({
    rubro: "MANO_OBRA",

    naturaleza: "COSTO",

    descripcion: "",

    monto: 0,

    fecha: new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }),

    comprobante: "",

    material_sku: "",

    cantidad: 0,
  })

  const quote = state.cotizaciones.find((q) => q.id === selected)

  const family = quote
    ? state.cotizaciones.filter((q) => q.serie_id === quote.serie_id)
    : []

  const owner = role === "analista" && quote?.creado_por === profile.id

  const writable = owner || role === "coordinador"

  const available = state.cotizaciones.filter(
    (q) =>
      (!projectId || q.proyecto_id === projectId) &&
      (!projectFilter || q.proyecto_id === projectFilter) &&
      (!filter || q.estado === filter) &&
      (!search ||
        `${q.codigo} ${q.proyecto_snapshot.nombre} ${q.proyecto_snapshot.cliente} ${q.presupuesto.excel.departamento} ${q.presupuesto.excel.provincia ?? ""} ${q.presupuesto.excel.distrito ?? q.presupuesto.ciudad}`

          .toLocaleLowerCase()

          .includes(search.toLocaleLowerCase())),
  )

  const begin = (op: Operation) => {
    if (!quote) return

    setOperation(op)

    setOperationRevision(quote.revision)

    setError("")

    setDetail("")

    setAmount(
      op.target === "ACEPTADA"
        ? (quote.importe_presentado ?? quote.totales.total)
        : quote.totales.total,
    )

    setOperationId(crypto.randomUUID())

    setRequestAmounts(
      Object.fromEntries(
        quote.presupuesto.materiales.map((m) => [
          m.id,

          0,
        ]),
      ),
    )

    setHabilitationDate(
      quote.fecha_habilitacion ??
        new Date().toLocaleDateString("en-CA", { timeZone: "America/Lima" }),
    )

    setExpense({
      rubro: "MANO_OBRA",

      naturaleza: "COSTO",

      descripcion: "",

      monto: 0,

      fecha: new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Lima",
      }),

      comprobante: "",

      material_sku: "",

      cantidad: 0,
    })
  }

  const run = async (
    action: string,

    data: Record<string, unknown>,

    id = quote?.id,
  ) => {
    if (!id || saving) return

    setSaving(true)

    setError("")

    try {
      const result = await operarCotizacion(action, id, {
        revision: quote?.revision,

        ...data,
      })

      await refreshRemoteData()

      setOperation(null)

      onToast("Operación guardada correctamente.")

      return result
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "No se pudo guardar la operación.",
      )
    } finally {
      setSaving(false)
    }
  }

  const startDraft = () => {
    setSelected(null)

    setDraftId(crypto.randomUUID())

    setEditor("quote")

    setError("")
  }

  if (state.cotizacionesError && !editor)
    return (
      <div className="quote-view">
        <div className="quote-error" role="alert">
          {state.cotizacionesError}
        </div>
        <button
          className="btn btn-primary"
          onClick={() => void refreshRemoteData()}
        >
          Reintentar
        </button>
      </div>
    )

  if (editor)
    return (
      <div className="quote-view">
        <QuoteEditor
          key={`${selected ?? draftId}:${editor}`}
          quote={quote}
          projectId={projectId}
          proyectos={state.proyectos}
          materials={state.materials}
          saving={saving}
          onCancel={() => setEditor(null)}
          onSave={async (budget, project, _name, snapshot) => {
            setSaving(true)

            try {
              const id = await operarCotizacion(
                "guardar",

                quote?.id ?? draftId,

                {
                  revision: snapshot.revision,

                  presupuesto: budget,

                  proyectoId: project,

                  proyecto: snapshot.proyecto,
                },
              )

              await refreshRemoteData()

              setEditor(null)

              setSelected(id)

              onToast("Borrador guardado.")
            } finally {
              setSaving(false)
            }
          }}
        />
      </div>
    )

  const nav = (view: string) => onNav?.(view)

  const stateAction = (target: EstadoCotizacion, title: string) => (
    <button
      className="btn btn-ghost"
      disabled={saving}
      onClick={() => begin({ title, action: "estado", target })}
    >
      {title}
    </button>
  )

  const dialog = operation && quote && (
    <Dialog
      title={operation.title}
      destructive={operation.action === "eliminar"}
      onClose={() => {
        if (!saving) setOperation(null)
      }}
    >
      <ValidatedForm
        onSubmit={async (e) => {
          e.preventDefault()

          const payload: Record<string, unknown> = {
            revision: operationRevision,

            detalle: detail,

            estado: operation.target,

            importe: amount,

            fechaHabilitacion: habilitationDate,
          }

          if (operation.action === "requerimiento") {
            payload.requerimientoId = operationId

            payload.items = Object.entries(requestAmounts)

              .filter(([, n]) => n > 0)

              .map(([itemId, cantidad]) => ({ itemId, cantidad }))
          }

          if (operation.action === "gasto")
            Object.assign(payload, expense, { gastoId: operationId })

          if (operation.action === "anular_gasto")
            payload.gastoId = operation.expense?.id

          await run(operation.action, payload)
        }}
      >
        {error && (
          <p role="alert" className="quote-error">
            {error}
          </p>
        )}
        <fieldset disabled={saving}>
          {operation.action === "eliminar" && (
            <p className="quote-note">
              Se quitará esta cotización de la lista. El historial de la
              decisión del cliente se conservará. Confirma que deseas
              eliminarla.
            </p>
          )}
          {operation.target === "ACEPTADA" && (
            <p className="quote-note">
              Registra la aceptación real del cliente. Se creará el proyecto y
              quedarán disponibles los materiales cotizados para solicitarlos
              por etapas. Si es una nueva versión, reemplazará la versión
              aceptada anterior.
            </p>
          )}
          {operation.action === "requerimiento" && (
            <>
              <QuoteProjectInfo quote={quote} />
              <p>
                Se enviará una solicitud al coordinador. Las cantidades usan la
                unidad de inventario. El stock se confirma mediante el flujo
                habitual.
              </p>
              {quote.presupuesto.materiales.map((m) => (
                <NumberField
                  key={m.id}
                  label={`${m.nombre} · saldo ${remainingMaterial(m, family, state.requerimientos)} ${m.unidadCatalogo}`}
                  max={remainingMaterial(m, family, state.requerimientos)}
                  value={requestAmounts[m.id] ?? 0}
                  onChange={(v) =>
                    setRequestAmounts((a) => ({ ...a, [m.id]: v }))
                  }
                />
              ))}
            </>
          )}
          {operation.action === "gasto" && (
            <>
              <p className="quote-muted">
                Registra el costo real sin IGV en {quote.presupuesto.moneda}.
                Las compras y entregas no se suman automáticamente; evita
                registrar dos veces el mismo costo.
              </p>
              <Field label="Rubro">
                <select
                  className="select-field"
                  value={expense.rubro}
                  onChange={(e) =>
                    setExpense((g) => ({ ...g, rubro: e.target.value }))
                  }
                >
                  <option value="MATERIALES">Materiales consumidos</option>
                  {RUBROS.map((r) => (
                    <option key={r} value={r}>
                      {RUBRO_LABELS[r]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Descripción">
                <input
                  className="input-field"
                  required
                  value={expense.descripcion}
                  onChange={(e) =>
                    setExpense((g) => ({ ...g, descripcion: e.target.value }))
                  }
                />
              </Field>
              <NumberField
                label={`Costo real sin IGV (${quote.presupuesto.moneda})`}
                min={0.01}
                value={expense.monto}
                onChange={(v) => setExpense((g) => ({ ...g, monto: v }))}
              />
              <Field label="Fecha">
                <input
                  className="input-field"
                  required
                  type="date"
                  value={expense.fecha}
                  onChange={(e) =>
                    setExpense((g) => ({ ...g, fecha: e.target.value }))
                  }
                />
              </Field>
              <Field label="Comprobante o referencia verificable">
                <input
                  className="input-field"
                  required
                  placeholder="Factura, recibo, acta o enlace al documento"
                  value={expense.comprobante}
                  onChange={(e) =>
                    setExpense((g) => ({ ...g, comprobante: e.target.value }))
                  }
                />
              </Field>
              {expense.rubro === "MATERIALES" && (
                <>
                  <Field label="Material consumido">
                    <select
                      className="select-field"
                      required
                      value={expense.material_sku}
                      onChange={(e) =>
                        setExpense((g) => ({
                          ...g,

                          material_sku: e.target.value,
                        }))
                      }
                    >
                      <option value="">Selecciona material</option>
                      {Array.from(
                        new Map(
                          quote.presupuesto.materiales.map((m) => [m.sku, m]),
                        ).values(),
                      ).map((m) => (
                        <option key={m.sku} value={m.sku}>
                          {m.nombre} ({m.unidadCatalogo})
                        </option>
                      ))}
                    </select>
                  </Field>
                  <NumberField
                    label="Cantidad realmente consumida (unidad de inventario)"
                    min={0.000001}
                    value={expense.cantidad}
                    onChange={(v) => setExpense((g) => ({ ...g, cantidad: v }))}
                  />
                </>
              )}
            </>
          )}
          {operation.action === "gasto" && (
            <Field label="Tipo de movimiento">
              <select
                className="select-field"
                value={expense.naturaleza}
                onChange={(e) =>
                  setExpense((g) => ({
                    ...g,

                    naturaleza: e.target.value,

                    descripcion:
                      e.target.value === "ABONO"
                        ? "A CUENTA DEL MATERIAL SOBRANTE"
                        : g.descripcion,
                  }))
                }
              >
                <option value="COSTO">Costo real</option>
                <option value="ABONO">
                  A CUENTA DEL MATERIAL SOBRANTE / abono documentado
                </option>
              </select>
              <small>
                El abono disminuye el costo registrado. Usa una recuperación
                real con comprobante; una devolución de stock por sí sola no
                genera un abono.
              </small>
            </Field>
          )}
          {operation.target &&
            ["PRESENTADA", "ACEPTADA"].includes(operation.target) && (
              <NumberField
                label={`${
                  operation.target === "ACEPTADA"
                    ? EXCEL_LABELS.aceptada
                    : EXCEL_LABELS.presentada
                } (${quote.presupuesto.moneda})`}
                min={0.01}
                value={amount}
                onChange={setAmount}
              />
            )}
          {operation.action !== "eliminar" &&
            operation.action !== "requerimiento" &&
            operation.action !== "gasto" && (
              <Field
                label={
                  operation.action === "cerrar"
                    ? "Conciliación final: consumo, devoluciones, comprobantes y costos completos"
                    : operation.target === "ACEPTADA"
                      ? "Evidencia de aceptación (cliente, fecha y referencia o enlace)"
                      : "Observación o motivo"
                }
              >
                <textarea
                  className="input-field"
                  rows={4}
                  required={
                    operation.action === "cerrar" ||
                    operation.action === "anular_gasto" ||
                    ["ACEPTADA", "OBSERVADA", "RECHAZADA", "ANULADA"].includes(
                      operation.target ?? "",
                    )
                  }
                  value={detail}
                  onChange={(e) => setDetail(e.target.value)}
                />
              </Field>
            )}
          {operation.action === "cerrar" && (
            <Field label="Verificación del cierre">
              <span>
                <input type="checkbox" required /> Confirmo que concilié
                consumo, devoluciones y todos los costos reales; el resultado
                dejará de ser provisional.
              </span>
            </Field>
          )}
          {["cerrar", "habilitar"].includes(operation.action) && (
            <Field label="Fecha de habilitacion">
              <input
                className="input-field"
                type="date"
                required
                value={habilitationDate}
                onChange={(e) => setHabilitationDate(e.target.value)}
              />
            </Field>
          )}
          <div className="quote-toolbar">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setOperation(null)}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" type="submit">
              {saving ? "Guardando…" : "Confirmar"}
            </button>
          </div>
        </fieldset>
      </ValidatedForm>
    </Dialog>
  )

  if (!quote)
    return (
      <div className="quote-view">
        <div className="quote-toolbar">
          <div>
            <h2>Cotizaciones de proyectos</h2>
            <p className="quote-muted">
              Presupuesto → propuesta → aceptación → ejecución → cierre
            </p>
          </div>
          <div className="quote-actions">
            {role === "analista" && (
              <button className="btn btn-primary" onClick={startDraft}>
                Nueva cotización
              </button>
            )}
            <button
              className="btn btn-ghost"
              onClick={() => void refreshRemoteData()}
            >
              Actualizar
            </button>
          </div>
        </div>
        <section className="panel quote-section">
          <div className="quote-form-grid">
            <Field label="Buscar cotización, cliente o ubicación">
              <input
                className="input-field"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </Field>
            <Field label="Estado">
              <select
                className="select-field"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              >
                <option value="">Todos los estados</option>
                {ESTADOS_COTIZACION.filter(
                  (s) =>
                    !["EN_REVISION", "OBSERVADA", "APROBADA"].includes(s) ||
                    state.cotizaciones.some((q) => q.estado === s),
                ).map((s) => (
                  <option key={s} value={s}>
                    {ESTADO_LABELS[s]}
                  </option>
                ))}
              </select>
            </Field>
            {!projectId && (
              <Field label="Proyecto">
                <select
                  className="select-field"
                  value={projectFilter}
                  onChange={(e) => setProjectFilter(e.target.value)}
                >
                  <option value="">Todos los proyectos</option>
                  {state.proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Field>
            )}
          </div>
        </section>
        {available.length === 0 ? (
          <section className="panel quote-section">
            <h3>No hay cotizaciones para estos filtros</h3>
            <p>
              {role === "analista"
                ? "Prepara tu primera cotización. El proyecto se creará cuando el cliente la acepte."
                : "Las cotizaciones enviadas por los analistas aparecerán aquí."}
            </p>
            {onNav && (
              <button
                className="btn btn-ghost"
                onClick={() =>
                  role === "analista" ? startDraft() : nav("proyectos")
                }
              >
                {role === "analista"
                  ? "Crear mi primera cotización"
                  : "Ir a proyectos"}
              </button>
            )}
          </section>
        ) : (
          <div className="quote-cards">
            {available.map((q) => (
              <button
                className="panel quote-card"
                key={q.id}
                onClick={() => {
                  setSelected(q.id)

                  setTab("presupuesto")

                  setError("")
                }}
              >
                <div className="quote-toolbar">
                  <strong>
                    {q.codigo} · v{q.version}
                  </strong>
                  <span className={`quote-status quote-status-${q.estado}`}>
                    {ESTADO_LABELS[q.estado]}
                  </span>
                </div>
                <h3>{q.proyecto_snapshot.nombre}</h3>
                <p>
                  {q.proyecto_snapshot.cliente} · {[q.presupuesto.excel.departamento, q.presupuesto.excel.provincia, q.presupuesto.excel.distrito || q.presupuesto.ciudad].filter(Boolean).join(" / ")}
                </p>
                <p>
                  {q.presupuesto.modalidad} · {q.presupuesto.puntos} puntos ·{" "}
                  {q.presupuesto.alternativa}
                </p>
                <strong className="quote-money">
                  {money(
                    q.importe_aceptado ??
                      q.importe_presentado ??
                      q.totales.total,

                    q.presupuesto.moneda,
                  )}
                </strong>
                <small>Vigencia: {q.presupuesto.vigencia}</small>
              </button>
            ))}
          </div>
        )}
        {!projectId && role !== "analista" && (
          <QuotationReport role={role} onToast={onToast} />
        )}
      </div>
    )

  const result = executionSummary(quote, family, state.gastosProyecto)

  const reqIds = new Set(
    family.flatMap((q) => q.asignaciones.map((a) => a.requerimiento_id)),
  )

  const linkedRequests = state.requerimientos.filter((r) => reqIds.has(r.id))

  const deliveries = state.entregas.filter((e) => reqIds.has(e.requerimientoId))

  const returns = state.devoluciones.filter((d) =>
    reqIds.has(d.requerimientoId),
  )

  const purchases = state.compras.filter(
    (c) => c.requerimientoId && reqIds.has(c.requerimientoId),
  )

  return (
    <div className="quote-view">
      {dialog}
      <button
        className="btn btn-ghost"
        onClick={() => {
          setSelected(null)

          setError("")
        }}
      >
        ← Todas las cotizaciones
      </button>
      <section className="panel quote-section">
        <div className="quote-toolbar">
          <div>
            <h2>
              {quote.codigo} · Versión {quote.version}
            </h2>
            <p>
              {quote.proyecto_snapshot.nombre} ·{" "}
              {quote.proyecto_snapshot.cliente}
            </p>
            <span className={`quote-status quote-status-${quote.estado}`}>
              {ESTADO_LABELS[quote.estado]}
            </span>
          </div>
          <div>
            <p>
              {EXCEL_LABELS.total}{" "}
              <strong>
                {money(quote.totales.total, quote.presupuesto.moneda)}
              </strong>
            </p>
            <p>
              {EXCEL_LABELS.presentada}:{" "}
              {quote.importe_presentado == null
                ? "Pendiente"
                : money(quote.importe_presentado, quote.presupuesto.moneda)}
            </p>
            <p>
              {EXCEL_LABELS.aceptada}:{" "}
              {quote.importe_aceptado == null
                ? "Pendiente"
                : money(quote.importe_aceptado, quote.presupuesto.moneda)}
            </p>
          </div>
        </div>
        {quote.observaciones && (
          <p className="quote-note">{quote.observaciones}</p>
        )}
        <div className="quote-actions">
          {owner && ["BORRADOR", "OBSERVADA"].includes(quote.estado) && (
            <>
              <button
                className="btn btn-primary"
                onClick={() => setEditor("quote")}
              >
                Editar presupuesto
              </button>
            </>
          )}
          {owner &&
            ["BORRADOR", "OBSERVADA", "EN_REVISION", "APROBADA"].includes(
              quote.estado,
            ) &&
            stateAction("PRESENTADA", "Presentar al cliente")}
          {owner &&
            ["BORRADOR", "OBSERVADA", "EN_REVISION", "APROBADA"].includes(
              quote.estado,
            ) &&
            stateAction("RECHAZADA", "El cliente no acepta")}
          {owner && quote.estado === "PRESENTADA" && (
            <>
              {stateAction("ACEPTADA", "Registrar aceptación")}
              {stateAction("RECHAZADA", "Registrar rechazo")}
              {quote.presupuesto.vigencia <
                new Date().toLocaleDateString("en-CA", {
                  timeZone: "America/Lima",
                }) && stateAction("VENCIDA", "Marcar vencida")}
            </>
          )}
          {owner && !family.some((q) => q.estado === "CERRADA") && (
            <button
              className="btn btn-ghost"
              disabled={saving}
              onClick={async () => {
                const id = await run("version", {
                  nuevoId: crypto.randomUUID(),
                })

                if (id) {
                  setSelected(id)

                  setEditor("quote")
                }
              }}
            >
              {quote.estado === "ACEPTADA"
                ? "Editar cotización (nueva versión)"
                : "Crear nueva versión"}
            </button>
          )}
          {owner &&
            quote.estado === "RECHAZADA" &&
            !family.some((q) => q.importe_aceptado != null) && (
              <button
                className="btn btn-danger"
                onClick={() =>
                  begin({ title: "Eliminar cotización", action: "eliminar" })
                }
              >
                Eliminar cotización
              </button>
            )}
          {role === "coordinador" && quote.estado === "ACEPTADA" && (
            <button
              className="btn btn-primary"
              onClick={() =>
                begin({ title: "Cerrar ejecución", action: "cerrar" })
              }
            >
              Cerrar proyecto cotizado
            </button>
          )}
          {[
            "BORRADOR",

            "APROBADA",

            "PRESENTADA",

            "ACEPTADA",

            "CERRADA",

            "SUPERADA",
          ].includes(quote.estado) && (
            <button
              className="btn btn-ghost"
              onClick={async () => {
                try {
                  const { downloadQuotation } = await import(
                    "../../utils/quotationPdf"
                  )

                  await downloadQuotation(quote)
                } catch (err) {
                  setError(
                    err instanceof Error
                      ? err.message
                      : "No se pudo generar el PDF.",
                  )
                }
              }}
            >
              Descargar propuesta PDF
            </button>
          )}
        </div>
      </section>
      {error && !operation && (
        <p role="alert" className="quote-error">
          {error}
        </p>
      )}
      <nav className="quote-tabs" aria-label="Detalle de cotización">
        {[
          ["presupuesto", "Presupuesto"],

          ["propuesta", "Propuesta comercial"],

          ["ejecucion", "Ejecución y costos reales"],

          ["historial", "Versiones e historial"],
        ].map(([id, label]) => (
          <button
            key={id}
            className={`btn ${tab === id ? "btn-primary" : "btn-ghost"}`}
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      {tab === "presupuesto" && (
        <section className="panel quote-section">
          <h3>
            {EXCEL_MODALIDADES[quote.presupuesto.modalidad]} ·{" "}
            {[quote.presupuesto.excel.departamento, quote.presupuesto.excel.provincia, quote.presupuesto.excel.distrito || quote.presupuesto.ciudad].filter(Boolean).join(" / ")} ·{" "}
            {quote.presupuesto.tipo === "TIPICO" ? "Típico" : "No típico"} ·{" "}
            {quote.presupuesto.puntos} puntos
          </h3>
          <p>
            Técnico: {quote.presupuesto.tecnico} · Sede:{" "}
            {quote.presupuesto.sede} · Moneda: {quote.presupuesto.moneda}
          </p>
          <QuoteProjectInfo quote={quote} />
          <BudgetContext budget={quote.presupuesto} />
          <div className="quote-table-wrap">
            <table className="quote-table">
              <caption>Materiales y servicios presupuestados sin IGV</caption>
              <thead>
                <tr>
                  <th>MATERIAL / PARTIDA</th>
                  <th>CANTIDAD / UND</th>
                  <th>PRECIO</th>
                  <th>TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {quote.presupuesto.materiales.map((m) => (
                  <tr key={m.id}>
                    <td>
                      {m.nombre}
                      <small>
                        {m.sku} · 1 {m.unidadCotizada} = {m.factorStock}{" "}
                        {m.unidadCatalogo}
                      </small>
                    </td>
                    <td>
                      {m.cantidad} {m.unidadCotizada}
                    </td>
                    <td>{money(m.costoUnitario, quote.presupuesto.moneda)}</td>
                    <td>
                      {money(
                        m.cantidad * m.costoUnitario,

                        quote.presupuesto.moneda,
                      )}
                    </td>
                  </tr>
                ))}
                {quote.presupuesto.gastos.map((g) => (
                  <tr key={g.id}>
                    <td>
                      {g.descripcion}
                      <small>{RUBRO_LABELS[g.rubro]}</small>
                    </td>
                    <td>{g.cantidad}</td>
                    <td>{money(g.costoUnitario, quote.presupuesto.moneda)}</td>
                    <td>
                      {money(
                        g.cantidad * g.costoUnitario,

                        quote.presupuesto.moneda,
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Totals budget={quote.presupuesto} totals={quote.totales} />
        </section>
      )}
      {tab === "propuesta" && (
        <section className="panel quote-section">
          <h3>Condiciones y acuerdo con el cliente</h3>
          <p>Vigencia: {quote.presupuesto.vigencia}</p>
          <p className="quote-prewrap">
            {quote.presupuesto.condiciones ||
              "Sin condiciones adicionales registradas."}
          </p>
          <h3>Evidencia de aceptación</h3>
          <p className="quote-prewrap">
            {quote.evidencia ||
              "Todavía no se registró la aceptación del cliente."}
          </p>
          <p className="quote-muted">
            El PDF contiene el alcance, las cantidades y el importe comercial.
            Los costos internos y porcentajes de utilidad permanecen en el
            presupuesto del sistema.
          </p>
        </section>
      )}
      {tab === "ejecucion" && (
        <>
          <section className="panel quote-section">
            <div className="quote-toolbar">
              <h3>Resultado {result.complete ? "final" : "provisional"}</h3>
              {writable && quote.estado === "ACEPTADA" && (
                <button
                  className="btn btn-primary"
                  onClick={() =>
                    begin({ title: "Registrar costo real", action: "gasto" })
                  }
                >
                  Registrar costo real
                </button>
              )}
            </div>
            <dl className="quote-totals">
              {([
                ["TOTAL COTIZADO (SIN IGV)", result.saleWithoutTax],

                ["Costo previsto (incluye cargos)", result.planned],

                ["TOTAL COSTOS (SIN IGV)", result.actual],

                ["Desviación del costo (real − previsto)", result.difference],

                ["UTILIDAD", result.result],
              ] as const).map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{money(value, quote.presupuesto.moneda)}</dd>
                </div>
              ))}
            </dl>
            <p>
              <strong>Relación Beneficio / Costo (%):</strong>{" "}
              {result.beneficioCosto == null
                ? "No disponible: no hay costo neto positivo"
                : `${result.beneficioCosto}%`}
            </p>
            <p>
              Fecha de habilitacion:{" "}
              {quote.fecha_habilitacion ?? "Sin registrar"}
            </p>
            {writable &&
              quote.estado === "ACEPTADA" &&
              !quote.fecha_habilitacion && (
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    begin({
                      title: "Registrar habilitacion",

                      action: "habilitar",
                    })
                  }
                >
                  Registrar habilitacion
                </button>
              )}
            <p className="quote-muted">
              {result.complete
                ? "Cierre conciliado por coordinación."
                : "El resultado es provisional hasta registrar y conciliar todos los costos, consumos y devoluciones."}{" "}
              Los movimientos de inventario no equivalen por sí solos a consumo
              ni a costo adicional.
            </p>
            {quote.cierre && <p className="quote-prewrap">{quote.cierre}</p>}
          </section>
          <section className="panel quote-section">
            <div className="quote-toolbar">
              <h3>Requerimientos y abastecimiento</h3>
              {owner &&
                quote.estado === "ACEPTADA" &&
                quote.presupuesto.materiales.some(
                  (m) => remainingMaterial(m, family, state.requerimientos) > 0,
                ) && (
                  <button
                    className="btn btn-primary"
                    onClick={() =>
                      begin({
                        title: "Generar requerimiento por etapa",

                        action: "requerimiento",
                      })
                    }
                  >
                    Solicitar materiales pendientes
                  </button>
                )}
            </div>
            {quote.presupuesto.materiales.map((m) => (
              <p key={m.id}>
                {m.nombre}: presupuesto {m.cantidad * m.factorStock}{" "}
                {m.unidadCatalogo} · saldo por solicitar{" "}
                {remainingMaterial(m, family, state.requerimientos)}{" "}
                {m.unidadCatalogo}
              </p>
            ))}
            {linkedRequests.map((r) => (
              <div className="quote-line" key={r.id}>
                <strong>
                  {publicCode(r)} · {r.estado}
                </strong>
                <p>{r.descripcion}</p>
                <p>
                  {r.abastecimiento
                    ? `Abastecimiento: ${r.abastecimiento.tipo ?? "Por definir"} · ${r.abastecimiento.estado}`
                    : "Sin abastecimiento adicional registrado"}
                </p>
              </div>
            ))}
            {linkedRequests.length === 0 && (
              <p>Sin solicitudes generadas desde esta serie.</p>
            )}
            {onNav && (
              <div className="quote-actions">
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    nav(
                      role === "analista"
                        ? "mis-solicitudes"
                        : "requerimientos",
                    )
                  }
                >
                  Gestionar solicitudes
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() =>
                    nav(role === "analista" ? "mis-compras" : "compras")
                  }
                >
                  Gestionar compras
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => nav("entregas")}
                >
                  Entregas
                </button>
                <button
                  className="btn btn-ghost"
                  onClick={() => nav("devoluciones")}
                >
                  Devoluciones
                </button>
              </div>
            )}
            <h3>Compras vinculadas</h3>
            {purchases.map((c) => (
              <p key={c.id}>
                {c.id} · {c.estado}
              </p>
            ))}
            {purchases.length === 0 && (
              <p>Sin compras vinculadas a las solicitudes generadas.</p>
            )}
            <h3>Entregas vinculadas</h3>
            {deliveries.map((e) => (
              <p key={e.id}>
                {publicCode(e)} · {e.estado} · {e.tecnico}
              </p>
            ))}
            {deliveries.length === 0 && <p>Sin entregas registradas.</p>}
            <h3>Devoluciones vinculadas</h3>
            {returns.map((d) => (
              <p key={d.id}>
                {d.codigo} · {d.estado} ·{" "}
                {d.items

                  .map((m) => `${m.nombre}: ${m.cantidad} ${m.unidad}`)

                  .join(", ")}
              </p>
            ))}
            {returns.length === 0 && <p>Sin devoluciones registradas.</p>}
            <div className="quote-table-wrap">
              <table className="quote-table">
                <caption>
                  Materiales · Conforme a obra (unidad de inventario)
                </caption>
                <thead>
                  <tr>
                    <th>MATERIAL</th>
                    <th>Entregado</th>
                    <th>MATERIAL NO UTILIZADO (EN ALMACEN)</th>
                    <th>MATERIAL UTILIZADO EXISTENTE / consumo registrado</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.from(
                    new Map(
                      quote.presupuesto.materiales.map((m) => [m.sku, m]),
                    ).values(),
                  ).map((m) => (
                    <tr key={m.sku}>
                      <td>
                        {m.nombre} ({m.unidadCatalogo})
                      </td>
                      <td>
                        {deliveries

                          .filter((e) => e.estado !== "CANCELADA")

                          .flatMap((e) => e.items)

                          .filter((i) => i.skuId === m.sku)

                          .reduce((sum, i) => sum + i.cantidadEntregada, 0)}
                      </td>
                      <td>
                        {returns

                          .filter((d) => d.estado === "VALIDADA")

                          .flatMap((d) => d.items)

                          .filter((i) => i.skuId === m.sku)

                          .reduce((sum, i) => sum + i.cantidad, 0)}
                      </td>
                      <td>
                        {result.active

                          .filter(
                            (g) =>
                              g.material_sku === m.sku &&
                              g.naturaleza === "COSTO",
                          )

                          .reduce((sum, g) => sum + (g.cantidad ?? 0), 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="quote-muted">
              Material no utilizado muestra devoluciones validadas. El consumo
              se registra expresamente con su costo; entregado menos devuelto no
              demuestra material instalado.
            </p>
          </section>
          <section className="panel quote-section">
            <h3>Comprobantes y costos reales</h3>
            {state.gastosProyecto

              .filter((g) => family.some((q) => q.id === g.cotizacion_id))

              .map((g) => (
                <div className="quote-line" key={g.id}>
                  <div className="quote-toolbar">
                    <strong>
                      {g.descripcion} ·{" "}
                      {g.naturaleza === "ABONO" ? "Abono − " : ""}
                      {money(g.monto, quote.presupuesto.moneda)}
                    </strong>
                    <span>{g.estado}</span>
                  </div>
                  <p>
                    {g.fecha} ·{" "}
                    {g.rubro === "MATERIALES"
                      ? "Materiales consumidos"
                      : RUBRO_LABELS[g.rubro]}{" "}
                    · {g.comprobante}
                  </p>
                  {g.cantidad != null && (
                    <p>
                      Consumo registrado: {g.cantidad} · {g.material_sku}
                    </p>
                  )}
                  {g.motivo_anulacion && <p>Motivo: {g.motivo_anulacion}</p>}
                  {writable &&
                    quote.estado === "ACEPTADA" &&
                    g.estado === "REGISTRADO" &&
                    (role === "coordinador" || g.creado_por === profile.id) && (
                      <button
                        className="btn btn-ghost"
                        onClick={() =>
                          begin({
                            title: "Anular gasto conservando historial",

                            action: "anular_gasto",

                            expense: g,
                          })
                        }
                      >
                        Anular gasto
                      </button>
                    )}
                </div>
              ))}
            {result.active.length === 0 && (
              <p>No hay costos reales activos registrados.</p>
            )}
          </section>
        </>
      )}
      {tab === "historial" && (
        <>
          <section className="panel quote-section">
            <h3>Versiones y alternativas</h3>
            <p className="quote-muted">
              Crear una versión conserva el presupuesto anterior. Una nueva
              aceptación sustituye la versión aceptada y mantiene las
              solicitudes y gastos de la misma serie.
            </p>
            {family

              .sort((a, b) => b.version - a.version)

              .map((q) => (
                <button
                  key={q.id}
                  className="btn btn-ghost"
                  aria-pressed={q.id === quote.id}
                  onClick={() => setSelected(q.id)}
                >
                  {q.codigo} · v{q.version} · {q.presupuesto.alternativa} ·{" "}
                  {ESTADO_LABELS[q.estado]}
                </button>
              ))}
          </section>
          <section className="panel quote-section">
            <h3>Historial de cambios</h3>
            {[...quote.eventos]

              .sort((a, b) => b.id - a.id)

              .map((event) => (
                <div className="quote-line" key={event.id}>
                  <strong>
                    {event.accion} ·{" "}
                    {ESTADO_LABELS[(event.estado_nuevo as EstadoCotizacion)] ??
                      event.estado_nuevo}
                  </strong>
                  <p>{event.detalle}</p>
                  <small>
                    {date(event.created_at)} · {event.usuario_nombre ?? "Usuario no disponible"}
                  </small>
                </div>
              ))}
          </section>
        </>
      )}
    </div>
  )
}
