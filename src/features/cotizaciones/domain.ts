import type { Sede } from "../../domain/types"

export const MODALIDADES = ["COBRE", "PEALPE", "PEQUENOS", "FISE"] as const
export type Modalidad = typeof MODALIDADES[number]
export const RUBROS = [
  "MANO_OBRA",
  "HABILITACION",
  "MURETES",
  "FIJOS",
  "VARIABLES",
  "FLETE",
  "MOVILIDAD",
  "SUPERVISION",
  "VIATICOS",
  "HOSPEDAJE",
  "ALIMENTACION",
  "PASAJES",
  "COMBUSTIBLE",
  "PEAJES",
  "ANCLAJE",
  "ALTURA",
  "IG3",
  "DOCUMENTACION",
  "PAQUETE",
  "FINANCIAMIENTO",
  "GENERALES",
  "COMISION",
  "BONO",
  "ADICIONALES",
] as const
export type Rubro = typeof RUBROS[number]
export const RUBRO_LABELS: Record<Rubro, string> = {
  MANO_OBRA: "Costo Mano de Obra de redes internas:",
  HABILITACION: "Costo de Mano de Obra de Habilitacion:",
  MURETES: "Muretes",
  FIJOS: "Gastos Fijos  - Costo de Proyecto, Cotizacion:",
  VARIABLES: "Gastos Variables - Flete, Impresiones, Movilidad, Supervision:",
  FLETE: "COSTO FLETES Y ENVÍOS",
  MOVILIDAD: "Impresiones  y Movilidad",
  SUPERVISION: "Supervision",
  VIATICOS: "COSTOS VIATICOS Y TRANSPORTE",
  HOSPEDAJE: "HOSPEDAJE",
  ALIMENTACION: "ALIMENTACIÓN",
  PASAJES: "PASAJES - FLETES",
  COMBUSTIBLE: "COMBUSTIBLE",
  PEAJES: "PEAJES",
  ANCLAJE: "ESTRUCTURA METÁLICA DE ANCLAJE",
  ALTURA: "TRABAJOS EN ALTURA",
  IG3: "Firme IG3",
  DOCUMENTACION: "DOCUMENTACIÓN Y ELABORACIÓN DE ENTREGABLES",
  PAQUETE: "MANO DE OBRA + MATERIALES (NO INCLUYE GABINETE)",
  FINANCIAMIENTO: "GASTOS DE FINANCIAMIENTO:",
  GENERALES: "GASTOS GENERALES",
  COMISION: "Comisión ventas",
  BONO: "Bono Administrativo:",
  ADICIONALES: "Trabajos adicionales",
}
export const ESTADOS_COTIZACION = [
  "BORRADOR",
  "EN_REVISION",
  "OBSERVADA",
  "APROBADA",
  "PRESENTADA",
  "ACEPTADA",
  "RECHAZADA",
  "VENCIDA",
  "ANULADA",
  "SUPERADA",
  "CERRADA",
] as const
export type EstadoCotizacion = typeof ESTADOS_COTIZACION[number]
export const ESTADO_LABELS: Record<EstadoCotizacion, string> = {
  BORRADOR: "Borrador",
  EN_REVISION: "En revisión",
  OBSERVADA: "Observada",
  APROBADA: "Aprobada internamente",
  PRESENTADA: "Presentada",
  ACEPTADA: "Aceptada por cliente",
  RECHAZADA: "Rechazada",
  VENCIDA: "Vencida",
  ANULADA: "Anulada",
  SUPERADA: "Versión superada",
  CERRADA: "Cerrada",
}
export type QuoteMaterial = {
  id: string
  sku: string
  nombre: string
  unidadCatalogo: string
  unidadCotizada: string
  cantidad: number
  factorStock: number
  costoUnitario: number
}
export type BudgetExpense = {
  id: string
  rubro: Rubro
  descripcion: string
  cantidad: number
  costoUnitario: number
  variableExcel?: string
}
export type QuoteRates = {
  utilidad: number
  generales: number
  comision: number
  igv: number
  financiamientoMensual: number
  meses: number
}
export type QuoteBudget = {
  modalidad: Modalidad
  ciudad: string
  tipo: "TIPICO" | "NO_TIPICO"
  puntos: number
  sede: Sede
  moneda: "PEN" | "USD"
  tipoCambio: number
  vigencia: string
  tecnico: string
  alcance: string
  condiciones: string
  alternativa: string
  materiales: QuoteMaterial[]
  gastos: BudgetExpense[]
  tasas: QuoteRates
  fise: {
    configuracion: string
    configuracionInterna: string
    presionArtefactos: string
    instalacion: string
    acometida: string
    ingresoSinIgv: number
  }
  excel: {
    departamento: string
    provincia?: string
    distrito?: string
    concesion: string
    muretesCachimbo: "SI" | "NO"
    muretesValvula: "SI" | "NO"
    diasProyectados: number
    plazo: string
    dia: string
    horario: string
    tiempo: string
    cajaChica: string
    bonoCondicionado: boolean
  }
}
export type QuoteTotals = {
  materiales: number
  gastos: number
  costoDirecto: number
  financiamiento: number
  generales: number
  utilidad: number
  subtotal: number
  comision: number
  valorVenta: number
  igv: number
  total: number
}
export type QuoteEvent = {
  id: number
  accion: string
  estado_anterior: string | null
  estado_nuevo: string
  usuario_id: string
  usuario_nombre?: string
  detalle: string
  created_at: string
}
export type QuoteAllocation = {
  id: string
  item_id: string
  requerimiento_id: string
  material_sku: string
  cantidad: number
}
export type ProjectExpense = {
  id: string
  cotizacion_id: string
  rubro: Rubro | "MATERIALES"
  naturaleza: "COSTO" | "ABONO"
  descripcion: string
  monto: number
  fecha: string
  comprobante: string
  documento_path: string | null
  material_sku: string | null
  cantidad: number | null
  estado: "REGISTRADO" | "ANULADO"
  motivo_anulacion: string | null
  creado_por: string
  created_at: string
}
export type Quote = {
  id: string
  codigo: string
  proyecto_id: string | null
  serie_id: string
  version: number
  revision: number
  estado: EstadoCotizacion
  creado_por: string
  presupuesto: QuoteBudget
  totales: QuoteTotals
  proyecto_snapshot: {
    nombre: string
    cliente: string
    ubicacion: string
    responsable: string
  }
  importe_presentado: number | null
  importe_aceptado: number | null
  evidencia: string | null
  documento_path: string | null
  observaciones: string | null
  cierre: string | null
  fecha_habilitacion: string | null
  created_at: string
  updated_at: string
  eventos: QuoteEvent[]
  asignaciones: QuoteAllocation[]
}
export type QuoteTemplate = {
  id: string
  nombre: string
  modalidad: Modalidad
  ciudad: string
  tipo: "TIPICO" | "NO_TIPICO"
  puntos: number
  tasas: QuoteRates
  gastos: BudgetExpense[]
  parametros: Pick<QuoteBudget, "excel" | "fise">
  actualizado_por: string | null
  updated_at: string
}
export type QuotePeriod = {
  periodo: string
  gastos_generales_jmp: number
  control_bonos: Record<string, { control: '>' | '>=', cant: number }>
  updated_at: string
}

