import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = ts.transpileModule(readFileSync('src/features/reportes/periodo.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { fechaLima, inicioPeriodo, enPeriodo } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
test('Los periodos rápidos usan la fecha de Lima cerca de medianoche UTC', () => {
  assert.equal(fechaLima(new Date('2026-10-02T03:00:00Z')), '2026-10-01');
  assert.equal(fechaLima(new Date('2026-10-02T05:00:00Z')), '2026-10-02');
});
test('Siete días incluye hoy y atraviesa correctamente meses y años bisiestos', () => {
  assert.equal(inicioPeriodo(7, '2024-03-01'), '2024-02-24');
  assert.equal(inicioPeriodo(30, '2026-01-02'), '2025-12-04');
});
test('Los rangos abiertos incluyen sus límites y rechazan rangos invertidos', () => {
  assert.equal(enPeriodo('2026-01-02', '2026-01-02', '2026-01-02'), true);
  assert.equal(enPeriodo('2026-01-03', '', '2026-01-02'), false);
  assert.equal(enPeriodo('2026-01-01', '2026-01-02', ''), false);
  assert.equal(enPeriodo('2020-01-01', '', ''), true);
  assert.equal(enPeriodo('2026-01-02', '2026-01-03', '2026-01-01'), false);
});
