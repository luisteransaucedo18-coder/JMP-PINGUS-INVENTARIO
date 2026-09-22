import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { RequerimientoCompra, EstadoCompra, SEDES, Sede } from '../../data/mockData';
import MaterialPreviewModal, { PreviewBtn } from '../../components/MaterialPreviewModal';
import { Material } from '../../data/mockData';

interface Props { onToast: (m: string) => void; usuario: string; }

const E_COLOR: Record<EstadoCompra, string> = { BORRADOR: '#8B8FA8', ENVIADO: '#D97706', APROBADO: '#2563EB', COMPRADO: '#059669', RECHAZADO: '#DC2626' };
const E_BG:    Record<EstadoCompra, string> = { BORRADOR: '#F4F4F5', ENVIADO: '#FEF3C7', APROBADO: '#DBEAFE', COMPRADO: '#CCFBF1', RECHAZADO: '#FEE2E2' };
const E_LABEL: Record<EstadoCompra, string> = { BORRADOR: 'Borrador', ENVIADO: 'Pendiente aprobación', APROBADO: 'Aprobado — por comprar', COMPRADO: 'Comprado e ingresado', RECHAZADO: 'Rechazado' };

type ModalMode = 'detail' | 'approve' | 'reject' | 'confirm';

export default function ComprasView({ onToast, usuario }: Props) {
  const { state, dispatch } = useAppStore();

  const [estadoFilter, setEstadoFilter] = useState<EstadoCompra | ''>('ENVIADO');
  const [sedeFilter,   setSedeFilter]   = useState<Sede | ''>('');
  const [search,       setSearch]       = useState('');
  const [selected,     setSelected]     = useState<RequerimientoCompra | null>(null);
  const [mode,         setMode]         = useState<ModalMode>('detail');
  const [obs,          setObs]          = useState('');
  const [notaCompra,   setNotaCompra]   = useState('');
  const [previewMat,   setPreviewMat]   = useState<Material | null>(null);

  const filtered = state.compras.filter(c =>
    (!estadoFilter || c.estado === estadoFilter) &&
    (!sedeFilter   || c.sede   === sedeFilter)   &&
    (!search || c.id.toLowerCase().includes(search.toLowerCase()) || c.analista.toLowerCase().includes(search.toLowerCase()) || c.motivo.toLowerCase().includes(search.toLowerCase()))
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const pending  = state.compras.filter(c => c.estado === 'ENVIADO').length;
  const approved = state.compras.filter(c => c.estado === 'APROBADO').length;

  /* Actions */
  const doApprove = (c: RequerimientoCompra) => {
    dispatch({ type: 'APPROVE_COMPRA', payload: { id: c.id, coordinador: usuario, observaciones: obs || undefined } });
    onToast(`✓ Orden ${c.id} aprobada — autorizada para compra`);
    closeModal();
  };
  const doReject = (c: RequerimientoCompra) => {
    if (!obs.trim()) { onToast('⚠ Indica el motivo del rechazo'); return; }
    dispatch({ type: 'REJECT_COMPRA', payload: { id: c.id, coordinador: usuario, observaciones: obs } });
    onToast(`Orden ${c.id} rechazada`);
    closeModal();
  };
  const doConfirm = (c: RequerimientoCompra) => {
    dispatch({ type: 'CONFIRM_COMPRA', payload: { id: c.id, coordinador: usuario, notaCompra: notaCompra || undefined } });
    const totalItems = c.items.reduce((s, it) => s + it.cantidadSolicitada, 0);
    onToast(`✓ Compra confirmada — ${totalItems} UND ingresadas al stock de ${c.sede}`);
    closeModal();
  };

  const openModal = (c: RequerimientoCompra, m: ModalMode) => {
    setSelected(c); setMode(m); setObs(''); setNotaCompra('');
  };
  const closeModal = () => { setSelected(null); };

  const totalEstimado = (c: RequerimientoCompra) =>
    c.items.reduce((s, it) => s + it.cantidadSolicitada * (it.precioUnitario ?? 0), 0);

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: '#EEF0FF' }}>

      {/* ── KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
        {([
          ['ENVIADO',  'Pendientes',    '#D97706', '#FEF3C7'],
          ['APROBADO', 'Aprobadas',     '#2563EB', '#DBEAFE'],
          ['COMPRADO', 'Completadas',   '#059669', '#CCFBF1'],
          ['RECHAZADO','Rechazadas',    '#DC2626', '#FEE2E2'],
          ['',         'Total órdenes', '#8B8FA8', '#F8F9FF'],
        ] as [EstadoCompra | '', string, string, string][]).map(([est, label, color, bg]) => {
          const cnt = est ? state.compras.filter(c => c.estado === est).length : state.compras.length;
          return (
            <div key={label} className="kpi-card" style={{ cursor: est ? 'pointer' : 'default', outline: estadoFilter === est && est ? `2px solid ${color}` : 'none' }}
              onClick={() => est && setEstadoFilter(estadoFilter === est ? '' : est)}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              </div>
              <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: '-0.03em' }}>{cnt}</div>
              <div style={{ fontSize: 11.5, color: '#8B8FA8', marginTop: 4, fontWeight: 500 }}>{label}</div>
            </div>
          );
        })}
      </div>

      {/* ── Alert banners ── */}
      {pending > 0 && (
        <div style={{ marginBottom: 16, background: '#FFFBEB', border: '1.5px solid #FDE68A', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L14 13H1L7.5 1z" stroke="#D97706" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 6v3M7.5 11v.5" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round"/></svg>
          <span style={{ fontSize: 13, color: '#92400E' }}><strong>{pending} orden{pending !== 1 ? 'es' : ''}</strong> esperan tu aprobación.</span>
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12 }} onClick={() => setEstadoFilter('ENVIADO')}>Ver pendientes →</button>
        </div>
      )}
      {approved > 0 && (
        <div style={{ marginBottom: 16, background: '#EFF6FF', border: '1.5px solid #BFDBFE', borderRadius: 14, padding: '12px 18px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="#2563EB" strokeWidth="1.3"/><path d="M4.5 7.5l2 2 3.5-3.5" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          <span style={{ fontSize: 13, color: '#1D4ED8' }}><strong>{approved} orden{approved !== 1 ? 'es' : ''}</strong> aprobadas — confirma la compra cuando lleguen los materiales.</span>
          <button className="btn btn-ghost" style={{ marginLeft: 'auto', fontSize: 12, borderColor: '#BFDBFE' }} onClick={() => setEstadoFilter('APROBADO')}>Ver aprobadas →</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="panel">
        {/* Filters */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F2FF', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input-field" style={{ maxWidth: 240 }} placeholder="Buscar orden, analista, motivo…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select-field" value={estadoFilter} onChange={e => setEstadoFilter(e.target.value as EstadoCompra | '')}>
            <option value="">Todos los estados</option>
            {(['ENVIADO','APROBADO','COMPRADO','RECHAZADO','BORRADOR'] as EstadoCompra[]).map(e =>
              <option key={e} value={e}>{E_LABEL[e]}</option>
            )}
          </select>
          <select className="select-field" value={sedeFilter} onChange={e => setSedeFilter(e.target.value as Sede | '')}>
            <option value="">Todas las sedes</option>
            {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#8B8FA8' }}>{filtered.length} órdenes</div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr><th>ID</th><th>Analista</th><th>Sede</th><th>Items</th><th>Total est.</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={8} style={{ textAlign: 'center', color: '#8B8FA8', padding: 40 }}>Sin órdenes para este filtro</td></tr>
              ) : filtered.map(c => (
                <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => openModal(c, 'detail')}>
                  <td style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#2563EB', fontWeight: 700 }}>{c.id}</td>
                  <td style={{ fontSize: 12.5, fontWeight: 500 }}>{c.analista}</td>
                  <td>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: '#2563EB', background: '#DBEAFE', borderRadius: 6, padding: '2px 8px' }}>{c.sede}</span>
                  </td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.items.length}</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#1A1D23' }}>
                    {totalEstimado(c) > 0 ? `S/. ${totalEstimado(c).toFixed(2)}` : <span style={{ color: '#C4C6D8' }}>—</span>}
                  </td>
                  <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#8B8FA8' }}>{c.fecha}</td>
                  <td>
                    <span style={{ background: E_BG[c.estado], color: E_COLOR[c.estado], borderRadius: 7, padding: '3px 10px', fontSize: 11, fontWeight: 700 }}>{c.estado}</span>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div style={{ display: 'flex', gap: 5 }}>
                      {c.estado === 'ENVIADO' && <>
                        <button className="btn btn-primary" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => openModal(c, 'approve')}>Aprobar</button>
                        <button className="btn btn-danger" style={{ padding: '4px 10px', fontSize: 11 }} onClick={() => openModal(c, 'reject')}>Rechazar</button>
                      </>}
                      {c.estado === 'APROBADO' && (
                        <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 11, background: '#059669', boxShadow: '0 2px 8px rgba(5,150,105,0.3)', display: 'flex', alignItems: 'center', gap: 4 }} onClick={() => openModal(c, 'confirm')}>
                          <svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> Confirmar compra
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modal ── */}
      {selected && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal" style={{ width: 680, maxHeight: '88vh' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 11, color: '#8B8FA8', fontFamily: 'monospace', marginBottom: 3 }}>{selected.id}</div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: '#1A1D23' }}>Orden de Compra</h2>
                <div style={{ fontSize: 12, color: '#8B8FA8', marginTop: 2 }}>{selected.analista} · {selected.sede}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ background: E_BG[selected.estado], color: E_COLOR[selected.estado], borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>{selected.estado}</span>
                <button onClick={closeModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B8FA8', fontSize: 20, lineHeight: 1 }}>×</button>
              </div>
            </div>

            {/* Detail body */}
            <div style={{ padding: '20px 24px' }}>
              {/* Motivo */}
              <div style={{ background: '#F8F9FF', borderRadius: 12, padding: '14px 16px', marginBottom: 18 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>Motivo de la compra</div>
                <div style={{ fontSize: 13, color: '#1A1D23', lineHeight: 1.6 }}>{selected.motivo}</div>
              </div>

              {/* Items table */}
              <div style={{ fontSize: 11, fontWeight: 700, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>
                Materiales solicitados ({selected.items.length})
              </div>
              <table className="data-table" style={{ marginBottom: 18 }}>
                <thead>
                  <tr><th></th><th>SKU</th><th>Material</th><th>Cantidad</th><th>Precio unit.</th><th>Subtotal</th><th>Stock actual</th></tr>
                </thead>
                <tbody>
                  {selected.items.map((it, i) => {
                    const mat = state.materials.find(m => m.id === it.skuId);
                    const stock = mat ? mat.stockSedes[selected.sede] : null;
                    const sub = it.cantidadSolicitada * (it.precioUnitario ?? 0);
                    return (
                      <tr key={i}>
                        <td style={{ width: 32, padding: '10px 8px 10px 16px' }}>
                          {mat && <PreviewBtn onClick={e => { e.stopPropagation(); setPreviewMat(mat); }} />}
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#2563EB' }}>{it.skuId || '—'}</td>
                        <td style={{ fontSize: 12.5, fontWeight: 500 }}>{it.nombre}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{it.cantidadSolicitada} UND</td>
                        <td style={{ fontFamily: 'monospace', color: '#8B8FA8' }}>{it.precioUnitario ? `S/. ${it.precioUnitario.toFixed(2)}` : '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563EB' }}>{sub > 0 ? `S/. ${sub.toFixed(2)}` : '—'}</td>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600, color: stock === null ? '#C4C6D8' : stock === 0 ? '#DC2626' : '#059669' }}>
                          {stock === null ? '—' : `${stock} UND`}
                          {mat && stock !== null && stock < mat.minimo && (
                            <div style={{ fontSize: 9.5, color: '#DC2626' }}>bajo mínimo</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Total */}
              {totalEstimado(selected) > 0 && (
                <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '0 0 18px' }}>
                  <div style={{ background: '#EEF0FF', borderRadius: 10, padding: '10px 18px', display: 'flex', gap: 16, alignItems: 'center' }}>
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: '#8B8FA8' }}>Total estimado</span>
                    <span style={{ fontSize: 20, fontWeight: 900, color: '#2563EB' }}>S/. {totalEstimado(selected).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {/* Timeline */}
              <div style={{ display: 'flex', gap: 0, marginBottom: 18 }}>
                {[
                  { label: 'Creado',   date: selected.fecha,           done: true },
                  { label: 'Aprobado', date: selected.fechaAprobacion, done: !!selected.fechaAprobacion },
                  { label: 'Comprado', date: selected.fechaCompra,     done: !!selected.fechaCompra },
                ].map((step, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
                    {i > 0 && <div style={{ position: 'absolute', top: 12, right: '50%', width: '100%', height: 2, background: step.done ? '#2563EB' : '#E8EAFF', zIndex: 0 }} />}
                    <div style={{ width: 26, height: 26, borderRadius: '50%', background: step.done ? '#2563EB' : '#E8EAFF', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1, border: '3px solid #fff', boxShadow: step.done ? '0 0 0 3px rgba(37,99,235,0.15)' : 'none' }}>
                      {step.done && <svg width="10" height="10" viewBox="0 0 10 10"><path d="M1.5 5l2.5 2.5 4.5-4.5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></svg>}
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: step.done ? '#2563EB' : '#C4C6D8', marginTop: 6 }}>{step.label}</div>
                    <div style={{ fontSize: 10, color: '#8B8FA8', marginTop: 2 }}>{step.date ?? '—'}</div>
                  </div>
                ))}
              </div>

              {selected.observaciones && (
                <div style={{ background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#92400E', marginBottom: 10 }}>
                  <strong>Observación:</strong> {selected.observaciones}
                </div>
              )}
              {selected.notaCompra && (
                <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '10px 14px', fontSize: 12.5, color: '#15803D', marginBottom: 10 }}>
                  <strong>Nota de compra:</strong> {selected.notaCompra}
                </div>
              )}
            </div>

            {/* Action zone */}
            {(mode === 'approve' || mode === 'reject' || mode === 'confirm') && (
              <div style={{
                padding: '18px 24px', borderTop: '1px solid #F0F2FF',
                background: mode === 'approve' ? '#F0FDF4' : mode === 'confirm' ? '#EFF6FF' : '#FFF5F5',
              }}>
                {mode === 'approve' && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#15803D', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> Aprobar orden de compra
                    </div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Observaciones (opcional)</label>
                    <textarea className="input-field" rows={2} style={{ resize: 'none', fontFamily: 'inherit' }}
                      placeholder="Indica condiciones, proveedor preferido, plazo estimado…"
                      value={obs} onChange={e => setObs(e.target.value)} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" onClick={() => setMode('detail')}>← Volver</button>
                      <button className="btn btn-primary" style={{ background: '#059669', boxShadow: '0 2px 8px rgba(5,150,105,0.3)', padding: '9px 22px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => doApprove(selected)}>
                        <svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> Confirmar aprobación
                      </button>
                    </div>
                  </>
                )}
                {mode === 'reject' && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> Rechazar orden de compra</div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Motivo del rechazo <span style={{ color: '#DC2626' }}>*</span></label>
                    <textarea className="input-field" rows={2} style={{ resize: 'none', fontFamily: 'inherit', borderColor: '#FECACA' }}
                      placeholder="Explica el motivo del rechazo…"
                      value={obs} onChange={e => setObs(e.target.value)} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 12, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" onClick={() => setMode('detail')}>← Volver</button>
                      <button className="btn btn-danger" style={{ padding: '9px 22px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => doReject(selected)}><svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg> Rechazar</button>
                    </div>
                  </>
                )}
                {mode === 'confirm' && (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#2563EB', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 7 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 2L22 7.5V16.5L12 22L2 16.5V7.5L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M12 2v20M2 7.5l10 5 10-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> Confirmar recepción de compra</div>
                    <div style={{ fontSize: 12, color: '#8B8FA8', marginBottom: 12 }}>
                      Al confirmar, el stock de <strong>{selected.sede}</strong> se actualizará automáticamente con las cantidades de esta orden.
                    </div>
                    {/* Preview of what will change */}
                    <div style={{ background: '#fff', borderRadius: 10, border: '1.5px solid #BFDBFE', overflow: 'hidden', marginBottom: 14 }}>
                      <div style={{ padding: '9px 14px', background: '#EFF6FF', borderBottom: '1px solid #BFDBFE', fontSize: 11, fontWeight: 700, color: '#1D4ED8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Actualización de stock en {selected.sede}
                      </div>
                      {selected.items.map((it, i) => {
                        const mat = state.materials.find(m => m.id === it.skuId);
                        const stockActual = mat ? mat.stockSedes[selected.sede] : 0;
                        const stockNuevo = stockActual + it.cantidadSolicitada;
                        return (
                          <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 14px', borderBottom: i < selected.items.length - 1 ? '1px solid #F0F2FF' : 'none' }}>
                            <div style={{ fontSize: 12.5, color: '#1A1D23', fontWeight: 500, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.nombre}</div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontFamily: 'monospace', fontSize: 12 }}>
                              <span style={{ color: '#8B8FA8' }}>{stockActual} UND</span>
                              <span style={{ color: '#C4C6D8' }}>→</span>
                              <span style={{ fontWeight: 800, color: '#059669' }}>{stockNuevo} UND</span>
                              <span style={{ fontSize: 11, color: '#059669', background: '#CCFBF1', borderRadius: 5, padding: '1px 6px' }}>+{it.cantidadSolicitada}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Nota de compra (opcional)</label>
                    <input className="input-field" placeholder="N° factura, proveedor, fecha de recepción…"
                      value={notaCompra} onChange={e => setNotaCompra(e.target.value)} />
                    <div style={{ display: 'flex', gap: 10, marginTop: 14, justifyContent: 'flex-end' }}>
                      <button className="btn btn-ghost" onClick={() => setMode('detail')}>← Volver</button>
                      <button className="btn btn-primary" style={{ padding: '9px 22px', boxShadow: '0 2px 10px rgba(37,99,235,0.35)', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => doConfirm(selected)}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2L22 7.5V16.5L12 22L2 16.5V7.5L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M12 2v20M2 7.5l10 5 10-5" stroke="currentColor" strokeWidth="1.5"/></svg>
                        Ingresar al stock
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Default footer */}
            {mode === 'detail' && (
              <div style={{ padding: '14px 24px', borderTop: '1px solid #F0F2FF', display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button className="btn btn-ghost" onClick={closeModal}>Cerrar</button>
                {selected.estado === 'ENVIADO' && <>
                  <button className="btn btn-danger" style={{ padding: '8px 18px' }} onClick={() => setMode('reject')}>Rechazar</button>
                  <button className="btn btn-primary" style={{ padding: '8px 18px', background: '#059669', boxShadow: '0 2px 8px rgba(5,150,105,0.28)' }} onClick={() => setMode('approve')}>Aprobar</button>
                </>}
                {selected.estado === 'APROBADO' && (
                  <button className="btn btn-primary" style={{ padding: '8px 20px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => setMode('confirm')}><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M12 2L22 7.5V16.5L12 22L2 16.5V7.5L12 2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="M12 2v20M2 7.5l10 5 10-5" stroke="currentColor" strokeWidth="1.5"/></svg> Confirmar compra</button>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {previewMat && <MaterialPreviewModal material={previewMat} onClose={() => setPreviewMat(null)} />}
    </div>
  );
}
