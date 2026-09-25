import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { Proyecto, Requerimiento, Role, SEDES, Sede } from '../../data/mockData';
import RequirementStatusTimeline from '../../components/RequirementStatusTimeline';

interface Props { role: Role; onToast: (msg: string) => void; }

const SEDE_COLOR: Record<Sede, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };
const SEDE_BG: Record<Sede, string> = { Chiclayo: '#DBEAFE', Chimbote: '#CCFBF1', Trujillo: '#F3E8FF' };
const ESTADO_COLOR: Record<string, string> = { ENVIADO: '#D97706', CONFIRMADO: '#059669', RECHAZADO: '#DC2626', BORRADOR: '#71717A' };
const ESTADO_BG: Record<string, string> = { ENVIADO: '#FEF3C7', CONFIRMADO: '#CCFBF1', RECHAZADO: '#FEE2E2', BORRADOR: '#F4F4F5' };

function NewProyectoModal({ onSave, onClose }: { onSave: (p: Omit<Proyecto, 'id' | 'creadoEn'>) => void; onClose: () => void }) {
  const [form, setForm] = useState({ nombre: '', ubicacion: '', sede: 'Chiclayo' as Sede, responsable: '', cliente: '', observaciones: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = 'Requerido';
    if (!form.ubicacion.trim()) e.ubicacion = 'Requerido';
    if (!form.responsable.trim()) e.responsable = 'Requerido';
    if (!form.cliente.trim()) e.cliente = 'Requerido';
    return e;
  };

  const handleSave = () => {
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    onSave(form);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>Nuevo Proyecto</h2>
          <button className="btn btn-ghost" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button>
        </div>
        <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Nombre del proyecto <span style={{ color: '#DC2626' }}>*</span></label>
            <input className="input-field" placeholder="Ej. Urbanización Las Flores — Etapa 4" value={form.nombre}
              style={{ borderColor: errors.nombre ? '#DC2626' : undefined }}
              onChange={e => { setForm(p => ({ ...p, nombre: e.target.value })); setErrors(p => ({ ...p, nombre: '' })); }} />
            {errors.nombre && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.nombre}</div>}
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Sede <span style={{ color: '#DC2626' }}>*</span></label>
            <select className="select-field" style={{ width: '100%' }} value={form.sede} onChange={e => setForm(p => ({ ...p, sede: e.target.value as Sede }))}>
              {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Cliente <span style={{ color: '#DC2626' }}>*</span></label>
            <input className="input-field" placeholder="Ej. Inmobiliaria XYZ SAC" value={form.cliente}
              style={{ borderColor: errors.cliente ? '#DC2626' : undefined }}
              onChange={e => { setForm(p => ({ ...p, cliente: e.target.value })); setErrors(p => ({ ...p, cliente: '' })); }} />
            {errors.cliente && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.cliente}</div>}
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Ubicación específica <span style={{ color: '#DC2626' }}>*</span></label>
            <input className="input-field" placeholder="Ej. Av. La Marina 450, Mz. B, Lotes 4–8" value={form.ubicacion}
              style={{ borderColor: errors.ubicacion ? '#DC2626' : undefined }}
              onChange={e => { setForm(p => ({ ...p, ubicacion: e.target.value })); setErrors(p => ({ ...p, ubicacion: '' })); }} />
            {errors.ubicacion && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.ubicacion}</div>}
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Responsable técnico <span style={{ color: '#DC2626' }}>*</span></label>
            <input className="input-field" placeholder="Nombre y apellido completo" value={form.responsable}
              style={{ borderColor: errors.responsable ? '#DC2626' : undefined }}
              onChange={e => { setForm(p => ({ ...p, responsable: e.target.value })); setErrors(p => ({ ...p, responsable: '' })); }} />
            {errors.responsable && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.responsable}</div>}
          </div>
          <div style={{ gridColumn: '1/-1' }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Observaciones</label>
            <textarea className="input-field" rows={2} placeholder="Notas adicionales sobre el proyecto…" value={form.observaciones}
              style={{ resize: 'none', fontFamily: 'inherit' }}
              onChange={e => setForm(p => ({ ...p, observaciones: e.target.value }))} />
          </div>
        </div>
        <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-ghost" onClick={onClose}>Cancelar</button>
          <button className="btn btn-primary" onClick={handleSave}>Crear proyecto</button>
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({ proyecto, onBack }: { proyecto: Proyecto; onBack: () => void }) {
  const { state } = useAppStore();
  const [search, setSearch] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [selectedRequirement, setSelectedRequirement] = useState<Requerimiento | null>(null);

  const reqs = state.requerimientos.filter(r => r.proyectoId === proyecto.id || r.proyecto === proyecto.nombre);
  const filtered = reqs.filter(r =>
    (!estadoFilter || r.estado === estadoFilter) &&
    (!search || r.id.toLowerCase().includes(search.toLowerCase()) ||
      r.tecnico.toLowerCase().includes(search.toLowerCase()) ||
      r.materiales.some(m => m.nombre.toLowerCase().includes(search.toLowerCase())))
  ).sort((a, b) => b.fecha.localeCompare(a.fecha));

  const confirmados = reqs.filter(r => r.estado === 'CONFIRMADO').length;
  const pendientes = reqs.filter(r => r.estado === 'ENVIADO').length;

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      <button className="btn btn-ghost" style={{ marginBottom: 18, fontSize: 12 }} onClick={onBack}>
        ← Volver a proyectos
      </button>

      {/* Project header */}
      <div className="panel" style={{ padding: '20px 22px', marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#F4F4F5', color: '#71717A', padding: '2px 7px', borderRadius: 4 }}>{proyecto.id}</span>
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
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 100px)', gap: 10 }}>
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

      {/* Requerimientos list */}
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
                <tr><th>ID</th><th>Fecha</th><th>Técnico</th><th>Materiales</th><th>Analista</th><th>Estado</th><th>Seguimiento</th></tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={r.id}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB', fontWeight: 700 }}>{r.id}</td>
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
                <div style={{ fontSize: 11, color: '#71717A', fontFamily: 'monospace', marginBottom: 3 }}>{selectedRequirement.id}</div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>{selectedRequirement.proyecto}</h2>
              </div>
              <span className="status-badge" style={{ background: ESTADO_BG[selectedRequirement.estado], color: ESTADO_COLOR[selectedRequirement.estado] }}>
                {selectedRequirement.estado}
              </span>
            </div>

            <RequirementStatusTimeline requirement={selectedRequirement} />

            <div style={{ padding: '18px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                ['Sede', selectedRequirement.sede],
                ['Ubicación', selectedRequirement.ubicacion],
                ['Analista', selectedRequirement.analista],
                ['Técnico responsable', selectedRequirement.tecnico],
              ].map(([label, value]) => (
                <div key={label}>
                  <div style={{ fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#18181B' }}>{value}</div>
                </div>
              ))}
              <div style={{ gridColumn: '1/-1' }}>
                <div style={{ fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Descripción</div>
                <div style={{ fontSize: 12.5, color: '#52525B', lineHeight: 1.6 }}>{selectedRequirement.descripcion}</div>
              </div>
            </div>

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

export default function ProyectosView({ role, onToast }: Props) {
  const { state, dbActions } = useAppStore();
  const [search, setSearch] = useState('');
  const [sedeFilter, setSedeFilter] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [selected, setSelected] = useState<Proyecto | null>(null);

  const filtered = state.proyectos.filter(p =>
    (!sedeFilter || p.sede === sedeFilter) &&
    (!search || p.nombre.toLowerCase().includes(search.toLowerCase()) ||
      p.cliente.toLowerCase().includes(search.toLowerCase()) ||
      p.responsable.toLowerCase().includes(search.toLowerCase()))
  );

  const handleCreate = async (data: Omit<Proyecto, 'id' | 'creadoEn'>) => {
    const dup = state.proyectos.find(p => p.nombre.toLowerCase() === data.nombre.toLowerCase());
    if (dup) { onToast('⚠ Ya existe un proyecto con ese nombre'); return; }
    try {
      await dbActions.createProject(data);
      setShowNew(false);
      onToast('✓ Proyecto creado correctamente');
    } catch (error) {
      console.error('Error creando proyecto:', error);
      onToast(error instanceof Error ? error.message : 'No se pudo crear el proyecto');
    }
  };

  if (selected) return <ProjectDetail proyecto={selected} onBack={() => setSelected(null)} />;

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 22 }}>
        {SEDES.map(s => {
          const cnt = state.proyectos.filter(p => p.sede === s).length;
          const reqCnt = state.requerimientos.filter(r => state.proyectos.find(p => p.sede === s && (p.id === r.proyectoId || p.nombre === r.proyecto))).length;
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
        <div style={{ marginLeft: 'auto', fontSize: 12, color: '#71717A' }}>{filtered.length} de {state.proyectos.length}</div>
        {(role === 'coordinador' || role === 'analista') && (
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>+ Nuevo proyecto</button>
        )}
      </div>

      {/* Project cards grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: '#A1A1AA' }}>
          <div style={{ marginBottom: 12, color: '#C4C6D8', display: 'flex', justifyContent: 'center' }}><svg width="36" height="36" viewBox="0 0 24 24" fill="none"><path d="M3 21h18M9 21V7l6-4v18" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 11h6M9 15h6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/><rect x="3" y="10" width="6" height="11" rx="0.5" stroke="currentColor" strokeWidth="1.3"/></svg></div>
          <div style={{ fontSize: 15, fontWeight: 600, color: '#71717A' }}>No hay proyectos</div>
          <div style={{ fontSize: 13, marginTop: 6 }}>Ajusta los filtros o crea un nuevo proyecto.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
          {filtered.map(p => {
            const reqs = state.requerimientos.filter(r => r.proyectoId === p.id || r.proyecto === p.nombre);
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
                    <span style={{ fontFamily: 'monospace', fontSize: 10.5, background: '#F4F4F5', color: '#71717A', padding: '2px 7px', borderRadius: 4 }}>{p.id}</span>
                    <span style={{ background: SEDE_BG[p.sede], color: SEDE_COLOR[p.sede], borderRadius: 4, padding: '2px 8px', fontSize: 11, fontWeight: 700 }}>{p.sede}</span>
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
                      Último req: <span style={{ fontFamily: 'monospace', color: '#2563EB' }}>{ultimo.id}</span> · {ultimo.fecha}
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

      {showNew && <NewProyectoModal onSave={handleCreate} onClose={() => setShowNew(false)} />}
    </div>
  );
}
