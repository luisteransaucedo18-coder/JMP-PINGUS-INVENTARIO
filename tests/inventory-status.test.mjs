import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const compile = source => ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText;
const load = (source, require) => {
  const exports = {};
  new Function('exports', 'require', compile(source))(exports, require);
  return exports;
};
const status = load(readFileSync(new URL('../src/utils/inventoryStatus.ts', import.meta.url), 'utf8'), () => { throw new Error('Unexpected import'); });
const quantities = load(readFileSync(new URL('../src/utils/stockQuantity.ts', import.meta.url), 'utf8'), () => {});
const rollStock = load(readFileSync(new URL('../src/utils/rollStock.ts', import.meta.url), 'utf8'), () => quantities);
const material = {
  id: 'SKU-001', nombre: 'Cable', categoria: 'Herramientas', descripcion: 'Cable', unidad: 'UND',
  minimo: 10, precioUnitario: 0, estado: 'OK',
  stockSedes: { Chiclayo: 0, Chimbote: 5, Trujillo: 100 },
};
const source = readFileSync(new URL('../src/features/inventario/pages/InventarioView.tsx', import.meta.url), 'utf8');
function render(sede, filtro = '', materials = [material]) {
  const states = [materials, false, false, '', '', filtro, sede, null, false, false, null];
  let index = 0;
  const { default: Inventory } = load(source, name => {
    if (name === 'react') return { ...React, useEffect: () => {}, useState: initial => [index < states.length ? states[index++] : initial, () => {}], useRef: value => ({ current: value }) };
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name.endsWith('/inventoryStatus')) return status;
    if (name.endsWith('/stockQuantity')) return quantities;
    if (name.endsWith('/rollStock')) return rollStock;
    if (name.endsWith('/AppContext')) return { useAppStore: () => ({ state: { materials: [] }, refreshRemoteData: async () => {} }) };
    if (name.endsWith('/RollStockInput')) return { default: () => null };
    if (name.endsWith('/materialPrice') || name.endsWith('/visualTokens')) return load(readFileSync(new URL(`../src/${name.endsWith('/materialPrice') ? 'utils/materialPrice' : 'config/visualTokens'}.ts`, import.meta.url), 'utf8'), () => { throw new Error('Unexpected import'); });
    if (name.endsWith('/domain/types')) return { SEDES: ['Chiclayo', 'Chimbote', 'Trujillo'] };
    if (name.endsWith('/materialService')) return {};
    if (name.endsWith('/FieldError')) return { default: () => null };
    if (name === './StockStatusDialog') return { default: () => null };
    if (name.endsWith('/MaterialPreviewModal')) return { default: () => null };
    throw new Error(`Unexpected import ${name}`);
  });
  return renderToStaticMarkup(Inventory({ role: 'analista', onToast: () => {} }));
}
const jsxRuntime = await import('react/jsx-runtime');

test('la sede agotada sigue agotada aunque otra tenga mucho stock', () => {
  assert.equal(status.estadoPorSede(material, 'Chiclayo'), 'AGOTADO');
  assert.equal(status.estadoPorSede(material, 'Chimbote'), 'CRÍTICO');
  assert.equal(status.estadoPorSede(material, 'Trujillo'), 'OK');
});

test('respeta los límites del mínimo y stock decimal', () => {
  for (const [stock, expected] of [[0, 'AGOTADO'], [9.5, 'CRÍTICO'], [10, 'BAJO'], [15, 'BAJO'], [15.1, 'OK']]) {
    assert.equal(status.calcularEstado(stock, 10), expected);
  }
  assert.equal(status.calcularEstado(0, 0), 'AGOTADO');
  assert.equal(status.calcularEstado(1, 0), 'OK');
});

test('las alertas generales no ocultan una sede agotada por el stock de otra', () => {
  assert.equal(status.estadoGeneral(material), 'AGOTADO');
  assert.equal(status.estadoGeneral({ ...material, stockSedes: { Chiclayo: 100, Chimbote: 5, Trujillo: 100 } }), 'CRÍTICO');
});

