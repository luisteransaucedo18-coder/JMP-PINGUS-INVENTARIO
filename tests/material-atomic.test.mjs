import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import { after, before, test } from "node:test"

const db = new PGlite()
const ids = {
  coordinador: "30000000-0000-0000-0000-000000000001",
  analista: "30000000-0000-0000-0000-000000000002",
}

async function as(user, sql, params = []) {
  await db.exec("begin; set local role authenticated;")
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [ids[user]])
    const result = await db.query(sql, params)
    await db.exec("commit")
    return result
  } catch (error) {
    await db.exec("rollback")
    throw error
  }
}

const material = {
  sku: "ATOMIC-001",
  nombre: "Material de prueba",
  descripcion: "Creado dentro de una transacción",
  categoria_id: 1,
  unidad: "UND",
  marca: null,
  stock_minimo: 2,
  precio_unitario: 5,
  estado: "AGOTADO",
  imagen_url: null,
}
const stocks = { Chiclayo: 4, Chimbote: 3, Trujillo: 2 }

before(async () => {
  await db.exec(`
    create role anon;
    create role authenticated;
    create schema auth;
    create type public.rol_usuario as enum ('gerente', 'analista', 'coordinador');
    create type public.estado_material as enum ('OK', 'BAJO', 'CRÍTICO', 'AGOTADO');
    create table public.perfiles (id uuid primary key, rol public.rol_usuario not null);
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
    $$;
    create function public.rol_actual() returns public.rol_usuario
    language sql stable security definer set search_path = public as $$
      select rol from public.perfiles where id = auth.uid()
    $$;
    create table public.categorias_material (id bigint primary key);
    create table public.sedes (nombre text primary key);
    create table public.materiales (
      sku text primary key,
      nombre text not null,
      descripcion text not null,
      categoria_id bigint not null references public.categorias_material(id),
      unidad text not null check (unidad in ('UND', 'ROLLO', 'MTS', 'GLD', 'PAR')),
      marca text,
      stock_minimo numeric not null default 0 check (stock_minimo >= 0),
      precio_unitario numeric not null default 0 check (precio_unitario >= 0),
      estado public.estado_material not null default 'AGOTADO',
      imagen_url text,
      updated_at timestamptz not null default now()
    );
    create table public.inventario_sedes (
      material_sku text not null references public.materiales(sku),
      sede text not null references public.sedes(nombre),
      stock numeric not null default 0 check (stock >= 0),
      updated_at timestamptz not null default now(),
      primary key (material_sku, sede)
    );
    create function public.recalcular_estado_prueba() returns trigger
    language plpgsql as $$
    begin
      update public.materiales
      set estado = case when (select coalesce(sum(stock), 0) from public.inventario_sedes where material_sku = new.material_sku) = 0 then 'AGOTADO'::public.estado_material else 'OK'::public.estado_material end
      where sku = new.material_sku;
      return new;
    end
    $$;
    create trigger recalcular_estado after insert or update on public.inventario_sedes
      for each row execute function public.recalcular_estado_prueba();
    grant usage on schema auth to authenticated;
    grant execute on function auth.uid() to authenticated;
    grant usage on type public.rol_usuario, public.estado_material to authenticated;
    insert into public.perfiles values
      ('30000000-0000-0000-0000-000000000001', 'coordinador'),
      ('30000000-0000-0000-0000-000000000002', 'analista');
    insert into public.categorias_material values (1);
    insert into public.sedes values ('Chiclayo'), ('Chimbote'), ('Trujillo');
  `)
  const migration = readFileSync(
    new URL("../supabase/migrations/20260930133738_guardar_material_atomico.sql", import.meta.url),
    "utf8",
  )
  await db.exec(migration)
  await db.exec(`
    create schema transporte_privado;
    create schema storage; create table storage.buckets(id text,file_size_limit bigint,allowed_mime_types text[]);
    create type public.estado_entrega as enum ('COMPLETA','PARCIAL','CANCELADA');
    alter table public.perfiles add column estado text default 'ACTIVO';
    create table public.proyectos(id uuid primary key,nombre text);
    create table public.requerimientos(id uuid primary key,estado text,analista_id uuid,proyecto_id uuid);
    create table public.requerimiento_items(requerimiento_id uuid,material_sku text,material_nombre text,unidad text,cantidad numeric);
    create table public.entregas(id uuid primary key,requerimiento_id uuid,proyecto_nombre text,tecnico text,dni_tecnico text,responsable_entrega_id uuid,fecha_hora timestamptz,estado public.estado_entrega,observaciones text);
    create table public.entrega_items(entrega_id uuid,material_sku text,material_nombre text,cantidad_solicitada numeric,cantidad_entregada numeric);
  `)
  await db.exec(readFileSync(new URL('../supabase/migrations/20261009161249_materiales_rollos_metros_restantes.sql', import.meta.url), 'utf8'))
  await db.exec(`create function public.recalcular_estado_material(text) returns void language sql as $$ select $$; create function public.actualizar_estado_por_stock() returns trigger language plpgsql as $$begin return new; end$$; create function public.actualizar_estado_por_minimo() returns trigger language plpgsql as $$begin return new; end$$;`);
  await db.exec(readFileSync(new URL('../supabase/migrations/20261009164148_auditoria_guardado_inventario.sql', import.meta.url), 'utf8'));
})

