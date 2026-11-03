import assert from "node:assert/strict"

import { readFileSync } from "node:fs"

import { test } from "node:test"

import ts from "typescript"

const source = readFileSync(
  new URL("../src/features/cotizaciones/costCatalog.ts", import.meta.url),
  "utf8",
)

const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})

const { updateCatalogCost } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
)

const partida = {
  key: "redInterna",
  label: "Costo Mano de Obra de redes internas:",
  rubro: "MANO_OBRA",
}

test("ingreso directo conserva etiquetas canónicas y no crea partidas vacías", () => {
  const before = []

  assert.equal(
    updateCatalogCost(before, partida, "costoUnitario", 0, 3, () => "new"),
    before,
  )

  const result = updateCatalogCost(
    before,
    partida,
    "costoUnitario",
    250,
    3,
    () => "new",
  )

  assert.deepEqual(result, [
    {
      id: "new",
      rubro: "MANO_OBRA",
      descripcion: partida.label,
      variableExcel: partida.key,
      cantidad: 1,
      costoUnitario: 250,
    },
  ])
})

test("editar repetidamente mantiene identidad y no duplica ni altera otros gastos", () => {
  const other = {
    id: "other",
    descripcion: "Transporte especial",
    cantidad: 2,
    costoUnitario: 50,
  }

  let result = updateCatalogCost(
    [other],
    partida,
    "costoUnitario",
    250,
    3,
    () => "new",
  )

  result = updateCatalogCost(result, partida, "cantidad", 2, 3, () => {
    throw new Error("No debe crear otro id")
  })

  result = updateCatalogCost(result, partida, "costoUnitario", 125.5, 3, () => {
    throw new Error("No debe crear otro id")
  })

  assert.equal(result.length, 2)

  assert.equal(result[0], other)

  assert.equal(result[1].id, "new")

  assert.equal(result[1].cantidad * result[1].costoUnitario, 251)
})

test("viáticos mantienen días proyectados y cantidad editada al cambiar el costo", () => {
  const hotel = { ...partida, key: "hospedaje" }

  let result = updateCatalogCost(
    [],
    hotel,
    "costoUnitario",
    40,
    3,
    () => "hotel",
  )

  assert.equal(result[0].cantidad, 3)

  result = updateCatalogCost(result, hotel, "cantidad", 5, 3, () => "unused")

  result = updateCatalogCost(
    result,
    hotel,
    "costoUnitario",
    45,
    7,
    () => "unused",
  )

  assert.equal(result[0].cantidad, 5)

  assert.equal(result[0].cantidad * result[0].costoUnitario, 225)
})
