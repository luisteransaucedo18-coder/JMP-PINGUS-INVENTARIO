import { spawn, spawnSync } from 'node:child_process';
import { createServer } from 'node:net';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const testsDir = path.join(root, 'tests');
const viteCli = path.join(root, 'node_modules', 'vite', 'bin', 'vite.js');
const filter = process.env.QA_E2E_FILTER;

function availablePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      probe.close(error => error ? reject(error) : resolve(address.port));
    });
  });
}

async function waitForServer(url, server) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`Vite exited with code ${server.exitCode}`);
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* Vite is still starting. */ }
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  throw new Error(`Vite did not become ready at ${url}`);
}

const port = await availablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [viteCli, '--host', '127.0.0.1', '--port', String(port), '--strictPort'], {
  cwd: root,
  env: { ...process.env, PORT: String(port), FIGMA_DEV_SERVER_HOST: '127.0.0.1' },
  stdio: 'ignore',
});

let failures = 0;
try {
  await waitForServer(baseUrl, server);
  const entries = (await readdir(testsDir))
    .filter(name => name.endsWith('.e2e.mjs'))
    .filter(name => !filter || name.includes(filter))
    .sort();
  if (!entries.length) throw new Error(filter ? `No E2E scripts match ${filter}` : 'No E2E scripts found');

  for (const name of entries) {
    const result = spawnSync(process.execPath, [path.join(testsDir, name)], {
      cwd: root,
      env: { ...process.env, QA_BASE_URL: baseUrl },
      encoding: 'utf8',
      timeout: 600_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim();
    if (result.status === 0) {
      console.log(`PASS ${name}`);
      if (output) console.log(output);
      continue;
    }
    failures++;
    console.error(`FAIL ${name} (exit ${result.status ?? 'timeout'})`);
    console.error(output.split('\n').slice(-100).join('\n').slice(-16_000));
  }

  console.log(`E2E: ${entries.length - failures} passed, ${failures} failed`);
} catch (error) {
  failures++;
  console.error(error instanceof Error ? error.message : error);
} finally {
  server.kill();
}

if (failures) process.exitCode = 1;
