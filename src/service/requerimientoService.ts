import type { Requerimiento, ReqMaterial, Sede } from '../data/mockData';
import { supabase } from './supabase';

type RequerimientoViewRow = {
  id: string;
  codigo: string;
  proyecto_id: string;
  proyecto_codigo: string;
  proyecto: string;
  sede: Sede;
  ubicacion: string;
  descripcion: string;
  tecnico: string;
  analista: string;
  fecha: string;
  estado: Requerimiento['estado'];
  observaciones: string | null;
  confirmado_por_nombre: string | null;
  fecha_confirmacion: string | null;
  materiales: ReqMaterial[] | null;
};

export interface NuevoRequerimiento {
  proyectoDbId: string;
  sede: Sede;
  ubicacion: string;
  descripcion: string;
  tecnico: string;
  materiales: ReqMaterial[];
  draft: boolean;
}

function mapRequerimiento(row: RequerimientoViewRow): Requerimiento {
  return {
    dbId: row.id,
    id: row.codigo,
    proyectoId: row.proyecto_codigo,
    proyecto: row.proyecto,
    sede: row.sede,
    ubicacion: row.ubicacion,
    descripcion: row.descripcion,
    tecnico: row.tecnico,
    analista: row.analista,
    fecha: row.fecha,
    estado: row.estado,
    observaciones: row.observaciones ?? undefined,
    confirmadoPor: row.confirmado_por_nombre ?? undefined,
    fechaConfirmacion: row.fecha_confirmacion ?? undefined,
    materiales: Array.isArray(row.materiales) ? row.materiales.map(item => ({
      skuId: item.skuId,
      nombre: item.nombre,
      cantidad: Number(item.cantidad),
    })) : [],
  };
}

async function obtenerPorDbId(dbId: string): Promise<Requerimiento> {
  const { data, error } = await supabase
    .from('v_requerimientos')
    .select('*')
    .eq('id', dbId)
    .single();

  if (error) throw error;
  return mapRequerimiento(data as RequerimientoViewRow);
}

export async function obtenerRequerimientos(): Promise<Requerimiento[]> {
  const { data, error } = await supabase
    .from('v_requerimientos')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(row => mapRequerimiento(row as RequerimientoViewRow));
}

export async function crearRequerimiento(payload: NuevoRequerimiento): Promise<Requerimiento> {
  const { data, error } = await supabase.rpc('crear_requerimiento', {
    p_proyecto_id: payload.proyectoDbId,
    p_sede: payload.sede,
    p_ubicacion: payload.ubicacion,
    p_descripcion: payload.descripcion,
    p_tecnico: payload.tecnico,
    p_materiales: payload.materiales.map(item => ({
      material_sku: item.skuId,
      material_nombre: item.nombre,
      cantidad: item.cantidad,
    })),
    p_enviar: !payload.draft,
  });

  if (error) throw error;
  return obtenerPorDbId(data as string);
}

export async function enviarRequerimiento(requerimiento: Requerimiento): Promise<Requerimiento> {
  if (!requerimiento.dbId) throw new Error('El requerimiento no tiene identificador de base de datos.');

  const { error } = await supabase
    .from('requerimientos')
    .update({ estado: 'ENVIADO' })
    .eq('id', requerimiento.dbId)
    .eq('estado', 'BORRADOR')
    .select('id')
    .single();

  if (error) throw error;
  return obtenerPorDbId(requerimiento.dbId);
}

export async function revisarRequerimiento(
  requerimiento: Requerimiento,
  confirmar: boolean,
  observaciones?: string,
): Promise<Requerimiento> {
  if (!requerimiento.dbId) throw new Error('El requerimiento no tiene identificador de base de datos.');

  const { error } = await supabase.rpc('revisar_requerimiento', {
    p_requerimiento_id: requerimiento.dbId,
    p_confirmar: confirmar,
    p_observaciones: observaciones ?? null,
  });

  if (error) throw error;
  return obtenerPorDbId(requerimiento.dbId);
}
