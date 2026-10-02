import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

function moduleUrl(path, replacements = []) {
  let source = readFileSync(new URL(path, import.meta.url), 'utf8');
  for (const [from, to] of replacements) source = source.replace(from, to);
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
  return `data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
}
const navigationUrl = moduleUrl('../src/app/navigation.ts');
const { NAVIGATION_BY_ROLE, canAccessView } = await import(navigationUrl);
const { buildTourSteps, readTourStatus, saveTourStatus, tourStorageKey } = await import(
  moduleUrl('../src/app/onboarding.ts', [["'./navigation'", JSON.stringify(navigationUrl)]]),
);

for (const role of ['gerente', 'analista', 'coordinador']) {
  test(`el recorrido de ${role} cubre su menú y respeta los accesos`, () => {
    const steps = buildTourSteps(role);
    assert.equal(steps[0].id, 'welcome');
    assert.equal(steps.at(-1).id, 'finish');
    assert.equal(steps.at(-1).view, 'dashboard');
    assert.equal(new Set(steps.map(s => s.id)).size, steps.length);
    for (const item of NAVIGATION_BY_ROLE[role]) assert.ok(steps.some(s => s.view === item.id));
    for (const step of steps) {
      assert.ok(canAccessView(role, step.view));
      assert.ok(step.description?.length > 30);
    }
    assert.equal(steps.some(s => s.id === 'graphs'), role === 'gerente');
    assert.ok(steps.some(s => s.view === 'manual' && s.target === '[data-tour="restart"]'));
  });
}

test('recuerda completar u omitir, con estado separado para cada usuario', () => {
  const data = new Map();
  globalThis.localStorage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  assert.equal(readTourStatus('usuario-a'), null);
  assert.equal(saveTourStatus('usuario-a', 'completed'), true);
  assert.equal(readTourStatus('usuario-a'), 'completed');
  assert.equal(readTourStatus('usuario-b'), null);
  assert.equal(saveTourStatus('usuario-b', 'skipped'), true);
  assert.equal(readTourStatus('usuario-b'), 'skipped');
  assert.equal(readTourStatus('usuario-a'), 'completed');
  data.set(tourStorageKey('usuario-c'), 'dato-invalido');
  assert.equal(readTourStatus('usuario-c'), null);
});

test('un navegador con almacenamiento bloqueado no rompe la aplicación', () => {
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readTourStatus('usuario-a'), null);
  assert.equal(saveTourStatus('usuario-a', 'completed'), false);
});