test('compras muestra agotados con mínimo cero y bajos de la sede, aunque el catálogo indique OK', () => {
  const zero = { ...material, id: 'ZERO', nombre: 'Material sin stock', minimo: 0, stockSedes: { Chiclayo: 0, Chimbote: 100, Trujillo: 100 } };
  const low = { ...material, id: 'LOW', nombre: 'Cable bajo', stockSedes: { Chiclayo: 12, Chimbote: 100, Trujillo: 100 } };
  const purchaseSource = readFileSync(new URL('../src/features/compras/pages/NuevaCompraView.tsx', import.meta.url), 'utf8');
  const renderPurchase = sede => {
    const values = [sede, '', [{ skuId: '', nombre: '', cantidadSolicitada: 0, query: '', showDrop: false }], {}, null, false, 'criticos', false];
    let index = 0;
    const { default: Purchase } = load(purchaseSource, name => {
      if (name === 'react') return { ...React, useState: () => [values[index++], () => {}], useRef: () => ({ current: false }), useEffect: () => {} };
      if (name === 'react/jsx-runtime') return jsxRuntime;
      if (name.endsWith('/AppContext')) return { useAppStore: () => ({ state: { materials: [zero, low] }, refreshRemoteData: async () => {} }) };
      if (name.endsWith('/inventoryStatus')) return status;
    if (name.endsWith('/stockQuantity')) return quantities;
    if (name.endsWith('/rollStock')) return rollStock;
    if (name.endsWith('/stockQuantity')) return quantities;
    if (name.endsWith('/AppContext')) return { useAppStore: () => ({ state: { materials: [] }, refreshRemoteData: async () => {} }) };
    if (name.endsWith('/RollStockInput')) return { default: () => null };
      if (name.endsWith('/domain/types')) return { SEDES: ['Chiclayo', 'Chimbote', 'Trujillo'] };
      if (name.endsWith('/MaterialPreviewModal')) return { default: () => null, PreviewBtn: () => null };
      if (name.endsWith('/FieldError')) return { default: () => null };
      if (name.endsWith('/materialSearch')) return { searchMaterials: () => [] };
      if (name.endsWith('/compraService')) return {};
      throw new Error(`Unexpected import ${name}`);
    });
    return renderToStaticMarkup(Purchase({ onToast: () => {}, onNav: () => {} }));
  };
  const html = renderPurchase('Chiclayo');
  assert.match(html, /Material sin stock/); assert.match(html, /AGOTADO/);
  assert.match(html, /Cable bajo/); assert.match(html, />BAJO</);
  assert.match(html, /Mínimo sin configurar/);
  assert.doesNotMatch(html, /No hay materiales agotados/);
  assert.match(renderPurchase('Chimbote'), /No hay materiales agotados, críticos o bajos en Chimbote/);
});

test('el servicio conserva existencias de BD y deriva la alerta general desde esas sedes', async () => {
  const rows = [{ sku: 'ZERO', nombre: 'Cable', unidad: 'MTS', categoria_id: 1, stock_minimo: 10, precio_unitario: 1, estado: 'OK' }];
  const inventory = [{ material_sku: 'ZERO', sede: 'Chiclayo', stock: 0 }, { material_sku: 'ZERO', sede: 'Chimbote', stock: 5 }, { material_sku: 'ZERO', sede: 'Trujillo', stock: 100 }];
  const service = load(readFileSync(new URL('../src/services/materialService.ts', import.meta.url), 'utf8'), name => {
    if (name.endsWith('/inventoryStatus')) return status;
    if (name.endsWith('/stockQuantity')) return quantities;
    if (name.endsWith('/rollStock')) return rollStock;
    if (name.endsWith('/stockQuantity')) return quantities;
    if (name.endsWith('/AppContext')) return { useAppStore: () => ({ state: { materials: [] }, refreshRemoteData: async () => {} }) };
    if (name.endsWith('/RollStockInput')) return { default: () => null };
    if (name === './supabase') return { supabase: { from: table => ({ select: () => { const result = Promise.resolve({ data: table === 'materiales' ? rows : inventory, error: null }); result.order = () => result; return result; } }) } };
    throw new Error(`Unexpected import ${name}`);
  });
  const [loaded] = await service.obtenerMateriales();
  assert.deepEqual(loaded.stockSedes, { Chiclayo: 0, Chimbote: 5, Trujillo: 100 });
  assert.equal(loaded.estado, 'AGOTADO');
});

