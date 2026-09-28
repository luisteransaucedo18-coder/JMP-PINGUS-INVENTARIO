import { useEffect, useMemo, useState } from 'react';
import { SEDES, Sede } from '../../data/mockData';
import { useAppStore } from '../../store/AppContext';
import { Devolucion, obtenerDevoluciones, obtenerSaldosDevolucion, obtenerUrlEvidencia, registrarDevolucion, SaldoDevolucion } from '../../service/devolucionService';

const ESTADOS: Record<string, { label: string; bg: string; color: string }> = {
  PENDIENTE_VALIDACION: { label: 'Registrada', bg: '#D1FAE5', color: '#047857' },
  OBSERVADA: { label: 'Observada', bg: '#FEE2E2', color: '#B91C1C' },
  VALIDADA: { label: 'Registrada', bg: '#D1FAE5', color: '#047857' },
};
const fecha = (value: string) => new Date(value).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' });

function Badge({ estado }: { estado: string }) { const e = ESTADOS[estado]; return <span style={{ padding: '3px 8px', borderRadius: 6, background: e.bg, color: e.color, fontSize: 11, fontWeight: 700 }}>{e.label}</span>; }

export default function DevolucionesView({ onToast }: { onToast: (value: string) => void }) {
  const { state } = useAppStore();
  const [devoluciones, setDevoluciones] = useState<Devolucion[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState('');
  const [saldos, setSaldos] = useState<SaldoDevolucion[]>([]);
  const [search, setSearch] = useState('');
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [sede, setSede] = useState<Sede>('Chiclayo');
  const [files, setFiles] = useState<File[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const refresh = async () => { setLoading(true); try { setDevoluciones(await obtenerDevoluciones()); } catch (error) { onToast(error instanceof Error ? error.message : 'No se pudieron cargar las devoluciones.'); } finally { setLoading(false); } };
  useEffect(() => { void refresh(); }, []);
  useEffect(() => { if (!selectedProject) { setSaldos([]); return; } void obtenerSaldosDevolucion(selectedProject).then(setSaldos).catch(e => onToast(e.message)); }, [selectedProject]);

  const project = state.proyectos.find(p => p.id === selectedProject);
  const filtered = saldos.filter(s => s.disponible > 0 && (`${s.skuId} ${s.nombre}`).toLowerCase().includes(search.toLowerCase()));
  const selectedItems = saldos.filter(s => (cantidades[`${s.requerimientoId}:${s.skuId}`] ?? 0) > 0).map(s => ({ ...s, cantidad: cantidades[`${s.requerimientoId}:${s.skuId}`] }));
  const evidencePreviews = useMemo(() => files.map(file => ({ file, url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => evidencePreviews.forEach(item => URL.revokeObjectURL(item.url)), [evidencePreviews]);
  const submit = async () => {
    if (!selectedItems.length) return onToast('Indica una cantidad a devolver.');
    if (!files.length) return onToast('Adjunta al menos una fotografía de la devolución.');
    const reqs = [...new Set(selectedItems.map(i => i.requerimientoId))];
    if (reqs.length !== 1) return onToast('Registra una devolución por requerimiento.');
    if (selectedItems.some(i => i.cantidad <= 0 || i.cantidad > i.disponible)) return onToast('Revisa las cantidades disponibles.');
    setSubmitting(true);
    try {
      const items = selectedItems.map(i => ({ skuId: i.skuId, nombre: i.nombre, unidad: i.unidad, cantidad: i.cantidad }));
      await registrarDevolucion({ requerimientoId: reqs[0], sedeReceptora: sede, items, files });
      onToast('Devolución registrada e inventario actualizado.');
      setSelectedProject(''); setCantidades({}); setFiles([]); await refresh();
    } catch (error) { onToast(error instanceof Error ? error.message : 'No se pudo registrar la devolución.'); } finally { setSubmitting(false); }
  };

  return <div style={{ padding: 24, overflowY: 'auto' }}>
    <div className="panel" style={{ padding: 20, marginBottom: 18 }}>
      <h2 style={{ margin: 0, fontSize: 17 }}>Registrar devolución de materiales</h2><p style={{ margin: '6px 0 16px', fontSize: 12, color: '#71717A' }}>El inventario se actualiza al registrar la devolución.</p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <label><span style={{ fontSize: 12 }}>Proyecto</span><select className="input-field" value={selectedProject} onChange={e => { setSelectedProject(e.target.value); setCantidades({}); setFiles([]); }}><option value="">Selecciona un proyecto</option>{state.proyectos.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select></label>
        <label><span style={{ fontSize: 12 }}>Sede receptora</span><select className="input-field" value={sede} onChange={e => setSede(e.target.value as Sede)}>{SEDES.map(s => <option key={s}>{s}</option>)}</select></label>
      </div>
      {project && <div style={{ marginTop: 12, padding: 10, background: '#EFF6FF', borderRadius: 6, fontSize: 12 }}><strong>{project.nombre}</strong> · {project.ubicacion}</div>}
    </div>
    {selectedProject && <div className="panel" style={{ marginBottom: 18 }}><div style={{ padding: 16, borderBottom: '1px solid #E4E4E7', display: 'flex', gap: 12 }}><strong>Materiales entregados disponibles</strong><input className="input-field" style={{ marginLeft: 'auto', maxWidth: 250 }} placeholder="Buscar SKU o material" value={search} onChange={e => setSearch(e.target.value)} /></div><table className="data-table"><thead><tr><th>Requerimiento</th><th>SKU</th><th>Material</th><th>Unidad</th><th>Disponible</th><th>Devolver</th></tr></thead><tbody>{filtered.map(item => { const key = `${item.requerimientoId}:${item.skuId}`; return <tr key={key}><td>{item.requerimientoCodigo}</td><td style={{ fontFamily: 'monospace' }}>{item.skuId}</td><td>{item.nombre}</td><td>{item.unidad}</td><td>{item.disponible}</td><td><input className="input-field" min="0" max={item.disponible} type="number" value={cantidades[key] ?? ''} onChange={e => setCantidades(p => ({ ...p, [key]: Math.max(0, Math.min(item.disponible, Number(e.target.value))) }))} style={{ width: 90 }} /></td></tr>; })}</tbody></table>{!filtered.length && <p style={{ padding: 20, margin: 0, color: '#71717A', fontSize: 12 }}>No hay materiales entregados disponibles para devolver.</p>}</div>}
    {selectedProject && <div className="panel" style={{ padding: 16, marginBottom: 18 }}>
      <div className="returns-evidence">
        <div className="returns-evidence-heading">
          <span>Fotografías de evidencia</span>
          <small>{files.length ? `${files.length} archivo(s)` : 'Obligatorio'}</small>
        </div>
        <label className="returns-upload">
          <input type="file" accept="image/*" multiple required onChange={event => setFiles(Array.from(event.target.files ?? []))} />
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span><strong>Agregar fotografías</strong><small>Selecciona imágenes JPG, PNG o WEBP</small></span>
        </label>
        {evidencePreviews.length > 0 && <div className="returns-evidence-grid">
          {evidencePreviews.map(({ file, url }, index) => <figure key={`${file.name}-${file.lastModified}-${index}`}>
            <img src={url} alt={`Evidencia ${index + 1}`} />
            <button type="button" onClick={() => setFiles(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Quitar evidencia ${file.name}`}>×</button>
            <figcaption>{file.name}</figcaption>
          </figure>)}
        </div>}
      </div>
      <div style={{ marginTop: 14, padding: 10, background: '#F8FAFC', fontSize: 12 }}><strong>Resumen:</strong> {selectedItems.length} material(es), sede {sede}, {files.length} fotografía(s).</div>
      <button className="btn btn-primary" disabled={submitting} onClick={() => void submit()} style={{ marginTop: 14 }}>{submitting ? 'Procesando…' : 'Registrar devolución'}</button>
    </div>}
    <Historial devoluciones={devoluciones} />
  </div>;
}

function Historial({ devoluciones }: { devoluciones: Devolucion[] }) { return <div className="panel"><div style={{ padding: 16, fontWeight: 700 }}>Historial de devoluciones</div><table className="data-table"><thead><tr><th>Código</th><th>Proyecto</th><th>Requerimiento</th><th>Fecha</th><th>Registro</th></tr></thead><tbody>{devoluciones.map(d => <tr key={d.id}><td>{d.codigo}</td><td>{d.proyecto}</td><td>{d.requerimientoCodigo}</td><td>{fecha(d.createdAt)}</td><td><Badge estado={d.estado} /></td></tr>)}</tbody></table></div>; }

function CoordinadorPanel({ devoluciones, loading, selected, setSelected, observacion, setObservacion, resolving, onResolve }: any) { const [urls, setUrls] = useState<string[]>([]); useEffect(() => { if (!selected) { setUrls([]); return; } void Promise.all(selected.evidencias.map(obtenerUrlEvidencia)).then(setUrls).catch(() => setUrls([])); }, [selected]); const pendientes = devoluciones.filter((d: Devolucion) => d.estado === 'PENDIENTE_VALIDACION'); return <div style={{ padding: 24, overflowY: 'auto' }}><div className="panel"><div style={{ padding: 16, fontWeight: 700 }}>Devoluciones pendientes de validación ({pendientes.length})</div>{loading ? <p style={{ padding: 16 }}>Cargando…</p> : <table className="data-table"><thead><tr><th>Código</th><th>Proyecto</th><th>Requerimiento</th><th>Analista</th><th>Sede</th><th>Estado</th><th /></tr></thead><tbody>{devoluciones.map((d: Devolucion) => <tr key={d.id}><td>{d.codigo}</td><td>{d.proyecto}<br /><small>{d.ubicacion}</small></td><td>{d.requerimientoCodigo}</td><td>{d.analista}</td><td>{d.sedeReceptora}</td><td><Badge estado={d.estado} /></td><td><button className="btn btn-ghost" onClick={() => setSelected(d)}>Revisar</button></td></tr>)}</tbody></table>}</div>{selected && <div className="modal-overlay"><div className="modal" style={{ width: 720, maxHeight: '90vh', overflowY: 'auto' }}><div className="modal-header"><h2 style={{ margin: 0, fontSize: 16 }}>{selected.codigo} · {selected.proyecto}</h2><button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button></div><div style={{ padding: 18 }}><p style={{ fontSize: 12 }}><strong>Requerimiento:</strong> {selected.requerimientoCodigo} · <strong>Sede receptora:</strong> {selected.sedeReceptora}</p><table className="data-table"><thead><tr><th>SKU</th><th>Material</th><th>Unidad</th><th>Cantidad</th></tr></thead><tbody>{selected.items.map((i: any) => <tr key={i.skuId}><td>{i.skuId}</td><td>{i.nombre}</td><td>{i.unidad}</td><td>{i.cantidad}</td></tr>)}</tbody></table><div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>{urls.map(url => <a key={url} href={url} target="_blank" rel="noreferrer"><img src={url} alt="Evidencia de devolución" style={{ width: 110, height: 90, objectFit: 'cover', borderRadius: 6 }} /></a>)}</div>{selected.observacion && <p style={{ color: '#B91C1C', fontSize: 12 }}><strong>Observación:</strong> {selected.observacion}</p>}<div style={{ marginTop: 18 }}><label style={{ fontSize: 12 }}>Observación si requiere corrección</label><textarea className="input-field" value={observacion} onChange={(e: any) => setObservacion(e.target.value)} rows={3} /><div style={{ display: 'flex', gap: 10, marginTop: 12 }}><button className="btn btn-primary" disabled={resolving || selected.estado !== 'PENDIENTE_VALIDACION'} onClick={() => void onResolve(true)}>{resolving ? 'Procesando…' : 'Validar devolución'}</button><button className="btn btn-ghost" disabled={resolving || selected.estado !== 'PENDIENTE_VALIDACION'} onClick={() => void onResolve(false)}>Registrar observación</button></div></div><div style={{ marginTop: 20, fontSize: 12 }}><strong>Historial</strong>{selected.historial.map((h: any, index: number) => <p key={index} style={{ margin: '6px 0' }}><Badge estado={h.estado} /> {h.actor} · {fecha(h.fecha)} {h.comentario ? `· ${h.comentario}` : ''}</p>)}</div></div></div></div>}</div>; }
