import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { Role, SEDES, Sede, Material } from '../../data/mockData';
import MaterialPreviewModal, { PreviewBtn } from '../../components/MaterialPreviewModal';

interface Props { role: Role; onToast: (msg: string) => void; }

const BLANK_FORM = { nombre: '', descripcion: '', categoria: '', stockChiclayo: '', stockChimbote: '', stockTrujillo: '', minimo: '' };
const BLANK_STOCK = { Chiclayo: '', Chimbote: '', Trujillo: '' };
const ESTADO_BADGE: Record<string, string> = { OK: 'green', BAJO: 'amber', CRÍTICO: 'red', AGOTADO: 'red' };
const SEDE_COLOR: Record<string, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };

export default function InventarioView({ role, onToast }: Props) {
  const { state, dispatch } = useAppStore();
  const canEdit = role === 'coordinador';
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [estadoFilter, setEstadoFilter] = useState('');
  const [sedeView, setSedeView] = useState<Sede | 'todas'>('todas');
  const [selected, setSelected] = useState<Material | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [editStock, setEditStock] = useState<Record<string, string>>({ ...BLANK_STOCK });
  const [editMinimo, setEditMinimo] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewMat, setPreviewMat] = useState<Material | null>(null);

  const cats = Array.from(new Set(state.materials.map(m => m.categoria)));

  const filtered = state.materials.filter(m => {
    const q = search.toLowerCase();
    return (
      (!q || m.id.toLowerCase().includes(q) || m.nombre.toLowerCase().includes(q) || m.categoria.toLowerCase().includes(q)) &&
      (!catFilter || m.categoria === catFilter) &&
      (!estadoFilter || m.estado === estadoFilter)
    );
  });

  const getDisplayStock = (m: Material) =>
    sedeView === 'todas'
      ? Object.values(m.stockSedes).reduce((s, v) => s + v, 0)
      : m.stockSedes[sedeView];

  const validateAdd = () => {
    const e: Record<string, string> = {};
    if (!form.nombre.trim()) e.nombre = 'Requerido';
    if (!form.descripcion.trim()) e.descripcion = 'Requerido';
    if (!form.categoria.trim()) e.categoria = 'Requerido';
    if (form.minimo === '' || isNaN(parseFloat(form.minimo))) e.minimo = 'Inválido';
    return e;
  };

  const handleAddMaterial = () => {
    const e = validateAdd();
    if (Object.keys(e).length) { setErrors(e); return; }
    dispatch({
      type: 'ADD_MATERIAL',
      payload: {
        nombre: form.nombre,
        descripcion: form.descripcion,
        categoria: form.categoria,
        unidad: 'UND',
        stockSedes: {
          Chiclayo: parseFloat(form.stockChiclayo) || 0,
          Chimbote: parseFloat(form.stockChimbote) || 0,
          Trujillo: parseFloat(form.stockTrujillo) || 0,
        },
        minimo: parseFloat(form.minimo),
      },
    });
    onToast(`✓ Material agregado al catálogo: ${form.nombre}`);
    setShowAdd(false);
    setForm({ ...BLANK_FORM });
    setErrors({});
  };

  const openEditStock = (m: Material) => {
    setEditMode(true);
    setSelected(m);
    setEditStock({ Chiclayo: String(m.stockSedes.Chiclayo), Chimbote: String(m.stockSedes.Chimbote), Trujillo: String(m.stockSedes.Trujillo) });
    setEditMinimo(String(m.minimo));
  };

  const handleSaveStock = () => {
    if (!selected) return;
    dispatch({
      type: 'UPDATE_MATERIAL_STOCK',
      payload: {
        id: selected.id,
        stockSedes: {
          Chiclayo: parseFloat(editStock.Chiclayo) || 0,
          Chimbote: parseFloat(editStock.Chimbote) || 0,
          Trujillo: parseFloat(editStock.Trujillo) || 0,
        },
        minimo: parseFloat(editMinimo) || selected.minimo,
      },
    });
    onToast(`✓ Stock actualizado: ${selected.nombre}`);
    setSelected(null);
    setEditMode(false);
  };

  const totalStock = state.materials.reduce((s, m) => s + Object.values(m.stockSedes).reduce((a, b) => a + b, 0), 0);

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1 }}>
      {/* Summary KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 20 }}>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: '#71717A', fontWeight: 500, marginBottom: 8 }}>Total SKU</div>
          <div style={{ fontSize: 26, fontWeight: 700, color: '#2563EB' }}>{state.materials.length}</div>
        </div>
        <div className="kpi-card">
          <div style={{ fontSize: 12, color: '#71717A', fontWeight: 500, marginBottom: 8 }}>Stock total</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#18181B' }}>{totalStock.toLocaleString('es-MX')} <span style={{ fontSize: 12 }}>UND</span></div>
        </div>
        {[{ s: 'CRÍTICO', c: '#DC2626' }, { s: 'AGOTADO', c: '#DC2626' }, { s: 'BAJO', c: '#D97706' }].map(({ s, c }) => (
          <div key={s} className="kpi-card">
            <div style={{ fontSize: 12, color: '#71717A', fontWeight: 500, marginBottom: 8 }}>{s}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: c }}>{state.materials.filter(m => m.estado === s).length}</div>
          </div>
        ))}
      </div>

      {/* Sede tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12, background: sedeView === 'todas' ? '#EFF6FF' : undefined, color: sedeView === 'todas' ? '#2563EB' : undefined, borderColor: sedeView === 'todas' ? '#BFDBFE' : undefined }} onClick={() => setSedeView('todas')}>
          Todas las sedes
        </button>
        {SEDES.map(s => (
          <button key={s} className="btn btn-ghost" style={{ padding: '6px 14px', fontSize: 12, background: sedeView === s ? `${SEDE_COLOR[s]}15` : undefined, color: sedeView === s ? SEDE_COLOR[s] : undefined, borderColor: sedeView === s ? SEDE_COLOR[s] : undefined }} onClick={() => setSedeView(s)}>
            {s}
          </button>
        ))}
      </div>

      <div className="panel">
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #E4E4E7', display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input className="input-field" style={{ maxWidth: 240 }} placeholder="Buscar SKU, nombre, categoría…" value={search} onChange={e => setSearch(e.target.value)} />
          <select className="select-field" value={catFilter} onChange={e => setCatFilter(e.target.value)}>
            <option value="">Todas las categorías</option>
            {cats.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="select-field" value={estadoFilter} onChange={e => setEstadoFilter(e.target.value)}>
            <option value="">Todos los estados</option>
            <option value="OK">OK</option><option value="BAJO">Bajo</option>
            <option value="CRÍTICO">Crítico</option><option value="AGOTADO">Agotado</option>
          </select>
          <div style={{ marginLeft: 'auto', fontSize: 12, color: '#71717A' }}>{filtered.length} de {state.materials.length} SKU</div>
          {canEdit && (
            <button className="btn btn-primary" onClick={() => { setShowAdd(true); setForm({ ...BLANK_FORM }); setErrors({}); }}>+ Nuevo SKU</button>
          )}
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>SKU</th><th></th><th>Material</th><th>Categoría</th><th>Unidad</th>
                {sedeView === 'todas'
                  ? <><th>Chiclayo</th><th>Chimbote</th><th>Trujillo</th><th>Total</th></>
                  : <th>Stock ({sedeView})</th>
                }
                <th>Mínimo</th><th>Estado</th>
                {canEdit && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => {
                const total = Object.values(m.stockSedes).reduce((s, v) => s + v, 0);
                return (
                  <tr key={m.id} style={{ cursor: 'pointer' }} onClick={() => { setSelected(m); setEditMode(false); }}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#2563EB', fontWeight: 600 }}>{m.id}</td>
                    <td onClick={e => e.stopPropagation()} style={{ padding: '0 4px' }}>
                      <PreviewBtn onClick={() => setPreviewMat(m)} />
                    </td>
                    <td style={{ fontWeight: 500, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.nombre}</td>
                    <td style={{ fontSize: 12, color: '#71717A' }}>{m.categoria}</td>
                    <td style={{ fontSize: 11, color: '#71717A', textAlign: 'center' }}>UND</td>
                    {sedeView === 'todas'
                      ? SEDES.map(s => (
                        <td key={s} style={{ fontFamily: 'monospace', fontSize: 12, textAlign: 'center', fontWeight: m.stockSedes[s] === 0 ? 700 : 400, color: m.stockSedes[s] === 0 ? '#DC2626' : '#18181B' }}>
                          {m.stockSedes[s]}
                        </td>
                      ))
                      : null
                    }
                    {sedeView !== 'todas' && (
                      <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700, color: m.stockSedes[sedeView] === 0 ? '#DC2626' : '#18181B' }}>
                        {m.stockSedes[sedeView]}
                      </td>
                    )}
                    {sedeView === 'todas' && (
                      <td style={{ fontFamily: 'monospace', fontSize: 13, fontWeight: 700 }}>{total}</td>
                    )}
                    <td style={{ fontFamily: 'monospace', fontSize: 12, color: '#71717A' }}>{m.minimo}</td>
                    <td><span className={`badge badge-${ESTADO_BADGE[m.estado] || 'gray'}`}>{m.estado}</span></td>
                    {canEdit && (
                      <td onClick={e => e.stopPropagation()}>
                        <button className="btn btn-ghost" style={{ padding: '3px 10px', fontSize: 11 }} onClick={() => openEditStock(m)}>
                          Editar stock
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail modal */}
      {selected && !editMode && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <div className="modal" style={{ width: 560 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 11, color: '#2563EB', fontFamily: 'monospace', marginBottom: 3 }}>{selected.id}</div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>{selected.nombre}</h2>
              </div>
              <span className={`badge badge-${ESTADO_BADGE[selected.estado]}`}>{selected.estado}</span>
            </div>
            <div style={{ padding: '18px 22px' }}>
              <div style={{ fontSize: 12, color: '#52525B', lineHeight: 1.6, marginBottom: 18 }}>{selected.descripcion}</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 18 }}>
                <div><div style={{ fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Categoría</div><div style={{ fontSize: 13, fontWeight: 500 }}>{selected.categoria}</div></div>
                <div><div style={{ fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Unidad</div><div style={{ fontSize: 13, fontWeight: 500 }}>UND</div></div>
                <div><div style={{ fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Stock mínimo</div><div style={{ fontSize: 13, fontWeight: 700, color: '#DC2626' }}>{selected.minimo} UND</div></div>
                <div><div style={{ fontSize: 10, color: '#71717A', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 4 }}>Stock total</div><div style={{ fontSize: 13, fontWeight: 700, color: '#059669' }}>{Object.values(selected.stockSedes).reduce((s, v) => s + v, 0)} UND</div></div>
              </div>
              <div style={{ background: '#F9FAFB', border: '1px solid #E4E4E7', borderRadius: 8, padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Stock por sede</div>
                {SEDES.map(s => (
                  <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: SEDE_COLOR[s] }} />
                    <span style={{ fontSize: 12.5, flex: 1, color: '#52525B' }}>{s}</span>
                    <span style={{ fontSize: 14, fontWeight: 700, color: selected.stockSedes[s] === 0 ? '#DC2626' : '#18181B', fontFamily: 'monospace' }}>
                      {selected.stockSedes[s]} <span style={{ fontSize: 11, fontWeight: 400, color: '#A1A1AA' }}>UND</span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              {canEdit && <button className="btn btn-primary" onClick={() => openEditStock(selected)}>Editar stock</button>}
              <button className="btn btn-ghost" onClick={() => setSelected(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit stock modal */}
      {selected && editMode && (
        <div className="modal-overlay" onClick={() => { setEditMode(false); setSelected(null); }}>
          <div className="modal" style={{ width: 480 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <div>
                <div style={{ fontSize: 11, color: '#2563EB', fontFamily: 'monospace', marginBottom: 3 }}>{selected.id}</div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>Editar stock — {selected.nombre}</h2>
              </div>
            </div>
            <div style={{ padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {SEDES.map(s => (
                <div key={s}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>
                    <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: SEDE_COLOR[s], marginRight: 6 }} />
                    Stock {s} (UND)
                  </label>
                  <input className="input-field" type="number" min="0"
                    value={editStock[s]}
                    onChange={e => setEditStock(p => ({ ...p, [s]: e.target.value }))} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Stock mínimo (total)</label>
                <input className="input-field" type="number" min="0" value={editMinimo} onChange={e => setEditMinimo(e.target.value)} />
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleSaveStock}>Guardar cambios</button>
              <button className="btn btn-ghost" onClick={() => { setEditMode(false); setSelected(null); }}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Add new SKU modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" style={{ width: 580 }} onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#18181B' }}>Nuevo SKU — Agregar material</h2>
              <button className="btn btn-ghost" style={{ padding: '5px 10px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={() => setShowAdd(false)}><svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg></button>
            </div>
            <div style={{ padding: '20px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Nombre del material <span style={{ color: '#DC2626' }}>*</span></label>
                <input className="input-field" placeholder="Ej. Regulador de presión alta"
                  style={{ borderColor: errors.nombre ? '#DC2626' : undefined }}
                  value={form.nombre} onChange={e => { setForm(p => ({ ...p, nombre: e.target.value })); setErrors(p => ({ ...p, nombre: '' })); }} />
                {errors.nombre && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.nombre}</div>}
              </div>
              <div style={{ gridColumn: '1/-1' }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Descripción técnica <span style={{ color: '#DC2626' }}>*</span></label>
                <textarea className="input-field" rows={2} placeholder="Descripción técnica del material…"
                  style={{ resize: 'none', fontFamily: 'inherit', borderColor: errors.descripcion ? '#DC2626' : undefined }}
                  value={form.descripcion} onChange={e => { setForm(p => ({ ...p, descripcion: e.target.value })); setErrors(p => ({ ...p, descripcion: '' })); }} />
                {errors.descripcion && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.descripcion}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Categoría <span style={{ color: '#DC2626' }}>*</span></label>
                <select className="select-field" style={{ width: '100%', borderColor: errors.categoria ? '#DC2626' : undefined }}
                  value={form.categoria} onChange={e => { setForm(p => ({ ...p, categoria: e.target.value })); setErrors(p => ({ ...p, categoria: '' })); }}>
                  <option value="">— Seleccionar —</option>
                  {['Gas Natural', 'EPP', 'Herramientas', 'Señalética', 'Otro'].map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                {errors.categoria && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.categoria}</div>}
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: '#52525B', marginBottom: 6 }}>Stock mínimo (UND) <span style={{ color: '#DC2626' }}>*</span></label>
                <input className="input-field" type="number" min="0" placeholder="0"
                  style={{ borderColor: errors.minimo ? '#DC2626' : undefined }}
                  value={form.minimo} onChange={e => { setForm(p => ({ ...p, minimo: e.target.value })); setErrors(p => ({ ...p, minimo: '' })); }} />
                {errors.minimo && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.minimo}</div>}
              </div>
              <div style={{ gridColumn: '1/-1', background: '#F9FAFB', borderRadius: 8, border: '1px solid #E4E4E7', padding: '14px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#52525B', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12 }}>Stock inicial por sede (UND)</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
                  {SEDES.map((s, i) => (
                    <div key={s}>
                      <label style={{ display: 'block', fontSize: 11, color: SEDE_COLOR[s], fontWeight: 600, marginBottom: 5 }}>{s}</label>
                      <input className="input-field" type="number" min="0" placeholder="0"
                        value={[form.stockChiclayo, form.stockChimbote, form.stockTrujillo][i]}
                        onChange={e => setForm(p => ({ ...p, [`stock${s}`]: e.target.value }))} />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid #E4E4E7', display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={handleAddMaterial}>Agregar al catálogo</button>
              <button className="btn btn-ghost" onClick={() => setShowAdd(false)}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {previewMat && <MaterialPreviewModal material={previewMat} onClose={() => setPreviewMat(null)} />}
    </div>
  );
}
