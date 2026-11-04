import { supabase } from './supabase';

export type ListaTarea = { id: string; tarea_id: string; titulo: string; revision: number };
export type PropiedadesSubtarea = { responsable: string | null; fecha_objetivo: string | null; prioridad: 'Baja' | 'Media' | 'Alta' | 'Urgente' };
export type PasoTarea = PropiedadesSubtarea & { id: string; tarea_id: string; lista_id: string | null; tipo: 'SUBTAREA' | 'CONTROL'; titulo: string; completado: boolean; revision: number };
export function progresoTarea(pasos: Pick<PasoTarea, 'completado'>[]) {
  const completos = pasos.filter(p => p.completado).length;
  return { completos, total: pasos.length, porcentaje: pasos.length ? Math.round(completos / pasos.length * 100) : 0 };
}
export async function cargarPasos(tareaId: string) {
  const [listas, pasos] = await Promise.all([
    supabase.from('sistemas_listas').select('*').eq('tarea_id', tareaId).order('created_at'),
    supabase.from('sistemas_pasos').select('*').eq('tarea_id', tareaId).order('created_at'),
  ]);
  if (listas.error || pasos.error) throw listas.error ?? pasos.error;
  return { listas: listas.data as ListaTarea[], pasos: pasos.data as PasoTarea[] };
}
export async function crearLista(tareaId: string, titulo: string) {
  const { data, error } = await supabase.from('sistemas_listas').insert({ tarea_id: tareaId, titulo: titulo.trim() }).select('*').single();
  if (error) throw error;
  return data as ListaTarea;
}
export async function crearPaso(tareaId: string, titulo: string, listaId?: string, propiedades?: PropiedadesSubtarea) {
  const { data, error } = await supabase.from('sistemas_pasos').insert({ tarea_id: tareaId, titulo: titulo.trim(), tipo: listaId ? 'CONTROL' : 'SUBTAREA', lista_id: listaId ?? null, ...propiedades }).select('*').single();
  if (error) throw error;
  return data as PasoTarea;
}
export async function actualizarPaso(paso: PasoTarea, campos: Pick<PasoTarea, 'titulo' | 'completado'>) {
  const { data, error } = await supabase.from('sistemas_pasos').update({ ...campos, titulo: campos.titulo.trim(), revision: paso.revision + 1 }).eq('id', paso.id).eq('revision', paso.revision).select('*').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Este elemento cambió en otra sesión. Actualiza antes de editar.');
  return data as PasoTarea;
}
export async function eliminarPaso(paso: PasoTarea) {
  const { data, error } = await supabase.from('sistemas_pasos').delete().eq('id', paso.id).eq('revision', paso.revision).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Este elemento cambió o ya fue eliminado. Actualiza el detalle.');
}
export async function eliminarLista(lista: ListaTarea) {
  const { data, error } = await supabase.from('sistemas_listas').delete().eq('id', lista.id).eq('revision', lista.revision).select('id').maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('La lista cambió o ya fue eliminada. Actualiza el detalle.');
}
