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
    let documents = [];
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
          url.searchParams.get("select") === "id,nombre" ? [perfil] : perfil
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
    if (mobile) await page.getByRole("button", { name: "Abrir menú" }).click()
    await page
      .locator(mobile ? ".mobile-sidebar" : ".desktop-sidebar")
      .getByRole("button", { name: "Sistemas", exact: true })
      .press("Enter")
    await page
      .getByText("El equipo aún no tiene tareas", { exact: true })
      .waitFor()
    await page
      .getByRole("button", { name: "+ Nueva tarea", exact: true })
      .first()
      .click()
    const dialog = page.getByRole("dialog")
    await dialog
      .getByLabel("Tarea", { exact: true })
      .fill("Validación del módulo")
    await dialog
      .getByRole('combobox', { name: /^Responsable/ })
      .selectOption(user.id)
    await dialog.getByRole("button", { name: "Guardar tarea" }).click()
    await page
      .getByRole("button", { name: "Validación del módulo", exact: true })
      .waitFor()
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
    if (!mobile) {
      await page.getByRole('button', { name: 'Tablero', exact: true }).click();
      assert.equal(await dialog.isVisible(), true);
    }
    await page.screenshot({ path: `test-results/sistemas/detalle-${rol}.png` });
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
    await dialog.getByLabel('Notas', { exact: true }).fill('Borrador que debe conservarse');
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
