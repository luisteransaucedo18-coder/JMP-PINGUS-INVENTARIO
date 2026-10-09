import { supabase } from "./supabase"
import { estadoGeneral } from '../utils/inventoryStatus'
import { validRollLength, validStockQuantity } from '../utils/stockQuantity'

import type { Material, Sede } from "../domain/types"

type MaterialDB = {
  sku: string

  nombre: string

  descripcion: string

  categoria_id: number

  unidad: string | null
  metros_por_rollo?: number | null

  marca?: string | null

  stock_minimo: number | null

  precio_unitario: number | null

  estado: "OK" | "BAJO" | "CRÍTICO" | "AGOTADO"

  imagen_url?: string | null

  created_at?: string

  updated_at?: string
}

// ======================================================

// TRANSFORMAR SUPABASE -> FRONTEND

// ======================================================

function mapMaterialDBToMaterial(m: MaterialDB): Material {
  return {
    id: m.sku,

    nombre: m.nombre,

    descripcion: m.descripcion,

    categoria: String(m.categoria_id),

    unidad: m.unidad?.trim() || "UND",
    metrosPorRollo: m.metros_por_rollo == null ? undefined : Number(m.metros_por_rollo),

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
  }
}

async function obtenerStockSedes(materialSku: string): Promise<Material["stockSedes"]> {
  const { data, error } = await supabase
    .from("inventario_sedes")
    .select("sede,stock")
    .eq("material_sku", materialSku)

  if (error) throw error

  const stockSedes: Material["stockSedes"] = {
    Chiclayo: 0,
    Chimbote: 0,
    Trujillo: 0,
  }

  for (const row of data ?? []) {
    if (
      row.sede === "Chiclayo" ||
      row.sede === "Chimbote" ||
      row.sede === "Trujillo"
    ) {
      stockSedes[row.sede as Sede] = Number(row.stock ?? 0)
    }
  }

  return stockSedes
}

// ======================================================

// OBTENER TODOS LOS MATERIALES

// ======================================================

export async function obtenerCategoriasMaterial(): Promise<Array<{ id: string; nombre: string }>> {
  const { data, error } = await supabase.from('categorias_material').select('id,nombre').order('nombre');
  if (error) throw error;
  return (data ?? []).map(categoria => ({ id: String(categoria.id), nombre: categoria.nombre }));
}

export async function obtenerMateriales(): Promise<Material[]> {
  const [{ data, error }, { data: inventario, error: inventoryError }] =
    await Promise.all([
      supabase
        .from("materiales")
        .select("*")
        .order("nombre", { ascending: true }),

      supabase.from("inventario_sedes").select("material_sku,sede,stock"),
    ])

  if (error || inventoryError) {
    console.error("Error obteniendo materiales:", error)

    throw error ?? inventoryError
  }

  const stockPorSku = new Map<string, Material["stockSedes"]>()

  for (const row of inventario ?? []) {
    const stock = stockPorSku.get(row.material_sku) ?? {
      Chiclayo: 0,
      Chimbote: 0,
      Trujillo: 0,
    }

    if (
      row.sede === "Chiclayo" ||
      row.sede === "Chimbote" ||
      row.sede === "Trujillo"
    )
      stock[(row.sede as Sede)] = Number(row.stock ?? 0)

    stockPorSku.set(row.material_sku, stock)
  }

  return (data ?? []).map((material) => {
    const mapped = { ...mapMaterialDBToMaterial(material), stockSedes: stockPorSku.get(material.sku) ?? {
      Chiclayo: 0,
      Chimbote: 0,
      Trujillo: 0,
    } }
    return { ...mapped, estado: estadoGeneral(mapped) }
  })
}

// ======================================================

// CREAR MATERIAL

// ======================================================

export async function crearMaterial(material: Material) {
  validateQuantities(material);
  const { data, error } = await supabase.rpc("crear_material_con_inventario", {
    p_material: {
      sku: material.id,
      nombre: material.nombre,
      descripcion: material.descripcion,
      categoria_id: Number(material.categoria),
      unidad: material.unidad,
      metros_por_rollo: material.metrosPorRollo ?? null,
      marca: material.marca ?? null,
      stock_minimo: material.minimo,
      precio_unitario: material.precioUnitario,
      estado: material.estado,
      imagen_url: material.imagen ?? null,
    },
    p_stock_sedes: material.stockSedes,
  })

  if (error) {
    console.error("Error creando material:", error)

    throw error
  }

  return {
    ...mapMaterialDBToMaterial(data as MaterialDB),
    stockSedes: material.stockSedes,
  }
}

// ======================================================

// ACTUALIZAR MATERIAL

// ======================================================

export async function actualizarMaterial(
  id: string,

  cambios: Partial<Material>,
  anterior?: Material,
) {
  validateQuantities(cambios);
  const payload: Record<string, unknown> = {}
  if (cambios.stockSedes) {
    if (!anterior || anterior.id !== id) throw new Error('Actualiza el inventario antes de editar el stock.');
    payload.inventario_esperado = { stock_sedes: anterior.stockSedes, unidad: anterior.unidad,
      metros_por_rollo: anterior.metrosPorRollo ?? null, stock_minimo: anterior.minimo };
  }

  if (cambios.nombre !== undefined) {
    payload.nombre = cambios.nombre
  }

  if (cambios.descripcion !== undefined) {
    payload.descripcion = cambios.descripcion
  }

  if (cambios.categoria !== undefined) {
    payload.categoria_id = Number(cambios.categoria)
  }

  if (cambios.unidad !== undefined) {
    payload.unidad = cambios.unidad
  }
  if (cambios.metrosPorRollo !== undefined) payload.metros_por_rollo = cambios.metrosPorRollo || null;

  if (cambios.marca !== undefined) {
    payload.marca = cambios.marca
  }

  if (cambios.minimo !== undefined) {
    payload.stock_minimo = cambios.minimo
  }

  if (cambios.estado !== undefined) {
    payload.estado = cambios.estado
  }

  if (cambios.imagen !== undefined) {
    payload.imagen_url = cambios.imagen
  }

  const { data, error } = await supabase.rpc("actualizar_material_con_inventario", {
    p_sku: id,
    p_campos: payload,
    p_stock_sedes: cambios.stockSedes ?? null,
  })

  if (error) {
    console.error("Error actualizando material:", error)

    throw error
  }

  return {
    ...mapMaterialDBToMaterial(data as MaterialDB),
    stockSedes: cambios.stockSedes ?? await obtenerStockSedes(id),
  }
}

function validateQuantities(material: Partial<Material>) {
  if (material.stockSedes && Object.values(material.stockSedes).some(stock => !validStockQuantity(stock)))
    throw new Error('El stock debe ser válido, no negativo y tener hasta tres decimales.');
  if (material.minimo !== undefined && !validStockQuantity(material.minimo))
    throw new Error('Indica un mínimo válido con hasta tres decimales.');
  if (material.metrosPorRollo !== undefined && material.metrosPorRollo !== 0 && !validRollLength(material.metrosPorRollo))
    throw new Error('Indica una longitud de rollo válida con hasta tres decimales.');
}
