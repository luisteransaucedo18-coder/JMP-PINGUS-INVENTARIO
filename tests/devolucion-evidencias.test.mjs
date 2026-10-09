import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const load = (path, require) => {
  const exports = {};
  const js = ts.transpileModule(readFileSync(path,'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
  new Function('exports','require',js)(exports,require); return exports;
};
const photos=load('src/utils/profilePhoto.ts',()=>{});
const jpg=()=>new File([new Uint8Array([255,216,255,0])],'foto.jpg',{type:'image/jpeg'});
function service({failUpload=false,failRpc=false}={}) {
  const uploads=[],removed=[];
  const api={auth:{getUser:async()=>({data:{user:{id:'QA'}}})},storage:{from:()=>({upload:async path=>{uploads.push(path);if(failUpload&&uploads.length===2)throw Error('Fallo de red');return {error:null};},remove:async paths=>{removed.push(...paths);return {error:null};}})},rpc:async()=>({error:failRpc?Error('Registro rechazado'):null})};
  const module=load('src/services/devolucionService.ts',name=>name==='./supabase'?{supabase:api}:name.endsWith('/profilePhoto')?photos:{});
  return {submit:files=>module.registrarDevolucion({requerimientoId:'REQ',sedeReceptora:'Chiclayo',items:[],files}),uploads,removed};
}
test('valida todas las fotografías antes de subir y rechaza contenido disfrazado',async()=>{
  const api=service();
  await assert.rejects(api.submit([jpg(),new File(['<html>'],'falsa.jpg',{type:'image/jpeg'})]),/imagen.*válida/);
  assert.equal(api.uploads.length,0);
  await assert.rejects(api.submit([]),/Adjunta/);
});
test('limpia las fotos subidas si falla la red o el registro y conserva el error original',async()=>{
  const network=service({failUpload:true});
  await assert.rejects(network.submit([jpg(),jpg()]),/Fallo de red/);
  assert.deepEqual(network.removed,[network.uploads[0]]);
  const rejected=service({failRpc:true});
  await assert.rejects(rejected.submit([jpg()]),/Registro rechazado/);
  assert.deepEqual(rejected.removed,rejected.uploads);
});
