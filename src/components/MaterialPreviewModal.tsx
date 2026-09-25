import { Material, Sede, SEDES } from '../data/mockData';

const CATEGORIA_COLORS: Record<string, { bg: string; accent: string; icon: string }> = {
  'Gas Natural': { bg: 'linear-gradient(135deg, #1D4ED8 0%, #2563EB 50%, #3B82F6 100%)', accent: '#93C5FD', icon: '⬟' },
  'EPP':         { bg: 'linear-gradient(135deg, #D97706 0%, #F59E0B 50%, #FCD34D 100%)', accent: '#FEF3C7', icon: '◉' },
  'Herramientas':{ bg: 'linear-gradient(135deg, #374151 0%, #4B5563 50%, #6B7280 100%)', accent: '#D1D5DB', icon: '⛭' },
  'Señalética':  { bg: 'linear-gradient(135deg, #DC2626 0%, #EF4444 50%, #F87171 100%)', accent: '#FECACA', icon: '△' },
};

const ESTADO_STYLE: Record<string, { bg: string; color: string }> = {
  OK:      { bg: '#CCFBF1', color: '#059669' },
  BAJO:    { bg: '#FEF3C7', color: '#D97706' },
  CRÍTICO: { bg: '#FEE2E2', color: '#DC2626' },
  AGOTADO: { bg: '#F4F4F5', color: '#71717A' },
};

const SEDE_COLOR: Record<Sede, string> = { Chiclayo: '#2563EB', Chimbote: '#059669', Trujillo: '#7C3AED' };

const formatPrecio = (precio: number) =>
  precio > 0
    ? new Intl.NumberFormat('es-PE', {
        style: 'currency',
        currency: 'PEN',
        minimumFractionDigits: 2,
      }).format(precio)
    : 'Sin precio';

