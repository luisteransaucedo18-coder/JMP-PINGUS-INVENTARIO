import { Card, SectionHead, BarChart } from '../../components/DashboardPrimitives';
import { useAppStore } from '../../store/AppContext';
import { SEDES, Sede } from '../../domain/types';
import { ChartTooltip } from '../../components/ChartTooltip';
import { QuotationSummary } from '../../features/cotizaciones/CotizacionesView';

const SEDE_COLOR: Record<Sede, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };
const SEDE_BG: Record<Sede, string>    = { Chiclayo: '#DBEAFE', Chimbote: '#CCFBF1', Trujillo: '#F3E8FF' };
const ESTADO_COLOR: Record<string, string> = { BORRADOR: '#A1A1AA', ENVIADO: '#D97706', CONFIRMADO: '#059669', RECHAZADO: '#DC2626' };
const ESTADO_BG: Record<string, string>    = { BORRADOR: '#F4F4F5', ENVIADO: '#FEF3C7', CONFIRMADO: '#CCFBF1', RECHAZADO: '#FEE2E2' };

/* ── SVG Line/Area Chart ── */
function LineChart({ values, color, height = 110 }: { values: number[]; color: string; height?: number }) {
  const W = 440; const H = height;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => ({
    x: 8 + (i / Math.max(values.length - 1, 1)) * (W - 16),
    y: H - 8 - (v / max) * (H - 16),
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;
  const id = `grad-${color.replace('#', '')}`;
  return (
    <ChartTooltip title="Distribución de stock por sede" description="Cada punto representa el stock total de una sede. La línea compara sedes, no una evolución en el tiempo."><svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Distribución de stock por sede" style={{ width: '100%', display: 'block', overflow: 'visible' }}>
      <desc>{SEDES.map((s, i) => `${s}: ${values[i]}`).join('; ')}</desc>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i} tabIndex={0} data-chart-title={`Stock · ${SEDES[i]}`} data-chart-value={`${values[i]} unidades`}
          data-chart-description={`${SEDES[i]} tiene ${values[i]} unidades de stock, sumando los materiales visibles. Un punto más alto representa una mayor cantidad de stock.`}>
          <circle cx={p.x} cy={p.y} r={3} fill="#fff" stroke={color} strokeWidth={2} />
          <rect x={i === 0 ? 0 : (pts[i - 1].x + p.x) / 2} y={0}
            width={(i === pts.length - 1 ? W : (p.x + pts[i + 1].x) / 2) - (i === 0 ? 0 : (pts[i - 1].x + p.x) / 2)} height={H} fill="transparent" />
        </g>
      ))}
    </svg></ChartTooltip>
  );
}

interface Props { onNav: (v: string) => void; }

