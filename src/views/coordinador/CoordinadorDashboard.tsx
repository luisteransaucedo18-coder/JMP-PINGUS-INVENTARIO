import { useAppStore } from '../../store/AppContext';
import { SEDES } from '../../domain/types';
import { obtenerFaltantesRequerimiento } from '../../utils/requirementStock';

const SEDE_COLOR: Record<string, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };

interface Props { onNav: (v: string) => void; }

export default function CoordinadorDashboard({ onNav }: Props) {
  const { state } = useAppStore();
  const pendientes = state.requerimientos.filter(r => r.estado === 'ENVIADO');
  const alertas = state.materials.filter(m => m.estado !== 'OK');
  const requerimientosSinStock = pendientes.filter(
    requirement => obtenerFaltantesRequerimiento(requirement, state.materials).length > 0,
  );

  return (
    <div className="coordinator-dashboard" style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <div className="panel" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 16, alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap' }}>
        <div><strong>Transporte interno de mercadería</strong><p style={{ fontSize: 13, color: '#52525B', marginTop: 4 }}>Envíos, recepciones y comprobantes entre sedes.</p></div>
        <button className="btn btn-primary" onClick={() => onNav('transporte')}>Transporte interno →</button>
      </div>
      {/* KPIs */}
      <div data-tour="dashboard-summary" className="coordinator-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Por confirmar', value: pendientes.length, sub: 'solicitudes enviadas', color: '#D97706', bg: '#FEF3C7', nav: 'requerimientos' },
          { label: 'Necesitan abastecimiento', value: requerimientosSinStock.length, sub: 'compra o traslado', color: '#C2410C', bg: '#FFEDD5', nav: 'requerimientos' },
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

      <div className="coordinator-dashboard-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 20 }}>
        <div className="coordinator-main-column">
          {/* Solicitudes por confirmar */}
          <div className="panel coordinator-main-panel">
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

          {/* Alertas stock */}
          <div className="panel coordinator-alerts-panel">
            <div className="section-header">
              <span className="section-title">Alertas de Inventario</span>
              <span className="badge badge-red">{alertas.length}</span>
            </div>
            <div className="coordinator-alerts-list">
              {alertas.map(m => {
                const total = Object.values(m.stockSedes).reduce((sum, stock) => sum + stock, 0);

                return (
                  <div key={m.id} className="coordinator-alert-item">
                    <div
                      className="coordinator-alert-indicator"
                      style={{ background: m.estado === 'AGOTADO' || m.estado === 'CRÍTICO' ? '#DC2626' : '#D97706' }}
                    />
                    <div className="coordinator-alert-content">
                      <div className="coordinator-alert-heading">
                        <div>
                          <div className="coordinator-alert-name">{m.nombre}</div>
                          <div className="coordinator-alert-sku">SKU {m.id} · Stock mínimo: {m.minimo} {m.unidad}</div>
                        </div>
                        <span className={`badge status-badge badge-${m.estado === 'AGOTADO' || m.estado === 'CRÍTICO' ? 'red' : 'amber'}`}>
                          {m.estado}
                        </span>
                      </div>
                      <div className="coordinator-alert-stock-grid">
                        <div className="coordinator-alert-total">
                          <span>Stock total</span>
                          <strong>{total} {m.unidad}</strong>
                        </div>
                        {SEDES.map(sede => (
                          <div key={sede} className="coordinator-alert-site">
                            <span>{sede}</span>
                            <strong>{m.stockSedes[sede] ?? 0} {m.unidad}</strong>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {alertas.length === 0 && (
                <div className="coordinator-alert-empty">Sin alertas activas</div>
              )}
            </div>
            <div style={{ padding: '12px 16px', borderTop: '1px solid #E4E4E7' }}>
              <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12 }} onClick={() => onNav('inventario')}>
                Ver inventario completo →
              </button>
            </div>
          </div>
        </div>

        {/* Panel derecho */}
        <div className="coordinator-side-panels" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Accesos rapidos */}
          <div className="panel" style={{ background: '#F0FDFA', borderColor: '#99F6E4' }}>
            <div style={{ padding: '18px 18px' }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0F766E', marginBottom: 12 }}>
                Accesos rápidos
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', justifyContent: 'center' }}
                  onClick={() => onNav('manual')}
                >
                  Manual de Usuario
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', borderColor: '#99F6E4', color: '#0F766E' }}
                  onClick={() => onNav('requerimientos')}
                >
                  Revisar requerimientos
                </button>
                <button
                  className="btn btn-ghost"
                  style={{ width: '100%', justifyContent: 'center', borderColor: '#99F6E4', color: '#0F766E' }}
                  onClick={() => onNav('compras')}
                >
                  Gestionar compras
                </button>
              </div>
            </div>
          </div>

          {/* Resumen por sede */}
          <div className="panel coordinator-sites-panel">
            <div className="section-header"><span className="section-title">Solicitudes por sede</span></div>
            <div className="coordinator-sites-list" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
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
