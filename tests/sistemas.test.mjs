import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import { before, after, test } from "node:test"
import ts from "typescript"

const db = new PGlite()
const roles = ["gerente", "analista", "coordinador", "tesoreria"]
const ids = roles.map((_, i) => `40000000-0000-0000-0000-00000000000${i + 1}`)
async function as(index, sql, params = []) {
  await db.exec("begin; set local role authenticated;")
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [
      ids[index],
    ])
    const result = await db.query(sql, params)
    await db.exec("commit")
    return result
  } catch (error) {
    await db.exec("rollback")
    throw error
  }
}
before(async () => {
  await db.exec(`create role anon; create role authenticated; create schema auth;
    create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
    grant usage on schema auth to authenticated;
    create table public.perfiles(id uuid primary key, rol text, estado text);
    grant select on public.perfiles to authenticated;`)
  await db.exec(`create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
    alter table storage.objects enable row level security;
    create function storage.foldername(path text) returns text[] language sql immutable as $$select string_to_array(path,'/')$$;
    grant usage on schema storage to authenticated;
    grant select,insert,delete on storage.objects to authenticated;`)
  for (let i = 0; i < roles.length; i++)
    await db.query("insert into perfiles values($1,$2,'ACTIVO')", [
      ids[i],
      roles[i],
    ])
  await db.exec(
    readFileSync(
      "supabase/migrations/20261103165530_sistemas_tareas.sql",
      "utf8",
    ),
  )
  for (const file of ['20261103171045_sistemas_eliminar_tarea.sql', '20261103171113_sistemas_documentos.sql', '20261103172241_sistemas_adjuntos_comentarios.sql', '20261104131940_sistemas_subtareas_listas.sql', '20261104134034_sistemas_subtareas_propiedades.sql', '20261104134417_sistemas_asignados_multiples.sql', '20261104135431_sistemas_fechas_prioridad.sql']) {
    if (file.includes('adjuntos_comentarios')) {
      await db.query("insert into sistemas_tareas(id,titulo,creado_por) values('50000000-0000-0000-0000-000000000001','Archivo anterior',$1)",[ids[0]]);
      await db.query("insert into sistemas_documentos(tarea_id,nombre,ruta,tamano,autor) values('50000000-0000-0000-0000-000000000001','anterior.pdf',$1,100,$2)",[`50000000-0000-0000-0000-000000000001/${ids[0]}/anterior.pdf`,ids[0]]);
    }
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  }
});
after(() => db.close())
test("Sistemas es accesible por navegación para los cuatro roles", async () => {
  const js = ts.transpileModule(readFileSync("src/app/navigation.ts", "utf8"), {
    compilerOptions: { module: ts.ModuleKind.ESNext },
  }).outputText
  const { canAccessView, NAVIGATION_BY_ROLE } = await import(
    `data:text/javascript;base64,${Buffer.from(js).toString("base64")}`
  )
  for (const rol of roles) {
    assert.equal(canAccessView(rol, "sistemas"), true)
    assert.equal(
      NAVIGATION_BY_ROLE[rol].filter((item) => item.id === "sistemas").length,
      1,
    )
  }
})
test("Todos los roles activos crean, consultan, actualizan y comentan tareas compartidas", async () => {
  for (let i = 0; i < roles.length; i++) {
    const {
      rows: [task],
    } = await as(
      i,
      "insert into sistemas_tareas(titulo) values('Prueba de permisos') returning *",
    )
    assert.equal(task.creado_por, ids[i])
    const next = (i + 1) % roles.length
    const updated = await as(
      next,
      "update sistemas_tareas set estado='En revisión',revision=revision+1 where id=$1 and revision=0 returning *",
      [task.id],
    )
    assert.equal(updated.rows[0].estado, "En revisión")
    const stale = await as(
      i,
      "update sistemas_tareas set estado='Completado' where id=$1 and revision=0 returning id",
      [task.id],
    )
    assert.equal(stale.rows.length, 0)
    const comment = await as(
      next,
      "insert into sistemas_comentarios(tarea_id,contenido) values($1,'Avance registrado') returning autor",
      [task.id],
    )
    assert.equal(comment.rows[0].autor, ids[next])
  }
})
test("Se rechazan autores falsos, títulos vacíos y estados no válidos", async () => {
  await assert.rejects(
    as(
      0,
      "insert into sistemas_tareas(titulo,creado_por) values('Intento',$1)",
      [ids[1]],
    ),
    /row-level security/,
  )
  await assert.rejects(
    as(0, "insert into sistemas_tareas(titulo) values('   ')"),
    /check constraint/,
  )
  await assert.rejects(
    as(
      0,
      "insert into sistemas_tareas(titulo,estado) values('Intento','Desconocido')",
    ),
    /check constraint/,
  )
})
test('Todos los roles eliminan tareas y comentarios y rechazan revisiones antiguas', async () => {
  for (let i = 0; i < roles.length; i++) {
    const { rows: [t] } = await as(i, "insert into sistemas_tareas(titulo) values('Eliminar') returning *");
    await as(i, "insert into sistemas_comentarios(tarea_id,contenido) values($1,'Comentario')", [t.id]);
    assert.equal((await as(i, 'delete from sistemas_tareas where id=$1 and revision=9 returning id', [t.id])).rows.length, 0);
    assert.equal((await as(i, 'delete from sistemas_tareas where id=$1 and revision=0 returning id', [t.id])).rows.length, 1);
    assert.equal((await db.query('select * from sistemas_comentarios where tarea_id=$1', [t.id])).rows.length, 0);
  }
});
test('Documentos privados: carga propia, lectura compartida y eliminación protegida', async () => {
  for (let i = 0; i < roles.length; i++) {
    const { rows: [t] } = await as(i, "insert into sistemas_tareas(titulo) values('Documentación') returning *");
    const ruta = `${t.id}/${ids[i]}/documento.pdf`;
    await as(i, "insert into storage.objects(bucket_id,name) values('sistemas-documentos',$1)", [ruta]);
    await assert.rejects(as((i+1)%4, "insert into storage.objects(bucket_id,name) values('sistemas-documentos',$1)", [ruta]), /row-level security/);
    await as(i, 'insert into sistemas_documentos(tarea_id,nombre,ruta,tamano) values($1,$2,$3,100)', [t.id,'documento.pdf',ruta]);
    await assert.rejects(as(i, 'delete from sistemas_tareas where id=$1', [t.id]), /foreign key constraint/);
    assert.equal((await as((i+1)%4, 'select * from sistemas_documentos where tarea_id=$1', [t.id])).rows.length, 1);
    await as(i, 'delete from storage.objects where name=$1', [ruta]);
    await as(i, 'delete from sistemas_documentos where tarea_id=$1', [t.id]);
    await as(i, 'delete from sistemas_tareas where id=$1', [t.id]);
  }
  assert.equal((await db.query("select public from storage.buckets where id='sistemas-documentos'")).rows[0].public, false);
});
test('La migración conserva los archivos existentes y los vincula a comentarios de su autor', async () => {
  const { rows: [doc] } = await db.query("select d.nombre,c.autor,c.contenido from sistemas_documentos d join sistemas_comentarios c on c.id=d.comentario_id where d.nombre='anterior.pdf'");
  assert.equal(doc.autor,ids[0]);
  assert.equal(doc.contenido,'Archivo adjunto');
});
test('Publica comentarios con archivos de forma atómica y sin duplicados al reintentar', async () => {
  for (let i=0; i<roles.length; i++) {
    const { rows: [t] } = await as(i, "insert into sistemas_tareas(titulo) values('Comentario con archivo') returning *");
    const { rows: [doc] } = await as(i, 'insert into sistemas_documentos(tarea_id,nombre,ruta,tamano) values($1,$2,$3,100) returning *', [t.id,'adjunto.pdf',`${t.id}/${ids[i]}/adjunto.pdf`]);
    const { rows: [id] } = await db.query('select gen_random_uuid() as id');
    await assert.rejects(as((i+1)%4, "select * from publicar_comentario_sistemas($1,$2,'Intento',$3)", [id.id,t.id,[doc.id]]), /no están disponibles/);
    assert.equal((await db.query('select * from sistemas_comentarios where id=$1',[id.id])).rows.length,0);
    const published = await as(i, "select * from publicar_comentario_sistemas($1,$2,'',$3)", [id.id,t.id,[doc.id]]);
    assert.equal(published.rows[0].contenido,'');
    assert.equal((await as(i,'select comentario_id from sistemas_documentos where id=$1',[doc.id])).rows[0].comentario_id,id.id);
    await as(i, "select * from publicar_comentario_sistemas($1,$2,'',$3)", [id.id,t.id,[doc.id]]);
    assert.equal((await db.query('select * from sistemas_comentarios where id=$1',[id.id])).rows.length,1);
    await assert.rejects(as(i, "select * from publicar_comentario_sistemas(gen_random_uuid(),$1,'','{}')",[t.id]),/Escribe un comentario/);
  }
});
test('Subtareas y listas: cuatro roles, validación de tarea, revisión y borrado en cascada', async () => {
  for (let i=0;i<roles.length;i++) {
    const {rows:[task]} = await as(i,"insert into sistemas_tareas(titulo) values('Seguimiento') returning *");
    const {rows:[other]} = await as(i,"insert into sistemas_tareas(titulo) values('Otra tarea') returning *");
    const {rows:[list]} = await as(i,"insert into sistemas_listas(tarea_id,titulo) values($1,'Control final') returning *",[task.id]);
    const {rows:[step]} = await as(i,"insert into sistemas_pasos(tarea_id,tipo,titulo) values($1,'SUBTAREA','Preparación') returning *",[task.id]);
    await as(i,"insert into sistemas_pasos(tarea_id,lista_id,tipo,titulo) values($1,$2,'CONTROL','Verificación')",[task.id,list.id]);
    await assert.rejects(as(i,"insert into sistemas_pasos(tarea_id,lista_id,tipo,titulo) values($1,$2,'CONTROL','Ajeno')",[other.id,list.id]),/foreign key/);
    await assert.rejects(as(i,"insert into sistemas_pasos(tarea_id,tipo,titulo) values($1,'CONTROL','Sin lista')",[task.id]),/check constraint/);
    await assert.rejects(as(i,"insert into sistemas_listas(tarea_id,titulo) values($1,'   ')",[task.id]),/check constraint/);
    const updated = await as((i+1)%4,'update sistemas_pasos set completado=true,revision=revision+1 where id=$1 and revision=0 returning id',[step.id]);
    assert.equal(updated.rows.length,1);
    assert.equal((await as(i,'update sistemas_pasos set completado=false where id=$1 and revision=0 returning id',[step.id])).rows.length,0);
    await assert.rejects(as(i,'update sistemas_pasos set tarea_id=$1 where id=$2',[other.id,step.id]),/permission denied/);
    await as(i,'delete from sistemas_listas where id=$1',[list.id]);
    assert.equal((await db.query('select * from sistemas_pasos where lista_id=$1',[list.id])).rows.length,0);
    await as(i,'delete from sistemas_tareas where id=$1',[task.id]);
    assert.equal((await db.query('select * from sistemas_pasos where tarea_id=$1',[task.id])).rows.length,0);
  }
});
test('Asignados múltiples: guarda, elimina y valida personas sin perder compatibilidad con el responsable anterior', async () => {
  for (let i=0;i<roles.length;i++) {
    const next=(i+1)%roles.length;
    const {rows:[task]}=await as(i,'insert into sistemas_tareas(titulo,responsable) values($1,$2) returning *',['Asignaciones',ids[i]]);
    assert.deepEqual(task.asignados,[ids[i]]);
    const {rows:[updated]}=await as(i,'update sistemas_tareas set asignados=$1 where id=$2 returning *',[[ids[i],ids[next]],task.id]);
    assert.deepEqual(updated.asignados,[ids[i],ids[next]]);
    assert.equal(updated.responsable,ids[i]);
    await assert.rejects(as(i,'update sistemas_tareas set asignados=$1 where id=$2',[[ids[i],ids[i]],task.id]),/no es válida/);
    await assert.rejects(as(i,"update sistemas_tareas set asignados=array['99999999-9999-4999-8999-999999999999']::uuid[] where id=$1",[task.id]),/usuarios activos/);
    assert.equal((await as(i,'update sistemas_tareas set asignados=$1 where id=$2 returning responsable',[[ids[next]],task.id])).rows[0].responsable,ids[next]);
    assert.equal((await as(i,"update sistemas_tareas set asignados='{}' where id=$1 returning responsable",[task.id])).rows[0].responsable,null);
    assert.equal((await as(i,'select id from sistemas_tareas where id=$1',[task.id])).rows.length,1);
  }
});
test('Las subtareas conservan responsable, fecha y prioridad y rechazan prioridades inválidas', async () => {
  const {rows:[task]}=await as(0,"insert into sistemas_tareas(titulo) values('Subtarea con propiedades') returning *");
  const {rows:[step]}=await as(0,"insert into sistemas_pasos(tarea_id,tipo,titulo,responsable,fecha_objetivo,prioridad) values($1,'SUBTAREA','Preparar',$2,'2026-11-10','Alta') returning *",[task.id,ids[1]]);
  assert.equal(step.prioridad,'Alta'); assert.equal(step.responsable,ids[1]);
  assert.equal((await as(1,'update sistemas_pasos set prioridad=$1 where id=$2 returning prioridad',['Urgente',step.id])).rows[0].prioridad,'Urgente');
  await assert.rejects(as(0,"update sistemas_pasos set prioridad='Inválida' where id=$1",[step.id]),/check constraint/);
});
test('Las tareas guardan inicio y vencimiento, permiten quitar la prioridad y rechazan rangos invertidos', async () => {
  const {rows:[task]}=await as(0,"insert into sistemas_tareas(titulo,fecha_inicio,fecha_objetivo,prioridad) values('Calendario','2026-11-10','2026-11-12',null) returning *");
  assert.equal(task.prioridad,null);
  assert.ok(task.fecha_inicio);
  await assert.rejects(as(0,"update sistemas_tareas set fecha_inicio='2026-11-15' where id=$1",[task.id]),/sistemas_tareas_rango_fechas/);
  assert.equal((await as(1,'update sistemas_tareas set fecha_inicio=null,fecha_objetivo=null,prioridad=$1 where id=$2 returning prioridad',['Alta',task.id])).rows[0].prioridad,'Alta');
});
test("Un usuario inactivo no puede consultar ni crear tareas", async () => {
  await db.query("update perfiles set estado='INACTIVO' where id=$1", [ids[3]])
  assert.equal((await as(3, "select * from sistemas_tareas")).rows.length, 0)
  assert.equal((await as(3, 'delete from sistemas_tareas returning id')).rows.length, 0);
  assert.equal((await as(3, 'select * from sistemas_documentos')).rows.length, 0);
  assert.equal((await as(3, 'select * from sistemas_pasos')).rows.length, 0);
  await assert.rejects(as(0,'update sistemas_tareas set asignados=$1 where id=$2',[[ids[3]],'50000000-0000-0000-0000-000000000001']),/usuarios activos/);
  assert.equal((await as(3, 'delete from sistemas_listas returning id')).rows.length, 0);
  await assert.rejects(as(3,"insert into sistemas_listas(tarea_id,titulo) values('50000000-0000-0000-0000-000000000001','Sin permiso')"),/row-level security/);
  await assert.rejects(as(3, "insert into storage.objects(bucket_id,name) values('sistemas-documentos','invalido')"), /row-level security/);
  await assert.rejects(
    as(3, "insert into sistemas_tareas(titulo) values('Intento inactivo')"),
    /row-level security/,
  )
})
