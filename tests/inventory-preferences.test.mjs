import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';
const source=readFileSync(new URL('../src/utils/inventoryPreferences.ts',import.meta.url),'utf8');
const exports={};
new Function('exports','require',ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText)(exports,()=>({SEDES:['Chiclayo','Chimbote','Trujillo']}));
const {readInventoryPreferences,saveInventoryPreferences,DEFAULT_INVENTORY_PREFERENCES}=exports;
function session(run){const previous=globalThis.window;const values=new Map();globalThis.window={sessionStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value)}};try{run(values);}finally{if(previous===undefined)delete globalThis.window;else globalThis.window=previous;}}
test('conserva filtros por usuario dentro de la sesión sin mezclarlos',()=>session(()=>{
 const selected={search:'cable',category:'1',status:'AGOTADO',sede:'Chiclayo',technical:true};
 saveInventoryPreferences('ana',selected);
 assert.deepEqual(readInventoryPreferences('ana'),selected);
 assert.deepEqual(readInventoryPreferences('otro'),DEFAULT_INVENTORY_PREFERENCES);
 assert.deepEqual(readInventoryPreferences(),DEFAULT_INVENTORY_PREFERENCES);
}));
test('descarta datos inválidos y funciona con almacenamiento bloqueado',()=>session(values=>{
 values.set('inventory-filters:ana',JSON.stringify({search:12,sede:'No existe',status:'INVENTADO',technical:'true'}));
 assert.deepEqual(readInventoryPreferences('ana'),DEFAULT_INVENTORY_PREFERENCES);
 values.set('inventory-filters:ana','invalid json');
 assert.deepEqual(readInventoryPreferences('ana'),DEFAULT_INVENTORY_PREFERENCES);
 globalThis.window.sessionStorage={getItem(){throw new Error('blocked');},setItem(){throw new Error('blocked');}};
 assert.deepEqual(readInventoryPreferences('ana'),DEFAULT_INVENTORY_PREFERENCES);
 assert.doesNotThrow(()=>saveInventoryPreferences('ana',DEFAULT_INVENTORY_PREFERENCES));
}));
