import { supabase } from "./supabase"

interface Perfil {
  id: string

  codigo?: string | null

  nombre: string

  email: string

  rol: "gerente" | "analista" | "coordinador"

  sede: "Chiclayo" | "Chimbote" | "Trujillo"

  estado: "ACTIVO" | "INACTIVO"

  telefono?: string | null

  cargo?: string | null

  bio?: string | null

  ultimo_acceso?: string | null

  created_at?: string

  updated_at?: string
}

export type NuevoPerfil = Omit<Perfil, "id" | "codigo" | "created_at" | "updated_at">

export type CambiosPerfil = Partial<Omit<Perfil, "id" | "codigo" | "created_at" | "updated_at">>

// Obtener todos los perfiles

export async function obtenerPerfiles() {
  const { data, error } = await supabase

    .from("perfiles")

    .select("*")

    .order("nombre", { ascending: true })

  if (error) {
    console.error("Error obteniendo perfiles:", error)

    throw error
  }

  return data
}

// Crear perfil

export async function crearPerfil(perfil: NuevoPerfil) {
  const { data, error } = await supabase

    .from("perfiles")

    .insert([perfil])

    .select()

    .single()

  if (error) {
    console.error("Error creando perfil:", error)

    throw error
  }

  return data
}

// Actualizar perfil

export async function actualizarPerfil(id: string, cambios: CambiosPerfil) {
  const { data, error } = await supabase

    .from("perfiles")

    .update({
      ...cambios,

      updated_at: new Date().toISOString(),
    })

    .eq("id", id)

    .select()

    .single()

  if (error) {
    console.error("Error actualizando perfil:", error)

    throw error
  }

  return data
}
