import { supabase } from './supabase';

export interface MaterialSupabase {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  unidad: string;
  marca?: string | null;

  stock_chiclayo: number;
  stock_chimbote: number;
  stock_trujillo: number;

  minimo: number;
  estado: 'OK' | 'BAJO' | 'CRÍTICO' | 'AGOTADO';

  imagen?: string | null;

  created_at?: string;
  updated_at?: string;
}

// ======================================================
// OBTENER TODOS
// ======================================================

export async function obtenerMateriales() {
  const { data, error } = await supabase
    .from('materiales')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error obteniendo materiales:', error);
    throw error;
  }

  return data ?? [];
}

// ======================================================
// CREAR MATERIAL
// ======================================================

export async function crearMaterial(
  material: Omit<
    MaterialSupabase,
    'created_at' | 'updated_at'
  >
) {
  const { data, error } = await supabase
    .from('materiales')
    .insert([material])
    .select()
    .single();

  if (error) {
    console.error('Error creando material:', error);
    throw error;
  }

  return data;
}

// ======================================================
// ACTUALIZAR MATERIAL
// ======================================================

export async function actualizarMaterial(
  id: string,
  cambios: Partial<MaterialSupabase>
) {
  const { data, error } = await supabase
    .from('materiales')
    .update({
      ...cambios,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando material:', error);
    throw error;
  }

  return data;
}

// ======================================================
// ELIMINAR MATERIAL
// ======================================================

export async function eliminarMaterial(id: string) {
  const { error } = await supabase
    .from('materiales')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error eliminando material:', error);
    throw error;
  }

  return true;
}