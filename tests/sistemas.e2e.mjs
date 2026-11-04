import { chromium } from "playwright"
import assert from "node:assert/strict"
import { mkdirSync } from "node:fs"
const launchBrowser = (engine) => engine.launch({ headless: true, ...(process.platform === 'win32' ? { channel: 'msedge' } : {}) })
const browser = await launchBrowser(chromium)
mkdirSync("test-results/sistemas", { recursive: true })
try {
  for (const rol of ["analista", "gerente", "coordinador", "tesoreria"]) {
    const mobile = rol === "tesoreria"
    const page = await browser.newPage({
      viewport: { width: mobile ? 390 : 1440, height: 1000 },
    })
    const errors = []
    const subscriptions = new Map();
    await page.routeWebSocket('**/realtime/v1/**', ws => {
      ws.onMessage(raw => {
        const message = JSON.parse(String(raw));
        const [join, ref, topic, event, payload] = message;
        if (event === 'phx_join') {
          const filters = (payload.config?.postgres_changes ?? []).map((filter, id) => ({ ...filter, id: id + 1 }));
          subscriptions.set(topic, { ws, join, filters });
          ws.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: filters } }]));
        } else if (event === 'phx_leave') {
          subscriptions.delete(topic);
          ws.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
        } else if (event === 'heartbeat') ws.send(JSON.stringify([join, ref, topic, 'phx_reply', { status: 'ok', response: {} }]));
      });
    });
    function emit(table, type, record = {}) {
      for (const [topic, { ws, join, filters }] of subscriptions) {
        const ids = filters.filter(filter => filter.table === table).map(filter => filter.id);
        if (ids.length) ws.send(JSON.stringify([join, null, topic, 'postgres_changes', { ids, data: { schema: 'public', table, type, record, old_record: type === 'DELETE' ? record : {}, columns: [], commit_timestamp: new Date().toISOString(), errors: [] } }]));
      }
    }
    page.on("pageerror", (e) => errors.push(e.message))
    const user = {
      id: "40000000-0000-0000-0000-000000000001",
      email: "qa@test.invalid",
      aud: "authenticated",
      role: "authenticated",
      app_metadata: {},
      user_metadata: {},
    }
    const perfil = {
      ...user,
      nombre: "Usuario de prueba",
      rol,
      estado: "ACTIVO",
    }
    const colega = { id: '40000000-0000-0000-0000-000000000002', nombre: 'Otra Persona', email: 'otra@test.invalid' };
    let documents = [];
    let lists = [], steps = [];
    let storageUploads = 0;
    let deleteAttempts = 0;
    let tasks = [],
      comments = []
    await page.addInitScript(
      (id) => localStorage.setItem(`jip:onboarding:v1:${id}`, "completed"),
      user.id,
    )
    await page.route("**/auth/v1/**", (route) =>
      route.fulfill({
        json: route.request().url().includes("/user")
          ? user
          : {
              access_token: "test-token",
              refresh_token: "test-refresh",
              expires_in: 3600,
              token_type: "bearer",
              user,
            },
      }),
    )
    await page.route('**/storage/v1/**', route => {
      if (route.request().method() === 'POST') { storageUploads++; return route.fulfill({ json: { Key: 'documento' } }); }
      if (route.request().method() === 'DELETE') return route.fulfill({ json: [] });
      return route.fulfill({ contentType: 'application/pdf', body: '%PDF-1.4\nDocumento de prueba' });
    });
    await page.route("**/rest/v1/**", async (route) => {
      const req = route.request(),
        url = new URL(req.url()),
        table = url.pathname.split("/").pop()
      let data = []
      if (table === "perfiles")
        data =
          url.searchParams.get("select")?.startsWith("id,nombre") ? [perfil, colega] : perfil
      if (table === "sistemas_tareas") {
        if (req.method() === "POST") {
          const task = { ...req.postDataJSON(), revision: 0 }
          tasks.push(task)
          data = task
        } else if (req.method() === "PATCH") {
          tasks[0] = { ...tasks[0], ...req.postDataJSON() }
          data = tasks[0]
        } else if (req.method() === 'DELETE') {
          deleteAttempts++;
          if (deleteAttempts === 1) return route.fulfill({ status: 500, json: { message: 'No se pudo eliminar. Intenta nuevamente.' } });
          data = { id: tasks[0].id }; tasks = [];
        } else data = tasks
      }
      if (table === 'publicar_comentario_sistemas') {
        const fields = req.postDataJSON();
        data = { id: fields.p_id, tarea_id: fields.p_tarea, contenido: fields.p_contenido, autor: user.id, created_at: new Date().toISOString() };
        comments.push(data);
        documents = documents.map(doc => fields.p_documentos.includes(doc.id) ? { ...doc, comentario_id: data.id } : doc);
      }
      if (table === "sistemas_comentarios") {
        if (req.method() === "POST") {
          const c = {
            ...req.postDataJSON(),
            id: "comment",
            autor: user.id,
            created_at: new Date().toISOString(),
          }
          comments.push(c)
          data = c
        } else data = comments
      }
      if (table === 'sistemas_documentos') {
        if (req.method() === 'POST') { data = { ...req.postDataJSON(), autor: user.id, created_at: new Date().toISOString() }; documents.push(data); }
        else if (req.method() === 'DELETE') { data = { id: documents[0].id }; documents = []; }
        else data = documents;
      }
      if (table === 'sistemas_listas' || table === 'sistemas_pasos') {
        const items = table === 'sistemas_listas' ? lists : steps;
        if (req.method() === 'POST') {
          data = { ...req.postDataJSON(), id: crypto.randomUUID(), revision: 0, completado: false };
          items.push(data);
        } else if (req.method() === 'PATCH') {
          const id = url.searchParams.get('id')?.replace('eq.','');
          const index = items.findIndex(item => item.id === id);
          items[index] = { ...items[index], ...req.postDataJSON() }; data = items[index];
        } else if (req.method() === 'DELETE') {
          const id = url.searchParams.get('id')?.replace('eq.',''); data = { id };
          if (table === 'sistemas_listas') { lists = lists.filter(item => item.id !== id); steps = steps.filter(item => item.lista_id !== id); }
          else steps = steps.filter(item => item.id !== id);
        } else data = items;
      }
      return route.fulfill({ json: data })
    })
    await page.goto(process.env.QA_BASE_URL || "http://127.0.0.1:8443")
    await page
      .getByRole("textbox", { name: "Correo electrónico", exact: true })
      .fill(user.email)
    await page
      .locator('input[autocomplete="current-password"]')
      .fill("qa-password")
    await page.getByRole("button", { name: "Ingresar al sistema" }).click()
    await page.locator(".app-header").waitFor()
    const homeFont = await page.locator('body').evaluate(el => getComputedStyle(el).fontFamily);
    const homeHeading = page.locator('.analyst-workspace-heading h2').first();
    const headingStyle = await homeHeading.count() ? await homeHeading.evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight })) : null;
    await page.screenshot({ path: `test-results/sistemas/inicio-${rol}.png` });
    if (mobile) await page.getByRole("button", { name: "Abrir menú" }).click()
    await page
      .locator(mobile ? ".mobile-sidebar" : ".desktop-sidebar")
      .getByRole("button", { name: "Sistemas", exact: true })
      .press("Enter")
    await page
      .getByText("El equipo aún no tiene tareas", { exact: true })
      .waitFor()
    assert.equal(await page.locator('.sistemas').evaluate(el => getComputedStyle(el).fontFamily),homeFont);
    const taskHeading = page.locator('.sistemas-heading h2');
    if (headingStyle) assert.deepEqual(await taskHeading.evaluate(el => ({ size: getComputedStyle(el).fontSize, weight: getComputedStyle(el).fontWeight })),headingStyle);
    assert.equal(await page.locator('.sys-board').evaluate(el => getComputedStyle(el).borderRadius),await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--surface-radius').trim()));
    await page
      .getByRole("button", { name: "+ Nueva tarea", exact: true })
      .first()
      .click()
    const dialog = page.getByRole("dialog")
    assert.equal(await dialog.evaluate(el=>el.matches(':modal')),true);
    assert.equal(await dialog.evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await dialog.getByLabel('Descripción',{exact:true}).fill('Descripción inicial de la tarea');
    await dialog.getByRole('combobox',{name:'Estado',exact:true}).click();
    await dialog.getByRole('option',{name:'En curso',exact:true}).click();
    await dialog.getByRole('combobox',{name:'Prioridad',exact:true}).click();
    await dialog.getByRole('option',{name:'Alta',exact:true}).click();
    await dialog.getByRole('button',{name:'Elegir fechas de la tarea',exact:true}).click();
    await dialog.getByRole('group',{name:'Calendario de la tarea',exact:true}).getByRole('button',{name:'Listo',exact:true}).click();
    await page.screenshot({path:`test-results/sistemas/crear-${rol}.png`,fullPage:true});
    await dialog
      .getByLabel("Tarea", { exact: true })
      .fill("Validación del módulo")
    await dialog.getByRole('button',{name:'Asignar personas a la tarea',exact:true}).click();
    const personasPopup = dialog.getByRole('group',{name:'Personas de la tarea',exact:true});
    await personasPopup.getByRole('button',{name:/^Usuario de prueba/}).click();
    await personasPopup.getByRole('button',{name:/^Otra Persona/}).click();
    await personasPopup.getByRole('button',{name:'Listo',exact:true}).click();
    assert.equal(await dialog.locator('.sys-assignment-control > .sys-assigned-stack .sys-person-avatar').count(),2);
    await dialog.locator('.sys-assignment-control').getByRole('button',{name:'Quitar asignación de Otra Persona',exact:true}).click();
    assert.equal(await dialog.locator('.sys-assignment-control > .sys-assigned-stack .sys-person-avatar').count(),1);
    await dialog.getByRole('button',{name:'Asignar personas a la tarea',exact:true}).click();
    await personasPopup.getByLabel('Buscar personas por nombre o correo').fill('otra@test.invalid');
    await personasPopup.getByRole('button',{name:/^Otra Persona/}).click();
    await personasPopup.getByRole('button',{name:'Listo',exact:true}).click();
    await dialog.getByRole('combobox',{name:'Prioridad',exact:true}).click();
    await dialog.getByRole('option',{name:'Media',exact:true}).click();
    await dialog.getByRole("button", { name: "Crear tarea" }).click()
    await page
      .getByRole("button", { name: "Validación del módulo", exact: true })
      .waitFor()
    assert.equal(await page.locator('.sys-board').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page.locator('#sys-filter-controls').getByRole('combobox', { name: /^Prioridad/ }).selectOption('Alta');
    await page.getByRole('heading', { name: 'No hay coincidencias' }).waitFor();
    await page.getByRole('button', { name: 'Limpiar filtros', exact: true }).click();
    await page.getByRole('button', { name: /^Filtros/ }).click();
    await page
      .locator(".sys-card")
      .getByRole('combobox', { name: /^Estado/ })
      .selectOption("En revisión")
    await page.locator(".sys-state-2 .sys-task-title").waitFor()
    // Another session updates the same task; the websocket must refresh it without navigation.
    tasks[0] = { ...tasks[0], estado: 'En curso', revision: tasks[0].revision + 1 };
    emit('sistemas_tareas', 'UPDATE', tasks[0]);
    await page.locator('.sys-state-1 .sys-task-title').waitFor({ timeout: 2500 });
    tasks[0] = { ...tasks[0], estado: 'En revisión', revision: tasks[0].revision + 1 };
    emit('sistemas_tareas', 'UPDATE', tasks[0]);
    await page.locator('.sys-state-2 .sys-task-title').waitFor({ timeout: 2500 });
    await page.screenshot({ path: `test-results/sistemas/tablero-${rol}.png` });
    await page.getByRole('button', { name: 'Opciones de tarea Validación del módulo', exact: true }).click();
    await page.getByRole('button', { name: 'Eliminar tarea', exact: true }).waitFor();
    await page.keyboard.press('Escape');
    await page.getByRole("button", { name: "Tabla", exact: true }).click()
    await page.getByRole('button', { name: 'Opciones de tarea Validación del módulo', exact: true }).click();
    await page.getByRole('button', { name: 'Abrir tarea', exact: true }).click();
    assert.equal(await dialog.evaluate(d => d.matches(':modal')), mobile);
    assert.equal(await page.locator('.sys-table-wrap').evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);
    assert.equal(await dialog.getByLabel('Tarea', { exact: true }).evaluate(el => getComputedStyle(el).fontFamily),homeFont);
    assert.equal(await dialog.getByLabel('Tarea', { exact: true }).evaluate(el => getComputedStyle(el).resize), 'none');
    if (!mobile) {
      await page.getByRole('button', { name: 'Tablero', exact: true }).click();
      assert.equal(await dialog.isVisible(), true);
    }
    await page.screenshot({ path: `test-results/sistemas/detalle-${rol}.png` });
    assert.equal(await page.locator('.sys-board').count() ? await page.locator('.sys-board').evaluate(el=>el.scrollWidth<=el.clientWidth+1) : true,true);
    assert.equal(await dialog.getByRole('button',{name:'Contexto',exact:true}).count(),0);
    const estadoDetalle = dialog.getByRole('combobox', { name: 'Estado', exact: true });
    const colorEstado = await estadoDetalle.locator('.sys-property-pill').evaluate(el => getComputedStyle(el).backgroundColor);
    await estadoDetalle.click();
    await dialog.getByRole('searchbox',{name:'Buscar estado',exact:true}).fill('complet');
    await dialog.getByRole('option',{name:'Completado',exact:true}).click();
    assert.notEqual(await estadoDetalle.locator('.sys-property-pill').evaluate(el => getComputedStyle(el).backgroundColor),colorEstado);
    await estadoDetalle.click();
    await dialog.getByRole('searchbox',{name:'Buscar estado',exact:true}).fill('revision');
    await dialog.getByRole('option',{name:'En revisión',exact:true}).click();
    const prioridadDetalle=dialog.getByRole('combobox',{name:'Prioridad',exact:true});
    await prioridadDetalle.click();
    await dialog.getByRole('option',{name:'Alta',exact:true}).click();
    assert.equal(await prioridadDetalle.locator('.sys-tone-high').count(),1);
    await dialog.getByRole('button',{name:'Borrar prioridad',exact:true}).click();
    await prioridadDetalle.getByText('Sin prioridad',{exact:true}).waitFor();
    await prioridadDetalle.click();
    await dialog.getByRole('option',{name:'Media',exact:true}).click();
    await dialog.getByRole('button',{name:'Elegir fechas de la tarea',exact:true}).click();
    const calendario=dialog.getByRole('group',{name:'Calendario de la tarea',exact:true});
    await calendario.getByLabel('Fecha de inicio',{exact:true}).fill('2026-11-10');
    await calendario.getByLabel('Fecha límite',{exact:true}).fill('2026-11-08');
    await calendario.getByText('La fecha de inicio no puede ser posterior al vencimiento.',{exact:true}).waitFor();
    assert.equal(await dialog.getByRole('button',{name:'Guardar tarea',exact:true}).isDisabled(),true);
    await calendario.getByLabel('Fecha límite',{exact:true}).fill('2026-11-12');
    await page.screenshot({path:`test-results/sistemas/calendario-${rol}.png`});
    await calendario.getByRole('button',{name:'Mes siguiente',exact:true}).click();
    await calendario.getByRole('button',{name:'Mes anterior',exact:true}).click();
    await calendario.getByRole('button',{name:'Listo',exact:true}).click();
    await dialog.getByRole('button',{name:'Elegir fechas de la tarea',exact:true}).getByText('10/11',{exact:true}).waitFor();
    await dialog.getByRole('button',{name:'Borrar fechas de la tarea',exact:true}).click();
    await dialog.getByRole('button',{name:'Sugerir',exact:true}).click();
    await dialog.getByRole('button',{name:'Revisar los requisitos',exact:true}).click();
    assert.equal(await dialog.getByLabel('Nombre de la subtarea',{exact:true}).inputValue(),'Revisar los requisitos');
    await dialog.getByRole('button',{name:'Cancelar subtarea',exact:true}).click();
    await dialog.getByRole('button', { name: '+ Añadir subtarea', exact: true }).click();
    await dialog.getByLabel('Nombre de la subtarea', { exact: true }).fill('Preparar revisión');
    await dialog.getByLabel('Fecha objetivo de la subtarea',{exact:true}).fill('2026-11-12');
    await dialog.getByRole('combobox',{name:'Prioridad de la subtarea',exact:true}).selectOption('Alta');
    await dialog.getByRole('combobox',{name:'Responsable de la subtarea',exact:true}).selectOption(colega.id);
    await dialog.getByRole('button', { name: 'Añadir subtarea', exact: true }).click();
    await dialog.getByRole('checkbox', { name: 'Completar subtarea Preparar revisión', exact: true }).waitFor();
    assert.equal(steps[0].responsable,colega.id); assert.equal(steps[0].prioridad,'Alta'); assert.equal(steps[0].fecha_objetivo,'2026-11-12');
    await dialog.getByRole('combobox',{name:'Ordenar subtareas',exact:true}).selectOption('prioridad');
    await dialog.getByRole('button', { name: '+ Crear lista de control', exact: true }).click();
    await dialog.getByLabel('Nombre de la lista de control', { exact: true }).fill('Validación de cierre');
    await dialog.getByRole('button', { name: 'Crear lista', exact: true }).click();
    await dialog.getByLabel('Nuevo elemento en Validación de cierre', { exact: true }).fill('Comprobar evidencia');
    await dialog.getByRole('button', { name: 'Añadir elemento', exact: true }).click();
    await dialog.getByRole('checkbox', { name: 'Completar subtarea Preparar revisión', exact: true }).click();
    await dialog.locator('progress[aria-label="Progreso de la tarea"][value="50"]').waitFor();
    await dialog.getByRole('checkbox', { name: 'Completar elemento Comprobar evidencia', exact: true }).click();
    await dialog.locator('progress[aria-label="Progreso de la tarea"][value="100"]').waitFor();
    await dialog.getByRole('button', { name: 'Mostrar elementos completados (1)', exact: true }).click();
    await dialog.getByRole('checkbox', { name: 'Completar elemento Comprobar evidencia', exact: true }).click();
    await dialog.locator('progress[aria-label="Progreso de la tarea"][value="50"]').waitFor();
    steps = steps.map(step => ({ ...step, completado: false, revision: step.revision+1 }));
    emit('sistemas_pasos','UPDATE',steps[0]);
    await dialog.locator('progress[aria-label="Progreso de la tarea"][value="0"]').waitFor({ timeout: 2500 });
    await page.screenshot({ path: `test-results/sistemas/seguimiento-${rol}.png` });
    await dialog.getByLabel("Agregar comentario").fill("Revisión completada")
    await dialog.getByRole("button", { name: "Enviar comentario", exact: true }).click()
    await dialog.getByText("Revisión completada", { exact: true }).waitFor()
    comments.push({ id: 'remote-comment', autor: user.id, contenido: 'Comentario desde otra sesión', created_at: new Date().toISOString() });
    emit('sistemas_comentarios', 'INSERT', comments.at(-1));
    await dialog.getByText('Comentario desde otra sesión', { exact: true }).waitFor({ timeout: 2500 });
    const upload = dialog.getByLabel('Adjuntar archivos al comentario');
    await upload.setInputFiles({ name: 'falso.pdf', mimeType: 'application/pdf', buffer: Buffer.from('archivo inválido') });
    await dialog.getByText('El contenido del archivo no coincide con su extensión.', { exact: true }).waitFor();
    assert.equal(storageUploads, 0);
    await upload.setInputFiles({ name: 'documento.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nDocumento de prueba') });
    await dialog.getByText('documento.pdf', { exact: true }).waitFor();
    await dialog.getByLabel('Agregar comentario').fill('Documento para revisar');
    await dialog.getByRole('button', { name: 'Enviar comentario', exact: true }).click();
    await dialog.getByText('Documento para revisar', { exact: true }).waitFor();
    assert.equal(await dialog.getByRole('heading', { name: 'Documentos adjuntos' }).count(), 0);
    assert.equal(documents[0].comentario_id, comments.at(-1).id);
    const remoteDoc = { ...documents[0], id: 'remote-document', nombre: 'adjunto-remoto.pdf' };
    documents.push(remoteDoc);
    emit('sistemas_documentos', 'INSERT', remoteDoc);
    await dialog.getByText('adjunto-remoto.pdf', { exact: true }).waitFor({ timeout: 2500 });
    documents = documents.filter(doc => doc.id !== remoteDoc.id);
    emit('sistemas_documentos', 'DELETE', remoteDoc);
    await dialog.getByText('adjunto-remoto.pdf', { exact: true }).waitFor({ state: 'hidden', timeout: 2500 });
    await page.screenshot({ path: `test-results/sistemas/documentos-${rol}.png` });
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Descargar', exact: true }).click();
    assert.equal((await download).suggestedFilename(), 'documento.pdf');
    await dialog.getByRole('button', { name: 'Eliminar archivo documento.pdf', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirmar eliminación de archivo', exact: true }).click();
    await dialog.getByText('documento.pdf', { exact: true }).waitFor({ state: 'hidden' });
    await dialog.getByText('Descripción inicial de la tarea',{exact:true}).waitFor();
    await dialog.getByRole('button', { name: 'Editar contexto', exact: true }).click();
    const notas = dialog.getByLabel('Notas', { exact: true });
    assert.equal(await notas.evaluate(el => getComputedStyle(el).resize),'none');
    await notas.fill('Contexto breve');
    await dialog.getByRole('button',{name:'Terminar edición',exact:true}).click();
    assert.equal(await dialog.getByRole('button',{name:'Expandir',exact:true}).count(),0);
    await dialog.getByRole('button',{name:'Editar contexto',exact:true}).click();
    const contextoLargo = 'Objetivo del trabajo y criterios de aceptación.\n'.repeat(20);
    await notas.fill(contextoLargo);
    await dialog.getByRole('button',{name:'Terminar edición',exact:true}).click();
    await dialog.locator('.sys-context-preview.is-truncated').waitFor();
    assert.equal(await notas.isVisible(),false);
    await dialog.getByRole('button',{name:'Expandir',exact:true}).click();
    assert.equal(await dialog.locator('.sys-context-preview').evaluate(el=>el.scrollHeight<=el.clientHeight+1),true);
    await dialog.getByRole('button',{name:'Contraer',exact:true}).click();
    assert.equal(await dialog.locator('.sys-context-preview').evaluate(el=>el.scrollHeight>el.clientHeight),true);
    await dialog.getByRole('button',{name:'Editar contexto',exact:true}).click();
    assert.equal(await notas.inputValue(),contextoLargo);
    await notas.fill('Borrador que debe conservarse');
    tasks[0] = { ...tasks[0], revision: tasks[0].revision + 1 };
    emit('sistemas_tareas', 'UPDATE', tasks[0]);
    await dialog.getByText(/La tarea cambió en otra sesión/).waitFor({ timeout: 2500 });
    assert.equal(await dialog.getByRole('textbox', { name: /^Notas/ }).inputValue(), 'Borrador que debe conservarse');
    await page.keyboard.press("Escape")
    await page.getByLabel("Buscar", { exact: true }).fill("Sin coincidencias")
    await page.getByRole("heading", { name: "No hay coincidencias" }).waitFor()
    await page.getByLabel("Buscar", { exact: true }).fill("")
    await page.screenshot({ path: `test-results/sistemas/${rol}.png` })
    assert.deepEqual(errors, [])
    assert.equal(tasks.length, 1)
    assert.equal(tasks[0].estado, "En revisión")
    await page.getByRole('button', { name: 'Validación del módulo', exact: true }).click();
    await dialog.getByLabel('Opciones de tarea Validación del módulo', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Eliminar tarea', exact: true }).click();
    await dialog.getByRole('button', { name: 'Conservar tarea', exact: true }).click();
    assert.equal(tasks.length, 1);
    await dialog.getByLabel('Opciones de tarea Validación del módulo', { exact: true }).click();
    await dialog.getByRole('button', { name: 'Eliminar tarea', exact: true }).click();
    await dialog.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
    await dialog.getByText('No se pudo eliminar. Intenta nuevamente.', { exact: true }).waitFor();
    assert.equal(tasks.length, 1);
    await dialog.getByRole('button', { name: 'Confirmar eliminación', exact: true }).click();
    await page.getByText('El equipo aún no tiene tareas', { exact: true }).waitFor();
    assert.equal(tasks.length, 0);
    assert.equal(storageUploads, 1);
    tasks = [{ id: 'remote-task', titulo: 'Creada desde otra sesión', estado: 'Pendiente', notas: '', prioridad: 'Media', revision: 0 }];
    emit('sistemas_tareas', 'INSERT', tasks[0]);
    await page.getByRole('button', { name: 'Creada desde otra sesión', exact: true }).waitFor({ timeout: 2500 });
    const removed = tasks[0]; tasks = [];
    emit('sistemas_tareas', 'DELETE', removed);
    await page.getByText('El equipo aún no tiene tareas', { exact: true }).waitFor({ timeout: 2500 });
    console.log(`OK ${rol}: tareas, documentos, descarga, confirmación, cancelación y reintento de eliminación`)
    await page.close()
  }
} finally {
  await browser.close()
}
