import { PGlite } from "@electric-sql/pglite"
import { readFileSync } from "node:fs"
import assert from "node:assert/strict"
import { test, before, after } from "node:test"
import ts from "typescript"
import { pathToFileURL } from "node:url"
let embedded, nativeClient
const nativeModule = process.env.TRANSPORTE_PG_MODULE
const db = nativeModule
  ? {
      query: (sql, params) =>
        nativeClient.query(
          sql,
          params?.map((v) => (Array.isArray(v) ? JSON.stringify(v) : v)),
        ),
      exec: (sql) => nativeClient.query(sql),
      close: async () => {
        await nativeClient?.end()
        await embedded?.stop()
      },
    }
  : new PGlite()
const ids = {
  origen: "10000000-0000-0000-0000-000000000001",
  destino: "10000000-0000-0000-0000-000000000002",
  otro: "10000000-0000-0000-0000-000000000003",
  analista: "10000000-0000-0000-0000-000000000004",
  inactivo: "10000000-0000-0000-0000-000000000005",
}
let sequence = 0
const uuid = () =>
  `20000000-0000-0000-0000-${String(++sequence).padStart(12, "0")}`
async function as(user, sql, params = []) {
  await db.exec("begin; set local role authenticated;")
  try {
    await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
      ids[user],
    ])
    const result = await db.query(sql, params)
    await db.exec("commit")
    return result
  } catch (e) {
    await db.exec("rollback")
    throw e
  }
}
const stock = async (sede, sku = "TEST-UND") =>
  Number(
    (
      await db.query(
        "select stock from inventario_sedes where sede=$1 and material_sku=$2",
        [sede, sku],
      )
    ).rows[0]?.stock ?? 0,
  )
const state = async (id) =>
  (await db.query("select estado from traslados where id=$1", [id])).rows[0]
    ?.estado
const item = (q = 5, sku = "TEST-UND") => ({ material_sku: sku, cantidad: q })
const receipt = (r, d = 0, sku = "TEST-UND") => ({
  material_sku: sku,
  recibida: r,
  danada: d,
  aceptada: r - d,
})
async function create(
  items = [item()],
  extra = {},
  user = "origen",
  id = uuid(),
) {
  await as(user, "select transporte_crear($1,$2,$3)", [
    id,
    {
      destino: "Chimbote",
      fecha_envio: "2026-09-29",
      costo: 0,
      moneda: "PEN",
      ...extra,
    },
    items,
  ])
  return id
}
const act = (
  id,
  action,
  user = "origen",
  items = [],
  note = "Observación de prueba",
) =>
  as(user, "select transporte_operar($1,$2,$3,$4)", [id, action, note, items])
