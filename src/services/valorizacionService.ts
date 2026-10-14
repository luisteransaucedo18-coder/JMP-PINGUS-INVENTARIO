import { supabase } from "./supabase"
import type {
  Valuation,
  Evidence,
  ValuationEvent,
  DocumentKind,
} from "../features/valorizaciones/domain"

export async function loadValuations(): Promise<Valuation[]> {
  const { data, error } = await supabase
    .from("trabajo_valorizaciones")
    .select("*")
    .order("created_at", { ascending: false })
  if (error)
    throw new Error(
      "No se pudieron cargar las valorizaciones. Verifica conexión y migración del módulo.",
    )
  return (data ?? []).map((v) => ({
    ...v,
    monto: Number(v.monto),
    adelantos: Number(v.adelantos),
    neto: Number(v.neto),
  }))
}
export async function loadValuationDetails(
  id: string,
): Promise<{
  documents: Evidence[]
  events: ValuationEvent[]
}> {
  const [docs, events] = await Promise.all([
    supabase
      .from("valorizacion_documentos")
      .select("*")
      .eq("valorizacion_id", id)
      .order("created_at"),
    supabase
      .from("valorizacion_eventos")
      .select("*")
      .eq("valorizacion_id", id)
      .order("created_at", { ascending: false }),
  ])
  if (docs.error || events.error)
    throw new Error(
      "No se pudo cargar el expediente. Reintenta antes de operar.",
    )
  return { documents: docs.data ?? [], events: events.data ?? [] }
}
export async function operateValuation(
  action: string,
  id: string,
  revision: number,
  data: Record<string, unknown> = {},
) {
  const { error } = await supabase.rpc("operar_valorizacion", {
    p_accion: action,
    p_id: id,
    p_revision: revision,
    p_datos: data,
  })
  if (error) throw new Error(error.message)
}
const bucket = "valorizaciones"
export async function documentUrl(path: string) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, 120)
  if (error) throw new Error("No se pudo abrir el documento.")
  return data.signedUrl
}
export async function downloadEvidence(path: string) {
  const { data, error } = await supabase.storage.from(bucket).download(path)
  if (error || !data)
    throw new Error("No se pudo recuperar una fotografía del reporte.")
  return data
}
export async function uploadEvidence(
  v: Valuation,
  blob: Blob,
  name: string,
  kind: DocumentKind | "FOTO",
  metadata: {
    punto?: string
    fecha?: string
    ubicacion?: string
  } = {},
) {
  if (blob.size > (kind === "FOTO" ? 1024 * 1024 : 15 * 1024 * 1024))
    throw new Error(
      kind === "FOTO"
        ? "La fotografía comprimida excede 1 MB."
        : "El PDF excede 15 MB.",
    )
  if (kind !== "FOTO") {
    const header = new TextDecoder().decode(
      await blob.slice(0, 5).arrayBuffer(),
    )
    if (header !== "%PDF-") throw new Error("Selecciona un archivo PDF válido.")
  }
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("Tu sesión terminó.")
  const path = `${v.id}/${user.id}/${crypto.randomUUID()}.${
    kind === "FOTO" ? "jpg" : "pdf"
  }`
  const { error } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      contentType: kind === "FOTO" ? "image/jpeg" : "application/pdf",
      upsert: false,
    })
  if (error)
    throw new Error(
      "No se pudo subir el archivo. Revisa la conexión o el límite de almacenamiento.",
    )
  try {
    await operateValuation("documento", v.id, v.revision, {
      tipo: kind,
      path,
      nombre: name,
      ...metadata,
    })
  } catch (error) {
    await supabase.storage.from(bucket).remove([path])
    throw error
  }
}
export async function compressPhoto(file: File): Promise<Blob> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Usa fotos JPG, PNG o WebP.")
  if (file.size > 15 * 1024 * 1024)
    throw new Error("La foto original supera 15 MB.")
  const image = await createImageBitmap(file, {
    imageOrientation: "from-image",
  })
  try {
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("No se pudo preparar la imagen.")
    ctx.fillStyle = "#fff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (b) =>
          b ? resolve(b) : reject(new Error("No se pudo comprimir la foto.")),
        "image/jpeg",
        0.8,
      ),
    )
    if (blob.size > 1024 * 1024)
      throw new Error("La imagen supera 1 MB comprimida. Reduce su resolución.")
    return blob
  } finally {
    image.close()
  }
}
