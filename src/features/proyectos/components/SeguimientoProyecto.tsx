import { cloneElement, isValidElement, useCallback, useEffect, useId, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Proyecto, Role } from '../../../domain/types';
import { useAppStore } from '../../../store/AppContext';
import { supabase } from '../../../services/supabase';
import {
  actualizarAvanceProyecto, adjuntarEvidenciaProyecto, errorSeguimiento, obtenerSeguimientoProyecto,
  registrarIncidenciaProyecto, revisarIncidenciaProyecto,
} from '../../../services/proyectoSeguimientoService';
import {
  COBERTURAS, ESTADOS_INCIDENCIA, ESTADOS_OBRA, ETAPAS_EVIDENCIA, fechaProyecto, garantiaProyecto, hoyPeru,
  type EstadoObra, type EtapaEvidencia, type EvidenciaProyecto, type IncidenciaProyecto,
} from '../seguimiento';
import { publicCode } from '../../../utils/publicCode';

function Field({ label, children }: { label: string; children: ReactNode }) {
  const id = useId();
  return <div className="project-field"><label htmlFor={id}>{label}</label>{isValidElement(children) ? cloneElement(children as ReactElement<{ id?: string }>, { id }) : children}</div>;
}
function Dialog({ label, children, onClose }: { label: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    ref.current?.showModal();
    return () => { ref.current?.close(); trigger?.focus(); };
  }, []);
  return createPortal(<dialog ref={ref} className="project-dialog" aria-label={label}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="project-dialog-heading"><h3>{label}</h3><button type="button" className="btn btn-ghost" onClick={onClose}>Cerrar</button></div>
    {children}
  </dialog>, document.body);
}
function Photo({ photo, onOpen }: { photo: EvidenciaProyecto; onOpen: () => void }) {
  const [failed, setFailed] = useState<string>();
  return <figure className="project-photo">
    <button type="button" onClick={onOpen} disabled={!photo.url || failed === photo.url} aria-label={`Ampliar foto: ${photo.descripcion || photo.nombre}`}>
      {photo.url && failed !== photo.url ? <img src={photo.url} alt={photo.descripcion || photo.nombre} loading="lazy" onError={() => setFailed(photo.url)} /> : <span>Foto no disponible. Actualiza las fotografías.</span>}
    </button>
    <figcaption><strong>{photo.descripcion || photo.nombre}</strong><small>{fechaProyecto(photo.created_at)} · {photo.autor_nombre}</small></figcaption>
  </figure>;
}