before(async () => {
  if (nativeModule) {
    const { default: EmbeddedPostgres } = await import(
      pathToFileURL(nativeModule).href
    )
    embedded = new EmbeddedPostgres({
      databaseDir: `.tmp-transporte-pg/data-${Date.now()}`,
      user: "postgres",
      password: crypto.randomUUID(),
      port: 55439,
      persistent: true,
      initdbFlags: ["--locale=C", "--encoding=UTF8"],
      onLog: () => {},
      onError: () => {},
    })
    await embedded.initialise()
    await embedded.start()
    nativeClient = embedded.getPgClient()
    await nativeClient.connect()
  }
  // Fixture aislado basado en columnas, constraints y trigger inspeccionados en Supabase.
  // Nunca se conecta a producción ni se presentan estos materiales en la interfaz.
  await db.exec(`
 create role anon; create role authenticated;
 create schema auth; create schema storage;
 create type rol_usuario as enum('analista','coordinador','gerente');
 create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb,raw_app_meta_data jsonb);
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to authenticated;
 create table sedes(nombre text primary key);
 insert into sedes values('Chiclayo'),('Chimbote'),('Trujillo');
 create table perfiles(id uuid primary key,nombre text,email text,rol text,sede text references sedes,estado text default 'ACTIVO');
 create table materiales(sku text primary key,nombre text,unidad text,activo boolean default true,precio_unitario numeric default 12,stock_minimo numeric default 0,estado text default 'OK');
 create table inventario_sedes(material_sku text references materiales on update cascade,sede text references sedes,stock numeric not null check(stock>=0),updated_at timestamptz default now(),primary key(material_sku,sede));
 create type tipo_movimiento as enum('INGRESO_COMPRA','SALIDA_ENTREGA','AJUSTE_MANUAL','INGRESO_DEVOLUCION');
 create table movimientos_inventario(id uuid primary key default gen_random_uuid(),material_sku text references materiales,sede text references sedes,tipo tipo_movimiento,cantidad numeric check(cantidad<>0),stock_anterior numeric check(stock_anterior>=0),stock_nuevo numeric check(stock_nuevo>=0),referencia_tipo text,referencia_id uuid,motivo text,creado_por uuid references perfiles,created_at timestamptz default now());
 create function actualizar_estado_por_stock() returns trigger language plpgsql security definer set search_path=public as $$begin update materiales set estado=case when (select sum(stock) from inventario_sedes where material_sku=new.material_sku)=0 then 'AGOTADO' else 'OK' end where sku=new.material_sku; return new; end$$;
 create trigger inventario_recalcular_estado after insert or update on inventario_sedes for each row execute function actualizar_estado_por_stock();
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text,owner_id text,metadata jsonb);
 alter table storage.objects enable row level security;
 grant select,insert,update,delete on storage.objects to authenticated;
 grant select,update on perfiles to authenticated;
 grant select,insert,update,delete on movimientos_inventario to authenticated;
 alter table movimientos_inventario enable row level security;
 create policy old_read on movimientos_inventario for select to authenticated using(true);
 create policy old_write on movimientos_inventario for insert to authenticated with check(true);
 insert into materiales(sku,nombre,unidad) values('TEST-UND','Material de prueba','UND'),('TEST-MTS','Cable de prueba','MTS');
 insert into inventario_sedes(material_sku,sede,stock) values('TEST-UND','Chiclayo',1000),('TEST-MTS','Chiclayo',1000);
 `)
  for (const [user, id] of Object.entries(ids))
    await db.query("insert into perfiles(id,nombre,rol,sede,estado) values($1,$2,$3,$4,$5)", [
      id,
      user,
      user === "analista" ? "analista" : "coordinador",
      user === "destino"
        ? "Chimbote"
        : user === "otro"
          ? "Trujillo"
          : "Chiclayo",
      user === "inactivo" ? "INACTIVO" : "ACTIVO",
    ])
  await db.exec(
    readFileSync(
      new URL(
        "../supabase/migrations/20260929141950_transporte_interno.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  )
})
after(() => db.close())
test("traslado real SQL: borrador, despacho y recepción; costo no cambia precio", async () => {
  const a = await stock("Chiclayo"),
    b = await stock("Chimbote")
  const id = await create()
  assert.equal(await stock("Chiclayo"), a)
  await act(id, "DESPACHAR")
  assert.equal(await stock("Chiclayo"), a - 5)
  assert.equal(await stock("Chimbote"), b)
  await act(id, "RECIBIR", "destino", [receipt(5)])
  assert.equal(await stock("Chimbote"), b + 5)
  assert.equal(await state(id), "RECIBIDO")
  assert.equal(
    Number(
      (
        await db.query(
          "select precio_unitario from materiales where sku='TEST-UND'",
        )
      ).rows[0].precio_unitario,
    ),
    12,
  )
  assert.equal(
    (
      await db.query(
        "select * from movimientos_inventario where traslado_id=$1",
        [id],
      )
    ).rows.length,
    2,
  )
})
test("stock insuficiente al guardar y al despachar después de variar existencias", async () => {
  await assert.rejects(create([item(999999)]), /Stock insuficiente/)
  const id = await create()
  const old = await stock("Chiclayo")
  await db.exec(
    "update inventario_sedes set stock=1 where sede='Chiclayo' and material_sku='TEST-UND'",
  )
  await assert.rejects(act(id, "DESPACHAR"), /Stock insuficiente/)
  assert.equal(await state(id), "BORRADOR")
  assert.equal(await stock("Chiclayo"), 1)
  await db.query(
    "update inventario_sedes set stock=$1 where sede='Chiclayo' and material_sku='TEST-UND'",
    [old],
  )
})
test("reintentos de creación, despacho y recepción no duplican", async () => {
  const id = uuid()
  await create([item()], {}, "origen", id)
  await create([item()], {}, "origen", id)
  const a = await stock("Chiclayo"),
    b = await stock("Chimbote")
  await act(id, "DESPACHAR")
  await act(id, "DESPACHAR")
  await act(id, "RECIBIR", "destino", [receipt(5)])
  await act(id, "RECIBIR", "destino", [receipt(5)])
  assert.equal(await stock("Chiclayo"), a - 5)
  assert.equal(await stock("Chimbote"), b + 5)
  assert.equal(
    (
      await db.query(
        "select * from movimientos_inventario where traslado_id=$1",
        [id],
      )
    ).rows.length,
    2,
  )
})
test("recepción parcial, daño, resolución y reintento conservan stock aceptado", async () => {
  const id = await create()
  const b = await stock("Chimbote")
  await act(id, "DESPACHAR")
  await act(id, "RECIBIR", "destino", [receipt(4, 1)])
  assert.equal(await state(id), "INCIDENCIA")
  assert.equal(await stock("Chimbote"), b + 3)
  await act(
    id,
    "RESOLVER",
    "destino",
    [receipt(5, 1)],
    "Se recuperó una unidad; una dañada se da por perdida",
  )
  await act(id, "RESOLVER", "destino", [receipt(5, 1)])
  assert.equal(await stock("Chimbote"), b + 4)
  assert.equal(await state(id), "RECIBIDO")
  assert.ok(
    (
      await db.query(
        "select resolucion from traslado_incidencias where traslado_id=$1",
        [id],
      )
    ).rows[0].resolucion,
  )
})
test("cancelación de borrador y retorno autorizado por ambas sedes", async () => {
  const draft = await create()
  const a = await stock("Chiclayo")
  await act(draft, "CANCELAR")
  assert.equal(await stock("Chiclayo"), a)
  const id = await create()
  await act(id, "DESPACHAR")
  await assert.rejects(act(id, "CANCELAR"), /reversión/)
  await act(id, "SOLICITAR_REVERSION")
  await assert.rejects(act(id, "REVERTIR"), /autorizar/)
  await act(id, "AUTORIZAR_REVERSION", "destino")
  await act(id, "REVERTIR")
  await act(id, "REVERTIR")
  assert.equal(await stock("Chiclayo"), a)
  assert.equal(await state(id), "CANCELADO")
})
test("no permite revertir unidades ya aceptadas ni recibir durante retorno", async () => {
  const id = await create()
  await act(id, "DESPACHAR")
  await act(id, "RECIBIR", "destino", [receipt(2)])
  await assert.rejects(act(id, "SOLICITAR_REVERSION"), /aceptadas/)
  const other = await create()
  await act(other, "DESPACHAR")
  await act(other, "SOLICITAR_REVERSION")
  await assert.rejects(act(other, "RECIBIR", "destino", [receipt(5)]), /Estado/)
})
test("roles, sede ajena, usuario inactivo, RLS y escritura directa", async () => {
  const id = await create()
  await assert.rejects(create([item()], {}, "analista"), /coordinadores/)
  await assert.rejects(create([item()], {}, "inactivo"), /coordinadores/)
  await assert.rejects(act(id, "DESPACHAR", "destino"), /no autorizada/)
  await assert.rejects(act(id, "DESPACHAR", "otro"), /no accesible/)
  assert.equal((await as("analista", "select * from traslados")).rows.length, 0)
  assert.equal(
    (
      await as("otro", "select * from traslado_items where traslado_id=$1", [
        id,
      ])
    ).rows.length,
    0,
  )
  await assert.rejects(
    as("origen", "update traslados set estado='RECIBIDO' where id=$1", [id]),
    /permission denied/,
  )
  await assert.rejects(
    as("analista", "update perfiles set rol='coordinador' where id=$1", [
      ids.analista,
    ]),
    /administración/,
  )
  await assert.rejects(
    as("origen", "update perfiles set sede='Chimbote' where id=$1", [
      ids.origen,
    ]),
    /administración/,
  )
  await assert.rejects(
    as(
      "origen",
      "select transporte_privado.mover($1,'TEST-UND','Chiclayo',50,'REVERSION')",
      [id],
    ),
    /permission denied/,
  )
  await act(id, "DESPACHAR")
  assert.equal(
    (
      await as(
        "analista",
        "select * from movimientos_inventario where traslado_id=$1",
        [id],
      )
    ).rows.length,
    0,
  )
})
test("cantidades nulas, negativas, decimales por unidad y SKU repetido", async () => {
  for (const q of [null, 0, -1, 1.1])
    await assert.rejects(create([item(q)]), /Cantidad/)
  await assert.rejects(create([item(1), item(1)]), /duplicate key/)
  await assert.rejects(create([item(1, "NO-EXISTE")]), /inexistente/)
  await create([item(1.125, "TEST-MTS")])
  await assert.rejects(create([item(1.0001, "TEST-MTS")]), /Cantidad/)
})
test("error de base de datos a mitad de despacho revierte todo el movimiento", async () => {
  const id = await create([item(2, "TEST-MTS"), item(2)])
  const a = await stock("Chiclayo"),
    m = await stock("Chiclayo", "TEST-MTS")
  await db.exec(
    `create function fallo_prueba() returns trigger language plpgsql as $$begin if new.material_sku='TEST-UND' then raise exception 'Fallo inyectado'; end if; return new; end$$; create trigger fallo_prueba before insert on movimientos_inventario for each row execute function fallo_prueba();`,
  )
  await assert.rejects(act(id, "DESPACHAR"), /Fallo inyectado/)
  assert.equal(await stock("Chiclayo"), a)
  assert.equal(await stock("Chiclayo", "TEST-MTS"), m)
  assert.equal(await state(id), "BORRADOR")
  assert.equal(
    (
      await db.query(
        "select * from movimientos_inventario where traslado_id=$1",
        [id],
      )
    ).rows.length,
    0,
  )
  await db.exec(
    "drop trigger fallo_prueba on movimientos_inventario; drop function fallo_prueba();",
  )
})
test("error de recepción revierte stock, detalles y estado", async () => {
  const id = await create()
  await act(id, "DESPACHAR")
  const b = await stock("Chimbote")
  await assert.rejects(
    act(id, "RECIBIR", "destino", [receipt(3)], ""),
    /Explica/,
  )
  assert.equal(await stock("Chimbote"), b)
  assert.equal(await state(id), "EN_TRANSITO")
  assert.equal(
    Number(
      (
        await db.query(
          "select aceptada from traslado_items where traslado_id=$1",
          [id],
        )
      ).rows[0].aceptada,
    ),
    0,
  )
})
test("recepción rechaza materiales omitidos, duplicados o sobre-recepción", async () => {
  const id = await create()
  await act(id, "DESPACHAR")
  await assert.rejects(act(id, "RECIBIR", "destino", []), /exactamente/)
  await assert.rejects(act(id, "RECIBIR", "destino", [receipt(6)]), /inválidas/)
  await assert.rejects(
    act(id, "RECIBIR", "destino", [receipt(5, 6)]),
    /inválidas/,
  )
})
test("Storage privado: acceso por sede, adjunto validado, costo no despacha sin comprobante", async () => {
  const id = await create([item()], {
    costo: 40,
    numero_comprobante: "F001",
    fecha_comprobante: "2026-09-29",
  })
  await assert.rejects(act(id, "DESPACHAR"), /comprobante/)
  const fid = uuid(),
    path = `${id}/COMPROBANTE/${fid}.pdf`
  await assert.rejects(
    as(
      "analista",
      "insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)",
      ["transporte-interno", path, ids.analista],
    ),
    /row-level security/,
  )
  await as(
    "origen",
    "insert into storage.objects(bucket_id,name,owner_id,metadata) values($1,$2,$3,$4)",
    [
      "transporte-interno",
      path,
      ids.origen,
      { size: 100, mimetype: "application/pdf" },
    ],
  )
  await as("origen", "select transporte_adjuntar($1,$2,$3,$4,$5,$6,$7)", [
    id,
    fid,
    "COMPROBANTE",
    "factura.pdf",
    "application/pdf",
    100,
    path,
  ])
  assert.equal(
    (await as("destino", "select * from storage.objects where name=$1", [path]))
      .rows.length,
    1,
  )
  assert.equal(
    (await as("otro", "select * from storage.objects where name=$1", [path]))
      .rows.length,
    0,
  )
  await assert.rejects(
    as("origen", "select transporte_adjuntar($1,$2,$3,$4,$5,$6,$7)", [
      id,
      uuid(),
      "COMPROBANTE",
      "mal.exe",
      "application/x-msdownload",
      100,
      path,
    ]),
    /inválido/,
  )
  await act(id, "DESPACHAR")
  await assert.rejects(
    as(
      "origen",
      "insert into storage.objects(bucket_id,name,owner_id) values($1,$2,$3)",
      ["transporte-interno", `${id}/COMPROBANTE/otro.pdf`, ids.origen],
    ),
    /row-level security/,
  )
})
test("cliente valida extensión real, tamaño, firma y cantidades", async () => {
  const source = readFileSync(
    new URL("../src/services/transporteValidation.ts", import.meta.url),
    "utf8",
  ).replace("import { supabase } from './supabase';", "const supabase = {};")
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  })
  const { validarArchivo, validarCantidad } = await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  )
  await validarArchivo(
    new File(["%PDF-1.7 test"], "invoice.pdf", { type: "application/pdf" }),
  )
  await assert.rejects(
    validarArchivo(
      new File(["fake"], "invoice.pdf", { type: "application/pdf" }),
    ),
    /contenido/,
  )
  await assert.rejects(
    validarArchivo(
      new File(["bad"], "file.exe", { type: "application/octet-stream" }),
    ),
    /10 MB/,
  )
  await assert.rejects(
    validarArchivo(
      new File([new Uint8Array(10485761)], "big.pdf", {
        type: "application/pdf",
      }),
    ),
    /10 MB/,
  )
  assert.equal(validarCantidad(1.5, "UND", 5), false)
  assert.equal(validarCantidad(1.5, "MTS", 5), true)
  assert.equal(validarCantidad(NaN, "UND", 5), false)
})

