import type { CompraItem, RequerimientoCompra, Sede } from '../domain/types';
import { supabase } from './supabase';

export async function obtenerCompras(): Promise<RequerimientoCompra[]> {
  const { data, error } = await supabase.from('ordenes_compra').select(`
    id,codigo,requerimiento_id,sede,fecha,motivo,estado,observaciones,fecha_aprobacion,fecha_compra,nota_compra,
    analista:perfiles!ordenes_compra_analista_id_fkey(nombre),
    coordinador:perfiles!ordenes_compra_coordinador_id_fkey(nombre),
    items:orden_compra_items(material_sku,material_nombre,cantidad_solicitada,precio_unitario)
  `).order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => ({
    uuid: row.id,
    requerimientoId: row.requerimiento_id ?? undefined,
    id: row.codigo,
    sede: row.sede as Sede,
    analista: row.analista?.nombre ?? 'Analista',
    fecha: row.fecha,
    motivo: row.motivo,
    estado: row.estado,
    coordinador: row.coordinador?.nombre ?? undefined,
    observaciones: row.observaciones ?? undefined,
    fechaAprobacion: row.fecha_aprobacion ?? undefined,
    fechaCompra: row.fecha_compra ?? undefined,
    notaCompra: row.nota_compra ?? undefined,
    items: (row.items ?? []).map((item: any) => ({
      skuId: item.material_sku ?? '',
      nombre: item.material_nombre,
      cantidadSolicitada: Number(item.cantidad_solicitada),
      precioUnitario: item.precio_unitario == null ? undefined : Number(item.precio_unitario),
    })),
  }));
}

export async function crearCompra(input: { sede: Sede; motivo: string; items: CompraItem[]; borrador: boolean }) {
  const { error } = await supabase.rpc('crear_orden_compra', {
    p_sede: input.sede,
    p_motivo: input.motivo.trim(),
    p_items: input.items.map(item => ({
      material_sku: item.skuId || null,
      material_nombre: item.nombre,
      cantidad_solicitada: item.cantidadSolicitada,
      precio_unitario: item.precioUnitario ?? null,
    })),
    p_borrador: input.borrador,
  });
  if (error) throw error;
}

export async function revisarCompra(id: string, aprobar: boolean, observaciones?: string) {
  const { error } = await supabase.rpc('revisar_orden_compra', {
    p_id: id,
    p_aprobar: aprobar,
    p_observaciones: observaciones?.trim() || null,
  });
  if (error) throw error;
}

export async function confirmarCompra(id: string, notaCompra?: string) {
  const { error } = await supabase.rpc('confirmar_orden_compra', {
    p_id: id,
    p_nota_compra: notaCompra?.trim() || null,
  });
  if (error) throw error;
}

export async function cancelarCompra(id: string, motivo: string) {
  const { error } = await supabase.rpc('cancelar_orden_compra', {
    p_id: id,
    p_motivo: motivo.trim(),
  });
  if (error) throw error;
}
