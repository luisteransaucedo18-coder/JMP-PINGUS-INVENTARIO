import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync('src/utils/rollStock.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { rollParts, stockFromRollParts, formatStock } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('conserva existencias y muestra rollos con metros restantes', () => {
  assert.deepEqual(rollParts(2.35,100), { rollos: 2, metros: 35 });
  assert.deepEqual(rollParts(3.945,200), { rollos: 3, metros: 189 });
  assert.equal(stockFromRollParts(3,189,200),3.945);
  assert.equal(formatStock(2.35,{unidad:'ROLLO',metrosPorRollo:100}), '2 rollos + 35 m');
  assert.equal(formatStock(0.53,{unidad:'ROLLO',metrosPorRollo:100}), '0 rollos + 53 m');
  assert.equal(formatStock(1,{unidad:'ROLLO',metrosPorRollo:100}), '1 rollo');
  assert.equal(formatStock(1.5,{unidad:'ROLLO'}), '1.5 ROLLO');
});
test('rechaza remanentes inválidos y evita redondear stock silenciosamente', () => {
  for (const args of [[1,100,100],[-1,0,100],[1.5,0,100],[1,-1,100],[1,5,0],[1,NaN,100]]) assert.throws(()=>stockFromRollParts(...args));
  assert.throws(()=>stockFromRollParts(1,0.1,200),/precisión/);
  assert.equal(stockFromRollParts(1,0.2,200),1.001);
});
