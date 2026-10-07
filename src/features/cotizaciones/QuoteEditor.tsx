import QuoteMaterialLabel from './QuoteMaterialLabel'
import { Children, cloneElement, isValidElement, useContext, useEffect, useId, useRef, useState, type ReactNode, type ReactElement } from "react"
import { collectFieldIssues, type FieldIssue } from '../../utils/formValidation'

import { FieldValidationContext as ValidationContext } from '../../components/FieldValidationContext'

import { SEDES, type Material, type Proyecto } from "../../domain/types"

import ExpandingTextField from "../../components/ExpandingTextField"

import ProjectAddressField from "../../components/ProjectAddressField"

import NumericInput from "../../components/NumericInput"

import {
  DEPARTAMENTOS,
  provincesForDepartment,
  districtsForProvince,
  resolveLegacyLocation,
  departmentForCity,
  validPeruLocation,
} from "./locations"

import { searchMaterials } from "../../utils/materialSearch"

import {
  calculateQuote,
  money,
  MODALIDADES,
  newBudget,
  defaultQuoteRates,
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
  error: explicitError,

  children,
}: {
  label: string
  error?: string

  children: ReactNode
}) {
  const generatedId = useId()
  const errors = useContext(ValidationContext)
  const child = Children.toArray(children).find(isValidElement) as ReactElement<{ id?: string }> | undefined
  const id = child?.props.id ?? generatedId
  const error = explicitError ?? errors[id]
  return (
    <div className="quote-field" data-field-label={label}>
      <label className="quote-field-label">
      <span>{label}</span>
      {Children.map(children, node => isValidElement(node) && (typeof node.type !== 'string' || ['input','select','textarea'].includes(node.type))
        ? cloneElement(node as ReactElement<{ id?: string; 'aria-invalid'?: boolean; 'aria-describedby'?: string }>, { id, 'aria-invalid': error ? true : undefined, 'aria-describedby': error ? `${id}-error` : undefined }) : node)}
      </label>
      {error && <small id={`${id}-error`} className="field-validation-message">{error}</small>}
    </div>
  )
}

Object.assign(Field, { inlineValidationField: true })

export function NumberField({
  label,

  value,

  onChange,

  max,

  min = 0,

  integer = false,
}: {
  label: string

  value: number

  onChange: (value: number) => void

  max?: number

  min?: number

  integer?: boolean
}) {
  return (
    <Field label={label}>
      <NumericInput
        className="input-field"
        min={min}
        max={max}
        required
        integer={integer}
        value={value}
        onValueChange={onChange}
      />
    </Field>
  )
}