test('tabla y filtro respetan la sede seleccionada', () => {
  assert.match(render('Chiclayo', 'AGOTADO'), /SKU-001/);
  assert.match(render('Chiclayo', 'AGOTADO'), /badge-red">AGOTADO/);
  assert.doesNotMatch(render('Chiclayo', 'OK'), /SKU-001/);
  assert.match(render('Trujillo', 'OK'), /badge-green">OK/);
  assert.doesNotMatch(render('Trujillo', 'AGOTADO'), /SKU-001/);
});

test('todas las sedes abre el detalle sin apilar estados en la tabla', () => {
  const html = render('todas', 'AGOTADO');
  assert.match(html, /SKU-001/);
  assert.match(html, /Ver estados por sede de SKU-001/);
  assert.match(html, /aria-haspopup="dialog"/);
  assert.doesNotMatch(html, /Chiclayo: AGOTADO/);
  assert.doesNotMatch(html, /Chimbote: CRÍTICO/);
});

test('todas las sedes usa una sola clasificación por material, igual en tabla y filtro', () => {
  assert.match(render('todas','AGOTADO'), /SKU-001/);
  assert.doesNotMatch(render('todas','OK'), /SKU-001/);
  assert.doesNotMatch(render('todas','CRÍTICO'), /SKU-001/);
  assert.match(render('todas','AGOTADO'), /badge-red">AGOTADO/);
});

test('contadores y stock corresponden a la sede seleccionada', () => {
  const html = render('Chiclayo');
  assert.match(html, /Stock en Chiclayo/);
  assert.match(html, /AGOTADO \(Chiclayo\)<\/div><div[^>]*>1<\/div>/);
  assert.match(render('todas'), /AGOTADO \(todas las sedes\)<\/div><div[^>]*>1<\/div>/);
});

test('inventario separa los totales por unidad y conserva rollos parciales', () => {
  const materials = [
    { ...material, id: 'ROLL', unidad: 'ROLLO', stockSedes: { Chiclayo: 1.5, Chimbote: 0.5, Trujillo: 0 } },
    { ...material, id: 'METRO', unidad: 'MTS', stockSedes: { Chiclayo: 100, Chimbote: 0, Trujillo: 0 } },
    { ...material, stockSedes: { Chiclayo: 3, Chimbote: 0, Trujillo: 0 } },
  ];
  const html = render('todas', '', materials);
  assert.match(html, />2 <span[^>]*>ROLLO<\/span>/);
  assert.match(html, />100 <span[^>]*>MTS<\/span>/);
  assert.match(html, />3 <span[^>]*>UND<\/span>/);
  assert.doesNotMatch(html, />105 <span/);
  assert.match(render('Chiclayo', '', materials), />1[.]5 <span[^>]*>ROLLO<\/span>/);
});

test('la vista previa usa ROLLO en el mínimo y en todas las existencias', () => {
  const previewSource = readFileSync(new URL('../src/components/MaterialPreviewModal.tsx', import.meta.url), 'utf8');
  const { default: Preview } = load(previewSource, name => {
    if (name.endsWith('/materialPrice') || name.endsWith('/visualTokens')) return load(readFileSync(new URL(`../src/${name.endsWith('/materialPrice') ? 'utils/materialPrice' : 'config/visualTokens'}.ts`, import.meta.url), 'utf8'), () => { throw new Error('Unexpected import'); });
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name.endsWith('/inventoryStatus')) return status;
    if (name.endsWith('/stockQuantity')) return quantities;
    if (name.endsWith('/rollStock')) return rollStock;
    if (name.endsWith('/stockQuantity')) return quantities;
    if (name.endsWith('/AppContext')) return { useAppStore: () => ({ state: { materials: [] }, refreshRemoteData: async () => {} }) };
    if (name.endsWith('/RollStockInput')) return { default: () => null };
    if (name.endsWith('/domain/types')) return { SEDES: ['Chiclayo', 'Chimbote', 'Trujillo'] };
    throw new Error(`Unexpected import ${name}`);
  });
  const html = renderToStaticMarkup(Preview({ material: { ...material, unidad: 'ROLLO' }, onClose: () => {} }));
  assert.match(html, /10 ROLLO/);
  assert.match(html, />105 ROLLO</);
  assert.doesNotMatch(html, /\bUND\b/);
});

test('el panel separa las sedes y explica el rango de referencia 30', () => {
  const dialogSource = readFileSync(new URL('../src/features/inventario/pages/StockStatusDialog.tsx', import.meta.url), 'utf8');
  const { default: Dialog } = load(dialogSource, name => {
    if (name === 'react') return { ...React, useEffect: () => {}, useRef: () => ({ current: null }), useId: () => 'status-title' };
    if (name === 'react-dom') return { createPortal: content => content };
    if (name === 'react/jsx-runtime') return jsxRuntime;
    if (name.endsWith('/inventoryStatus')) return status;
    if (name.endsWith('/stockQuantity')) return quantities;
    if (name.endsWith('/rollStock')) return rollStock;
    if (name.endsWith('/stockQuantity')) return quantities;
    if (name.endsWith('/AppContext')) return { useAppStore: () => ({ state: { materials: [] }, refreshRemoteData: async () => {} }) };
    if (name.endsWith('/RollStockInput')) return { default: () => null };
    if (name.endsWith('/domain/types')) return { SEDES: ['Chiclayo', 'Chimbote', 'Trujillo'] };
    throw new Error(`Unexpected import ${name}`);
  });
  const originalDocument = globalThis.document;
  globalThis.document = { body: {} };
  try {
    const html = renderToStaticMarkup(Dialog({ material: { ...material, minimo: 30 }, onClose: () => {} }));
    assert.match(html, /<dialog[^>]*aria-labelledby="status-title"/);
    assert.match(html, /Chiclayo: Agotado, 0 UND/);
    assert.match(html, /Chimbote: Crítico, 5 UND/);
    assert.match(html, /Trujillo: Disponible, 100 UND/);
    assert.match(html, /Faltan 25 UND para el mínimo/);
    assert.match(html, /30 a 45 UND/);
    assert.equal(status.MINIMO_INICIAL_INVENTARIO, 30);
  } finally {
    if (originalDocument === undefined) delete globalThis.document;
    else globalThis.document = originalDocument;
  }
});
