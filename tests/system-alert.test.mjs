import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import React from 'react';
import * as jsx from 'react/jsx-runtime';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';
const source = readFileSync(new URL('../src/components/SystemAlert.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source.replace('document.body', 'null'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const exports = {};
new Function('exports', 'require', compiled)(exports, name => {
  if (name === 'react') return React;
  if (name === 'react/jsx-runtime') return jsx;
  if (name === 'react-dom') return { createPortal: children => children };
  throw new Error(`Unexpected import ${name}`);
});
const render = props => renderToStaticMarkup(React.createElement(exports.default, { title: 'Confirmar entrega', children: 'Revisa el material', onClose() {}, ...props }));
test('confirmaciones tienen acciones explícitas y descripción accesible', () => {
  const html = render({ tone: 'warning', onConfirm() {}, cancelLabel: 'Revisar', confirmLabel: 'Registrar entrega' });
  assert.match(html, /role="alertdialog"/);
  assert.match(html, /aria-labelledby=/);
  assert.match(html, /aria-describedby=/);
  assert.match(html, />Revisar</);
  assert.match(html, />Registrar entrega</);
});
test('avisos informativos tienen una acción y operaciones pendientes bloquean todos los botones', () => {
  assert.doesNotMatch(render({}), /discard-dialog-keep/);
  const html = render({ busy: true, onConfirm() {} });
  assert.equal((html.match(/disabled=""/g) || []).length, 3);
  assert.match(html, /aria-busy="true"/);
  assert.match(html, /Procesando/);
});
