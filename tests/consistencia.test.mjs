import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const load = async path => {
  const js = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
};
const { createCoalescedTask } = await load('src/utils/coalescedTask.ts');
const deferred = () => { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; };
test('Las invalidaciones simultáneas comparten una sincronización y dejan un solo repaso pendiente', async () => {
  let calls = 0, active = 0, maxActive = 0;
  const first = deferred(), second = deferred();
  const sync = createCoalescedTask(async () => {
    calls++; active++; maxActive = Math.max(maxActive, active);
    await (calls === 1 ? first.promise : second.promise);
    active--;
  });
  const a = sync(), b = sync();
  assert.equal(a, b);
  await Promise.resolve();
  assert.equal(calls, 1);
  for (let i = 0; i < 20; i++) assert.equal(sync(), a);
  first.resolve();
  await Promise.resolve(); await Promise.resolve();
  assert.equal(calls, 2);
  second.resolve(); await a;
  assert.equal(maxActive, 1);
  await sync();
  assert.equal(calls, 3);
});
test('Una sincronización fallida libera el bloqueo y permite reintentar', async () => {
  let calls = 0;
  const sync = createCoalescedTask(async () => { if (++calls === 1) throw new Error('Fallo remoto'); });
  await assert.rejects(sync(), /Fallo remoto/);
  await sync();
  assert.equal(calls, 2);
});
