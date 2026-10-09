import DataDetails from '../../../components/DataDetails';
import { publicCode } from "../../../utils/publicCode";
import { useState } from 'react';
import { useAppStore } from '../../../store/AppContext';
import { Proyecto, Requerimiento, Role, SEDES } from '../../../domain/types';
import RequirementStatusTimeline from '../../../components/RequirementStatusTimeline';
import CotizacionesView from '../../cotizaciones/CotizacionesView';
import SeguimientoProyecto from '../components/SeguimientoProyecto';
import { ESTADOS_OBRA, type EstadoObra } from '../seguimiento';

interface Props { role: Role; onToast: (msg: string) => void; onNav?: (view: string) => void; }

import { SEDE_COLOR, SEDE_BG, REQUERIMIENTO_COLOR as ESTADO_COLOR, REQUERIMIENTO_BG as ESTADO_BG } from '../../../config/visualTokens';

function ProjectDetail({ proyecto, onBack, role, onToast, onNav, managerSurface = false }: { proyecto: Proyecto; onBack: () => void; role: Role; onToast: (msg: string) => void; onNav?: (view: string) => void; managerSurface?: boolean }) {
  const [showQuotes, setShowQuotes] = useState(false);
  const { state } = useAppStore();
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [selectedRequirement, setSelectedRequirement] = useState<Requerimiento | null>(null);

  const reqs = state.requerimientos.filter(r => r.proyectoId === proyecto.id);
  const filtered = reqs.filter(r =>
    (!estadoFilter || r.estado === estadoFilter) &&
    (!search || publicCode(r).toLowerCase().includes(search.toLowerCase()) ||
      r.tecnico.toLowerCase().includes(search.toLowerCase()) ||
      r.materiales.some(m => m.nombre.toLowerCase().includes(search.toLowerCase())))
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const confirmados = reqs.filter(r => r.estado === 'CONFIRMADO').length;
  const pendientes = reqs.filter(r => r.estado === 'ENVIADO').length;

  if (showQuotes) return <div style={{ flex: 1, overflowY: 'auto' }}><div style={{ padding: '18px 24px 0' }}><button className="btn btn-ghost" onClick={() => setShowQuotes(false)}>← Volver a {proyecto.nombre}</button></div><CotizacionesView role={role} onToast={onToast} onNav={onNav} projectId={proyecto.id} /></div>;

  return (
    <div className={managerSurface ? 'manager-view-surface manager-projects-view' : undefined} style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <button className="btn btn-ghost" style={{ marginBottom: 18, fontSize: 12 }} onClick={onBack}>
        ← Volver a proyectos
      </button>

      {/* Project header */}
      <div className="panel" style={{ padding: '20px 22px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>

              <span style={{ background: SEDE_BG[proyecto.sede], color: SEDE_COLOR[proyecto.sede], borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{proyecto.sede}</span>
            </div>
            <h2 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, color: '#18181B', letterSpacing: '-0.01em' }}>{proyecto.nombre}</h2>
            <div style={{ fontSize: 13, color: '#71717A', marginBottom: 4 }}><svg width="11" height="11" viewBox="0 0 15 15" fill="none" style={{display:'inline',marginRight:3,verticalAlign:'middle'}}><circle cx="7.5" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 1C5 1 3 3 3 6c0 3.5 4.5 8 4.5 8S12 9.5 12 6c0-3-2-5-4.5-5z" stroke="currentColor" strokeWidth="1.3"/></svg>{proyecto.ubicacion}</div>
            <div style={{ fontSize: 12.5, color: '#52525B' }}>Cliente: <strong>{proyecto.cliente}</strong></div>
            {proyecto.observaciones && (
              <div style={{ marginTop: 10, fontSize: 12, color: '#71717A', background: '#F9FAFB', borderRadius: 6, padding: '8px 12px', borderLeft: '3px solid #E4E4E7' }}>
                {proyecto.observaciones}
              </div>
            )}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', width: 320, maxWidth: '100%', gap: 10 }}>
            {[
              { label: 'Total reqs.', value: reqs.length, color: '#2563EB', bg: '#DBEAFE' },
              { label: 'Confirmados', value: confirmados, color: '#059669', bg: '#CCFBF1' },
              { label: 'Pendientes', value: pendientes, color: '#D97706', bg: '#FEF3C7' },
            ].map(({ label, value, color, bg }) => (
              <div key={label} style={{ background: bg, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: 22, fontWeight: 800, color }}>{value}</div>
                <div style={{ fontSize: 10.5, color: '#52525B', marginTop: 3 }}>{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <SeguimientoProyecto key={proyecto.id} proyecto={proyecto} role={role} onToast={onToast} />

      {/* Requerimientos list */}
      <button className="btn btn-primary" style={{ marginBottom: 18 }} onClick={() => setShowQuotes(true)}>Cotizaciones, presupuesto y costos de este proyecto →</button>
      <div className="panel">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E4E4E7', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input-field" style={{ maxWidth: 260 }}
            placeholder="Buscar por ID, técnico o material…"
            value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select-field" value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            {['BORRADOR', 'ENVIADO', 'CONFIRMADO', 'RECHAZADO'].map(e => <option key={e} value={e}>{e}</option>)}
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#71717A' }}>{filtered.length} requerimiento{filtered.length !== 1 ? 's' : ''}</div>
        </div>
        {filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#A1A1AA' }}>
            <div style={{ marginBottom: 10, color: '#C4C6D8', display: 'flex', justifyContent: 'center' }}><svg width="28" height="28" viewBox="0 0 15 15" fill="none"><rect x="2" y="3" width="11" height="11" rx="1.5" stroke="currentColor" strokeWidth="1.2"/><path d="M5 3V2.5A1.5 1.5 0 016.5 1h2A1.5 1.5 0 0110 2.5V3" stroke="currentColor" strokeWidth="1.2"/><path d="M4.5 8h6M4.5 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg></div>
            <div style={{ fontSize: 14, fontWeight: 600, color: '#71717A' }}>Sin requerimientos</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Este proyecto aún no tiene solicitudes registradas.</div>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr><th>Código</th><th>Fecha</th><th>Técnico</th><th>Materiales</th><th>Analista</th><th>Estado</th><th>Seguimiento</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB', fontWeight: 700 }}>{publicCode(r)}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#71717A' }}>{r.fecha}</td>
                    <td style={{ fontSize: 12, fontWeight: 500 }}>{r.tecnico}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {r.materiales.slice(0, 2).map(m => (
                          <div key={m.skuId} style={{ fontSize: 11, color: '#52525B' }}>
                            <span style={{ fontFamily: 'monospace', color: '#2563EB' }}>{m.skuId}</span> · {m.cantidad} UND
                          </div>
                        ))}
                        {r.materiales.length > 2 && <div style={{ fontSize: 10.5, color: '#A1A1AA' }}>+{r.materiales.length - 2} más</div>}
                      </div>
                    </td>
                    <td style={{ fontSize: 12, color: '#71717A' }}>{r.analista}</td>
                    <td>
                      <span style={{ background: ESTADO_BG[r.estado], color: ESTADO_COLOR[r.estado], borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 600 }}>
                        {r.estado}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 11 }} onClick={() => setSelectedRequirement(r)}>
                        Ver estado
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedRequirement && (
        <div className="modal-overlay" onClick={() => setSelectedRequirement(null)}>
          <div className="modal" style={{ width: 640 }} onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 11, color: '#71717A', fontFamily: 'monospace', marginBottom: 3 }}>{publicCode(selectedRequirement)}</div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>{selectedRequirement.proyecto}</h2>
              </div>
              <span className="status-badge" style={{ background: ESTADO_BG[selectedRequirement.estado], color: ESTADO_COLOR[selectedRequirement.estado] }}>
                {selectedRequirement.estado}
              </span>
            </div>

            <RequirementStatusTimeline requirement={selectedRequirement} />

            <div className="record-details-wrap"><DataDetails title="Datos del requerimiento" fields={[
                { label: 'Sede', value: selectedRequirement.sede },
                { label: 'Ubicación', value: selectedRequirement.ubicacion, wide: true },
                { label: 'Analista', value: selectedRequirement.analista },
                { label: 'Técnico responsable', value: selectedRequirement.tecnico },
                { label: 'Descripción', value: selectedRequirement.descripcion, wide: true },
              ]} /></div>

            <div style={{ padding: '0 22px 16px' }}>
              <div style={{ fontSize: 11, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
                Materiales ({selectedRequirement.materiales.length})
              </div>
              <table className="data-table request-materials-table">
                <thead><tr><th>SKU</th><th>Material</th><th>Cantidad</th></tr></thead>
                <tbody>
                  {selectedRequirement.materiales.map(material => (
                    <tr key={material.skuId}>
                      <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB' }}>{material.skuId}</td>
                      <td style={{ fontSize: 12 }}>{material.nombre}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{material.cantidad} UND</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {selectedRequirement.observaciones && (
              <div style={{ margin: '0 22px 16px', borderRadius: 6, padding: '10px 12px', background: selectedRequirement.estado === 'RECHAZADO' ? '#FFF5F5' : '#F0FDF4', color: selectedRequirement.estado === 'RECHAZADO' ? '#DC2626' : '#15803D', fontSize: 12.5 }}>
                <strong>Observación:</strong> {selectedRequirement.observaciones}
              </div>
            )}

            <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-ghost" onClick={() => setSelectedRequirement(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProyectosView({ role, onToast, onNav }: Props) {
  const { state } = useAppStore();
  const [search, setSearch] = useState('');
  const [sedeFilter, setSedeFilter] = useState('');
  const [obraFilter, setObraFilter] = useState<EstadoObra | ''>('');
  const [selected, setSelected] = useState<Proyecto | null>(null);

  const filtered = state.proyectos.filter(p =>
    (!sedeFilter || p.sede === sedeFilter) &&
    (!obraFilter || (p.estadoObra ?? 'PLANIFICADO') === obraFilter) &&
    (!search || p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente.toLowerCase().includes(search.toLowerCase()) ||
      p.responsable.toLowerCase().includes(search.toLowerCase()))
  );

  if (selected) return <ProjectDetail proyecto={state.proyectos.find(p => p.id === selected.id) ?? selected} onBack={() => setSelected(null)} managerSurface={role === 'gerente'} role={role} onToast={onToast} onNav={onNav} />;

  return (
    <div className={role === 'gerente' ? 'manager-view-surface manager-projects-view' : undefined} style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        {SEDES.map(s => {
          const cnt = state.proyectos.filter(p => p.sede === s).length;
          const reqCnt = state.requerimientos.filter(r => state.proyectos.find(p => p.sede === s && p.id === r.proyectoId)).length;
          return (
            <div key={s} className="kpi-card" style={{ cursor: 'pointer', borderColor: sedeFilter === s ? SEDE_COLOR[s] : '#E4E4E7' }} onClick={() => setSedeFilter(sedeFilter === s ? '' : s)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ background: SEDE_BG[s], color: SEDE_COLOR[s], borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{s}</span>
                <span style={{ fontSize: 11, color: '#71717A' }}>{reqCnt} req.</span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 800, color: SEDE_COLOR[s] }}>{cnt}</div>
              <div style={{ fontSize: 12, color: '#71717A', marginTop: 4 }}>proyecto{cnt !== 1 ? 's' : ''}</div>
            </div>
          );
        })}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 18, alignItems: 'center', flexWrap: 'wrap' }}>
        <input className="input-field" style={{ maxWidth: 280 }} placeholder="Buscar proyecto, cliente o responsable…" value={search} onChange={e => setSearch(e.target.value)} />
        <select className="select-field" value={sedeFilter} onChange={e => setSedeFilter(e.target.value)}>
          <option value="">Todas las sedes</option>
          {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select className="select-field" aria-label="Filtrar por estado del proyecto" value={obraFilter} onChange={event => setObraFilter(event.target.value as EstadoObra | '')}>
          <option value="">Todos los estados del proyecto</option>
          {Object.entries(ESTADOS_OBRA).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#71717A' }}>{filtered.length} de {state.proyectos.length}</div>
        {role === 'analista' && (
          <button className="btn btn-primary" onClick={() => onNav?.("nueva-cotizacion")}>Cotizar un nuevo proyecto</button>
        )}
      </div>

      {/* Project cards grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#A1A1AA' }}>
          <div style={{ marginBottom: 12, color: '#C4C6D8', display: 'flex', justifyContent: 'center' }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M3 21h18M9 21V7l6-4v18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 11h6M9 15h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><rect x="3" y="10" width="6" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.3"/></svg></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#71717A' }}>No hay proyectos</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Los proyectos se crean al aceptar una cotización. Ajusta los filtros para consultar los existentes.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(p => {
            const reqs = state.requerimientos.filter(r => r.proyectoId === p.id);
            const confirmados = reqs.filter(r => r.estado === 'CONFIRMADO').length;
            const pendientes = reqs.filter(r => r.estado === 'ENVIADO').length;
            const ultimo = [...reqs].sort((a, b) => b.fecha.localeCompare(a.fecha))[0];
            return (
              <div key={p.id} className="panel" style={{ display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'box-shadow 0.15s', position: 'relative', overflow: 'hidden' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,0.10)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = ''}>
                {/* Top accent */}
                <div style={{ height: 4, background: SEDE_COLOR[p.sede], borderRadius: '8px 8px 0 0', margin: '-1px -1px 0' }} />
                <div style={{ padding: '16px 18px', flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>

                    <span style={{ background: SEDE_BG[p.sede], color: SEDE_COLOR[p.sede], borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{p.sede}</span>
                    <span className={`project-status project-status-${p.estadoObra ?? 'PLANIFICADO'}`}>{ESTADOS_OBRA[p.estadoObra ?? 'PLANIFICADO']}</span>
                  </div>
                  <h3 style={{ margin: '0 0 4px', fontSize: 14.5, fontWeight: 700, color: '#18181B', lineHeight: 1.35 }}>{p.nombre}</h3>
                  <div style={{ fontSize: 12, color: '#71717A', marginBottom: 3 }}><svg width="11" height="11" viewBox="0 0 15 15" fill="none" style={{display:'inline',marginRight:3,verticalAlign:'middle'}}><circle cx="7.5" cy="6" r="2.5" stroke="currentColor" strokeWidth="1.3"/><path d="M7.5 1C5 1 3 3 3 6c0 3.5 4.5 8 4.5 8S12 9.5 12 6c0-3-2-5-4.5-5z" stroke="currentColor" strokeWidth="1.3"/></svg>{p.ubicacion}</div>
                  <div style={{ fontSize: 12, color: '#52525B', marginBottom: 12 }}>
                    <span style={{ color: '#71717A' }}>Cliente: </span>{p.cliente}
                  </div>

                  {/* Técnico */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, background: '#F9FAFB', borderRadius: 6, padding: '7px 10px' }}>
                    <div style={{ width: 24, height: 24, borderRadius: '50%', background: SEDE_BG[p.sede], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: SEDE_COLOR[p.sede], flexShrink: 0 }}>
                      {p.responsable.split(' ').slice(0, 2).map(w => w[0]).join('')}
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#A1A1AA' }}>Responsable</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#18181B' }}>{p.responsable}</div>
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
                    {[
                      { label: 'Total', value: reqs.length, color: '#52525B' },
                      { label: 'Confirmados', value: confirmados, color: '#059669' },
                      { label: 'Pendientes', value: pendientes, color: '#D97706' },
                    ].map(({ label, value, color }) => (
                      <div key={label} style={{ textAlign: 'center', background: '#F9FAFB', borderRadius: 6, padding: '8px 4px' }}>
                        <div style={{ fontSize: 18, fontWeight: 800, color }}>{value}</div>
                        <div style={{ fontSize: 10, color: '#A1A1AA' }}>{label}</div>
                      </div>
                    ))}
                  </div>

                  {ultimo && (
                    <div style={{ fontSize: 11, color: '#A1A1AA', marginBottom: 14 }}>
                      Último req: <span style={{ fontFamily: 'monospace', color: '#2563EB' }}>{publicCode(ultimo)}</span> · {ultimo.fecha}
                    </div>
                  )}
                </div>
                <div style={{ padding: '10px 18px 14px', borderTop: '1px solid #F4F4F5' }}>
                  <button className="btn btn-ghost" style={{ width: '100%', justifyContent: 'center', fontSize: 12.5, fontWeight: 600 }} onClick={() => setSelected(p)}>
                    Ver proyecto →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

    </div>
  );
}