export function defaultQuoteRates(
  modalidad: Modalidad,
  ciudad = "",
  departamento = "",
): QuoteRates {
  const piura = ciudad.toLocaleLowerCase("es").startsWith("piura")

  return {
    utilidad:
      modalidad === "COBRE"
        ? 22
        : modalidad === "PEALPE"
          ? 25
          : modalidad === "PEQUENOS"
            ? 20
            : 0,

    generales: modalidad === "COBRE" ? 10 : 0,
    comision:
      modalidad === "COBRE"
        ? piura
          ? 6
          : 5
        : modalidad === "PEALPE"
          ? piura || departamento === "Piura"
            ? 12
            : 10
          : modalidad === "FISE"
            ? 11
            : 10,

    igv: 18,
    financiamientoMensual: modalidad === "COBRE" ? 2.5 : 0,
    meses: modalidad === "COBRE" ? 1 : 0,
  }
}

export function newBudget(sede: Sede = "Chiclayo"): QuoteBudget {
  const today = new Date().toLocaleDateString("en-CA", {
    timeZone: "America/Lima",
  })
  return {
    modalidad: "PEALPE",
    ciudad: "",
    tipo: "TIPICO",
    puntos: 1,
    sede,
    moneda: "PEN",
    tipoCambio: 1,
    vigencia: today,
    tecnico: "",
    alcance: "",
    condiciones: "",
    alternativa: "Propuesta principal",
    materiales: [],
    gastos: [],
    tasas: defaultQuoteRates("PEALPE"),
    fise: {
      configuracion: "",
      configuracionInterna: "",
      presionArtefactos: "",
      instalacion: "",
      acometida: "",
      ingresoSinIgv: 0,
    },
    excel: {
      departamento: "",
      provincia: "",
      distrito: "",
      concesion: "",
      muretesCachimbo: "NO",
      muretesValvula: "NO",
      diasProyectados: 1,
      plazo: "",
      dia: "",
      horario: "",
      tiempo: "",
      cajaChica: "",
      bonoCondicionado: true,
    },
  }
}

