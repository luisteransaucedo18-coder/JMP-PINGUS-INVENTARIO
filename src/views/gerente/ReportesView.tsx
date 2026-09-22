import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { SEDES, Sede } from '../../data/mockData';

const SEDE_COLOR: Record<Sede, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };
const SEDE_BG: Record<Sede, string>    = { Chiclayo: '#DBEAFE', Chimbote: '#CCFBF1', Trujillo: '#F3E8FF' };
const ESTADO_COLOR: Record<string, string> = { ENVIADO: '#D97706', CONFIRMADO: '#059669', RECHAZADO: '#DC2626', BORRADOR: '#71717A' };
const ESTADO_BG: Record<string, string>    = { ENVIADO: '#FEF3C7', CONFIRMADO: '#CCFBF1', RECHAZADO: '#FEE2E2', BORRADOR: '#F4F4F5' };

type Period = '7d' | '30d' | 'all';

/* ── Shared card ── */
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(99,102,241,0.07)', overflow: 'hidden', ...style }}>
      {children}
    </div>
  );
}

/* ── Section header ── */
function SectionHead({ title }: { title: string }) {
  return <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1D23', marginBottom: 16 }}>{title}</div>;
}

/* ── SVG Bar chart ── */
function BarChart({ data, colors, labels, height = 110 }: {
  data: number[][];
  colors: string[];
  labels: string[];
  height?: number;
}) {
  const W = 380; const H = height;
  const maxVal = Math.max(...data.flat(), 1);
  const series = colors.length;
  const barW = 14; const gap = 5; const groupGap = 18;
  const groupW = series * (barW + gap) - gap + groupGap;
  const startX = 12;

  return (
    <svg viewBox={`0 0 ${W} ${H + 24}`} style={{ width: '100%' }}>
      {[0, 0.5, 1].map(t => {
        const y = H - t * H;
        return (
          <g key={t}>
            <line x1={0} y1={y} x2={W} y2={y} stroke="#E4E4F0" strokeWidth={1} strokeDasharray={t === 0 ? '0' : '3 3'} />
            <text x={0} y={y - 3} fontSize={8.5} fill="#A1A1AA">{Math.round(t * maxVal)}</text>
          </g>
        );
      })}
      {data.map((group, gi) => {
        const gx = startX + gi * groupW;
        return group.map((val, si) => {
          const barH = (val / maxVal) * H;
          return (
            <rect key={`${gi}-${si}`} x={gx + si * (barW + gap)} y={H - barH} width={barW} height={barH} rx={5} fill={colors[si]} opacity={0.88} />
          );
        });
      })}
      {data.map((_, gi) => {
        const gx = startX + gi * groupW + (series * (barW + gap) - gap) / 2;
        return <text key={gi} x={gx} y={H + 16} fontSize={9} fill="#71717A" textAnchor="middle">{labels[gi]}</text>;
      })}
    </svg>
  );
}

