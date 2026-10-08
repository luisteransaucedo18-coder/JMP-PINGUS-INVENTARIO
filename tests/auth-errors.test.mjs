import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { test } from 'node:test';
import ts from 'typescript';

const source = readFileSync(new URL('../src/utils/authErrors.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext } }).outputText;
const { authErrorMessage, isInvalidCredentials } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);

test('recognizes invalid credentials from modern codes and legacy responses', () => {
  assert(isInvalidCredentials({ code: 'invalid_credentials', status: 400 }));
  assert(isInvalidCredentials({ message: 'Invalid login credentials' }));
  assert(!isInvalidCredentials({ status: 500, code: 'unexpected_failure' }));
  assert.equal(authErrorMessage({ code: 'invalid_credentials' }), 'Correo o contraseña incorrectos.');
});
test('distinguishes service, rate-limit, account and connectivity errors', () => {
  assert.match(authErrorMessage({ status: 500 }), /servicio.*temporalmente/);
  assert.match(authErrorMessage({ status: 500, name: 'AuthRetryableFetchError' }), /servicio.*temporalmente/);
  assert.match(authErrorMessage({ status: 429 }), /demasiados intentos/);
  assert.match(authErrorMessage({ code: 'email_not_confirmed' }), /correo.*confirmado/);
  assert.match(authErrorMessage({ code: 'user_banned' }), /acceso activo/);
  assert.match(authErrorMessage({ name: 'AuthRetryableFetchError' }), /conexión/);
});
test('never exposes raw server messages and safely handles unknown errors', () => {
  for (const error of [null, undefined, 'private server data', { message: 'private server data' }]) {
    assert.equal(authErrorMessage(error), 'No se pudo verificar el acceso. Inténtalo nuevamente.');
  }
});
