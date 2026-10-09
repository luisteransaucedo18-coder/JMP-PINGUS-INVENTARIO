import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || `${process.cwd()}/package.json`);
const { chromium } = require('playwright');
mkdirSync('test-results/rollos', {recursive:true});
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
 for(const width of [1440,390]) {
  const page = await browser.newPage({viewport:{width,height:1000}});
  await page.routeWebSocket('**',socket=>socket.close());
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  const user={id:'70000000-0000-4000-8000-000000000001',email:'qa@test.invalid',aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{}};
  const profile={id:user.id,nombre:'QA',rol:'coordinador',sede:'Chiclayo',estado:'ACTIVO',email:user.email};
  const material={sku:'ROLL-QA',nombre:'Tubería QA',descripcion:'Rollo de prueba',categoria_id:1,unidad:'ROLLO',metros_por_rollo:100,stock_minimo:1,precio_unitario:20,estado:'OK'};
  const stocks=['Chiclayo','Chimbote','Trujillo'].map(sede=>({material_sku:material.sku,sede,stock:sede==='Chiclayo'?2.35:0}));
  const writes=[];
  await page.addInitScript(uid=>localStorage.setItem(`jip:onboarding:v1:${uid}`,'completed'),user.id);
  await page.route('**/auth/v1/**',route=>route.fulfill({json:route.request().url().includes('/user')?user:{access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user}}));
  await page.route('**/rest/v1/**',async route=>{
   const req=route.request(),table=new URL(req.url()).pathname.split('/').pop();
   if(req.method()==='GET')return route.fulfill({json:table==='perfiles'?(req.headers().accept?.includes('vnd.pgrst.object')?profile:[profile]):table==='materiales'?[material]:table==='inventario_sedes'?stocks:table==='categorias_material'?[{id:1,nombre:'SIN CATEGORIA'}]:[]});
   const payload=req.postDataJSON();writes.push({table,payload});
   if(table==='actualizar_material_con_inventario') {Object.assign(material,payload.p_campos);for(const row of stocks)row.stock=payload.p_stock_sedes[row.sede];return route.fulfill({json:material});}
   throw new Error(`Unexpected mutation ${table}`);
  });
  await page.goto('http://127.0.0.1:8443');
  await page.getByPlaceholder('correo@jmppingus.pe').fill(user.email);
  await page.locator('input[autocomplete="current-password"]').fill('test-password');
  await page.getByRole('button',{name:'Ingresar al sistema',exact:true}).click();
  await page.locator('.app-header').waitFor();
  if(width<768)await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
  const nav=page.getByRole('button',{name:'Inventario',exact:true});await nav.focus();await nav.press('Enter');
  await page.getByRole('button',{name:'Tubería QA',exact:true}).click();
  await page.getByRole('button',{name:/Editar stock/}).last().click();
  await page.getByLabel('Metros por rollo',{exact:false}).fill('100');
  assert.equal(await page.getByLabel('Rollos completos — Chiclayo').inputValue(),'2');
  assert.equal(await page.getByLabel('Metros restantes — Chiclayo').inputValue(),'35');
  await page.getByLabel('Metros restantes — Chiclayo').fill('');
  await page.getByRole('button',{name:/Guardar/}).click();assert.equal(writes.length,0);
  await page.getByLabel('Metros por rollo',{exact:false}).fill('200');
  assert.equal(await page.getByLabel('Metros restantes — Chiclayo').inputValue(),'70');
  await page.getByLabel('Metros por rollo',{exact:false}).fill('100');
  await page.getByLabel('Metros restantes — Chiclayo').fill('100');
  await page.getByRole('button',{name:/Guardar/}).click();assert.equal(writes.length,0);
  await page.getByLabel('Rollos completos — Chiclayo').fill('3');
  await page.getByLabel('Metros restantes — Chiclayo').fill('25');
  await page.screenshot({path:`test-results/rollos/editar-${width}.png`,fullPage:true});
  await page.getByRole('button',{name:/Guardar/}).click();
  await page.waitForFunction(()=>!document.querySelector('#edit-material-unit'));
  assert.equal(writes[0].payload.p_stock_sedes.Chiclayo,3.25);
  assert.equal(writes[0].payload.p_campos.metros_por_rollo,100);
  assert.equal(writes[0].payload.p_campos.inventario_esperado.stock_sedes.Chiclayo,2.35);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log(`Rollos + metros: ${width}px OK`);
  await page.close();
 }
}finally{await browser.close();}
