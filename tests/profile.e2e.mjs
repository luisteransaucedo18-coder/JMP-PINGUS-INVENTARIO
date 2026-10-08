import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || `${process.cwd()}/package.json`);
const { chromium } = require('playwright');
const browser = await chromium.launch({channel:'msedge',headless:true});
const output = process.env.QA_SCREENSHOT_DIR;
if (output) await mkdir(output,{recursive:true});
try {
for (const role of (process.env.QA_ROLE ? [process.env.QA_ROLE] : ['gerente','analista','coordinador'])) {
 for (const width of (process.env.QA_WIDTH ? [Number(process.env.QA_WIDTH)] : [1440,768,360])) {
  const page = await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  page.setDefaultTimeout(15000);
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  const id='11111111-1111-4111-8111-111111111111';
  let profile={id,nombre:`Prueba ${role}`,email:`${role}@test.invalid`,rol:role,estado:'ACTIVO',sede:'Trujillo',telefono:'987123456',cargo:'Cargo real',bio:'Biografía guardada',foto_path:null,foto_url:null};
  const user={id,email:profile.email,aud:'authenticated',role:'authenticated',app_metadata:{},user_metadata:{},created_at:new Date().toISOString()};
  let uploads=0,saves=0,failUpload=false,failSave=false;
  const objects=new Map();
  const payload=type=>page.evaluate(type=>{
    const canvas=document.createElement('canvas');canvas.width=64;canvas.height=64;
    const c=canvas.getContext('2d');c.fillStyle='#2563eb';c.fillRect(0,0,64,64);c.fillStyle='#ffffff';c.fillRect(16,16,32,32);
    return canvas.toDataURL(type).split(',')[1];
  },type).then(data=>Buffer.from(data,'base64'));
  const png=await payload('image/png'), jpg=await payload('image/jpeg'),webp=await payload('image/webp');
  await page.route('**/auth/v1/**',async route=>{
    const url=route.request().url();
    if(url.includes('/logout')) return route.fulfill({status:204});
    if(url.includes('/user')) return route.fulfill({json:user});
    return route.fulfill({json:{access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user}});
  });
  await page.route('**/rest/v1/**',async route=>{
    const url=route.request().url();
    if(url.includes('/rpc/actualizar_mi_perfil')) {
      saves++; const data=route.request().postDataJSON();
      assert.deepEqual(Object.keys(data).sort(),['p_bio','p_cargo','p_foto_path','p_nombre','p_telefono'].sort());
      if(data.p_foto_path) assert(data.p_foto_path.startsWith(`${id}/`));
      await new Promise(resolve=>setTimeout(resolve,350));
      if(failSave) return route.fulfill({status:500,json:{message:'simulated database failure'}});
      profile={...profile,nombre:data.p_nombre,telefono:data.p_telefono,cargo:data.p_cargo,bio:data.p_bio,
        ...(data.p_foto_path ? {foto_path:data.p_foto_path,foto_url:`/storage/v1/object/authenticated/fotos-perfil/${data.p_foto_path}`} : {})};
      return route.fulfill({json:profile});
    }
    assert.equal(route.request().method(),'GET','No unrelated data mutations');
    return route.fulfill({json:url.includes('/perfiles')?(route.request().headers().accept?.includes('vnd.pgrst.object')?profile:[profile]):[]});
  });
  await page.route('**/storage/v1/**',async route=>{
    const url=new URL(route.request().url()), method=route.request().method();
    if(method === 'POST' && url.pathname.includes('/object/sign/')) {
      const path=decodeURIComponent(url.pathname.split('/fotos-perfil/')[1]);assert(path.startsWith(`${id}/`));
      return route.fulfill({json:{signedURL:`/object/sign/fotos-perfil/${path}?token=test`}});
    }
    if(method==='DELETE') {
      for(const path of route.request().postDataJSON().prefixes) { assert(path.startsWith(`${id}/`)); if(path!==profile.foto_path) objects.delete(path); }
      return route.fulfill({json:[]});
    }
    if(method==='POST') {
      uploads++;
      const path=decodeURIComponent(url.pathname.split('/fotos-perfil/')[1]); assert(path.startsWith(`${id}/`));
      assert.equal(route.request().headers()['x-upsert'],'false');
      if(failUpload) return route.fulfill({status:500,json:{error:'simulated storage failure'}});
      objects.set(path,png);
      return route.fulfill({json:{Key:`fotos-perfil/${path}`,Id:crypto.randomUUID()}});
    }
    return route.fulfill({body:png,contentType:'image/png'});
  });
  const login=async()=>{
    await page.getByPlaceholder('correo@jip.pe').fill(user.email);
    await page.locator('input[autocomplete="current-password"]').fill('test-password');
    await page.getByRole('button',{name:'Ingresar al sistema'}).click();await page.locator('.app-header').waitFor();
  };
  const openProfile=async()=>{await page.locator('.app-header').getByRole('button',{name:'Mi perfil',exact:true}).click();await page.getByRole('button',{name:'⚙ Configuración'}).waitFor();};
  const select=async(file)=>{await page.locator('input[type=file]').setInputFiles(file);};
  const waitPreview=async()=>{await page.getByRole('dialog',{name:'Ajustar foto de perfil'}).waitFor();await page.getByRole('button',{name:'Guardar foto',exact:true}).waitFor();await page.waitForFunction(()=>!document.querySelector('.profile-photo-dialog button.btn-primary')?.disabled);};
  const screenshot=async(name)=>{if(output){await page.locator('.profile-avatar').scrollIntoViewIfNeeded();await page.screenshot({path:`${output}/profile-${role}-${width}-${name}.png`});}};
  await page.addInitScript(id=>localStorage.setItem(`jip:onboarding:v1:${id}`,'skipped'),id);
  await page.goto(process.env.QA_BASE_URL || 'http://localhost:8443');await login();
  const mobile=width<=768;
  const sidebar=page.locator(mobile?'.mobile-sidebar':'.desktop-sidebar');
  const openNav=async()=>{if(mobile)await page.getByRole('button',{name:'Abrir menú'}).click();else await sidebar.hover();};
  await openNav();
  const modules=await sidebar.locator('.sidebar-link').evaluateAll(els=>els.map(el=>el.getAttribute('aria-label')));
  for(const label of modules.slice(0,3)){
    await sidebar.getByRole('button',{name:label,exact:true}).click();
    await openProfile();await openNav();
    await sidebar.getByRole('button',{name:'Mi perfil',exact:true}).click();
    if(mobile)assert.equal(await page.getByRole('dialog').isVisible(),false);
    await openNav();
  }
  if(mobile)await page.getByRole('button',{name:'Cerrar menú'}).click();else{await page.locator('.app-header h1').hover();await page.waitForFunction(()=>document.querySelector('.desktop-sidebar').getBoundingClientRect().width<65);}
  await page.getByRole('button',{name:'⚙ Configuración'}).click();
  assert.equal(await page.getByLabel('Teléfono',{exact:true}).inputValue(),'987123456');
  assert.equal(await page.locator('.profile-readonly-value').textContent(),'Trujillo');
  assert.equal(await page.locator('.profile-view select').count(),0,'Sede and role are not editable');
  await page.getByLabel('Nombre completo',{exact:true}).fill('Nombre cancelado');
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  assert.equal(saves,0);assert.equal(uploads,0);
  await select({name:'bad.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg/>')});await page.getByRole('alert').filter({hasText:'JPG, PNG o WebP válida'}).waitFor();
  await select({name:'big.png',mimeType:'image/png',buffer:Buffer.alloc(5242881)});await page.getByRole('alert').filter({hasText:'5 MB'}).waitFor();
  await select({name:'broken.png',mimeType:'image/png',buffer:Buffer.from([137,80,78,71,13,10,26,10])});await page.getByRole('alert').filter({hasText:'dañada'}).waitFor();
  for(const [name,mimeType,buffer] of [['foto.jpg','image/jpeg',jpg],['foto.webp','image/webp',webp]]){
    await select({name,mimeType,buffer});await waitPreview();
    await page.getByRole('button',{name:'Cancelar',exact:true}).click();
    assert.equal(uploads,0);
    assert.equal(await page.locator('.profile-avatar img').count(),0);
  }
  await select({name:'foto.png',mimeType:'image/png',buffer:png});await waitPreview();
  await page.getByLabel('Acercar').fill('1.5');await page.getByLabel('Posición horizontal').fill('70');
  await page.getByRole('button',{name:'Guardar foto',exact:true}).click();await page.getByRole('dialog').waitFor({state:'hidden'});
  assert.equal(uploads,1);assert.equal(saves,1);
  await page.getByRole('button',{name:'⚙ Configuración'}).click();
  await page.getByLabel('Nombre completo',{exact:true}).fill(`Nuevo ${role}`);
  await page.getByLabel('Teléfono',{exact:true}).fill('999888777');
  await page.getByLabel('Cargo',{exact:true}).fill('Cargo actualizado');
  await page.getByLabel('Sobre mí',{exact:true}).fill('Biografía actualizada');
  await screenshot('preview');
  const save=page.getByRole('button',{name:'Guardar cambios',exact:true});
  await save.click();await page.getByRole('button',{name:'Guardando…'}).waitFor();assert(await page.getByRole('button',{name:'Guardando…'}).isDisabled());
  await page.waitForFunction(()=>document.querySelector('.profile-feedback-success'));
  assert.equal(saves,2);assert.equal(uploads,1);assert.equal(objects.size,1);
  await page.waitForFunction(()=>document.querySelector('.header-avatar img')?.src.includes('/object/sign/'));
  assert(profile.foto_path);assert.equal(profile.sede,'Trujillo');assert.equal(profile.rol,role);
  await page.reload();await page.locator('.app-header').waitFor();await openProfile();
  await page.waitForFunction(()=>document.querySelector('.profile-avatar img')?.src.includes('/object/sign/'));
  assert.equal(await page.locator('.profile-identity-copy').getByText(`Nuevo ${role}`,{exact:true}).isVisible(),true);
  await screenshot('saved');
  await page.getByRole('button',{name:'⚙ Configuración'}).click();
  await page.getByRole('button',{name:'Contraseña',exact:true}).click();
  await page.getByRole('button',{name:'Actualizar contraseña',exact:true}).click();
  await page.getByText('Completa la contraseña actual.',{exact:true}).waitFor();
  await page.getByLabel('Contraseña actual',{exact:true}).fill('test-password');
  await page.getByLabel('Nueva contraseña',{exact:true}).fill('new-password');
  await page.getByLabel('Confirmar nueva contraseña',{exact:true}).fill('different');
  await page.getByRole('button',{name:'Actualizar contraseña',exact:true}).click();
  await page.getByText('La confirmación debe coincidir con la nueva contraseña.',{exact:true}).waitFor();
  await page.getByLabel('Confirmar nueva contraseña',{exact:true}).fill('new-password');
  await page.getByRole('button',{name:'Actualizar contraseña',exact:true}).click();
  await page.locator('.profile-settings-form').getByRole('status').filter({hasText:'Contraseña actualizada correctamente.'}).waitFor();
  assert.equal(await page.getByLabel('Nueva contraseña',{exact:true}).inputValue(),'');
  await page.getByRole('button',{name:'Mi actividad',exact:true}).click();
  await openNav();assert(await sidebar.locator('.sidebar-user-avatar img').isVisible());
  await sidebar.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await page.getByRole('button',{name:'Ingresar al sistema'}).waitFor();await login();await openProfile();
  await page.waitForFunction(()=>document.querySelector('.profile-avatar img')?.src.includes('/object/sign/'));
  assert.equal(uploads,1,'Reload and new login reuse the stored image');
  // Failure handling preserves the committed image and editable draft; failed uploads are cleaned up.
  await select({name:'replacement.png',mimeType:'image/png',buffer:png});await waitPreview();
  const oldPath=profile.foto_path;failUpload=true;await page.getByRole('button',{name:'Guardar foto',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'No se pudo subir'}).waitFor();assert.equal(profile.foto_path,oldPath);assert.equal(saves,2);
  failUpload=false;failSave=true;await page.getByRole('button',{name:'Guardar foto',exact:true}).click();
  await page.getByRole('alert').filter({hasText:'No se pudo guardar'}).waitFor();assert.equal(objects.size,1);assert.equal(profile.foto_path,oldPath);
  failSave=false;const cleanup=page.waitForResponse(r=>r.request().method()==='DELETE' && r.url().includes('/storage/v1/'));await page.getByRole('button',{name:'Guardar foto',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('.profile-photo-dialog[open]'));await cleanup;assert.equal(objects.size,1,'Old photo removed after successful replacement');
  assert.notEqual(profile.foto_path,oldPath);assert.deepEqual(errors,[]);
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  console.log(`PASS profile ${role} ${width}: real fields, all formats, preview/cancel, storage/RPC failures, single save, synced avatars, reload and re-login`);
  await page.close();
 }
}
}finally{await browser.close();}
