import { useState, type ReactNode } from "react"
import { SEDES, type Material, type Proyecto } from "../../domain/types"
import {
  calculateQuote,
  money,
  MODALIDADES,
  newBudget,
  quoteValidation,
  RUBROS,
  RUBRO_LABELS,
  type Quote,
  type QuoteBudget,
  type QuoteTemplate,
} from "./domain"
import {
  EXCEL_LABELS,
  EXCEL_MODALIDADES,
  EXCEL_PARTIDAS,
} from "./excelVariables"

export function Field({
  label,
  children,
}: {
  label: string
  children: ReactNode
}) {
  return (
    <label className="quote-field">
      <span>{label}</span>
      {children}
    </label>
  )
}
export function NumberField({
  label,
  value,
  onChange,
  max,
  min = 0,
}: {
  label: string
  value: number
  onChange: (value: number) => void
  max?: number
  min?: number
}) {
  return (
    <Field label={label}>
      <input
        className="input-field"
        type="number"
        step="any"
        min={min}
        max={max}
        required
        value={value}
        onChange={(e) =>
          onChange(e.target.value === "" ? 0 : Number(e.target.value))
        }
      />
    </Field>
  )
}
export function Totals({ budget, totals }: { budget: QuoteBudget, totals?: ReturnType<typeof calculateQuote> }) {
  const t = totals??calculateQuote(budget)
  const rows: [string, number][] = [
    [EXCEL_LABELS.materiales, t.materiales],
    ["Servicios y gastos", t.gastos],
    [EXCEL_LABELS.directo, t.costoDirecto],
    [EXCEL_LABELS.financiamiento, t.financiamiento],
    [EXCEL_LABELS.generales, t.generales],
    [EXCEL_LABELS.utilidad, t.utilidad],
    [EXCEL_LABELS.subtotal, t.subtotal],
    [EXCEL_LABELS.comision, t.comision],
    [`${EXCEL_LABELS.venta} (SIN IGV)`, t.valorVenta],
    [`IGV (${budget.tasas.igv}%):`, t.igv],
    [EXCEL_LABELS.total, t.total],
  ]
  return (
    <dl className="quote-totals">
      {rows.map(([name, amount]) => (
        <div key={name}>
          <dt>{name}</dt>
          <dd>{money(amount, budget.moneda)}</dd>
        </div>
      ))}
    </dl>
  )
}

