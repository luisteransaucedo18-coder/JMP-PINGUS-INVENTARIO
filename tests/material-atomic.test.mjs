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
})

after(() => db.close())

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
    { descripcion: "Actualizado en una operación" },
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
