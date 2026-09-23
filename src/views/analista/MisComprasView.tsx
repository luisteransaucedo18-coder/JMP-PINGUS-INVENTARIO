import { useState } from 'react';
import { useAppStore } from '../../store/AppContext';
import { EstadoCompra } from '../../data/mockData';

interface Props { usuario: string; onNav: (v: string) => void; }

const E_COLOR: Record<EstadoCompra, string> = { BORRADOR: '#8B8FA8', ENVIADO: '#D97706', APROBADO: '#2563EB', COMPRADO: '#059669', RECHAZADO: '#DC2626' };
const E_BG:    Record<EstadoCompra, string> = { BORRADOR: '#F4F4F5', ENVIADO: '#FEF3C7', APROBADO: '#DBEAFE', COMPRADO: '#CCFBF1', RECHAZADO: '#FEE2E2' };
const E_LABEL: Record<EstadoCompra, string> = { BORRADOR: 'Borrador', ENVIADO: 'Enviado', APROBADO: 'Aprobado', COMPRADO: 'Comprado', RECHAZADO: 'Rechazado' };

export default function MisComprasView({ usuario, onNav }: Props) {
  const { state } = useAppStore();
  const [filter, setFilter] = useState<EstadoCompra | ''>('');

  const mis = state.compras
    .filter(c => c.analista === usuario && (!filter || c.estado === filter))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));

  const [selected, setSelected] = useState<string | null>(null);
  const det = state.compras.find(c => c.id === selected);

  const totalEst = (items: typeof mis[0]['items']) =>
    items.reduce((s, it) => s + it.cantidadSolicitada * (it.precioUnitario ?? 0), 0);

  return (
    <div style={{ padding: 24, overflowY: 'auto', flex: 1, background: '#EEF0FF' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
          {(['ENVIADO','APROBADO','COMPRADO','RECHAZADO'] as EstadoCompra[]).map(e => {
            const cnt = state.compras.filter(c => c.analista === usuario && c.estado === e).length;
            return (
              <div key={e} className="kpi-card" style={{ cursor: 'pointer', outline: filter === e ? `2px solid ${E_COLOR[e]}` : 'none' }} onClick={() => setFilter(filter === e ? '' : e)}>
                <div style={{ fontSize: 26, fontWeight: 800, color: E_COLOR[e], letterSpacing: '-0.03em' }}>{cnt}</div>
                <div style={{ fontSize: 11.5, color: '#8B8FA8', marginTop: 5 }}>{E_LABEL[e]}</div>
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={() => onNav('nueva-compra')}>
            + Nueva solicitud de compra
          </button>
        </div>

        <div className="panel">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #F0F2FF', display: 'flex', alignItems: 'center', gap: 10 }}>
            <select className="select-field" value={filter} onChange={e => setFilter(e.target.value as EstadoCompra | '')}>
              <option value="">Todos los estados</option>
              {(['ENVIADO','APROBADO','COMPRADO','RECHAZADO','BORRADOR'] as EstadoCompra[]).map(e =>
                <option key={e} value={e}>{E_LABEL[e]}</option>
              )}
            </select>
            <div style={{ marginLeft: 'auto', fontSize: 12, color: '#8B8FA8' }}>{mis.length} órdenes</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead><tr><th>ID</th><th>Sede</th><th>Items</th><th>Total est.</th><th>Fecha</th><th>Estado</th><th></th></tr></thead>
              <tbody>
                {mis.length === 0 ? (
                  <tr className="empty-state-row"><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: '#8B8FA8' }}>
                    Sin órdenes. <button onClick={() => onNav('nueva-compra')} style={{ background: 'none', border: 'none', color: '#2563EB', cursor: 'pointer', fontWeight: 600, fontSize: 13 }}>Crear una →</button>
                  </td></tr>
                ) : mis.map(c => (
                  <tr key={c.id} style={{ cursor: 'pointer' }} onClick={() => setSelected(selected === c.id ? null : c.id)}>
                    <td style={{ fontFamily: 'monospace', fontSize: 11.5, color: '#2563EB', fontWeight: 700 }}>{c.id}</td>
                    <td><span style={{ fontSize: 11.5, fontWeight: 700, color: '#2563EB', background: '#DBEAFE', borderRadius: 6, padding: '2px 8px' }}>{c.sede}</span></td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{c.items.length}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{totalEst(c.items) > 0 ? `S/. ${totalEst(c.items).toFixed(2)}` : <span style={{ color: '#C4C6D8' }}>—</span>}</td>
                    <td style={{ fontFamily: 'monospace', fontSize: 11, color: '#8B8FA8' }}>{c.fecha}</td>
                    <td><span className="status-badge" style={{ background: E_BG[c.estado], color: E_COLOR[c.estado] }}>{E_LABEL[c.estado]}</span></td>
                    <td style={{ fontSize: 12, color: '#2563EB', fontWeight: 600 }}>{selected === c.id ? '▲' : '▼'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Expanded detail */}
        {det && (
          <div style={{ background: '#fff', borderRadius: 20, boxShadow: '0 4px 24px rgba(99,102,241,0.09)', overflow: 'hidden' }}>
            <div style={{ padding: '18px 24px', borderBottom: '1px solid #F0F2FF', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: '#1A1D23' }}>{det.id} · Detalle de la orden</div>
                <div style={{ fontSize: 12, color: '#8B8FA8', marginTop: 3 }}>{det.motivo}</div>
              </div>
              {/* Timeline pills */}
              <div style={{ display: 'flex', gap: 6 }}>
                {[
                  { label: 'Creado', done: true, date: det.fecha },
                  { label: 'Aprobado', done: !!det.fechaAprobacion, date: det.fechaAprobacion },
                  { label: 'Comprado', done: !!det.fechaCompra, date: det.fechaCompra },
                ].map((s, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {i > 0 && <div style={{ width: 18, height: 2, background: s.done ? '#2563EB' : '#E8EAFF', borderRadius: 1 }} />}
                    <div style={{ background: s.done ? '#2563EB' : '#F0F2FF', color: s.done ? '#fff' : '#C4C6D8', borderRadius: 7, padding: '3px 8px', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {s.label}{s.date ? ` · ${s.date}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <table className="data-table">
              <thead><tr><th>SKU</th><th>Material</th><th>Cant. solicitada</th><th>Precio unit.</th><th>Subtotal</th></tr></thead>
              <tbody>
                {det.items.map((it, i) => (
                  <tr key={i}>
                    <td style={{ fontFamily: 'monospace', fontSize: 10.5, color: '#2563EB' }}>{it.skuId || '—'}</td>
                    <td style={{ fontSize: 12.5, fontWeight: 500 }}>{it.nombre}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{it.cantidadSolicitada} UND</td>
                    <td style={{ fontFamily: 'monospace', color: '#8B8FA8' }}>{it.precioUnitario ? `S/. ${it.precioUnitario.toFixed(2)}` : '—'}</td>
                    <td style={{ fontFamily: 'monospace', fontWeight: 700, color: '#2563EB' }}>{it.precioUnitario ? `S/. ${(it.cantidadSolicitada * it.precioUnitario).toFixed(2)}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {det.observaciones && (
              <div style={{ padding: '12px 20px', background: '#FFFBEB', borderTop: '1px solid #F0F2FF', fontSize: 12.5, color: '#92400E' }}>
                <strong>Observación del coordinador:</strong> {det.observaciones}
              </div>
            )}
            {det.notaCompra && (
              <div style={{ padding: '12px 20px', background: '#F0FDF4', borderTop: '1px solid #F0F2FF', fontSize: 12.5, color: '#15803D' }}>
                <strong>Nota de compra:</strong> {det.notaCompra}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
