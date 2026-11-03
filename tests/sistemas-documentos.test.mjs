import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync('src/services/sistemasDocumentosService.ts', 'utf8')
  .replace("import { supabase } from './supabase';", 'const supabase = {};');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const { validarDocumento } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('Documentos: valida tamaño, formatos y contenido antes de subir', async () => {
  assert.equal((await validarDocumento(new File(['%PDF-1.4\nContenido'], 'archivo.PDF'))).tipo, 'application/pdf');
  assert.equal((await validarDocumento(new File(['Título,Valor\nUno,1'], 'datos.csv'))).tipo, 'text/csv');
  await assert.rejects(validarDocumento(new File(['falso'], 'archivo.pdf')), /no coincide/);
  await assert.rejects(validarDocumento(new File([], 'vacio.txt')), /contenido/);
  await assert.rejects(validarDocumento(new File(['ejecutable'], 'programa.exe')), /Formato no permitido/);
  await assert.rejects(validarDocumento(new File([new Uint8Array([0,1,2])], 'archivo.txt')), /datos binarios/);
  await assert.rejects(validarDocumento(new File([new Uint8Array(20*1024*1024+1)], 'grande.txt')), /20 MB/);
});