after(() => db.close())

test('una edición antigua no sobrescribe movimientos y el servidor rechaza redondeos e inactivos', async () => {
  const sku='AUDIT-TEST';
  await as('coordinador','select public.crear_material_con_inventario($1,$2)',[{...material,sku},stocks]);
  const expected={stock_sedes:stocks,unidad:'UND',metros_por_rollo:null,stock_minimo:2};
  await db.query('update inventario_sedes set stock=stock-1 where material_sku=$1 and sede=$2',[sku,'Chiclayo']);
  await assert.rejects(as('coordinador','select public.actualizar_material_con_inventario($1,$2,$3)',[sku,{inventario_esperado:expected},stocks]),/cambiaron/);
  assert.equal(Number((await db.query("select stock from inventario_sedes where material_sku=$1 and sede='Chiclayo'",[sku])).rows[0].stock),3);
  await assert.rejects(as('coordinador','select public.actualizar_material_con_inventario($1,$2,$3)',[sku,{},stocks]),/Actualiza el inventario/);
  await assert.rejects(as('coordinador','select public.crear_material_con_inventario($1,$2)',[{...material,sku:'BAD-PRECISION'},{...stocks,Chiclayo:1.0001}]),/tres decimales/);
  await assert.rejects(as('coordinador','select public.actualizar_material_con_inventario($1,$2)',[sku,{stock_minimo:'NaN'}]),/fuera del límite/);
  await db.query("update perfiles set estado='INACTIVO' where id=$1",[ids.coordinador]);
  await assert.rejects(as('coordinador','select public.actualizar_material_con_inventario($1,$2)',[sku,{nombre:'No permitido'}]),/Solo un coordinador/);
  await db.query("update perfiles set estado='ACTIVO' where id=$1",[ids.coordinador]);
  assert.equal((await db.query("select has_function_privilege('authenticated','public.recalcular_estado_material(text)','execute') allowed")).rows[0].allowed,false);
});

