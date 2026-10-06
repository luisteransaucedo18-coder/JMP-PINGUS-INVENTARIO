import ValidatedForm from "../../components/ValidatedForm";
import { useState } from "react"
import { useAppStore } from "../../store/AppContext"
import type { Role } from "../../domain/types"
import { money, executionSummary, type QuotePeriod } from "./domain"
import { BONOS_EXCEL } from './excelVariables';
import { operarCotizacion } from "../../services/cotizacionService"
import { Field, NumberField } from "./QuoteEditor"

export default function QuotationReport({
  role,
  onToast,
}: {
  role: Role
  onToast?: (message: string) => void
}) {
  const { state, refreshRemoteData } = useAppStore()
  const [month, setMonth] = useState(
    new Date()
      .toLocaleDateString("en-CA", { timeZone: "America/Lima" })
      .slice(0, 7),
  )
  const [currency, setCurrency] = useState<"PEN" | "USD">("PEN")
  const [edit, setEdit] = useState(false)
  const [overhead, setOverhead] = useState(0)
  const [controls, setControls] = useState<QuotePeriod['control_bonos']>({})
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const period = state.periodosCotizacion.find(
    (p) => p.periodo === `${month}-01`,
  )
  const quotes = state.cotizaciones.filter(
    (q) =>
      ["ACEPTADA", "CERRADA"].includes(q.estado) &&
      q.fecha_habilitacion?.startsWith(month) &&
      q.presupuesto.moneda === currency,
  )
  const value = (
    fise: boolean,
    key: "costos" | "ingreso" | "utilidad" | "generales",
  ) =>
    quotes
      .filter((q) => (q.presupuesto.modalidad === "FISE") === fise)
      .reduce((sum, q) => {
        const family = state.cotizaciones.filter(
          (v) => v.serie_id === q.serie_id,
        )
        const r = executionSummary(q, family, state.gastosProyecto)
        if (key === "costos") return sum + r.actual
        if (key === "ingreso") return sum + r.saleWithoutTax
        if (key === "utilidad") return sum + r.result
        return (
          sum +
          r.active
            .filter((g) => g.rubro === "FIJOS")
            .reduce(
              (a, g) => a + (g.naturaleza === "ABONO" ? -g.monto : g.monto),
              0,
            )
        )
      }, 0)
  return (
    <section className="panel quote-section">
      <h3>Variables · Fise / No Fise / Total</h3>
      <div className="quote-toolbar">
        <Field label="Período de habilitación">
          <input
            className="input-field"
            required
            type="month"
            value={month}
            onChange={(e) => {
              setMonth(e.target.value)
              setEdit(false)
            }}
          />
        </Field>
        <Field label="Moneda">
          <select
            className="select-field"
            value={currency}
            onChange={(e) => setCurrency(e.target.value as "PEN" | "USD")}
          >
            <option>PEN</option>
            <option>USD</option>
          </select>
        </Field>
      </div>
      <p className="quote-muted">
        Incluye la versión vigente de proyectos habilitados en este mes. Los
        costos y la utilidad siguen provisionales para ejecuciones abiertas.
        Gastos Generales JMP se registra en soles.
      </p>
      <div className="quote-table-wrap">
        <table className="quote-table">
          <thead>
            <tr>
              <th>Variables</th>
              <th>Fise</th>
              <th>No Fise</th>
              <th>Total</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td># Habilitadas:</td>
              <td>
                {
                  quotes.filter((q) => q.presupuesto.modalidad === "FISE")
                    .length
                }
              </td>
              <td>
                {
                  quotes.filter((q) => q.presupuesto.modalidad !== "FISE")
                    .length
                }
              </td>
              <td>{quotes.length}</td>
            </tr>
            {([
              ["generales", "Gastos Generales:"],
              ["costos", "TOTAL COSTOS (SIN IGV)"],
              ["ingreso", currency === "PEN" ? "Ingreso S/." : "Ingreso USD"],
              ["utilidad", "Utilidad:"],
            ] as const).map(([key, label]) => (
              <tr key={key}>
                <td>{label}</td>
                <td>{money(value(true, key), currency)}</td>
                <td>{money(value(false, key), currency)}</td>
                <td>{money(value(true, key) + value(false, key), currency)}</td>
              </tr>
            ))}
            <tr>
              <td>Gastos Generales JMP:</td>
              <td colSpan={3}>
                {period
                  ? money(period.gastos_generales_jmp, "PEN")
                  : "Sin registrar para este período"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="quote-muted">
        Gastos Generales: corresponde a Gastos Fijos - Costo de Proyecto,
        Cotizacion registrados. Gastos Generales JMP: es el importe global del
        mes y no se suma nuevamente a cada proyecto.
      </p>
      {!edit&&period&&Object.keys(period.control_bonos).length>0&&<details className="quote-line"><summary>BONOS POR PROYECTO · Controles registrados</summary>{Object.entries(period.control_bonos).map(([name,value])=><p key={name}>{name}: <strong>{value.control} {value.cant}</strong></p>)}</details>}
      {role === "coordinador" && !edit && (
        <button
          className="btn btn-ghost"
          onClick={() => {
            setOverhead(period?.gastos_generales_jmp ?? 0)
            setControls(period?.control_bonos ?? Object.fromEntries(BONOS_EXCEL.map(([segment,label,control,cant])=>[`${segment}:${label}`,{control,cant}])))
            setEdit(true)
            setError("")
          }}
        >
          Configurar Gastos Generales JMP y BONOS POR PROYECTO
        </button>
      )}
      {edit && (
        <ValidatedForm
          onSubmit={async (e) => {
            e.preventDefault()
            setSaving(true)
            setError("")
            try {
              await operarCotizacion("periodo", crypto.randomUUID(), {
                periodo: `${month}-01`,
                gastosGeneralesJmp: overhead,
                controlBonos: controls,
              })
              await refreshRemoteData()
              setEdit(false)
              onToast?.("Variables del período guardadas.")
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "No se pudo guardar.",
              )
            } finally {
              setSaving(false)
            }
          }}
        >
          <fieldset disabled={saving}>
            <NumberField
              label="Gastos Generales JMP: (S/.)"
              value={overhead}
              onChange={setOverhead}
            />
            <details>
              <summary>BONOS POR PROYECTO · SEGUNDO MES ADELANTE</summary>
              <p className="quote-muted">
                Configura Control y Cant como en el Excel. Son metas del período; no generan automáticamente un bono ni modifican presupuestos.
              </p>
              {["INDUSTRIAL/ GNV", "MYPES", "MULTIFAMILIAR / INMOBILIARIO"].map(
                (segment) => (
                  <div className="quote-line" key={segment}>
                    <h3>{segment}</h3>
                    <div className="quote-form-grid">
                      {BONOS_EXCEL.filter(([group])=>group===segment).map(([,label,defaultControl,defaultCant])=>{
                        const key=`${segment}:${label}`; const rule=controls[key]??{control:defaultControl,cant:defaultCant};
                        return <div key={label}><strong>{label}</strong><Field label="Control"><select className="select-field" value={rule.control} onChange={e=>setControls(c=>({...c,[key]:{...rule,control:e.target.value as '>'|'>='}}))}><option value=">">&gt;</option><option value=">=">&gt;=</option></select></Field><NumberField label="Cant" value={rule.cant} onChange={v=>setControls(c=>({...c,[key]:{...rule,cant:v}}))}/></div>;
                      })}
                    </div>
                  </div>
                ),
              )}
            </details>
            {error && (
              <p role="alert" className="quote-error">
                {error}
              </p>
            )}
            <div className="quote-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setEdit(false)}
              >
                Cancelar
              </button>
              <button className="btn btn-primary" type="submit">
                {saving ? "Guardando…" : "Guardar variables del mes"}
              </button>
            </div>
          </fieldset>
        </ValidatedForm>
      )}
    </section>
  )
}
