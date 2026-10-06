import { validateTextFields, validateNumber, validateText } from "../utils/formValidation"
import { validarArchivo } from "./transporteValidation"
export {
  admiteDecimales,
  validarCantidad,
  validarArchivo,
} from "./transporteValidation"
import { supabase } from "./supabase"
export const SEDES_TRANSPORTE = ["Chiclayo", "Chimbote", "Trujillo"] as const
export const ESTADOS_TRANSPORTE = [
  "BORRADOR",
  "EN_TRANSITO",
  "RECIBIDO",
  "INCIDENCIA",
  "CANCELADO",
] as const
export type EstadoTransporte = typeof ESTADOS_TRANSPORTE[number]
export interface TransporteItem {
  material_sku: string
  nombre: string
  unidad: string
  cantidad: number
  recibida: number
  aceptada: number
  danada: number
}
export interface TransporteArchivo {
  id: string
  tipo: string
  ruta: string
  nombre: string
}
export interface Transporte {
  id: string
  origen: string
  destino: string
  estado: EstadoTransporte
  fecha_envio: string
  observaciones: string
  transportista: string
  guia: string
  costo: number
  moneda: string
  numero_comprobante: string
  fecha_comprobante: string | null
  recibido_at: string | null
  reversion_solicitada: boolean
  reversion_autorizada: boolean
  traslado_items: TransporteItem[]
  traslado_archivos: TransporteArchivo[]
  traslado_historial: {
    id: number
    tipo: string
    usuario_nombre: string
    created_at: string
    observaciones: string
  }[]
  traslado_incidencias: {
    id: number
    observaciones: string
    resolucion: string | null
    resuelto_at: string | null
  }[]
}
export interface MaterialTransporte {
  sku: string
  nombre: string
  unidad: string
  stock: number
}
export interface DatosTransporte {
  destino: string
  fecha_envio: string
  observaciones: string
  transportista: string
  guia: string
  costo: number
  moneda: string
  numero_comprobante: string
  fecha_comprobante: string
}
export function mensajeTransporte(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "No se pudo completar la operación. Reintenta o actualiza el listado."
}

export async function obtenerTransportes(): Promise<Transporte[]> {
  const { data, error } = await supabase
    .from('traslados')
    .select('*,traslado_items(*),traslado_archivos(*),traslado_historial(*),traslado_incidencias(*)')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []) as Transporte[]
}

export async function cargarTransporte() {
  const { data: auth, error: authError } = await supabase.auth.getUser()
  if (authError) throw authError
  if (!auth.user) throw new Error("Inicia sesión nuevamente.")
  const { data: perfil, error: perfilError } = await supabase
    .from("perfiles")
    .select("sede,rol,estado")
    .eq("id", auth.user.id)
    .single()
  if (perfilError) throw perfilError
  if (perfil.rol !== "coordinador" || perfil.estado !== "ACTIVO")
    throw new Error("Acceso exclusivo para coordinadores activos.")
  const results = await Promise.all([
    supabase
      .from("traslados")
      .select(
        "*,traslado_items(*),traslado_archivos(*),traslado_historial(*),traslado_incidencias(*)",
      )
      .order("created_at", { ascending: false }),
    supabase
      .from("materiales")
      .select("sku,nombre,unidad")
      .eq("activo", true)
      .order("nombre"),
    supabase
      .from("inventario_sedes")
      .select("material_sku,stock")
      .eq("sede", perfil.sede),
  ])
  for (const r of results) if (r.error) throw r.error
  const stock = new Map(
    (results[2].data ?? []).map((r) => [r.material_sku, Number(r.stock)]),
  )
  return {
    sede: String(perfil.sede),
    traslados: (results[0].data ?? []) as Transporte[],
    materiales: (results[1].data ?? []).map((m) => ({
      ...m,
      unidad: m.unidad || "UND",
      stock: stock.get(m.sku) ?? 0,
    })) as MaterialTransporte[],
  }
}
export async function crearTransporte(
  id: string,
  datos: DatosTransporte,
  items: { material_sku: string; cantidad: number }[],
) {
  validateTextFields(datos)
  validateNumber(datos.costo, "Costo", 0, 999999999999.99)
  items.forEach(item => validateNumber(item.cantidad, "Cantidad", 0.001))
  const { error } = await supabase.rpc("transporte_crear", {
    p_id: id,
    p_datos: datos,
    p_items: items,
  })
  if (error) throw error
}
export async function operarTransporte(
  id: string,
  accion: string,
  nota: string,
  items: TransporteItem[] = [],
) {
  validateText(nota, "Observaciones", 1000)
  const { error } = await supabase.rpc("transporte_operar", {
    p_id: id,
    p_accion: accion,
    p_nota: nota,
    p_items: items,
  })
  if (error) throw error
}
export async function adjuntarTransporte(
  id: string,
  tipo: "COMPROBANTE" | "EVIDENCIA",
  file: File,
) {
  await validarArchivo(file)
  const archivo = crypto.randomUUID()
  const extension = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  }[file.type]
  const ruta = `${id}/${tipo}/${archivo}.${extension}`
  const { error } = await supabase.storage
    .from("transporte-interno")
    .upload(ruta, file, { contentType: file.type, upsert: false })
  if (error) throw error
  const { error: registroError } = await supabase.rpc("transporte_adjuntar", {
    p_id: id,
    p_archivo: archivo,
    p_tipo: tipo,
    p_nombre: file.name,
    p_mime: file.type,
    p_tamano: file.size,
    p_ruta: ruta,
  })
  if (registroError)
    throw new Error(
      `El archivo se cargó, pero no se pudo vincular. Vuelve a adjuntarlo. ${registroError.message}`,
    )
}
export async function abrirArchivoTransporte(
  archivo: TransporteArchivo,
  descargar = false,
) {
  const { data, error } = await supabase.storage
    .from("transporte-interno")
    .createSignedUrl(
      archivo.ruta,
      60,
      descargar ? { download: archivo.nombre } : undefined,
    )
  if (error) throw error
  return data.signedUrl
}