test(
  "dos conexiones: doble despacho y doble recepción se bloquean y no duplican",
  { skip: !nativeModule },
  async () => {
    async function concurrent(id, action, user, items = []) {
      const first = embedded.getPgClient(),
        second = embedded.getPgClient()
      await first.connect()
      await second.connect()
      try {
        for (const c of [first, second]) {
          await c.query("begin; set local role authenticated")
          await c.query("select set_config('request.jwt.claim.sub',$1,true)", [
            ids[user],
          ])
        }
        const pid = (await second.query("select pg_backend_pid() as pid"))
          .rows[0].pid
        await first.query("select transporte_operar($1,$2,$3,$4)", [
          id,
          action,
          "Concurrencia",
          JSON.stringify(items),
        ])
        const pending = second.query("select transporte_operar($1,$2,$3,$4)", [
          id,
          action,
          "Concurrencia",
          JSON.stringify(items),
        ])
        let blocked = false
        for (let n = 0; n < 40; n++) {
          const r = await db.query(
            "select wait_event_type from pg_stat_activity where pid=$1",
            [pid],
          )
          if (r.rows[0]?.wait_event_type === "Lock") {
            blocked = true
            break
          }
          await new Promise((r) => setTimeout(r, 25))
        }
        assert.ok(
          blocked,
          "La segunda conexión debe esperar el bloqueo de la cabecera",
        )
        await first.query("commit")
        await pending
        await second.query("commit")
      } finally {
        await first.query("rollback")
        await second.query("rollback")
        await first.end()
        await second.end()
      }
    }
    const id = await create(),
      a = await stock("Chiclayo"),
      b = await stock("Chimbote")
    await concurrent(id, "DESPACHAR", "origen")
    assert.equal(await stock("Chiclayo"), a - 5)
    await concurrent(id, "RECIBIR", "destino", [receipt(5)])
    assert.equal(await stock("Chimbote"), b + 5)
    assert.equal(
      (
        await db.query(
          "select * from movimientos_inventario where traslado_id=$1",
          [id],
        )
      ).rows.length,
      2,
    )
  },
)
test('alta de Auth ignora rol y sede enviados como metadatos del usuario', async () => {
  await db.exec('create trigger alta_test after insert on auth.users for each row execute function public.crear_perfil_nuevo_usuario()');
  const id=uuid();
  await db.query('insert into auth.users values($1,$2,$3,$4)',[id,'test@example.invalid',{nombre:'Prueba aislada',rol:'coordinador',sede:'Chiclayo'},{}]);
  const profile=(await db.query('select rol,sede from perfiles where id=$1',[id])).rows[0];
  assert.equal(profile.rol,'analista'); assert.equal(profile.sede,null);
  const trusted=uuid();
  await db.query('insert into auth.users values($1,$2,$3,$4)',[trusted,'trusted@example.invalid',{}, {rol:'coordinador',sede:'Trujillo'}]);
  assert.equal((await db.query('select rol from perfiles where id=$1',[trusted])).rows[0].rol,'coordinador');
});
