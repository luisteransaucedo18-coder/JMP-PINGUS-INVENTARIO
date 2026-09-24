import { useEffect, useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { SEDES, Sede } from '../../data/mockData';
import MaterialPreviewModal, { PreviewBtn } from '../../components/MaterialPreviewModal';
import { Material, CompraItem } from '../../data/mockData';
import { obtenerMateriales } from '../../service/materialService';


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
  const [materiales, setMateriales] = useState<Material[]>([]);
  const [loadingMateriales, setLoadingMateriales] = useState(true);

  /* Materials by estado for quick add */
    const criticos = materiales.filter((m) => {
      const stock = m.stockSedes[sede] ?? 0;

      return (
        (m.estado === 'CRÍTICO' || m.estado === 'AGOTADO') &&
        stock < m.minimo
      );
    });

    const bajos = materiales.filter((m) => {
      const stock = m.stockSedes[sede] ?? 0;

      return (
        m.estado === 'BAJO' &&
        stock < m.minimo
      );
    });

    const getMatches = (query: string) => {
      const q = query.trim().toLowerCase();

      if (q.length < 2) {
        return [];
      }

      return materiales
        .filter((m) => {
          const sku = m.id?.toLowerCase() ?? '';
          const nombre = m.nombre?.toLowerCase() ?? '';
          const categoria = m.categoria?.toLowerCase() ?? '';

          return (
            sku.includes(q) ||
            nombre.includes(q) ||
            categoria.includes(q)
          );
        })
        .slice(0, 8);
    };

    const selectMat = (idx: number, mat: Material) => {
      const stockActual = mat.stockSedes[sede] ?? 0;
      const deficit = Math.max(0, mat.minimo - stockActual);

      setItems((prev) =>
        prev.map((item, i) =>
          i !== idx
            ? item
            : {
                ...item,
                skuId: mat.id,
                nombre: mat.nombre,
                cantidadSolicitada: deficit > 0 ? deficit : 1,
                query: `${mat.id} — ${mat.nombre}`,
                showDrop: false,
              }
        )
      );
    };

      const quickAdd = (mat: Material) => {
        const stockActual = mat.stockSedes[sede] ?? 0;

        const deficit = Math.max(
          1,
          mat.minimo - stockActual
        );

        const exists = items.some(
          (item) => item.skuId === mat.id
        );

        if (exists) {
          onToast('⚠ El material ya está en la lista');
          return;
        }

        setItems((prev) => [
          ...prev.filter(
            (item) => item.skuId || item.nombre
          ),
          {
            skuId: mat.id,
            nombre: mat.nombre,
            cantidadSolicitada: deficit,
            precioUnitario: undefined,
            query: `${mat.id} — ${mat.nombre}`,
            showDrop: false,
          },
        ]);
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

  useEffect(() => {
  const cargarMateriales = async () => {
    try {
      setLoadingMateriales(true);

      const data = await obtenerMateriales();

      console.log('Materiales para compra:', data);

      setMateriales(data ?? []);
    } catch (error) {
      console.error('Error cargando materiales:', error);
      onToast('Error al cargar los materiales');
    } finally {
      setLoadingMateriales(false);
    }
  };

  cargarMateriales();
}, []);

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
                          <span className="status-badge" style={{ background: ESTADO_BG[mat.estado], color: ESTADO_COLOR[mat.estado], fontSize: 10.5 }}>{mat.estado}</span>
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
  {/* Cabecera de sección */}
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 12,
    }}
  >
    <div
      style={{
        fontSize: 12,
        fontWeight: 700,
        color: '#8B8FA8',
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      Materiales a comprar
    </div>

    <button
      className="btn btn-ghost"
      style={{ fontSize: 12 }}
      onClick={addItem}
    >
      + Agregar material
    </button>
  </div>

  {/* Error */}
  {errors.items && (
    <div
      style={{
        background: '#FEE2E2',
        border: '1px solid #FECACA',
        borderRadius: 10,
        padding: '8px 14px',
        fontSize: 12,
        color: '#DC2626',
        marginBottom: 10,
      }}
    >
      {errors.items}
    </div>
  )}

  {/* Encabezados */}
  <div
    style={{
      display: 'grid',

      gridTemplateColumns:
        'minmax(300px, 1fr) 100px 130px 120px 40px',

      gap: 10,
      alignItems: 'center',

      padding: '0 4px',
      marginBottom: 7,
    }}
  >
    {[
      'Material',
      'Cantidad',
      'Precio unit. (S/.)',
      'Stock actual',
      '',
    ].map((h, i) => (
      <div
        key={i}
        style={{
          fontSize: 10.5,
          fontWeight: 600,
          color: '#8B8FA8',
          textTransform: 'uppercase',
          letterSpacing: '0.05em',

          textAlign:
            i === 0
              ? 'left'
              : 'center',
        }}
      >
        {h}
      </div>
    ))}
  </div>

  {/* Filas */}
  {items.map((item, i) => {
    const mat = materiales.find(
      (m) => m.id === item.skuId
    );

    const stock = mat
      ? mat.stockSedes[sede]
      : null;

    const matches = getMatches(
      item.query
    );

    return (
      <div
        key={i}
        style={{
          display: 'grid',

          // MISMAS COLUMNAS QUE EL HEADER
          gridTemplateColumns:
            'minmax(300px, 1fr) 100px 130px 120px 40px',

          gap: 10,

          // IMPORTANTE PARA ALINEAR TODO
          alignItems: 'center',

          marginBottom: 10,
        }}
      >
                {/* =========================================
                    MATERIAL
                ========================================= */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    minWidth: 0,
                  }}
                >
                  {item.skuId ? (
                    <div
                      style={{
                        width: '100%',
                        height: 42,
                        boxSizing: 'border-box',

                        display: 'flex',
                        alignItems: 'center',

                        gap: 8,

                        background: '#F0FDF4',
                        border: '1.5px solid #BBF7D0',
                        borderRadius: 10,

                        padding: '0 12px',
                      }}
                    >
                      <div
                        style={{
                          flex: 1,
                          minWidth: 0,
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            color: '#18181B',

                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {item.nombre}
                        </div>

                        <div
                          style={{
                            fontSize: 10,
                            color: '#8B8FA8',
                            fontFamily: 'monospace',
                          }}
                        >
                          {item.skuId}
                        </div>
                      </div>

                      {mat && (
                        <PreviewBtn
                          onClick={(e) => {
                            e.stopPropagation();
                            setPreviewMat(mat);
                          }}
                        />
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          updateQuery(i, '')
                        }
                        style={{
                          width: 24,
                          height: 24,

                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',

                          background: 'transparent',
                          border: 'none',

                          cursor: 'pointer',
                          color: '#8B8FA8',
                          fontSize: 14,

                          padding: 0,
                          flexShrink: 0,
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <input
                      className="input-field"
                      placeholder="Buscar por nombre o SKU…"
                      value={item.query}

                      style={{
                        width: '100%',
                        height: 42,
                        boxSizing: 'border-box',
                      }}

                      onChange={(e) =>
                        updateQuery(
                          i,
                          e.target.value
                        )
                      }

                      onFocus={() =>
                        setItems((p) =>
                          p.map((it, j) =>
                            j !== i
                              ? it
                              : {
                                  ...it,
                                  showDrop: true,
                                }
                          )
                        )
                      }

                      onBlur={() =>
                        setTimeout(
                          () => closeDrop(i),
                          150
                        )
                      }
                    />
                  )}

                  {/* AUTOCOMPLETE */}
                  {!item.skuId &&
                    item.showDrop &&
                    item.query.length >= 2 && (
                      <div
                        style={{
                          position: 'absolute',

                          zIndex: 50,

                          top: 'calc(100% + 4px)',
                          left: 0,
                          right: 0,

                          background: '#fff',

                          border:
                            '1px solid #E8EAFF',

                          borderRadius: 12,

                          boxShadow:
                            '0 8px 24px rgba(99,102,241,0.15)',

                          overflow: 'hidden',
                        }}
                      >
                        {matches.map((m) => (
                          <div
                            key={m.id}

                            onMouseDown={() =>
                              selectMat(i, m)
                            }

                            style={{
                              padding:
                                '9px 14px',

                              cursor:
                                'pointer',

                              borderBottom:
                                '1px solid #F0F2FF',

                              display:
                                'flex',

                              alignItems:
                                'center',

                              gap: 10,
                            }}

                            onMouseEnter={(e) =>
                              (
                                e.currentTarget as HTMLElement
                              ).style.background =
                                '#F8F9FF'
                            }

                            onMouseLeave={(e) =>
                              (
                                e.currentTarget as HTMLElement
                              ).style.background =
                                ''
                            }
                          >
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              <div
                                style={{
                                  fontSize: 12.5,
                                  fontWeight: 600,
                                  color: '#1A1D23',
                                }}
                              >
                                {m.nombre}
                              </div>

                              <div
                                style={{
                                  fontSize: 10.5,
                                  color: '#8B8FA8',
                                  fontFamily:
                                    'monospace',
                                }}
                              >
                                {m.id} ·{' '}
                                {m.categoria}
                              </div>
                            </div>

                            <span
                              className="status-badge"

                              style={{
                                color:
                                  ESTADO_COLOR[
                                    m.estado
                                  ],

                                background:
                                  ESTADO_BG[
                                    m.estado
                                  ],

                                flexShrink: 0,
                              }}
                            >
                              {m.estado}
                            </span>
                          </div>
                        ))}

                        {matches.length ===
                          0 && (
                          <div
                            style={{
                              padding:
                                '10px 14px',

                              fontSize:
                                12.5,

                              color:
                                '#8B8FA8',
                            }}
                          >
                            No se encontraron
                            materiales registrados.
                          </div>
                        )}
                      </div>
                    )}
                </div>

                {/* =========================================
                    CANTIDAD
                ========================================= */}
                <div
                  style={{
                    width: '100%',
                    height: 42,

                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <input
                    className="input-field"
                    type="number"
                    min="1"
                    placeholder="0"

                    value={
                      item.cantidadSolicitada ||
                      ''
                    }

                    onChange={(e) =>
                      setItems((p) =>
                        p.map((it, j) =>
                          j !== i
                            ? it
                            : {
                                ...it,

                                cantidadSolicitada:
                                  parseInt(
                                    e.target.value
                                  ) || 0,
                              }
                        )
                      )
                    }

                    style={{
                      width: '100%',
                      height: 42,

                      boxSizing:
                        'border-box',

                      textAlign:
                        'center',
                    }}
                  />
                </div>

                {/* =========================================
                    PRECIO
                ========================================= */}
                <div
                  style={{
                    position: 'relative',
                    width: '100%',
                    height: 42,
                  }}
                >
                  <span
                    style={{
                      position: 'absolute',

                      left: 10,
                      top: '50%',

                      transform:
                        'translateY(-50%)',

                      fontSize: 12,
                      color: '#8B8FA8',

                      zIndex: 1,
                    }}
                  >
                    S/.
                  </span>

                  <input
                    className="input-field"
                    type="number"

                    min="0"
                    step="0.01"

                    placeholder="0.00"

                    value={
                      item.precioUnitario ??
                      ''
                    }

                    onChange={(e) =>
                      setItems((p) =>
                        p.map((it, j) =>
                          j !== i
                            ? it
                            : {
                                ...it,

                                precioUnitario:
                                  parseFloat(
                                    e.target.value
                                  ) ||
                                  undefined,
                              }
                        )
                      )
                    }

                    style={{
                      width: '100%',
                      height: 42,

                      boxSizing:
                        'border-box',

                      paddingLeft: 34,

                      textAlign:
                        'right',
                    }}
                  />
                </div>

                {/* =========================================
                    STOCK
                ========================================= */}
                <div
                  style={{
                    width: '100%',
                    height: 42,

                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',

                    borderRadius: 8,

                    background:
                      stock === null
                        ? '#F9FAFB'
                        : stock === 0
                          ? '#FEF2F2'
                          : '#F0FDF4',

                    fontFamily:
                      'monospace',

                    fontSize: 12,
                    fontWeight: 700,

                    color:
                      stock === null
                        ? '#C4C6D8'
                        : stock === 0
                          ? '#DC2626'
                          : stock <
                              (mat?.minimo ??
                                0)
                            ? '#D97706'
                            : '#059669',

                    boxSizing:
                      'border-box',
                  }}
                >
                  {stock === null
                    ? '—'
                    : `${stock} UND`}
                </div>

                {/* =========================================
                    ELIMINAR
                ========================================= */}
                <div
                  style={{
                    width: 40,
                    height: 42,

                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <button
                    type="button"

                    onClick={() =>
                      removeItem(i)
                    }

                    style={{
                      width: 32,
                      height: 32,

                      borderRadius: 8,

                      border:
                        '1px solid #FCA5A5',

                      background:
                        '#DC2626',

                      cursor:
                        'pointer',

                      color: '#FFFFFF',

                      fontSize: 18,

                      display: 'flex',

                      alignItems:
                        'center',

                      justifyContent:
                        'center',

                      padding: 0,
                    }}
                  >
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
