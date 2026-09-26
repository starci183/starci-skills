// temp-leak-guard.spec.mjs — the suite's temp-root guard (tests/setup/isolated-temp.mjs) proves itself:
// a child `node --test` run whose spec leaves a starci* dir in the dedicated temp root must exit nonzero and
// name the leftover, and a run whose spec removes its dir must exit 0. The children run with
// STARCI_TEST_TEMP_DIR unset so each builds its own temp root inside this suite's.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {TEST_TEMP_ENV} from './setup/isolated-temp.mjs';

const preload = pathToFileURL(path.resolve(import.meta.dirname, 'setup', 'isolated-temp.mjs')).href;
const fixture = name => path.resolve(import.meta.dirname, 'fixtures', name);
const runSuite = file => {
  const env = {...process.env};
  delete env[TEST_TEMP_ENV];
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ['--import', preload, '--test', file], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env, encoding: 'utf8', windowsHide: true, timeout: 120000,
  });
};

test('a spec that leaves a temp dir fails the run, and the leftover is named', () => {
  const r = runSuite(fixture('temp-leak-leaves.mjs'));
  assert.notEqual(r.status, 0, r.stderr);
  const out = r.stdout + r.stderr; // node --test surfaces the child's diagnostics on either stream
  assert.match(out, /STARCI TEST TEMP LEAK/);
  assert.match(out, /starci-leak-fixture-/);
});

test('a spec that removes its temp dir passes clean', () => {
  const r = runSuite(fixture('temp-leak-clean.mjs'));
  assert.equal(r.status, 0, r.stderr);
  assert.doesNotMatch(r.stdout + r.stderr, /STARCI TEST TEMP LEAK/);
});
