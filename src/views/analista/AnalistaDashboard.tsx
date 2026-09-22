import { useAppStore } from '../../store/AppContext';

const ESTADO_COLOR: Record<string, string> = { BORRADOR: '#A1A1AA', ENVIADO: '#D97706', CONFIRMADO: '#059669', RECHAZADO: '#DC2626' };
const ESTADO_BG: Record<string, string> = { BORRADOR: '#F4F4F5', ENVIADO: '#FEF3C7', CONFIRMADO: '#CCFBF1', RECHAZADO: '#FEE2E2' };
const ESTADO_BADGE: Record<string, string> = { BORRADOR: 'gray', ENVIADO: 'amber', CONFIRMADO: 'green', RECHAZADO: 'red' };

interface Props { usuario: string; onNav: (v: string) => void; }

export default function AnalistaDashboard({ usuario, onNav }: Props) {
  const { state } = useAppStore();
  const misReqs = state.requerimientos.filter(r => r.analista === usuario || r.analista.includes(usuario.split(' ')[0]));
  const recent = [...misReqs].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 4);

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Mis solicitudes', value: misReqs.length, color: '#2563EB' },
          { label: 'En revisión', value: misReqs.filter(r => r.estado === 'ENVIADO').length, color: '#D97706' },
          { label: 'Confirmadas', value: misReqs.filter(r => r.estado === 'CONFIRMADO').length, color: '#059669' },
          { label: 'Borradores', value: misReqs.filter(r => r.estado === 'BORRADOR').length, color: '#71717A' },
        ].map(({ label, value, color }) => (
          <div key={label} className="kpi-card">
            <div style={{ fontSize: 12.5, color: '#71717A', fontWeight: 500, marginBottom: 10 }}>{label}</div>
            <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 20 }}>
        {/* Mis solicitudes recientes */}
        <div className="panel">
          <div className="section-header">
            <span className="section-title">Mis Solicitudes Recientes</span>
            <button className="btn btn-primary" onClick={() => onNav('nueva-solicitud')}>+ Nueva solicitud</button>
          </div>
          {recent.length === 0 ? (
            <div style={{ padding: '40px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, color: '#71717A', marginBottom: 12 }}>No tienes solicitudes aún.</div>
              <button className="btn btn-primary" onClick={() => onNav('nueva-solicitud')}>Crear primera solicitud</button>
            </div>
          ) : (
            recent.map(r => (
              <div key={r.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F4F4F5' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div>
                    <span style={{ fontSize: 11, color: '#2563EB', fontFamily: 'monospace', marginRight: 8 }}>{r.id}</span>
                    <span className={`badge badge-${ESTADO_BADGE[r.estado]}`}>{r.estado}</span>
                  </div>
                  <span style={{ fontSize: 11, color: '#71717A', fontFamily: 'monospace' }}>{r.fecha}</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#18181B', marginBottom: 4 }}>{r.proyecto}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11.5, color: '#71717A' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 1C5 1 3 3 3 6c0 3.5 4.5 8 4.5 8S12 9.5 12 6c0-3-2-5-4.5-5z" stroke="currentColor" strokeWidth="1.3"/></svg> {r.sede}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M9 2l-1 1-5 5 1 3 3 1 5-5 1-1-4-4zM8 3l4 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg> {r.tecnico}</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L13 4.5V10.5L7.5 14L2 10.5V4.5L7.5 1Z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 1V14M2 4.5L13 4.5" stroke="currentColor" strokeWidth="1.3"/></svg> {r.materiales.length} materiales</span>
                </div>
                {r.observaciones && (
                  <div style={{ marginTop: 8, background: r.estado === 'RECHAZADO' ? '#FFF5F5' : '#F0FDF4', border: `1px solid ${r.estado === 'RECHAZADO' ? '#FECACA' : '#BBF7D0'}`, borderRadius: 5, padding: '6px 10px', fontSize: 11.5, color: r.estado === 'RECHAZADO' ? '#DC2626' : '#15803D' }}>
                    {r.observaciones}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Resumen visual */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="section-header"><span className="section-title">Estado de mis solicitudes</span></div>
            <div style={{ padding: '14px 16px' }}>
              {['BORRADOR', 'ENVIADO', 'CONFIRMADO', 'RECHAZADO'].map(estado => {
                const cnt = misReqs.filter(r => r.estado === estado).length;
                return (
                  <div key={estado} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: ESTADO_COLOR[estado], flexShrink: 0 }} />
                    <span style={{ fontSize: 12, flex: 1, color: '#52525B' }}>{estado}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: ESTADO_COLOR[estado] }}>{cnt}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="panel" style={{ background: '#EFF6FF', borderColor: '#BFDBFE' }}>
            <div style={{ padding: '18px 18px', textAlign: 'center' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#1D4ED8', marginBottom: 8 }}>Crear nueva solicitud</div>
              <div style={{ fontSize: 12, color: '#3B82F6', marginBottom: 14, lineHeight: 1.5 }}>
                Registra un requerimiento de materiales para un proyecto
              </div>
              <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => onNav('nueva-solicitud')}>
                + Nueva solicitud
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
