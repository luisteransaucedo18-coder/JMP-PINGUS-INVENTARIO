import { supabase } from './supabase';

const BUCKET = 'sistemas-documentos';
export const DOCUMENTOS_ACCEPT = '.pdf,.docx,.xlsx,.pptx,.txt,.csv,.jpg,.jpeg,.png';
export type DocumentoTarea = { id: string; tarea_id: string; comentario_id: string | null; nombre: string; ruta: string; tamano: number; autor: string; created_at: string };
const TIPOS: Record<string, string> = {
  pdf: 'application/pdf', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', csv: 'text/csv', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
};

export async function validarDocumento(file: File) {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const tipo = TIPOS[extension];
  if (!tipo) throw new Error('Formato no permitido. Usa PDF, DOCX, XLSX, PPTX, TXT, CSV, JPG o PNG.');
  if (!file.size || file.size > 20 * 1024 * 1024) throw new Error('El archivo debe tener contenido y pesar como máximo 20 MB.');
  if (file.name.length > 255) throw new Error('El nombre del archivo debe tener como máximo 255 caracteres.');
  const bytes = new Uint8Array(await file.slice(0, 1024).arrayBuffer());
  const firmas: Record<string, number[]> = { pdf: [37,80,68,70,45], png: [137,80,78,71,13,10,26,10], jpg: [255,216,255], jpeg: [255,216,255], docx: [80,75,3,4], xlsx: [80,75,3,4], pptx: [80,75,3,4] };
  const firma = firmas[extension];
  if (firma && !firma.every((value, index) => bytes[index] === value)) throw new Error('El contenido del archivo no coincide con su extensión.');
  if (!firma && bytes.includes(0)) throw new Error('El documento de texto contiene datos binarios.');
  return { extension, tipo };
}
export async function listarDocumentos(tareaId: string) {
  const { data, error } = await supabase.from('sistemas_documentos').select('*').eq('tarea_id', tareaId).order('created_at');
  if (error) throw error;
  return data as DocumentoTarea[];
}
export async function subirDocumento(tareaId: string, file: File) {
  const { extension, tipo } = await validarDocumento(file);
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error('Inicia sesión nuevamente.');
  const id = crypto.randomUUID();
  const ruta = `${tareaId}/${user.id}/${id}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, file, { contentType: tipo, upsert: false });
  if (error) throw error;
  const result = await supabase.from('sistemas_documentos').insert({ id, tarea_id: tareaId, nombre: file.name, ruta, tamano: file.size }).select('*').single();
  if (result.error) {
    const cleanup = await supabase.storage.from(BUCKET).remove([ruta]);
    if (cleanup.error) console.error('No se pudo limpiar el documento sin vincular.', cleanup.error);
    throw result.error;
  }
  return result.data as DocumentoTarea;
}
export async function descargarDocumento(doc: DocumentoTarea) {
  const { data, error } = await supabase.storage.from(BUCKET).download(doc.ruta);
  if (error) throw error;
  const url = URL.createObjectURL(data);
  const link = document.createElement('a');
  link.href = url; link.download = doc.nombre;
  document.body.append(link); link.click(); link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function eliminarDocumento(doc: DocumentoTarea) {
  const { error } = await supabase.storage.from(BUCKET).remove([doc.ruta]);
  if (error) throw error;
  const result = await supabase.from('sistemas_documentos').delete().eq('id', doc.id).select('id').maybeSingle();
  if (result.error) throw result.error;
  if (!result.data) throw new Error('El documento cambió. Actualiza el detalle.');
}
