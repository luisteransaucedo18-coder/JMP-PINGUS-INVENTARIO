import { useEffect, useState } from 'react';
import { loadValuations } from '../../services/valorizacionService';
import { money, type Valuation } from '../../features/valorizaciones/domain';
import '../../features/valorizaciones/valorizaciones.css';

export default function TesoreriaDashboard({ onNav }: { onNav: (view: string) => void }) {
  const [rows, setRows] = useState<Valuation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    void loadValuations().then(data => { if (active) setRows(data); })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : 'No se pudieron cargar los pendientes.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]);
  const reviewing = rows.filter(v => v.estado === 'EN_TESORERIA');
  const held = rows.filter(v => v.estado === 'RETENIDA');
  const management = rows.filter(v => v.estado === 'EN_GERENCIA');
  const authorized = rows.filter(v => v.estado === 'AUTORIZADA');
  return <main className="valuation-view" aria-busy={loading}>
    <header className="valuation-heading">
      <div><p className="valuation-eyebrow">TESORERÍA</p><h1>Mi panel de pendientes</h1><p>Revisión de expedientes y registro de pagos autorizados a técnicos.</p></div>
      <button className="btn btn-ghost" disabled={loading} onClick={() => setAttempt(n => n + 1)}>Actualizar pendientes</button>
    </header>
    <section className="panel valuation-form"><h2>Alcance inicial del rol</h2><p>Esta estructura reúne las funciones de valorización acordadas hasta ahora. Las funciones adicionales se definirán en la reunión de Tesorería.</p></section>
    {error && <p className="valuation-error" role="alert">{error}</p>}
    {loading ? <p role="status">Cargando pendientes de Tesorería…</p> : !error && <>
      <div className="valuation-kpis" data-tour="dashboard-summary">
        <div className="panel"><span>Expedientes por revisar</span><strong>{reviewing.length}</strong></div>
        <div className="panel"><span>Valorizaciones retenidas</span><strong>{held.length}</strong></div>
        <div className="panel"><span>Pendientes del gerente</span><strong>{management.length}</strong></div>
        <div className="panel"><span>Autorizado pendiente de pago</span><strong>{money(authorized.reduce((sum, v) => sum + v.neto, 0))}</strong><small>{authorized.length} pago(s) autorizado(s)</small></div>
      </div>
      <section className="panel valuation-form"><h2>Trabajos y valorizaciones</h2><p>Revisa documentos y devoluciones, guarda descuentos, carga la valorización firmada y el recibo por honorarios, y solicita autorización al gerente. Registra el pago una vez realizado.</p><div className="valuation-actions"><button className="btn btn-primary" onClick={() => onNav('valorizaciones')}>Abrir expedientes de valorización</button></div></section>
    </>}
    <section className="panel valuation-form"><h2>Mi cuenta y ayuda</h2><p>Actualiza tus datos personales o consulta las instrucciones del flujo de Tesorería.</p><div className="valuation-actions"><button className="btn btn-ghost" onClick={() => onNav('perfil')}>Mi perfil</button><button className="btn btn-ghost" onClick={() => onNav('manual')}>Manual de Tesorería</button></div></section>
  </main>;
}
