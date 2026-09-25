import type { Proyecto, Requerimiento, ReqMaterial, Sede } from '../data/mockData';
import { supabase } from './supabase';

type DbRequirement = {
  id: string; codigo: string; sede: Sede; ubicacion: string; descripcion: string; tecnico: string;
  fecha: string; estado: Requerimiento['estado']; observaciones: string | null; fecha_confirmacion: string | null;
  proyecto: { id: string; nombre: string } | null;
  analista: { nombre: string } | null;
  coordinador: { nombre: string } | null;
  items: Array<{ material_sku: string; material_nombre: string; cantidad: number; unidad: string | null; marca: string | null }> | null;
};

const REQUIREMENT_SELECT = `id,codigo,sede,ubicacion,descripcion,tecnico,fecha,estado,observaciones,fecha_confirmacion,
  proyecto:proyectos!requerimientos_proyecto_id_fkey(id,nombre),
  analista:perfiles!requerimientos_analista_id_fkey(nombre),
  coordinador:perfiles!requerimientos_confirmado_por_fkey(nombre),
  items:requerimiento_items(material_sku,material_nombre,cantidad,unidad,marca)`;

function mapRequirement(row: DbRequirement): Requerimiento {
  return {
    id: row.id, codigo: row.codigo, proyectoId: row.proyecto?.id ?? '', proyecto: row.proyecto?.nombre ?? 'Proyecto eliminado',
    sede: row.sede, ubicacion: row.ubicacion, descripcion: row.descripcion, tecnico: row.tecnico,
    analista: row.analista?.nombre ?? 'Analista', fecha: row.fecha, estado: row.estado,
    observaciones: row.observaciones ?? undefined, confirmadoPor: row.coordinador?.nombre ?? undefined,
    fechaConfirmacion: row.fecha_confirmacion ?? undefined,
    materiales: (row.items ?? []).map(item => ({ skuId: item.material_sku, nombre: item.material_nombre,
      cantidad: Number(item.cantidad), unidad: item.unidad ?? undefined, marca: item.marca ?? undefined })),
  };
}

export async function obtenerRequerimientos(): Promise<Requerimiento[]> {
  const { data, error } = await supabase.from('requerimientos').select(REQUIREMENT_SELECT).order('created_at', { ascending: false });
  if (error) throw error;
  return ((data ?? []) as unknown as DbRequirement[]).map(mapRequirement);
}

export async function obtenerProyectos(): Promise<Proyecto[]> {
  const { data, error } = await supabase.from('proyectos').select('id,nombre,ubicacion,sede,responsable,cliente,observaciones,created_at').eq('activo', true).order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(project => ({ id: project.id, nombre: project.nombre, ubicacion: project.ubicacion,
    sede: project.sede as Sede, responsable: project.responsable, cliente: project.cliente,
    observaciones: project.observaciones ?? undefined, creadoEn: project.created_at.slice(0, 10) }));
}

export async function crearProyecto(data: Omit<Proyecto, 'id' | 'creadoEn'>): Promise<Proyecto> {
  const { data: project, error } = await supabase.from('proyectos').insert({ nombre: data.nombre.trim(), ubicacion: data.ubicacion.trim(), sede: data.sede,
    responsable: data.responsable.trim(), cliente: data.cliente.trim(), observaciones: data.observaciones?.trim() || null }).select('id,nombre,ubicacion,sede,responsable,cliente,observaciones,created_at').single();
  if (error) throw error;
  return { id: project.id, nombre: project.nombre, ubicacion: project.ubicacion, sede: project.sede as Sede,
    responsable: project.responsable, cliente: project.cliente, observaciones: project.observaciones ?? undefined, creadoEn: project.created_at.slice(0, 10) };
}

export async function crearSolicitud(input: { proyectoId: string; sede: Sede; ubicacion: string; descripcion: string; tecnico: string; materiales: ReqMaterial[]; borrador: boolean }): Promise<string> {
  const { data, error } = await supabase.rpc('crear_requerimiento', {
    p_proyecto_id: input.proyectoId, p_sede: input.sede, p_ubicacion: input.ubicacion.trim(), p_descripcion: input.descripcion.trim(),
    p_tecnico: input.tecnico.trim(), p_materiales: input.materiales.map(item => ({ material_sku: item.skuId, material_nombre: item.nombre, cantidad: item.cantidad })),
    p_enviar: !input.borrador,
  });
  if (error) throw error;
  return data as string;
}

export async function enviarSolicitud(id: string) {
  const { error } = await supabase.rpc('enviar_requerimiento', { p_id: id });
  if (error) throw error;
}

export async function revisarSolicitud(id: string, confirmar: boolean, observaciones?: string) {
  const { error } = await supabase.rpc('revisar_requerimiento', { p_requerimiento_id: id, p_confirmar: confirmar, p_observaciones: observaciones?.trim() || null });
  if (error) throw error;
}
