import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { SEDES, Sede } from '../../data/mockData';
import MaterialPreviewModal, { PreviewBtn } from '../../components/MaterialPreviewModal';
import { Material, CompraItem } from '../../data/mockData';

interface Props { onToast: (m: string) => void; usuario: string; onNav: (v: string) => void; }

const ESTADO_COLOR: Record<string, string> = { OK: '#059669', BAJO: '#D97706', CRÍTICO: '#DC2626', AGOTADO: '#991B1B' };
const ESTADO_BG:    Record<string, string> = { OK: '#CCFBF1', BAJO: '#FEF3C7', CRÍTICO: '#FEE2E2', AGOTADO: '#FEE2E2' };

export default function NuevaCompraView({ onToast, usuario, onNav }: Props) {
  const { state, dispatch } = useAppStore();

  const [sede, setSede] = useState<Sede>('Chiclayo');
  const [motivo, setMotivo] = useState('');
  const [items, setItems] = useState<(CompraItem & { query: string; showDrop: boolean })[]>([
    { skuId: '', nombre: '', cantidadSolicitada: 0, precioUnitario: undefined, query: '', showDrop: false },
  ]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [previewMat, setPreviewMat] = useState<Material | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [activeTab, setActiveTab] = useState<'form' | 'criticos'>('form');

  /* Materials by estado for quick add */
  const criticos = state.materials.filter(m =>
    (m.estado === 'CRÍTICO' || m.estado === 'AGOTADO') && m.stockSedes[sede] < m.minimo
  );
  const bajos = state.materials.filter(m => m.estado === 'BAJO' && m.stockSedes[sede] < m.minimo);

  const getMatches = (q: string) =>
    q.length < 2 ? [] : state.materials.filter(m =>
      m.nombre.toLowerCase().includes(q.toLowerCase()) || m.id.toLowerCase().includes(q.toLowerCase())
    ).slice(0, 7);

  const selectMat = (idx: number, mat: Material) => {
    const deficit = Math.max(0, mat.minimo - mat.stockSedes[sede]);
    setItems(p => p.map((it, i) => i !== idx ? it : {
      ...it,
      skuId: mat.id,
      nombre: mat.nombre,
      cantidadSolicitada: deficit > 0 ? deficit : 1,
      query: mat.nombre,
      showDrop: false,
    }));
  };

  const quickAdd = (mat: Material) => {
    const deficit = Math.max(1, mat.minimo - mat.stockSedes[sede]);
    const exists = items.find(it => it.skuId === mat.id);
    if (exists) { onToast('⚠ El material ya está en la lista'); return; }
    setItems(p => [...p.filter(it => it.skuId || it.nombre), {
      skuId: mat.id, nombre: mat.nombre, cantidadSolicitada: deficit,
      precioUnitario: undefined, query: mat.nombre, showDrop: false,
    }]);
  };

  const addItem = () => setItems(p => [...p, { skuId: '', nombre: '', cantidadSolicitada: 0, precioUnitario: undefined, query: '', showDrop: false }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, j) => j !== i));

  const updateQuery = (i: number, q: string) =>
    setItems(p => p.map((it, j) => j !== i ? it : { ...it, query: q, skuId: '', nombre: '', showDrop: true }));
  const closeDrop = (i: number) =>
    setItems(p => p.map((it, j) => j !== i ? it : { ...it, showDrop: false }));

  const validate = (draft: boolean) => {
    const e: Record<string, string> = {};
    if (!motivo.trim()) e.motivo = 'Describe el motivo de compra';
    const valid = items.filter(it => (it.skuId || it.nombre) && it.cantidadSolicitada > 0);
    if (!draft && valid.length === 0) e.items = 'Agrega al menos un material con cantidad';
    return e;
  };

  const handleSave = (draft: boolean) => {
    const e = validate(draft);
    if (Object.keys(e).length) { setErrors(e); return; }
    const valid = items.filter(it => (it.skuId || it.nombre) && it.cantidadSolicitada > 0);
    dispatch({
      type: 'CREATE_COMPRA',
      payload: {
        sede,
        analista: usuario,
        motivo,
        draft,
        items: valid.map(({ skuId, nombre, cantidadSolicitada, precioUnitario }) => ({ skuId, nombre, cantidadSolicitada, precioUnitario })),
      },
    });
    setSubmitted(true);
    onToast(draft ? 'Borrador guardado' : 'Solicitud de compra enviada al coordinador');
    setTimeout(() => onNav('mis-compras'), 1200);
  };

  if (submitted) return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 14 }}>
      <div style={{ width: 60, height: 60, borderRadius: '50%', background: '#CCFBF1', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#059669' }}><svg width="28" height="28" viewBox="0 0 15 15" fill="none"><path d="M2 7.5l3.5 3.5 7-7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#18181B' }}>Solicitud enviada</div>
      <div style={{ fontSize: 13, color: '#8B8FA8' }}>Redirigiendo…</div>
    </div>
  );

  const totalEstimado = items.reduce((s, it) => s + (it.cantidadSolicitada * (it.precioUnitario ?? 0)), 0);

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: '#EEF0FF' }}>
      <div style={{ maxWidth: 920, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Alert strip — show if there are critical materials */}
        {criticos.length > 0 && (
          <div style={{ background: '#FFF1F1', border: '1.5px solid #FECACA', borderRadius: 14, padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="18" height="18" viewBox="0 0 15 15" fill="none"><path d="M7.5 1L14 13H1L7.5 1z" stroke="#DC2626" strokeWidth="1.3" strokeLinejoin="round"/><path d="M7.5 6v3M7.5 11v.5" stroke="#DC2626" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#991B1B' }}>
                {criticos.length} material{criticos.length !== 1 ? 'es' : ''} en estado CRÍTICO o AGOTADO en {sede}
              </div>
              <div style={{ fontSize: 12, color: '#DC2626', marginTop: 2 }}>
                Usa la pestaña "Materiales críticos" para agregarlos rápidamente a la solicitud.
              </div>
            </div>
            <button className="btn" style={{ background: '#DC2626', color: '#fff', fontSize: 12, flexShrink: 0 }} onClick={() => setActiveTab('criticos')}>
              Ver críticos →
            </button>
          </div>
        )}

        {/* Tabs */}
        <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(99,102,241,0.07)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #F0F2FF', padding: '0 24px' }}>
            {([['form', 'Nueva solicitud'], ['criticos', `Materiales críticos${criticos.length + bajos.length > 0 ? ` (${criticos.length + bajos.length})` : ''}`]] as const).map(([id, label]) => (
              <button key={id} onClick={() => setActiveTab(id)} style={{
                padding: '15px 16px', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600, background: 'none',
                color: activeTab === id ? '#2563EB' : '#8B8FA8',
                borderBottom: activeTab === id ? '2.5px solid #2563EB' : '2.5px solid transparent',
                transition: 'all 0.15s', marginBottom: -1,
              }}>{label}</button>
            ))}
          </div>

          {/* ── Tab: Materiales críticos ── */}
          {activeTab === 'criticos' && (
            <div style={{ padding: '20px 24px' }}>
              <div style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 12 }}>
                <label style={{ fontSize: 12.5, fontWeight: 600, color: '#8B8FA8' }}>Sede:</label>
                <select className="select-field" style={{ width: 160 }} value={sede} onChange={e => setSede(e.target.value as Sede)}>
                  {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {[...criticos, ...bajos].length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#8B8FA8', fontSize: 13 }}>No hay materiales en estado crítico o bajo en {sede}</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...criticos, ...bajos].map(mat => {
                    const stock = mat.stockSedes[sede];
                    const deficit = mat.minimo - stock;
                    const alreadyAdded = items.some(it => it.skuId === mat.id);
                    return (
                      <div key={mat.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto auto', gap: 14, alignItems: 'center', padding: '12px 16px', background: '#F8F9FF', borderRadius: 12, border: `1.5px solid ${alreadyAdded ? '#BBF7D0' : '#F0F2FF'}` }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600, color: '#1A1D23' }}>{mat.nombre}</div>
                          <div style={{ fontSize: 11, color: '#8B8FA8', fontFamily: 'monospace', marginTop: 2 }}>{mat.id} · {mat.categoria}</div>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#8B8FA8', marginBottom: 3 }}>Stock actual</div>
                          <span style={{ fontSize: 14, fontWeight: 800, color: ESTADO_COLOR[mat.estado] }}>{stock} UND</span>
                        </div>
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ fontSize: 11, color: '#8B8FA8', marginBottom: 3 }}>Déficit</div>
                          <span style={{ fontSize: 14, fontWeight: 800, color: '#DC2626' }}>+{deficit} UND</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ background: ESTADO_BG[mat.estado], color: ESTADO_COLOR[mat.estado], borderRadius: 6, padding: '2px 8px', fontSize: 10.5, fontWeight: 700 }}>{mat.estado}</span>
                          <PreviewBtn onClick={e => { e.stopPropagation(); setPreviewMat(mat); }} />
                          <button className="btn btn-primary" style={{ fontSize: 11.5, padding: '6px 14px', opacity: alreadyAdded ? 0.5 : 1 }}
                            disabled={alreadyAdded}
                            onClick={() => { quickAdd(mat); setActiveTab('form'); }}>
                            {alreadyAdded ? 'Agregado' : '+ Agregar'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Formulario ── */}
          {activeTab === 'form' && (
            <div style={{ padding: '24px 24px 28px', display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* Cabecera */}
              <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr', gap: 18 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>Sede <span style={{ color: '#DC2626' }}>*</span></label>
                  <select className="select-field" style={{ width: '100%' }} value={sede} onChange={e => setSede(e.target.value as Sede)}>
                    {SEDES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11.5, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 7 }}>
                    Motivo de compra <span style={{ color: '#DC2626' }}>*</span>
                  </label>
                  <textarea className="input-field" rows={2}
                    placeholder="Describe por qué se requieren estos materiales (stock insuficiente, nuevo proyecto, etc.)…"
                    style={{ resize: 'none', fontFamily: 'inherit', borderColor: errors.motivo ? '#DC2626' : undefined }}
                    value={motivo} onChange={e => { setMotivo(e.target.value); setErrors(p => ({ ...p, motivo: '' })); }} />
                  {errors.motivo && <div style={{ fontSize: 11, color: '#DC2626', marginTop: 3 }}>{errors.motivo}</div>}
                </div>
              </div>

              {/* Materiales */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Materiales a comprar</div>
                  <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={addItem}>+ Agregar material</button>
                </div>

                {errors.items && (
                  <div style={{ background: '#FEE2E2', border: '1px solid #FECACA', borderRadius: 10, padding: '8px 14px', fontSize: 12, color: '#DC2626', marginBottom: 10 }}>{errors.items}</div>
                )}

                {/* Column headers */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 32px', gap: 10, padding: '0 4px', marginBottom: 6 }}>
                  {['Material', 'Cantidad', 'Precio unit. (S/.)', 'Stock actual', ''].map((h, i) => (
                    <div key={i} style={{ fontSize: 10.5, fontWeight: 600, color: '#8B8FA8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</div>
                  ))}
                </div>

                {items.map((item, i) => {
                  const mat = state.materials.find(m => m.id === item.skuId);
                  const stock = mat ? mat.stockSedes[sede] : null;
                  const matches = getMatches(item.query);
                  return (
                    <div key={i} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px 130px 130px 32px', gap: 10, alignItems: 'start' }}>
                        {/* Autocomplete */}
                        <div style={{ position: 'relative' }}>
                          {item.skuId ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F0FDF4', border: '1.5px solid #BBF7D0', borderRadius: 10, padding: '9px 12px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 12.5, fontWeight: 600, color: '#18181B', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.nombre}</div>
                                <div style={{ fontSize: 10, color: '#8B8FA8', fontFamily: 'monospace' }}>{item.skuId}</div>
                              </div>
                              {mat && <PreviewBtn onClick={e => { e.stopPropagation(); setPreviewMat(mat); }} />}
                              <button onClick={() => updateQuery(i, '')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#8B8FA8', fontSize: 14, padding: 0, flexShrink: 0 }}>✕</button>
                            </div>
                          ) : (
                            <input className="input-field"
                              placeholder="Buscar material por nombre o código…"
                              value={item.query}
                              onChange={e => updateQuery(i, e.target.value)}
                              onFocus={() => setItems(p => p.map((it, j) => j !== i ? it : { ...it, showDrop: true }))}
                              onBlur={() => setTimeout(() => closeDrop(i), 150)}
                            />
                          )}
                          {!item.skuId && item.showDrop && item.query.length >= 2 && (
                            <div style={{ position: 'absolute', zIndex: 50, top: '100%', left: 0, right: 0, marginTop: 4, background: '#fff', border: '1px solid #E8EAFF', borderRadius: 12, boxShadow: '0 8px 24px rgba(99,102,241,0.15)', overflow: 'hidden' }}>
                              {matches.map(m => (
                                <div key={m.id} onMouseDown={() => selectMat(i, m)}
                                  style={{ padding: '9px 14px', cursor: 'pointer', borderBottom: '1px solid #F0F2FF', display: 'flex', alignItems: 'center', gap: 10 }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8F9FF'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = ''}>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 12.5, fontWeight: 600, color: '#1A1D23' }}>{m.nombre}</div>
                                    <div style={{ fontSize: 10.5, color: '#8B8FA8', fontFamily: 'monospace' }}>{m.id} · {m.categoria}</div>
                                  </div>
                                  <span style={{ fontSize: 11, fontWeight: 700, color: ESTADO_COLOR[m.estado], background: ESTADO_BG[m.estado], borderRadius: 5, padding: '2px 7px', flexShrink: 0 }}>{m.estado}</span>
                                </div>
                              ))}
                              {matches.length === 0 && (
                                <div style={{ padding: '10px 14px', fontSize: 12.5, color: '#8B8FA8' }}>Sin resultados — se usará como material libre</div>
                              )}
                              {matches.length > 0 && (
                                <div onMouseDown={() => { setItems(p => p.map((it, j) => j !== i ? it : { ...it, nombre: item.query, skuId: `LIBRE-${i}`, query: item.query, showDrop: false })); }}
                                  style={{ padding: '9px 14px', background: '#F8F9FF', borderTop: '1px solid #E8EAFF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EEF0FF'}
                                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F8F9FF'}>
                                  <span style={{ color: '#2563EB', fontWeight: 700 }}>+</span>
                                  <span style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>Agregar "{item.query}" como nuevo</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        <input className="input-field" type="number" min="1" placeholder="0"
                          style={{ textAlign: 'right' }}
                          value={item.cantidadSolicitada || ''}
                          onChange={e => setItems(p => p.map((it, j) => j !== i ? it : { ...it, cantidadSolicitada: parseInt(e.target.value) || 0 }))} />

                        <div style={{ position: 'relative' }}>
                          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 12, color: '#8B8FA8' }}>S/.</span>
                          <input className="input-field" type="number" min="0" step="0.01" placeholder="0.00"
                            style={{ paddingLeft: 30, textAlign: 'right' }}
                            value={item.precioUnitario ?? ''}
                            onChange={e => setItems(p => p.map((it, j) => j !== i ? it : { ...it, precioUnitario: parseFloat(e.target.value) || undefined }))} />
                        </div>

                        <div style={{ paddingTop: 10, textAlign: 'center', fontFamily: 'monospace', fontSize: 12, fontWeight: 700, color: stock === null ? '#C4C6D8' : stock === 0 ? '#DC2626' : stock < (mat?.minimo ?? 0) ? '#D97706' : '#059669' }}>
                          {stock === null ? '—' : `${stock} UND`}
                        </div>

                        <button onClick={() => removeItem(i)} style={{ marginTop: 6, width: 30, height: 30, borderRadius: 8, border: '1.5px solid #E8EAFF', background: '#F8F9FF', cursor: 'pointer', color: '#8B8FA8', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          ×
                        </button>
                      </div>
                    </div>
                  );
                })}

                <button className="btn btn-ghost" style={{ marginTop: 6, fontSize: 12 }} onClick={addItem}>+ Agregar línea</button>

                {/* Total estimado */}
                {totalEstimado > 0 && (
                  <div style={{ marginTop: 16, padding: '14px 18px', background: '#F0F8FF', border: '1.5px solid #BFDBFE', borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#1D4ED8' }}>Total estimado de compra</span>
                    <span style={{ fontSize: 20, fontWeight: 800, color: '#2563EB' }}>S/. {totalEstimado.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end', paddingBottom: 24 }}>
          <button className="btn btn-ghost" onClick={() => onNav('mis-compras')}>Cancelar</button>
          <button className="btn btn-ghost" style={{ borderColor: '#2563EB', color: '#2563EB', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleSave(true)}>
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M2 2h9l2 2v9a1 1 0 01-1 1H3a1 1 0 01-1-1V2z" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/><path d="M5 2v4h5V2" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/><rect x="4" y="8.5" width="7" height="4.5" rx="0.5" stroke="currentColor" strokeWidth="1.3"/></svg>
            Guardar borrador
          </button>
          <button className="btn btn-primary" style={{ padding: '10px 24px', display: 'flex', alignItems: 'center', gap: 6 }} onClick={() => handleSave(false)}>
            <svg width="14" height="14" viewBox="0 0 15 15" fill="none"><path d="M1 1l13 6.5L1 14V9l8-1.5L1 6V1z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round"/></svg>
            Enviar al coordinador
          </button>
        </div>
      </div>

      {previewMat && <MaterialPreviewModal material={previewMat} onClose={() => setPreviewMat(null)} />}
    </div>
  );
}
