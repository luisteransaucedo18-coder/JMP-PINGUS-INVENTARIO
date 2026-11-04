import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/services/analytics.ts', import.meta.url), 'utf8');
function compile(production) {
  return ts.transpileModule(source.replace('import.meta.env.PROD', String(production)), {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText;
}
let sequence = 0;
async function load(production, hostname) {
  const scripts = [];
  globalThis.window = { location: { hostname, origin: `https://${hostname}`, search: '?email=private@example.com', hash: '#access_token=secret' } };
  globalThis.document = { createElement: () => ({}), head: { appendChild: script => scripts.push(script) } };
  const module = await import(`data:text/javascript;base64,${Buffer.from(compile(production) + `\n// ${sequence++}`).toString('base64')}`);
  return { module, scripts };
}

test('GA4 se carga solo en producción y en los dominios de JMP', async () => {
  try {
    for (const [production, host] of [[false,'jmpingus.com'],[true,'localhost'],[true,'127.0.0.1'],[true,'preview.vercel.app'],[true,'jmpingus.com.evil.test']]) {
      const { module, scripts } = await load(production,host);
      module.initializeAnalytics();
      module.trackPage('dashboard','Inicio');
      assert.equal(scripts.length,0);
      assert.equal(window.dataLayer,undefined);
    }
    for (const host of ['jmpingus.com','www.jmpingus.com']) {
      const { module, scripts } = await load(true,host);
      module.initializeAnalytics();
      module.initializeAnalytics();
      assert.equal(scripts.length,1);
      assert.equal(scripts[0].async,true);
      assert.equal(scripts[0].src,'https://www.googletagmanager.com/gtag/js?id=G-ZKDSTJE4RD');
      const config = Array.from(window.dataLayer[1]);
      assert.equal(config[0],'config');
      assert.equal(config[2].send_page_view,false);
      assert.equal(config[2].allow_google_signals,false);
      assert.equal(config[2].allow_ad_personalization_signals,false);
      module.trackPage('dashboard','Inicio');
      module.trackPage('dashboard','Inicio');
      module.trackPage('sistemas','Sistemas');
      module.trackPage('login','Iniciar sesión');
      const events = window.dataLayer.map(args=>Array.from(args)).filter(args=>args[0]==='event');
      assert.equal(events.length,3);
      assert.equal(events[0][1],'page_view');
      assert.equal(events[1][2].page_referrer,`https://${host}/app/dashboard`);
      assert.equal(events[1][2].page_location,`https://${host}/app/sistemas`);
      assert.equal(events[2][2].page_title,'Iniciar sesión | JMP Pingus');
      assert.doesNotMatch(JSON.stringify(window.dataLayer),/private@example|secret|access_token|user_id/);
    }
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});

test('interacciones se agrupan por módulo y rol, sin contenido de controles', async () => {
  try {
    const { module } = await load(true,'jmpingus.com');
    module.trackModuleInteraction('button_click');
    module.initializeAnalytics();
    module.trackModuleInteraction('button_click');
    module.trackPage('login','Iniciar sesión');
    module.trackModuleInteraction('form_submit');
    module.trackPage('sistemas','Sistemas','analista');
    module.trackPage('sistemas','Sistemas','analista');
    for (const kind of ['button_click','link_click','field_change','form_submit']) module.trackModuleInteraction(kind);
    module.trackPage('inventario','Inventario','coordinador');
    module.trackModuleInteraction('button_click');
    module.trackModuleInteraction('contenido-privado');
    const all = window.dataLayer.map(args=>Array.from(args));
    const interactions = all.filter(args=>args[1]==='module_interaction');
    assert.equal(interactions.length,5);
    assert.equal(interactions[0][2].module_id,'sistemas');
    assert.equal(interactions[0][2].user_role,'analista');
    assert.equal(interactions[4][2].module_id,'inventario');
    assert.equal(interactions[4][2].user_role,'coordinador');
    assert.deepEqual(Object.keys(interactions[0][2]).sort(),['send_to','page_location','page_title','page_referrer','module_id','user_role','interaction_type'].sort());
    assert.equal(all.filter(args=>args[1]==='page_view' && args[2].module_id==='sistemas').length,1);
    const globalContext = all.filter(args=>args[0]==='set').at(-1)[1];
    assert.equal(globalContext.page_location,'https://jmpingus.com/app/inventario');
    module.trackPage('login','Iniciar sesión');
    assert.equal(window.dataLayer.at(-1)[2].user_role,'visitante');
  } finally {
    delete globalThis.window;
    delete globalThis.document;
  }
});
