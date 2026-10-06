import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { test } from 'node:test'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'
import * as jsxRuntime from 'react/jsx-runtime'

const source = readFileSync(new URL('../src/utils/formValidation.ts', import.meta.url), 'utf8')
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText
const { validateProject, validateNumber, validateDocument, validEmail, validatePhone, validateTextFields } =
  await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`)
const project = nombre => ({ nombre, cliente: 'Cliente 123', responsable: 'José Pérez', ubicacion: 'Av. Perú 123' })

test('proyecto: acepta 100 caracteres y rechaza 101, blancos y tipos incorrectos', () => {
  validateProject(project('ñ'.repeat(100)))
  for (const name of ['a'.repeat(101), '   ', 100, null]) assert.throws(() => validateProject(project(name)))
  validateProject(project('Proyecto 2026 - Etapa 2'))
  assert.throws(() => validateProject({ ...project('Obra'), ubicacion: 'a'.repeat(301) }))
})

test('números: no admite cadenas, exponentes como texto, infinitos, negativos o fracciones enteras', () => {
  for (const value of ['12abc', '1e3', '', '12', NaN, Infinity, -1, 100000001])
    assert.throws(() => validateNumber(value, 'Cantidad'))
  validateNumber(0, 'Stock')
  validateNumber(1.25, 'Metros')
  assert.throws(() => validateNumber(1.25, 'Unidades', 1, 100, true))
  assert.throws(() => validateNumber(11, 'Entregado', 0, 10))
})

test('documentos y contacto: conserva ceros iniciales y admite formato telefónico internacional', () => {
  validateDocument('01234567')
  validateDocument('')
  for (const dni of ['1234567', '123456789', '12ABC678', '-1234567']) assert.throws(() => validateDocument(dni))
  assert.ok(validEmail('ana+obra@jip.pe'))
  for (const email of ['ana@', 'ana @jip.pe', 'ana@jip', 'a'.repeat(255) + '@jip.pe']) assert.ok(!validEmail(email))
  validatePhone('+51 987 654 321')
  validatePhone('(074) 123-456')
  for (const phone of ['llamar mañana', '123', '1234567890123456', '++51987654321']) assert.throws(() => validatePhone(phone))
  assert.throws(() => validateTextFields({ items: [{ unidad: 'a'.repeat(21) }] }))
  assert.throws(() => validateTextFields({ observaciones: 'a'.repeat(1001) }))
})

test('campo numérico: rechaza letras/exponentes/fracciones enteras sin convertirlas parcialmente', () => {
  const inputSource = readFileSync(new URL('../src/components/StrictNumberInput.tsx', import.meta.url), 'utf8')
  const output = ts.transpileModule(inputSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText
  const exports = {}
  new Function('exports', 'require', output)(exports, () => jsxRuntime)
  const changes = []
  const element = exports.default({ value: 2, onChange: event => changes.push(event.currentTarget.value) })
  for (const value of ['12abc', '1e3', '-1', '2.5', 'Infinity']) {
    const target = { value }
    element.props.onChange({ currentTarget: target })
    assert.equal(target.value, '2')
  }
  assert.deepEqual(changes, [])
  element.props.onChange({ currentTarget: { value: '12' } })
  element.props.onChange({ currentTarget: { value: '' } })
  assert.deepEqual(changes, ['12', ''])
  const decimal = exports.default({ value: 2, step: '0.001', onChange: event => changes.push(event.currentTarget.value) })
  decimal.props.onChange({ currentTarget: { value: '2.125' } })
  assert.equal(changes.at(-1), '2.125')
})

test('base de datos: valida límites con acceso directo y conserva registros históricos sin truncarlos', async () => {
  const db = new PGlite()
  try {
    await db.exec(`create role anon; create role authenticated;
      create table proyectos(id integer primary key, nombre text, cliente text, responsable text, ubicacion text, observaciones text);
      create table proyecto_cotizaciones(id integer primary key, proyecto_snapshot jsonb, observaciones text, cierre text, importe_presentado numeric, importe_aceptado numeric);
      create table cotizacion_plantillas(nombre text);
      create table materiales(sku text, nombre text, descripcion text, unidad text, stock_minimo numeric, precio_unitario numeric);
      create table inventario_sedes(stock numeric);
      create table perfiles(nombre text, email text, telefono text, cargo text, bio text);
      create table entregas(tecnico text, dni_tecnico text, observaciones text);
      create table ordenes_compra(motivo text, observaciones text, nota_compra text);
      create table requerimientos(tecnico text, observaciones text);
      create table traslados(transportista text, guia text, numero_comprobante text, observaciones text, costo numeric);
      create table proyecto_gastos(descripcion text, comprobante text, motivo_anulacion text, monto numeric, cantidad numeric);
      insert into proyectos(id,nombre) values(1,repeat('a',101));
      grant usage on schema public to authenticated;
      grant select,insert,update on all tables in schema public to authenticated;`)
    await db.exec(readFileSync(new URL('../supabase/migrations/20261006132816_validar_campos_formularios.sql', import.meta.url), 'utf8'))
    await db.exec('set role authenticated')
    await db.query('insert into proyectos(id,nombre) values(2,$1)', ['ñ'.repeat(100)])
    await assert.rejects(db.query('insert into proyectos(id,nombre) values(3,$1)', ['a'.repeat(101)]), /máximo 100/)
    await assert.rejects(db.query('insert into proyectos(id,nombre) values(3,$1)', ['  ']), /requerido/)
    await db.query("update proyectos set observaciones='Histórico' where id=1")
    assert.equal((await db.query('select nombre from proyectos where id=1')).rows[0].nombre.length, 101)
    await db.query('insert into proyecto_cotizaciones(id,proyecto_snapshot) values(1,$1)', [JSON.stringify(project('Obra'))])
    await assert.rejects(db.query('insert into proyecto_cotizaciones(id,proyecto_snapshot) values(2,$1)', [JSON.stringify(project('a'.repeat(101)))]), /máximo 100/)
    await assert.rejects(db.query('insert into proyecto_cotizaciones(id,proyecto_snapshot) values(2,$1)', [JSON.stringify(project(123))]), /completa nombre/)
    await assert.rejects(db.exec("insert into entregas(dni_tecnico) values('1234567')"), /8 dígitos/)
    await db.exec("insert into entregas(dni_tecnico) values('01234567')")
    await db.exec("insert into perfiles(nombre,email,telefono) values('José','ana@jip.pe','+51 987 654 321')")
    await assert.rejects(db.exec("insert into perfiles(email) values('ana@')"), /Correo/)
    await assert.rejects(db.exec("insert into inventario_sedes(stock) values(-1)"), /rango/)
    await assert.rejects(db.exec("insert into inventario_sedes(stock) values('NaN')"), /número|rango/)
    await db.exec('insert into inventario_sedes(stock) values(1.25)')
  } finally { await db.close() }
})
