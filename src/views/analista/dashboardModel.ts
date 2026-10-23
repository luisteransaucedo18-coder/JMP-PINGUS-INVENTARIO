import type { Requerimiento } from "../../domain/types"

import type { Quote } from "../../features/cotizaciones/domain"

import { ownedBy } from "../../utils/recordOwner"

export type RequestState = Requerimiento["estado"]

export type RequestIntent = {
  filter?: RequestState
  id?: string
}

export const REQUEST_LABELS: Record<RequestState, string> = {
  BORRADOR: "Borrador",
  ENVIADO: "En revisión",
  CONFIRMADO: "Confirmada",
  RECHAZADO: "Rechazada",
}

export const REQUEST_ACTIONS: Record<RequestState, string> = {
  BORRADOR: "Revisar y enviar",
  ENVIADO: "Ver detalle",
  CONFIRMADO: "Ver detalle",
  RECHAZADO: "Revisar observación",
}

export const REQUEST_BADGES: Record<RequestState, string> = {
  BORRADOR: "gray",
  ENVIADO: "amber",
  CONFIRMADO: "green",
  RECHAZADO: "red",
}

export function analystDashboardModel(
  requirements: Requerimiento[],
  quotes: Quote[],
  profile: {
    id: string
    nombre: string
  },
) {
  const mine = requirements.filter((r) => ownedBy(r, profile))

  const ownQuotes = quotes.filter((q) => q.creado_por === profile.id)

  const counts = Object.fromEntries(
    (["BORRADOR", "ENVIADO", "CONFIRMADO", "RECHAZADO"] as const).map(
      (status) => [status, mine.filter((r) => r.estado === status).length],
    ),
  ) as Record<RequestState, number>

  const priority = (r: Requerimiento) =>
    r.estado === "RECHAZADO" ? 0 : r.estado === "BORRADOR" ? 1 : 2

  const rows = [...mine]
    .sort(
      (a, b) =>
        priority(a) - priority(b) ||
        b.fecha.localeCompare(a.fecha) ||
        a.id.localeCompare(b.id),
    )
    .slice(0, 6)

  return {
    mine,
    ownQuotes,
    counts,
    rows,
    pending: counts.BORRADOR + counts.RECHAZADO,
    canCreate: ownQuotes.some((q) => q.estado === "ACEPTADA"),
  }
}
