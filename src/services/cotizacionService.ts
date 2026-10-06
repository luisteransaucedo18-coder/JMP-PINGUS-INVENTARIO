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
      "*,eventos:cotizacion_eventos(*,usuario:perfiles!cotizacion_eventos_usuario_id_fkey(nombre)),asignaciones:cotizacion_asignaciones(*)",
    )
    .is('eliminada_en', null)
    .order("updated_at", { ascending: false })
  if (error) throw error
  return (data ?? []).map((row) => ({
    ...row,
    eventos: (row.eventos ?? []).map((event: { usuario?: { nombre?: string } | null }) => ({ ...event, usuario_nombre: event.usuario?.nombre ?? 'Usuario no disponible' })),
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
  const { data, error } = await supabase.rpc("operar_cotizacion_proyecto", {
    p_accion: accion,
    p_id: id,
    p_datos: datos,
  })
  if (error) throw new Error(error.message)
  return data as string
}
