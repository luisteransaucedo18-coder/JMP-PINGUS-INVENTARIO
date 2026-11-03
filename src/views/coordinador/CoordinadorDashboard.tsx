import { publicCode } from "../../utils/publicCode";
import { SEDE_COLOR } from "../../config/visualTokens";
import { useAppStore } from "../../store/AppContext";
import { SEDES } from "../../domain/types";
import { obtenerFaltantesRequerimiento } from "../../utils/requirementStock";
import { QuotationSummary } from "../../features/cotizaciones/CotizacionesView";

interface Props { onNav: (view: string) => void; }

export default function CoordinadorDashboard({ onNav }: Props) {
  const { state } = useAppStore();
  const pendientes = state.requerimientos.filter(r => r.estado === "ENVIADO");
  const alertas = state.materials.filter(m => m.estado !== "OK");
  const alertasVisibles = alertas.slice(0, 4);
  const requerimientosSinStock = pendientes.filter(
    requirement => obtenerFaltantesRequerimiento(requirement, state.materials).length > 0,
  );

  const cards = [
    { label: "Por confirmar", value: pendientes.length, hint: "Solicitudes enviadas", view: "requerimientos", tone: "amber" },
    { label: "Necesitan abastecimiento", value: requerimientosSinStock.length, hint: "Compra o traslado", view: "requerimientos", tone: "orange" },
    { label: "SKU en catálogo", value: state.materials.length, hint: "Materiales registrados", view: "inventario", tone: "blue" },
    { label: "Alertas de stock", value: alertas.length, hint: "Bajo, crítico o agotado", view: "inventario", tone: "red" },
  ];

  return (
    <div className="analyst-workspace coordinator-workspace">
      <header className="analyst-workspace-heading">
        <div>
          <h2>Trabajo de coordinación</h2>
          <p>
            {pendientes.length
              ? `${pendientes.length} ${pendientes.length === 1 ? "solicitud requiere" : "solicitudes requieren"} revisión.`
              : "No hay solicitudes pendientes de revisión."}
          </p>
        </div>
        <div className="analyst-workspace-actions">
          <button type="button" className="btn btn-ghost" onClick={() => onNav("transporte")}>
            Transporte interno
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onNav("requerimientos")}>
            Revisar requerimientos
          </button>
        </div>
      </header>

      <div className="analyst-status-grid coordinator-status-grid" data-tour="dashboard-summary">
        {cards.map(card => (
          <button
            type="button"
            key={card.label}
            className="kpi-card analyst-status-card coordinator-status-card"
            data-tone={card.tone}
            aria-label={`${card.label}: ${card.value}. ${card.hint}`}
            onClick={() => onNav(card.view)}
          >
            <span>{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.hint}</small>
          </button>
        ))}
      </div>

      <div className="coordinator-dashboard-body">
        <div className="coordinator-main-column">
          <section className="panel analyst-requests coordinator-requests" aria-labelledby="coordinator-requests-title">
            <div className="section-header">
              <div>
                <h3 id="coordinator-requests-title">{pendientes.length ? "Solicitudes para revisar" : "Solicitudes recientes"}</h3>
                {pendientes.length > 0 && <p>Revisa disponibilidad y atiende primero las solicitudes que necesitan abastecimiento.</p>}
              </div>
              <button type="button" className="btn btn-ghost" onClick={() => onNav("requerimientos")}>
                Ver todas{pendientes.length ? ` (${pendientes.length})` : ""}
              </button>
            </div>

            {pendientes.length === 0 ? (
              <div className="analyst-empty coordinator-empty">
                <span className="analyst-empty-icon" aria-hidden="true">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                    <path d="m5 12 4 4L19 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <h4>Todo está al día</h4>
                <p>Las solicitudes que envíen los analistas aparecerán aquí para su revisión.</p>
                <button type="button" className="btn btn-ghost" onClick={() => onNav("requerimientos")}>
                  Consultar requerimientos
                </button>
              </div>
            ) : (
              <div className="coordinator-request-list">
                <div className="coordinator-request-columns" aria-hidden="true">
                  <span>Solicitud y proyecto</span>
                  <span>Analista y técnico</span>
                  <span>Sede</span>
                  <span>Fecha</span>
                  <span>Acción</span>
                </div>
                <ul>
                  {pendientes.map(r => {
                    const shortages = obtenerFaltantesRequerimiento(r, state.materials).length;
                    return (
                      <li key={r.id} className="coordinator-request-row">
                        <div className="analyst-request-project">
                          <span>{publicCode(r)}</span>
                          <strong>{r.proyecto}</strong>
                          <small className={shortages ? "coordinator-shortage" : "coordinator-covered"}>
                            {shortages ? `${shortages} material${shortages === 1 ? " necesita" : "es necesitan"} abastecimiento` : "Stock disponible"}
                          </small>
                        </div>
                        <div className="coordinator-request-people">
                          <strong>{r.analista}</strong>
                          <span>Técnico: {r.tecnico}</span>
                          <span>{r.materiales.length} materiales</span>
                        </div>
                        <span className="coordinator-request-site" style={{ color: SEDE_COLOR[r.sede] }}>{r.sede}</span>
                        <time dateTime={r.fecha}>{r.fecha}</time>
                        <button type="button" className="btn btn-ghost" onClick={() => onNav("requerimientos")}>
                          Revisar
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </section>

          <section className="panel coordinator-alerts-panel" aria-labelledby="coordinator-alerts-title">
            <div className="section-header">
              <div>
                <h3 id="coordinator-alerts-title">Alertas de inventario</h3>
                <p>{alertas.length ? `Mostrando ${alertasVisibles.length} de ${alertas.length} materiales con alerta.` : "No hay materiales bajo el mínimo."}</p>
              </div>
              <div className="coordinator-alert-heading-actions">
                <span className="badge badge-red">{alertas.length}</span>
                <button type="button" className="btn btn-ghost" onClick={() => onNav("inventario")}>
                  Ver inventario completo
                </button>
              </div>
            </div>
            <div className="coordinator-alerts-list">
              {alertasVisibles.map(m => {
                const total = Object.values(m.stockSedes).reduce((sum, stock) => sum + stock, 0);
                return (
                  <div key={m.id} className="coordinator-alert-item">
                    <div className="coordinator-alert-indicator" data-state={m.estado} />
                    <div className="coordinator-alert-content">
                      <div className="coordinator-alert-heading">
                        <div>
                          <div className="coordinator-alert-name">{m.nombre}</div>
                          <div className="coordinator-alert-sku">SKU {m.id} · Mínimo: {m.minimo} {m.unidad}</div>
                        </div>
                        <span className={`badge status-badge badge-${m.estado === "AGOTADO" || m.estado === "CRÍTICO" ? "red" : "amber"}`}>
                          {m.estado}
                        </span>
                      </div>
                      <div className="coordinator-alert-stock-summary">
                        <strong>Total {total} {m.unidad}</strong>
                        {SEDES.map(sede => (
                          <span key={sede}>{sede}: {m.stockSedes[sede] ?? 0}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
              {alertas.length === 0 && <div className="coordinator-alert-empty">Sin alertas activas</div>}
            </div>
          </section>
        </div>

        <aside className="coordinator-side-panels" aria-label="Accesos y resumen">
          <QuotationSummary onNav={onNav} />
          <section className="panel coordinator-shortcuts-panel" aria-labelledby="coordinator-shortcuts-title">
            <div className="section-header"><h3 id="coordinator-shortcuts-title">Accesos rápidos</h3></div>
            <div className="coordinator-shortcuts">
              <button type="button" className="btn btn-ghost" onClick={() => onNav("manual")}>Manual de usuario</button>
              <button type="button" className="btn btn-ghost" onClick={() => onNav("requerimientos")}>Revisar requerimientos</button>
              <button type="button" className="btn btn-ghost" onClick={() => onNav("compras")}>Gestionar compras</button>
            </div>
          </section>
          <section className="panel coordinator-sites-panel" aria-labelledby="coordinator-sites-title">
            <div className="section-header"><h3 id="coordinator-sites-title">Solicitudes por sede</h3></div>
            <div className="coordinator-sites-list">
              {SEDES.map(sede => {
                const count = pendientes.filter(r => r.sede === sede).length;
                return (
                  <div key={sede} className="coordinator-site-row">
                    <span className="coordinator-site-dot" style={{ background: SEDE_COLOR[sede] }} />
                    <span>{sede}</span>
                    <strong>{count}</strong>
                    <small>{count === 1 ? "pendiente" : "pendientes"}</small>
                  </div>
                );
              })}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
