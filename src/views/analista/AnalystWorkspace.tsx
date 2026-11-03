import { useState } from "react"

import { publicCode } from "../../utils/publicCode"

import AnalistaHelpCenter from "../../components/AnalistaHelpCenter"

import {
  analystDashboardModel,
  REQUEST_LABELS,
  REQUEST_ACTIONS,
  REQUEST_BADGES,
  type RequestIntent,
  type RequestState,
} from "./dashboardModel"

interface Props {
  data: ReturnType<typeof analystDashboardModel>
  quotesUnavailable: boolean
  onNav: (view: string) => void
  onOpenRequests?: (intent: RequestIntent) => void
}

const CARDS: {
  status: RequestState
  label: string
  hint: string
}[] = [
  { status: "BORRADOR", label: "Borradores", hint: "Revisar y enviar" },

  { status: "ENVIADO", label: "En revisión", hint: "Consultar avance" },

  { status: "CONFIRMADO", label: "Confirmadas", hint: "Consultar detalle" },

  { status: "RECHAZADO", label: "Rechazadas", hint: "Revisar observaciones" },
]

export default function AnalystWorkspace({
  data,
  quotesUnavailable,
  onNav,
  onOpenRequests,
}: Props) {
  const [helpMode, setHelpMode] = useState<"faq" | "manual" | null>(null)

  const { mine, ownQuotes, counts, rows, pending, canCreate } = data

  const openRequests = (intent: RequestIntent = {}) =>
    onOpenRequests ? onOpenRequests(intent) : onNav("mis-solicitudes")

  const ready = canCreate && !quotesUnavailable

  return (
    <div className="analyst-workspace">
      <header className="analyst-workspace-heading">
        <div>
          <h2>Tu trabajo pendiente</h2>
          <p>
            {pending
              ? `${pending} ${
                  pending === 1 ? "solicitud requiere" : "solicitudes requieren"
                } tu revisión.`
              : "No tienes borradores ni solicitudes rechazadas por revisar."}
          </p>
        </div>
        <div className="analyst-workspace-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => onNav("inventario")}
          >
            Consultar inventario
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNav("nueva-solicitud")}
          >
            + Nueva solicitud
          </button>
        </div>
      </header>
      <div className="analyst-status-grid" data-tour="dashboard-summary">
        {CARDS.map((card) => (
          <button
            type="button"
            key={card.status}
            className="kpi-card analyst-status-card"
            data-status={card.status}
            aria-label={`${card.label}: ${counts[card.status]}. ${card.hint}`}
            onClick={() => openRequests({ filter: card.status })}
          >
            <span>{card.label}</span>
            <strong>{counts[card.status]}</strong>
            <small>{card.hint}</small>
          </button>
        ))}
      </div>
      <section
        className="panel analyst-requests"
        aria-labelledby="analyst-requests-title"
      >
        <div className="section-header">
          <div>
            <h3 id="analyst-requests-title">
              {pending ? "Solicitudes para revisar" : "Solicitudes recientes"}
            </h3>
            {mine.length > 0 && (
              <p>
                {pending
                  ? "Primero las rechazadas y los borradores; después, las más recientes."
                  : `${mine.length} solicitudes registradas.`}
              </p>
            )}
          </div>
          {mine.length > 0 && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => openRequests()}
            >
              Ver todas ({mine.length})
            </button>
          )}
        </div>
        {mine.length === 0 ? (
          <div className="analyst-empty">
            <span className="analyst-empty-icon" aria-hidden="true">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path
                  d="M7 3h10l3 3v15H4V3h3Zm1 6h8M8 13h8M8 17h5"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <h4>Aún no tienes solicitudes</h4>
            <p>
              {quotesUnavailable
                ? "No pudimos consultar tus cotizaciones. Revisa su estado antes de solicitar materiales."
                : ready
                  ? "Ya tienes una cotización aceptada. Usa Nueva solicitud para elegir el proyecto y sus materiales."
                  : "Para solicitar materiales, primero necesitas un proyecto con una cotización aceptada por el cliente."}
            </p>
            <span>
              {ready
                ? "La unidad y los materiales se completan desde el proyecto."
                : "Revisa el siguiente paso en la sección Mis cotizaciones."}
            </span>
          </div>
        ) : (
          <div className="analyst-request-list">
            <div className="analyst-request-columns" aria-hidden="true">
              <span>Folio y proyecto</span>
              <span>Fecha</span>
              <span>Estado</span>
              <span>Acción</span>
            </div>
            <ul>
              {rows.map((request) => (
                <li key={request.id} className="analyst-request-row">
                  <div className="analyst-request-project">
                    <span>{publicCode(request)}</span>
                    <strong>{request.proyecto}</strong>
                    {request.estado === "RECHAZADO" &&
                      request.observaciones && (
                        <small title={request.observaciones}>
                          {request.observaciones}
                        </small>
                      )}
                  </div>
                  <time dateTime={request.fecha}>{request.fecha}</time>
                  <span
                    className={`badge status-badge badge-${REQUEST_BADGES[request.estado]}`}
                  >
                    {REQUEST_LABELS[request.estado]}
                  </span>
                  <button
                    type="button"
                    className="btn btn-ghost"
                    aria-label={`${REQUEST_ACTIONS[request.estado]}: ${publicCode(request)}`}
                    onClick={() =>
                      openRequests({ id: request.id, filter: request.estado })
                    }
                  >
                    {REQUEST_ACTIONS[request.estado]}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
      <footer className="analyst-support">
        <section
          className="panel analyst-quotes"
          aria-labelledby="analyst-quotes-title"
        >
          <div>
            <h3 id="analyst-quotes-title">Mis cotizaciones</h3>
            <p>
              {quotesUnavailable
                ? "Cotizaciones temporalmente no disponibles."
                : `${ownQuotes.filter((q) => q.estado === "PRESENTADA").length} esperando al cliente · ${ownQuotes.filter((q) => q.estado === "ACEPTADA").length} aceptadas · ${ownQuotes.filter((q) => q.estado === "CERRADA").length} cerradas`}
            </p>
          </div>
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => onNav("cotizaciones")}
            >
              Ver cotizaciones
            </button>
        </section>
        <nav className="analyst-help" aria-label="Ayuda">
          <span>¿Necesitas ayuda?</span>
          <button type="button" onClick={() => setHelpMode("manual")}>
            Manual de usuario
          </button>
          <button type="button" onClick={() => setHelpMode("faq")}>
            Preguntas frecuentes
          </button>
        </nav>
      </footer>
      {helpMode && (
        <AnalistaHelpCenter mode={helpMode} onClose={() => setHelpMode(null)} />
      )}
    </div>
  )
}
