import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { DevolucionItem, Entrega, Sede } from '../../data/mockData';
import { useAppStore } from '../../store/AppContext';

interface Props {
  onToast: (msg: string) => void;
  usuario: string;
}

const SEDES: Array<'Todas' | Sede> = ['Todas', 'Chiclayo', 'Chimbote', 'Trujillo'];

function ReturnIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 7H5v-4M5.5 7a8 8 0 1 1-1 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m5 7 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

export default function DevolucionesView({ onToast, usuario }: Props) {
  const { state, dispatch } = useAppStore();
  const [query, setQuery] = useState('');
  const [sede, setSede] = useState<'Todas' | Sede>('Todas');
  const [selected, setSelected] = useState<Entrega | null>(null);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [observaciones, setObservaciones] = useState('');
  const [evidencias, setEvidencias] = useState<File[]>([]);
  const [error, setError] = useState('');

  const evidencePreviews = useMemo(
    () => evidencias.map(file => ({ file, url: URL.createObjectURL(file) })),
    [evidencias],
  );

  useEffect(
    () => () => evidencePreviews.forEach(item => URL.revokeObjectURL(item.url)),
    [evidencePreviews],
  );

  const requirementById = useMemo(
    () => new Map(state.requerimientos.map(item => [item.id, item])),
    [state.requerimientos],
  );

  const returnedByDelivery = useMemo(() => {
    const result = new Map<string, Record<string, number>>();
    state.devoluciones.forEach(devolucion => {
      const current = result.get(devolucion.entregaId) ?? {};
      devolucion.items.forEach(item => {
        current[item.skuId] = (current[item.skuId] ?? 0) + item.cantidad;
      });
      result.set(devolucion.entregaId, current);
    });
    return result;
  }, [state.devoluciones]);

  const deliveries = useMemo(() => state.entregas.filter(entrega => {
    const requirement = requirementById.get(entrega.requerimientoId);
    const searchable = `${entrega.id} ${entrega.requerimientoId} ${entrega.tecnico} ${entrega.proyectoNombre}`.toLowerCase();
    const hasPendingItems = entrega.items.some(item => {
      const returned = returnedByDelivery.get(entrega.id)?.[item.skuId] ?? 0;
      return item.cantidadEntregada - returned > 0;
    });
    return entrega.estado !== 'CANCELADA'
      && hasPendingItems
      && (sede === 'Todas' || requirement?.sede === sede)
      && searchable.includes(query.trim().toLowerCase());
  }), [state.entregas, requirementById, returnedByDelivery, query, sede]);

  const openReturn = (entrega: Entrega) => {
    setSelected(entrega);
    setQuantities({});
    setObservaciones('');
    setEvidencias([]);
    setError('');
  };

  const availableFor = (entrega: Entrega, skuId: string, delivered: number) => {
    const returned = returnedByDelivery.get(entrega.id)?.[skuId] ?? 0;
    return Math.max(0, delivered - returned);
  };

  const submitReturn = (event: FormEvent) => {
    event.preventDefault();
    if (!selected) return;
    const items: DevolucionItem[] = selected.items.map(item => ({
      skuId: item.skuId,
      nombre: item.nombre,
      cantidad: Math.min(quantities[item.skuId] ?? 0, availableFor(selected, item.skuId, item.cantidadEntregada)),
    })).filter(item => item.cantidad > 0);

    if (!items.length) {
      setError('Ingresa al menos una cantidad para registrar la devolución.');
      return;
    }

    dispatch({
      type: 'CREATE_DEVOLUCION',
      payload: {
        entregaId: selected.id,
        responsableRecepcion: usuario,
        items,
        observaciones: observaciones.trim() || undefined,
        evidencias: evidencias.map(file => file.name),
      },
    });
    setSelected(null);
    onToast('Devolución registrada y stock actualizado');
  };

  const totalReturned = state.devoluciones.reduce(
    (sum, item) => sum + item.items.reduce((itemSum, material) => itemSum + material.cantidad, 0),
    0,
  );

  return (
    <div className="returns-page">
      <section className="returns-summary" aria-label="Resumen de devoluciones">
        <div>
          <span>Devoluciones registradas</span>
          <strong>{state.devoluciones.length}</strong>
          <small>movimientos procesados</small>
        </div>
        <div>
          <span>Unidades recuperadas</span>
          <strong>{totalReturned}</strong>
          <small>reintegradas al inventario</small>
        </div>
        <div>
          <span>Entregas disponibles</span>
          <strong>{deliveries.length}</strong>
          <small>con materiales por devolver</small>
        </div>
      </section>

      <section className="panel returns-panel">
        <div className="returns-toolbar">
          <div>
            <h2>Entregas disponibles</h2>
            <p>Registra los materiales que el técnico devuelve al almacén.</p>
          </div>
          <div className="returns-filters">
            <label className="returns-search">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true"><circle cx="6.5" cy="6.5" r="4.5" stroke="currentColor" strokeWidth="1.3"/><path d="m10 10 3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
              <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Buscar entrega o técnico" aria-label="Buscar entrega o técnico" />
            </label>
            <select className="input-field" value={sede} onChange={event => setSede(event.target.value as 'Todas' | Sede)} aria-label="Filtrar por sede">
              {SEDES.map(item => <option key={item}>{item}</option>)}
            </select>
          </div>
        </div>

        {deliveries.length === 0 ? (
          <div className="returns-empty">
            <span><ReturnIcon size={24} /></span>
            <strong>No hay entregas pendientes de devolución</strong>
            <p>Las entregas con unidades disponibles aparecerán aquí.</p>
          </div>
        ) : (
          <div className="returns-table-wrap">
            <table className="data-table returns-table">
              <thead><tr><th>Entrega</th><th>Proyecto</th><th>Técnico</th><th>Sede</th><th>Fecha</th><th>Disponible</th><th>Acción</th></tr></thead>
              <tbody>
                {deliveries.map(entrega => {
                  const requirement = requirementById.get(entrega.requerimientoId);
                  const available = entrega.items.reduce((sum, item) => sum + availableFor(entrega, item.skuId, item.cantidadEntregada), 0);
                  return (
                    <tr key={entrega.id}>
                      <td><strong className="returns-code">{entrega.id}</strong><small>{entrega.requerimientoId}</small></td>
                      <td>{entrega.proyectoNombre}</td>
                      <td>{entrega.tecnico}</td>
                      <td>{requirement?.sede ?? '—'}</td>
                      <td>{entrega.fecha}</td>
                      <td><span className="returns-quantity">{available} UND</span></td>
                      <td><button className="btn btn-primary returns-action" onClick={() => openReturn(entrega)}><ReturnIcon size={14} /> Registrar devolución</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="panel returns-history">
        <div className="section-header"><span className="section-title">Historial de devoluciones</span></div>
        {state.devoluciones.length === 0 ? (
          <div className="returns-history-empty">Aún no se han registrado devoluciones.</div>
        ) : (
          <div className="returns-table-wrap">
            <table className="data-table returns-table">
              <thead><tr><th>ID</th><th>Entrega</th><th>Técnico</th><th>Sede</th><th>Fecha</th><th>Responsable</th><th>Evidencias</th><th>Total</th></tr></thead>
              <tbody>{state.devoluciones.map(item => (
                <tr key={item.id}>
                  <td><strong className="returns-code">{item.id}</strong></td>
                  <td>{item.entregaId}</td>
                  <td>{item.tecnico}</td>
                  <td>{item.sede}</td>
                  <td>{item.fecha} {item.hora}</td>
                  <td>{item.responsableRecepcion}</td>
                  <td>{item.evidencias?.length ?? 0}</td>
                  <td><span className="returns-quantity">{item.items.reduce((sum, material) => sum + material.cantidad, 0)} UND</span></td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      {selected && (
        <div className="modal-overlay" onClick={() => setSelected(null)}>
          <form className="modal returns-modal" onSubmit={submitReturn} onClick={event => event.stopPropagation()}>
            <div className="modal-header">
              <div><small>{selected.id}</small><h2>Devolución del técnico</h2></div>
              <button type="button" className="returns-close" onClick={() => setSelected(null)} aria-label="Cerrar formulario">×</button>
            </div>
            <div className="returns-modal-body">
              <div className="returns-delivery-meta"><span>{selected.tecnico}</span><span>{requirementById.get(selected.requerimientoId)?.sede}</span><span>{selected.fecha}</span></div>
              <div className="returns-items">
                {selected.items.map(item => {
                  const available = availableFor(selected, item.skuId, item.cantidadEntregada);
                  return (
                    <label key={item.skuId} className="returns-item">
                      <span><strong>{item.nombre}</strong><small>{item.skuId} · Disponible: {available} UND</small></span>
                      <input type="number" min="0" max={available} value={quantities[item.skuId] ?? ''} onChange={event => {
                        const value = Math.max(0, Math.min(available, Number(event.target.value) || 0));
                        setQuantities(current => ({ ...current, [item.skuId]: value }));
                        setError('');
                      }} aria-label={`Cantidad devuelta de ${item.nombre}`} />
                    </label>
                  );
                })}
              </div>
              <div className="returns-evidence">
                <div className="returns-evidence-heading">
                  <span>Evidencias fotográficas</span>
                  <small>{evidencias.length ? `${evidencias.length} archivo(s)` : 'Opcional'}</small>
                </div>
                <label className="returns-upload">
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={event => {
                      const selectedFiles = Array.from(event.target.files ?? []);
                      setEvidencias(current => [...current, ...selectedFiles].slice(0, 6));
                      event.target.value = '';
                    }}
                  />
                  <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5M5 14v4a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  <span><strong>Agregar fotografías</strong><small>JPG, PNG o WEBP · máximo 6 archivos</small></span>
                </label>
                {evidencePreviews.length > 0 && (
                  <div className="returns-evidence-grid">
                    {evidencePreviews.map(({ file, url }, index) => (
                      <figure key={`${file.name}-${file.lastModified}-${index}`}>
                        <img src={url} alt={`Evidencia ${index + 1}`} />
                        <button type="button" onClick={() => setEvidencias(current => current.filter((_, itemIndex) => itemIndex !== index))} aria-label={`Quitar evidencia ${file.name}`}>×</button>
                        <figcaption>{file.name}</figcaption>
                      </figure>
                    ))}
                  </div>
                )}
              </div>
              <label className="returns-notes"><span>Motivo u observaciones del técnico</span><textarea value={observaciones} onChange={event => setObservaciones(event.target.value)} placeholder="Ej. Material no utilizado, sobrante o reemplazado" rows={3} /></label>
              {error && <div className="auth-error" role="alert">{error}</div>}
            </div>
            <div className="returns-modal-actions"><button type="button" className="btn btn-ghost" onClick={() => setSelected(null)}>Cancelar</button><button type="submit" className="btn btn-primary">Registrar devolución</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