export function Totals({
  budget,

  totals,
}: {
  budget: QuoteBudget

  totals?: ReturnType<typeof calculateQuote>
}) {
  const t = totals ?? calculateQuote(budget)

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

  saving: boolean

  onSave: (
    budget: QuoteBudget,

    projectId: string,

    templateName: string,

    snapshot: {
      revision: number

      actualizadaEn?: string

      proyecto: Quote["proyecto_snapshot"]
    },
  ) => Promise<void>

  onCancel: () => void

  templateMode?: boolean
}) {
  const [snapshot] = useState(() => ({
    revision: quote?.revision ?? 0,

    actualizadaEn: template?.updated_at,
  }))

  const [step, setStep] = useState(0)

  const stepHeading = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    stepHeading.current?.focus()

    stepHeading.current?.scrollIntoView({ block: "start" })
  }, [step])

  const initialProject = proyectos.find(
    (p) => p.id === (quote?.proyecto_id ?? projectId),
  )

  const [selectedProject] = useState(
    quote?.proyecto_id ?? projectId ?? "",
  )

  const [project, setProject] = useState<Quote["proyecto_snapshot"]>(
    () =>
      quote?.proyecto_snapshot ?? {
        nombre: initialProject?.nombre ?? "",

        cliente: initialProject?.cliente ?? "",

        ubicacion: initialProject?.ubicacion ?? "",

        responsable: initialProject?.responsable ?? "",
      },
  )

  const steps = [
    templateMode ? "Datos de la tarifa" : "Datos del proyecto",

    "Materiales",

    "Costos y servicios",

    "Condiciones y márgenes",

    templateMode ? "Revisar tarifa" : "Revisar cotización",
  ]

  const [budget, setBudget] = useState<QuoteBudget>(() => {
    const initial = quote
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
          }

    if (!DEPARTAMENTOS.includes(initial.excel.departamento))
      initial.excel.departamento = departmentForCity(initial.ciudad)

    if (!initial.excel.provincia || !initial.excel.distrito) {
      const legacy = resolveLegacyLocation(initial.excel.departamento, initial.ciudad)
      initial.excel.provincia ??= legacy.provincia
      initial.excel.distrito ??= legacy.distrito
      // New budgets have empty fields; infer only unambiguous historic locations.
      if (!initial.excel.provincia && !initial.excel.distrito) Object.assign(initial.excel, legacy)
    }
    if (initial.excel.distrito) initial.ciudad = initial.excel.distrito
    return initial
  })

  const [templateName, setTemplateName] = useState(template?.nombre ?? "")

  const [materialQuery, setMaterialQuery] = useState("")

  const [editedRates, setEditedRates] = useState<Record<string, boolean>>(() =>
    quote
      ? Object.fromEntries(
          Object.keys(quote.presupuesto.tasas).map((key) => [key, true]),
        )
      : {},
  )

  const [errors, setErrors] = useState<string[]>([])
  const form = useRef<HTMLFormElement>(null)
  const [fieldIssues, setFieldIssues] = useState<FieldIssue[]>([])
  const [validationAttempted, setValidationAttempted] = useState(false)
  const [focusIssue, setFocusIssue] = useState<string | null>(null)
  useEffect(() => {
    if (!focusIssue) return
    const control = document.getElementById(focusIssue)
    control?.focus()
    control?.scrollIntoView({ block: 'center', behavior: 'auto' })
    setFocusIssue(null)
  }, [focusIssue, step])
  const validateFields = (currentStep?: number) => {
    const issues = form.current ? collectFieldIssues(form.current, currentStep) : []
    setValidationAttempted(true)
    setFieldIssues(issues)
    if (issues.length) { setStep(issues[0].step); setFocusIssue(issues[0].id) }
    return issues
  }

  const set = <K extends keyof QuoteBudget>(key: K, value: QuoteBudget[K]) =>
    setBudget((b) => ({ ...b, [key]: value }))

  const addMaterial = (sku: string) => {
    const m = materials.find((m) => m.id === sku)

    if (!m || budget.materiales.some((item) => item.sku === sku)) return

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

    setMaterialQuery("")
  }

  const nextStep = () => {
    if (validateFields(step).length) { setErrors([]); return }
    const messages: string[] = []

    if (step === 0) {
      if (!validPeruLocation(budget.excel.departamento, budget.excel.provincia ?? "", budget.excel.distrito ?? ""))
        messages.push("Selecciona departamento, provincia y distrito de sus listados.")

    }

    if (step === 2 && !budget.materiales.length && !budget.gastos.length)
      messages.push(
        "Agrega al menos un material o costo para cotizar.",
      )

    if (step === 3) messages.push(...quoteValidation(budget))

    setErrors(messages)

    if (!messages.length) { setValidationAttempted(false); setFieldIssues([]); setStep((s) => s + 1) }
  }

  return (
    <ValidationContext.Provider value={Object.fromEntries(fieldIssues.map(issue => [issue.id, issue.message]))}><form
      ref={form}
      onChangeCapture={() => {
        if (!validationAttempted) return
        requestAnimationFrame(() => { if (form.current) setFieldIssues(collectFieldIssues(form.current, step)) })
        setErrors([])
      }}
      className="quote-editor"
      noValidate
      onSubmit={async (e) => {
        e.preventDefault()

        if (saving) return

        if (step < steps.length - 1) {
          nextStep()
          return
        }

        const validation = quoteValidation(budget)
        if (validateFields().length) { setErrors([]); return }

        if (!validPeruLocation(budget.excel.departamento, budget.excel.provincia ?? "", budget.excel.distrito ?? ""))
          validation.unshift("Selecciona departamento, provincia y distrito válidos.")

        if (!templateMode) for (const [key, label] of [['nombre','Nombre del proyecto'],['cliente','Cliente'],['ubicacion','Dirección del proyecto'],['responsable','Responsable del proyecto']] as const) {
          if (!project[key].trim()) validation.unshift(`${label}: completa este campo.`)
        }

        if (templateMode && !templateName.trim())
          validation.unshift("Indica el nombre de la plantilla.")

        setErrors(validation)

        if (validation.length) return

        try {
          await onSave(budget, quote ? selectedProject : "", templateName, {
            ...snapshot,

            proyecto: project,
          })
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
      <nav aria-label="Pasos de la cotización" className="quote-steps">
        {steps.map((name, index) => (
          <div
            key={name}
            aria-current={step === index ? "step" : undefined}
            className={step === index ? "quote-step active" : "quote-step"}
          >
            <span>{index + 1}</span>
            <strong>{name}</strong>
          </div>
        ))}
      </nav>
      <div className="quote-step-intro">
        <p>
          Paso {step + 1} de {steps.length}
        </p>
        <h2 ref={stepHeading} tabIndex={-1}>
          {steps[step]}
        </h2>
        <p>
          {
            [
              templateMode
                ? "Identifica la tarifa, su ubicación en Perú y modalidad. Los analistas podrán aplicarla a sus cotizaciones."
                : "Describe el trabajo y el cliente. El proyecto se creará cuando el cliente acepte la cotización.",

              "Configura el presupuesto y selecciona los materiales del catálogo con sus cantidades y precios.",

              "Agrega las partidas, costos y servicios que correspondan al proyecto.",

              "Define los porcentajes, el financiamiento y los datos del convenio, si aplica.",

              templateMode
                ? "Revisa los costos y porcentajes antes de guardar la tarifa."
                : "Revisa el presupuesto antes de guardarlo. Podrás presentarlo al cliente sin aprobación del coordinador.",
            ][step]
          }
        </p>
      </div>
      {errors.length > 0 && <div role="alert" className="quote-error">
        {[...new Set(errors)].map(error => <p key={error}>{error}</p>)}
      </div>}
      <fieldset disabled={saving}>
        <div hidden={step !== 0} data-form-step="0">
          <section className="panel quote-section">
            <h3>
              {templateMode
                ? "Identificación de la tarifa"
                : "Proyecto y alcance"}
            </h3>
            <div className="quote-form-grid">
              {templateMode ? (
                <Field label="Nombre de la plantilla">
                  <ExpandingTextField
                    className="input-field"
                    required
                    value={templateName}
                    onChange={(e) => setTemplateName(e.target.value)}
                  />
                </Field>
              ) : (
                ([
                  "nombre",

                  "cliente",

                  "responsable",
                ] as const).map((key) => (
                  <Field
                    key={key}
                    label={
                      {
                        nombre: "Nombre del proyecto",

                        cliente: "Cliente",

                        responsable: "Responsable del proyecto",
                      }[key]
                    }
                  >
                    <ExpandingTextField
                      className="input-field"
                      required
                      readOnly={Boolean(quote?.proyecto_id)}
                      value={project[key]}
                      onChange={(e) => {
                        setProject((p) => ({ ...p, [key]: e.target.value }))

                        if (key === "responsable")
                          set("tecnico", e.target.value)
                      }}
                    />
                  </Field>
                ))
              )}
              <Field label="Departamento">
                <select
                  aria-label="Departamento"
                  className="select-field"
                  required
                  value={budget.excel.departamento}
                  onChange={(e) =>
                    setBudget((b) => ({
                      ...b,
                      ciudad: "",
                      excel: { ...b.excel, departamento: e.target.value, provincia: "", distrito: "" },
                    }))
                  }
                >
                  <option value="">Selecciona un departamento</option>
                  {DEPARTAMENTOS.map((d) => (
                    <option key={d}>{d}</option>
                  ))}
                </select>
              </Field>
              <Field label="Provincia">
                <select
                  aria-label="Provincia"
                  className="select-field"
                  required
                  disabled={!budget.excel.departamento}
                  value={budget.excel.provincia ?? ""}
                  onChange={(e) => setBudget((b) => ({
                    ...b,
                    ciudad: "",
                    excel: { ...b.excel, provincia: e.target.value, distrito: "" },
                  }))}
                >
                  <option value="">{budget.excel.departamento ? "Selecciona una provincia" : "Primero selecciona el departamento"}</option>
                  {provincesForDepartment(budget.excel.departamento).map((p) => <option key={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Distrito">
                <select
                  aria-label="Distrito"
                  className="select-field"
                  required
                  disabled={!budget.excel.provincia}
                  value={budget.excel.distrito ?? ""}
                  onChange={(e) => {
                    const distrito = e.target.value
                    setBudget((b) => ({
                      ...b,
                      ciudad: distrito,
                      excel: { ...b.excel, distrito },
                      tasas: {
                        ...b.tasas,
                        comision: editedRates.comision ? b.tasas.comision
                          : defaultQuoteRates(b.modalidad, distrito, b.excel.departamento).comision,
                      },
                    }))
                  }}
                >
                  <option value="">{budget.excel.provincia ? "Selecciona un distrito" : "Primero selecciona la provincia"}</option>
                  {districtsForProvince(budget.excel.departamento, budget.excel.provincia ?? "").map((d) => <option key={d.ubigeo} value={d.nombre}>{d.nombre}</option>)}
                </select>
              </Field>
              {!templateMode && <ProjectAddressField
                error={fieldIssues.find(issue => issue.id === 'project-address')?.message}
                value={project.ubicacion}
                onChange={ubicacion => setProject(p => ({ ...p, ubicacion }))}
                departamento={budget.excel.departamento}
                provincia={budget.excel.provincia ?? ""}
                distrito={budget.excel.distrito ?? ""}
                readOnly={Boolean(quote?.proyecto_id)}
              />}
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
              <Field label="Técnico responsable">
                <ExpandingTextField
                  className="input-field"
                  required
                  value={budget.tecnico}
                  onChange={(e) => set("tecnico", e.target.value)}
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
          </section>
        </div>
        <div hidden={step !== 1} data-form-step="1">
          <section className="panel quote-section">
            <h3>Configuración del presupuesto</h3>
            <div className="quote-form-grid">
              <Field label="Hoja / modalidad del Excel">
                <select
                  className="select-field"
                  value={budget.modalidad}
                  onChange={(e) =>
                    setBudget((b) => {
                      const modalidad = e.target
                        .value as QuoteBudget["modalidad"]
                      const defaults = defaultQuoteRates(
                        modalidad,
                        b.ciudad,
                        b.excel.departamento,
                      )
                      return {
                        ...b,
                        modalidad,
                        tasas: Object.fromEntries(
                          Object.entries(defaults).map(([key, value]) => [
                            key,
                            editedRates[key]
                              ? b.tasas[(key as keyof typeof b.tasas)]
                              : value,
                          ]),
                        ) as typeof b.tasas,
                      }
                    })
                  }
                >
                  {MODALIDADES.map((m) => (
                    <option key={m} value={m}>
                      {EXCEL_MODALIDADES[m]}
                    </option>
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
                integer
                min={1}
                max={10000}
                onChange={(v) => set("puntos", v)}
              />
              <Field label="CONSECION">
                <ExpandingTextField
                  className="input-field"
                  placeholder="GDP / GDN"
                  value={budget.excel.concesion}
                  onChange={(e) =>
                    set("excel", { ...budget.excel, concesion: e.target.value })
                  }
                />
              </Field>
            </div>
            {!templateMode && (
              <div className="quote-budget-subsection">
                <h4>Materiales del catálogo</h4>
                <p className="quote-muted">
                  Revisa el costo referencial antes de cotizar. Todos los costos
                  se expresan sin IGV en {budget.moneda}; el tipo de cambio es una
                  referencia y no convierte precios automáticamente.
                </p>
                <Field label="Buscar material por nombre o SKU">
                  <ExpandingTextField
                    className="input-field"
                    value={materialQuery}
                    placeholder="Escribe el nombre del material…"
                    aria-controls="quote-material-results"
                    onChange={(e) => setMaterialQuery(e.target.value)}
                  />
                </Field>
                <ul
                  id="quote-material-results"
                  className="quote-material-results"
                  aria-label="Materiales del catálogo"
                >
                  {searchMaterials(
                    materials,
                    materialQuery,
                    materials.length,
                  ).map((m) => {
                    const added = budget.materiales.some(
                      (item) => item.sku === m.id,
                    )
                    return (
                      <li key={m.id} className="quote-material-catalog-row">
                        <QuoteMaterialLabel material={m} sku={m.id} nombre={m.nombre} />
                        <button
                          type="button"
                          className="quote-material-option"
                          aria-label={`${added ? 'Agregado' : 'Agregar'} ${m.nombre} · SKU ${m.id}`}
                          disabled={added}
                          onClick={() => addMaterial(m.id)}
                        >
                          <span>{added ? "Agregado" : "Agregar +"}</span>
                          <small>{m.unidad}</small>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {!searchMaterials(materials, materialQuery, materials.length)
                  .length && (
                  <p role="status">
                    No se encontraron materiales con ese nombre.
                  </p>
                )}
                {budget.materiales.map((m, index) => (
                  <div key={m.id} className="quote-line">
                    <QuoteMaterialLabel material={materials.find(material => material.id === m.sku)} sku={m.sku} nombre={m.nombre} />
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
                        <ExpandingTextField
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
              </div>
            )}
          </section>
        </div>
        <div hidden={step !== 2} data-form-step="2">
          <section className="panel quote-section">
            <h3>Costos y servicios</h3>
            <h4>Partidas por modalidad · {EXCEL_MODALIDADES[budget.modalidad]}</h4>
            <p className="quote-muted">
              Los nombres conservan las etiquetas del Excel. Agrega únicamente
              las partidas que correspondan al proyecto; cada una se suma una
              vez al costo directo.
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
                    p.group === group &&
                    p.modalidades.includes(budget.modalidad),
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
                    <ExpandingTextField
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
                <ExpandingTextField
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
            <div className="quote-budget-subsection">
              <div className="quote-toolbar">
                <h4>Servicios y otros costos sin IGV</h4>
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
                                ? {
                                    ...x,

                                    rubro: e.target.value as typeof g.rubro,
                                  }
                                : x,
                            ),
                          )
                        }
                      >
                        {RUBROS.filter(
                          (r) =>
                            !["FINANCIAMIENTO", "GENERALES", "COMISION"].includes(
                              r,
                            ),
                        ).map((r) => (
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
                      <ExpandingTextField
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
            </div>
          </section>
        </div>
        <div hidden={step !== 3} data-form-step="3">
          <section className="panel quote-section">
            <h3>Condiciones comerciales</h3>
            <div className="quote-form-grid">
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
              <Field label="Nombre de la propuesta o alternativa">
                <ExpandingTextField
                  className="input-field"
                  value={budget.alternativa}
                  onChange={(e) => set("alternativa", e.target.value)}
                />
              </Field>
            </div>
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
            <h3>Porcentajes y financiamiento</h3>
            <p className="quote-muted">
              Utilidad y gastos generales se aplican al costo directo. La
              comisión se aplica al subtotal; en FISE se aplica al ingreso del
              convenio.
            </p>
            <div className="quote-form-grid">
              {([
                ["utilidad", "Utilidad (%):"],

                ["generales", "GASTOS GENERALES (%)"],

                ["comision", "Comision Venta (%):"],

                ["igv", "IGV (%):"],

                ["financiamientoMensual", "GASTOS DE FINANCIAMIENTO: (%/MES)"],

                ["meses", "MESES DE FINANCIAMIENTO"],
              ] as const)

                .filter(
                  ([key]) => budget.modalidad !== "FISE" || key !== "utilidad",
                )

                .map(([key, label]) => (
                  <NumberField
                    key={key}
                    label={label}
                    max={key === "meses" ? 120 : 100}
                    value={budget.tasas[key]}
                    onChange={(v) => {
                      setEditedRates((r) => ({ ...r, [key]: true }))
                      set("tasas", { ...budget.tasas, [key]: v })
                    }}
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
                    <ExpandingTextField
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
                  <datalist id="excel-presiones-fise">
                    {[
                      "23",

                      "340",

                      "23 - 23",

                      "23 - 340",

                      "340 - 340",

                      "23 - 23 - 23",

                      "23 - 23 - 340",

                      "23 - 340 - 340",

                      "340 - 340 - 340",
                    ].map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                  <small>
                    Presiones en mbar. Conserva el orden de los puntos de
                    consumo de la configuración.
                  </small>
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
        </div>
        <div hidden={step !== 4} data-form-step="4">
          <section className="panel quote-section">
            <h3>{project.nombre || templateName || "Resumen del proyecto"}</h3>
            <p>
              {project.cliente} · {project.ubicacion}
            </p>
            <p className="quote-muted">
              {budget.materiales.length} materiales · {budget.gastos.length}{" "}
              partidas de costo · {EXCEL_MODALIDADES[budget.modalidad]}
            </p>
            <p>Departamento: {budget.excel.departamento} · Provincia: {budget.excel.provincia} · Distrito: {budget.excel.distrito}</p>
            <div className="quote-review-grid">
              {budget.materiales.map((m) => (
                <div className="quote-review-item" key={m.id}>
                  <QuoteMaterialLabel material={materials.find(material => material.id === m.sku)} sku={m.sku} nombre={m.nombre} />
                  <span>
                    {m.cantidad} {m.unidadCotizada}
                  </span>
                  <span>
                    {money(m.cantidad * m.costoUnitario, budget.moneda)}
                  </span>
                </div>
              ))}
              {budget.gastos.map((g) => (
                <div className="quote-review-item" key={g.id}>
                  <strong>{g.descripcion}</strong>
                  <span>
                    {g.cantidad} × {money(g.costoUnitario, budget.moneda)}
                  </span>
                  <span>
                    {money(g.cantidad * g.costoUnitario, budget.moneda)}
                  </span>
                </div>
              ))}
            </div>
            <p className="quote-muted">
              Vigencia: {budget.vigencia} · Técnico: {budget.tecnico}
            </p>
            {budget.condiciones && (
              <p className="quote-note">{budget.condiciones}</p>
            )}
            <h3>Resumen del cálculo</h3>
            <Totals budget={budget} />
            {calculateQuote(budget).utilidad < 0 && (
              <p role="status" className="quote-error">
                El ingreso FISE no cubre los costos y márgenes previstos.
              </p>
            )}
          </section>
        </div>
        <div className="quote-toolbar">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          {step > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStep((s) => s - 1)

                setErrors([])
                setFieldIssues([])
                setValidationAttempted(false)
              }}
            >
              Anterior
            </button>
          )}
          {step < steps.length - 1 ? (
            <button
              key="next-step"
              type="button"
              className="btn btn-primary"
              onClick={nextStep}
            >
              Siguiente →
            </button>
          ) : (
            <button key="save-budget" className="btn btn-primary" type="submit">
              {saving
                ? "Guardando…"
                : templateMode
                  ? "Guardar plantilla"
                  : "Guardar borrador"}
            </button>
          )}
        </div>
      </fieldset>
    </form></ValidationContext.Provider>
  )
}
