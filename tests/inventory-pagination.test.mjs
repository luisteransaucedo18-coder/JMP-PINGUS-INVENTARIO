import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const { outputText } = ts.transpileModule(readFileSync(new URL('../src/utils/inventoryPagination.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } });
const { resetInventoryPageScroll } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`);
test('restaura el contenido sin desplazar cabecera ni reiniciar el scroll horizontal de la tabla', () => {
  const calls = [];
  const containers = { '.inventory-view': { scrollTo: value => calls.push(['inventory', value]) }, '.app-scroll': { scrollTo: value => calls.push(['content', value]) } };
  const marker = { closest: selector => containers[selector], ownerDocument: { scrollingElement: { scrollTop: 0, scrollTo: () => { throw new Error('No debe desplazar el documento'); } } } };
  resetInventoryPageScroll(marker);
  assert.deepEqual(calls, [['inventory', { top: 0, behavior: 'auto' }], ['content', { top: 0, behavior: 'auto' }]]);
});
test('corrige un documento desplazado por la paginación anterior y tolera marcador ausente', () => {
  let top;
  resetInventoryPageScroll({ closest: () => null, ownerDocument: { scrollingElement: { scrollTop: 150, scrollTo: options => { top = options.top; } } } });
  assert.equal(top, 0);
  assert.doesNotThrow(() => resetInventoryPageScroll(null));
});