test('configura metros por rollo conservando stock, limpia longitud al cambiar unidad y permite entregas parciales', async () => {
  const roll = { ...material, sku: 'ROLL-TEST', unidad: 'ROLLO', metros_por_rollo: 100 };
  await as('coordinador', 'select public.crear_material_con_inventario($1,$2)', [roll, { ...stocks, Chiclayo: 2.35 }]);
  let row = (await db.query("select metros_por_rollo,(select stock from inventario_sedes where material_sku=sku and sede='Chiclayo') stock from materiales where sku='ROLL-TEST'")).rows[0];
  assert.equal(Number(row.metros_por_rollo),100); assert.equal(Number(row.stock),2.35);
  await assert.rejects(as('coordinador','select public.actualizar_material_con_inventario($1,$2)', ['ROLL-TEST',{metros_por_rollo:-1}]),/check constraint/);
  const req='40000000-0000-0000-0000-000000000001';
  await db.query('insert into requerimientos(id,estado,analista_id) values($1,\'CONFIRMADO\',$2)',[req,ids.analista]);
  await db.query('insert into requerimiento_items values($1,$2,$3,$4,$5)',[req,'ROLL-TEST','Tubo','ROLLO',0.35]);
  const delivery = [{material_sku:'ROLL-TEST',cantidad_entregada:0.35}];
  await as('coordinador','select public.registrar_entrega($1,$2,$3,$4,$5)',[req,'Técnico','','',delivery]);
  assert.equal(Number((await db.query("select cantidad_entregada from entrega_items where material_sku='ROLL-TEST'")).rows[0].cantidad_entregada),0.35);
  await assert.rejects(as('coordinador','select public.registrar_entrega($1,$2,$3,$4,$5)',[req,'Técnico','','',delivery]),/saldo pendiente/);
  const valid=(await db.query("select transporte_privado.cantidad_valida(0.35,'ROLLO') rollo,transporte_privado.cantidad_valida(0.35,'UND') und,transporte_privado.cantidad_valida(0.0001,'ROLLO') precision_ok")).rows[0];
  assert.deepEqual(valid,{rollo:true,und:false,precision_ok:false});
  await as('coordinador','select public.actualizar_material_con_inventario($1,$2)', ['ROLL-TEST',{unidad:'MTS'}]);
  row=(await db.query("select metros_por_rollo from materiales where sku='ROLL-TEST'")).rows[0];
  assert.equal(row.metros_por_rollo,null);
});

test("crea material y stock de las tres sedes como una sola operación", async () => {
  await as("coordinador", "select public.crear_material_con_inventario($1, $2)", [material, stocks])

  const result = await db.query(
    `select m.nombre, m.estado, count(i.sede)::int as sedes, sum(i.stock)::int as stock
     from public.materiales m join public.inventario_sedes i on i.material_sku = m.sku
     where m.sku = $1 group by m.sku`,
    [material.sku],
  )
  assert.deepEqual(result.rows[0], {
    nombre: material.nombre,
    estado: "OK",
    sedes: 3,
    stock: 9,
  })
})

test("edita material y stocks juntos, y conserva stocks si no se envían", async () => {
  await as("coordinador", "select public.actualizar_material_con_inventario($1, $2, $3)", [
    material.sku,
    { descripcion: "Actualizado en una operación", inventario_esperado: { stock_sedes: stocks, unidad: "UND", metros_por_rollo: null, stock_minimo: 2 } },
    { Chiclayo: 6, Chimbote: 2, Trujillo: 1 },
  ])
  await as("coordinador", "select public.actualizar_material_con_inventario($1, $2, null)", [
    material.sku,
    { nombre: "Nombre actualizado" },
  ])

  const result = await db.query(
    `select m.nombre, m.descripcion, sum(i.stock)::int as stock
     from public.materiales m join public.inventario_sedes i on i.material_sku = m.sku
     where m.sku = $1 group by m.sku`,
    [material.sku],
  )
  assert.deepEqual(result.rows[0], {
    nombre: "Nombre actualizado",
    descripcion: "Actualizado en una operación",
    stock: 9,
  })
})

test("rechaza roles no autorizados y datos inválidos sin cambios parciales", async () => {
  await assert.rejects(
    as("analista", "select public.actualizar_material_con_inventario($1, $2, $3)", [
      material.sku,
      { nombre: "No permitido" },
      stocks,
    ]),
    /Solo un coordinador/,
  )
  await assert.rejects(
    as("coordinador", "select public.crear_material_con_inventario($1, $2)", [
      { ...material, sku: "ATOMIC-INVALID" },
      { ...stocks, Trujillo: -1 },
    ]),
    /stock no puede ser negativo/,
  )

  const result = await db.query(
    `select count(*)::int as invalid_rows from public.materiales where sku = 'ATOMIC-INVALID'`,
  )
  assert.equal(result.rows[0].invalid_rows, 0)
})