export default function GerenteDashboard({ onNav }: Props) {
  const { state } = useAppStore();
  const { materials, requerimientos } = state;

  const enviados    = requerimientos.filter(r => r.estado === 'ENVIADO').length;
  const confirmados = requerimientos.filter(r => r.estado === 'CONFIRMADO').length;
  const rechazados  = requerimientos.filter(r => r.estado === 'RECHAZADO').length;
  const criticos    = materials.filter(m => m.estado === 'CRÍTICO' || m.estado === 'AGOTADO').length;
  const recentReqs  = [...requerimientos].sort((a, b) => b.fecha.localeCompare(a.fecha)).slice(0, 7);

  /* Bar chart data: reqs by sede (confirmed vs pending) */
  const barData  = SEDES.map(s => [
    requerimientos.filter(r => r.sede === s && r.estado === 'CONFIRMADO').length,
    requerimientos.filter(r => r.sede === s && r.estado === 'ENVIADO').length,
  ]);

  /* Line chart: cumulative stock per sede */
  const lineValues = SEDES.map(s => materials.reduce((acc, m) => acc + m.stockSedes[s], 0));

  /* Stock alerts */
  const alerts = materials.filter(m => m.estado !== 'OK');

  return (
    <div className="manager-view-surface gerente-dashboard" style={{ padding: 24, overflowY: 'auto', flex: 1, minHeight: '100%' }}>
      <QuotationSummary onNav={onNav} />

      {/* ── Row 1: KPI strip ── */}
      <div data-tour="dashboard-summary" className="dashboard-kpi-grid manager-kpi-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Solicitudes visibles', value: requerimientos.length, color: '#2563EB', bg: '#DBEAFE', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><rect x="2" y="3" width="11" height="11" rx="1.5" stroke="#2563EB" strokeWidth="1.3"/><path d="M5 3V2.5A1.5 1.5 0 016.5 1h2A1.5 1.5 0 0110 2.5V3" stroke="#2563EB" strokeWidth="1.3"/><path d="M4.5 8h6M4.5 10.5h4" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round"/></svg> },
          { label: 'Pendientes',        value: enviados,              color: '#D97706', bg: '#FEF3C7', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="#D97706" strokeWidth="1.3"/><path d="M7.5 4v4l2.5 2" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round"/></svg> },
          { label: 'Confirmadas',       value: confirmados,           color: '#059669', bg: '#CCFBF1', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          { label: 'Rechazadas',        value: rechazados,            color: '#DC2626', bg: '#FEE2E2', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M3 3l9 9M12 3l-9 9" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round"/></svg> },
          { label: 'SKU con alertas',   value: criticos,              color: criticos > 0 ? '#DC2626' : '#71717A', bg: criticos > 0 ? '#FEE2E2' : '#F4F4F5', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L14 13H1L7.5 1z" stroke={criticos > 0 ? '#DC2626' : '#71717A'} strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 5.5V9M7.5 10.5v.5" stroke={criticos > 0 ? '#DC2626' : '#71717A'} strokeWidth="1.5" strokeLinecap="round"/></svg> },
        ].map(({ label, value, color, bg, icon }) => (
          <Card key={label} style={{ padding: '16px 18px' }} className="manager-kpi-card">
            <div className="manager-kpi-heading">
              <div className="manager-kpi-icon" style={{ background: bg }}>
                {icon}
              </div>
              <svg className="manager-kpi-sparkline" width="28" height="14" viewBox="0 0 28 14" fill="none" aria-hidden="true">
                <polyline points="0,12 8,6 16,9 28,2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6"/>
              </svg>
            </div>
            <div className="manager-kpi-value" style={{ color }}>{value}</div>
            <div className="manager-kpi-label">{label}</div>
          </Card>
        ))}
      </div>

      {/* ── Row 2: Bar chart + Recent activity ── */}
      <div className="dashboard-primary-grid" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(340px, 380px)', gap: 18, marginBottom: 22 }}>
        {/* Bar chart */}
        <Card style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <SectionHead title="Actividad por sede" />
          {/* Legend */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 18 }}>
            {[['Confirmadas', '#059669'], ['Pendientes', '#D97706']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                <span style={{ fontSize: 11.5, color: '#8B8FA8' }}>{l}</span>
              </div>
            ))}
          </div>
          <div style={{ flex: 1, minHeight: 260 }}>
            <BarChart
              data={barData}
              colors={['#059669', '#D97706']}
              labels={SEDES}
              height={280}
            />
          </div>
        </Card>

        {/* Recent activity */}
        <Card style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column' }}>
          <SectionHead title="Actividad reciente" />
          <div className="manager-recent-list" style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentReqs.map(r => {
              const initial = r.proyecto.charAt(0).toUpperCase();
              const color = SEDE_COLOR[r.sede];
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #F0F2FF' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: SEDE_BG[r.sede], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color, flexShrink: 0 }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1D23', overflowWrap: 'anywhere' }}>{r.proyecto}</div>
                    <div style={{ fontSize: 10.5, color: '#8B8FA8' }}>{r.fecha} · {r.sede}</div>
                  </div>
                  <span style={{ fontSize: 10.5, fontWeight: 700, background: ESTADO_BG[r.estado], color: ESTADO_COLOR[r.estado], borderRadius: 6, padding: '2px 7px', flexShrink: 0 }}>
                    {r.estado}
                  </span>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      {/* ── Row 3: Sede cards + Stock line chart ── */}
      <div className="dashboard-secondary-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, marginBottom: 22 }}>
        {/* Sede breakdown cards */}
        <Card style={{ padding: '22px 24px' }}>
          <SectionHead title="Resumen por sede" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {SEDES.map(s => {
              const sedeReqs  = requerimientos.filter(r => r.sede === s);
              const sedeConf  = sedeReqs.filter(r => r.estado === 'CONFIRMADO').length;
              const sedeStock = materials.reduce((acc, m) => acc + m.stockSedes[s], 0);
              const critS     = materials.filter(m => m.stockSedes[s] < m.minimo).length;
              const pct = sedeReqs.length > 0 ? Math.round((sedeConf / sedeReqs.length) * 100) : 0;
              return (
                <div key={s} style={{ background: '#F8F9FF', borderRadius: 'var(--surface-inset-radius)', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 10, height: 10, borderRadius: '50%', background: SEDE_COLOR[s] }} />
                      <span style={{ fontSize: 13.5, fontWeight: 700, color: '#1A1D23' }}>{s}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: SEDE_COLOR[s] }}>{pct}% aprobación</span>
                  </div>
                  <div style={{ height: 6, background: '#E4E4F0', borderRadius: 4, marginBottom: 12, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: SEDE_COLOR[s], borderRadius: 4 }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                    {[
                      ['Solicitudes', sedeReqs.length, '#52525B'],
                      ['Stock (UND)', sedeStock, SEDE_COLOR[s]],
                      ['Alertas SKU', critS, critS > 0 ? '#DC2626' : '#71717A'],
                    ].map(([k, v, c]) => (
                      <div key={String(k)} style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: 16, fontWeight: 800, color: String(c) }}>{String(v)}</div>
                        <div style={{ fontSize: 10, color: '#8B8FA8', marginTop: 2 }}>{String(k)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Stock line chart + alerts */}
        <Card style={{ padding: '22px 24px', display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div>
            <SectionHead title="Distribución de stock" />
            <LineChart values={lineValues} color="#2563EB" height={100} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
              {SEDES.map((s, i) => (
                <div key={s} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: SEDE_COLOR[s] }}>{lineValues[i]}</div>
                  <div style={{ fontSize: 10, color: '#8B8FA8' }}>{s}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: 1, borderTop: '1px solid #F0F2FF', paddingTop: 16 }}>
            <SectionHead title="Alertas de stock" />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 160, overflowY: 'auto' }}>
              {alerts.length === 0 ? (
                <div style={{ fontSize: 12, color: '#8B8FA8', textAlign: 'center', padding: '12px 0' }}>Sin alertas activas ✓</div>
              ) : alerts.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', background: '#F8F9FF', borderRadius: 10 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: m.estado === 'AGOTADO' ? '#DC2626' : m.estado === 'CRÍTICO' ? '#EF4444' : '#D97706' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1A1D23', overflowWrap: 'anywhere' }}>{m.nombre}</div>
                    <div style={{ fontSize: 10.5, color: '#8B8FA8' }}>Total: {Object.values(m.stockSedes).reduce((a, b) => a + b, 0)} UND · Mín {m.minimo}</div>
                  </div>
                  <span style={{ fontSize: 9.5, fontWeight: 700, background: m.estado === 'AGOTADO' || m.estado === 'CRÍTICO' ? '#FEE2E2' : '#FEF3C7', color: m.estado === 'AGOTADO' || m.estado === 'CRÍTICO' ? '#DC2626' : '#D97706', borderRadius: 6, padding: '2px 6px', flexShrink: 0 }}>
                    {m.estado}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      {/* ── Row 4: Solicitudes distribution ── */}
      <Card style={{ padding: '22px 24px' }}>
        <SectionHead title="Distribución de solicitudes visibles por estado" />
        <div className="dashboard-status-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
          {[
            { label: 'Enviado',     count: enviados,     color: '#D97706', bg: '#FEF3C7' },
            { label: 'Confirmado',  count: confirmados,  color: '#059669', bg: '#CCFBF1' },
            { label: 'Rechazado',   count: rechazados,   color: '#DC2626', bg: '#FEE2E2' },
          ].map(({ label, count, color, bg }) => {
            const pct = requerimientos.length > 0 ? (count / requerimientos.length) * 100 : 0;
            return (
              <ChartTooltip key={label} title={`Solicitudes · ${label}`} value={`${count} solicitudes · ${pct.toFixed(1)}%`}
                description={`Hay ${count} solicitudes en estado ${label}, equivalentes al ${pct.toFixed(1)}% de las ${requerimientos.length} solicitudes visibles. La barra muestra esa proporción.`}>
              <div style={{ background: '#F8F9FF', borderRadius: 'var(--surface-inset-radius)', padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11.5, color: '#8B8FA8', fontWeight: 500 }}>{label}</span>
                  <span style={{ background: bg, color, borderRadius: 8, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{count}</div>
                <div style={{ height: 5, borderRadius: 4, background: '#E4E4F0', marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
              </div></ChartTooltip>
            );
          })}
        </div>

        {/* Recent reqs table */}
        <div style={{ marginTop: 22, borderTop: '1px solid #F0F2FF', paddingTop: 18 }}>
          <SectionHead title="Últimas solicitudes" />
          <div className="dashboard-table-scroll">
          <table style={{ width: '100%', minWidth: 760, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F2FF' }}>
                {['ID', 'Proyecto', 'Sede', 'Analista', 'Fecha', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '0 8px 10px', fontSize: 11, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recentReqs.slice(0, 5).map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F8F9FF' }}>
                  <td style={{ padding: '11px 8px', fontFamily: 'monospace', fontSize: 11, color: '#2563EB', fontWeight: 700 }}>{r.id}</td>
                  <td style={{ padding: '11px 8px', fontSize: 12.5, fontWeight: 600, color: '#1A1D23', maxWidth: 200, overflowWrap: 'anywhere' }}>{r.proyecto}</td>
                  <td style={{ padding: '11px 8px' }}>
                    <span style={{ background: SEDE_BG[r.sede], color: SEDE_COLOR[r.sede], borderRadius: 6, padding: '3px 8px', fontSize: 11, fontWeight: 700 }}>{r.sede}</span>
                  </td>
                  <td style={{ padding: '11px 8px', fontSize: 12, color: '#8B8FA8' }}>{r.analista}</td>
                  <td style={{ padding: '11px 8px', fontFamily: 'monospace', fontSize: 11, color: '#8B8FA8' }}>{r.fecha}</td>
                  <td style={{ padding: '11px 8px' }}>
                    <span className="status-badge" style={{ background: ESTADO_BG[r.estado], color: ESTADO_COLOR[r.estado] }}>{r.estado}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      </Card>

      <Card style={{ padding: '22px 24px', marginTop: 22, border: '1px solid #DDD6FE' }}>
        <SectionHead title="Accesos rápidos" />
        <div className="dashboard-status-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          {[
            { label: 'Manual de Usuario', view: 'manual', primary: true },
            { label: 'Ver reportes', view: 'reportes' },
            { label: 'Consultar proyectos', view: 'proyectos' },
            { label: 'Consultar inventario', view: 'inventario' },
          ].map((item) => (
            <button
              key={item.label}
              className={`btn ${item.primary ? 'btn-primary' : 'btn-ghost'}`}
              style={{
                width: '100%',
                justifyContent: 'center',
                borderColor: item.primary ? undefined : '#DDD6FE',
                color: item.primary ? undefined : '#6D28D9',
              }}
              onClick={() => onNav(item.view)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}
