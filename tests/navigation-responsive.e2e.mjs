// Runs against the existing Vite server with mocked Supabase HTTP responses; no real accounts or data are changed.
// Usage: node tests/navigation-responsive.e2e.mjs (requires Playwright and Microsoft Edge).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
// Install Playwright separately, or set PLAYWRIGHT_PACKAGE_JSON to its package.json.
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || `${process.cwd()}/package.json`);
const { chromium } = require('playwright');
const browser = await chromium.launch({channel:'msedge', headless:true});
try {
for (const role of (process.env.QA_ROLE ? [process.env.QA_ROLE] : ['gerente','analista','coordinador'])) {
 for (const width of (process.env.QA_WIDTH ? [Number(process.env.QA_WIDTH)] : [360,390,768,1280])) {
  const page = await browser.newPage({viewport:{width,height:800},reducedMotion:'reduce'});
  page.on('pageerror', error => console.error('Browser error:', error.message));
  page.setDefaultTimeout(10000);
  let logoutCount=0, failLogout=false;
  await page.route('**/auth/v1/**',async route=>{
   if(route.request().url().includes('/logout')) {
    logoutCount++;
    await new Promise(r=>setTimeout(r,350));
    return route.fulfill({status:failLogout?400:204,contentType:'application/json',body:failLogout?JSON.stringify({msg:'Test logout failure'}):''});
   }
   const user={id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:`${role}@test.invalid`,app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
   if (route.request().url().includes('/user')) return route.fulfill({json:user});
   return route.fulfill({json:{access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user}});
  });
  await page.route('**/rest/v1/**',route=>route.fulfill({json:route.request().url().includes('/perfiles') && route.request().headers().accept?.includes('vnd.pgrst.object')?{id:'11111111-1111-4111-8111-111111111111',rol:role,estado:'ACTIVO',nombre:`Prueba ${role}`,email:`${role}@test.invalid`}:[]}));
  await page.goto(process.env.QA_BASE_URL || 'http://localhost:8443');
  const login=async()=>{
   await page.getByPlaceholder('correo@jip.pe').fill(`${role}@test.invalid`);
   await page.locator('input[autocomplete="current-password"]').fill('test-password');
   await page.getByRole('button',{name:'Ingresar al sistema'}).click();
   await page.locator('.app-header').waitFor({timeout:15000});
  };
  await login();
  const mobile=width<=768;
  const trigger=page.getByRole('button',{name:'Abrir menú'});
  const dialog=page.getByRole('dialog');
  assert.equal(await trigger.isVisible(),mobile);
  assert.equal(await page.locator('.desktop-sidebar').isVisible(),!mobile);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const sidebar=mobile?page.locator('.mobile-sidebar'):page.locator('.desktop-sidebar');
  if(mobile){
   await trigger.click(); await dialog.waitFor();
   if(process.env.QA_SCREENSHOT) await page.screenshot({path:process.env.QA_SCREENSHOT});
   const touchTargets = await sidebar.locator('button').evaluateAll(els => els.map(el => { const r=el.getBoundingClientRect(); return {w:r.width,h:r.height}; }));
   assert(touchTargets.every(r=>r.w>=44 && r.h>=44));
   assert.equal(await trigger.getAttribute('aria-expanded'),'true');
   assert(await dialog.evaluate(el=>el.contains(document.activeElement)));
   await page.keyboard.press('Shift+Tab');
   assert(await sidebar.getByRole('button',{name:'Cerrar sesión',exact:true}).evaluate(el=>el===document.activeElement));
   await page.keyboard.press('Tab');
   assert(await page.getByRole('button',{name:'Cerrar menú',exact:true}).evaluate(el=>el===document.activeElement));
   assert.equal(await page.locator('.app-scroll').evaluate(el=>getComputedStyle(el).overflowY),'hidden');
   await page.keyboard.press('Escape'); assert.equal(await dialog.isVisible(),false);
   assert(await trigger.evaluate(el=>el===document.activeElement));
   await trigger.click(); await page.mouse.click(width-10,100); assert.equal(await dialog.isVisible(),false);
   await trigger.click(); await page.getByRole('button',{name:'Cerrar menú',exact:true}).click(); assert.equal(await dialog.isVisible(),false);
   await trigger.click(); await page.setViewportSize({width:1280,height:800});
   await page.waitForFunction(()=>!document.querySelector('dialog').open);
   assert.equal(await page.locator('.app-scroll').evaluate(el=>getComputedStyle(el).overflowY),'auto');
   await page.setViewportSize({width,height:800}); await trigger.click();
  } else { await sidebar.hover(); }
  assert.equal(await sidebar.locator('.sidebar-link').count(),{gerente:10,analista:8,coordinador:9}[role]);
  const labels=await sidebar.locator('.sidebar-link').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')));
  for(const label of labels){
   await sidebar.getByRole('button',{name:label,exact:true}).click();
   if(mobile){assert.equal(await dialog.isVisible(),false); await trigger.click();}
   assert.equal(await sidebar.getByRole('button',{name:label,exact:true}).getAttribute('aria-current'),'page');
  }
  failLogout=true;
  await sidebar.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  assert(await sidebar.getByRole('button',{name:'Cerrando sesión',exact:false}).isDisabled());
  // Supabase auth-js clears the local session even when remote sign-out fails.
  await page.getByRole('alert').waitFor();
  await login();
  if(mobile) await trigger.click(); else await sidebar.hover();
  failLogout=false;
  await sidebar.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await page.getByRole('button',{name:'Ingresar al sistema'}).waitFor();
  assert.equal(logoutCount,2);
  assert.equal(await page.locator('.app-shell').count(),0);
  assert.equal(await page.evaluate(()=>document.body.style.overflow),'');
  await page.goto(new URL('/inventario', process.env.QA_BASE_URL || 'http://localhost:8443').href);
  await page.getByRole('button',{name:'Ingresar al sistema'}).waitFor();
  await login();
  assert.equal(await page.locator('.app-header h1').textContent(),{gerente:'Dashboard General',analista:'Mi Panel',coordinador:'Panel de Coordinación'}[role]);
  await page.reload();
  await page.locator('.app-header').waitFor({timeout:15000});
  console.log(`PASS ${role} ${width}: role navigation, modal, logout failure/retry, login, protected shell`);
  await page.close();
 }
}
} finally { await browser.close(); }
