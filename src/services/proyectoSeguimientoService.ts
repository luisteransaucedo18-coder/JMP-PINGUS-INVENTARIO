import { supabase } from './supabase';
import { validateProfilePhoto } from '../utils/profilePhoto';
import type { Proyecto } from '../domain/types';
import type { EstadoObra, EtapaEvidencia, EvidenciaProyecto, IncidenciaProyecto } from '../features/proyectos/seguimiento';

const BUCKET = 'proyectos-evidencias';
export function errorSeguimiento(error: unknown) {
  return error && typeof error === 'object' && 'message' in error ? String(error.message) : 'No se pudo completar la operación. Intenta nuevamente.';
}
export async function obtenerSeguimientoProyecto(id: string) {
  const [photos, incidents] = await Promise.all([
    supabase.from('proyecto_evidencias').select('*').eq('proyecto_id', id).order('created_at', { ascending: false }),
    supabase.from('proyecto_incidencias').select('*').eq('proyecto_id', id).order('created_at', { ascending: false }),
  ]);
  if (photos.error || incidents.error) throw photos.error ?? incidents.error;
  const evidencias = (photos.data ?? []) as EvidenciaProyecto[];
  let fotosNoDisponibles = false;
  if (evidencias.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(evidencias.map(e => e.ruta), 3600);
    const urls = new Map((data ?? []).map(item => [item.path, item.signedUrl]));
    for (const photo of evidencias) photo.url = urls.get(photo.ruta) ?? undefined;
    fotosNoDisponibles = Boolean(error) || evidencias.some(photo => !photo.url);
  }
  return { evidencias, incidencias: (incidents.data ?? []) as IncidenciaProyecto[], fotosNoDisponibles };
}
export async function actualizarAvanceProyecto(proyecto: Proyecto, estado: EstadoObra, fecha: string) {
  const { data, error } = await supabase.from('proyectos').update({ estado_obra: estado, fecha_finalizacion: estado === 'FINALIZADO' ? fecha : null })
    .eq('id', proyecto.id).eq('revision_obra', proyecto.revisionObra ?? 0).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('El proyecto cambió o no tienes permiso. Actualiza la vista antes de guardar.');
}
export async function adjuntarEvidenciaProyecto(id: string, etapa: EtapaEvidencia, file: File, descripcion: string, incidenciaId?: string) {
  const extension = await validateProfilePhoto(file);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Inicia sesión nuevamente.');
  const archivoId = crypto.randomUUID();
  const ruta = `${id}/${user.id}/${archivoId}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  const { error: registroError } = await supabase.from('proyecto_evidencias').insert({ id: archivoId, proyecto_id: id,
    incidencia_id: incidenciaId ?? null, etapa, ruta, nombre: file.name, descripcion: descripcion.trim() });
  if (registroError) {
    const { error: cleanupError } = await supabase.storage.from(BUCKET).remove([ruta]);
    if (cleanupError) console.error('No se pudo limpiar la fotografía sin vincular:', cleanupError);
    throw registroError;
  }
}
export async function registrarIncidenciaProyecto(id: string, datos: { proyecto_id: string; producto: string; material_sku: string | null; descripcion: string; fecha_incidencia: string }) {
  const { error } = await supabase.from('proyecto_incidencias').insert({ id, ...datos, producto: datos.producto.trim(), descripcion: datos.descripcion.trim() });
  if (error) throw error;
}
export async function revisarIncidenciaProyecto(incidencia: IncidenciaProyecto, datos: Pick<IncidenciaProyecto, 'estado' | 'cobertura' | 'fecha_atencion' | 'resolucion' | 'requerimiento_id'>) {
  const { data, error } = await supabase.from('proyecto_incidencias').update(datos).eq('id', incidencia.id).eq('revision', incidencia.revision).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('La incidencia cambió o no tienes permiso. Actualiza la vista antes de guardar.');
}