export default function ReportesView() {
  const { state } = useAppStore();
  const { materials, requerimientos } = state;
  const [period, setPeriod] = useState<Period>('30d');
  const [activeTab, setActiveTab] = useState<'todos' | 'confirmados' | 'pendientes'>('todos');

  const now = new Date('2026-09-22');
  const cutoff = period === '7d'  ? new Date(now.getTime() - 7 * 86400000)
               : period === '30d' ? new Date(now.getTime() - 30 * 86400000)
               : new Date(0);

  const filteredReqs = requerimientos.filter(r => new Date(r.fecha) >= cutoff);

  const totalReqs    = filteredReqs.length;
  const confirmados  = filteredReqs.filter(r => r.estado === 'CONFIRMADO').length;
  const rechazados   = filteredReqs.filter(r => r.estado === 'RECHAZADO').length;
  const pendientes   = filteredReqs.filter(r => r.estado === 'ENVIADO').length;
  const tasaAprobacion = totalReqs > 0 ? Math.round((confirmados / totalReqs) * 100) : 0;
  const totalSKUs    = materials.length;
  const stockOK      = materials.filter(m => m.estado === 'OK').length;

  const barData  = SEDES.map(s => [
    filteredReqs.filter(r => r.sede === s && r.estado === 'CONFIRMADO').length,
    filteredReqs.filter(r => r.sede === s && r.estado === 'ENVIADO').length,
  ]);

  /* Top materiales consumidos */
  const consumoMap: Record<string, { nombre: string; total: number }> = {};
  filteredReqs.filter(r => r.estado === 'CONFIRMADO').forEach(r => {
    r.materiales.forEach(m => {
      if (!consumoMap[m.skuId]) consumoMap[m.skuId] = { nombre: m.nombre, total: 0 };
      consumoMap[m.skuId].total += m.cantidad;
    });
  });
  const topMateriales = Object.entries(consumoMap).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
  const maxConsumo = topMateriales[0]?.[1].total || 1;

  /* Analistas */
  const analistaMap: Record<string, number> = {};
  filteredReqs.forEach(r => { analistaMap[r.analista] = (analistaMap[r.analista] || 0) + 1; });
  const topAnalistas = Object.entries(analistaMap).sort((a, b) => b[1] - a[1]).slice(0, 4);

  const tabReqs = activeTab === 'confirmados' ? filteredReqs.filter(r => r.estado === 'CONFIRMADO')
                : activeTab === 'pendientes'  ? filteredReqs.filter(r => r.estado === 'ENVIADO')
                : filteredReqs;

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: '#EEF0FF', minHeight: '100%' }}>

      {/* Period selector */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 }}>
        <span style={{ fontSize: 13, color: '#8B8FA8' }}>Mostrando datos del período seleccionado</span>
        <div style={{ display: 'flex', background: '#fff', borderRadius: 12, padding: 4, gap: 3, boxShadow: '0 2px 8px rgba(99,102,241,0.08)' }}>
          {([['7d', 'Últimos 7 días'], ['30d', 'Últimos 30 días'], ['all', 'Todo']] as [Period, string][]).map(([v, label]) => (
            <button key={v} onClick={() => setPeriod(v)} style={{
              padding: '7px 16px', borderRadius: 9, border: 'none', cursor: 'pointer', fontSize: 12.5, fontWeight: 500, transition: 'all 0.15s',
              background: period === v ? '#2563EB' : 'transparent',
              color: period === v ? '#fff' : '#8B8FA8',
              boxShadow: period === v ? '0 2px 8px rgba(37,99,235,0.3)' : 'none',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {/* ── Row 1: KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
        {[
          { label: 'Total solicitudes', value: totalReqs,       color: '#2563EB', bg: '#DBEAFE' },
          { label: 'Confirmadas',       value: confirmados,      color: '#059669', bg: '#CCFBF1' },
          { label: 'Rechazadas',        value: rechazados,       color: '#DC2626', bg: '#FEE2E2' },
          { label: 'Pendientes',        value: pendientes,       color: '#D97706', bg: '#FEF3C7' },
          { label: 'Tasa aprobación',   value: `${tasaAprobacion}%`, color: tasaAprobacion >= 70 ? '#059669' : tasaAprobacion >= 40 ? '#D97706' : '#DC2626', bg: '#F8F9FF' },
        ].map(({ label, value, color, bg }) => (
          <Card key={label} style={{ padding: '18px 20px' }}>
            <div style={{ width: 38, height: 38, borderRadius: 12, background: bg, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
              <div style={{ width: 12, height: 12, borderRadius: '50%', background: color }} />
            </div>
            <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: '-0.03em', lineHeight: 1 }}>{value}</div>
            <div style={{ fontSize: 11.5, color: '#8B8FA8', marginTop: 5, fontWeight: 500 }}>{label}</div>
          </Card>
        ))}
      </div>

      {/* ── Row 2: Bar chart + Analistas + Estado inventario ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px 220px', gap: 18, marginBottom: 22 }}>
        {/* Bar chart */}
        <Card style={{ padding: '22px 24px' }}>
          <SectionHead title="Requerimientos por sede" />
          <div style={{ display: 'flex', gap: 16, marginBottom: 14 }}>
            {[['Confirmadas', '#059669'], ['Pendientes', '#D97706']].map(([l, c]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 3, background: c }} />
                <span style={{ fontSize: 11.5, color: '#8B8FA8' }}>{l}</span>
              </div>
            ))}
          </div>
          <BarChart data={barData} colors={['#059669', '#D97706']} labels={SEDES} height={120} />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginTop: 16 }}>
            {SEDES.map(s => {
              const sedeReqs = filteredReqs.filter(r => r.sede === s);
              const sedeConf = sedeReqs.filter(r => r.estado === 'CONFIRMADO').length;
              return (
                <div key={s} style={{ background: '#F8F9FF', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: SEDE_COLOR[s], fontWeight: 700, marginBottom: 4 }}>{s}</div>
                  <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1D23' }}>{sedeReqs.length}</div>
                  <div style={{ fontSize: 10, color: '#8B8FA8' }}>{sedeConf} conf.</div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Analistas activos */}
        <Card style={{ padding: '22px 20px' }}>
          <SectionHead title="Analistas activos" />
          {topAnalistas.length === 0 ? (
            <div style={{ fontSize: 12, color: '#8B8FA8', textAlign: 'center', padding: '20px 0' }}>Sin actividad</div>
          ) : topAnalistas.map(([nombre, count], i) => {
            const initials = nombre.split(' ').slice(0, 2).map((w: string) => w[0]).join('').toUpperCase();
            const colors = ['#2563EB', '#059669', '#7C3AED', '#D97706'];
            const c = colors[i % colors.length];
            return (
              <div key={nombre} style={{ marginBottom: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <div style={{ width: 32, height: 32, borderRadius: 10, background: `${c}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: c, flexShrink: 0 }}>{initials}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</div>
                    <div style={{ fontSize: 10.5, color: '#8B8FA8' }}>{count} solicitud{count !== 1 ? 'es' : ''}</div>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 800, color: c }}>{count}</span>
                </div>
                <div style={{ height: 4, background: '#F0F2FF', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${(count / (topAnalistas[0]?.[1] || 1)) * 100}%`, background: c, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </Card>

        {/* Inventario por estado */}
        <Card style={{ padding: '22px 20px' }}>
          <SectionHead title="Estado del inventario" />
          <div style={{ textAlign: 'center', marginBottom: 16 }}>
            <div style={{ fontSize: 28, fontWeight: 800, color: '#059669' }}>{stockOK}</div>
            <div style={{ fontSize: 11, color: '#8B8FA8' }}>de {totalSKUs} SKU en óptimas condiciones</div>
          </div>
          {[
            { label: 'OK',      count: materials.filter(m => m.estado === 'OK').length,      color: '#059669', bg: '#CCFBF1' },
            { label: 'BAJO',    count: materials.filter(m => m.estado === 'BAJO').length,    color: '#D97706', bg: '#FEF3C7' },
            { label: 'CRÍTICO', count: materials.filter(m => m.estado === 'CRÍTICO').length, color: '#DC2626', bg: '#FEE2E2' },
            { label: 'AGOTADO', count: materials.filter(m => m.estado === 'AGOTADO').length, color: '#991B1B', bg: '#FEE2E2' },
          ].map(({ label, count, color, bg }) => {
            const pct = totalSKUs > 0 ? (count / totalSKUs) * 100 : 0;
            return (
              <div key={label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ background: bg, color, borderRadius: 4, padding: '1px 7px', fontSize: 10.5, fontWeight: 700 }}>{label}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color }}>{count}</span>
                </div>
                <div style={{ height: 5, background: '#F0F2FF', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color, borderRadius: 4 }} />
                </div>
              </div>
            );
          })}
        </Card>
      </div>

      {/* ── Row 3: Top materiales + Estado resumen ── */}
      <Card style={{ padding: '22px 24px', marginBottom: 22 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 24 }}>
          {/* Top materiales */}
          <div>
            <SectionHead title="Materiales más solicitados" />
            {topMateriales.length === 0 ? (
              <div style={{ fontSize: 13, color: '#8B8FA8', textAlign: 'center', padding: '20px 0' }}>Sin datos confirmados en este período</div>
            ) : topMateriales.map(([sku, { nombre, total }], i) => {
              const pct = (total / maxConsumo) * 100;
              return (
                <div key={sku} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <div style={{ width: 22, height: 22, borderRadius: 7, background: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 800, color: '#2563EB', flexShrink: 0 }}>{i + 1}</div>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1D23', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre}</span>
                    </div>
                    <span style={{ fontSize: 12.5, fontWeight: 800, color: '#2563EB', flexShrink: 0, marginLeft: 8 }}>{total} UND</span>
                  </div>
                  <div style={{ height: 6, background: '#F0F2FF', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: '#2563EB', borderRadius: 4, opacity: 0.7 + 0.3 * (1 - i / topMateriales.length) }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Estado por estado resumen */}
          <div style={{ borderLeft: '1px solid #F0F2FF', paddingLeft: 24 }}>
            <SectionHead title="Resumen de estados" />
            {['CONFIRMADO', 'ENVIADO', 'RECHAZADO', 'BORRADOR'].map(e => {
              const cnt = filteredReqs.filter(r => r.estado === e).length;
              return (
                <div key={e} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: ESTADO_COLOR[e] }} />
                    <span style={{ fontSize: 12.5, color: '#52525B', fontWeight: 500 }}>{e}</span>
                  </div>
                  <span style={{ fontSize: 16, fontWeight: 800, color: ESTADO_COLOR[e] }}>{cnt}</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>

      {/* ── Row 4: Tabla con tabs (BankFlash transaction style) ── */}
      <Card>
        {/* Tabs */}
        <div style={{ padding: '18px 24px 0', borderBottom: '1px solid #F0F2FF' }}>
          <div style={{ display: 'flex', gap: 4, marginBottom: 0 }}>
            {([['todos', 'Todas las solicitudes'], ['confirmados', 'Confirmadas'], ['pendientes', 'Pendientes']] as const).map(([v, label]) => (
              <button key={v} onClick={() => setActiveTab(v)} style={{
                padding: '10px 18px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'none',
                color: activeTab === v ? '#2563EB' : '#8B8FA8',
                borderBottom: activeTab === v ? '2.5px solid #2563EB' : '2.5px solid transparent',
                transition: 'all 0.15s', marginBottom: -1,
              }}>{label}</button>
            ))}
            <div style={{ marginLeft: 'auto', alignSelf: 'center', fontSize: 12, color: '#8B8FA8', paddingBottom: 4 }}>
              {tabReqs.length} registros
            </div>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F0F2FF', background: '#F8F9FF' }}>
                {['ID', 'Proyecto', 'Sede', 'Analista', 'Técnico', 'Fecha', 'Items', 'Estado'].map(h => (
                  <th key={h} style={{ padding: '11px 16px', fontSize: 11, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'left' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tabReqs.length === 0 ? (
                <tr><td colSpan={8} style={{ padding: 32, textAlign: 'center', color: '#A1A1AA', fontSize: 13 }}>Sin registros en este período</td></tr>
              ) : [...tabReqs].sort((a, b) => b.fecha.localeCompare(a.fecha)).map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #F8F9FF', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8F9FF'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                  <td style={{ padding: '13px 16px', fontFamily: 'monospace', fontSize: 11, color: '#2563EB', fontWeight: 700 }}>{r.id}</td>
                  <td style={{ padding: '13px 16px', fontSize: 12.5, fontWeight: 600, color: '#1A1D23', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.proyecto}</td>
                  <td style={{ padding: '13px 16px' }}>
                    <span style={{ background: SEDE_BG[r.sede], color: SEDE_COLOR[r.sede], borderRadius: 6, padding: '3px 9px', fontSize: 11, fontWeight: 700 }}>{r.sede}</span>
                  </td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: '#8B8FA8' }}>{r.analista}</td>
                  <td style={{ padding: '13px 16px', fontSize: 12, color: '#8B8FA8', maxWidth: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.tecnico}</td>
                  <td style={{ padding: '13px 16px', fontFamily: 'monospace', fontSize: 11, color: '#8B8FA8' }}>{r.fecha}</td>
                  <td style={{ padding: '13px 16px', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>{r.materiales.length}</td>
                  <td style={{ padding: '13px 16px' }}>
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
