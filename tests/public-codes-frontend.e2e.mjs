// Real browser, simulated API: no writes to the production database.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON || `${process.cwd()}/package.json`);
const { chromium } = require('playwright');
const id = n => `70000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const browser = await chromium.launch({ channel: 'msedge', headless: true });
try {
  for (const role of (process.env.QA_ROLES?.split(',') ?? ['gerente','analista','coordinador'])) {
    for (const width of [1440,390]) {
      const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      const user = { id:id(1), aud:'authenticated', role:'authenticated', email:'qa@test.invalid', app_metadata:{}, user_metadata:{}, created_at:new Date().toISOString() };
      const profile = { id:user.id, codigo:'USR-QA', rol:role, estado:'ACTIVO', sede:'Chiclayo', nombre:'Usuario QA', email:user.email };
      const project = { id:id(2), nombre:'Proyecto repetido', ubicacion:'Dirección A', sede:'Chiclayo', responsable:'Técnico QA', cliente:'Cliente QA', created_at:'2026-10-05T16:00:00Z' };
      const requirement = { id:id(3),codigo:'REQ-QA-001',analista_id:user.id,sede:'Chiclayo',fecha:'2026-10-05',estado:'CONFIRMADO',ubicacion:'Dirección A',descripcion:'Instalación',tecnico:'Técnico QA',proyecto:{id:project.id,nombre:project.nombre},analista:{nombre:profile.nombre},coordinador:{nombre:'Coordinador QA'},items:[{material_sku:'104',material_nombre:'Cable',cantidad:12,unidad:'MTS'}] };
      const tables = {
        materiales:[{sku:'104',nombre:'Cable',descripcion:'',categoria_id:1,unidad:'MTS',stock_minimo:1,precio_unitario:25,estado:'OK'}],
        inventario_sedes:['Chiclayo','Chimbote','Trujillo'].map(sede=>({material_sku:'104',sede,stock:20})),
        proyectos:[project,{...project,id:id(5),ubicacion:'Dirección B'}],
        requerimientos:[requirement,{...requirement,id:id(6),codigo:'REQ-QA-002',proyecto:{id:id(5),nombre:project.nombre}}],
        entregas:[{id:id(4),codigo:'ENT-QA-001',requerimiento_id:requirement.id,requerimiento:{codigo:requirement.codigo},proyecto_nombre:project.nombre,tecnico:'Técnico QA',dni_tecnico:'',fecha_hora:'2026-10-06T02:30:00Z',estado:'PARCIAL',responsable:{nombre:'Responsable QA'},items:[{material_sku:'104',material_nombre:'Cable',cantidad_solicitada:12,cantidad_entregada:5}]}],
        ordenes_compra:[{id:id(7),codigo:'OC-QA-001',analista_id:user.id,sede:'Chiclayo',fecha:'2026-10-05',motivo:'Compra QA',estado:'ENVIADO',analista:{nombre:profile.nombre},items:[]}],
        perfiles:[profile],
      };
      await page.addInitScript(userId=>localStorage.setItem(`jip:onboarding:v1:${userId}`,'completed'),user.id);
      await page.route('**/auth/v1/**',route=>route.fulfill({json:route.request().url().includes('/user')?user:{access_token:'test-token',refresh_token:'test-refresh',expires_in:3600,token_type:'bearer',user}}));
      await page.route('**/rest/v1/**',route=>{
        assert.equal(route.request().method(),'GET','This audit must not write data');
        const table=new URL(route.request().url()).pathname.split('/').pop();
        const single=route.request().headers().accept?.includes('vnd.pgrst.object');
        return route.fulfill({json:table==='perfiles'&&single?profile:tables[table]??[]});
      });
      await page.goto(process.env.QA_BASE_URL||'http://127.0.0.1:8443');
      await page.getByRole('button',{name:'Ingresar al sistema',exact:true}).click();
      await page.locator('.auth-form .field-validation-message').first().waitFor();
      assert.equal(await page.locator('.auth-form .field-validation-message').count(),2,'Login must show required-field messages without a summary');
      await page.getByPlaceholder('correo@jip.pe').fill(user.email);
      await page.locator('input[autocomplete="current-password"]').fill('test-password');
      await page.getByRole('button',{name:'Ingresar al sistema',exact:true}).click();
      await page.locator('.app-header').waitFor();
      const nav=async label=>{
        if(width<=768) await page.getByRole('button',{name:'Abrir menú',exact:true}).click();
        await page.locator(width<=768?'.mobile-sidebar':'.desktop-sidebar').getByRole('button',{name:label,exact:true}).press('Enter');
      };
      const noIds=async()=>assert.ok(!/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i.test(await page.locator('.app-view-content').innerText()),'Visible content must not contain a database UUID');
      await noIds();
      await nav(role==='analista'?'Mis Solicitudes':'Requerimientos');
      if(role==='coordinador') {
        await page.getByPlaceholder('Buscar folio, proyecto, analista…').waitFor({timeout:5000}).catch(async error=>{ console.log(await page.locator('.app-view-content').innerText()); console.log(errors); throw error; });
        await page.locator('.kpi-card').filter({hasText:'CONFIRMADO'}).click();
      }
      await page.getByText('REQ-QA-001',{exact:true}).first().waitFor(); await noIds();
      await nav('Entregas');
      await page.getByText('ENT-QA-001',{exact:true}).waitFor();
      await page.getByText('Responsable QA',{exact:true}).waitFor(); await noIds();
      await nav('Ver perfil de Usuario QA');
      await page.getByRole('button',{name:'Seguridad',exact:true}).press('Enter');
      await page.getByRole('button',{name:'Actualizar contraseña',exact:true}).press('Enter');
      await page.getByText('Completa la contraseña actual.',{exact:true}).waitFor();
      await page.getByText('Ingresa al menos 8 caracteres.',{exact:true}).waitFor();
      await page.getByText('Confirma la nueva contraseña.',{exact:true}).waitFor();
      assert.equal(await page.locator('.form-validation-summary').count(),0);
      if(role==='coordinador') {
        await nav('Inventario');
        await page.getByRole('button',{name:'+ Nuevo SKU',exact:true}).press('Enter');
        await page.getByRole('button',{name:'Agregar al catálogo',exact:true}).press('Enter');
        await page.getByText('Completa el nombre del material.',{exact:true}).waitFor();
        await page.getByText('Completa la descripción técnica.',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Cancelar',exact:true}).press('Enter');
        await nav('Usuarios');
        await page.getByRole('button',{name:'+ Nuevo usuario',exact:true}).press('Enter');
        await page.getByRole('button',{name:'Crear usuario',exact:true}).press('Enter');
        await page.getByText('El nombre es requerido',{exact:true}).waitFor();
        await page.getByText('Ingresa un correo electrónico válido.',{exact:true}).waitFor();
        await page.getByRole('button',{name:'Cancelar',exact:true}).press('Enter');
        await nav('Transporte interno');
        await page.waitForFunction(()=>Array.from(document.querySelectorAll('button')).some(button=>button.textContent?.trim()==='Nuevo traslado'&&!button.disabled));
        await page.getByRole('button',{name:'Nuevo traslado',exact:true}).press('Enter');
        await page.getByRole('button',{name:'Guardar borrador',exact:true}).press('Enter');
        await page.locator('.transporte-panel .field-validation-message').first().waitFor();
        await page.locator('.transporte-panel select').first().selectOption('Chimbote');
        await page.getByRole('button',{name:'Guardar borrador',exact:true}).press('Enter');
        await page.getByText('Selecciona al menos un material.',{exact:true}).waitFor();
        assert.equal(await page.locator('.form-validation-summary').count(),0);
        await page.getByRole('button',{name:'Volver al listado',exact:true}).press('Enter');
      }
      if(role==='analista') {
        await nav('Órdenes de Compra');
        await page.getByRole('button',{name:'+ Nueva solicitud de compra',exact:true}).click();
        await page.getByRole('button',{name:'Enviar al coordinador',exact:true}).click();
        await page.getByText('Selecciona un material del catálogo.',{exact:true}).waitFor();
        await page.getByText('Ingresa una cantidad mayor que cero.',{exact:true}).waitFor();
        assert.equal(await page.locator('.form-validation-summary').count(),0);
        await nav('Cotizaciones');
        await page.getByRole('button',{name:'Nueva cotización',exact:true}).click();
        await page.getByRole('button',{name:'Siguiente →',exact:true}).click();
        const summary=page.locator('.form-validation-summary');
        const inline=page.locator('.quote-editor .field-validation-message');
        await inline.first().waitFor();
        assert.equal(await summary.count(),0);
        assert.equal(await inline.count(),9);
        const name=page.locator('.quote-field[data-field-label="Nombre del proyecto"] textarea');
        assert.equal(await name.evaluate(e=>e===document.activeElement),true);
        await name.fill('Proyecto de prueba');
        await page.waitForFunction(()=>document.querySelectorAll('.quote-editor .field-validation-message').length===8);
        assert.equal(await inline.count(),8);
        assert.equal(await name.getAttribute('aria-invalid'),null);
        await page.locator('.quote-field[data-field-label="Cliente"] textarea').fill('Cliente de prueba');
        await page.locator('.quote-field[data-field-label="Responsable del proyecto"] textarea').fill('Responsable de prueba');
        await page.getByLabel('Departamento',{exact:true}).selectOption('Lambayeque');
        await page.getByLabel('Provincia',{exact:true}).selectOption('Chiclayo');
        await page.getByLabel('Distrito',{exact:true}).selectOption('Chiclayo');
        await page.getByLabel('Dirección del proyecto',{exact:true}).fill('Av. de prueba 123');
        await page.getByLabel('Alcance de los trabajos',{exact:true}).fill('Instalación de prueba');
        await page.getByRole('button',{name:'Siguiente →',exact:true}).click();
        await page.getByRole('heading',{name:'Materiales y costos',exact:true}).waitFor();
        assert.equal(await summary.count(),0,'Complete fields must allow advancing without stale warnings');
      }
      await nav('Proyectos');
      const cards=page.locator('.panel').filter({hasText:'Dirección A'});
      await cards.first().getByRole('button',{name:'Ver proyecto →',exact:true}).click();
      await page.getByRole('button',{name:'← Volver a proyectos',exact:true}).waitFor();
      await page.getByText('REQ-QA-001',{exact:true}).waitFor();
      assert.equal(await page.getByText('REQ-QA-002',{exact:true}).count(),0,'Projects with identical names must not share requests');
      await noIds();
      assert.deepEqual(errors,[]);
      console.log(`${role} ${width}px: códigos públicos, responsable y proyectos sin mezclas`);
      await page.close();
    }
  }
} finally { await browser.close(); }
