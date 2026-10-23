import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/utils/materialSearch.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
});
const { searchMaterials } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
const materials = [
  { id: 'REG-20', nombre: 'Regulador de presión', categoria: 'Gas' },
  { id: 'GAS-001', nombre: 'Conector', categoria: 'Gas' },
  { id: 'OTRO', nombre: 'Adaptador GAS-001', categoria: 'Accesorios' },
];
test('encuentra materiales sin tildes y con palabras en distinto orden', () => {
  assert.deepEqual(searchMaterials(materials, 'PRESION regulador', 10), [materials[0]]);
  assert.deepEqual(searchMaterials(materials, 'gas regulador', 10), [materials[0]]);
});
test('prioriza código exacto y conserva el límite', () => {
  assert.deepEqual(searchMaterials([...materials].reverse(), 'gas-001', 1), [materials[1]]);
});
test('respeta mínimo de caracteres y no devuelve coincidencias parciales de la consulta', () => {
  assert.deepEqual(searchMaterials(materials, 'g', 10, 2), []);
  assert.deepEqual(searchMaterials(materials, 'regulador inexistente', 10), []);
  assert.deepEqual(searchMaterials(materials, '  ', 2), materials.slice(0, 2));
});
