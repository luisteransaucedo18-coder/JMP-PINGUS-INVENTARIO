import type { BudgetExpense } from "./domain"

import type { ExcelPartida } from "./excelVariables"

export function updateCatalogCost(
  expenses: BudgetExpense[],
  partida: ExcelPartida,
  field: "cantidad" | "costoUnitario",
  value: number,
  days: number,
  newId: () => string,
): BudgetExpense[] {
  const existing = expenses.find(
    (expense) => expense.variableExcel === partida.key,
  )

  if (!existing && value === 0) return expenses

  if (existing)
    return expenses.map((expense) =>
      expense.id === existing.id ? { ...expense, [field]: value } : expense,
    )

  return [
    ...expenses,
    {
      id: newId(),
      rubro: partida.rubro,
      descripcion: partida.label,
      variableExcel: partida.key,

      cantidad: ["hospedaje", "alimentacion", "altura"].includes(partida.key)
        ? days || 1
        : 1,

      costoUnitario: 0,
      [field]: value,
    },
  ]
}

export const COST_LABELS: Record<string, string> = {
  mureteCachimbo: "Murete cachimbo: mano de obra y materiales",
  mureteValvula: "Murete válvula: mano de obra y materiales",

  redInterna: "Mano de obra de redes internas",
  habilitacion: "Mano de obra de habilitación",

  fijos: "Gastos fijos del proyecto y cotización",
  variables: "Flete, impresiones, movilidad y supervisión",

  variablesCobre: "Flete, impresiones, movilidad, supervisión y viáticos",
  movilidad: "Impresiones y movilidad",

  supervision: "Supervisión",
  altura: "Trabajos en altura: andamios certificados por día",

  materialesMo: "Mano de obra y materiales, sin gabinete",
}
