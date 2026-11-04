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
      const events = window.dataLayer.slice(2).map(args=>Array.from(args));
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
