import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { PGlite } from "@electric-sql/pglite"
import ts from "typescript"
const source = readFileSync(
  new URL("../src/features/valorizaciones/domain.ts", import.meta.url),
  "utf8",
)
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.ESNext },
}).outputText
const { CHECKLIST, checklistErrors, netAmount, laborAmount } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`
)
const id = (n) => `50000000-0000-4000-8000-${String(n).padStart(12, "0")}`
test("checklist exige fotos fechadas, dos fotos de cocina y justificación; neto separa adelantos", () => {
  const answers = Object.fromEntries(
    CHECKLIST.map(([k]) => [
      k,
      { estado: "NO_APLICA", nota: "Instalación sin este elemento" },
    ]),
  )
  assert.deepEqual(checklistErrors(answers, []), [])
  answers.cocina = { estado: "CONFORME", nota: "" }
  const photo = {
    tipo: "FOTO",
    punto: "cocina",
    fecha: "2026-10-12",
    ubicacion: "Piura",
  }
  assert.equal(checklistErrors(answers, [photo]).length, 1)
  assert.deepEqual(checklistErrors(answers, [photo, photo]), [])
  answers.supervision = { estado: "OBSERVADO", nota: "Resane defectuoso" }
  assert.equal(checklistErrors(answers, [photo, photo]).length, 1)
  assert.equal(netAmount(550, 100, [{ monto: 25 }]), 425)
  const q = {
    presupuesto: {
      gastos: [
        { rubro: "MANO_OBRA", cantidad: 1, costoUnitario: 550 },
        { rubro: "HABILITACION", cantidad: 1, costoUnitario: 200 },
      ],
    },
  }
  assert.equal(laborAmount(q, "INTERNA"), 550)
  assert.equal(laborAmount(q, "HABILITACION"), 200)
})
test("Postgres: permisos, revisión, adelantos, descuentos, pago idempotente y cierre", async () => {
  const db = new PGlite()
  try {
    await db.exec(`
 create role anon; create role authenticated; create schema auth; create schema storage;
 create type public.rol_usuario as enum ('analista','coordinador','gerente');
 create table public.perfiles(id uuid primary key,rol public.rol_usuario,estado text,nombre text);
 create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 create table public.proyectos(id uuid primary key);
 create table public.materiales(sku text primary key,nombre text,precio_unitario numeric);
 create table public.proyecto_cotizaciones(id uuid primary key,serie_id uuid,proyecto_id uuid,creado_por uuid,estado text,presupuesto jsonb,importe_aceptado numeric,eliminada_en timestamptz,revision integer default 1,updated_at timestamptz);
 create table public.proyecto_gastos(id uuid primary key,cotizacion_id uuid references public.proyecto_cotizaciones(id),rubro text,naturaleza text,descripcion text,monto numeric,fecha date,comprobante text,documento_path text,creado_por uuid,estado text default 'REGISTRADO');
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 create function storage.foldername(text) returns text[] language sql immutable as $$ select string_to_array($1,'/') $$;
 grant usage on schema auth,storage to authenticated;
 grant select on public.perfiles,public.proyectos,public.materiales,public.proyecto_cotizaciones,public.proyecto_gastos to authenticated;
 grant select,insert,delete on storage.objects to authenticated;
 alter table storage.objects enable row level security;
 alter table public.proyecto_cotizaciones enable row level security;
 create policy quote_author on public.proyecto_cotizaciones for select to authenticated using(creado_por=auth.uid());
 `)
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261014144819_tesoreria_rol.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    )
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261014144823_trabajos_valorizaciones.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    )
    await db.exec(
      `insert into public.perfiles values('${id(1)}','analista','ACTIVO','Analista'),('${id(2)}','tesoreria','ACTIVO','Tesorería'),('${id(3)}','gerente','ACTIVO','Gerente'),('${id(4)}','analista','ACTIVO','Otro'),('${id(5)}','coordinador','ACTIVO','Coordinador');insert into public.proyectos values('${id(20)}');insert into public.materiales values('TUB','Tubería',10);`,
    )
    const budget = {
      moneda: "PEN",
      gastos: [
        { rubro: "MANO_OBRA", cantidad: 1, costoUnitario: 550 },
        { rubro: "HABILITACION", cantidad: 1, costoUnitario: 200 },
      ],
    }
    await db.query(
      `insert into public.proyecto_cotizaciones(id,serie_id,proyecto_id,creado_por,estado,presupuesto,importe_aceptado) values($1,$1,$2,$3,'ACEPTADA',$4,1200)`,
      [id(30), id(20), id(1), JSON.stringify(budget)],
    )
    const as = async (user, sql, args = []) => {
      await db.exec("begin; set local role authenticated")
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
          id(user),
        ])
        const r = await db.query(sql, args)
        await db.exec("commit")
        return r
      } catch (e) {
        await db.exec("rollback")
        throw e
      }
    }
    const get = async (n) =>
      (
        await db.query(
          "select * from public.trabajo_valorizaciones where id=$1",
          [id(n)],
        )
      ).rows[0]
    const op = async (user, action, n, data = {}, rev) =>
      as(user, "select public.operar_valorizacion($1,$2,$3,$4)", [
        action,
        id(n),
        rev ?? (await get(n))?.revision ?? 0,
        JSON.stringify(data),
      ])
    const create = {
      cotizacion_id: id(30),
      etapa: "INTERNA",
      tipo: "ADELANTO",
      tecnico: "Técnico",
      dni: "12345678",
      monto: 100,
      motivo: "Excepción autorizada",
    }
    await assert.rejects(op(2, "crear", 40, create), /Solo el analista/)
    await assert.rejects(
      op(1, "crear", 40, { ...create, monto: 550 }),
      /dejar saldo/,
    )
    await op(1, "crear", 40, create)
    await db.exec(
      `update public.perfiles set estado='INACTIVO' where id='${id(1)}'`,
    )
    await assert.rejects(op(1, "enviar", 40), /No tienes permiso/)
    await db.exec(
      `update public.perfiles set estado='ACTIVO' where id='${id(1)}'`,
    )
    await assert.rejects(
      as(
        1,
        `update public.trabajo_valorizaciones set estado='PAGADA' where id=$1`,
        [id(40)],
      ),
      /permission denied/,
    )
    assert.equal(
      (await as(4, "select * from public.trabajo_valorizaciones")).rows.length,
      0,
    )
    await assert.rejects(op(4, "enviar", 40), /otro analista/)
    await op(1, "enviar", 40)
    await assert.rejects(
      op(2, "pagar", 40, { fecha: "2026-10-12", referencia: "X" }),
      /autorización/,
    )
    await assert.rejects(
      op(2, "revisar", 40, { descuentos: [], documentacionConforme: true }),
      /firmada/,
    )
    let fileNo = 100
    const attach = async (user, n, type, metadata = {}) => {
      const path = `${id(n)}/${id(user)}/${id(fileNo++)}.${
        type === "FOTO" ? "jpg" : "pdf"
      }`
      await as(
        user,
        "insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)",
        ["valorizaciones", path, id(user)],
      )
      await op(user, "documento", n, {
        tipo: type,
        path,
        nombre: `${type}.pdf`,
        ...metadata,
      })
      return path
    }
    await attach(2, 40, "FIRMADA")
    await attach(2, 40, "HONORARIOS")
    await op(2, "revisar", 40, { descuentos: [], documentacionConforme: true })
    await assert.rejects(op(2, "autorizar", 40), /Solo el gerente/)
    await op(3, "autorizar", 40)
    await attach(2, 40, "PAGO")
    const stale = (await get(40)).revision - 1
    await assert.rejects(
      op(2, "pagar", 40, { fecha: "2026-10-12", referencia: "A" }, stale),
      /cambió/,
    )
    await op(2, "pagar", 40, { fecha: "2026-10-12", referencia: "A" })
    await assert.rejects(
      op(2, "pagar", 40, { fecha: "2026-10-12", referencia: "A" }),
      /autorización/,
    )
    assert.equal(
      (
        await db.query(
          "select count(*) n from public.proyecto_gastos where valorizacion_id=$1",
          [id(40)],
        )
      ).rows[0].n,
      1,
    )
    await assert.rejects(
      db.query(
        "update public.proyecto_gastos set estado='ANULADO' where valorizacion_id=$1",
        [id(40)],
      ),
      /no se puede/,
    )
    await op(1, "crear", 41, { ...create, tipo: "FINAL" })
    assert.equal(Number((await get(41)).adelantos), 100)
    assert.equal(Number((await get(41)).neto), 450)
    await assert.rejects(
      op(1, "crear", 42, { ...create, tipo: "ADELANTO" }),
      /valorización final/,
    )
    await assert.rejects(op(1, "enviar", 41), /Checklist/)
    const checklist = Object.fromEntries(
      CHECKLIST.map(([k]) => [
        k,
        { estado: "NO_APLICA", nota: "Justificación del analista" },
      ]),
    )
    checklist.cocina = { estado: "CONFORME", nota: "" }
    await op(1, "checklist", 41, { checklist })
    await assert.rejects(op(1, "enviar", 41), /fotografías/)
    await attach(1, 41, "FOTO", {
      punto: "cocina",
      fecha: "2026-10-12",
      ubicacion: "Piura",
    })
    await assert.rejects(op(1, "enviar", 41), /fotografías/)
    await attach(1, 41, "FOTO", {
      punto: "cocina",
      fecha: "2026-10-12",
      ubicacion: "Piura",
    })
    for (const k of [
      "ISOMETRICO_FINAL",
      "RESUMEN",
      "PLANTA",
      "HERMETICIDAD",
      "DECLARACION",
      "GARANTIA",
      "CONTRATO",
      "REPORTE",
    ])
      await attach(1, 41, k)
    await op(1, "enviar", 41)
    await attach(2, 41, "FIRMADA")
    await attach(2, 41, "HONORARIOS")
    await assert.rejects(
      op(2, "revisar", 41, {
        descuentos: [
          { sku: "TUB", cantidad: 1, monto: 450, motivo: "Sobrante" },
        ],
        documentacionConforme: true,
      }),
      /dejar saldo/,
    )
    const deduction = {
      sku: "TUB",
      cantidad: 2,
      monto: 25,
      referencia: 999,
      motivo: "Sobrante no devuelto",
    }
    await assert.rejects(
      op(2, "revisar", 41, {
        descuentos: [deduction],
        documentacionConforme: true,
      }),
      /Guarda primero/,
    )
    await op(2, "descuentos", 41, { descuentos: [deduction] })
    await assert.rejects(
      op(2, "revisar", 41, {
        descuentos: [deduction],
        documentacionConforme: true,
      }),
      /firmada/,
    )
    await attach(2, 41, "FIRMADA")
    await attach(2, 41, "HONORARIOS")
    await op(2, "revisar", 41, {
      descuentos: [deduction],
      documentacionConforme: true,
    })
    assert.equal(Number((await get(41)).neto), 425)
    assert.equal((await get(41)).descuentos[0].referencia, 10)
    await op(3, "autorizar", 41)
    await attach(2, 41, "PAGO")
    await op(2, "pagar", 41, { fecha: "2026-10-12", referencia: "B" })
    await assert.rejects(
      db.query(
        "update public.proyecto_cotizaciones set estado='CERRADA' where id=$1",
        [id(30)],
      ),
      /100%/,
    )
    await db.query(
      "insert into public.proyecto_gastos(id,cotizacion_id,naturaleza,monto) values($1,$2,'ABONO',1200)",
      [id(90), id(30)],
    )
    await assert.rejects(
      db.query(
        "update public.proyecto_cotizaciones set estado='CERRADA' where id=$1",
        [id(30)],
      ),
      /HABILITACION/,
    )
    await db.query(
      "update public.proyecto_cotizaciones set presupuesto=$2 where id=$1",
      [id(30), JSON.stringify({ moneda: "PEN", gastos: [budget.gastos[0]] })],
    )
    await db.query(
      "update public.proyecto_cotizaciones set estado='CERRADA' where id=$1",
      [id(30)],
    )
  } finally {
    await db.close()
  }
})
