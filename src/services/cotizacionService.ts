import { validateTextFields, validateText, validateProject, validateNumber } from "../utils/formValidation"
import { quoteValidation, type QuoteBudget } from "../features/cotizaciones/domain"
import { supabase } from "./supabase"

export type LegacyQuote = {
  id: string
  codigo: string
  proyecto_id: string | null
  version_actual: number
  versiones: { numero: number, estado: string, presupuesto: Record<string, unknown> }[]
}

export async function obtenerCotizacionesAnteriores(): Promise<LegacyQuote[]> {
  const { data, error } = await supabase.from('cotizaciones')
    .select('id,codigo,proyecto_id,version_actual,versiones:cotizacion_versiones(numero,estado,presupuesto)')
    .order('created_at', { ascending: false })
  if (error) {
    if (error.code === 'PGRST205' || error.code === '42P01') return []
    throw new Error(error.message)
  }
  return (data ?? []) as LegacyQuote[]
}
import type {
  ProjectExpense,
  Quote,
  QuoteTemplate,
  QuotePeriod,
} from "../features/cotizaciones/domain"

export async function obtenerCotizaciones(): Promise<Quote[]> {
  const { data, error } = await supabase
    .from("proyecto_cotizaciones")
    .select(
      "*,eventos:cotizacion_eventos(*),asignaciones:cotizacion_asignaciones(*)",
    )
    .is('eliminada_en', null)
    .order("updated_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    importe_presentado:
      row.importe_presentado == null ? null : Number(row.importe_presentado),
    importe_aceptado:
      row.importe_aceptado == null ? null : Number(row.importe_aceptado),
    asignaciones: (row.asignaciones ?? []).map(
      (a: Quote["asignaciones"][number]) => ({
        ...a,
        cantidad: Number(a.cantidad),
      }),
    ),
  })) as Quote[]
}
export async function obtenerGastosProyecto(): Promise<ProjectExpense[]> {
  const { data, error } = await supabase
    .from("proyecto_gastos")
    .select("*")
    .order("fecha", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    monto: Number(row.monto),
    cantidad: row.cantidad == null ? null : Number(row.cantidad),
  })) as ProjectExpense[]
}
export async function obtenerPlantillasCotizacion(): Promise<QuoteTemplate[]> {
  const { data, error } = await supabase
    .from("cotizacion_plantillas")
    .select("*")
    .order("nombre")
  if (error) throw error
  return (data ?? []) as QuoteTemplate[]
}
export async function obtenerPeriodosCotizacion(): Promise<QuotePeriod[]> {
  const { data, error } = await supabase
    .from("cotizacion_periodos")
    .select("*")
    .order("periodo", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    gastos_generales_jmp: Number(row.gastos_generales_jmp),
  })) as QuotePeriod[]
}
export async function operarCotizacion(
  accion: string,
  id: string,
  datos: Record<string, unknown>,
): Promise<string> {
  validateTextFields(datos)
  if (accion === "guardar" && datos.proyecto) validateProject(datos.proyecto as Record<string, unknown>)
  if (datos.presupuesto) {
    const errors = quoteValidation(datos.presupuesto as QuoteBudget)
    if (errors.length) throw new Error(errors.join(" "))
  }
  if (datos.nombre !== undefined) validateText(datos.nombre, "Nombre de plantilla", 100, true)
  for (const key of ["importe", "monto", "cantidad", "gastos_generales_jmp"])
    if (datos[key] !== undefined) validateNumber(datos[key], key, key === "gastos_generales_jmp" ? 0 : 0.000001)
  const { data, error } = await supabase.rpc("operar_cotizacion_proyecto", {
    p_accion: accion,
    p_id: id,
    p_datos: datos,
  })
  if (error) throw new Error(error.message)
  return data as string
}
