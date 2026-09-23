import { supabase } from './supabase'

// Obtener todos los perfiles
export async function obtenerPerfiles() {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .order('nombre', { ascending: true })

  if (error) {
    console.error('Error obteniendo perfiles:', error)
    throw error
  }

  return data
}


// Obtener un perfil por ID
export async function obtenerPerfilPorId(id) {
  const { data, error } = await supabase
    .from('perfiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    console.error('Error obteniendo perfil:', error)
    throw error
  }

  return data
}


// Crear perfil
export async function crearPerfil(perfil) {
  const { data, error } = await supabase
    .from('perfiles')
    .insert([perfil])
    .select()
    .single()

  if (error) {
    console.error('Error creando perfil:', error)
    throw error
  }

  return data
}


// Actualizar perfil
export async function actualizarPerfil(id, cambios) {
  const { data, error } = await supabase
    .from('perfiles')
    .update({
      ...cambios,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error actualizando perfil:', error)
    throw error
  }

  return data
}


// Eliminar perfil
export async function eliminarPerfil(id) {
  const { error } = await supabase
    .from('perfiles')
    .delete()
    .eq('id', id)

  if (error) {
    console.error('Error eliminando perfil:', error)
    throw error
  }

  return true
}