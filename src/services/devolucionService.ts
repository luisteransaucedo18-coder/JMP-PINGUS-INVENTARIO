import { supabase } from './supabase';
import { Entrega, Sede } from '../domain/types';
import { publicCode } from '../utils/publicCode';
import { limaDate, limaTime } from '../utils/limaDate';

type EstadoDevolucion = 'PENDIENTE_VALIDACION' | 'OBSERVADA' | 'VALIDADA';
export interface SaldoDevolucion { requerimientoId: string; requerimientoCodigo: string; skuId: string; nombre: string; unidad: string; disponible: number; }
export interface DevolucionItem { skuId: string; nombre: string; unidad: string; cantidad: number; }
export interface Devolucion { id: string; codigo: string; proyectoId: string; proyecto: string; requerimientoId: string; requerimientoCodigo: string; ubicacion: string; sedeReceptora: Sede; estado: EstadoDevolucion; analista: string; observacion?: string; createdAt: string; validadoPor?: string; fechaValidacion?: string; items: DevolucionItem[]; evidencias: string[]; historial: { estado: EstadoDevolucion; comentario?: string; actor: string; fecha: string }[]; }

export async function obtenerSaldosDevolucion(proyectoId: string): Promise<SaldoDevolucion[]> {
  const { data, error } = await supabase.rpc('obtener_saldos_devolucion', { p_proyecto_id: proyectoId });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({ requerimientoId: row.requerimiento_id, requerimientoCodigo: row.requerimiento_codigo, skuId: row.material_sku, nombre: row.material_nombre, unidad: row.unidad ?? 'UND', disponible: Number(row.cantidad_disponible) }));
}

export async function obtenerDevoluciones(): Promise<Devolucion[]> {
  const { data, error } = await supabase.from('devoluciones_materiales').select(`
    id,codigo,proyecto_id,requerimiento_id,ubicacion_proyecto,sede_receptora,estado,observacion,created_at,fecha_validacion,
    proyecto:proyectos!devoluciones_materiales_proyecto_id_fkey(nombre), requerimiento:requerimientos!devoluciones_materiales_requerimiento_id_fkey(codigo),
    analista:perfiles!devoluciones_materiales_analista_id_fkey(nombre), validador:perfiles!devoluciones_materiales_validado_por_fkey(nombre),
    items:devolucion_items(material_sku,material_nombre,unidad,cantidad), evidencias:devolucion_evidencias(storage_path),
    historial:devolucion_historial(estado,comentario,created_at,actor:perfiles!devolucion_historial_actor_id_fkey(nombre))
  `).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id, codigo: row.codigo, proyectoId: row.proyecto_id, proyecto: row.proyecto?.nombre ?? 'Proyecto', requerimientoId: row.requerimiento_id,
    requerimientoCodigo: publicCode(row.requerimiento ?? {}), ubicacion: row.ubicacion_proyecto, sedeReceptora: row.sede_receptora,
    estado: row.estado, analista: row.analista?.nombre ?? 'Analista', observacion: row.observacion ?? undefined, createdAt: row.created_at,
    validadoPor: row.validador?.nombre ?? undefined, fechaValidacion: row.fecha_validacion ?? undefined,
    items: (row.items ?? []).map((i: any) => ({ skuId: i.material_sku, nombre: i.material_nombre, unidad: i.unidad ?? 'UND', cantidad: Number(i.cantidad) })),
    evidencias: (row.evidencias ?? []).map((e: any) => e.storage_path),
    historial: (row.historial ?? []).map((h: any) => ({ estado: h.estado, comentario: h.comentario ?? undefined, actor: h.actor?.nombre ?? 'Usuario', fecha: h.created_at })),
  }));
}

async function cargarEvidencias(id: string, files: File[]): Promise<string[]> {
  const { data: auth, error: authError } = await supabase.auth.getUser();
  if (authError || !auth.user) throw authError ?? new Error('No se encontró una sesión activa.');
  const paths: string[] = [];
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${auth.user.id}/${id}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage.from('evidencias-devoluciones').upload(path, file, { contentType: file.type, upsert: false });
    if (error) { await supabase.storage.from('evidencias-devoluciones').remove(paths); throw error; }
    paths.push(path);
  }
  return paths;
}

export async function registrarDevolucion(input: { requerimientoId: string; sedeReceptora: Sede; items: DevolucionItem[]; files: File[] }): Promise<void> {
  const id = crypto.randomUUID();
  const paths = await cargarEvidencias(id, input.files);
  const { error } = await supabase.rpc('registrar_devolucion', { p_id: id, p_requerimiento_id: input.requerimientoId, p_sede_receptora: input.sedeReceptora, p_items: input.items.map(i => ({ material_sku: i.skuId, material_nombre: i.nombre, unidad: i.unidad, cantidad: i.cantidad })), p_evidencias: paths });
  if (error) { await supabase.storage.from('evidencias-devoluciones').remove(paths); throw error; }
}

export async function registrarEntrega(requerimientoId: string, tecnico: string, dni: string, observaciones: string, items: { skuId: string; nombre: string; cantidadSolicitada: number; cantidadEntregada: number }[]): Promise<{ codigo: string; fecha: string; hora: string }> {
  const { data, error } = await supabase.rpc('registrar_entrega', { p_requerimiento_id: requerimientoId, p_tecnico: tecnico, p_dni_tecnico: dni, p_observaciones: observaciones, p_items: items.map(item => ({ material_sku: item.skuId, material_nombre: item.nombre, cantidad_solicitada: item.cantidadSolicitada, cantidad_entregada: item.cantidadEntregada })) });
  if (error) throw error;
  // A failed readback must never invite a second submission of a saved delivery.
  const saved = await supabase.from('entregas').select('codigo,fecha_hora').eq('id', data).single().then(result => result.data, () => null);
  const timestamp = saved?.fecha_hora ? new Date(saved.fecha_hora) : new Date();
  return { codigo: publicCode(saved ?? {}, 'Entrega registrada'), fecha: limaDate(timestamp), hora: limaTime(timestamp) };
}

export async function obtenerEntregas(): Promise<Entrega[]> {
  const { data, error } = await supabase.from('entregas').select(`
    id,codigo,requerimiento_id,proyecto_nombre,tecnico,dni_tecnico,fecha_hora,estado,observaciones,
    requerimiento:requerimientos!entregas_requerimiento_id_fkey(codigo),
    responsable:perfiles!entregas_responsable_entrega_id_fkey(nombre),
    items:entrega_items(material_sku,material_nombre,cantidad_solicitada,cantidad_entregada)
  `).order('fecha_hora', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: any) => {
    const timestamp = new Date(row.fecha_hora);
    return {
      id: row.id,
      codigo: row.codigo,
      requerimientoCodigo: publicCode(row.requerimiento ?? {}),
      fechaHora: row.fecha_hora,
      requerimientoId: row.requerimiento_id,
      proyectoNombre: row.proyecto_nombre,
      tecnico: row.tecnico,
      dniTecnico: row.dni_tecnico ?? '',
      responsableEntrega: row.responsable?.nombre ?? 'Responsable no disponible',
      fecha: limaDate(timestamp),
      hora: limaTime(timestamp),
      estado: row.estado,
      observaciones: row.observaciones ?? undefined,
      items: (row.items ?? []).map((item: any) => ({
        skuId: item.material_sku,
        nombre: item.material_nombre,
        cantidadSolicitada: Number(item.cantidad_solicitada),
        cantidadEntregada: Number(item.cantidad_entregada),
      })),
    };
  });
}
