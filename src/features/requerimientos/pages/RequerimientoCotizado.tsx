import { useState } from "react"

import { useAppStore } from "../../../store/AppContext"

import { useUserProfile } from "../../../store/UserProfileContext"

import { operarCotizacion } from "../../../services/cotizacionService"

import { remainingMaterial } from "../../cotizaciones/domain"

import { Field } from "../../cotizaciones/QuoteEditor"
import NumericInput from "../../../components/NumericInput"

export default function RequerimientoCotizado({
  onToast,
  onNav,
}: {
  onToast: (message: string) => void
  onNav: (view: string) => void
}) {
  const { state, refreshRemoteData } = useAppStore()

  const { profile } = useUserProfile()

  const [selected, setSelected] = useState("")

  const [amounts, setAmounts] = useState<Record<string, number>>({})

  const [saving, setSaving] = useState(false)

  const [error, setError] = useState("")

  const [requestId, setRequestId] = useState(() => crypto.randomUUID())

  const [expectedRevision, setExpectedRevision] = useState(0)

  const quotes = state.cotizaciones.filter(
    (q) => q.estado === "ACEPTADA" && q.creado_por === profile.id,
  )

  const quote = quotes.find((q) => q.id === selected)

  const family = quote
    ? state.cotizaciones.filter((q) => q.serie_id === quote.serie_id)
    : []

  const items = Object.entries(amounts)
    .filter(([, quantity]) => quantity > 0)
    .map(([itemId, cantidad]) => ({ itemId, cantidad }))

  return (
    <div className="quote-view">
      <div className="quote-toolbar">
        <div>
          <h2>Nuevo requerimiento</h2>
          <p className="quote-muted">
            Solicita por etapas los materiales que el cliente aceptó.
          </p>
        </div>
        <button
          className="btn btn-ghost"
          onClick={() => onNav("nueva-cotizacion")}
        >
          Cotizar un nuevo proyecto
        </button>
      </div>
      {state.cotizacionesError && (
        <p role="alert" className="quote-error">
          {state.cotizacionesError}
        </p>
      )}
      <section className="panel quote-section">
        <h3>1. Selecciona el proyecto</h3>
        <Field label="Proyecto con cotización aceptada">
          <select
            className="select-field"
            disabled={saving}
            value={selected}
            onChange={(e) => {
              setSelected(e.target.value)
              setAmounts({})
              setError("")
              setRequestId(crypto.randomUUID())
              setExpectedRevision(
                quotes.find((q) => q.id === e.target.value)?.revision ?? 0,
              )
            }}
          >
            <option value="">Selecciona un proyecto</option>
            {quotes.map((q) => (
              <option key={q.id} value={q.id}>
                {q.proyecto_snapshot.nombre} · {q.codigo} v{q.version}
              </option>
            ))}
          </select>
        </Field>
        {!quotes.length && (
          <p className="quote-muted">
            Primero prepara una cotización y registra la aceptación del cliente.
            El proyecto aparecerá aquí automáticamente.
          </p>
        )}
        {quote && (
          <div className="quote-note">
            <strong>{quote.proyecto_snapshot.cliente}</strong>
            <p>
              {quote.proyecto_snapshot.ubicacion} · {quote.presupuesto.sede}
            </p>
            <p>Técnico: {quote.presupuesto.tecnico}</p>
          </div>
        )}
      </section>
      {quote && (
        <form
          onSubmit={async (e) => {
            e.preventDefault()
            if (saving) return
            if (!items.length) {
              setError("Selecciona al menos un material e indica su cantidad.")
              return
            }
            setSaving(true)
            setError("")
            try {
              await operarCotizacion("requerimiento", quote.id, {
                revision: expectedRevision,
                requerimientoId: requestId,
                items,
              })
              await refreshRemoteData()
              onToast("Requerimiento enviado al coordinador.")
              onNav("mis-solicitudes")
            } catch (error) {
              setError(
                error instanceof Error ? error.message : "No se pudo enviar.",
              )
            } finally {
              setSaving(false)
            }
          }}
        >
          <fieldset disabled={saving}>
            <section className="panel quote-section">
              <h3>2. Elige los materiales cotizados</h3>
              <p className="quote-muted">
                Marca únicamente lo que necesitas para esta etapa. Las
                cantidades están expresadas en la unidad de inventario.
              </p>
              {quote.presupuesto.materiales.map((m) => {
                const remaining = remainingMaterial(
                  m,
                  family,
                  state.requerimientos,
                )
                return (
                  <div key={m.id} className="quote-review-item">
                    <label>
                      <input
                        type="checkbox"
                        disabled={remaining <= 0}
                        checked={(amounts[m.id] ?? 0) > 0}
                        onChange={(e) =>
                          setAmounts((a) => ({
                            ...a,
                            [m.id]: e.target.checked
                              ? Math.min(1, remaining)
                              : 0,
                          }))
                        }
                      />{" "}
                      <strong>{m.nombre}</strong>
                      <small className="quote-muted">
                        {" "}
                        · {m.sku} · disponible {remaining} {m.unidadCatalogo}
                      </small>
                    </label>
                    <Field label={`Cantidad de ${m.nombre}`}>
                      <NumericInput
                        className="input-field"
                        min={0}
                        max={remaining}
                        value={amounts[m.id] ?? 0}
                        onValueChange={(value) =>
                          setAmounts((a) => ({
                            ...a,
                            [m.id]: value,
                          }))
                        }
                      />
                    </Field>
                  </div>
                )
              })}
              {!quote.presupuesto.materiales.length && (
                <p>
                  Esta cotización no incluye materiales de inventario. Edita la
                  cotización y registra la nueva aceptación del cliente para
                  agregarlos.
                </p>
              )}
            </section>
            <section className="panel quote-section">
              <h3>3. Envía esta etapa</h3>
              <p>
                {items.length} materiales seleccionados. La revisión de stock y
                el abastecimiento continúan con el coordinador.
              </p>
              {error && (
                <p role="alert" className="quote-error">
                  {error}
                </p>
              )}
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!items.length}
              >
                {saving ? "Enviando…" : "Enviar requerimiento"}
              </button>
            </section>
          </fieldset>
        </form>
      )}
    </div>
  )
}