export default function QuoteEditor({
  quote,
  template,
  projectId,
  proyectos,
  materials,
  templates,
  saving,
  onSave,
  onCancel,
  templateMode = false,
}: {
  template?: QuoteTemplate
  quote?: Quote
  projectId?: string
  proyectos: Proyecto[]
  materials: Material[]
  templates: QuoteTemplate[]
  saving: boolean
  onSave: (
    budget: QuoteBudget,
    projectId: string,
    templateName: string,
    snapshot: { revision: number, actualizadaEn?: string },
  ) => Promise<void>
  onCancel: () => void
  templateMode?: boolean
}) {
  const [snapshot] = useState(()=>({revision:quote?.revision??0,actualizadaEn:template?.updated_at}));
  const initialProject = proyectos.find(
    (p) => p.id === (quote?.proyecto_id ?? projectId),
  )
  const [selectedProject, setSelectedProject] = useState(
    quote?.proyecto_id ?? projectId ?? "",
  )
  const [budget, setBudget] = useState<QuoteBudget>(() =>
    quote
      ? structuredClone(quote.presupuesto)
      : template
        ? {
            ...newBudget(),
            ...structuredClone(template.parametros),
            modalidad: template.modalidad,
            ciudad: template.ciudad,
            tipo: template.tipo,
            puntos: template.puntos,
            tasas: structuredClone(template.tasas),
            gastos: structuredClone(template.gastos),
            tecnico: "Por definir",
            alcance: "Plantilla de tarifas",
          }
        : {
            ...newBudget(initialProject?.sede),
            ciudad: initialProject?.sede ?? "",
            tecnico:
              initialProject?.responsable ??
              (templateMode ? "Por definir" : ""),
            alcance: templateMode ? "Plantilla de tarifas" : "",
          },
  )
  const [templateName, setTemplateName] = useState(template?.nombre ?? "")
  const [templateId, setTemplateId] = useState("")
  const [sku, setSku] = useState("")
  const [errors, setErrors] = useState<string[]>([])
  const set = <K extends keyof QuoteBudget>(key: K, value: QuoteBudget[K]) =>
    setBudget((b) => ({ ...b, [key]: value }))
  const applyTemplate = () => {
    const template = templates.find((t) => t.id === templateId)
    if (!template) return
    setBudget((b) => ({
      ...b,
      ...structuredClone(template.parametros),
      modalidad: template.modalidad,
      ciudad: template.ciudad,
      tipo: template.tipo,
      puntos: template.puntos,
      tasas: { ...template.tasas },
      gastos: template.gastos.map((g) => ({ ...g, id: crypto.randomUUID() })),
    }))
  }
  const addMaterial = () => {
    const m = materials.find((m) => m.id === sku)
    if (!m) return
    set("materiales", [
      ...budget.materiales,
      {
        id: crypto.randomUUID(),
        sku: m.id,
        nombre: m.nombre,
        unidadCatalogo: m.unidad,
        unidadCotizada: m.unidad,
        cantidad: 1,
        factorStock: 1,
        costoUnitario: m.precioUnitario,
      },
    ])
    setSku("")
  }
  return (
    <form
      className="quote-editor"
      onSubmit={async (e) => {
        e.preventDefault()
        const validation = quoteValidation(budget)
        if (!templateMode && !selectedProject)
          validation.unshift("Selecciona el proyecto.")
        if (templateMode && !templateName.trim())
          validation.unshift("Indica el nombre de la plantilla.")
        setErrors(validation)
        if (validation.length) return
        try {
          await onSave(budget, selectedProject, templateName, snapshot)
        } catch (error) {
          setErrors([
            error instanceof Error ? error.message : "No se pudo guardar.",
          ])
        }
      }}
    >
      <div className="quote-toolbar">
        <h2>
          {templateMode
            ? template
              ? "Editar plantilla de tarifas"
              : "Nueva plantilla de tarifas"
            : quote
              ? `${quote.codigo} · Editar versión ${quote.version}`
              : "Nueva cotización"}
        </h2>
        <button
          type="button"
          className="btn btn-ghost"
          disabled={saving}
          onClick={onCancel}
        >
          Volver
        </button>
      </div>
      {errors.length > 0 && (
        <div role="alert" className="quote-error">
          {errors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      )}
      <fieldset disabled={saving}>
        <section className="panel quote-section">
          <h3>
            {templateMode
              ? "Identificación de la tarifa"
              : "Proyecto y alcance"}
          </h3>
          <div className="quote-form-grid">
            {templateMode ? (
              <Field label="Nombre de la plantilla">
                <input
                  className="input-field"
                  required
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                />
              </Field>
            ) : (
              <Field label="Proyecto">
                <select
                  className="select-field"
                  required
                  disabled={Boolean(quote || projectId)}
                  value={selectedProject}
                  onChange={(e) => {
                    const project = proyectos.find(
                      (p) => p.id === e.target.value,
                    )
                    setSelectedProject(e.target.value)
                    if (project)
                      setBudget((b) => ({
                        ...b,
                        sede: project.sede,
                        ciudad: project.sede,
                        tecnico: project.responsable,
                      }))
                  }}
                >
                  <option value="">Selecciona un proyecto</option>
                  {proyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre} · {p.cliente}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Hoja / modalidad del Excel">
              <select
                className="select-field"
                value={budget.modalidad}
                onChange={(e) =>
                  set("modalidad", e.target.value as QuoteBudget["modalidad"])
                }
              >
                {MODALIDADES.map((m) => (
                  <option key={m} value={m}>
                    {EXCEL_MODALIDADES[m]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label={EXCEL_LABELS.ciudad}>
              <input
                className="input-field"
                required
                value={budget.ciudad}
                onChange={(e) => set("ciudad", e.target.value)}
              />
            </Field>
            <Field label="Sede de abastecimiento">
              <select
                className="select-field"
                value={budget.sede}
                onChange={(e) =>
                  set("sede", e.target.value as QuoteBudget["sede"])
                }
              >
                {SEDES.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </Field>
            <Field label={EXCEL_LABELS.tipo}>
              <select
                className="select-field"
                value={budget.tipo}
                onChange={(e) =>
                  set("tipo", e.target.value as QuoteBudget["tipo"])
                }
              >
                <option value="TIPICO">TIPICO</option>
                <option value="NO_TIPICO">NO TIPICO</option>
              </select>
            </Field>
            <NumberField
              label={EXCEL_LABELS.puntos}
              value={budget.puntos}
              min={1}
              max={10000}
              onChange={(v) => set("puntos", v)}
            />
            <Field label="DEPARTAMENTO">
              <input
                className="input-field"
                value={budget.excel.departamento}
                onChange={(e) =>
                  set("excel", {
                    ...budget.excel,
                    departamento: e.target.value,
                  })
                }
              />
            </Field>
            <Field label="CONSECION">
              <input
                className="input-field"
                placeholder="GDP / GDN"
                value={budget.excel.concesion}
                onChange={(e) =>
                  set("excel", { ...budget.excel, concesion: e.target.value })
                }
              />
            </Field>
            <Field label="Moneda de toda la cotización">
              <select
                className="select-field"
                value={budget.moneda}
                onChange={(e) =>
                  set("moneda", e.target.value as QuoteBudget["moneda"])
                }
              >
                <option value="PEN">Soles (PEN)</option>
                <option value="USD">Dólares (USD)</option>
              </select>
            </Field>
            <NumberField
              label="Tipo de cambio de referencia (PEN por USD)"
              value={budget.tipoCambio}
              min={0.000001}
              onChange={(v) => set("tipoCambio", v)}
            />
            <Field label="Vigencia hasta">
              <input
                className="input-field"
                type="date"
                required
                value={budget.vigencia}
                onChange={(e) => set("vigencia", e.target.value)}
              />
            </Field>
            <Field label="Técnico responsable">
              <input
                className="input-field"
                required
                value={budget.tecnico}
                onChange={(e) => set("tecnico", e.target.value)}
              />
            </Field>
            <Field label="Nombre de la propuesta o alternativa">
              <input
                className="input-field"
                value={budget.alternativa}
                onChange={(e) => set("alternativa", e.target.value)}
              />
            </Field>
          </div>
          <Field label="Alcance de los trabajos">
            <textarea
              className="input-field"
              rows={3}
              required
              value={budget.alcance}
              onChange={(e) => set("alcance", e.target.value)}
            />
          </Field>
          <Field label="Condiciones comerciales, pagos y exclusiones">
            <textarea
              className="input-field"
              rows={2}
              value={budget.condiciones}
              onChange={(e) => set("condiciones", e.target.value)}
            />
          </Field>
        </section>
        <section className="panel quote-section">
          <h3>Variables del Excel · {EXCEL_MODALIDADES[budget.modalidad]}</h3>
          <p className="quote-muted">
            Los nombres conservan las etiquetas del Excel. Agrega únicamente las
            partidas que correspondan al proyecto; cada una se suma una vez al
            costo directo.
          </p>
          <div className="quote-form-grid">
            {(["muretesCachimbo", "muretesValvula"] as const).map((key) => (
              <Field
                key={key}
                label={
                  key === "muretesCachimbo"
                    ? EXCEL_LABELS.mureteCachimbo
                    : EXCEL_LABELS.mureteValvula
                }
              >
                <select
                  className="select-field"
                  value={budget.excel[key]}
                  onChange={(e) =>
                    set("excel", {
                      ...budget.excel,
                      [key]: e.target.value as "SI" | "NO",
                    })
                  }
                >
                  <option>NO</option>
                  <option>SI</option>
                </select>
              </Field>
            ))}
            <NumberField
              label="DIAS PROYECTADOS"
              max={10000}
              value={budget.excel.diasProyectados}
              onChange={(v) =>
                set("excel", { ...budget.excel, diasProyectados: v })
              }
            />
          </div>
          {Array.from(
            new Set(
              EXCEL_PARTIDAS.filter((p) =>
                p.modalidades.includes(budget.modalidad),
              ).map((p) => p.group),
            ),
          ).map((group) => (
            <details key={group} className="quote-line">
              <summary>{group}</summary>
              {EXCEL_PARTIDAS.filter(
                (p) =>
                  p.group === group && p.modalidades.includes(budget.modalidad),
              ).map((p) => (
                <div key={p.key} className="quote-toolbar quote-variable">
                  <div>
                    <strong>{p.label}</strong>
                    <small>{p.hojas}</small>
                  </div>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    disabled={budget.gastos.some(
                      (g) => g.variableExcel === p.key,
                    )}
                    onClick={() =>
                      set("gastos", [
                        ...budget.gastos,
                        {
                          id: crypto.randomUUID(),
                          rubro: p.rubro,
                          descripcion: p.label,
                          variableExcel: p.key,
                          cantidad: [
                            "hospedaje",
                            "alimentacion",
                            "altura",
                          ].includes(p.key)
                            ? budget.excel.diasProyectados || 1
                            : 1,
                          costoUnitario: 0,
                        },
                      ])
                    }
                  >
                    {budget.gastos.some((g) => g.variableExcel === p.key)
                      ? "Agregada"
                      : "Agregar costo"}
                  </button>
                </div>
              ))}
            </details>
          ))}
          <details className="quote-line">
            <summary>PROPUETA PROVEEDOR · Programación del trabajo</summary>
            <div className="quote-form-grid">
              {(["plazo", "dia", "horario", "tiempo"] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      plazo: "PLAZO",
                      dia: "Dia",
                      horario: "Horario",
                      tiempo: "Tiempo",
                    }[key]
                  }
                >
                  <input
                    className="input-field"
                    value={budget.excel[key]}
                    onChange={(e) =>
                      set("excel", { ...budget.excel, [key]: e.target.value })
                    }
                  />
                </Field>
              ))}
            </div>
          </details>
          <details className="quote-line">
            <summary>Bono Administrativo: y caja chica</summary>
            <Field label="Administracion de caja Chica">
              <input
                className="input-field"
                placeholder="Nombre del comercio"
                value={budget.excel.cajaChica}
                onChange={(e) =>
                  set("excel", { ...budget.excel, cajaChica: e.target.value })
                }
              />
            </Field>
            <Field label="Condición del Bono Administrativo">
              <span>
                <input
                  type="checkbox"
                  checked={budget.excel.bonoCondicionado}
                  onChange={(e) =>
                    set("excel", {
                      ...budget.excel,
                      bonoCondicionado: e.target.checked,
                    })
                  }
                />{" "}
                Asignado posterior a la habilitacion, manteniendo costos
                presupuestados; la desviacion se toma del Bono.
              </span>
            </Field>
          </details>
        </section>
        {!templateMode && (
          <section className="panel quote-section">
            <h3>Aplicar tarifas configuradas</h3>
            <p className="quote-muted">
              La plantilla reemplaza servicios y porcentajes del borrador. Las
              versiones guardan una copia de las tarifas utilizadas.
            </p>
            <div className="quote-toolbar">
              <Field label="Plantilla">
                <select
                  className="select-field"
                  value={templateId}
                  onChange={(e) => setTemplateId(e.target.value)}
                >
                  <option value="">Selecciona una plantilla</option>
                  {templates.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nombre} · {t.ciudad} · {t.puntos} puntos
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                disabled={!templateId}
                className="btn btn-ghost"
                onClick={applyTemplate}
              >
                Aplicar plantilla
              </button>
            </div>
          </section>
        )}
        {!templateMode && (
          <section className="panel quote-section">
            <h3>Materiales del catálogo</h3>
            <p className="quote-muted">
              Revisa el costo referencial antes de cotizar. Todos los costos se
              expresan sin IGV en {budget.moneda}; el tipo de cambio es una
              referencia y no convierte precios automáticamente.
            </p>
            <div className="quote-toolbar">
              <Field label="Buscar material">
                <select
                  className="select-field"
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
                >
                  <option value="">Selecciona material</option>
                  {materials.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.id} · {m.nombre} ({m.unidad})
                    </option>
                  ))}
                </select>
              </Field>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={!sku}
                onClick={addMaterial}
              >
                Agregar material
              </button>
            </div>
            {budget.materiales.map((m, index) => (
              <div key={m.id} className="quote-line">
                <strong>
                  {m.nombre} <small>({m.sku})</small>
                </strong>
                <div className="quote-form-grid">
                  <NumberField
                    label="CANTIDAD"
                    min={0.000001}
                    value={m.cantidad}
                    onChange={(v) =>
                      set(
                        "materiales",
                        budget.materiales.map((x, i) =>
                          i === index ? { ...x, cantidad: v } : x,
                        ),
                      )
                    }
                  />
                  <Field label="UND">
                    <input
                      className="input-field"
                      required
                      value={m.unidadCotizada}
                      onChange={(e) =>
                        set(
                          "materiales",
                          budget.materiales.map((x, i) =>
                            i === index
                              ? { ...x, unidadCotizada: e.target.value }
                              : x,
                          ),
                        )
                      }
                    />
                  </Field>
                  <NumberField
                    label={`Unidades ${m.unidadCatalogo} por unidad cotizada`}
                    min={0.000001}
                    value={m.factorStock}
                    onChange={(v) =>
                      set(
                        "materiales",
                        budget.materiales.map((x, i) =>
                          i === index ? { ...x, factorStock: v } : x,
                        ),
                      )
                    }
                  />
                  <NumberField
                    label={`PRECIO (${budget.moneda}, SIN IGV)`}
                    value={m.costoUnitario}
                    onChange={(v) =>
                      set(
                        "materiales",
                        budget.materiales.map((x, i) =>
                          i === index ? { ...x, costoUnitario: v } : x,
                        ),
                      )
                    }
                  />
                </div>
                <div className="quote-toolbar">
                  <span>
                    Stock a solicitar: {m.cantidad * m.factorStock}{" "}
                    {m.unidadCatalogo} · Costo:{" "}
                    {money(m.cantidad * m.costoUnitario, budget.moneda)}
                  </span>
                  <button
                    className="btn btn-ghost"
                    type="button"
                    aria-label={`Quitar ${m.nombre}`}
                    onClick={() =>
                      set(
                        "materiales",
                        budget.materiales.filter((_, i) => i !== index),
                      )
                    }
                  >
                    Quitar
                  </button>
                </div>
              </div>
            ))}
          </section>
        )}
        <section className="panel quote-section">
          <div className="quote-toolbar">
            <h3>Servicios y otros costos sin IGV</h3>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() =>
                set("gastos", [
                  ...budget.gastos,
                  {
                    id: crypto.randomUUID(),
                    rubro: "MANO_OBRA",
                    descripcion: "",
                    cantidad: 1,
                    costoUnitario: 0,
                  },
                ])
              }
            >
              Agregar partida
            </button>
          </div>
          {budget.gastos.map((g, index) => (
            <div className="quote-line" key={g.id}>
              <div className="quote-form-grid">
                <Field label="Rubro">
                  <select
                    className="select-field"
                    value={g.rubro}
                    disabled={Boolean(g.variableExcel)}
                    onChange={(e) =>
                      set(
                        "gastos",
                        budget.gastos.map((x, i) =>
                          i === index
                            ? { ...x, rubro: e.target.value as typeof g.rubro }
                            : x,
                        ),
                      )
                    }
                  >
                    {RUBROS.filter(r=>!['FINANCIAMIENTO','GENERALES','COMISION'].includes(r)).map((r) => (
                      <option key={r} value={r}>
                        {RUBRO_LABELS[r]}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field
                  label={
                    g.variableExcel
                      ? (EXCEL_PARTIDAS.find((p) => p.key === g.variableExcel)
                          ?.label ?? "Descripción")
                      : "Descripción"
                  }
                >
                  <input
                    className="input-field"
                    required
                    readOnly={Boolean(g.variableExcel)}
                    value={g.descripcion}
                    onChange={(e) =>
                      set(
                        "gastos",
                        budget.gastos.map((x, i) =>
                          i === index
                            ? { ...x, descripcion: e.target.value }
                            : x,
                        ),
                      )
                    }
                  />
                </Field>
                <NumberField
                  label="Cantidad"
                  min={0.000001}
                  value={g.cantidad}
                  onChange={(v) =>
                    set(
                      "gastos",
                      budget.gastos.map((x, i) =>
                        i === index ? { ...x, cantidad: v } : x,
                      ),
                    )
                  }
                />
                <NumberField
                  label={`Costo unitario (${budget.moneda})`}
                  value={g.costoUnitario}
                  onChange={(v) =>
                    set(
                      "gastos",
                      budget.gastos.map((x, i) =>
                        i === index ? { ...x, costoUnitario: v } : x,
                      ),
                    )
                  }
                />
              </div>
              <div className="quote-toolbar">
                <span>
                  {money(g.cantidad * g.costoUnitario, budget.moneda)}
                </span>
                <button
                  className="btn btn-ghost"
                  type="button"
                  aria-label={`Quitar partida ${index + 1}`}
                  onClick={() =>
                    set(
                      "gastos",
                      budget.gastos.filter((_, i) => i !== index),
                    )
                  }
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </section>
        <section className="panel quote-section">
          <h3>Porcentajes y financiamiento</h3>
          <p className="quote-muted">
            Utilidad y gastos generales se aplican al costo directo. La comisión
            se aplica al subtotal; en FISE se aplica al ingreso del convenio.
          </p>
          <div className="quote-form-grid">
            {([
              ["utilidad", "Utilidad (%):"],
              ["generales", "GASTOS GENERALES (%)"],
              ["comision", "Comision Venta (%):"],
              ["igv", "IGV (%):"],
              ["financiamientoMensual", "GASTOS DE FINANCIAMIENTO: (%/MES)"],
              ["meses", "MESES DE FINANCIAMIENTO"],
            ] as const).filter(([key])=>budget.modalidad!=='FISE'||key!=='utilidad').map(([key, label]) => (
              <NumberField
                key={key}
                label={label}
                max={key === "meses" ? 120 : 100}
                value={budget.tasas[key]}
                onChange={(v) => set("tasas", { ...budget.tasas, [key]: v })}
              />
            ))}
          </div>
        </section>
        {budget.modalidad === "FISE" && (
          <section className="panel quote-section">
            <h3>Convenio FISE</h3>
            <div className="quote-form-grid">
              {([
                "configuracion",
                "configuracionInterna",
                "instalacion",
                "acometida",
              ] as const).map((key) => (
                <Field
                  key={key}
                  label={
                    {
                      configuracion: "Configuración FISE",
                      configuracionInterna: "Configuración interna",
                      instalacion: "Instalación interna",
                      acometida: "Acometida",
                    }[key]
                  }
                >
                  <input
                    className="input-field"
                    required
                    placeholder={
                      key === "instalacion"
                        ? "A LA VISTA / EMPOTRADA"
                        : key === "acometida"
                          ? "G4 / G6 - MURETE EXISTENTE / CONSTRUIDO"
                          : undefined
                    }
                    value={budget.fise[key]}
                    onChange={(e) =>
                      set("fise", { ...budget.fise, [key]: e.target.value })
                    }
                  />
                </Field>
              ))}
              <Field label="Presión de artefactos (23 - 340)">
                <input
                  className="input-field"
                  required
                  list="excel-presiones-fise"
                  placeholder="Ej. 23 - 340 (una presión por punto)"
                  value={budget.fise.presionArtefactos}
                  onChange={(e) =>
                    set("fise", {
                      ...budget.fise,
                      presionArtefactos: e.target.value,
                    })
                  }
                />
                <datalist id="excel-presiones-fise">{['23','340','23 - 23','23 - 340','340 - 340','23 - 23 - 23','23 - 23 - 340','23 - 340 - 340','340 - 340 - 340'].map(p=><option key={p} value={p}/>)}</datalist>
                <small>Presiones en mbar. Conserva el orden de los puntos de consumo de la configuración.</small>
              </Field>
              <NumberField
                label="INGRESO CONVENIO FISE (SIN IGV)"
                min={0.01}
                value={budget.fise.ingresoSinIgv}
                onChange={(v) =>
                  set("fise", { ...budget.fise, ingresoSinIgv: v })
                }
              />
            </div>
          </section>
        )}
        <section className="panel quote-section">
          <h3>Resumen del cálculo</h3>
          <Totals budget={budget} />
          {calculateQuote(budget).utilidad < 0 && (
            <p role="status" className="quote-error">
              El ingreso FISE no cubre los costos y márgenes previstos.
            </p>
          )}
        </section>
        <div className="quote-toolbar">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-primary" type="submit">
            {saving
              ? "Guardando…"
              : templateMode
                ? "Guardar plantilla"
                : "Guardar borrador"}
          </button>
        </div>
      </fieldset>
    </form>
  )
}
