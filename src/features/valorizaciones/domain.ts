import type { Quote } from "../cotizaciones/domain"

export const CHECKLIST = [
  ["fachada", "Fachada panorámica", 1],
  ["gabinete", "Gabinete rotulado", 1],
  ["malla", "Malla detrás del gabinete", 1],
  ["profundidad", "Profundidad de tubería medida con wincha visible", 1],
  ["resane", "Calidad del resane", 1],
  ["transito", "Tránsito de 2025 a 1216 antes de taparlo", 1],
  ["recorrido", "Recorrido de la instalación", 1],
  ["valvulas", "Válvulas 2025 y 1216", 1],
  ["cocina", "Ambiente de cocina (dos fotografías)", 2],
  ["ventilacion", "Ventilación", 1],
  ["artefactos", "Artefactos", 1],
  ["adicionales", "Construcción con triplay, calamina o cocineta", 0],
  ["costos", "Control de costos registrado", 0],
  ["materiales", "Reporte de materiales utilizados", 0],
  ["cargos", "Cargos de materiales identificados por comercio", 0],
  ["constructivo", "Reporte constructivo e isométrico cargados", 0],
  ["portal", "Instalación cerrada en el portal", 0],
  ["supervision", "Supervisión exitosa y calidad de obra conforme", 0],
  ["formatos", "Siete formatos del isométrico completos y correctos", 0],
] as const
export type CheckStatus = "" | "CONFORME" | "OBSERVADO" | "NO_APLICA"
export type CheckAnswer = {
  estado: CheckStatus
  nota: string
}
export type Photo = {
  id: string
  punto: string
  path: string
  nombre: string
  fecha: string
  ubicacion: string
}
export type Discount = {
  sku: string
  nombre: string
  cantidad: number
  referencia: number
  monto: number
  motivo: string
}
export const DOCUMENTS = {
  ISOMETRICO_INICIAL: "Isométrico posterior a la construcción",
  ISOMETRICO_FINAL: "Isométrico final",
  RESUMEN: "Resumen de materiales utilizados",
  PLANTA: "Plano en planta",
  HERMETICIDAD: "Prueba de hermeticidad",
  DECLARACION: "Declaración jurada",
  GARANTIA: "Certificado de garantía",
  CONTRATO: "Contrato de servicio de instalación",
  REPORTE: "Reporte fotográfico generado",
  FIRMADA: "Valorización con firma digital del técnico",
  HONORARIOS: "Recibo por honorarios",
  PAGO: "Comprobante de pago",
} as const
export type DocumentKind = keyof typeof DOCUMENTS
export const ANALYST_DOCUMENTS: DocumentKind[] = [
  "ISOMETRICO_INICIAL",
  "ISOMETRICO_FINAL",
  "RESUMEN",
  "PLANTA",
  "HERMETICIDAD",
  "DECLARACION",
  "GARANTIA",
  "CONTRATO",
]
export const REQUIRED_DOCUMENTS = ANALYST_DOCUMENTS.filter(
  (k) => k !== "ISOMETRICO_INICIAL",
)
export const STATE_LABELS = {
  BORRADOR: "Borrador",
  EN_TESORERIA: "En Tesorería",
  OBSERVADA: "Observada",
  RETENIDA: "Retenida",
  EN_GERENCIA: "Pendiente de autorización",
  AUTORIZADA: "Pago autorizado",
  PAGADA: "Pagada",
} as const
export type Valuation = {
  id: string
  codigo: string
  cotizacion_id: string
  serie_id: string
  proyecto_id: string
  analista_id: string
  tecnico: string
  dni: string
  etapa: "INTERNA" | "HABILITACION"
  tipo: "FINAL" | "ADELANTO"
  estado: keyof typeof STATE_LABELS
  monto: number
  adelantos: number
  descuentos: Discount[]
  neto: number
  checklist: Record<string, CheckAnswer>
  motivo: string
  observacion: string
  revision: number
  reporte_revision: number | null
  pago_fecha: string | null
  pago_referencia: string | null
  created_at: string
}
export type Evidence = {
  id: string
  valorizacion_id: string
  tipo: DocumentKind | "FOTO"
  punto: string | null
  path: string
  nombre: string
  fecha: string | null
  ubicacion: string
  created_at: string
}
export type ValuationEvent = {
  id: number
  accion: string
  actor_nombre: string
  detalle: string
  created_at: string
}
export function laborAmount(quote: Quote, stage: Valuation["etapa"]) {
  return (
    Math.round(
      quote.presupuesto.gastos
        .filter(
          (g) =>
            g.rubro === (stage === "INTERNA" ? "MANO_OBRA" : "HABILITACION"),
        )
        .reduce((s, g) => s + g.cantidad * g.costoUnitario, 0) * 100,
    ) / 100
  )
}
export function netAmount(
  amount: number,
  advances: number,
  discounts: Discount[],
) {
  return (
    Math.round(
      (amount - advances - discounts.reduce((s, d) => s + d.monto, 0)) * 100,
    ) / 100
  )
}
export function checklistErrors(
  answers: Valuation["checklist"],
  photos: Evidence[],
) {
  return CHECKLIST.flatMap(([id, label, min]) => {
    const a = answers[id]
    if (!a?.estado) return [`${label}: falta evaluación.`]
    if (a.estado === "OBSERVADO") return [`${label}: resuelve la observación.`]
    if (a.estado === "NO_APLICA" && !a.nota.trim())
      return [`${label}: justifica por qué no aplica.`]
    const validPhotos = photos.filter(
      (p) =>
        p.tipo === "FOTO" && p.punto === id && p.fecha && p.ubicacion.trim(),
    )
    if (a.estado === "CONFORME" && validPhotos.length < min)
      return [`${label}: faltan fotos con fecha y ubicación.`]
    return []
  })
}
export const money = (n: number) =>
  new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" }).format(
    n,
  )
