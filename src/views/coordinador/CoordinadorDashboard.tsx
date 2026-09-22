import { useAppStore } from '../../store/AppContext';
import { SEDES } from '../../data/mockData';

const SEDE_COLOR: Record<string, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };

interface Props { onNav: (v: string) => void; }

export default function CoordinadorDashboard({ onNav }: Props) {
  const { state } = useAppStore();
  const pendientes = state.requerimientos.filter(r => r.estado === 'ENVIADO');
  const alertas = state.materials.filter(m => m.estado !== 'OK');

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Por confirmar', value: pendientes.length, sub: 'solicitudes enviadas', color: '#D97706', bg: '#FEF3C7', nav: 'requerimientos' },
          { label: 'Confirmadas hoy', value: state.requerimientos.filter(r => r.estado === 'CONFIRMADO' && r.fechaConfirmacion === new Date().toISOString().split('T')[0]).length, sub: 'aprobadas', color: '#059669', bg: '#CCFBF1', nav: null },
          { label: 'SKU en catálogo', value: state.materials.length, sub: 'materiales registrados', color: '#2563EB', bg: '#DBEAFE', nav: 'inventario' },
          { label: 'Alertas de stock', value: alertas.length, sub: 'bajo / crítico / agotado', color: '#DC2626', bg: '#FEE2E2', nav: 'inventario' },
        ].map(({ label, value, sub, color, bg, nav }) => (
          <div key={label} className="kpi-card" style={{ cursor: nav ? 'pointer' : 'default' }} onClick={() => nav && onNav(nav)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: 12.5, color: '#71717A', fontWeight: 500 }}>{label}</span>
              <div style={{ width: 34, height: 34, borderRadius: '50%', background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: color }} />
              </div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 800, color }}>{value}</div>
            <div style={{ fontSize: 11.5, color: '#71717A', marginTop: 6 }}>{sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        {/* Solicitudes por confirmar */}
        <div className="panel">
          <div className="section-header">
            <span className="section-title">Solicitudes por Confirmar</span>
            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }} onClick={() => onNav('requerimientos')}>Ver todas →</button>
          </div>
          {pendientes.length === 0 ? (
            <div style={{ padding: '32px 20px', textAlign: 'center' }}>
              <div style={{ marginBottom: 10, color: '#A1A1AA', display: 'flex', justifyContent: 'center' }}><svg width="28" height="28" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
              <div style={{ fontSize: 13, color: '#71717A' }}>Sin solicitudes pendientes de confirmación</div>
            </div>
          ) : pendientes.map(r => (
            <div key={r.id} style={{ padding: '14px 16px', borderBottom: '1px solid #F4F4F5', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#D97706', flexShrink: 0, marginTop: 6 }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: '#2563EB', fontFamily: 'monospace' }}>{r.id}</span>
                  <span style={{ fontSize: 11, color: SEDE_COLOR[r.sede], fontWeight: 600 }}>{r.sede}</span>
                </div>
                <div style={{ fontSize: 13.5, fontWeight: 600, color: '#18181B', marginBottom: 4 }}>{r.proyecto}</div>
                <div style={{ fontSize: 11.5, color: '#71717A' }}>
                  Analista: {r.analista} · Técnico: {r.tecnico} · {r.materiales.length} materiales
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 10, color: '#71717A', marginBottom: 4, fontFamily: 'monospace' }}>{r.fecha}</div>
                <button className="btn btn-primary" style={{ padding: '4px 12px', fontSize: 11 }} onClick={() => onNav('requerimientos')}>
                  Revisar
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Panel derecho */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Alertas stock */}
          <div className="panel">
            <div className="section-header">
              <span className="section-title">Alertas de Inventario</span>
              <span className="badge badge-red">{alertas.length}</span>
            </div>
            {alertas.slice(0, 5).map(m => (
              <div key={m.id} style={{ padding: '10px 14px', borderBottom: '1px solid #F4F4F5', display: 'flex', gap: 10, alignItems: 'center' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: m.estado === 'AGOTADO' ? '#DC2626' : '#D97706', flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#18181B', lineHeight: 1.3 }}>{m.nombre}</div>
                  <div style={{ fontSize: 10.5, color: '#71717A', marginTop: 1 }}>
                    Total: {Object.values(m.stockSedes).reduce((s, v) => s + v, 0)} UND
                  </div>
                </div>
                <span className={`badge badge-${m.estado === 'AGOTADO' || m.estado === 'CRÍTICO' ? 'red' : 'amber'}`} style={{ fontSize: 10 }}>{m.estado}</span>
              </div>
            ))}
            {alertas.length === 0 && (
              <div style={{ padding: '16px', fontSize: 12, color: '#71717A', textAlign: 'center' }}>Sin alertas activas</div>
            )}
            <div style={{ padding: '10px 14px', borderTop: '1px solid #E4E4E7' }}>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => onNav('inventario')}>
                Ver inventario completo →
              </button>
            </div>
          </div>

          {/* Resumen por sede */}
          <div className="panel">
            <div className="section-header"><span className="section-title">Solicitudes por sede</span></div>
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {SEDES.map(sede => {
                const cnt = state.requerimientos.filter(r => r.sede === sede && r.estado === 'ENVIADO').length;
                return (
                  <div key={sede} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: SEDE_COLOR[sede] }} />
                    <span style={{ fontSize: 12.5, flex: 1, color: '#52525B' }}>{sede}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: cnt > 0 ? '#D97706' : '#71717A' }}>{cnt}</span>
                    <span style={{ fontSize: 11, color: '#A1A1AA' }}>pendiente{cnt !== 1 ? 's' : ''}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
