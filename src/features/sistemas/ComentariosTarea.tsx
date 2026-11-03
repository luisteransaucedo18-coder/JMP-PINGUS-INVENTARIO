import { useEffect, useRef, useState } from 'react';
import { useUserProfile } from '../../store/UserProfileContext';
import { cargarComentarios, comentar, type Comentario, type Persona } from '../../services/sistemasService';
import { DOCUMENTOS_ACCEPT, listarDocumentos, subirDocumento, validarDocumento, descargarDocumento, eliminarDocumento, type DocumentoTarea } from '../../services/sistemasDocumentosService';
import { useSistemasLive } from './useSistemasLive';

function mensaje(e: unknown) { return e && typeof e === 'object' && 'message' in e ? String(e.message) : 'No se pudo completar la operación.'; }
export default function ComentariosTarea({ tareaId, personas, busy, setBusy }: { tareaId: string; personas: Persona[]; busy: boolean; setBusy: (value: boolean) => void }) {
  const { profile } = useUserProfile();
  const [comments, setComments] = useState<Comentario[]>([]);
  const [documents, setDocuments] = useState<DocumentoTarea[]>([]);
  const [texto, setTexto] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [confirmar, setConfirmar] = useState<string>();
  const [attempt, setAttempt] = useState(0);
  const version = useRef(0);
  const publicationId = useRef(crypto.randomUUID());
  const pending = documents.filter(d => !d.comentario_id && d.autor === profile.id);
  async function refresh() {
    if (busy) return;
    const current = ++version.current;
    try {
      const [items, files] = await Promise.all([cargarComentarios(tareaId), listarDocumentos(tareaId)]);
      if (current === version.current) { setComments(items); setDocuments(files); }
    } catch (e) { if (current === version.current) setError(mensaje(e)); }
    finally { if (current === version.current) setLoading(false); }
  }
  useEffect(() => { void refresh(); return () => { version.current++; }; }, [tareaId, attempt, busy]);
  useSistemasLive(['sistemas_comentarios', 'sistemas_documentos'], refresh);
  async function operar(action: () => Promise<void>) {
    if (busy) return;
    version.current++; setBusy(true); setError('');
    try { await action(); } catch (e) { setError(mensaje(e)); }
    finally { version.current++; setBusy(false); }
  }
  function archivo(doc: DocumentoTarea, draft = false) {
    return <li key={doc.id} className="sys-comment-file"><span aria-hidden="true">↳</span><div><strong>{doc.nombre}</strong><small>{Math.max(1, Math.ceil(doc.tamano / 1024))} KB</small></div>
      {!draft && <button type="button" disabled={busy} onClick={() => void operar(() => descargarDocumento(doc))}>Descargar</button>}
      <button type="button" disabled={busy} aria-label={`${draft ? 'Quitar' : 'Eliminar'} archivo ${doc.nombre}`} onClick={() => setConfirmar(doc.id)}>×</button>
      {confirmar === doc.id && <div className="sys-file-confirm"><p>¿Eliminar este archivo?</p><button type="button" disabled={busy} onClick={() => setConfirmar(undefined)}>Conservar archivo</button><button type="button" disabled={busy} onClick={() => void operar(async () => { await eliminarDocumento(doc); setDocuments(items => items.filter(d => d.id !== doc.id)); setConfirmar(undefined); })}>Confirmar eliminación de archivo</button></div>}
    </li>;
  }
  return <section className="sys-comments" aria-labelledby="sys-comments-title"><h3 id="sys-comments-title">Comentarios</h3>
    {loading && <p role="status">Cargando comentarios…</p>}
    {comments.map(c => <article key={c.id} className="sys-comment"><span className="sys-comment-avatar" aria-hidden="true">{(personas.find(p => p.id === c.autor)?.nombre ?? 'U').slice(0,1)}</span><div className="sys-comment-body"><strong>{personas.find(p => p.id === c.autor)?.nombre ?? 'Usuario'}</strong><small>{new Date(c.created_at).toLocaleString('es-PE')}</small>{c.contenido && <p>{c.contenido}</p>}<ul className="sys-comment-files">{documents.filter(d => d.comentario_id === c.id).map(d => archivo(d))}</ul></div></article>)}
    <form className="sys-comment-compose" onSubmit={e => { e.preventDefault(); if (!texto.trim() && !pending.length) return; void operar(async () => {
      const c = await comentar(tareaId, texto, pending.map(d => d.id), publicationId.current);
      setComments(items => [...items.filter(item => item.id !== c.id), c]);
      setDocuments(items => items.map(d => pending.some(item => item.id === d.id) ? { ...d, comentario_id: c.id } : d));
      publicationId.current = crypto.randomUUID(); setTexto('');
    }); }}>
      <span className="sys-comment-avatar" aria-hidden="true">{profile.nombre.slice(0,1)}</span>
      <div className="sys-compose-content"><textarea aria-label="Agregar comentario" placeholder="Agregar un comentario…" rows={2} maxLength={3000} value={texto} disabled={busy} onChange={e => setTexto(e.target.value)} />
        {!!pending.length && <ul className="sys-comment-files">{pending.map(d => archivo(d, true))}</ul>}
        <div className="sys-compose-actions"><label className="sys-comment-attach" title="Adjuntar archivos"><input type="file" aria-label="Adjuntar archivos al comentario" accept={DOCUMENTOS_ACCEPT} multiple disabled={busy} onChange={e => {
          const files = Array.from(e.currentTarget.files ?? []); e.currentTarget.value = '';
          if (!files.length) return;
          void operar(async () => { setUploading(true); try {
            for (const file of files) await validarDocumento(file);
            for (const file of files) { const doc = await subirDocumento(tareaId, file); setDocuments(items => [...items.filter(d => d.id !== doc.id), doc]); }
          } finally { setUploading(false); } });
        }} /><svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m8 12 6-6a3 3 0 0 1 4 4l-8 8a5 5 0 0 1-7-7l9-9m-6 12 8-8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" /></svg></label><small>Hasta 20 MB por archivo</small><button className="sys-comment-send" aria-label="Enviar comentario" title="Enviar comentario" disabled={busy || (!texto.trim() && !pending.length)}>↑</button></div>
      </div>
    </form>
    {uploading && <p role="status">Subiendo archivos…</p>}
    {error && <div role="alert" className="sys-error"><p>{error}</p><button disabled={busy} type="button" onClick={() => setAttempt(n => n + 1)}>Actualizar comentarios</button></div>}
  </section>;
}