export const money = (value: number, moneda: "PEN" | "USD" = "PEN") =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: moneda,
  }).format(value)
export const roundMoney = (value: number) => {
  if(!Number.isFinite(value)) return value;
  const [mantissa,exponent='0']=String(Math.abs(value)).split('e');
  const shifted=Number(`${mantissa}e${Number(exponent)+2}`);
  return Math.sign(value)*Number(`${Math.round(shifted)}e-2`);
};

export function calculateQuote(budget: QuoteBudget): QuoteTotals {
  const r = roundMoney
  const materiales = r(
    budget.materiales.reduce(
      (sum, item) => sum + r(item.cantidad * item.costoUnitario),
      0,
    ),
  )
  const gastos = r(
    budget.gastos.reduce(
      (sum, item) => sum + r(item.cantidad * item.costoUnitario),
      0,
    ),
  )
  const costoDirecto = r(materiales + gastos)
  const financiamiento = r(
    (costoDirecto * budget.tasas.financiamientoMensual * budget.tasas.meses) /
      100,
  )
  const generales = r((costoDirecto * budget.tasas.generales) / 100)
  let utilidad = r((costoDirecto * budget.tasas.utilidad) / 100)
  let subtotal = r(costoDirecto + financiamiento + generales + utilidad)
  let comision = r((subtotal * budget.tasas.comision) / 100)
  let valorVenta = r(subtotal + comision)
  if (budget.modalidad === "FISE") {
    valorVenta = r(budget.fise.ingresoSinIgv)
    comision = r((valorVenta * budget.tasas.comision) / 100)
    utilidad = r(
      valorVenta - costoDirecto - financiamiento - generales - comision,
    )
    subtotal = r(valorVenta - comision)
  }
  const igv = r((valorVenta * budget.tasas.igv) / 100)
  return {
    materiales,
    gastos,
    costoDirecto,
    financiamiento,
    generales,
    utilidad,
    subtotal,
    comision,
    valorVenta,
    igv,
    total: r(valorVenta + igv),
  }
}

