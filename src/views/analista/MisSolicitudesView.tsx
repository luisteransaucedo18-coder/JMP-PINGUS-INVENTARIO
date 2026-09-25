import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { Requerimiento } from '../../data/mockData';
import RequirementStatusTimeline from '../../components/RequirementStatusTimeline';
import RequirementPdfModal from '../../components/RequirementPdfModal';

const BADGE: Record<string, string> = { BORRADOR: 'gray', ENVIADO: 'amber', CONFIRMADO: 'green', RECHAZADO: 'red' };

const DOCUMENT_STATUS: Record<string, { label: string; color: string; description: string }> = {
  BORRADOR: { label: 'Pendiente de envío', color: 'gray', description: 'Envía la solicitud para iniciar el trámite.' },
  ENVIADO: { label: 'En trámite', color: 'amber', description: 'El PDF estará disponible después de la confirmación del coordinador y su generación.' },
  RECHAZADO: { label: 'No disponible', color: 'red', description: 'Las solicitudes rechazadas no generan un PDF de confirmación.' },
};

interface Props { usuario: string; onToast: (msg: string) => void; onNav: (v: string) => void; }

export default function MisSolicitudesView({ usuario, onToast, onNav }: Props) {
  const { state, dispatch } = useAppStore();
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Requerimiento | null>(null);
  const [pdfId, setPdfId] = useState<string | null>(null);
  const pdfRequirement = state.requerimientos.find(r => r.id === pdfId && r.estado === 'CONFIRMADO');

  const misReqs = state.requerimientos
    .filter(r => r.analista === usuario || r.analista.includes(usuario.split(' ')[0]))
    .filter(r => !filter || r.estado === filter)
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const handleSubmit = (id: string) => {
    dispatch({ type: 'SUBMIT_REQUERIMIENTO', payload: id });
    onToast('✓ Solicitud enviada al coordinador');
    setSelected(null);
  };

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 }}>
        {['BORRADOR', 'ENVIADO', 'CONFIRMADO', 'RECHAZADO'].map(e => {
          const cnt = state.requerimientos.filter(r => (r.analista === usuario || r.analista.includes(usuario.split(' ')[0])) && r.estado === e).length;
          const colors: Record<string, string> = { BORRADOR: '#71717A', ENVIADO: '#D97706', CONFIRMADO: '#059669', RECHAZADO: '#DC2626' };
          return (
            <div key={e} className="kpi-card" style={{ cursor: 'pointer', borderColor: filter === e ? colors[e] : '#E4E4E7' }} onClick={() => setFilter(filter === e ? '' : e)}>
              <div style={{ fontSize: 12, color: '#71717A', fontWeight: 500, marginBottom: 10 }}>{e}</div>
              <div style={{ fontSize: 28, fontWeight: 700, color: colors[e] }}>{cnt}</div>
            </div>
          );
        })}
      </div>

      <div className="panel">
        <div className="section-header">
          <span className="section-title">Mis Solicitudes {filter && `— ${filter}`}</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {filter && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setFilter('')}>Ver todas</button>}
            <button className="btn btn-primary" onClick={() => onNav('nueva-solicitud')}>+ Nueva solicitud</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
        <table className="data-table">
          <thead>
            <tr><th>ID</th><th>Proyecto</th><th>Sede</th><th>Técnico</th><th>Fecha</th><th>Materiales</th><th>Estado</th><th>Documento PDF</th><th>Acciones</th></tr>
          </thead>
          <tbody>
            {misReqs.length === 0 ? (
              <tr className="empty-state-row"><td colSpan={9} style={{ textAlign: 'center', color: '#71717A', padding: 32 }}>Sin solicitudes{filter ? ` con estado ${filter}` : ''}</td></tr>
            ) : misReqs.map(r => (
              <tr key={r.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(r)}>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB' }}>{r.id}</td>
                <td style={{ fontWeight: 500, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.proyecto}</td>
                <td style={{ fontSize: 12 }}>{r.sede}</td>
                <td style={{ fontSize: 12, color: '#71717A', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tecnico}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#71717A' }}>{r.fecha}</td>
                <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{r.materiales.length} SKU</td>
                <td><span className={`badge status-badge badge-${BADGE[r.estado]}`}>{r.estado}</span></td>
                <td onClick={e => e.stopPropagation()}>
                  {r.estado === 'CONFIRMADO' ? (
                    <button className="btn btn-ghost" style={{ fontSize: 12, whiteSpace: 'nowrap' }}
                      aria-label={`Visualizar PDF de ${r.id}`} onClick={() => setPdfId(r.id)}>Visualizar PDF</button>
                  ) : <span
                    className={`badge badge-${DOCUMENT_STATUS[r.estado]?.color ?? 'gray'}`}
                    title={DOCUMENT_STATUS[r.estado]?.description ?? 'Documento no disponible.'}
                    style={{ whiteSpace: 'nowrap' }}
                  >
                    {DOCUMENT_STATUS[r.estado]?.label ?? 'No disponible'}
                  </span>}
                </td>
                <td onClick={e => e.stopPropagation()}>
                  {r.estado === 'BORRADOR' && (
                    <button className="btn btn-primary" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => handleSubmit(r.id)}>
                      Enviar
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {pdfRequirement && <RequirementPdfModal requirement={pdfRequirement} materials={state.materials}
        deliveries={state.entregas} onClose={() => setPdfId(null)} />}

      {/* Detail modal */}
      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ width: 620 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 11, color: '#71717A', fontFamily: 'monospace', marginBottom: 3 }}>{selected.id}</div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>{selected.proyecto}</h2>
              </div>
              <span className={`badge status-badge badge-${BADGE[selected.estado]}`}>{selected.estado}</span>
            </div>
            <RequirementStatusTimeline requirement={selected} />
            <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[['Sede', selected.sede], ['Ubicación', selected.ubicacion], ['Técnico', selected.tecnico], ['Fecha', selected.fecha]].map(([k, v]) => (
                <div key={String(k)}>
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
              <div style={{ fontSize: 11, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>Materiales ({selected.materiales.length})</div>
              <table className="data-table request-materials-table">
                <thead><tr><th>SKU</th><th>Material</th><th>Cantidad</th></tr></thead>
                <tbody>
                  {selected.materiales.map((m, i) => (
                    <tr key={i}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB' }}>{m.skuId}</td>
                      <td style={{ fontSize: 12 }}>{m.nombre}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{m.cantidad} UND</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {selected.observaciones && (
              <div style={{ margin: '0 22px 16px', background: selected.estado === 'RECHAZADO' ? '#FFF5F5' : '#F0FDF4', border: `1px solid ${selected.estado === 'RECHAZADO' ? '#FECACA' : '#BBF7D0'}`, borderRadius: 6, padding: '10px 12px', fontSize: 12.5, color: selected.estado === 'RECHAZADO' ? '#DC2626' : '#15803D' }}>
                <strong>Observación del coordinador:</strong> {selected.observaciones}
              </div>
            )}
            <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {selected.estado === 'BORRADOR' && (
                <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => { handleSubmit(selected.id); }}><svg width="13" height="13" viewBox="0 0 15 15" fill="none"><path d="M1 1l13 6.5L1 14V9l8-1.5L1 6V1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg> Enviar al coordinador</button>
              )}
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
