// Mock-only audit: stale catalogue copies, duplicate selection and duplicate submission.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { launchBrowser } from './e2e-support.mjs';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || `${process.cwd()}/package.json`);
const { chromium } = require('playwright');
const browser = await launchBrowser(chromium);
mkdirSync('test-results/gerente', { recursive: true });
try {
  for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    const errors = [];
    let catalogReads = 0, failCatalog = true; const writes = [];
    page.on('pageerror', e => errors.push(e.message));
    const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: 'gerente@test.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    await page.addInitScript(id => localStorage.setItem(`jip:onboarding:v1:${id}`, 'completed'), user.id);
    await page.route('**/auth/v1/**', route => route.fulfill({ json: route.request().url().includes('/user') ? user : { access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user } }));
    await page.route('**/rest/v1/**', async route => {
      if (route.request().method() === 'POST') {
        assert(route.request().url().endsWith('/rpc/crear_orden_compra'));
        writes.push(route.request().postDataJSON());
        await new Promise(resolve => setTimeout(resolve, 100));
        return route.fulfill({json:'11111111-2222-4111-8111-111111111111'});
      }
      const table = new URL(route.request().url()).pathname.split('/').pop();
      let data = [];
      if (table === 'perfiles') data = { id: user.id, rol: 'analista', estado: 'ACTIVO', nombre: 'Analista QA', email: user.email };
      if (table === 'materiales') {
        catalogReads++;
        if (failCatalog) { failCatalog = false; return route.fulfill({status:500,json:{message:'Prueba de carga incompleta'}}); }
      }
      if (table === 'materiales') data = [{ sku: 'QA-CU', nombre: 'Tubería de cobre', descripcion: '', categoria_id: 1, unidad: 'MTS', stock_minimo: 1, precio_unitario: 25, estado: 'OK' }];
      if (table === 'inventario_sedes') data = ['Chiclayo', 'Chimbote', 'Trujillo'].map(sede => ({ material_sku: 'QA-CU', sede, stock: 20 }));
      if (table === 'requerimientos') data = [1, 2, 3].map(day => ({ id: `qa-${day}`, codigo: `REQ-QA-${day}`, sede: 'Trujillo', fecha: `2026-01-0${day}`, estado: day === 3 ? 'ENVIADO' : 'CONFIRMADO', ubicacion: 'QA', descripcion: 'QA', tecnico: 'Técnico QA', proyecto: { id: 'project-qa', nombre: `Proyecto ${day}` }, analista: { nombre: 'Analista QA' }, coordinador: { nombre: 'Coordinador QA' }, items: [{ material_sku: 'QA-CU', material_nombre: 'Tubería de cobre', cantidad: day * 5, unidad: 'MTS' }] }));
      return route.fulfill({ json: data });
    });
    await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:8443');
    await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(user.email);
    await page.locator('input[autocomplete="current-password"]').fill('qa-password');
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
    await page.getByRole('button',{name:'Reintentar',exact:true}).waitFor();
    assert.equal(await page.locator('.app-header').count(),0,'A partial initial load must not open the workspace');
    await page.getByRole('button',{name:'Reintentar',exact:true}).click();
    await page.locator('.app-header').waitFor();
    assert.equal(catalogReads,2);
    const nav = async label => {
      if (width <= 768) await page.getByRole('button',{name:'Abrir menú'}).click();
      await page.locator(width<=768?'.mobile-sidebar':'.desktop-sidebar').getByRole('button',{name:label,exact:true}).press('Enter');
    };
    await nav('Nueva Solicitud');
    await page.getByRole('heading',{name:'Nuevo requerimiento',exact:true}).waitFor();
    await page.locator('.quote-view select').waitFor();
    await page.getByText('Primero prepara una cotización y registra la aceptación del cliente.',{exact:false}).waitFor();
    assert.equal(catalogReads,2,'New requirement reuses the shared catalogue');
    await nav('Órdenes de Compra');
    await page.getByRole('button',{name:'Crear una →',exact:true}).press('Enter');
    let search=page.getByRole('combobox',{name:'Buscar material por nombre, código o categoría'});
    await search.fill('Tubería');
    await page.getByRole('option',{name:/Tubería de cobre/}).click();
    await page.getByRole('button',{name:'+ Agregar línea',exact:true}).click();
    await search.fill('Tubería');
    await page.locator('.material-autocomplete-panel').waitFor();
    assert.equal(await page.locator('.material-autocomplete-panel [role="option"]').count(),0,'A material already used on the order cannot be selected twice');
    assert.equal(await search.count(),1);
    assert.equal(catalogReads,2,'New purchase reuses the shared catalogue');
    await search.fill('');
    await page.locator('#purchase-cantidad-0').fill('2');
    await page.getByPlaceholder('Describe por qué se requieren estos materiales (stock insuficiente, nuevo proyecto, etc.)…').fill('Compra de prueba');
    await page.getByRole('button',{name:'Guardar borrador',exact:false}).dblclick();
    try { await page.getByText('Borrador guardado',{exact:true}).waitFor(); } catch (error) { console.error('PURCHASE DEBUG', { writes, errors, text: await page.locator('.app-view-content').innerText(), alerts: await page.getByRole('alert').allTextContents() }); throw error; }
    assert.equal(writes.length,1,'Double-click produces one command');
    assert.deepEqual(errors,[]);
    console.log(`PASS ${width}px: initial-load failure/retry, accepted-quote requirement entry, shared catalogue, duplicate purchase selection blocked, one purchase command`);
    await page.close();
  }
} finally { await browser.close(); }

 
