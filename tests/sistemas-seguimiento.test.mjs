import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
const source = readFileSync('src/services/sistemasSeguimientoService.ts','utf8').replace("import { supabase } from './supabase';", 'const supabase = {};');
const js = ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const { progresoTarea } = await import(`data:text/javascript;base64,${Buffer.from(js).toString('base64')}`);
test('El progreso refleja elementos completados, incluidos los ocultos y las subtareas', () => {
  assert.deepEqual(progresoTarea([]),{completos:0,total:0,porcentaje:0});
  const pasos = [{completado:true},{completado:false},{completado:false}];
  assert.deepEqual(progresoTarea(pasos),{completos:1,total:3,porcentaje:33});
  assert.equal(progresoTarea(pasos.map(p=>({...p,completado:true}))).porcentaje,100);
  assert.equal(progresoTarea(pasos.filter(p=>!p.completado)).porcentaje,0);
  assert.equal(progresoTarea([{completado:true},{completado:false}]).porcentaje,50);
});
