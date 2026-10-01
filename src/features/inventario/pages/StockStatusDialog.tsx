import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';
import { SEDES, type Material } from '../../../domain/types';
import { estadoPorSede } from '../../../utils/inventoryStatus';

const COLORS = { OK: '#059669', BAJO: '#D97706', 'CRÍTICO': '#DC2626', AGOTADO: '#71717A' };
const LABELS = { OK: 'Disponible', BAJO: 'Stock bajo', 'CRÍTICO': 'Crítico', AGOTADO: 'Agotado' };

export default function StockStatusDialog({ material, onClose }: { material: Material; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => { dialog?.close(); };
  }, []);
  const unit = material.unidad || 'UND';
  const number = (value: number) => value.toLocaleString('es-PE');
  return createPortal(
    <dialog ref={dialogRef} className="stock-state-dialog" aria-labelledby={titleId}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const rect = event.currentTarget.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose();
      }}>
      <header className="stock-state-heading">
        <div><h2 id={titleId}>Estado por sede</h2><p>{material.id} · {material.nombre}</p></div>
        <button type="button" className="stock-state-close" aria-label="Cerrar estados" onClick={onClose} autoFocus>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>
        </button>
      </header>
      <div className="stock-state-reference"><span>Mínimo por sede</span><strong>{number(material.minimo)} <small>{unit}</small></strong></div>
      <div className="stock-state-list">
        {SEDES.map(sede => {
          const stock = Number(material.stockSedes[sede] ?? 0);
          const estado = estadoPorSede(material, sede);
          const color = COLORS[estado];
          const coverage = material.minimo > 0 ? Math.min(100, stock / material.minimo * 100) : stock > 0 ? 100 : 0;
          return <section key={sede} className="stock-state-row" aria-label={`${sede}: ${LABELS[estado]}, ${stock} ${unit}`}>
            <div className="stock-state-row-top"><h3>{sede}</h3><span className="stock-state-label" style={{ color }}><i style={{ background: color }} />{LABELS[estado]}</span></div>
            <div className="stock-state-quantity"><strong>{number(stock)}</strong><span>{unit} disponibles</span></div>
            <div className="stock-state-track" aria-hidden="true"><div style={{ width: `${coverage}%`, background: color }} /></div>
            <p>{stock === 0 ? 'Sin existencias en esta sede' : stock < material.minimo ? `Faltan ${number(material.minimo - stock)} ${unit} para el mínimo` : 'Mínimo cubierto'}</p>
          </section>;
        })}
      </div>
      <footer className="stock-state-ranges">
        <h3>Cómo se calcula</h3>
        <dl>
          <div><dt>Agotado</dt><dd>0 {unit}</dd></div>
          <div><dt>Crítico</dt><dd>Más de 0 y menos de {number(material.minimo)}</dd></div>
          <div><dt>Stock bajo</dt><dd>{number(material.minimo)} a {number(material.minimo * 1.5)} {unit} (con stock)</dd></div>
          <div><dt>Disponible</dt><dd>Más de {number(material.minimo * 1.5)} {unit}</dd></div>
        </dl>
      </footer>
    </dialog>, document.body,
  );
}
