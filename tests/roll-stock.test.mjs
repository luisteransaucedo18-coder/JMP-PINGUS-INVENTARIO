import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const js = ts.transpileModule(readFileSync('src/utils/rollStock.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const quantityJs = ts.transpileModule(readFileSync('src/utils/stockQuantity.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const quantityUrl = `data:text/javascript;base64,${Buffer.from(quantityJs).toString('base64')}`;
const resolved = js.replace('./stockQuantity', quantityUrl);
const { rollParts, stockFromRollParts, formatStock } = await import(`data:text/javascript;base64,${Buffer.from(resolved).toString('base64')}`);
const { validStockQuantity, validRollLength } = await import(quantityUrl);
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

test('longitudes con decimales conservan exactamente el remanente al abrir y guardar', () => {
  for (const [stock,length] of [[1.001,100.123],[2.345,0.125],[0.999,0.001]]) {
    const parts=rollParts(stock,length);
    assert.equal(stockFromRollParts(parts.rollos,parts.metros,length),stock);
  }
  assert.match(formatStock(1.001,{unidad:'ROLLO',metrosPorRollo:100.123}),/0.100123 m/);
});

test('límites de BD y notación exponencial se validan sin parseos parciales', () => {
 assert.equal(Number('1e3'),1000); assert.equal(validStockQuantity(Number('1e3')),true);
 for (const value of [NaN,Infinity,-1,1.0001,100000000000]) assert.equal(validStockQuantity(value),false);
 for (const value of [0,100000.001,100.0001]) assert.equal(validRollLength(value),false);
 assert.equal(validRollLength(100),true);
});
