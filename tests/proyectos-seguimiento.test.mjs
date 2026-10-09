import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';

const db = new PGlite();
const migration = readFileSync(new URL('../supabase/migrations/20261009133455_proyectos_avance_evidencias_garantias.sql', import.meta.url), 'utf8');
const uid = n => `70000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const users = { analista: uid(1), coordinador: uid(2), gerente: uid(3), inactivo: uid(4) };
const project = uid(10), otherProject = uid(11), photo = uid(20), incident = uid(30), outside = uid(31);
async function as(role, sql, args = []) {
  await db.exec('begin; set local role authenticated;');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [users[role]]);
    const result = await db.query(sql, args);
    await db.exec('commit');
    return result;
  } catch (error) { await db.exec('rollback'); throw error; }
}
before(async () => {
  await db.exec(`create role authenticated; create role anon; create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.perfiles(id uuid primary key,nombre text,rol text,estado text);
    create table public.proyectos(id uuid primary key,activo boolean default true);
    create table public.materiales(sku text primary key);
    create table public.requerimientos(id uuid primary key,proyecto_id uuid references public.proyectos);
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    grant usage on schema public,auth,storage to authenticated;
    grant select on public.perfiles,public.materiales,public.requerimientos to authenticated;
    grant select,insert,update on public.proyectos to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
    alter table public.proyectos enable row level security;
    create policy projects_read on public.proyectos for select to authenticated using(true);
    create policy projects_edit on public.proyectos for update to authenticated using(exists(select 1 from public.perfiles where id=auth.uid() and rol in ('analista','coordinador')));
    alter table storage.objects enable row level security;
  `);
  for (const [role, id] of Object.entries(users)) await db.query('insert into public.perfiles values($1,$2,$3,$4)', [id, role, role === 'inactivo' ? 'analista' : role, role === 'inactivo' ? 'INACTIVO' : 'ACTIVO']);
  await db.query('insert into public.proyectos(id) values($1),($2)', [project, otherProject]);
  await db.exec(migration);
});
after(() => db.close());
test('avance: coordinador, evidencia obligatoria, fecha válida y cierre irreversible', async () => {
  await assert.rejects(as('analista', "update public.proyectos set estado_obra='EN_CONSTRUCCION' where id=$1", [project]), /Solo el coordinador/);
  await assert.rejects(as('inactivo', "update public.proyectos set estado_obra='EN_CONSTRUCCION' where id=$1", [project]), /Solo el coordinador/);
  await as('coordinador', "update public.proyectos set estado_obra='EN_CONSTRUCCION' where id=$1", [project]);
  await assert.rejects(as('coordinador', "update public.proyectos set estado_obra='FINALIZADO',fecha_finalizacion='2024-02-29' where id=$1", [project]), /foto/);
  await assert.rejects(as('coordinador', "update public.proyectos set estado_obra='FINALIZADO',fecha_finalizacion='2099-01-01' where id=$1", [project]), /no futura/);
  const path = `${project}/${users.analista}/${photo}.png`;
  await as('analista', 'insert into storage.objects values($1,$2)', ['proyectos-evidencias', path]);
  await as('analista', "insert into public.proyecto_evidencias(id,proyecto_id,etapa,ruta,nombre) values($1,$2,'INSTALACION_FINAL',$3,'Instalación.png')", [photo, project, path]);
  const result = await as('coordinador', "update public.proyectos set estado_obra='FINALIZADO',fecha_finalizacion='2024-02-29' where id=$1 returning garantia_hasta::text,revision_obra", [project]);
  assert.equal(result.rows[0].garantia_hasta, '2025-02-28');
  assert.equal(result.rows[0].revision_obra, 2);
  await assert.rejects(as('coordinador', "update public.proyectos set estado_obra='EN_CONSTRUCCION',fecha_finalizacion=null where id=$1", [project]), /ya está cerrado/);
  await assert.rejects(as('coordinador', "update public.proyectos set fecha_finalizacion='2024-03-01' where id=$1", [project]), /ya está cerrado/);
  const stale = await as('coordinador', "update public.proyectos set estado_obra='PAUSADO' where id=$1 and revision_obra=0 returning id", [project]);
  assert.equal(stale.rows.length, 0);
});
test('fotos privadas: etapa, carpeta propia, objeto existente y limpieza de cargas sin vincular', async () => {
  const path = `${otherProject}/${users.analista}/${uid(21)}.jpg`;
  await assert.rejects(as('gerente', 'insert into storage.objects values($1,$2)', ['proyectos-evidencias', path]), /row-level security/);
  await assert.rejects(as('coordinador', 'insert into storage.objects values($1,$2)', ['proyectos-evidencias', path]), /row-level security/);
  await assert.rejects(as('inactivo', 'insert into storage.objects values($1,$2)', ['proyectos-evidencias', path]), /row-level security/);
  await as('analista', 'insert into storage.objects values($1,$2)', ['proyectos-evidencias', path]);
  await assert.rejects(as('analista', "insert into public.proyecto_evidencias(proyecto_id,etapa,ruta,nombre) values($1,'PROCESO',$2,'foto.jpg')", [otherProject, path]), /construcción/);
  assert.equal((await as('analista', 'delete from storage.objects where name=$1 returning name', [path])).rows.length, 1);
  const linked = `${project}/${users.analista}/${photo}.png`;
  assert.equal((await as('analista', 'delete from storage.objects where name=$1 returning name', [linked])).rows.length, 0);
  await assert.rejects(as('analista', "insert into public.proyecto_evidencias(proyecto_id,etapa,ruta,nombre) values($1,'INSTALACION_FINAL',$2,'foto.jpg')", [project, `${project}/${users.analista}/${uid(22)}.jpg`]), /Primero carga/);
  assert.equal((await as('gerente', 'select * from public.proyecto_evidencias')).rows.length, 1);
  assert.equal((await as('inactivo', 'select * from public.proyecto_evidencias')).rows.length, 0);
  const bucket = (await db.query("select * from storage.buckets where id='proyectos-evidencias'")).rows[0];
  assert.equal(bucket.public, false); assert.equal(bucket.file_size_limit, 5242880);
});
test('incidencias: fecha reportada, plazo histórico, aprobación manual y revisión por coordinador', async () => {
  await assert.rejects(as('analista', "insert into public.proyecto_incidencias(proyecto_id,producto,descripcion,fecha_incidencia) values($1,'Llave','Fuga','2099-01-01')", [project]), /futura/);
  await assert.rejects(as('gerente', "insert into public.proyecto_incidencias(proyecto_id,producto,descripcion,fecha_incidencia) values($1,'Llave','Fuga','2024-05-01')", [project]), /permiso/);
  await as('analista', "insert into public.proyecto_incidencias(id,proyecto_id,producto,descripcion,fecha_incidencia) values($1,$2,'Llave','Fuga','2025-02-28'),($3,$2,'Llave','Fuga','2025-03-01')", [incident, project, outside]);
  const rows = (await as('coordinador', 'select id,plazo_garantia,cobertura from public.proyecto_incidencias order by fecha_incidencia')).rows;
  assert.deepEqual(rows.map(r => r.plazo_garantia), ['DENTRO', 'FUERA']);
  assert.ok(rows.every(r => r.cobertura === 'PENDIENTE'));
  assert.equal((await as('analista', "update public.proyecto_incidencias set cobertura='CUBIERTA' where id=$1 returning id", [incident])).rows.length, 0);
  await assert.rejects(as('coordinador', "update public.proyecto_incidencias set cobertura='CUBIERTA' where id=$1", [outside]), /fuera del plazo/);
  await assert.rejects(as('coordinador', "update public.proyecto_incidencias set estado='RESUELTA',resolucion='Reparada' where id=$1", [incident]), /revisa la cobertura/);
  await as('coordinador', "update public.proyecto_incidencias set estado='EN_REVISION',cobertura='CUBIERTA' where id=$1", [incident]);
  await assert.rejects(as('coordinador', "update public.proyecto_incidencias set estado='PROGRAMADA' where id=$1", [incident]), /fecha de atención/);
  await assert.rejects(as('coordinador', "update public.proyecto_incidencias set estado='RESUELTA' where id=$1", [incident]), /resolución/);
  await db.query('insert into public.requerimientos values($1,$2)', [uid(50), otherProject]);
  await assert.rejects(as('coordinador', 'update public.proyecto_incidencias set requerimiento_id=$1 where id=$2', [uid(50), incident]), /pertenecer/);
  await as('coordinador', "update public.proyecto_incidencias set estado='RESUELTA',resolucion='Llave reemplazada' where id=$1", [incident]);
  await assert.rejects(as('coordinador', "update public.proyecto_incidencias set estado='EN_REVISION' where id=$1", [incident]), /ya está cerrada/);
  await assert.rejects(as('coordinador', "update public.proyecto_incidencias set garantia_hasta='2099-01-01' where id=$1", [incident]), /permission denied/);
});
test('las fotos de incidencia pertenecen al mismo proyecto', async () => {
  await as('coordinador', "update public.proyectos set estado_obra='EN_CONSTRUCCION' where id=$1", [otherProject]);
  const path = `${otherProject}/${users.analista}/${uid(23)}.jpg`;
  await as('analista', 'insert into storage.objects values($1,$2)', ['proyectos-evidencias', path]);
  await assert.rejects(as('analista', "insert into public.proyecto_evidencias(proyecto_id,incidencia_id,etapa,ruta,nombre) values($1,$2,'INCIDENCIA',$3,'foto.jpg')", [otherProject, incident, path]), /foreign key/);
});
const compiled = ts.transpileModule(readFileSync(new URL('../src/features/proyectos/seguimiento.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { garantiaProyecto, hoyPeru } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
test('fechas de Perú y límite inclusivo de garantía', () => {
  assert.equal(hoyPeru(new Date('2026-10-10T02:30:00Z')), '2026-10-09');
  assert.equal(garantiaProyecto(undefined, undefined), 'Pendiente de finalización');
  assert.equal(garantiaProyecto('2025-10-09', '2026-10-09', '2026-10-09'), 'Garantía vigente');
  assert.equal(garantiaProyecto('2025-10-09', '2026-10-09', '2026-10-10'), 'Garantía vencida');
});
