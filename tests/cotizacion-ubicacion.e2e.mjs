import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mkdir} from 'node:fs/promises';
if(process.env.QA_SCREENSHOT_DIR) await mkdir(process.env.QA_SCREENSHOT_DIR,{recursive:true});
import ts from 'typescript';
const dateSource = ts.transpileModule(readFileSync(new URL('../src/utils/limaDate.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const dateUrl = `data:text/javascript;base64,${Buffer.from(dateSource).toString('base64')}`;
const domainSource = readFileSync(new URL('../src/features/cotizaciones/domain.ts', import.meta.url), 'utf8').replace("'../../utils/limaDate'", JSON.stringify(dateUrl));
const compiled = ts.transpileModule(domainSource, {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
const {newBudget,calculateQuote} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || `${process.cwd()}/package.json`);
const {chromium} = require('playwright');
const browser = await chromium.launch({channel:'msedge',headless:true});
try {
  for (const width of [1440,390]) {
    const page = await browser.newPage({viewport:{width,height:1000}});
    const user = {id:'11111111-1111-4111-8111-111111111111',aud:'authenticated',role:'authenticated',email:'qa@test.invalid',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    const budget = newBudget();
    Object.assign(budget, {ciudad:'Chiclayo',tecnico:'Técnico QA',alcance:'Instalación de gas cotizada'});
    Object.assign(budget.excel, {departamento:'Lambayeque',provincia:'Chiclayo',distrito:'Chiclayo'});
    const quote = {id:'quote-qa',codigo:'COT-QA',version:1,revision:0,estado:'ACEPTADA',creado_por:user.id,proyecto_id:'project-qa',serie_id:'quote-qa',presupuesto:budget,totales:calculateQuote(budget),proyecto_snapshot:{nombre:'Proyecto QA',cliente:'Cliente QA',ubicacion:'Av. José Balta 123, interior 2',responsable:'Responsable QA'},eventos:[],asignaciones:[{id:'allocation-qa',requerimiento_id:'requirement-qa',item_id:'material-qa',material_sku:'QA',cantidad:1}],importe_presentado:100,importe_aceptado:100};
    await page.addInitScript(id=>localStorage.setItem(`jip:onboarding:v1:${id}`,'completed'),user.id);
    await page.route('**/auth/v1/**',route=>route.fulfill({json:route.request().url().includes('/user')?user:{access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user}}));
    await page.route('**/rest/v1/**',route=>{
      const table=new URL(route.request().url()).pathname.split('/').pop();
      const data=table==='perfiles'?{id:user.id,rol:'analista',estado:'ACTIVO',nombre:'QA',email:user.email}
        :table==='proyecto_cotizaciones'?[quote]
        :table==='requerimientos'?[{id:'requirement-qa',codigo:'REQ-QA',sede:'Chiclayo',ubicacion:'Av. José Balta 123, interior 2 — Lambayeque / Chiclayo / Chiclayo',descripcion:budget.alcance,tecnico:budget.tecnico,fecha:'2026-10-05',estado:'ENVIADO',proyecto:{id:'project-qa',nombre:'Proyecto QA'},analista:{nombre:'QA'},items:[]}]:[];
      return route.fulfill({json:data});
    });
    await page.goto('http://127.0.0.1:8443');
    await page.getByRole('textbox', { name: 'Correo electrónico', exact: true }).fill(user.email);
    await page.locator('input[autocomplete="current-password"]').fill('qa-password');
    await page.getByRole('button',{name:'Ingresar al sistema'}).click();
    await page.locator('.app-header').waitFor();
    if(width<=768) await page.getByRole('button',{name:'Abrir menú'}).click();
    await page.locator(width<=768?'.mobile-sidebar':'.desktop-sidebar').getByRole('button',{name:'Cotizaciones',exact:true}).press('Enter');
    await page.getByRole('button',{name:'Nueva cotización',exact:true}).click({timeout:5000});
    await page.locator('.quote-editor').waitFor({timeout:5000});
    const department=page.getByLabel('Departamento',{exact:true}), province=page.getByLabel('Provincia',{exact:true}), district=page.getByLabel('Distrito',{exact:true});
    const address=page.getByLabel('Dirección del proyecto',{exact:true});
    await address.fill('Jr. San Martín 456');
    assert(await province.isDisabled()); assert(await district.isDisabled());
    await department.selectOption('Lambayeque');
    assert.deepEqual(await province.locator('option').allTextContents(),['Selecciona una provincia','Chiclayo','Ferreñafe','Lambayeque']);
    await province.selectOption('Chiclayo'); await district.selectOption('Jose Leonardo Ortiz');
    await province.selectOption('Ferreñafe'); assert.equal(await district.inputValue(),'');
    assert(!(await district.locator('option').allTextContents()).includes('Jose Leonardo Ortiz'));
    await district.selectOption('Ferreñafe'); await department.selectOption('Callao');
    assert.equal(await province.inputValue(),''); assert.equal(await district.inputValue(),''); assert(await district.isDisabled());
    await province.selectOption('Callao'); await district.selectOption('Ventanilla');
    await department.selectOption('Áncash'); await province.selectOption('Santa'); await district.selectOption('Chimbote');
    assert.equal(await page.locator('.quote-editor').getByLabel('Provincia',{exact:true}).inputValue(),'Santa');
    assert.equal(await address.inputValue(),'Jr. San Martín 456');
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    const nav=async name=>{
      if(width<=768) await page.getByRole('button',{name:'Abrir menú'}).click();
      await page.locator(width<=768?'.mobile-sidebar':'.desktop-sidebar').getByRole('button',{name,exact:true}).press('Enter');
    };
    await nav('Nueva Solicitud');
    await page.locator('.quote-field select').selectOption('quote-qa');
    for(const value of ['Cliente QA','Responsable QA','Lambayeque','Chiclayo','Av. José Balta 123, interior 2',budget.alcance]) {
      assert((await page.locator('.data-details').innerText()).includes(value));
    }
    const dataDetails=page.locator('.data-details');
    assert((await dataDetails.innerText()).includes('Técnico QA'));
    assert.equal(await page.getByText('Sede de abastecimiento',{exact:true}).count(),1);
    const desktopColumns=await dataDetails.locator('dl').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
    assert.equal(desktopColumns,width===1440?3:1,'Details use the available space and collapse on mobile');
    if(process.env.QA_SCREENSHOT_DIR) await dataDetails.screenshot({path:process.env.QA_SCREENSHOT_DIR+'/project-details-'+width+'.png'});
    await nav('Mis Solicitudes');
    await page.locator('tr').filter({hasText:'REQ-QA'}).click();
    assert((await page.getByRole('region',{name:'Datos del proyecto cotizado',exact:true}).innerText()).includes('Av. José Balta 123, interior 2'));
    assert((await page.getByRole('region',{name:'Datos del proyecto cotizado',exact:true}).innerText()).includes('COT-QA · versión 1'));
    assert.equal(await page.locator('.modal .data-details').count(),2,'Both quote and requirement share the same data presentation');
    const overflow=await page.locator('.modal .data-details').evaluateAll(els=>els.some(el=>el.scrollWidth>el.clientWidth+1));
    assert.equal(overflow,false,'Detail blocks do not overflow');
    if(process.env.QA_SCREENSHOT_DIR) await page.locator('.modal').screenshot({path:process.env.QA_SCREENSHOT_DIR+'/requirement-details-'+width+'.png'});
    assert.deepEqual(errors,[]); assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));
    console.log(`OK: ${width}px, province/district selectors, address, inherited quotation data before and after creating a request`);
    await page.close();
  }
} finally { await browser.close(); }