export function quoteValidation(b: QuoteBudget): string[] {
  const errors: string[] = []
  if (new Set(b.materiales.map((m) => m.sku)).size !== b.materiales.length)
    errors.push(
      "Cada material del catálogo solo puede aparecer una vez. Edita su cantidad en la partida existente.",
    )

  const expenseKey = (g: BudgetExpense) =>
    g.variableExcel ??
    `${g.rubro}:${g.descripcion.trim().toLocaleLowerCase("es").replace(/\s+/g, " ")}`

  if (new Set(b.gastos.map(expenseKey)).size !== b.gastos.length)
    errors.push(
      "No repitas la misma partida de costo. Edita la cantidad o el importe de la existente.",
    )

  const number = (v: number, min = 0, max = 100000000) =>
    Number.isFinite(v) && v >= min && v < max
  if (!b.ciudad.trim()) errors.push('Distrito: selecciona una opción.')
  if (!b.alcance.trim()) errors.push('Alcance de los trabajos: describe el trabajo que se realizará.')
  if (!b.tecnico.trim()) errors.push('Técnico responsable: completa este campo.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(b.vigencia))
    errors.push("Indica una fecha de vigencia.")
  if (!number(b.puntos, 1, 10001) || !Number.isInteger(b.puntos))
    errors.push("El número de puntos debe ser entero y positivo.")
  if (!number(b.tipoCambio, 0.000001))
    errors.push("El tipo de cambio debe ser positivo.")
  if (!b.materiales.length && !b.gastos.length)
    errors.push("Agrega materiales o partidas de servicio.")
  b.materiales.forEach((m, index) => {
    const label = `Material ${m.sku || index + 1}`
    if (!m.sku) errors.push(`${label}: selecciona un material del catálogo.`)
    if (!number(m.cantidad, 0.000001)) errors.push(`${label} · Cantidad: ingresa un valor positivo.`)
    if (!number(m.costoUnitario)) errors.push(`${label} · Costo unitario: ingresa un valor válido mayor o igual a cero.`)
    if (!number(m.factorStock, 0.000001)) errors.push(`${label} · Factor de conversión: ingresa un valor positivo.`)
    if (!m.unidadCotizada.trim()) errors.push(`${label} · Unidad cotizada: completa este campo.`)
  })
  b.gastos.forEach((g, index) => {
    const label = `Partida ${index + 1}${g.descripcion.trim() ? ` (${g.descripcion})` : ''}`
    if (!g.descripcion.trim()) errors.push(`${label} · Descripción: completa este campo.`)
    if (!number(g.cantidad, 0.000001)) errors.push(`${label} · Cantidad: ingresa un valor positivo.`)
    if (!number(g.costoUnitario)) errors.push(`${label} · Costo unitario: ingresa un valor válido mayor o igual a cero.`)
  })
  const rateLabels: Record<string, string> = { utilidad: 'Utilidad', generales: 'Gastos generales', comision: 'Comisión', igv: 'IGV', financiamientoMensual: 'Financiamiento mensual', meses: 'Meses de financiamiento' }
  Object.entries(b.tasas).forEach(([key, value]) => {
    if (!number(value, 0, key === 'meses' ? 121 : 101)) errors.push(`${rateLabels[key] ?? key}: ingresa un valor entre 0 y ${key === 'meses' ? 120 : 100}.`)
  })
  if (b.modalidad === 'FISE') {
    for (const [key, label] of [['configuracion','Configuración FISE'],['configuracionInterna','Configuración interna'],['instalacion','Instalación interna'],['acometida','Acometida']] as const) {
      if (!b.fise[key].trim()) errors.push(`${label}: completa este campo.`)
    }
    if (!number(b.fise.ingresoSinIgv,0.01)) errors.push('Ingreso de convenio sin IGV: ingresa un importe positivo.')
    if (!/^(23|340)(\s*-\s*(23|340))*$/.test(b.fise.presionArtefactos) || b.fise.presionArtefactos.split('-').length !== b.puntos) errors.push(`Presión de artefactos: ingresa ${b.puntos} valores de 23 o 340, separados por guiones (uno por punto).`)
  }
  if (!number(b.excel.diasProyectados, 0, 10001))
    errors.push("Revisa DIAS PROYECTADOS.")
  const active = b.gastos.filter((g) => g.cantidad * g.costoUnitario > 0)
  if(active.some(g=>['FINANCIAMIENTO','GENERALES','COMISION'].includes(g.rubro))) errors.push('Configura financiamiento, gastos generales y comisión en Porcentajes y financiamiento.');
  for(const [key,flag] of [['mureteCachimbo','muretesCachimbo'],['mureteValvula','muretesValvula']] as const) {
    if(active.some(g=>g.variableExcel===key)&&b.excel[flag]==='NO') errors.push(`Indica SI en ${flag==='muretesCachimbo'?'Muretes Interiores Cachimbo:':'Muretes Interiores Valvula:'} para incluir su costo.`);
  }
  if (
    active.some((g) => g.rubro === "VARIABLES") &&
    active.some((g) =>
      [
        "FLETE",
        "MOVILIDAD",
        "SUPERVISION",
        ...(b.modalidad === "COBRE"
          ? [
              "VIATICOS",
              "HOSPEDAJE",
              "ALIMENTACION",
              "PASAJES",
              "COMBUSTIBLE",
              "PEAJES",
            ]
          : []),
      ].includes(g.rubro),
    )
  )
    errors.push(
      "Usa Gastos Variables como importe global o su detalle; no sumes ambos.",
    )
  if (
    active.some((g) => g.variableExcel === "redInterna") &&
    active.some((g) => g.variableExcel?.startsWith("cobre"))
  )
    errors.push(
      "Usa el costo global de redes internas o el detalle por diámetro; no sumes ambos.",
    )
  if (
    active.some((g) => g.rubro === "PAQUETE") &&
    (b.materiales.length > 0 || active.some((g) => g.rubro === "MANO_OBRA"))
  )
    errors.push(
      "El paquete MANO DE OBRA + MATERIALES sustituye el detalle de esos costos.",
    )
  return errors
}

export function remainingMaterial(
  item: QuoteMaterial,
  family: Quote[],
  requirements: { id: string, estado: string }[],
): number {
  const used = family
    .flatMap((q) => q.asignaciones)
    .filter(
      (a) =>
        a.item_id === item.id &&
        requirements.some(
          (r) => r.id === a.requerimiento_id && r.estado !== "RECHAZADO",
        ),
    )
    .reduce((sum, a) => sum + a.cantidad, 0)
  return Math.max(
    0,
    Math.round((item.cantidad * item.factorStock - used) * 1000000) / 1000000,
  )
}

export function executionSummary(
  quote: Quote,
  family: Quote[],
  expenses: ProjectExpense[],
) {
  const ids = new Set(family.map((q) => q.id))
  const active = expenses.filter(
    (g) => ids.has(g.cotizacion_id) && g.estado === "REGISTRADO",
  )
  const actual = roundMoney(
    active.reduce(
      (sum, g) => sum + (g.naturaleza === "ABONO" ? -g.monto : g.monto),
      0,
    ),
  )
  const agreed =
    quote.importe_aceptado ?? quote.importe_presentado ?? quote.totales.total
  const saleWithoutTax = roundMoney(
    agreed / (1 + quote.presupuesto.tasas.igv / 100),
  )
  const planned = roundMoney(
    quote.totales.costoDirecto +
      quote.totales.financiamiento +
      quote.totales.generales +
      quote.totales.comision,
  )
  return {
    actual,
    planned,
    difference: roundMoney(actual - planned),
    saleWithoutTax,
    result: roundMoney(saleWithoutTax - actual),
    beneficioCosto:
      actual > 0
        ? roundMoney(((saleWithoutTax - actual) / actual) * 100)
        : null,
    complete: quote.estado === "CERRADA",
    active,
  }
}
