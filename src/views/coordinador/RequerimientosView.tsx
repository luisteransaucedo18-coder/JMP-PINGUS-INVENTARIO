import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { Requerimiento, SEDES, Material } from '../../data/mockData';
import MaterialPreviewModal, { PreviewBtn } from '../../components/MaterialPreviewModal';
import RequirementStatusTimeline from '../../components/RequirementStatusTimeline';
import { revisarSolicitud } from '../../service/requerimientoService';

const BADGE: Record<string, string> = { BORRADOR: 'gray', ENVIADO: 'amber', CONFIRMADO: 'green', RECHAZADO: 'red' };

interface Props { onToast: (msg: string) => void; usuario: string; }

export default function RequerimientosView({ onToast, usuario }: Props) {
  const { state, refreshRemoteData } = useAppStore();
  const [estadoFilter, setEstadoFilter] = useState('ENVIADO');
  const [sedeFilter, setSedeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Requerimiento | null>(null);
  const [obsModal, setObsModal] = useState('');
  const [action, setAction] = useState<'confirm' | 'reject' | null>(null);
  const [previewMat, setPreviewMat] = useState<Material | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const filtered = state.requerimientos
    .filter(r =>
      (!estadoFilter || r.estado === estadoFilter) &&
      (!sedeFilter || r.sede === sedeFilter) &&
      (!search || r.proyecto.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase()) || r.analista.toLowerCase().includes(search.toLowerCase()))
    )
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const handleConfirm = async (r: Requerimiento) => {
    setReviewing(true);
    try {
      await revisarSolicitud(r.id, true, obsModal || undefined);
      await refreshRemoteData();
      onToast(`✓ ${r.codigo ?? r.id} confirmada — inventario actualizado`);
      setSelected(null); setObsModal(''); setAction(null);
    } catch (error) { onToast(error instanceof Error ? error.message : 'No se pudo confirmar la solicitud'); }
    finally { setReviewing(false); }
  };

  const handleReject = async (r: Requerimiento) => {
    if (!obsModal.trim()) { onToast('⚠ Indica el motivo del rechazo'); return; }
    setReviewing(true);
    try {
      await revisarSolicitud(r.id, false, obsModal);
      await refreshRemoteData();
      onToast(`${r.codigo ?? r.id} rechazada — analista notificado`);
      setSelected(null); setObsModal(''); setAction(null);
    } catch (error) { onToast(error instanceof Error ? error.message : 'No se pudo rechazar la solicitud'); }
    finally { setReviewing(false); }
  };

  const openAction = (r: Requerimiento, type: 'confirm' | 'reject') => {
    setSelected(r); setAction(type); setObsModal('');
  };

  const pendingCount = state.requerimientos.filter(r => r.estado === 'ENVIADO').length;

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {['ENVIADO', 'CONFIRMADO', 'RECHAZADO', 'BORRADOR'].map(e => {
          const cnt = state.requerimientos.filter(r => r.estado === e).length;
          const colors: Record<string, string> = { ENVIADO: '#D97706', CONFIRMADO: '#059669', RECHAZADO: '#DC2626', BORRADOR: '#71717A' };
          return (
            <div key={e} className="kpi-card" style={{ cursor: 'pointer', borderColor: estadoFilter === e ? colors[e] : '#E4E4E7' }} onClick={() => setEstadoFilter(estadoFilter === e ? '' : e)}>
              <div style={{ fontSize: 12, color: '#71717A', fontWeight: 500, marginBottom: 10 }}>{e}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: colors[e] }}>{cnt}</div>
            </div>
          );
        })}
      </div>

      {pendingCount > 0 && !estadoFilter && (
        <div style={{ marginBottom: 16, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L14 13H1L7.5 1z" stroke="#D97706" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 6v3M7.5 11v.5" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span style={{ fontSize: 13, color: '#92400E' }}><strong>{pendingCount} solicitudes</strong> esperan tu confirmación.</span>
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, borderColor: '#FDE68A' }} onClick={() => setEstadoFilter('ENVIADO')}>Ver pendientes →</button>
        </div>
      )}

      <div className="panel">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E4E4E7', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input-field" style={{ maxWidth: 220 }} placeholder="Buscar folio, proyecto, analista…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select-field" value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="ENVIADO">Enviado</option>
            <option value="CONFIRMADO">Confirmado</option>
            <option value="RECHAZADO">Rechazado</option>
            <option value="BORRADOR">Borrador</option>
          </select>
          <select className="select-field" value={sedeFilter} onChange={e => setSedeFilter(e.target.value)}>
            <option value="">Todas las sedes</option>
            {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#71717A' }}>{filtered.length} solicitudes</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Proyecto</th><th>Sede</th><th>Analista</th><th>Técnico</th><th>Fecha</th><th>Materiales</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0
                ? <tr className="empty-state-row"><td colSpan={9} style={{ textAlign: 'center', color: '#71717A', padding: 32 }}>Sin solicitudes para este filtro</td></tr>
                : filtered.map(r => (
                  <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => { setSelected(r); setAction(null); }}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB' }}>{r.codigo ?? r.id}</td>
                    <td style={{ fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.proyecto}</td>
                    <td style={{ fontSize: 12 }}>{r.sede}</td>
                    <td style={{ fontSize: 12, color: '#71717A' }}>{r.analista}</td>
                    <td style={{ fontSize: 12, color: '#71717A', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tecnico}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#71717A' }}>{r.fecha}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.materiales.length}</td>
                    <td><span className={`badge status-badge badge-${BADGE[r.estado]}`}>{r.estado}</span></td>
                    <td onClick={e => e.stopPropagation()}>
                      {r.estado === 'ENVIADO' && (
                        <div style={{ display: 'flex', gap: 5 }}>
                          <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => openAction(r, 'confirm')}>Confirmar</button>
                          <button className="btn btn-danger" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => openAction(r, 'reject')}>Rechazar</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              }
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail / Action modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => { setSelected(null); setAction(null); }}>
          <div className="modal" style={{ width: 640 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 11, color: '#71717A', fontFamily: 'monospace', marginBottom: 3 }}>{selected.codigo ?? selected.id}</div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>{selected.proyecto}</h2>
              </div>
              <span className={`badge status-badge badge-${BADGE[selected.estado]}`}>{selected.estado}</span>
            </div>

            <RequirementStatusTimeline requirement={selected} />

            <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['Sede', selected.sede], ['Ubicación', selected.ubicacion], ['Analista', selected.analista], ['Técnico responsable', selected.tecnico], ['Fecha solicitud', selected.fecha]].map(([k, v]) => (
                <div key={String(k)} style={{ gridColumn: k === 'Ubicación' ? '1/-1' : undefined }}>
                  <div style={{ fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#18181B' }}>{v}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Descripción</div>
                <div style={{ fontSize: 12.5, color: '#52525B', lineHeight: 1.6 }}>{selected.descripcion}</div>
              </div>
            </div>

            <div style={{ padding: '0 22px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Materiales requeridos ({selected.materiales.length})
              </div>
              <table className="data-table">
                <thead><tr><th>SKU</th><th></th><th>Material</th><th>Solicitado</th><th>Stock en sede</th></tr></thead>
                <tbody>
                  {selected.materiales.map((m, i) => {
                    const mat = state.materials.find(x => x.id === m.skuId);
                    const stock = mat ? mat.stockSedes[selected.sede] : null;
                    const ok = stock !== null && stock >= m.cantidad;
                    return (
                      <tr key={i}>
                        <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB' }}>{m.skuId}</td>
                        <td style={{ padding: '0 4px' }}>
                          {mat && <PreviewBtn onClick={e => { e.stopPropagation(); setPreviewMat(mat); }} />}
                        </td>
                        <td style={{ fontSize: 12 }}>{m.nombre}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.cantidad} UND</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: stock === null ? '#A1A1AA' : ok ? '#059669' : '#DC2626' }}>
                          {stock === null ? '—' : `${stock} UND`}
                          {!ok && stock !== null && <span style={{ fontSize: 10, display: 'block', color: '#DC2626' }}>insuficiente</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Action zone */}
            {selected.estado === 'ENVIADO' && (
              <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', background: action ? (action === 'confirm' ? '#F0FDF4' : '#FFF5F5') : '#FAFAFA' }}>
                {!action ? (
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                    <button className="btn btn-ghost" onClick={() => { setSelected(null); }}>Cerrar</button>
                    <button className="btn btn-danger" style={{ padding: '8px 20px' }} onClick={() => setAction('reject')}>Rechazar solicitud</button>
                    <button className="btn btn-primary" style={{ padding: '8px 20px', background: '#059669', border: 'none' }} onClick={() => setAction('confirm')}>Confirmar solicitud</button>
                  </div>
                ) : (
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 8, color: action === 'confirm' ? '#15803D' : '#DC2626' }}>
                      {action === 'confirm' ? 'Observaciones (opcional)' : 'Motivo del rechazo *'}
                    </label>
                    <textarea className="input-field" rows={3} style={{ resize: 'none', fontFamily: 'inherit', borderColor: action === 'reject' ? '#FECACA' : '#BBF7D0' }}
                      placeholder={action === 'confirm' ? 'Ej. Materiales aprobados. Coordinar entrega el…' : 'Explica el motivo del rechazo…'}
                      value={obsModal} onChange={e => setObsModal(e.target.value)} />
                    <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
                      <button className="btn btn-ghost" onClick={() => setAction(null)}>← Volver</button>
                      {action === 'confirm'
                        ? <button className="btn btn-primary" disabled={reviewing} style={{ background: '#059669', border: 'none', padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => void handleConfirm(selected)}><svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> {reviewing ? 'Confirmando…' : 'Confirmar'}</button>
                        : <button className="btn btn-danger" disabled={reviewing} style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => void handleReject(selected)}><svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> {reviewing ? 'Rechazando…' : 'Rechazar'}</button>
                      }
                    </div>
                  </div>
                )}
              </div>
            )}

            {selected.estado !== 'ENVIADO' && (
              <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', display: 'flex', justifyContent: 'flex-end' }}>
                {selected.observaciones && (
                  <div style={{ flex: 1, fontSize: 12.5, color: selected.estado === 'RECHAZADO' ? '#DC2626' : '#15803D' }}>
                    <strong>Observación:</strong> {selected.observaciones}
                  </div>
                )}
                <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
              </div>
            )}
          </div>
        </div>
      )}
    {previewMat && <MaterialPreviewModal material={previewMat} onClose={() => setPreviewMat(null)} />}
    </div>
  );
}
