import { supabase } from './supabase';
import type { Material } from '../data/mockData';

type MaterialDB = {
  id: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  unidad: string | null;
  marca?: string | null;

  stock_chiclayo: number | null;
  stock_chimbote: number | null;
  stock_trujillo: number | null;

  minimo: number | null;
  estado: 'OK' | 'BAJO' | 'CRÍTICO' | 'AGOTADO';

  imagen?: string | null;
  created_at?: string;
  updated_at?: string;
};

// ======================================================
// TRANSFORMAR SUPABASE -> FRONTEND
// ======================================================

function mapMaterialDBToMaterial(m: MaterialDB): Material {
  return {
    id: m.id,
    nombre: m.nombre,
    descripcion: m.descripcion,
    categoria: m.categoria,
    unidad: 'UND',

    marca: m.marca ?? undefined,

    stockSedes: {
      Chiclayo: m.stock_chiclayo ?? 0,
      Chimbote: m.stock_chimbote ?? 0,
      Trujillo: m.stock_trujillo ?? 0,
    },

    minimo: m.minimo ?? 0,
    estado: m.estado,

    imagen: m.imagen ?? undefined,
  };
}

// ======================================================
// OBTENER TODOS LOS MATERIALES
// ======================================================

export async function obtenerMateriales(): Promise<Material[]> {
  const { data, error } = await supabase
    .from('materiales')
    .select('*')
    .order('nombre', { ascending: true });

  if (error) {
    console.error('Error obteniendo materiales:', error);
    throw error;
  }

  return (data ?? []).map(mapMaterialDBToMaterial);
}

// ======================================================
// OBTENER MATERIAL POR ID
// ======================================================

export async function obtenerMaterialPorId(
  id: string
): Promise<Material | null> {
  const { data, error } = await supabase
    .from('materiales')
    .select('*')
    .eq('id', id)
    .single();

  if (error) {
    console.error('Error obteniendo material:', error);
    throw error;
  }

  if (!data) {
    return null;
  }

  return mapMaterialDBToMaterial(data as MaterialDB);
}

// ======================================================
// CREAR MATERIAL
// ======================================================

export async function crearMaterial(material: Material) {
  const { data, error } = await supabase
    .from('materiales')
    .insert([
      {
        id: material.id,
        nombre: material.nombre,
        descripcion: material.descripcion,
        categoria: material.categoria,
        unidad: material.unidad,
        marca: material.marca ?? null,

        stock_chiclayo: material.stockSedes.Chiclayo,
        stock_chimbote: material.stockSedes.Chimbote,
        stock_trujillo: material.stockSedes.Trujillo,

        minimo: material.minimo,
        estado: material.estado,

        imagen: material.imagen ?? null,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error('Error creando material:', error);
    throw error;
  }

  return mapMaterialDBToMaterial(data as MaterialDB);
}

// ======================================================
// ACTUALIZAR MATERIAL
// ======================================================

export async function actualizarMaterial(
  id: string,
  cambios: Partial<Material>
) {
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (cambios.nombre !== undefined) {
    payload.nombre = cambios.nombre;
  }

  if (cambios.descripcion !== undefined) {
    payload.descripcion = cambios.descripcion;
  }

  if (cambios.categoria !== undefined) {
    payload.categoria = cambios.categoria;
  }

  if (cambios.unidad !== undefined) {
    payload.unidad = cambios.unidad;
  }

  if (cambios.marca !== undefined) {
    payload.marca = cambios.marca;
  }

  if (cambios.minimo !== undefined) {
    payload.minimo = cambios.minimo;
  }

  if (cambios.estado !== undefined) {
    payload.estado = cambios.estado;
  }

  if (cambios.imagen !== undefined) {
    payload.imagen = cambios.imagen;
  }

  if (cambios.stockSedes !== undefined) {
    payload.stock_chiclayo = cambios.stockSedes.Chiclayo;
    payload.stock_chimbote = cambios.stockSedes.Chimbote;
    payload.stock_trujillo = cambios.stockSedes.Trujillo;
  }

  const { data, error } = await supabase
    .from('materiales')
    .update(payload)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Error actualizando material:', error);
    throw error;
  }

  return mapMaterialDBToMaterial(data as MaterialDB);
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