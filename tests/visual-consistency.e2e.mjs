// Visual regression checks against the existing server. All backend responses are local fixtures.
// Run with PLAYWRIGHT_PACKAGE_JSON pointing to the bundled Playwright package.json.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || `${process.cwd()}/package.json`);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
const screenshots = process.env.QA_SCREENSHOT_DIR;
if (screenshots) await mkdir(screenshots, { recursive: true });
const sedes = ['Chiclayo', 'Chimbote', 'Trujillo'];
const longName = 'Cable de conexión industrial para instalación de equipos y mantenimiento preventivo en todas las sedes';
try {
  for (const role of (process.env.QA_ROLE ? [process.env.QA_ROLE] : ['gerente', 'analista', 'coordinador'])) {
    for (const width of (process.env.QA_WIDTH ? [Number(process.env.QA_WIDTH)] : [1440, 1024, 768, 390, 360])) {
      const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const user = { id: '11111111-1111-4111-8111-111111111111', aud: 'authenticated', role: 'authenticated', email: `${role}@test.invalid`, app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
      await page.route('**/auth/v1/**', route => route.fulfill({ json: route.request().url().includes('/user') ? user : {
        access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user,
      } }));
      await page.route('**/rest/v1/**', route => {
        assert.equal(route.request().method(), 'GET', 'Visual QA must never write application data');
        const url = new URL(route.request().url());
        const table = url.pathname.split('/').pop();
        let data = [];
        if (table === 'perfiles' && route.request().headers().accept?.includes('vnd.pgrst.object')) data = { id: '11111111-1111-4111-8111-111111111111', rol: role, estado: 'ACTIVO', nombre: `Prueba ${role}`, email: `${role}@test.invalid` };
        if (table === 'materiales') data = [{ sku: 'QA-001', nombre: longName, descripcion: longName, categoria_id: 1, unidad: 'UND', stock_minimo: 10, precio_unitario: 25, estado: 'CRÍTICO' }];
        if (table === 'inventario_sedes') data = sedes.map((sede, i) => ({ material_sku: 'QA-001', sede, stock: i + 1 }));
        if (table === 'requerimientos') data = sedes.flatMap((sede, i) => ['ENVIADO', 'CONFIRMADO', 'RECHAZADO'].map((estado, j) => ({ id: `qa-${i}-${j}`, codigo: `REQ-QA-${i}-${j}`, sede, ubicacion: 'Sede principal', descripcion: longName, tecnico: 'Técnico de prueba', fecha: new Date().toISOString().slice(0, 10), estado, proyecto: { id: 'project-qa', nombre: longName }, analista: { nombre: `Prueba ${role}` }, coordinador: { nombre: 'Coordinador de prueba' }, items: [], observaciones: longName, fecha_confirmacion: new Date().toISOString().slice(0, 10) })));
        return route.fulfill({ json: data });
      });
      await page.addInitScript(id => localStorage.setItem(`jip:onboarding:v1:${id}`, 'completed'), user.id);
      await page.goto(process.env.QA_BASE_URL || 'http://localhost:8443');
      await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(`${role}@test.invalid`);
      await page.locator('input[autocomplete="current-password"]').fill('test-password');
      await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
      await page.locator('.app-header').waitFor({ timeout: 15000 });
      const snapshot = async name => { if (screenshots) await page.screenshot({ path: `${screenshots}/${role}-${width}-${name}.png` }); };
      await snapshot('dashboard');
      const bell = page.getByRole('button', { name: 'Notificaciones', exact: true });
      await bell.click();
      const panel = page.locator('#notifications-panel');
      await panel.waitFor();
      const rect = await panel.boundingBox();
      assert(rect.x >= 0 && rect.x + rect.width <= width && rect.y + rect.height <= 900, 'Notification panel stays inside viewport');
      if (width === 1440) assert(rect.width >= 540, 'Desktop panel is wider');
      await bell.hover();
      await page.mouse.move(rect.x + rect.width / 2, rect.y + 2, { steps: 15 });
      await panel.hover();
      assert(await panel.isVisible(), 'Pointer crossing and hovering does not close notifications');
      assert(await page.locator('.notification-item').count() > 0);
      assert(await page.locator('.notification-item').evaluateAll(items => items.every(el => el.scrollWidth <= el.clientWidth)), 'Long notification text wraps');
      await snapshot('notifications');
      await page.locator('.notification-item').first().focus();
      await page.keyboard.press('Enter');
      await page.getByRole('button', { name: 'Marcar todo leído' }).click();
      assert.equal(await page.getByText('sin leer', { exact: false }).count(), 0);
      await bell.click();
      assert.equal(await panel.count(), 0, 'Clicking bell again closes notifications');
      await bell.click(); await page.keyboard.press('Escape');
      assert.equal(await panel.count(), 0);
      assert(await bell.evaluate(el => el === document.activeElement));
      await bell.click(); await page.locator('.app-header h1').click();
      assert.equal(await panel.count(), 0, 'Outside click closes notifications');
      const mobile = width <= 768;
      const sidebar = page.locator(mobile ? '.mobile-sidebar' : '.desktop-sidebar');
      const openNav = async () => { if (mobile) await page.getByRole('button', { name: 'Abrir menú' }).click(); else await sidebar.hover(); };
      await openNav();
      const labels = await sidebar.locator('.sidebar-link').evaluateAll(els => els.map(el => el.getAttribute('aria-label')));
      for (const label of labels) {
        await sidebar.getByRole('button', { name: label, exact: true }).click();
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${role}/${label}: no page overflow`);
        assert(await page.locator('.app-scroll .panel, .app-scroll .kpi-card').evaluateAll(els => els.every(el => getComputedStyle(el).borderRadius === '12px')), `${role}/${label}: shared surface radius`);
        if (label === 'Dashboard' && role === 'gerente') {
          const stockChart = page.getByRole('img', { name: 'Distribución de stock por sede' });
          await stockChart.scrollIntoViewIfNeeded();
          assert(await stockChart.locator('circle').evaluateAll(points => points.every(p => {
            const box = p.ownerSVGElement.viewBox.baseVal;
            const x = p.cx.baseVal.value, y = p.cy.baseVal.value, r = p.r.baseVal.value + 1;
            return x >= r && y >= r && x + r <= box.width && y + r <= box.height;
          })), 'Stock chart points remain inside the plot');
          await snapshot('stock');
        }
        if (label === 'Reportes') {
          await page.waitForFunction(() => [...document.querySelectorAll('.dashboard-chart')].every(el => el.clientWidth > 0));
          const charts = await page.locator('.dashboard-chart svg').evaluateAll(els => els.map(el => ({ width: el.getBoundingClientRect().width, viewWidth: el.viewBox.baseVal.width, height: el.getBoundingClientRect().height })));
          assert(charts.every(c => Math.abs(c.width - c.viewWidth) < 2 && c.height >= 240), 'Charts preserve label size and plot height');
          await snapshot('reportes');
        }
        await openNav();
      }
      await sidebar.getByRole('button', { name: `Ver perfil de Prueba ${role}` }).click();
      await snapshot('perfil');
      if (role === 'analista') {
        await openNav();
        await sidebar.getByRole('button', { name: 'Órdenes de Compra', exact: true }).click();
        if (!mobile) {
          await page.locator('.app-header h1').hover();
          await page.waitForFunction(() => document.querySelector('.desktop-sidebar').getBoundingClientRect().width < 65);
        }
        await page.getByRole('button', { name: 'Crear una →' }).click();
        await page.getByRole('heading', { name: 'Nueva Solicitud de Compra', exact: true }).waitFor({timeout:5000});
        await snapshot('nueva-compra');
      }
      assert.deepEqual(errors, [], 'No runtime errors in any module');
      console.log(`PASS ${role} ${width}: ${labels.length} modules, shared surfaces, notifications, keyboard, viewport, no writes`);
      await page.close();
    }
  }
} finally { await browser.close(); }
