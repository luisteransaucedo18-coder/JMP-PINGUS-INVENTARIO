// Isolated browser with simulated API: never writes production records or photos.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
import ts from 'typescript';
import assert from 'node:assert/strict';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || `${process.cwd()}/package.json`);
const { chromium } = require('playwright');
const { hoyPeru } = await import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(readFileSync('src/features/proyectos/seguimiento.ts', 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText).toString('base64')}`);
const id = n => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j9i8AAAAASUVORK5CYII=', 'base64');
mkdirSync('test-results/proyectos', { recursive: true });
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const role of ['coordinador', 'analista', 'gerente']) for (const width of [1440, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    await page.routeWebSocket('**', socket => socket.close());
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const user = { id: id(1), aud: 'authenticated', role: 'authenticated', email: 'qa@test.invalid', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    const profile = { id: user.id, nombre: 'Usuario QA', rol: role, sede: 'Chiclayo', estado: 'ACTIVO', email: user.email };
    const project = { id: id(2), nombre: 'Instalación QA', ubicacion: 'Dirección QA', sede: 'Chiclayo', responsable: 'Técnico QA', cliente: 'Cliente QA', created_at: '2026-10-01T12:00:00Z', estado_obra: 'EN_CONSTRUCCION', revision_obra: 0, fecha_finalizacion: null, garantia_hasta: null };
    const photos = [], incidents = [], writes = [];
    const tables = { perfiles: [profile], proyectos: [project], proyecto_evidencias: photos, proyecto_incidencias: incidents, materiales: [{ sku: '104', nombre: 'Llave de paso', descripcion: 'Llave', categoria_id: 1, unidad: 'UND', stock_minimo: 5, precio_unitario: 25, estado: 'OK' }], inventario_sedes: [], requerimientos: [] };
    await page.addInitScript(uid => localStorage.setItem(`jip:onboarding:v1:${uid}`, 'completed'), user.id);
    await page.route('**/auth/v1/**', route => route.fulfill({ json: route.request().url().includes('/user') ? user : { access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user } }));
    await page.route('**/rest/v1/**', async route => {
      const request = route.request(), method = request.method();
      const url = new URL(request.url()), table = url.pathname.split('/').pop();
      if (method === 'GET') return route.fulfill({ json: table === 'perfiles' && request.headers().accept?.includes('vnd.pgrst.object') ? profile : tables[table] ?? [] });
      writes.push({ table, method });
      assert.notEqual(role, 'gerente', 'Manager must remain read only');
      const payload = request.postDataJSON();
      if (table === 'proyectos' && method === 'PATCH') {
        Object.assign(project, payload, { revision_obra: project.revision_obra + 1 });
        if (project.fecha_finalizacion) project.garantia_hasta = `${Number(project.fecha_finalizacion.slice(0, 4)) + 1}${project.fecha_finalizacion.slice(4)}`;
        return route.fulfill({ json: [{ id: project.id }] });
      }
      if (table === 'proyecto_evidencias' && method === 'POST') photos.push({ ...payload, autor_nombre: profile.nombre, created_at: new Date().toISOString() });
      else if (table === 'proyecto_incidencias' && method === 'POST') incidents.push({ ...payload, estado: 'ABIERTA', cobertura: 'PENDIENTE', plazo_garantia: project.fecha_finalizacion ? 'DENTRO' : 'SIN_INICIO', garantia_hasta: project.garantia_hasta, autor_nombre: profile.nombre, created_at: new Date().toISOString(), revision: 0, resolucion: '' });
      else if (table === 'proyecto_incidencias' && method === 'PATCH') {
        assert.equal(role, 'coordinador');
        const incident = incidents.find(i => `eq.${i.id}` === url.searchParams.get('id'));
        Object.assign(incident, payload, { revision: incident.revision + 1, revisor_nombre: profile.nombre, updated_at: new Date().toISOString() });
        return route.fulfill({ json: [{ id: incident.id }] });
      } else throw Error(`Unexpected write ${method} ${table}`);
      return route.fulfill({ status: 201, json: null });
    });
    await page.route('**/storage/v1/**', route => {
      const request = route.request();
      if (request.method() === 'GET') return route.fulfill({ contentType: 'image/png', body: png });
      if (request.url().includes('/object/sign/')) return route.fulfill({ json: request.postDataJSON().paths.map(path => ({ path, signedURL: `/object/sign/proyectos-evidencias/${path}?token=qa` })) });
      assert.notEqual(role, 'gerente');
      return route.fulfill({ json: { Key: 'proyectos-evidencias/qa', Id: id(99) } });
    });
    await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:8443');
    await page.getByPlaceholder('correo@jmppingus.pe').fill(user.email);
    await page.locator('input[autocomplete="current-password"]').fill('test-password');
    await page.getByRole('button', { name: 'Ingresar al sistema', exact: true }).click();
    await page.locator('.app-header').waitFor({ timeout: 15000 });
    if (width < 768) await page.getByRole('button', { name: 'Abrir menú', exact: true }).click();
    const projectsButton = page.getByRole('button', { name: 'Proyectos', exact: true });
    await projectsButton.focus();
    await projectsButton.press('Enter');
    await page.getByRole('button', { name: 'Ver proyecto →', exact: true }).click();
    await page.getByRole('button', { name: 'Avance y garantía', exact: true }).waitFor();
    await page.getByText('Pendiente de finalización', { exact: true }).waitFor();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Project detail fits the viewport');
    await page.screenshot({ path: `test-results/proyectos/avance-${role}-${width}.png`, fullPage: true });
    assert.equal(await page.getByRole('button', { name: 'Guardar estado', exact: true }).count(), role === 'coordinador' ? 1 : 0);
    await page.getByRole('button', { name: /^Evidencias \(/ }).click();
    if (role !== 'gerente') {
      await page.getByLabel('Etapa de la evidencia').selectOption(role === 'coordinador' ? 'INSTALACION_FINAL' : 'PROCESO');
      await page.getByLabel('Descripción de las fotos').fill('Instalación documentada');
      await page.locator('input[type="file"]').setInputFiles({ name: 'instalacion.png', mimeType: 'image/png', buffer: png });
      await page.getByRole('button', { name: 'Guardar fotografías', exact: true }).click();
      await page.getByRole('button', { name: 'Ampliar foto: Instalación documentada', exact: true }).waitFor();
      await page.getByRole('button', { name: 'Ampliar foto: Instalación documentada', exact: true }).click();
      await page.getByRole('dialog').waitFor();
      await page.keyboard.press('Escape');
      assert.equal(await page.getByRole('dialog').count(), 0);
      if (role === 'coordinador') {
        await page.getByRole('button', { name: 'Avance y garantía', exact: true }).click();
        await page.getByLabel('Estado del proyecto', { exact: true }).selectOption('FINALIZADO');
        await page.getByLabel('Fecha de finalización').fill(hoyPeru());
        await page.getByRole('button', { name: 'Guardar estado', exact: true }).click();
        await page.getByText('Garantía vigente', { exact: true }).waitFor();
      }
    } else assert.equal(await page.locator('input[type="file"]').count(), 0);
    await page.getByRole('button', { name: /^Incidencias \(/ }).click();
    if (role !== 'gerente') {
      await page.getByRole('button', { name: 'Registrar incidencia', exact: true }).click();
      await page.getByLabel('Producto o elemento afectado').fill('Llave de paso');
      await page.getByLabel('Descripción del problema').fill('La llave presenta una fuga.');
      await page.getByRole('button', { name: 'Guardar incidencia', exact: true }).click();
      await page.getByRole('heading', { name: 'Llave de paso', exact: true }).waitFor();
      assert.equal(incidents.length, 1);
      assert.equal(incidents[0].proyecto_id, project.id);
      if (role === 'coordinador') {
        await page.getByRole('button', { name: 'Gestionar atención', exact: true }).click();
        await page.getByLabel('Estado de la atención').selectOption('RESUELTA');
        await page.getByLabel('Evaluación de cobertura').selectOption('CUBIERTA');
        await page.getByLabel('Atención, resolución o motivo de rechazo').fill('Llave reemplazada y probada.');
        await page.getByRole('button', { name: 'Guardar atención', exact: true }).click();
        await page.getByRole('article').getByText('Resuelta', { exact: true }).waitFor();
        assert.equal(incidents[0].estado, 'RESUELTA');
        assert.equal(await page.getByRole('button', { name: 'Gestionar atención', exact: true }).count(), 0);
      } else assert.equal(await page.getByRole('button', { name: 'Gestionar atención', exact: true }).count(), 0);
    } else {
      assert.equal(await page.getByRole('button', { name: 'Registrar incidencia', exact: true }).count(), 0);
      assert.equal(writes.length, 0);
    }
    await page.screenshot({ path: `test-results/proyectos/${role}-${width}.png`, fullPage: true });
    assert.deepEqual(errors, []);
    console.log(`${role} ${width}px: photos, warranty, incidents and permissions verified`);
    await page.close();
  }
} finally { await browser.close(); }
