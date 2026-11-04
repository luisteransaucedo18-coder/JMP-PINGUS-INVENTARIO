import { supabase } from "./supabase"

export const ESTADOS = [
  "Pendiente",
  "En curso",
  "En revisión",
  "Completado",
  "Cancelado",
] as const

export const PRIORIDADES = ["Baja", "Media", "Alta", "Urgente"] as const

export type Tarea = {
  id: string
  titulo: string
  capa: string
  rol: string
  estado: typeof ESTADOS[number]

  prioridad: typeof PRIORIDADES[number] | null
  responsable: string | null
  asignados?: string[]
  fecha_objetivo: string | null
  fecha_inicio?: string | null

  notas: string
  revision: number
}

export type Persona = {
  id: string
  nombre: string
  email?: string
  foto_url?: string | null
}

export type Comentario = {
  id: string
  autor: string
  contenido: string
  created_at: string
}

export async function cargarSistemas() {
  const [tasks, people] = await Promise.all([
    supabase
      .from("sistemas_tareas")
      .select("*")
      .order("created_at", { ascending: false }),

    supabase.from("perfiles").select("id,nombre,email,foto_url").eq('estado', 'ACTIVO').order("nombre"),
  ])

  if (tasks.error || people.error) throw tasks.error ?? people.error

  return { tareas: tasks.data as Tarea[], personas: people.data as Persona[] }
}

export function personasAsignadas(tarea: Pick<Tarea, 'asignados' | 'responsable'>) {
  return tarea.asignados ?? (tarea.responsable ? [tarea.responsable] : []);
}

export function indicePrioridad(value: Tarea['prioridad']) { return value === null ? -1 : PRIORIDADES.indexOf(value); }

export async function guardarTarea(tarea: Tarea, nueva: boolean) {
  const { id, revision, ...fields } = tarea

  const result = nueva
    ? await supabase
        .from("sistemas_tareas")
        .insert({ id, ...fields })
        .select("*")
        .single()
    : await supabase
        .from("sistemas_tareas")
        .update({ ...fields, revision: revision + 1 })
        .eq("id", id)
        .eq("revision", revision)
        .select("*")
        .maybeSingle()

  if (result.error) throw result.error

  if (!result.data)
    throw new Error(
      "La tarea cambió. Cierra el detalle y actualiza antes de editar.",
    )

  return result.data as Tarea
}

export async function cargarComentarios(id: string) {
  const { data, error } = await supabase
    .from("sistemas_comentarios")
    .select("*")
    .eq("tarea_id", id)
    .order("created_at")

  if (error) throw error

  return data as Comentario[]
}

export async function eliminarTarea(tarea: Tarea) {
  const { data, error } = await supabase.from('sistemas_tareas').delete()
    .eq('id', tarea.id).eq('revision', tarea.revision).select('id').maybeSingle()
  if (error?.code === '23503') throw new Error('Elimina los archivos de los comentarios antes de eliminar la tarea.')
  if (error) throw error
  if (!data) throw new Error('La tarea cambió o ya fue eliminada. Actualiza la vista antes de continuar.')
}

export async function comentar(tarea_id: string, contenido: string, documentos: string[] = [], id = crypto.randomUUID()) {
  const { data, error } = await supabase
    .rpc('publicar_comentario_sistemas', { p_id: id, p_tarea: tarea_id, p_contenido: contenido.trim(), p_documentos: documentos })
    .single()

  if (error) throw error

  return data as Comentario
}
