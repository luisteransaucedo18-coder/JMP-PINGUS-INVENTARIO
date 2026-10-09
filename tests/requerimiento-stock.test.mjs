import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const typesJs = ts.transpileModule(readFileSync(new URL('../src/domain/types.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;

const source = readFileSync(
  new URL('../src/utils/requirementStock.ts', import.meta.url),
  'utf8',
).replace("'../domain/types'", JSON.stringify(`data:text/javascript;base64,${Buffer.from(typesJs).toString('base64')}`));
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const { obtenerFaltantesRequerimiento, sedesConStockParaTraslado, sugerirSedeOrigen } = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`
);

const requirement = {
  id: 'req-1',
  sede: 'Chiclayo',
  materiales: [
    { skuId: 'A', nombre: 'Material A', cantidad: 8, unidad: 'UND' },
    { skuId: 'B', nombre: 'Cable B', cantidad: 4.5, unidad: 'MTS' },
  ],
};
const materials = [
  {
    id: 'A',
    nombre: 'Material A',
    unidad: 'UND',
    stockSedes: { Chiclayo: 3, Chimbote: 5, Trujillo: 2 },
  },
  {
    id: 'B',
    nombre: 'Cable B',
    unidad: 'MTS',
    stockSedes: { Chiclayo: 6, Chimbote: 1, Trujillo: 8 },
  },
];

test('calcula solo el déficit de la sede solicitante', () => {
  const shortages = obtenerFaltantesRequerimiento(requirement, materials);
  assert.equal(shortages.length, 1);
  assert.deepEqual(shortages[0], {
    sku: 'A',
    nombre: 'Material A',
    unidad: 'UND',
    solicitado: 8,
    disponible: 3,
    faltante: 5,
    stockAlternativo: { Chimbote: 5, Trujillo: 2 },
  });
});

test('sugiere la sede con mayor cobertura disponible', () => {
  const shortages = obtenerFaltantesRequerimiento(requirement, materials);
  assert.equal(sugerirSedeOrigen(shortages, 'Chiclayo'), 'Chimbote');
});

test('no alerta cuando la sede ya cubre todo', () => {
  const stocked = materials.map(material => ({
    ...material,
    stockSedes: { ...material.stockSedes, Chiclayo: 20 },
  }));
  assert.deepEqual(obtenerFaltantesRequerimiento(requirement, stocked), []);
});

test('solo ofrece para traslado sedes con stock y ninguna si todas están agotadas', () => {
  const shortages = obtenerFaltantesRequerimiento(requirement, materials);
  assert.deepEqual(sedesConStockParaTraslado(shortages, 'Chiclayo'), ['Chimbote', 'Trujillo']);

  const exhausted = materials.map(material => ({
    ...material,
    stockSedes: { Chiclayo: 0, Chimbote: 0, Trujillo: 0 },
  }));
  const exhaustedShortages = obtenerFaltantesRequerimiento(requirement, exhausted);
  assert.deepEqual(sedesConStockParaTraslado(exhaustedShortages, 'Chiclayo'), []);
  assert.equal(sugerirSedeOrigen(exhaustedShortages, 'Chiclayo'), undefined);
});
