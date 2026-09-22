import { Requerimiento } from "../data/mockData"

interface Props {
  requirement: Pick<Requerimiento, "estado" | "fecha" | "fechaConfirmacion">
}

const STATUS_INDEX: Record<Requerimiento["estado"], number> = {
  BORRADOR: 0,
  ENVIADO: 1,
  CONFIRMADO: 2,
  RECHAZADO: 2,
}

export default function RequirementStatusTimeline({ requirement }: Props) {
  const activeIndex = STATUS_INDEX[requirement.estado]
  const isRejected = requirement.estado === "RECHAZADO"
  const finalLabel = isRejected ? "Rechazado" : "Confirmado"
  const steps = [
    { label: "Creado", date: requirement.fecha },
    { label: "Enviado", date: activeIndex >= 1 ? requirement.fecha : "—" },
    {
      label: finalLabel,
      date:
        activeIndex === 2
          ? (requirement.fechaConfirmacion ?? requirement.fecha)
          : "—",
    },
  ]

  return (
    <section
      className="requirement-timeline-wrap"
      aria-label={`Seguimiento del requerimiento: ${requirement.estado.toLowerCase()}`}
    >
      <div className="requirement-timeline">
        {steps.map((step, index) => {
          const isComplete = index <= activeIndex
          const isCurrent = index === activeIndex
          const isRejectedStep = isRejected && index === 2

          return (
            <div
              key={step.label}
              className={`requirement-timeline__step${
                isComplete ? " is-complete" : ""
              }${isRejectedStep ? " is-rejected" : ""}`}
              aria-current={isCurrent ? "step" : undefined}
            >
              {index > 0 && (
                <span
                  className={`requirement-timeline__connector${
                    isComplete ? " is-complete" : ""
                  }${isRejectedStep ? " is-rejected" : ""}`}
                  aria-hidden="true"
                />
              )}
              <span className="requirement-timeline__marker" aria-hidden="true">
                {isComplete ? (isRejectedStep ? "×" : "✓") : ""}
              </span>
              <span className="requirement-timeline__label">{step.label}</span>
              <time
                className="requirement-timeline__date"
                dateTime={step.date === "—" ? undefined : step.date}
              >
                {step.date}
              </time>
            </div>
          )
        })}
      </div>
    </section>
  )
}
