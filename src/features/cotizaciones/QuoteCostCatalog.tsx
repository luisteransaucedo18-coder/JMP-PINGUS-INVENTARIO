import { FieldValidationContext } from "../../components/FieldValidationContext"

import { useContext, useId, useState } from "react"

import NumericInput from "../../components/NumericInput"

import { normalizeMaterialSearch } from "../../utils/materialSearch"

import {
  money,
  roundMoney,
  type QuoteBudget,
  type BudgetExpense,
} from "./domain"

import { EXCEL_PARTIDAS } from "./excelVariables"

import { COST_LABELS, updateCatalogCost } from "./costCatalog"

export default function QuoteCostCatalog({
  budget,
  onChange,
}: {
  budget: QuoteBudget
  onChange: (expenses: BudgetExpense[]) => void
}) {
  const uid = useId()

  const fieldErrors = useContext(FieldValidationContext)

  const [query, setQuery] = useState("")

  const [expanded, setExpanded] = useState<Set<string>>(
    () =>
      new Set(
        EXCEL_PARTIDAS.filter((p) =>
          budget.gastos.some((g) => g.variableExcel === p.key),
        ).map((p) => p.group),
      ),
  )

  const catalog = EXCEL_PARTIDAS.filter((p) =>
    p.modalidades.includes(budget.modalidad),
  )

  const words = normalizeMaterialSearch(query).split(/\s+/).filter(Boolean)

  const matches = catalog.filter(
    (p) =>
      words.every((word) =>
        normalizeMaterialSearch(
          `${p.label} ${COST_LABELS[p.key] || ""} ${p.group} ${p.hojas}`,
        ).includes(word),
      ) ||
      fieldErrors[`${uid}-${p.key}-quantity`] ||
      fieldErrors[`${uid}-${p.key}-cost`],
  )

  const groups = [...new Set(matches.map((p) => p.group))]

  return (
    <div className="cost-catalog">
      <div className="cost-catalog-search">
        <label htmlFor={`${uid}-search`}>Buscar costo o servicio</label>
        <div>
          <input
            id={`${uid}-search`}
            className="input-field"
            type="search"
            value={query}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault()
            }}
            placeholder="Ej. movilidad, murete o mano de obra"
            onChange={(event) => setQuery(event.target.value)}
          />
          {query && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setQuery("")}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>
      <p className="quote-muted">
        Ingresa el costo para incluir una partida. Los importes son sin IGV.
      </p>
      {groups.length === 0 && (
        <p role="status">
          No hay partidas para esta búsqueda en la modalidad seleccionada.
        </p>
      )}
      {groups.map((group) => {
        const allGroup = catalog.filter((p) => p.group === group)

        const included = budget.gastos.filter((g) =>
          allGroup.some((p) => p.key === g.variableExcel),
        )

        const subtotal = roundMoney(
          included.reduce(
            (sum, g) => sum + roundMoney(g.cantidad * g.costoUnitario),
            0,
          ),
        )

        const hasErrors = allGroup.some(
          (p) =>
            fieldErrors[`${uid}-${p.key}-quantity`] ||
            fieldErrors[`${uid}-${p.key}-cost`],
        )

        return (
          <details
            key={group}
            className="cost-catalog-group"
            open={words.length > 0 || hasErrors || expanded.has(group)}
            onToggle={(event) => {
              if (words.length || hasErrors) return
              const open = event.currentTarget.open
              setExpanded((previous) => {
                if (previous.has(group) === open) return previous

                const next = new Set(previous)
                if (open) next.add(group)
                else next.delete(group)
                return next
              })
            }}
          >
            <summary>
              <span className="cost-group-name">
                {group ===
                "VIATICOS POR CONSTRUCCIÓN DE RED INTERNA / DIAS PROYECTADOS"
                  ? "Viáticos y días de trabajo"
                  : group}
              </span>
              <span className="cost-group-count">
                {included.length}{" "}
                {included.length === 1 ? "agregada" : "agregadas"}
              </span>
              <strong>{money(subtotal, budget.moneda)}</strong>
            </summary>
            {group === "Muretes" && (
              <p className="cost-context-note">
                Revisa que estos costos correspondan a las opciones de muretes
                indicadas arriba.
              </p>
            )}
            {matches
              .filter((p) => p.group === group)
              .map((p) => {
                const expense = budget.gastos.find(
                  (g) => g.variableExcel === p.key,
                )

                const label = COST_LABELS[p.key] || p.label.replace(/:$/, "")

                const quantity =
                  expense?.cantidad ??
                  (["hospedaje", "alimentacion", "altura"].includes(p.key)
                    ? budget.excel.diasProyectados || 1
                    : 1)

                const inputId = `${uid}-${p.key}`

                const update = (
                  field: "cantidad" | "costoUnitario",
                  value: number,
                ) =>
                  onChange(
                    updateCatalogCost(
                      budget.gastos,
                      p,
                      field,
                      value,
                      budget.excel.diasProyectados,
                      () => crypto.randomUUID(),
                    ),
                  )

                return (
                  <div
                    key={p.key}
                    className="cost-catalog-row"
                    data-included={Boolean(expense)}
                  >
                    <div className="cost-catalog-identity">
                      <h5>{label}</h5>
                      <details className="cost-reference">
                        <summary>Ver referencia</summary>
                        <p>{p.label}</p>
                        <p>{p.hojas}</p>
                      </details>
                    </div>
                    <label
                      htmlFor={`${inputId}-quantity`}
                      data-field-label={`Cantidad: ${label}`}
                    >
                      <span>Cantidad</span>
                      <NumericInput
                        id={`${inputId}-quantity`}
                        className="input-field"
                        min={0.000001}
                        value={quantity}
                        aria-invalid={
                          fieldErrors[`${inputId}-quantity`] ? true : undefined
                        }
                        aria-describedby={
                          fieldErrors[`${inputId}-quantity`]
                            ? `${inputId}-quantity-error`
                            : undefined
                        }
                        onValueChange={(value) => update("cantidad", value)}
                      />
                      {fieldErrors[`${inputId}-quantity`] && (
                        <small
                          id={`${inputId}-quantity-error`}
                          className="field-validation-message"
                        >
                          {fieldErrors[`${inputId}-quantity`]}
                        </small>
                      )}
                    </label>
                    <label
                      htmlFor={`${inputId}-cost`}
                      data-field-label={`Costo unitario: ${label}`}
                    >
                      <span>Costo unitario ({budget.moneda})</span>
                      <NumericInput
                        id={`${inputId}-cost`}
                        className="input-field"
                        value={expense?.costoUnitario ?? 0}
                        aria-invalid={
                          fieldErrors[`${inputId}-cost`] ? true : undefined
                        }
                        aria-describedby={
                          fieldErrors[`${inputId}-cost`]
                            ? `${inputId}-cost-error`
                            : undefined
                        }
                        onValueChange={(value) =>
                          update("costoUnitario", value)
                        }
                      />
                      {fieldErrors[`${inputId}-cost`] && (
                        <small
                          id={`${inputId}-cost-error`}
                          className="field-validation-message"
                        >
                          {fieldErrors[`${inputId}-cost`]}
                        </small>
                      )}
                    </label>
                    <div className="cost-row-total">
                      <span>Total</span>
                      <strong>
                        {money(
                          roundMoney(quantity * (expense?.costoUnitario ?? 0)),
                          budget.moneda,
                        )}
                      </strong>
                    </div>
                    <div className="cost-row-action">
                      {expense ? (
                        <button
                          type="button"
                          className="btn btn-ghost"
                          aria-label={`Quitar ${label}`}
                          onClick={() =>
                            onChange(
                              budget.gastos.filter((g) => g.id !== expense.id),
                            )
                          }
                        >
                          Quitar
                        </button>
                      ) : (
                        <span>Sin agregar</span>
                      )}
                    </div>
                  </div>
                )
              })}
          </details>
        )
      })}
    </div>
  )
}
