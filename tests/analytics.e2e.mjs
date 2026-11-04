// Run after npm run build. All remote requests are mocked; no GA hits or DB writes.
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, extname } from 'node:path';

const browser = await chromium.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) });
try {
  for (const rol of ['analista','gerente','coordinador','tesoreria']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const user = { id: '40000000-0000-0000-0000-000000000001', email: 'private@test.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} };
    const perfil = { ...user, nombre: 'Nombre privado', rol, estado: 'ACTIVO' };
    const errors = [];
    page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(id=>localStorage.setItem(`jip:onboarding:v1:${id}`,'completed'),user.id);
    await page.routeWebSocket('**/realtime/v1/**',()=>{});
    await page.route('**/*',async route=>{
      const url = new URL(route.request().url());
      if (url.hostname === 'www.googletagmanager.com') return route.fulfill({contentType:'application/javascript',body:''});
      if (url.pathname.includes('/auth/v1/')) return route.fulfill({json:url.pathname.endsWith('/user') ? user : { access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user }});
      if (url.pathname.includes('/rest/v1/')) return route.fulfill({json:url.pathname.endsWith('/perfiles') ? (url.searchParams.get('select')?.startsWith('id,nombre') ? [perfil] : perfil) : []});
      if (url.hostname === 'jmpingus.com') {
        const path = resolve('dist',url.pathname === '/' ? 'index.html' : url.pathname.slice(1));
        const types = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml' };
        try { return await route.fulfill({contentType:types[extname(path)] || 'application/octet-stream',body:readFileSync(path)}); }
        catch { return route.fulfill({status:404,body:''}); }
      }
      return route.abort();
    });
    await page.goto('https://jmpingus.com/');
    await page.getByRole('textbox',{name:'Correo electrónico',exact:true}).fill(user.email);
    await page.locator('input[autocomplete="current-password"]').fill('private-password');
    await page.getByRole('button',{name:'Ingresar al sistema'}).click();
    await page.locator('.app-header').waitFor();
    await page.locator('.desktop-sidebar').getByRole('button',{name:'Sistemas',exact:true}).press('Enter');
    await page.getByText('El equipo aún no tiene tareas',{exact:true}).waitFor();
    await page.getByRole('button',{name:'+ Nueva tarea',exact:true}).first().click();
    const dialog = page.getByRole('dialog');
    const count = await page.evaluate(()=>window.dataLayer.filter(a=>a[1]==='module_interaction').length);
    await dialog.getByLabel('Tarea',{exact:true}).fill('Contenido privado de una tarea');
    assert.equal(await page.evaluate(()=>window.dataLayer.filter(a=>a[1]==='module_interaction').length),count);
    await dialog.getByRole('combobox',{name:'Prioridad',exact:true}).click();
    await dialog.getByRole('option',{name:'Alta',exact:true}).click();
    await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
    const events = await page.evaluate(()=>window.dataLayer.map(a=>Array.from(a)));
    const interactions = events.filter(a=>a[1]==='module_interaction');
    assert.ok(interactions.length >= 3);
    assert.ok(interactions.every(a=>a[2].module_id === 'sistemas' && a[2].user_role === rol));
    assert.equal(events.filter(a=>a[1]==='page_view' && a[2].module_id==='sistemas').length,1);
    assert.doesNotMatch(JSON.stringify(events),/Nombre privado|private@test|private-password|Contenido privado/);
    assert.deepEqual(errors,[]);
    console.log(`OK ${rol}: visitas, clics en módulo y diálogo, contexto y exclusión de texto privado`);
    await page.close();
  }
} finally { await browser.close(); }
