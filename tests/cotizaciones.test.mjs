import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { test } from "node:test"
import { PGlite } from "@electric-sql/pglite"
import ts from "typescript"
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';

const limaDateSource = ts.transpileModule(readFileSync(new URL('../src/utils/limaDate.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const limaDateUrl = `data:text/javascript;base64,${Buffer.from(limaDateSource).toString('base64')}`;
const source = readFileSync(
  new URL("../src/features/cotizaciones/domain.ts", import.meta.url),
  "utf8",
).replace("'../../utils/limaDate'", JSON.stringify(limaDateUrl))
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
})
const domainUrl=`data:text/javascript;base64,${Buffer.from(outputText).toString('base64')}`;
const { newBudget, calculateQuote, remainingMaterial, executionSummary, quoteValidation, roundMoney, defaultQuoteRates } =
  await import(
    `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
  )
const id = (n) => `40000000-0000-4000-8000-${String(n).padStart(12, "0")}`
test('ubigeo de Perú: provincias, distritos y localidades históricas sin ambigüedad', async () => {
  const data = JSON.parse(readFileSync(new URL('../src/features/cotizaciones/peruUbigeo.json', import.meta.url), 'utf8'))
  const old = JSON.parse(readFileSync(new URL('../src/features/cotizaciones/peruLocations.json', import.meta.url), 'utf8'))
  const locationSource = readFileSync(new URL('../src/features/cotizaciones/locations.ts', import.meta.url), 'utf8')
    .replace('import locations from "./peruLocations.json"', `const locations = ${JSON.stringify(old)}`)
    .replace('import ubigeo from "./peruUbigeo.json"', `const ubigeo = ${JSON.stringify(data)}`)
  const compiled = ts.transpileModule(locationSource, {compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText
  const {provincesForDepartment, districtsForProvince, validPeruLocation, resolveLegacyLocation} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  assert.equal(Object.keys(data).length, 25)
  const districts = Object.values(data).flatMap(provinces => Object.values(provinces).flat())
  assert.equal(districts.length, 1892)
  assert.equal(new Set(districts.map(d => d.ubigeo)).size, districts.length)
  assert.deepEqual(provincesForDepartment('Lambayeque'), ['Chiclayo', 'Ferreñafe', 'Lambayeque'])
  assert.ok(validPeruLocation('Áncash', 'Santa', 'Chimbote'))
  assert.ok(validPeruLocation('Callao', 'Callao', 'Ventanilla'))
  assert.ok(!validPeruLocation('Lambayeque', 'Ferreñafe', 'Chiclayo'))
  assert.deepEqual(districtsForProvince('Lambayeque', ''), [])
  assert.deepEqual(resolveLegacyLocation('Áncash', 'Chimbote'), {provincia:'Santa', distrito:'Chimbote'})
  assert.deepEqual(resolveLegacyLocation('Lima', 'San Antonio'), {provincia:'', distrito:''})
})
test('porcentajes predeterminados del Excel y relación departamento/ciudad', async () => {
  assert.deepEqual(defaultQuoteRates('COBRE','Chiclayo'),{utilidad:22,generales:10,comision:5,igv:18,financiamientoMensual:2.5,meses:1});
  assert.equal(defaultQuoteRates('COBRE','Piura').comision,6);
  assert.equal(defaultQuoteRates('PEALPE','Talara','Piura').comision,12);
  assert.equal(newBudget().tasas.utilidad,25);
  assert.equal(defaultQuoteRates('PEQUENOS').utilidad,20);
  assert.equal(defaultQuoteRates('FISE').comision,11);
  const locations=JSON.parse(readFileSync(new URL('../src/features/cotizaciones/peruLocations.json',import.meta.url),'utf8'));
  assert.equal(Object.keys(locations).length,25);
  assert.ok(locations.Lambayeque.includes('Chiclayo'));
  assert.ok(locations['Áncash'].includes('Chimbote'));
  assert.ok(!locations.Lambayeque.includes('Chimbote'));
  for(const cities of Object.values(locations)) assert.equal(new Set(cities).size,cities.length);
});
const budget = {
  ...newBudget(),
  ciudad: "Chiclayo",
  excel: {...newBudget().excel,departamento:"Lambayeque",provincia:"Chiclayo",distrito:"Chiclayo"},
  tecnico: "Técnico",
  alcance: "Instalación de prueba",
  vigencia: "2099-12-31",
  materiales: [
    {
      id: id(10),
      sku: "A",
      nombre: "Referencia",
      unidadCatalogo: "MTS",
      unidadCotizada: "ROLLO",
      cantidad: 2,
      factorStock: 10,
      costoUnitario: 50,
    },
  ],
  gastos: [
    {
      id: id(11),
      rubro: "MANO_OBRA",
      descripcion: "Construcción",
      cantidad: 1,
      costoUnitario: 100,
    },
  ],
  tasas: {
    utilidad: 20,
    generales: 5,
    comision: 3,
    igv: 18,
    financiamientoMensual: 2,
    meses: 2,
  },
}

test('variables del Excel: partidas específicas, FISE y rechazo de costos duplicados',async()=>{
  assert.equal(roundMoney(180.005),180.01); assert.equal(roundMoney(-180.005),-180.01);
  const variablesSource=readFileSync(new URL('../src/features/cotizaciones/excelVariables.ts',import.meta.url),'utf8');
  const compiled=ts.transpileModule(variablesSource,{compilerOptions:{module:ts.ModuleKind.ESNext}}).outputText;
  const {EXCEL_PARTIDAS}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  for(const label of ['HOSPEDAJE','ALIMENTACIÓN','PASAJES - FLETES','COMBUSTIBLE','PEAJES','Firme IG3','ESTRUCTURA METÁLICA DE ANCLAJE']) assert.ok(EXCEL_PARTIDAS.some(p=>p.label===label));
  assert.equal(EXCEL_PARTIDAS.filter(p=>p.key.startsWith('cobre')).length,6);
  assert.deepEqual(quoteValidation(budget),[]);
  const grouped={...budget,gastos:[...budget.gastos,{id:id(40),rubro:'VARIABLES',descripcion:'Global',cantidad:1,costoUnitario:20},{id:id(41),rubro:'FLETE',descripcion:'Detalle',cantidad:1,costoUnitario:20}]};
  assert.ok(quoteValidation(grouped).some(e=>e.includes('no sumes ambos')));
  const incompleteFise={...budget,modalidad:'FISE'}; assert.ok(quoteValidation(incompleteFise).some(e=>e.includes('Configuración interna')));
  const credited=executionSummary({id:id(1),estado:'ACEPTADA',presupuesto:budget,totales:calculateQuote(budget)},[{id:id(1)}],[{cotizacion_id:id(1),estado:'REGISTRADO',naturaleza:'COSTO',monto:100},{cotizacion_id:id(1),estado:'REGISTRADO',naturaleza:'ABONO',monto:20}]);
  assert.equal(credited.actual,80);
});

test('PDF comercial paginado sin costos internos ni utilidad',async()=>{
  const require=createRequire(import.meta.url);
  const pdfSource=readFileSync(new URL('../src/utils/quotationPdf.ts',import.meta.url),'utf8').replaceAll('"../features/cotizaciones/domain"',JSON.stringify(domainUrl)).replace('"pdf-lib"',JSON.stringify(pathToFileURL(require.resolve('pdf-lib')).href));
  const compiled=ts.transpileModule(pdfSource,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
  const {buildQuotationPdf}=await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
  const {getDocument}=await import('pdfjs-dist/legacy/build/pdf.mjs');
  const q={codigo:'COT-000001',version:1,proyecto_snapshot:{nombre:'Proyecto prueba',cliente:'Cliente',ubicacion:'Dirección'},presupuesto:{...budget,alcance:'Alcance '.repeat(1500),gastos:[...budget.gastos,{id:id(50),rubro:'BONO',descripcion:'BONO SECRETO',cantidad:1,costoUnitario:12},{id:id(51),rubro:'FIJOS',descripcion:'COSTO INTERNO',cantidad:1,costoUnitario:55}]},totales:calculateQuote(budget),importe_presentado:354};
  const loadingTask=getDocument({data:new Uint8Array(await buildQuotationPdf(q,new Uint8Array(readFileSync(new URL('../public/templates/pedido-materiales-logo.jpg',import.meta.url))))),useSystemFonts:true});
  const pdf=await loadingTask.promise;
  try { assert.ok(pdf.numPages>1); let text=''; for(let i=1;i<=pdf.numPages;i++){ const page=await pdf.getPage(i); const content=await page.getTextContent(); text+=content.items.map(x=>x.str??'').join(' '); }
  assert.ok(text.includes('354.00')); assert.ok(text.includes('Construcción')); assert.ok(text.includes('DATOS DEL PROYECTO Y CLIENTE')); assert.ok(text.includes('JM-PINGUS SAC')); assert.equal(text.split('COTIZACIÓN DE PROYECTO').length-1,pdf.numPages); assert.ok(!text.includes('BONO SECRETO')); assert.ok(!text.includes('COSTO INTERNO')); assert.ok(!text.includes('Utilidad')); }
  finally{await loadingTask.destroy();}
});

test('PDF del requerimiento conserva dirección y ubicación heredada', async () => {
  const require = createRequire(import.meta.url)
  const publicCodeModule = ts.transpileModule(readFileSync(new URL('../src/utils/publicCode.ts', import.meta.url), 'utf8'), {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  const publicCodeUrl = `data:text/javascript;base64,${Buffer.from(publicCodeModule).toString('base64')}`
  const source = readFileSync(new URL('../src/utils/requirementPdf.ts', import.meta.url), 'utf8')
    .replace("'pdf-lib'", JSON.stringify(pathToFileURL(require.resolve('pdf-lib')).href))
    .replace("'./publicCode'", JSON.stringify(publicCodeUrl))
  const compiled = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText
  const {createRequirementPdf} = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
  const requirement = {id:id(20),codigo:'REQ-QA',estado:'CONFIRMADO',proyecto:'Proyecto QA',sede:'Chiclayo',ubicacion:'Av. José Balta 123, interior 2 — Lambayeque / Chiclayo / Chiclayo',descripcion:'Instalación de gas',analista:'Analista QA',tecnico:'Técnico QA',fecha:'2026-10-05',materiales:[]}
  const bytes = await createRequirementPdf(requirement, [], [], new Uint8Array(readFileSync(new URL('../public/templates/pedido-materiales-logo.jpg',import.meta.url))))
  const {getDocument} = await import('pdfjs-dist/legacy/build/pdf.mjs')
  const loadingTask = getDocument({data:new Uint8Array(bytes),useSystemFonts:true})
  try {
    const pdf = await loadingTask.promise
    let text = ''
    for(let i=1;i<=pdf.numPages;i++) {
      const page = await pdf.getPage(i)
      text += (await page.getTextContent()).items.map(x=>x.str??'').join(' ')
    }
    assert.ok(text.includes('Dirección del proyecto:'))
    assert.ok(text.includes('Av. José Balta 123, interior 2'))
    assert.ok(text.includes('Lambayeque / Chiclayo / Chiclayo'))
    assert.ok(text.includes('Instalación de gas'))
  } finally { await loadingTask.destroy() }
})

test("cálculo comercial y FISE, conversiones y resultado sin duplicar compras", () => {
  const t = calculateQuote(budget)
  assert.deepEqual(t, {
    materiales: 100,
    gastos: 100,
    costoDirecto: 200,
    financiamiento: 8,
    generales: 10,
    utilidad: 40,
    subtotal: 258,
    comision: 7.74,
    valorVenta: 265.74,
    igv: 47.83,
    total: 313.57,
  })
  const fise = calculateQuote({
    ...budget,
    modalidad: "FISE",
    fise: {
      configuracion: "1",
      instalacion: "Interior",
      acometida: "Corta",
      ingresoSinIgv: 300,
    },
  })
  assert.equal(fise.utilidad, 73)
  assert.equal(fise.total, 354)
  const family = [
    {
      id: id(1),
      asignaciones: [
        { item_id: id(10), requerimiento_id: id(20), cantidad: 6 },
        { item_id: id(10), requerimiento_id: id(21), cantidad: 4 },
      ],
    },
  ]
  assert.equal(
    remainingMaterial(budget.materiales[0], family, [
      { id: id(20), estado: "CONFIRMADO" },
      { id: id(21), estado: "RECHAZADO" },
    ]),
    14,
  )
  const q = {
    ...family[0],
    estado: "ACEPTADA",
    importe_aceptado: 354,
    presupuesto: budget,
    totales: t,
  }
  const result = executionSummary(q, family, [
    { cotizacion_id: id(1), estado: "REGISTRADO", monto: 150 },
    { cotizacion_id: id(1), estado: "ANULADO", monto: 50 },
  ])
  assert.equal(result.actual, 150)
  assert.equal(result.result, 150)
  assert.equal(result.complete, false)
})

test("migración: permisos, estados, versiones, saldos idempotentes, gastos y cierre", async (t) => {
  const db = new PGlite()
  try {
    await db.exec(`
      create role anon; create role authenticated; create schema auth;
      create sequence public.cotizacion_codigo_seq;
      create table public.cotizaciones(id uuid primary key,codigo text);
      insert into public.cotizaciones values ('40000000-0000-4000-8000-000000000999','COT-ANTERIOR');
      create function public.operar_cotizacion(uuid,text,int,jsonb default null,text default '') returns text language sql as $$ select 'anterior'::text $$;
      create table public.perfiles(id uuid primary key,rol text,estado text);
      create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
      create function public.rol_actual() returns text language sql stable security definer set search_path='' as $$ select rol from public.perfiles where id=auth.uid() $$;
      create table public.proyectos(id uuid primary key,nombre text,ubicacion text,sede text,responsable text,cliente text,activo boolean default true);
      create table public.materiales(sku text primary key,nombre text,unidad text,activo boolean default true);
      create table public.requerimientos(id uuid primary key,proyecto_id uuid,sede text,ubicacion text,descripcion text,tecnico text,analista_id uuid,estado text default 'BORRADOR');
      create table public.requerimiento_items(requerimiento_id uuid,material_sku text,cantidad numeric);
      create table public.entregas(id uuid primary key,requerimiento_id uuid,estado text);
      create table public.devoluciones_materiales(id uuid primary key,requerimiento_id uuid,estado text);
      create function public.crear_requerimiento(p_id uuid,p_datos jsonb,p_items jsonb,p_borrador boolean default false) returns uuid language plpgsql set search_path='' as $$ begin
        if public.rol_actual()<>'analista' then raise exception 'Solo analista'; end if;
        insert into public.requerimientos(id,proyecto_id,sede,ubicacion,descripcion,tecnico,analista_id) values(p_id,(p_datos->>'proyecto_id')::uuid,p_datos->>'sede',p_datos->>'ubicacion',p_datos->>'descripcion',p_datos->>'tecnico',auth.uid());
        insert into public.requerimiento_items select p_id,x->>'skuId',(x->>'cantidad')::numeric from jsonb_array_elements(p_items) x; return p_id;
      end $$;
      create function public.enviar_requerimiento(p_id uuid) returns void language sql set search_path='' as $$ update public.requerimientos set estado='ENVIADO' where id=p_id $$;
      grant usage on schema auth to authenticated; grant select on public.perfiles to authenticated;
      insert into public.perfiles values('${id(100)}','analista','ACTIVO'),('${id(101)}','analista','ACTIVO'),('${id(102)}','coordinador','ACTIVO'),('${id(103)}','gerente','ACTIVO'),('${id(104)}','analista','INACTIVO');
      insert into public.proyectos values('${id(200)}','Proyecto','Dirección','Chiclayo','Técnico','Cliente',true);
      insert into public.materiales values('A','Tubería','MTS',true);
    `)
    await db.exec(
      readFileSync(
        new URL(
          "../supabase/migrations/20261002201400_flujo_cotizaciones_proyectos.sql",
          import.meta.url,
        ),
        "utf8",
      ),
    )
    await db.exec(readFileSync(new URL('../supabase/migrations/20261002215459_cotizacion_guiada_proyecto_al_aceptar.sql',import.meta.url),'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/20261002222328_validar_cotizacion_ubicacion_y_duplicados.sql',import.meta.url),'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/20261005135953_cotizacion_provincia_distrito_peru.sql',import.meta.url),'utf8'));
    await db.exec(readFileSync(new URL('../supabase/migrations/20261005141612_requerimiento_direccion_cotizada.sql',import.meta.url),'utf8'));
    assert.equal((await db.query('select codigo from public.cotizaciones')).rows[0].codigo,'COT-ANTERIOR');
    assert.equal((await db.query("select public.operar_cotizacion(null,'consulta',1) result")).rows[0].result,'anterior');
    const as = async (user, sql, params = []) => {
      await db.exec("begin; set local role authenticated")
      try {
        await db.query("select set_config('request.jwt.claim.sub',$1,true)", [
          id(user),
        ])
        const result = await db.query(sql, params)
        await db.exec("commit")
        return result
      } catch (e) {
        await db.exec("rollback")
        throw e
      }
    }
    const op = async (user, action, q, data = {}) =>
      (
        await as(user, "select public.operar_cotizacion_proyecto($1,$2,$3::jsonb) id", [
          action,
          id(q),
          JSON.stringify(data),
        ])
      ).rows[0].id
    const get = async (q = 1) =>
      (await db.query("select * from public.proyecto_cotizaciones where id=$1", [id(q)]))
        .rows[0]
    const transition = async (user, q, estado, extra = {}) =>
      op(user, "estado", q, {
        revision: (await get(q)).revision,
        estado,
        ...extra,
      })
    const request = async (q, req, quantity, revision) =>
      await op(100, "requerimiento", q, {
        revision: revision ?? (await get(q)).revision,
        requerimientoId: id(req),
        items: [{ itemId: id(10), cantidad: quantity }],
      })
    await t.test(
      "ubicación, números y duplicados se validan también al guardar",
      async () => {
        const calculate = async (b) =>
          db.query("select proyecto_cotizaciones_privado.calcular($1::jsonb)", [
            JSON.stringify(b),
          ])

        await calculate(budget)

        await calculate({...budget, ciudad: 'Jose Leonardo Ortiz', excel: {...budget.excel, distrito: 'Jose Leonardo Ortiz'}})
        await assert.rejects(calculate({...budget, excel: {...budget.excel, provincia: 'Ferreñafe'}}), /provincia/)
        await assert.rejects(calculate({...budget, excel: {...budget.excel, distrito: ''}}), /distrito/)
        const legacyExcel = {...budget.excel}
        delete legacyExcel.provincia
        delete legacyExcel.distrito
        await calculate({...budget, excel: legacyExcel})

        await assert.rejects(
          calculate({ ...budget, ciudad: "Chimbote" }),
          /departamento/,
        )

        await assert.rejects(
          calculate({
            ...budget,
            materiales: [
              budget.materiales[0],
              { ...budget.materiales[0], id: id(99) },
            ],
          }),
          /una sola vez/,
        )

        await assert.rejects(
          calculate({
            ...budget,
            gastos: [
              budget.gastos[0],
              {
                ...budget.gastos[0],
                id: id(98),
                descripcion: " CONSTRUCCIÓN  ",
              },
            ],
          }),
          /misma partida/,
        )

        await assert.rejects(
          calculate({
            ...budget,
            tasas: { ...budget.tasas, utilidad: "texto" },
          }),
        )

        await assert.rejects(
          calculate({
            ...budget,
            materiales: [{ ...budget.materiales[0], cantidad: "2" }],
          }),
        )
      },
    )

    await t.test('plantillas y resumen mensual requieren coordinación y validan cambios',async()=>{
      await assert.rejects(op(100,'plantilla',60,{nombre:'Tarifa',presupuesto:budget}),/coordinador/);
      await op(102,'plantilla',60,{nombre:'Tarifa',presupuesto:budget});
      const template=(await db.query('select * from public.cotizacion_plantillas')).rows[0];
      assert.deepEqual(template.parametros.excel,budget.excel);
      await assert.rejects(op(102,'plantilla',60,{nombre:'Cambio',presupuesto:budget}),/cambió/);
      await op(102,'plantilla',60,{nombre:'Tarifa revisada',presupuesto:budget,actualizadaEn:template.updated_at});
      await assert.rejects(op(100,'periodo',61,{periodo:'2026-01-01',gastosGeneralesJmp:10000}),/coordinación/);
      await op(102,'periodo',61,{periodo:'2026-01-01',gastosGeneralesJmp:10000,controlBonos:{'MYPES:Prospectos':{control:'>',cant:30}}});
      assert.equal((await as(103,'select * from public.cotizacion_periodos')).rows.length,1);
      assert.equal((await as(100,'select * from public.cotizacion_periodos')).rows.length,0);
      await assert.rejects(op(102,'periodo',61,{periodo:'2026-01-01',gastosGeneralesJmp:10000,controlBonos:{'MYPES:Prospectos':{control:'>',cant:1.5}}}),/entero/);
    });
    await t.test(
      "solo autor analista guarda; SQL recalcula y congela datos del catálogo",
      async () => {
        for (const actor of [102, 103, 104])
          await assert.rejects(
            op(actor, "guardar", 1, {
              revision: 0,
              proyecto: {nombre:'Proyecto cotizado',cliente:'Cliente',ubicacion:'Dirección',responsable:'Técnico'},
              presupuesto: budget,
            }),
            /permiso|analista/i,
          )
        await op(100, "guardar", 1, {
          revision: 0,
          proyecto: {nombre:'Proyecto cotizado',cliente:'Cliente',ubicacion:'Dirección',responsable:'Técnico'},
          presupuesto: budget,
        })
        const q = await get()
        assert.deepEqual(q.totales, calculateQuote(budget))
        assert.equal(q.presupuesto.materiales[0].nombre, "Tubería")
        assert.equal(
          (await as(101, "select * from public.proyecto_cotizaciones")).rows.length,
          0,
        )
        assert.equal(
          (await as(103, "select * from public.proyecto_cotizaciones")).rows.length,
          1,
        )
        assert.equal(
          (await as(104, "select * from public.proyecto_cotizaciones")).rows.length,
          0,
        )
        await assert.rejects(
          as(100, "update public.proyecto_cotizaciones set estado='ACEPTADA'"),
          /permission denied/,
        )
        await assert.rejects(
          op(101, "guardar", 1, {
            revision: 1,
            proyecto: {nombre:'Proyecto cotizado',cliente:'Cliente',ubicacion:'Dirección',responsable:'Técnico'},
            presupuesto: budget,
          }),
          /otro usuario/,
        )
        await assert.rejects(
          op(100, "guardar", 1, {
            revision: 0,
            proyecto: {nombre:'Proyecto cotizado',cliente:'Cliente',ubicacion:'Dirección',responsable:'Técnico'},
            presupuesto: budget,
          }),
          /cambió/,
        )
        await assert.rejects(
          op(100, "guardar", 1, {
            revision: 1,
            proyecto: {nombre:'Proyecto cotizado',cliente:'Cliente',ubicacion:'Dirección',responsable:'Técnico'},
            presupuesto: { ...budget, tasas: { ...budget.tasas, igv: 999 } },
          }),
          /rango/,
        )
      },
    )
    await t.test(
      "el analista acepta sin coordinación y crea el proyecto al aceptar",
      async () => {
        await assert.rejects(request(1, 20, 5), /aceptada/)
        assert.equal((await get()).proyecto_id,null);
        assert.equal((await db.query('select count(*)::int n from public.proyectos')).rows[0].n,1);
        await assert.rejects(transition(102,1,'APROBADA'),/analista/);
        await assert.rejects(transition(100,1,'EN_REVISION'),/analista/);
        await transition(100, 1, "PRESENTADA", { importe: 330 })
        await assert.rejects(
          transition(100, 1, "ACEPTADA", { importe: 320 }),
          /evidencia/,
        )
        await transition(100, 1, "ACEPTADA", {
          importe: 320,
          detalle: "Cliente aceptó por correo",
        })
        const q = await get()
        assert.ok(q.proyecto_id);
        assert.equal((await db.query('select count(*)::int n from public.proyectos')).rows[0].n,2);
        await assert.rejects(op(100,'eliminar',1,{revision:q.revision}),/eliminar/);
        await assert.rejects(op(100,'guardar',1,{revision:q.revision,presupuesto:budget}),/borradores/);
        assert.equal(q.importe_presentado, "330.00")
        assert.equal(q.importe_aceptado, "320.00")
        assert.equal(q.totales.total, 313.57)
      },
    )
    await t.test(
      "solicitudes por etapas, conversión, reintentos y rechazo sin sobreasignación",
      async () => {
        const rev = (await get()).revision
        await request(1, 20, 6, rev)
        await request(1, 20, 6, rev)
        const inherited = (await db.query('select ubicacion,tecnico,descripcion from public.requerimientos where id=$1', [id(20)])).rows[0]
        assert.equal(inherited.ubicacion, 'Dirección — Lambayeque / Chiclayo / Chiclayo')
        assert.equal(inherited.tecnico, budget.tecnico)
        assert.ok(inherited.descripcion.includes(budget.alcance))
        assert.equal(
          (await db.query("select count(*) n from public.requerimientos"))
            .rows[0].n,
          1,
        )
        assert.equal(
          (
            await db.query(
              "select sum(cantidad) n from public.requerimiento_items",
            )
          ).rows[0].n,
          "6",
        )
        await assert.rejects(request(1, 21, 15), /saldo/)
        await request(1, 21, 14)
        await assert.rejects(request(1, 22, 1), /saldo/)
        await db.query(
          "update public.requerimientos set estado='RECHAZADO' where id=$1",
          [id(21)],
        )
        await request(1, 22, 14)
      },
    )
    await t.test(
      "una nueva aceptación conserva asignaciones y sustituye la versión anterior",
      async () => {
        await op(100, "version", 1, {
          revision: (await get()).revision,
          nuevoId: id(2),
        })
        const reduced = {
          ...budget,
          materiales: [{ ...budget.materiales[0], cantidad: 1 }],
        }
        await op(100, "guardar", 2, {
          revision: 1,
          proyecto: {nombre:'Proyecto cotizado',cliente:'Cliente',ubicacion:'Dirección',responsable:'Técnico'},
          presupuesto: reduced,
        })
        await transition(100, 2, "PRESENTADA", { importe: 300 })
        await assert.rejects(
          transition(100, 2, "ACEPTADA", {
            importe: 300,
            detalle: "Aceptación",
          }),
          /reduce/,
        )
        await op(100, "version", 1, {
          revision: (await get()).revision,
          nuevoId: id(3),
        })
        await transition(100, 3, "PRESENTADA", { importe: 354 })
        assert.equal((await get()).estado,'ACEPTADA');
        assert.equal((await db.query('select count(*)::int n from public.proyectos')).rows[0].n,2);
        await transition(100, 3, "ACEPTADA", {
          importe: 354,
          detalle: "Versión aprobada por cliente",
        })
        assert.equal((await get()).estado, "SUPERADA")
        assert.equal((await get(3)).estado, "ACEPTADA")
        await assert.rejects(request(3, 23, 1), /saldo/)
      },
    )
    await t.test('eliminación solo para el rechazo del cliente; origen de proyectos y requerimientos protegido',async()=>{
      const data={revision:0,proyecto:{nombre:'Sin contrato',cliente:'Cliente',ubicacion:'Dirección',responsable:'Técnico'},presupuesto:budget};
      await op(100,'guardar',80,data);
      await assert.rejects(op(100,'eliminar',80,{revision:(await get(80)).revision}),/no aceptó/);
      await transition(100,80,'RECHAZADA',{detalle:'Cliente no desea contratar'});
      await assert.rejects(op(102,'eliminar',80,{revision:(await get(80)).revision}),/Solo/);
      await op(100,'eliminar',80,{revision:(await get(80)).revision});
      assert.ok((await get(80)).eliminada_en);
      await transition(100,2,'RECHAZADA',{detalle:'Cliente no aceptó el cambio'});
      await assert.rejects(op(100,'eliminar',2,{revision:(await get(2)).revision}),/aceptada no se puede/);
      await assert.rejects(op(100,'version',80,{revision:(await get(80)).revision,nuevoId:id(81)}),/eliminada/);
      await assert.rejects(db.exec("insert into public.proyectos values('40000000-0000-4000-8000-000000000888','Directo','Dir','Chiclayo','Tec','Cli',true)"),/cotización/);
      await assert.rejects(db.exec("insert into public.requerimientos(id,proyecto_id) values('40000000-0000-4000-8000-000000000888','40000000-0000-4000-8000-000000000200')"),/cotización aceptada/);
      assert.equal((await db.query('select count(*)::int n from public.proyectos')).rows[0].n,2);
    });
    await t.test(
      "costos auditables y cierre con pendientes bloqueado",
      async () => {
        const expense = {
          revision: (await get(3)).revision,
          gastoId: id(30),
          rubro: "MANO_OBRA",
          descripcion: "Mano de obra real",
          monto: 150,
          fecha: "2026-01-01",
          comprobante: "REC-001",
        }
        await op(100, "gasto", 3, expense)
        await op(100, "gasto", 3, expense)
        assert.equal(
          (await db.query("select count(*) n from public.proyecto_gastos"))
            .rows[0].n,
          1,
        )
        await assert.rejects(
          op(102, "cerrar", 3, {
            revision: (await get(3)).revision,
            detalle: "Conciliado",
          }),
          /pendientes/,
        )
        await assert.rejects(
          op(100, "anular_gasto", 3, {
            revision: (await get(3)).revision,
            gastoId: id(30),
          }),
          /motivo/,
        )
        await op(102, "anular_gasto", 3, {
          revision: (await get(3)).revision,
          gastoId: id(30),
          detalle: "Recibo duplicado",
        })
        assert.equal(
          (await db.query("select estado from public.proyecto_gastos")).rows[0]
            .estado,
          "ANULADO",
        )
        await op(100, "gasto", 3, {
          ...expense,
          revision: (await get(3)).revision,
          gastoId: id(31),
        })
        await assert.rejects(op(100,'gasto',3,{...expense,revision:(await get(3)).revision,gastoId:id(33),rubro:'BONO',monto:1}),/posterior/);
        await op(102,'habilitar',3,{revision:(await get(3)).revision,fechaHabilitacion:'2026-01-01'});
        await assert.rejects(op(100,'gasto',3,{...expense,revision:(await get(3)).revision,gastoId:id(33),rubro:'BONO',monto:1}),/saldo/);
        await db.exec(
          `update public.requerimientos set estado='CONFIRMADO' where estado='ENVIADO'; insert into public.entregas select gen_random_uuid(),id,'COMPLETA' from public.requerimientos where estado='CONFIRMADO';`,
        )
        await assert.rejects(
          op(100, "cerrar", 3, {
            revision: (await get(3)).revision,
            detalle: "Conciliado",
          }),
          /coordinador/,
        )
        await db.exec(`insert into public.devoluciones_materiales values('${id(70)}','${id(20)}','PENDIENTE_VALIDACION');`);
        await assert.rejects(op(102,'cerrar',3,{revision:(await get(3)).revision,detalle:'Conciliado',fechaHabilitacion:'2026-01-01'}),/devoluciones/);
        await db.exec("update public.devoluciones_materiales set estado='VALIDADA'");
        await op(102, "cerrar", 3, {
          revision: (await get(3)).revision,
          detalle: "Consumos, devoluciones y todos los costos conciliados",
          fechaHabilitacion: "2026-01-01",
        })
        await assert.rejects(
          op(100, "gasto", 3, {
            ...expense,
            gastoId: id(32),
            revision: (await get(3)).revision,
          }),
          /aceptada/,
        )
        await assert.rejects(
          op(100, "version", 3, {
            nuevoId: id(4),
            revision: (await get(3)).revision,
          }),
          /cerrado/,
        )
        assert.equal((await get(3)).estado, "CERRADA")
      },
    )
  } finally {
    await db.close()
  }
})
