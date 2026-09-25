import { supabase } from './supabase';
import type { Material } from '../data/mockData';

type MaterialDB = {
  sku: string;
  nombre: string;
  descripcion: string;
  categoria_id: number;
  unidad: string | null;
  marca?: string | null;
  stock_minimo: number | null;
  precio_unitario: number | null;
  estado: 'OK' | 'BAJO' | 'CRÍTICO' | 'AGOTADO';
  imagen_url?: string | null;
  created_at?: string;
  updated_at?: string;
};

// ======================================================
// TRANSFORMAR SUPABASE -> FRONTEND
// ======================================================

function mapMaterialDBToMaterial(m: MaterialDB): Material {
  return {
    id: m.sku,
    nombre: m.nombre,
    descripcion: m.descripcion,
    categoria: String(m.categoria_id),

    unidad: m.unidad?.trim() || 'UND',
    marca: m.marca ?? undefined,

    stockSedes: {
      Chiclayo: 0,
      Chimbote: 0,
      Trujillo: 0,
    },

    minimo: Number(m.stock_minimo ?? 0),
    precioUnitario: Number(m.precio_unitario ?? 0),
    estado: m.estado,

    // URL que guardaste en Supabase
    imagen: m.imagen_url ?? undefined,
  };
}
// ======================================================
// OBTENER TODOS LOS MATERIALES
// ======================================================

export async function obtenerMateriales(): Promise<Material[]> {
  const [{ data, error }, { data: inventario, error: inventoryError }] = await Promise.all([
    supabase.from('materiales').select('*').order('nombre', { ascending: true }),
    supabase.from('inventario_sedes').select('material_sku,sede,stock'),
  ]);

  if (error || inventoryError) {
    console.error('Error obteniendo materiales:', error);
    throw error ?? inventoryError;
  }

  const stockPorSku = new Map<string, Material['stockSedes']>();
  for (const row of inventario ?? []) {
    const stock = stockPorSku.get(row.material_sku) ?? { Chiclayo: 0, Chimbote: 0, Trujillo: 0 };
    if (row.sede === 'Chiclayo' || row.sede === 'Chimbote' || row.sede === 'Trujillo') stock[row.sede] = Number(row.stock ?? 0);
    stockPorSku.set(row.material_sku, stock);
  }
  return (data ?? []).map(material => ({ ...mapMaterialDBToMaterial(material), stockSedes: stockPorSku.get(material.sku) ?? { Chiclayo: 0, Chimbote: 0, Trujillo: 0 } }));
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
    .eq('sku', id)
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
        sku: material.id,
        nombre: material.nombre,
        descripcion: material.descripcion,
        categoria: material.categoria,  
        unidad: material.unidad,
        marca: material.marca ?? null,

        stock_chiclayo: material.stockSedes.Chiclayo,
        stock_chimbote: material.stockSedes.Chimbote,
        stock_trujillo: material.stockSedes.Trujillo,

        minimo: material.minimo,
        precio_unitario: material.precioUnitario,
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
    .eq('sku', id)
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
    .eq('sku', id);

  if (error) {
    console.error('Error eliminando material:', error);
    throw error;
  }

  return true;
}
