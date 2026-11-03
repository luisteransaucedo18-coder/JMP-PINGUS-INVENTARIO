import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import * as jsx from 'react/jsx-runtime';
const compile = path => ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 } }).outputText;
const search = {};
new Function('exports', 'require', compile('../src/utils/materialSearch.ts'))(search, () => {});
const materials = [
  { id: 'REG-1', nombre: 'Regulador de presión', categoria: 'Gas', unidad: 'UND', stockSedes: { Chiclayo: 4 } },
  { id: 'REG-2', nombre: 'Regulador industrial', categoria: 'Gas', unidad: 'UND', stockSedes: { Chiclayo: 2 } },
];
function setup(extra = {}) {
  const states = [];
  let index = 0;
  let selected;
  const props = { materials, value: '', onChange(value) { props.value = value; }, onSelect(material) { selected = material; }, ...extra };
  const exports = {};
  new Function('exports', 'require', compile('../src/components/MaterialAutocomplete.tsx'))(exports, name => {
    if (name === 'react/jsx-runtime') return jsx;
    if (name.endsWith('/materialSearch')) return search;
    if (name === 'react') return {
      useId: () => 'test-material', useRef: () => ({ current: null }), useEffect: () => {},
      useState(initial) { const i = index++; if (!(i in states)) states[i] = initial; return [states[i], value => { states[i] = value; }]; },
    };
    throw new Error(`Unexpected import ${name}`);
  });
  return { props, render() { index = 0; return exports.default(props); }, selected: () => selected };
}
function find(node, predicate) {
  if (!node || typeof node !== 'object') return undefined;
  if (predicate(node)) return node;
  for (const child of [node.props?.children].flat(Infinity)) { const result = find(child, predicate); if (result) return result; }
}
const input = tree => find(tree, node => node.props?.role === 'combobox');
const key = (tree, name) => { let prevented = false; input(tree).props.onKeyDown({ key: name, nativeEvent: {}, preventDefault() { prevented = true; }, stopPropagation() {} }); return prevented; };
test('selección por teclado devuelve el material del catálogo sin reescribir unidad o categoría', () => {
  const app = setup();
  input(app.render()).props.onChange({ target: { value: 'presion regulador' } });
  let tree = app.render();
  assert.equal(input(tree).props['aria-expanded'], true);
  assert.equal(key(tree, 'ArrowDown'), true);
  tree = app.render();
  assert.equal(input(tree).props['aria-activedescendant'], 'test-material-option-0');
  assert.equal(key(tree, 'Enter'), true);
  assert.equal(app.selected(), materials[0]);
  assert.equal(app.selected().unidad, 'UND');
  assert.equal(app.selected().categoria, 'Gas');
  assert.equal(input(app.render()).props['aria-expanded'], false);
});
test('excluye agregados y no selecciona ni envía con Enter sin opción activa', () => {
  const app = setup({ excludedIds: ['REG-1'] });
  input(app.render()).props.onFocus();
  let tree = app.render();
  assert.equal(key(tree, 'Enter'), true);
  assert.equal(app.selected(), undefined);
  key(tree, 'ArrowDown');
  tree = app.render();
  key(tree, 'Enter');
  assert.equal(app.selected(), materials[1]);
});
test('Escape cierra sugerencias sin borrar la búsqueda y no hay selección sin resultados', () => {
  const app = setup({ value: 'sin coincidencias' });
  input(app.render()).props.onFocus();
  key(app.render(), 'ArrowDown');
  assert.equal(key(app.render(), 'Enter'), true);
  assert.equal(app.selected(), undefined);
  key(app.render(), 'Escape');
  assert.equal(input(app.render()).props['aria-expanded'], false);
  assert.equal(app.props.value, 'sin coincidencias');
});
