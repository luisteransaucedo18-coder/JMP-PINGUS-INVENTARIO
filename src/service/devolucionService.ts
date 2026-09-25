import { supabase } from './supabase';
import { Sede } from '../data/mockData';

export type EstadoDevolucion = 'PENDIENTE_VALIDACION' | 'OBSERVADA' | 'VALIDADA';
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
    requerimientoCodigo: row.requerimiento?.codigo ?? row.requerimiento_id, ubicacion: row.ubicacion_proyecto, sedeReceptora: row.sede_receptora,
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

export async function resolverDevolucion(id: string, validar: boolean, observacion?: string): Promise<void> {
  const { error } = await supabase.rpc('resolver_devolucion', { p_id: id, p_validar: validar, p_observacion: observacion ?? null });
  if (error) throw error;
}

export async function corregirDevolucion(input: { id: string; sedeReceptora: Sede; items: DevolucionItem[]; evidenciasActuales: string[]; files: File[] }): Promise<void> {
  const nuevas = await cargarEvidencias(input.id, input.files);
  const evidencias = [...input.evidenciasActuales, ...nuevas];
  const { error } = await supabase.rpc('corregir_devolucion', { p_id: input.id, p_sede_receptora: input.sedeReceptora, p_items: input.items.map(i => ({ material_sku: i.skuId, material_nombre: i.nombre, unidad: i.unidad, cantidad: i.cantidad })), p_evidencias: evidencias });
  if (error) { await supabase.storage.from('evidencias-devoluciones').remove(nuevas); throw error; }
}

export async function obtenerUrlEvidencia(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('evidencias-devoluciones').createSignedUrl(path, 60 * 10);
  if (error || !data?.signedUrl) throw error ?? new Error('No se pudo abrir la evidencia.');
  return data.signedUrl;
}

export async function registrarEntrega(requerimientoId: string, tecnico: string, dni: string, observaciones: string, items: { skuId: string; nombre: string; cantidadSolicitada: number; cantidadEntregada: number }[]): Promise<string> {
  const { data, error } = await supabase.rpc('registrar_entrega', { p_requerimiento_id: requerimientoId, p_tecnico: tecnico, p_dni_tecnico: dni, p_observaciones: observaciones, p_items: items.map(item => ({ material_sku: item.skuId, material_nombre: item.nombre, cantidad_solicitada: item.cantidadSolicitada, cantidad_entregada: item.cantidadEntregada })) });
  if (error) throw error;
  return data;
}
