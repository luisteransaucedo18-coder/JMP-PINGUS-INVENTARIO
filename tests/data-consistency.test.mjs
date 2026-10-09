import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import ts from 'typescript';
const load = async path => {
  const compiled = ts.transpileModule(readFileSync(path, 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
};
const { publicCode } = await load('src/utils/publicCode.ts');
const { deliveryBalance } = await load('src/utils/deliveryBalance.ts');
const { ownedBy } = await load('src/utils/recordOwner.ts');
const { limaDate, limaTime } = await load('src/utils/limaDate.ts');
const id = n => `60000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
test('referencias públicas conservan SKU/correlativos, nunca sustituyen códigos ausentes por UUID', () => {
  assert.equal(publicCode({ id: id(1), codigo: 'REQ-2026-111' }), 'REQ-2026-111');
  assert.equal(publicCode({ id: id(1) }), 'Sin código');
  assert.equal(publicCode({ codigo: id(1), id: id(2) }), 'Sin código');
  assert.equal(publicCode({ id: '104' }), '104');
  assert.equal(publicCode({ codigo: '', id: 'OC-2026-1' }), 'OC-2026-1');
});
test('propiedad usa identidad, no nombres compartidos o coincidencias parciales', () => {
  const user = { id: id(1), nombre: 'Luis Pérez' };
  assert.equal(ownedBy({ analistaId: id(2), analista: 'Luis Pérez' }, user), false);
  assert.equal(ownedBy({ analistaId: id(1), analista: 'Nombre anterior' }, user), true);
  assert.equal(ownedBy({ analista: 'Luis Torres' }, user), false);
});
test('saldos acumulan entregas, ignoran cancelaciones y señalan excesos sin ocultarlos', () => {
  const req = { id: id(10), materiales: [{ skuId: 'A', cantidad: 12 }, { skuId: 'B', cantidad: 2.5 }] };
  const delivery = (n, quantity, estado = 'PARCIAL') => ({ id: id(n), requerimientoId: req.id, estado, items: [{ skuId: 'A', cantidadEntregada: quantity }] });
  assert.equal(deliveryBalance(req, []).status, null);
  assert.equal(deliveryBalance(req, [delivery(1, 5), delivery(2, 7), delivery(3, 12, 'CANCELADA')]).rows[0].remaining, 0);
  const excess = deliveryBalance(req, [delivery(1, 31)]);
  assert.equal(excess.hasExcess, true);
  assert.equal(excess.rows[0].excess, 19);
  assert.equal(excess.status, 'PARCIAL');
});
test('fecha y hora de entregas usan Lima incluso cerca de medianoche UTC', () => {
  const date = new Date('2026-10-06T02:30:00Z');
  assert.equal(limaDate(date), '2026-10-05');
  assert.match(limaTime(date), /09:30|21:30/);
});
test('servidor: roles, saldos acumulados, metadatos canónicos, decimales y rollback', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create type estado_entrega as enum ('PENDIENTE','PARCIAL','COMPLETA','CANCELADA');
      create table perfiles(id uuid primary key,rol text,estado text);
      create function rol_actual() returns text language sql stable as $$ select rol from perfiles where id=auth.uid() $$;
      create table proyectos(id uuid primary key,nombre text);
      create table requerimientos(id uuid primary key,proyecto_id uuid,analista_id uuid,estado text);
      create table requerimiento_items(requerimiento_id uuid,material_sku text,material_nombre text,cantidad numeric,unidad text,primary key(requerimiento_id,material_sku));
      create table entregas(id uuid primary key,requerimiento_id uuid,proyecto_nombre text,tecnico text,dni_tecnico text,responsable_entrega_id uuid,fecha_hora timestamptz,estado estado_entrega,observaciones text);
      create table entrega_items(entrega_id uuid,material_sku text,material_nombre text,cantidad_solicitada numeric,cantidad_entregada numeric,primary key(entrega_id,material_sku));
      grant usage on schema auth to authenticated;
      grant select on perfiles,requerimientos to authenticated;
      insert into perfiles values ('${id(1)}','analista','ACTIVO'),('${id(2)}','analista','ACTIVO'),('${id(3)}','coordinador','ACTIVO'),('${id(4)}','gerente','ACTIVO'),('${id(5)}','analista','INACTIVO');
      insert into proyectos values ('${id(10)}','Proyecto A');
      insert into requerimientos values ('${id(20)}','${id(10)}','${id(1)}','CONFIRMADO');
      insert into requerimiento_items values ('${id(20)}','A','Material canónico',12,'UND'),('${id(20)}','B','Cable',2.5,'MTS');
    `);
    await db.exec(readFileSync('supabase/migrations/20261006142652_entrega_saldos_y_roles.sql', 'utf8'));
    const item = (sku, quantity) => ({ material_sku: sku, material_nombre: 'Nombre falsificado', cantidad_solicitada: 999, cantidad_entregada: quantity });
    const submit = async (user, items) => {
      await db.exec('begin');
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id(user)]);
        const result = await db.query('select registrar_entrega($1,$2,$3,$4,$5::jsonb) as id', [id(20), 'Técnico', '', '', JSON.stringify(items)]);
        await db.exec('commit'); return result.rows[0].id;
      } catch (error) { await db.exec('rollback'); throw error; }
    };
    for (const role of [2,4,5]) await assert.rejects(submit(role, [item('A',1)]), /permisos|tus requerimientos/);
    await assert.rejects(submit(1,[item('A',1),item('A',1)]), /repitas/);
    await assert.rejects(submit(1,[item('A',-1)]), /inválida/);
    await assert.rejects(submit(1,[item('A',0.5)]), /enteras/);
    await assert.rejects(submit(1,[item('C',1)]), /no pertenece/);
    await assert.rejects(submit(1,[item('A',0)]), /mayor que cero/);
    const first = await submit(1,[item('A',5),item('B',1.25)]);
    const saved = (await db.query('select * from entrega_items where entrega_id=$1 and material_sku=$2',[first,'A'])).rows[0];
    assert.equal(saved.material_nombre,'Material canónico');
    assert.equal(Number(saved.cantidad_solicitada),12);
    await assert.rejects(submit(3,[item('A',8)]), /saldo pendiente/);
    await assert.rejects(submit(3,[item('A',1),item('B',2)]), /saldo pendiente/);
    await submit(3,[item('A',7),item('B',1.25)]);
    await assert.rejects(submit(1,[item('A',1)]), /saldo pendiente/);
    const totals=(await db.query('select material_sku,sum(cantidad_entregada) as quantity from entrega_items group by 1 order by 1')).rows;
    assert.equal(Number(totals[0].quantity),12); assert.equal(Number(totals[1].quantity),2.5);
    assert.equal((await db.query('select count(*) as n from entregas')).rows[0].n,2);
    for (const [user, expected] of [[1,2],[2,0],[3,2],[4,2],[5,0]]) {
      await db.exec('begin; set local role authenticated');
      await db.query("select set_config('request.jwt.claim.sub',$1,true)", [id(user)]);
      assert.equal((await db.query('select count(*) as n from entregas')).rows[0].n,expected);
      assert.equal((await db.query('select count(*) as n from entrega_items')).rows[0].n,expected*2);
      await assert.rejects(db.query('delete from entregas'), /permission denied/);
      await db.exec('rollback');
    }
  } finally { await db.close(); }
});
