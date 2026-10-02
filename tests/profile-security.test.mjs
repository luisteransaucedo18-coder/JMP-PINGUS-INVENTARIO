import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { before, after, test } from 'node:test';
import ts from 'typescript';
const db = new PGlite();
const migration = readFileSync(new URL('../supabase/migrations/20261002154130_mi_perfil_foto_segura.sql', import.meta.url), 'utf8');
const ids = { gerente: '40000000-0000-4000-8000-000000000001', analista: '40000000-0000-4000-8000-000000000002', coordinador: '40000000-0000-4000-8000-000000000003', inactivo: '40000000-0000-4000-8000-000000000004' };
const file = '50000000-0000-4000-8000-000000000001.png';
async function as(role, sql, params = []) {
  await db.exec('begin; set local role authenticated;');
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [ids[role]]);
    const result = await db.query(sql, params);
    await db.exec('commit'); return result;
  } catch (error) { await db.exec('rollback'); throw error; }
}
before(async () => {
  await db.exec(`create role authenticated; create role anon; create schema auth; create schema storage;
    create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
    create table public.perfiles(id uuid primary key,nombre text,email text,rol text,sede text,estado text,telefono text,cargo text,bio text,updated_at timestamptz default now());
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(bucket_id text,name text,primary key(bucket_id,name));
    create function storage.foldername(text) returns text[] language sql immutable as $$ select (string_to_array($1,'/'))[1:array_length(string_to_array($1,'/'),1)-1] $$;
    grant usage on schema public,auth,storage to authenticated;
    grant select,update on public.perfiles to authenticated;
    grant select,insert,delete on storage.objects to authenticated;
    alter table public.perfiles enable row level security; alter table storage.objects enable row level security;
    create policy read_profiles on public.perfiles for select to authenticated using(true);
    create policy edit_own on public.perfiles for update to authenticated using(id=auth.uid()) with check(id=auth.uid());
    create policy existing_manager on public.perfiles for update to authenticated using(exists(select 1 from public.perfiles where id=auth.uid() and rol='gerente')) with check(true);
  `);
  for (const [role, id] of Object.entries(ids)) await db.query("insert into public.perfiles values($1,$2,$3,$2,'Trujillo',$4,'123','Cargo real','Bio real',now())", [id, role, `${role}@test.invalid`, role === 'inactivo' ? 'INACTIVO' : 'ACTIVO']);
  await db.exec(migration);
});
after(() => db.close());
for (const role of ['gerente','analista','coordinador']) {
  test(`${role}: actualiza solo campos propios, mantiene rol, sede y correo`, async () => {
    const result = await as(role, "select * from public.actualizar_mi_perfil($1,$2,$3,$4)", [`Nombre ${role}`, '987', 'Cargo', 'Biografía']);
    assert.equal(result.rows[0].id, ids[role]); assert.equal(result.rows[0].rol,role);
    assert.equal(result.rows[0].sede,'Trujillo'); assert.equal(result.rows[0].email,`${role}@test.invalid`);
    assert.equal(result.rows[0].nombre,`Nombre ${role}`);
  });
  test(`${role}: foto propia persistida, no permite carpeta ajena ni archivo inexistente`, async () => {
    const path = `${ids[role]}/${file}`;
    await as(role,'insert into storage.objects values($1,$2)',['fotos-perfil',path]);
    const saved = await as(role,"select * from public.actualizar_mi_perfil('Foto','123','Cargo','Bio',$1)",[path]);
    assert.equal(saved.rows[0].foto_path,path);
    assert.equal(saved.rows[0].foto_url,`/storage/v1/object/authenticated/fotos-perfil/${path}`);
    await assert.rejects(as(role,"select * from public.actualizar_mi_perfil('No','123','Cargo','Bio',$1)",[`${ids[role]}/50000000-0000-4000-8000-000000000009.png`]),/archivo propio/);
    const other = role === 'analista' ? 'gerente' : 'analista';
    await assert.rejects(as(role,'insert into storage.objects values($1,$2)',['fotos-perfil',`${ids[other]}/${file}`]),/row-level security/);
    await assert.rejects(as(role,"select * from public.actualizar_mi_perfil('No','123','Cargo','Bio',$1)",[`${ids[other]}/${file}`]),/archivo propio/);
    assert.equal((await as(role,'delete from storage.objects where bucket_id=$1 and name=$2 returning *',['fotos-perfil',path])).rows.length,0,'foto guardada no se elimina');
    const unlinked = `${ids[role]}/50000000-0000-4000-8000-000000000002.webp`;
    await as(role,'insert into storage.objects values($1,$2)',['fotos-perfil',unlinked]);
    assert.equal((await as(role,'delete from storage.objects where name=$1 returning *',[unlinked])).rows.length,1,'se limpia la carga fallida');
  });
}
test('rechaza inactivos, campos vacíos, sin sesión y archivos de otros formatos', async () => {
  await assert.rejects(as('inactivo',"select * from public.actualizar_mi_perfil('Nombre','','','')"),/perfil activo/);
  await assert.rejects(as('analista',"select * from public.actualizar_mi_perfil('   ','','','')"),/Revisa/);
  await assert.rejects(as('analista','insert into storage.objects values($1,$2)',['fotos-perfil',`${ids.analista}/50000000-0000-4000-8000-000000000005.svg`]),/row-level security/);
  assert.equal((await db.query("select file_size_limit,public,allowed_mime_types from storage.buckets where id='fotos-perfil'")).rows[0].file_size_limit, 5242880);
  await assert.rejects(as('gerente',"update public.perfiles set foto_path=$1,foto_url=$2 where id=$3",[`${ids.gerente}/${file}`,`/storage/v1/object/authenticated/fotos-perfil/${ids.gerente}/${file}`,ids.analista]),/propia foto/);
});
const module = ts.transpileModule(readFileSync(new URL('../src/utils/profilePhoto.ts',import.meta.url),'utf8'), { compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const { validateProfilePhoto } = await import(`data:text/javascript;base64,${Buffer.from(module).toString('base64')}`);
test('valida JPG, PNG y WebP reales; rechaza MIME/extensión/firma incorrectos, vacíos y >5 MB', async () => {
  for (const [name, type, bytes] of [['foto.jpg','image/jpeg',[255,216,255]],['foto.png','image/png',[137,80,78,71,13,10,26,10]],['foto.webp','image/webp',Array.from(Buffer.from('RIFF0000WEBP'))]]) assert(await validateProfilePhoto(new File([new Uint8Array(bytes)],name,{type})));
  for (const bad of [new File(['txt'],'foto.png',{type:'image/png'}),new File(['svg'],'foto.svg',{type:'image/svg+xml'}),new File([],'empty.png',{type:'image/png'}),new File([new Uint8Array(5242881)],'big.png',{type:'image/png'})]) await assert.rejects(validateProfilePhoto(bad));
});
