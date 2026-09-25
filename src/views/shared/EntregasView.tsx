import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { Requerimiento, EntregaItem, EstadoEntrega } from '../../data/mockData';
import MaterialPreviewModal, { PreviewBtn } from '../../components/MaterialPreviewModal';
import { Material } from '../../data/mockData';
import { registrarEntrega } from '../../service/devolucionService';

interface Props { onToast: (msg: string) => void; usuario: string; }

const ESTADO_E: Record<EstadoEntrega, { bg: string; color: string; label: string }> = {
  PENDIENTE: { bg: '#F4F4F5', color: '#71717A', label: 'Pendiente de entrega' },
  PARCIAL:   { bg: '#FEF3C7', color: '#D97706', label: 'Entrega parcial' },
  COMPLETA:  { bg: '#CCFBF1', color: '#059669', label: 'Entrega completa' },
  CANCELADA: { bg: '#FEE2E2', color: '#DC2626', label: 'Cancelada' },
};

function Comprobante({ entregaId, req, tecnico, dni, responsable, items, fecha, hora, obs, onClose }:
  { entregaId: string; req: Requerimiento; tecnico: string; dni: string; responsable: string; items: EntregaItem[]; fecha: string; hora: string; obs: string; onClose: () => void }) {

  const totalSolicitado = items.reduce((s, i) => s + i.cantidadSolicitada, 0);
  const totalEntregado = items.reduce((s, i) => s + i.cantidadEntregada, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 600 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <div style={{ fontSize: 11, color: '#71717A', fontFamily: 'monospace', marginBottom: 2 }}>{entregaId}</div>
            <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Comprobante de Entrega</h2>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-ghost" style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 5 }} onClick={() => window.print()}><svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M3 5V1h9v4M3 11H1V5h13v6h-2" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M3 8h9v6H3V8z" stroke="currentColor" strokeWidth="1.3"/></svg> Imprimir</button>
            <button className="btn btn-ghost" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button>
          </div>
        </div>

        <div id="comprobante-print" style={{ padding: '18px 22px' }}>
          {/* Company header */}
          <div style={{ textAlign: 'center', marginBottom: 18, paddingBottom: 14, borderBottom: '2px solid #E4E4E7' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: '#18181B' }}>JIP — Gestión de Materiales</div>
            <div style={{ fontSize: 12, color: '#71717A', marginTop: 2 }}>Comprobante de entrega de materiales al técnico</div>
          </div>

          {/* Meta */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
            {[
              ['N° Comprobante', entregaId],
              ['Fecha y hora', `${fecha} ${hora}`],
              ['Requerimiento', req.id],
              ['Proyecto', req.proyecto],
              ['Sede', req.sede],
              ['Técnico receptor', tecnico],
              ['DNI / Documento', dni || '—'],
              ['Responsable entrega', responsable],
            ].map(([k, v]) => (
              <div key={k} style={{ background: '#F9FAFB', borderRadius: 6, padding: '8px 10px' }}>
                <div style={{ fontSize: 10, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{k}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181B' }}>{v}</div>
              </div>
            ))}
          </div>

          {/* Materials table */}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
              Materiales entregados
            </div>
            <table className="data-table">
              <thead>
                <tr><th>SKU</th><th>Material</th><th>Solicitado</th><th>Entregado</th><th>Saldo</th></tr>
              </thead>
              <tbody>
                {items.map((item, i) => {
                  const saldo = item.cantidadSolicitada - item.cantidadEntregada;
                  return (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB' }}>{item.skuId}</td>
                      <td style={{ fontSize: 12 }}>{item.nombre}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{item.cantidadSolicitada} UND</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700, color: item.cantidadEntregada === item.cantidadSolicitada ? '#059669' : '#D97706' }}>{item.cantidadEntregada} UND</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600, color: saldo > 0 ? '#DC2626' : '#059669' }}>{saldo} UND</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ background: '#F9FAFB' }}>
                  <td colSpan={2} style={{ fontWeight: 700, fontSize: 12 }}>TOTALES</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{totalSolicitado} UND</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#059669' }}>{totalEntregado} UND</td>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700, color: totalSolicitado - totalEntregado > 0 ? '#DC2626' : '#059669' }}>{totalSolicitado - totalEntregado} UND</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {obs && (
            <div style={{ background: '#F9FAFB', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#52525B', marginBottom: 14, borderLeft: '3px solid #E4E4E7' }}>
              <strong>Observaciones:</strong> {obs}
            </div>
          )}

          {/* Signatures */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, marginTop: 28 }}>
            {['Entregado por', 'Recibido por (técnico)'].map(label => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ height: 50, borderBottom: '1.5px solid #18181B', marginBottom: 6 }} />
                <div style={{ fontSize: 11, color: '#52525B' }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function EntregaForm({ req, usuario, onDone, onCancel }: { req: Requerimiento; usuario: string; onDone: () => void; onCancel: () => void }) {
  const { state, dispatch } = useAppStore();
  const [tecnico, setTecnico] = useState(req.tecnico);
  const [dni, setDni] = useState('');
  const [obs, setObs] = useState('');
  const [items, setItems] = useState<EntregaItem[]>(
    req.materiales.map(m => ({ skuId: m.skuId, nombre: m.nombre, cantidadSolicitada: m.cantidad, cantidadEntregada: m.cantidad }))
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showConfirm, setShowConfirm] = useState(false);
  const [showComprobante, setShowComprobante] = useState(false);
  const [entregaId, setEntregaId] = useState('');
  const [previewMat, setPreviewMat] = useState<Material | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const updateQty = (i: number, v: string) => {
    const n = Math.max(0, Math.min(items[i].cantidadSolicitada, parseInt(v) || 0));
    setItems(prev => prev.map((item, j) => j === i ? { ...item, cantidadEntregada: n } : item));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!tecnico.trim()) e.tecnico = 'Requerido';
    return e;
  };

  const handleConfirm = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    setShowConfirm(true);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const persistedId = await registrarEntrega(req.id, tecnico, dni, obs, items);
      dispatch({
        type: 'CREATE_ENTREGA',
        payload: { requerimientoId: req.id, proyectoNombre: req.proyecto, tecnico, dniTecnico: dni, responsableEntrega: usuario, items, observaciones: obs },
      });
    const today = new Date().toISOString().split('T')[0];
    const hora = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    setEntregaId(persistedId);
    setShowConfirm(false);
    setShowComprobante(true);
    } catch (error) {
      setErrors(prev => ({ ...prev, submit: error instanceof Error ? error.message : 'No se pudo registrar la entrega.' }));
    } finally { setSubmitting(false); }
  };

  const allComplete = items.every(i => i.cantidadEntregada >= i.cantidadSolicitada);
  const someDelivered = items.some(i => i.cantidadEntregada > 0);
  const estadoPreview: EstadoEntrega = allComplete ? 'COMPLETA' : someDelivered ? 'PARCIAL' : 'PENDIENTE';

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <button className="btn btn-ghost" style={{ marginBottom: 18, fontSize: 12 }} onClick={onCancel}>← Volver</button>

        {/* Header */}
        <div className="panel" style={{ padding: '18px 22px', marginBottom: 20 }}>
          <div style={{ fontSize: 11, color: '#71717A', fontFamily: 'monospace', marginBottom: 4 }}>{req.id}</div>
          <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800, color: '#18181B' }}>{req.proyecto}</h2>
          <div style={{ fontSize: 13, color: '#71717A', display: 'flex', alignItems: 'center', gap: 4 }}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 1C5 1 3 3 3 6c0 3.5 4.5 8 4.5 8S12 9.5 12 6c0-3-2-5-4.5-5z" stroke="currentColor" strokeWidth="1.3"/></svg>{req.ubicacion} · {req.sede}</div>
        </div>

        {/* Técnico & datos */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="section-header"><span className="section-title">Datos de la entrega</span></div>
          <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Técnico receptor <span style={{ color: '#DC2626' }}>*</span></label>
              <input className="input-field" value={tecnico} style={{ borderColor: errors.tecnico ? '#DC2626' : undefined }}
                onChange={e => { setTecnico(e.target.value); setErrors(p => ({ ...p, tecnico: '' })); }} />
              {errors.tecnico && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.tecnico}</div>}
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>DNI / Documento</label>
              <input className="input-field" placeholder="Ej. 43215678" value={dni}
                onChange={e => setDni(e.target.value)} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Responsable de entrega</label>
              <input className="input-field" value={usuario} disabled style={{ background: '#F9FAFB', color: '#71717A' }} />
            </div>
            <div style={{ gridColumn: '1/-1' }}>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Observaciones</label>
              <textarea className="input-field" rows={2} placeholder="Notas sobre la entrega, condiciones, etc."
                style={{ resize: 'none', fontFamily: 'inherit' }}
                value={obs} onChange={e => setObs(e.target.value)} />
            </div>
          </div>
        </div>

        {/* Materials */}
        <div className="panel" style={{ marginBottom: 20 }}>
          <div className="section-header">
            <span className="section-title">Materiales a entregar</span>
            <span style={{ background: ESTADO_E[estadoPreview].bg, color: ESTADO_E[estadoPreview].color, borderRadius: 4, padding: '2px 10px', fontSize: 11, fontWeight: 700 }}>
              {ESTADO_E[estadoPreview].label}
            </span>
          </div>
          <div style={{ padding: '12px 16px 16px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px 130px 100px', gap: 10, marginBottom: 10 }}>
              {['', 'Material (SKU · nombre)', 'Solicitado', 'A entregar', 'Saldo'].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
              ))}
            </div>
            {items.map((item, i) => {
              const mat = state.materials.find(m => m.id === item.skuId);
              const saldo = item.cantidadSolicitada - item.cantidadEntregada;
              return (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '40px 1fr 130px 130px 100px', gap: 10, marginBottom: 10, alignItems: 'center', background: '#F9FAFB', borderRadius: 8, padding: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {mat && <PreviewBtn onClick={e => { e.stopPropagation(); setPreviewMat(mat); }} />}
                  </div>
                  <div>
                    <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB', fontWeight: 700 }}>{item.skuId}</div>
                    <div style={{ fontSize: 12.5, color: '#18181B', fontWeight: 500, lineHeight: 1.3 }}>{item.nombre}</div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 600, color: '#52525B' }}>
                    {item.cantidadSolicitada} UND
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <input type="number" min="0" max={item.cantidadSolicitada}
                        value={item.cantidadEntregada}
                        onChange={e => updateQty(i, e.target.value)}
                        style={{ width: 70, padding: '6px 8px', border: `1px solid ${item.cantidadEntregada < item.cantidadSolicitada ? '#FDE68A' : '#BBF7D0'}`, borderRadius: 6, fontSize: 13, fontWeight: 700, textAlign: 'center', fontFamily: 'monospace', background: item.cantidadEntregada === 0 ? '#FFF5F5' : item.cantidadEntregada < item.cantidadSolicitada ? '#FFFBEB' : '#F0FDF4' }}
                      />
                      <span style={{ fontSize: 10.5, color: '#71717A' }}>UND</span>
                    </div>
                  </div>
                  <div style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: saldo > 0 ? '#DC2626' : '#059669' }}>
                    {saldo} UND
                    {saldo > 0 && <div style={{ fontSize: 9.5, color: '#D97706', fontFamily: 'sans-serif', fontWeight: 600 }}>pendiente</div>}
                  </div>
                </div>
              );
            })}
            {!allComplete && (
              <div style={{ marginTop: 12, background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 14px', fontSize: 12, color: '#92400E' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><svg width="12" height="12" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L14 13H1L7.5 1z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 5.5V9M7.5 10.5v.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg> Entrega parcial: el requerimiento permanecerá abierto para futuros recojos.</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingBottom: 24 }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" style={{ padding: '10px 24px', background: '#059669', border: 'none' }} onClick={handleConfirm}>
            Confirmar entrega
          </button>
        </div>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div className="modal-overlay" onClick={() => setShowConfirm(false)}>
          <div className="modal" style={{ width: 420 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>Confirmar entrega</h2>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowConfirm(false)}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 13.5, color: '#52525B', lineHeight: 1.6 }}>
                Vas a registrar una entrega <strong>{ESTADO_E[estadoPreview].label.toLowerCase()}</strong> de {items.reduce((s, i) => s + i.cantidadEntregada, 0)} UND al técnico <strong>{tecnico}</strong>.
              </div>
              {!allComplete && (
                <div style={{ marginTop: 12, background: '#FEF3C7', borderRadius: 6, padding: '10px 12px', fontSize: 12, color: '#92400E' }}>
                  Los materiales restantes quedarán como saldo pendiente y podrán recogerse en una nueva entrega.
                </div>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setShowConfirm(false)}>Revisar</button>
              <button className="btn btn-primary" disabled={submitting} style={{ background: '#059669', border: 'none', padding: '9px 22px' }} onClick={() => void handleSubmit()}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg> {submitting ? 'Registrando…' : 'Registrar entrega'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Comprobante */}
      {showComprobante && (
        <Comprobante
          entregaId={entregaId}
          req={req}
          tecnico={tecnico}
          dni={dni}
          responsable={usuario}
          items={items}
          fecha={new Date().toISOString().split('T')[0]}
          hora={new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' })}
          obs={obs}
          onClose={() => { setShowComprobante(false); onDone(); }}
        />
      )}

      {previewMat && <MaterialPreviewModal material={previewMat} onClose={() => setPreviewMat(null)} />}
    </div>
  );
}

export default function EntregasView({ onToast, usuario }: Props) {
  const { state } = useAppStore();
  const [selectedReq, setSelectedReq] = useState<Requerimiento | null>(null);
  const [search, setSearch] = useState('');

  const confirmados = state.requerimientos.filter(r => r.estado === 'CONFIRMADO');

  const getEntregaStatus = (reqId: string): EstadoEntrega | null => {
    const entregas = state.entregas.filter(e => e.requerimientoId === reqId);
    if (entregas.length === 0) return null;
    const last = [...entregas].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
    return last.estado;
  };

  const filtered = confirmados.filter(r =>
    !search ||
    r.id.toLowerCase().includes(search.toLowerCase()) ||
    r.proyecto.toLowerCase().includes(search.toLowerCase()) ||
    r.tecnico.toLowerCase().includes(search.toLowerCase())
  );

  if (selectedReq) {
    return (
      <EntregaForm
        req={selectedReq}
        usuario={usuario}
        onDone={() => { setSelectedReq(null); onToast('✓ Entrega registrada correctamente'); }}
        onCancel={() => setSelectedReq(null)}
      />
    );
  }

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Reqs confirmados', value: confirmados.length, color: '#059669', bg: '#CCFBF1' },
          { label: 'Sin entrega', value: confirmados.filter(r => !getEntregaStatus(r.id)).length, color: '#71717A', bg: '#F4F4F5' },
          { label: 'Entrega parcial', value: state.entregas.filter(e => e.estado === 'PARCIAL').length, color: '#D97706', bg: '#FEF3C7' },
          { label: 'Entrega completa', value: state.entregas.filter(e => e.estado === 'COMPLETA').length, color: '#059669', bg: '#CCFBF1' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className="kpi-card">
            <div style={{ width: 34, height: 34, borderRadius: 8, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
            </div>
            <div style={{ fontSize: 26, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 12, color: '#71717A', marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>

      <div className="panel">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E4E4E7', display: 'flex', gap: 10, alignItems: 'center' }}>
          <input className="input-field" style={{ maxWidth: 280 }}
            placeholder="Buscar por ID, proyecto o técnico…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#71717A' }}>{filtered.length} requerimiento{filtered.length !== 1 ? 's' : ''} confirmados</div>
        </div>

        {filtered.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#A1A1AA' }}>
            <div style={{ marginBottom: 12, color: '#C4C6D8', display: 'flex', justifyContent: 'center' }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none"><path d="M12 2L22 7.5V16.5L12 22L2 16.5V7.5L12 2z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/><path d="M12 2v20M2 7.5l10 5 10-5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#71717A' }}>Sin requerimientos confirmados</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>Los requerimientos aprobados por el coordinador aparecerán aquí.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Proyecto</th><th>Sede</th><th>Técnico</th><th>Materiales</th><th>Confirmado</th><th>Estado entrega</th><th>Acción</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => {
                  const estEnt = getEntregaStatus(r.id);
                  return (
                    <tr key={r.id}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB', fontWeight: 700 }}>{r.id}</td>
                      <td style={{ fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.proyecto}</td>
                      <td style={{ fontSize: 12 }}>{r.sede}</td>
                      <td style={{ fontSize: 12, color: '#71717A', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tecnico}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.materiales.length} SKU</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#71717A' }}>{r.fechaConfirmacion}</td>
                      <td>
                        {estEnt ? (
                          <span style={{ background: ESTADO_E[estEnt].bg, color: ESTADO_E[estEnt].color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                            {ESTADO_E[estEnt].label}
                          </span>
                        ) : (
                          <span style={{ background: '#F4F4F5', color: '#71717A', borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>Pendiente</span>
                        )}
                      </td>
                      <td>
                        <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 11, background: estEnt === 'COMPLETA' ? '#059669' : '#2563EB', border: 'none' }}
                          onClick={() => setSelectedReq(r)}>
                          {estEnt === 'COMPLETA' ? 'Ver' : estEnt === 'PARCIAL' ? 'Completar' : 'Preparar entrega'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial de entregas */}
      {state.entregas.length > 0 && (
        <div className="panel" style={{ marginTop: 18 }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #E4E4E7', fontSize: 13, fontWeight: 700, color: '#18181B' }}>
            Historial de entregas
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>ID</th><th>Requerimiento</th><th>Técnico</th><th>Responsable</th><th>Fecha</th><th>Estado</th></tr>
              </thead>
              <tbody>
                {[...state.entregas].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(e => (
                  <tr key={e.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB' }}>{e.id}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11 }}>{e.requerimientoId}</td>
                    <td style={{ fontSize: 12 }}>{e.tecnico}</td>
                    <td style={{ fontSize: 12, color: '#71717A' }}>{e.responsableEntrega}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#71717A' }}>{e.fecha} {e.hora}</td>
                    <td>
                      <span style={{ background: ESTADO_E[e.estado].bg, color: ESTADO_E[e.estado].color, borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>
                        {ESTADO_E[e.estado].label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