export default function SeguimientoProyecto({ proyecto, role, onToast }: { proyecto: Proyecto; role: Role; onToast: (message: string) => void }) {
  const { state, refreshRemoteData } = useAppStore();
  const [section, setSection] = useState<'avance' | 'evidencias' | 'incidencias'>('avance');
  const [data, setData] = useState<{ evidencias: EvidenciaProyecto[]; incidencias: IncidenciaProyecto[]; fotosNoDisponibles: boolean }>({ evidencias: [], incidencias: [], fotosNoDisponibles: false });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const pending = useRef(false);
  const [estado, setEstado] = useState<EstadoObra>(proyecto.estadoObra ?? 'PLANIFICADO');
  const [finishDate, setFinishDate] = useState(proyecto.fechaFinalizacion ?? hoyPeru());
  const [etapa, setEtapa] = useState<EtapaEvidencia>('PROCESO');
  const [photoNote, setPhotoNote] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [fileKey, setFileKey] = useState(0);
  const [photoIncident, setPhotoIncident] = useState('');
  const [viewPhoto, setViewPhoto] = useState<EvidenciaProyecto | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [incidentId, setIncidentId] = useState(() => crypto.randomUUID());
  const [newIncident, setNewIncident] = useState({ producto: '', material_sku: '', descripcion: '', fecha_incidencia: hoyPeru() });
  const [review, setReview] = useState<IncidenciaProyecto | null>(null);
  const [incidentFilter, setIncidentFilter] = useState('');
  const [photoFilter, setPhotoFilter] = useState<EtapaEvidencia | ''>('');
  const active = useRef(true);
  const loadSequence = useRef(0);
  const canRegister = role === 'analista' || role === 'coordinador';
  const canReview = role === 'coordinador';
  const closed = proyecto.estadoObra === 'FINALIZADO' || proyecto.estadoObra === 'CANCELADO';
  const today = hoyPeru();
  const reload = useCallback(async () => {
    const sequence = ++loadSequence.current;
    try {
      const result = await obtenerSeguimientoProyecto(proyecto.id);
      if (active.current && sequence === loadSequence.current) { setData(result); setLoadError(''); }
    } catch (cause) {
      if (active.current && sequence === loadSequence.current) setLoadError(`No se pudo cargar el seguimiento. ${errorSeguimiento(cause)}`);
    } finally {
      if (active.current && sequence === loadSequence.current) setLoading(false);
    }
  }, [proyecto.id]);
  useEffect(() => {
    active.current = true;
    void reload();
    const timer = setInterval(() => void reload(), 50 * 60 * 1000);
    const channel = supabase.channel(`proyecto-seguimiento-${proyecto.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyecto_evidencias', filter: `proyecto_id=eq.${proyecto.id}` }, () => void reload())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'proyecto_incidencias', filter: `proyecto_id=eq.${proyecto.id}` }, () => void reload()).subscribe();
    return () => { active.current = false; ++loadSequence.current; clearInterval(timer); void supabase.removeChannel(channel); };
  }, [proyecto.id, reload]);
  useEffect(() => {
    setEstado(proyecto.estadoObra ?? 'PLANIFICADO');
    setFinishDate(proyecto.fechaFinalizacion ?? hoyPeru());
  }, [proyecto.estadoObra, proyecto.fechaFinalizacion, proyecto.revisionObra]);

  async function run(action: () => Promise<void>, message: string) {
    if (pending.current) return;
    pending.current = true; setBusy(true); setError('');
    try {
      await action();
      await Promise.all([reload(), refreshRemoteData()]);
      onToast(message);
    } catch (cause) { setError(errorSeguimiento(cause)); }
    finally { pending.current = false; setBusy(false); }
  }
  const incidentCounts = data.incidencias.filter(i => i.estado !== 'RESUELTA' && i.estado !== 'RECHAZADA').length;
  const photos = data.evidencias.filter(e => !photoFilter || e.etapa === photoFilter);
  const incidents = data.incidencias.filter(i => !incidentFilter || i.estado === incidentFilter);
  const requestOptions = state.requerimientos.filter(r => r.proyectoId === proyecto.id);
  const canUploadStage = etapa === 'INCIDENCIA' ? !!photoIncident : etapa === 'PROCESO'
    ? ['EN_CONSTRUCCION', 'PAUSADO'].includes(proyecto.estadoObra ?? '')
    : ['EN_CONSTRUCCION', 'PAUSADO', 'FINALIZADO'].includes(proyecto.estadoObra ?? '');

  return <section className="panel project-followup" aria-label="Seguimiento del proyecto">
    <div className="project-tabs" role="group" aria-label="Secciones del seguimiento">
      {([['avance', 'Avance y garantía'], ['evidencias', `Evidencias (${data.evidencias.length})`], ['incidencias', `Incidencias (${incidentCounts} pendientes)`]] as const).map(([value, label]) =>
        <button type="button" key={value} className={section === value ? 'is-active' : ''} aria-pressed={section === value} disabled={busy} onClick={() => { setSection(value); setError(''); }}>{label}</button>)}
      <button type="button" className="project-refresh" disabled={busy} onClick={() => void reload()}>Actualizar</button>
    </div>
    <div className="project-followup-body">
      {loading && <p role="status">Cargando seguimiento…</p>}
      {loadError && <p className="quote-error" role="alert">{loadError} <button className="btn btn-ghost" type="button" onClick={() => void reload()}>Reintentar</button></p>}
      {error && <p className="quote-error" role="alert">{error}</p>}
      {section === 'avance' && <>
        <div className="project-section-title"><div><h3>Avance de la instalación</h3><p>Registra el estado y conserva las fotografías de cada etapa.</p></div><span className={`project-status project-status-${proyecto.estadoObra ?? 'PLANIFICADO'}`}>{ESTADOS_OBRA[proyecto.estadoObra ?? 'PLANIFICADO']}</span></div>
        <div className="project-guarantee"><div><span>Garantía de la empresa · 1 año</span><strong>{garantiaProyecto(proyecto.fechaFinalizacion, proyecto.garantiaHasta)}</strong></div><dl><div><dt>Instalación finalizada</dt><dd>{fechaProyecto(proyecto.fechaFinalizacion)}</dd></div><div><dt>Cobertura hasta</dt><dd>{fechaProyecto(proyecto.garantiaHasta)}</dd></div></dl></div>
        {canReview && !closed && <form onSubmit={event => { event.preventDefault(); void run(() => actualizarAvanceProyecto(proyecto, estado, finishDate), 'Estado del proyecto actualizado.'); }}>
          <fieldset disabled={busy || loading || !!loadError} className="project-form-grid">
            <Field label="Estado del proyecto"><select className="select-field" value={estado} onChange={event => setEstado(event.target.value as EstadoObra)}>{Object.entries(ESTADOS_OBRA).filter(([key]) => key !== 'PLANIFICADO' || proyecto.estadoObra === 'PLANIFICADO' || !proyecto.estadoObra).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            {estado === 'FINALIZADO' && <Field label="Fecha de finalización"><input className="input-field" type="date" required max={today} value={finishDate} onChange={event => setFinishDate(event.target.value)} /></Field>}
            <div className="project-form-actions"><button type="submit" className="btn btn-primary" disabled={estado === proyecto.estadoObra}> {busy ? 'Guardando…' : 'Guardar estado'}</button><button type="button" className="btn btn-ghost" onClick={() => { setEtapa('INSTALACION_FINAL'); setSection('evidencias'); }}>Adjuntar fotos de instalación</button></div>
          </fieldset>
          <p className="project-hint">Para finalizar, adjunta al menos una foto de la instalación final. La fecha registrada inicia el año de garantía.</p>
        </form>}
        {closed && <p className="project-hint">{proyecto.estadoObra === 'FINALIZADO' ? 'La instalación está finalizada. Puedes agregar fotografías finales y registrar incidencias para su atención.' : 'Este proyecto está cancelado.'}</p>}
        {!canReview && !closed && <p className="project-hint">El coordinador actualiza el estado del proyecto. Analistas y coordinadores pueden registrar evidencias e incidencias.</p>}
      </>}
      {section === 'evidencias' && <>
        <div className="project-section-title"><div><h3>Evidencias fotográficas</h3><p>Fotos del proceso, de la instalación terminada y de las incidencias.</p></div></div>
        {canRegister && proyecto.estadoObra !== 'CANCELADO' && <form className="project-upload" onSubmit={event => {
          event.preventDefault();
          if (!files.length) { setError('Selecciona al menos una fotografía.'); return; }
          void run(async () => {
            const remaining = [...files];
            try {
              for (const file of files) {
                await adjuntarEvidenciaProyecto(proyecto.id, etapa, file, photoNote, etapa === 'INCIDENCIA' ? photoIncident : undefined);
                remaining.shift(); setFiles([...remaining]);
              }
              setPhotoNote(''); setFileKey(key => key + 1);
            } finally { await reload(); }
          }, 'Fotografías guardadas en el proyecto.');
        }}>
          <fieldset disabled={busy || loading || !!loadError} className="project-form-grid">
            <Field label="Etapa de la evidencia"><select className="select-field" value={etapa} onChange={event => setEtapa(event.target.value as EtapaEvidencia)}>{Object.entries(ETAPAS_EVIDENCIA).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
            {etapa === 'INCIDENCIA' && <Field label="Incidencia relacionada"><select className="select-field" required value={photoIncident} onChange={event => setPhotoIncident(event.target.value)}><option value="">Selecciona una incidencia</option>{data.incidencias.map(i => <option key={i.id} value={i.id}>{i.producto} · {fechaProyecto(i.fecha_incidencia)}</option>)}</select></Field>}
            <Field label="Descripción de las fotos"><input className="input-field" maxLength={1000} value={photoNote} onChange={event => setPhotoNote(event.target.value)} placeholder="Ej. Tubería instalada antes del acabado" /></Field>
            <Field label="Fotografías · JPG, PNG o WebP · máximo 5 MB por foto"><input key={fileKey} className="input-field" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => setFiles(Array.from(event.target.files ?? []))} /></Field>
            <div className="project-form-actions"><button className="btn btn-primary" type="submit" disabled={!canUploadStage}>{busy ? 'Subiendo fotografías…' : 'Guardar fotografías'}</button><span className="project-hint">{files.length ? `${files.length} foto(s) pendientes de subir` : ''}</span></div>
          </fieldset>
          {!canUploadStage && <p className="project-hint">{etapa === 'INCIDENCIA' ? 'Registra o selecciona primero la incidencia.' : 'El proyecto debe estar en construcción para registrar esta etapa.'}</p>}
        </form>}
        <div className="project-section-title"><Field label="Filtrar fotografías"><select className="select-field" value={photoFilter} onChange={event => setPhotoFilter(event.target.value as EtapaEvidencia | '')}><option value="">Todas las etapas</option>{Object.entries(ETAPAS_EVIDENCIA).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field><span className="project-hint">{photos.length} fotografías</span></div>
        {data.fotosNoDisponibles && <p className="quote-error" role="alert">Algunas fotos no pudieron cargarse. Pulsa Actualizar para intentar de nuevo.</p>}
        {!loading && !loadError && !photos.length && <p className="project-empty">Aún no hay fotografías para esta etapa.</p>}
        <div className="project-photo-grid">{photos.map(photo => <div key={photo.id}><span className="project-photo-stage">{ETAPAS_EVIDENCIA[photo.etapa]}</span><Photo photo={photo} onOpen={() => setViewPhoto(photo)} />{photo.incidencia_id && <small className="project-hint">Incidencia: {data.incidencias.find(i => i.id === photo.incidencia_id)?.producto ?? 'Registrada'}</small>}</div>)}</div>
      </>}
      {section === 'incidencias' && <>
        <div className="project-section-title"><div><h3>Incidencias y garantías</h3><p>Cada incidencia es una solicitud de atención vinculada a esta instalación.</p></div>{canRegister && proyecto.estadoObra !== 'CANCELADO' && <button className="btn btn-primary" type="button" disabled={busy || loading || !!loadError} onClick={() => setShowNew(value => !value)}>{showNew ? 'Cancelar registro' : 'Registrar incidencia'}</button>}</div>
        {showNew && <form className="project-upload" onSubmit={event => {
          event.preventDefault();
          void run(async () => {
            await registrarIncidenciaProyecto(incidentId, { ...newIncident, proyecto_id: proyecto.id, material_sku: newIncident.material_sku || null });
            setPhotoIncident(incidentId); setEtapa('INCIDENCIA'); setIncidentId(crypto.randomUUID());
            setShowNew(false); setNewIncident({ producto: '', material_sku: '', descripcion: '', fecha_incidencia: hoyPeru() });
          }, 'Incidencia registrada. Puedes adjuntar sus fotos en Evidencias.');
        }}>
          <fieldset disabled={busy} className="project-form-grid">
            <Field label="Producto del inventario (opcional)"><select className="select-field" value={newIncident.material_sku} onChange={event => { const material = state.materials.find(m => m.id === event.target.value); setNewIncident(previous => ({ ...previous, material_sku: event.target.value, producto: material?.nombre ?? previous.producto })); }}><option value="">Otro producto o instalación</option>{state.materials.map(m => <option key={m.id} value={m.id}>{m.nombre} · {m.id}</option>)}</select></Field>
            <Field label="Producto o elemento afectado"><input className="input-field" required maxLength={150} value={newIncident.producto} onChange={event => setNewIncident(previous => ({ ...previous, producto: event.target.value }))} placeholder="Ej. Llave de paso" /></Field>
            <Field label="Fecha de la incidencia"><input className="input-field" type="date" required max={today} value={newIncident.fecha_incidencia} onChange={event => setNewIncident(previous => ({ ...previous, fecha_incidencia: event.target.value }))} /></Field>
            <Field label="Descripción del problema"><textarea className="input-field" required rows={3} maxLength={2000} value={newIncident.descripcion} onChange={event => setNewIncident(previous => ({ ...previous, descripcion: event.target.value }))} /></Field>
            <div className="project-form-actions"><button className="btn btn-primary" type="submit">{busy ? 'Registrando…' : 'Guardar incidencia'}</button></div>
          </fieldset>
          <p className="project-hint">El plazo se calcula con la fecha de la incidencia. El coordinador evalúa la cobertura; puedes registrar problemas fuera de garantía.</p>
        </form>}
        <Field label="Filtrar incidencias por estado"><select className="select-field" value={incidentFilter} onChange={event => setIncidentFilter(event.target.value)}><option value="">Todos los estados</option>{Object.entries(ESTADOS_INCIDENCIA).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
        {!loading && !loadError && !incidents.length && <p className="project-empty">No hay incidencias en esta selección.</p>}
        <div className="project-incidents">{incidents.map(incident => <article className="project-incident" key={incident.id}>
          <div className="project-section-title"><div><h4>{incident.producto}</h4><small>{fechaProyecto(incident.fecha_incidencia)} · Registrado por {incident.autor_nombre}</small></div><span className="badge badge-blue">{ESTADOS_INCIDENCIA[incident.estado]}</span></div>
          <p className="project-incident-description">{incident.descripcion}</p>
          <div className="project-incident-meta"><span>{incident.plazo_garantia === 'DENTRO' ? 'Dentro del año de garantía' : incident.plazo_garantia === 'FUERA' ? 'Fuera del año de garantía' : 'Garantía aún no iniciada'}</span><strong>{COBERTURAS[incident.cobertura]}</strong>{incident.garantia_hasta && <span>Cobertura hasta {fechaProyecto(incident.garantia_hasta)}</span>}{incident.fecha_atencion && <span>Atención: {fechaProyecto(incident.fecha_atencion)}</span>}</div>
          {incident.resolucion && <p className="project-resolution"><strong>Atención / resolución:</strong> {incident.resolucion}</p>}
          {incident.requerimiento_id && <p className="project-hint">Requerimiento vinculado: {publicCode(state.requerimientos.find(r => r.id === incident.requerimiento_id) ?? { id: incident.requerimiento_id })}</p>}
          {incident.revisor_nombre && <p className="project-hint">Última revisión: {incident.revisor_nombre} · {fechaProyecto(incident.updated_at)}</p>}
          <div className="project-photo-grid">{data.evidencias.filter(photo => photo.incidencia_id === incident.id).map(photo => <Photo key={photo.id} photo={photo} onOpen={() => setViewPhoto(photo)} />)}</div>
          <div className="project-form-actions">{canRegister && proyecto.estadoObra !== 'CANCELADO' && <button className="btn btn-ghost" type="button" disabled={busy} onClick={() => { setPhotoIncident(incident.id); setEtapa('INCIDENCIA'); setSection('evidencias'); }}>Adjuntar fotografías</button>}{canReview && !['RESUELTA', 'RECHAZADA'].includes(incident.estado) && <button className="btn btn-primary" type="button" disabled={busy} onClick={() => { setReview({ ...incident }); setError(''); }}>Gestionar atención</button>}</div>
        </article>)}</div>
      </>}
    </div>
    {viewPhoto && <Dialog label={viewPhoto.descripcion || viewPhoto.nombre} onClose={() => setViewPhoto(null)}><img className="project-photo-full" src={viewPhoto.url} alt={viewPhoto.descripcion || viewPhoto.nombre} /><p className="project-hint">{ETAPAS_EVIDENCIA[viewPhoto.etapa]} · {fechaProyecto(viewPhoto.created_at)} · {viewPhoto.autor_nombre}</p></Dialog>}
    {review && <Dialog label={`Atención de incidencia: ${review.producto}`} onClose={() => { if (!busy) { setReview(null); setError(''); } }}>
      <form onSubmit={event => {
        event.preventDefault();
        void run(async () => {
          await revisarIncidenciaProyecto(review, { estado: review.estado, cobertura: review.cobertura, fecha_atencion: review.fecha_atencion || null, resolucion: review.resolucion.trim(), requerimiento_id: review.requerimiento_id || null });
          setReview(null);
        }, 'Atención de la incidencia actualizada.');
      }}>
        {error && <p className="quote-error" role="alert">{error}</p>}
        <fieldset className="project-form-grid" disabled={busy}>
          <Field label="Estado de la atención"><select className="select-field" value={review.estado} onChange={event => setReview({ ...review, estado: event.target.value as IncidenciaProyecto['estado'] })}>{Object.entries(ESTADOS_INCIDENCIA).filter(([key]) => key !== 'ABIERTA' || review.estado === 'ABIERTA').map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></Field>
          <Field label="Evaluación de cobertura"><select className="select-field" value={review.cobertura} onChange={event => setReview({ ...review, cobertura: event.target.value as IncidenciaProyecto['cobertura'] })}>{Object.entries(COBERTURAS).map(([key, label]) => <option key={key} value={key} disabled={key === 'CUBIERTA' && review.plazo_garantia !== 'DENTRO'}>{label}</option>)}</select></Field>
          <Field label="Fecha de atención"><input className="input-field" type="date" required={review.estado === 'PROGRAMADA'} min={review.estado === 'PROGRAMADA' ? today : undefined} value={review.fecha_atencion ?? ''} onChange={event => setReview({ ...review, fecha_atencion: event.target.value })} /></Field>
          <Field label="Requerimiento de materiales relacionado (opcional)"><select className="select-field" value={review.requerimiento_id ?? ''} onChange={event => setReview({ ...review, requerimiento_id: event.target.value })}><option value="">Sin requerimiento de materiales</option>{requestOptions.map(r => <option key={r.id} value={r.id}>{publicCode(r)} · {r.estado}</option>)}</select></Field>
          <Field label="Atención, resolución o motivo de rechazo"><textarea className="input-field" rows={4} maxLength={2000} required={['RESUELTA', 'RECHAZADA'].includes(review.estado)} value={review.resolucion} onChange={event => setReview({ ...review, resolucion: event.target.value })} /></Field>
          <div className="project-form-actions"><button className="btn btn-primary" type="submit">{busy ? 'Guardando…' : 'Guardar atención'}</button></div>
        </fieldset>
      </form>
    </Dialog>}
  </section>;
}