function CatIllustration({categoria }: { categoria: string }) {
  const cfg = CATEGORIA_COLORS[categoria] || CATEGORIA_COLORS['Gas Natural'];

  // SVG illustration varies per category
  const svgs: Record<string, React.ReactNode> = {
    'Gas Natural': (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="30" fill="rgba(255,255,255,0.15)" />
        <rect x="28" y="24" width="24" height="32" rx="4" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
        <rect x="33" y="20" width="14" height="8" rx="2" fill="rgba(255,255,255,0.7)"/>
        <path d="M34 36h12M34 41h12M34 46h8" stroke={cfg.bg.includes('1D4ED8') ? '#2563EB' : '#374151'} strokeWidth="2" strokeLinecap="round" style={{filter:'none'}}/>
        <circle cx="50" cy="26" r="4" fill="#FCD34D"/>
        <path d="M50 22v2M50 30v2M46 26h2M54 26h2" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
    'EPP': (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="30" fill="rgba(255,255,255,0.15)" />
        <path d="M22 44c0-9.94 8.06-18 18-18s18 8.06 18 18v4H22v-4z" fill="rgba(255,255,255,0.9)"/>
        <rect x="18" y="44" width="44" height="8" rx="3" fill="rgba(255,255,255,0.7)"/>
        <rect x="30" y="48" width="20" height="4" rx="2" fill="rgba(255,255,255,0.4)"/>
      </svg>
    ),
    'Herramientas': (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="30" fill="rgba(255,255,255,0.15)" />
        <path d="M28 52l16-16M44 36l6-12 6 6-12 6z" stroke="rgba(255,255,255,0.9)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
        <circle cx="30" cy="50" r="6" stroke="rgba(255,255,255,0.9)" strokeWidth="3"/>
        <circle cx="30" cy="50" r="2" fill="rgba(255,255,255,0.7)"/>
      </svg>
    ),
    'Señalética': (
      <svg width="80" height="80" viewBox="0 0 80 80" fill="none">
        <circle cx="40" cy="40" r="30" fill="rgba(255,255,255,0.15)" />
        <path d="M40 20L58 52H22L40 20z" fill="rgba(255,255,255,0.9)" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5"/>
        <path d="M40 32v10M40 45v3" stroke="#DC2626" strokeWidth="3" strokeLinecap="round"/>
      </svg>
    ),
  };

  return (
    <div style={{
      width: '100%',
      height: 200,
      background: cfg.bg,
      borderRadius: '12px 12px 0 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background pattern */}
      <div style={{ position: 'absolute', inset: 0, opacity: 0.08 }}>
        <svg width="100%" height="100%"><defs><pattern id="dots" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1.5" fill="white"/></pattern></defs><rect width="100%" height="100%" fill="url(#dots)"/></svg>
      </div>
      <div style={{ position: 'relative', zIndex: 1 }}>
        {svgs[categoria] || svgs['Gas Natural']}
      </div>
      <div style={{ position: 'absolute', bottom: 12, right: 14, fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: 600, letterSpacing: '0.04em' }}>
        {categoria.toUpperCase()}
      </div>
      <div style={{ position: 'absolute', top: 12, left: 14, background: 'rgba(0,0,0,0.2)', borderRadius: 6, padding: '3px 8px', fontSize: 10.5, color: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(4px)' }}>
        Vista ilustrativa
      </div>
    </div>
  );
}

interface Props {
  material: Material | null;
  onClose: () => void;
}

export default function MaterialPreviewModal({ material, onClose }: Props) {
  if (!material) return null;

  const est = ESTADO_STYLE[material.estado] || ESTADO_STYLE.OK;
  const totalStock = Object.values(material.stockSedes).reduce((a, b) => a + b, 0);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width: 520, maxHeight: '90vh', overflowY: 'auto', padding: 0 }} onClick={e => e.stopPropagation()}>
        {/* Hero image / illustration */}
              {material.imagen ? (
        <div
          style={{
            width: '100%',
            height: 250,
            background: '#F9FAFB',
            borderRadius: '12px 12px 0 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          <img
            src={material.imagen}
            alt={material.nombre}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              padding: 16,
            }}
          />
        </div>
      ) : (
        <CatIllustration categoria={material.categoria} />
      )}

        {/* Header */}
        <div style={{ padding: '18px 22px 0' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <span style={{ fontFamily: 'monospace', fontSize: 11, background: '#DBEAFE', color: '#1D4ED8', padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                  {material.id}
                </span>
                <span style={{ fontSize: 11, background: est.bg, color: est.color, padding: '2px 8px', borderRadius: 4, fontWeight: 700 }}>
                  {material.estado}
                </span>
              </div>
              <h2 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: '#18181B', lineHeight: 1.3 }}>{material.nombre}</h2>
            </div>
            <button onClick={onClose} style={{ background: '#F4F4F5', border: 'none', borderRadius: 8, width: 30, height: 30, cursor: 'pointer', color: '#71717A', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="11" height="11" viewBox="0 0 15 15" fill="none"><path d="M2.5 2.5l10 10M12.5 2.5l-10 10" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/></svg>
            </button>
          </div>
        </div>

        {/* Meta grid */}
        <div style={{ padding: '16px 22px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          {[
            ['Categoría', material.categoria],
            ['Unidad de medida', material.unidad],
            ['Marca / Especificación', material.marca || '—'],
            ['Stock mínimo', `${material.minimo} UND`],
            ['Precio unitario', formatPrecio(material.precioUnitario)],
          ].map(([label, value]) => (
            <div key={label} style={{ background: '#F9FAFB', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ fontSize: 10.5, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#18181B' }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Descripción */}
        <div style={{ padding: '0 22px 16px' }}>
          <div style={{ fontSize: 10.5, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>Descripción técnica</div>
          <p style={{ margin: 0, fontSize: 13, color: '#52525B', lineHeight: 1.65, background: '#F9FAFB', borderRadius: 8, padding: '12px 14px' }}>
            {material.descripcion}
          </p>
        </div>

        {/* Stock por sede */}
        <div style={{ padding: '0 22px 22px' }}>
          <div style={{ fontSize: 10.5, color: '#A1A1AA', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 10 }}>
            Stock por sede — Total: <strong style={{ color: '#18181B' }}>{totalStock} UND</strong>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {SEDES.map(s => {
              const qty = material.stockSedes[s];
              const pct = totalStock > 0 ? (qty / totalStock) * 100 : 0;
              const underMin = qty < Math.ceil(material.minimo / SEDES.length);
              return (
                <div key={s} style={{ flex: 1, background: underMin ? '#FFF5F5' : '#F9FAFB', border: `1px solid ${underMin ? '#FECACA' : '#E4E4E7'}`, borderRadius: 10, padding: '12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: SEDE_COLOR[s], fontWeight: 700, marginBottom: 8 }}>{s}</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: qty === 0 ? '#DC2626' : underMin ? '#D97706' : '#18181B', letterSpacing: '-0.02em' }}>{qty}</div>
                  <div style={{ fontSize: 10.5, color: '#A1A1AA', marginBottom: 8 }}>UND</div>
                  <div style={{ height: 4, background: '#E4E4E7', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: qty === 0 ? '#DC2626' : SEDE_COLOR[s], borderRadius: 4 }} />
                  </div>
                  {qty === 0 && <div style={{ fontSize: 9.5, color: '#DC2626', marginTop: 4, fontWeight: 600 }}>AGOTADO</div>}
                  {qty > 0 && underMin && <div style={{ fontSize: 9.5, color: '#D97706', marginTop: 4, fontWeight: 600 }}>BAJO MÍNIMO</div>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

/* Small trigger button */
export function PreviewBtn({ onClick }: { onClick: (e: React.MouseEvent) => void }) {
  return (
    <button
      title="Vista previa del material"
      onClick={onClick}
      style={{
        width: 36, height: 42, borderRadius: 8,
        border: '1.5px solid #E4E4E7',
        background: '#F9FAFB',
        cursor: 'pointer',
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
        transition: 'all 0.12s',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#DBEAFE'; (e.currentTarget as HTMLElement).style.borderColor = '#93C5FD'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '#F9FAFB'; (e.currentTarget as HTMLElement).style.borderColor = '#E4E4E7'; }}
    >
      <svg width="18" height="18" viewBox="0 0 12 12" fill="none">
        <path d="M1 6s2-3.5 5-3.5S11 6 11 6s-2 3.5-5 3.5S1 6 1 6z" stroke="#2563EB" strokeWidth="1.2" strokeLinecap="round"/>
        <circle cx="6" cy="6" r="1.5" stroke="#2563EB" strokeWidth="1.2"/>
      </svg>
    </button>
  );
}
