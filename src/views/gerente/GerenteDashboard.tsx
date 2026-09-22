import { useAppStore } from '../../store/AppContext';
import { SEDES, Sede } from '../../data/mockData';

const SEDE_COLOR: Record<Sede, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };
const SEDE_BG: Record<Sede, string>    = { Chiclayo: '#DBEAFE', Chimbote: '#CCFBF1', Trujillo: '#F3E8FF' };
const ESTADO_COLOR: Record<string, string> = { BORRADOR: '#A1A1AA', ENVIADO: '#D97706', CONFIRMADO: '#059669', RECHAZADO: '#DC2626' };
const ESTADO_BG: Record<string, string>    = { BORRADOR: '#F4F4F5', ENVIADO: '#FEF3C7', CONFIRMADO: '#CCFBF1', RECHAZADO: '#FEE2E2' };

/* ── SVG Bar Chart ── */
function BarChart({ data, colors, labels, height = 140 }: {
  data: number[][];   // data[barGroupIndex][seriesIndex]
  colors: string[];
  labels: string[];
  height?: number;
}) {
  const groups = data.length;
  const series = colors.length;
  const maxVal = Math.max(...data.flat(), 1);
  const W = 420; const H = height;
  const barW = 12; const gap = 4; const groupGap = 14;
  const groupW = series * (barW + gap) - gap + groupGap;
  const totalW = groups * groupW;
  const startX = (W - totalW) / 2;

  return (
    <svg viewBox={`0 0 ${W} ${H + 28}`} style={{ width: '100%', maxWidth: W, overflow: 'visible' }}>
      {/* Gridlines */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = H - t * H;
        return (
          <g key={t}>
            <line x1={0} y1={y} x2={W} y2={y} stroke="#E4E4F0" strokeWidth={1} strokeDasharray={t === 0 ? '0' : '4 4'} />
            <text x={-4} y={y + 4} fontSize={9} fill="#A1A1AA" textAnchor="end">
              {Math.round(t * maxVal)}
            </text>
          </g>
        );
      })}
      {/* Bars */}
      {data.map((group, gi) => {
        const gx = startX + gi * groupW;
        return group.map((val, si) => {
          const barH = (val / maxVal) * H;
          const x = gx + si * (barW + gap);
          const y = H - barH;
          return (
            <g key={`${gi}-${si}`}>
              <rect x={x} y={y} width={barW} height={barH} rx={4} fill={colors[si]} opacity={0.9} />
            </g>
          );
        });
      })}
      {/* Labels */}
      {data.map((_, gi) => {
        const gx = startX + gi * groupW + (series * (barW + gap) - gap) / 2;
        return (
          <text key={gi} x={gx} y={H + 16} fontSize={9.5} fill="#71717A" textAnchor="middle">{labels[gi]}</text>
        );
      })}
    </svg>
  );
}

/* ── SVG Line/Area Chart ── */
function LineChart({ values, color, height = 110 }: { values: number[]; color: string; height?: number }) {
  const W = 440; const H = height;
  const max = Math.max(...values, 1);
  const pts = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - (v / max) * H,
  }));
  const path = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const area = `${path} L ${W} ${H} L 0 ${H} Z`;
  const id = `grad-${color.replace('#', '')}`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.22" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#fff" stroke={color} strokeWidth={2} />
      ))}
    </svg>
  );
}

