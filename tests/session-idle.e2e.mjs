// Use the existing server. Supabase is mocked; no accounts or data are changed.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';

const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || `${process.cwd()}/package.json`);
const { chromium } = require('playwright');
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const role of ['analista']) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(10000);
    const runtimeErrors = [], consoleErrors = [], failedModules = [];
    page.on('pageerror', error => runtimeErrors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()); });
    page.on('response', response => {
      if (response.status() >= 400 && new URL(response.url()).pathname.startsWith('/src/')) failedModules.push(response.url());
    });
    const id = '11111111-1111-4111-8111-111111111111';
    const user = { id, email: `${role}@test.invalid`, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {}, created_at: new Date().toISOString() };
    const profile = { id, email: user.email, nombre: `Prueba ${role}`, rol: role, estado: 'ACTIVO', sede: 'Trujillo' };
    let failure = { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' };
    let tokens = 0;
    await page.addInitScript(id => localStorage.setItem(`jip:onboarding:v1:${id}`, 'completed'), id);
    await page.route('**/auth/v1/**', async route => {
      const url = route.request().url();
      if (url.includes('/token')) {
        tokens++;
        await new Promise(resolve => setTimeout(resolve, 150));
        if (failure) return route.fulfill({ status: failure.status, json: failure });
      }
      if (url.includes('/logout')) return route.fulfill({ status: 204 });
      return route.fulfill({ json: url.includes('/user') ? user : { access_token: 'test-token', refresh_token: 'test-refresh', expires_in: 3600, token_type: 'bearer', user } });
    });
    await page.route('**/rest/v1/**', route => {
      assert.equal(route.request().method(), 'GET');
      const url = new URL(route.request().url());
      return route.fulfill({ json: url.pathname.endsWith('/perfiles') ? (route.request().headers().accept?.includes('vnd.pgrst.object') ? profile : [profile]) : [] });
    });
    await page.goto(process.env.QA_BASE_URL || 'http://127.0.0.1:8443');
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[autocomplete="current-password"]').fill('test-password');
    await page.locator('.auth-form').evaluate(form => { form.requestSubmit(); form.requestSubmit(); });
    await page.getByRole('alert').filter({ hasText: 'Correo o contraseña incorrectos.' }).waitFor();
    assert.equal(tokens, 1, 'Repeated submission sends only one authentication request');
    assert.equal(await page.locator('.app-header').count(), 0, 'Rejected credentials never enter the app');
    failure = { status: 429, code: 'over_request_rate_limit', message: 'Too many requests' };
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
    await page.getByRole('alert').filter({ hasText: 'demasiados intentos' }).waitFor();
    failure = { status: 500, code: 'unexpected_failure', message: 'Private server details' };
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
    await page.getByRole('alert').filter({ hasText: 'no está disponible temporalmente' }).waitFor();
    assert(!consoleErrors.some(message => message.includes('Error Auth') || message.includes('Private server details')), 'No duplicate application logs or leaked server errors');
    // Browser resource errors are expected for the three rejected HTTP requests above.
    assert(consoleErrors.every(message => message.startsWith('Failed to load resource:')), consoleErrors.join('\n'));
    consoleErrors.length = 0;
    await page.clock.install();
    failure = null;
    await page.getByRole('button', { name: 'Ingresar al sistema' }).click();
    await page.locator('.app-header').waitFor();
    await page.clock.fastForward(240000);
    assert(await page.locator('.app-header').isVisible(), 'Session remains active before five minutes');
    await page.locator('.app-header h1').click();
    await page.clock.fastForward(240000);
    assert(await page.locator('.app-header').isVisible(), 'User activity renews the inactivity period');
    await page.clock.fastForward(60001);
    await page.getByRole('button', {name:'Ingresar al sistema'}).waitFor();
    assert.equal(await page.locator('.app-header').count(), 0, 'Expired session unmounts private data');
    await page.getByRole('alert').filter({hasText:'Tu sesión venció por inactividad'}).waitFor();
    await page.locator('input[type="email"]').fill(user.email);
    await page.locator('input[autocomplete="current-password"]').fill('test-password');
    await page.getByRole('button', {name:'Ingresar al sistema'}).click();
    await page.locator('.app-header').waitFor();
    await page.evaluate(() => localStorage.setItem('jmp:session:last-activity', String(Date.now() - 300001)));
    await page.reload();
    await page.getByRole('button', {name:'Ingresar al sistema'}).waitFor();
    assert.equal(await page.locator('.app-header').count(), 0, 'Expired persisted session cannot restore');
    assert.deepEqual(runtimeErrors, []);
    console.log('PASS: inactivity expiry, activity renewal, fresh credentials and expired session on return');
    await page.close();
  }
} finally { await browser.close(); }
