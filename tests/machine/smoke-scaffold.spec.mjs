import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { smokeScaffold } from '../../scripts/machine/smoke-scaffold.mjs';

const success = () => ({ status: 0, stdout: '', stderr: '' });

test('smoke scaffold runs the full proof sequentially and removes its scratch root', async () => {
  const calls = [];
  let tick = 0;
  const result = await smokeScaffold({ cwd: process.cwd(), global: { edition: 'full' }, args: {}, role: 'release', env: {} }, {
    makeTemp: (parent) => { calls.push(['temp', parent]); return path.join(parent, 'starci-smoke-fixture'); },
    now: () => ++tick,
    underHostLock: async (options, fn) => { calls.push(['lock', options]); return fn(); },
    runNode: (argv, options) => { calls.push(['node', argv, options.cwd]); return success(); },
    runNpm: (argv, options) => { calls.push(['npm', argv, options.cwd]); return success(); },
    remove: (root) => { calls.push(['remove', root]); return { ok: true }; },
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, {
    schema: 'starci/smoke-scaffold@1', edition: 'full',
    steps: ['scaffold', 'install', 'lint', 'typecheck', 'build', 'check'].map((name) => ({ name, ok: true, ms: 1 })),
  });
  assert.deepEqual(calls.find((call) => call[0] === 'lock')[1], { role: 'release', purpose: 'smoke-scaffold', env: {} });
  assert.deepEqual(calls.filter((call) => call[0] === 'npm').map((call) => call[1]), [
    ['install', '--no-audit', '--no-fund'], ['ci', '--no-audit', '--no-fund'],
    ['run', 'lint'], ['run', 'typecheck', '--if-present'], ['run', 'build', '--if-present'],
  ]);
  assert.equal(calls.at(-1)[0], 'remove');
});

test('smoke scaffold stops after a red step, cleans up, and --keep retains output', async () => {
  let removed = 0;
  const deps = {
    makeTemp: (parent) => path.join(parent, 'starci-smoke-fixture'),
    underHostLock: async (_options, fn) => fn(),
    runNode: () => success(),
    runNpm: (argv) => argv[0] === 'install' ? { status: 1, stderr: 'registry red' } : success(),
    remove: () => { removed += 1; return { ok: true }; },
  };
  const failed = await smokeScaffold({ cwd: '.', global: { edition: 'lite' }, args: {}, env: {} }, deps);
  assert.equal(failed.code, 1);
  assert.deepEqual(failed.data.steps.map((step) => step.name), ['scaffold', 'install']);
  assert.equal(removed, 1);
  const kept = await smokeScaffold({ cwd: '.', global: { edition: 'lite' }, args: { keep: true }, env: {} }, deps);
  assert.equal(kept.code, 1);
  assert.equal(removed, 1);
  assert.match(kept.text, /kept/);
});

test('smoke scaffold refuses a missing or unknown edition before any external call', async () => {
  let called = false;
  const deps = { runNode: () => { called = true; } };
  assert.equal((await smokeScaffold({ cwd: '.', global: {}, args: {} }, deps)).code, 2);
  assert.equal((await smokeScaffold({ cwd: '.', global: { edition: 'other' }, args: {} }, deps)).code, 2);
  assert.equal(called, false);
});