/* ── Card wrapper ── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: '#fff',
      borderRadius: 20,
      boxShadow: '0 4px 24px rgba(99,102,241,0.07)',
      overflow: 'hidden',
      ...style,
    }}>
      {children}
    </div>
  );
}

/* ── Section header ── */
function SectionHead({ title, action, actionLabel = 'Ver todo' }: { title: string; action?: () => void; actionLabel?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: '#1A1D23' }}>{title}</span>
      {action && (
        <button onClick={action} style={{ background: 'none', border: 'none', fontSize: 12.5, color: '#2563EB', cursor: 'pointer', fontWeight: 600 }}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function GerenteDashboard() {
  const { state } = useAppStore();
  const { materials, requerimientos } = state;

  const enviados    = requerimientos.filter(r => r.estado === 'ENVIADO').length;
  const confirmados = requerimientos.filter(r => r.estado === 'CONFIRMADO').length;
  const rechazados  = requerimientos.filter(r => r.estado === 'RECHAZADO').length;
  const borradores  = requerimientos.filter(r => r.estado === 'BORRADOR').length;
  const criticos    = materials.filter(m => m.estado === 'CRÍTICO' || m.estado === 'AGOTADO').length;
  const totalStock  = materials.reduce((s, m) => s + Object.values(m.stockSedes).reduce((a, b) => a + b, 0), 0);
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
    <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: '#EEF0FF', minHeight: '100%' }}>

      {/* ── Row 1: KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total solicitudes', value: requerimientos.length, color: '#2563EB', bg: '#DBEAFE', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><rect x="2" y="3" width="11" height="11" rx="1.5" stroke="#2563EB" strokeWidth="1.3"/><path d="M5 3V2.5A1.5 1.5 0 016.5 1h2A1.5 1.5 0 0110 2.5V3" stroke="#2563EB" strokeWidth="1.3"/><path d="M4.5 8h6M4.5 10.5h4" stroke="#2563EB" strokeWidth="1.3" strokeLinecap="round"/></svg> },
          { label: 'Pendientes',        value: enviados,              color: '#D97706', bg: '#FEF3C7', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><circle cx="7.5" cy="7.5" r="6" stroke="#D97706" strokeWidth="1.3"/><path d="M7.5 4v4l2.5 2" stroke="#D97706" strokeWidth="1.3" strokeLinecap="round"/></svg> },
          { label: 'Confirmadas',       value: confirmados,           color: '#059669', bg: '#CCFBF1', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="#059669" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg> },
          { label: 'Rechazadas',        value: rechazados,            color: '#DC2626', bg: '#FEE2E2', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M3 3l9 9M12 3l-9 9" stroke="#DC2626" strokeWidth="1.6" strokeLinecap="round"/></svg> },
          { label: 'SKU con alertas',   value: criticos,              color: criticos > 0 ? '#DC2626' : '#71717A', bg: criticos > 0 ? '#FEE2E2' : '#F4F4F5', icon: <svg width="16" height="16" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L14 13H1L7.5 1z" stroke={criticos > 0 ? '#DC2626' : '#71717A'} strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 5.5V9M7.5 10.5v.5" stroke={criticos > 0 ? '#DC2626' : '#71717A'} strokeWidth="1.5" strokeLinecap="round"/></svg> },
        ].map(({ label, value, color, bg, icon }) => (
          <Card key={label} style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>
                {icon}
              </div>
              <svg width="28" height="14" viewBox="0 0 28 14" fill="none">
                <polyline points="0,12 8,6 16,9 28,2" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.6"/>
              </svg>
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11.5, color: '#8B8FA8', marginTop: 5, fontWeight: 500 }}>{label}</div>
          </Card>
        ))}
      </div>

      {/* ── Row 2: Bar chart + Recent activity ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 18, marginBottom: 22 }}>
        {/* Bar chart */}
        <Card style={{ padding: '22px 24px' }}>
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
          <BarChart
            data={barData}
            colors={['#059669', '#D97706']}
            labels={SEDES}
            height={130}
          />
        </Card>

        {/* Recent activity */}
        <Card style={{ padding: '22px 20px', display: 'flex', flexDirection: 'column' }}>
          <SectionHead title="Actividad reciente" />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {recentReqs.map(r => {
              const initial = r.proyecto.charAt(0).toUpperCase();
              const color = SEDE_COLOR[r.sede];
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: '1px solid #F0F2FF' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 12, background: SEDE_BG[r.sede], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, color, flexShrink: 0 }}>
                    {initial}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.proyecto}</div>
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 22 }}>
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
                <div key={s} style={{ background: '#F8F9FF', borderRadius: 14, padding: '14px 16px' }}>
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
                    <div style={{ fontSize: 11.5, fontWeight: 600, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</div>
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
        <SectionHead title="Distribución de solicitudes por estado" />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          {[
            { label: 'Borrador',    count: borradores,  color: '#A1A1AA', bg: '#F4F4F5' },
            { label: 'Enviado',     count: enviados,     color: '#D97706', bg: '#FEF3C7' },
            { label: 'Confirmado',  count: confirmados,  color: '#059669', bg: '#CCFBF1' },
            { label: 'Rechazado',   count: rechazados,   color: '#DC2626', bg: '#FEE2E2' },
          ].map(({ label, count, color, bg }) => {
            const pct = requerimientos.length > 0 ? (count / requerimientos.length) * 100 : 0;
            return (
              <div key={label} style={{ background: '#F8F9FF', borderRadius: 14, padding: '16px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <span style={{ fontSize: 11.5, color: '#8B8FA8', fontWeight: 500 }}>{label}</span>
                  <span style={{ background: bg, color, borderRadius: 8, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>{pct.toFixed(0)}%</span>
                </div>
                <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{count}</div>
                <div style={{ height: 5, borderRadius: 4, background: '#E4E4F0', marginTop: 12, overflow: 'hidden' }}>
                  <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Recent reqs table */}
        <div style={{ marginTop: 22, borderTop: '1px solid #F0F2FF', paddingTop: 18 }}>
          <SectionHead title="Últimas solicitudes" />
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
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
                  <td style={{ padding: '11px 8px', fontSize: 12.5, fontWeight: 600, color: '#1A1D23', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.proyecto}</td>
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
      </Card>
    </div>
  );
}
