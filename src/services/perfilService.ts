import { validateTextFields, validateText, validEmail, validatePhone } from "../utils/formValidation"
import { supabase } from "./supabase"

export interface Perfil {
  id: string

  codigo?: string | null

  nombre: string

  email: string

  rol: "gerente" | "analista" | "coordinador"

  sede: "Chiclayo" | "Chimbote" | "Trujillo" | null

  estado: "ACTIVO" | "INACTIVO"

  telefono?: string | null

  cargo?: string | null

  bio?: string | null

  foto_path?: string | null

  foto_url?: string | null

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
  validateTextFields(perfil)
  if (perfil.telefono) validatePhone(perfil.telefono)
  validateText(perfil.nombre, "Nombre", 150, true)
  if (!validEmail(perfil.email)) throw new Error("Correo electrónico inválido.")
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
  validateTextFields(cambios)
  if (cambios.telefono) validatePhone(cambios.telefono)
  if (cambios.email !== undefined && !validEmail(cambios.email)) throw new Error("Correo electrónico inválido.")
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

export async function obtenerMiPerfil(): Promise<Perfil> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Tu sesión terminó. Inicia sesión nuevamente.');
  const { data, error } = await supabase.from('perfiles').select('*').eq('id', user.id).single();
  if (error || !data || data.id !== user.id) throw new Error('No se pudo cargar tu perfil. Inténtalo nuevamente.');
  if (data.estado !== 'ACTIVO' || !['gerente', 'analista', 'coordinador'].includes(data.rol)) throw new Error('Tu cuenta no tiene acceso activo al sistema.');
  return data as Perfil;
}

export type DatosPersonales = { nombre: string; telefono: string; cargo: string; bio: string };
export async function guardarMiPerfil(fields: DatosPersonales, fotoPath?: string): Promise<Perfil> {
  validateTextFields(fields);
  validateText(fields.nombre, 'Nombre', 150, true);
  validatePhone(fields.telefono);
  const { data, error } = await supabase.rpc('actualizar_mi_perfil', {
    p_nombre: fields.nombre.trim(), p_telefono: fields.telefono.trim(), p_cargo: fields.cargo.trim(),
    p_bio: fields.bio.trim(), p_foto_path: fotoPath ?? null,
  }).single();
  if (error || !data) throw new Error('No se pudo guardar tu perfil. Tus cambios siguen disponibles para reintentar.');
  return data as Perfil;
}
