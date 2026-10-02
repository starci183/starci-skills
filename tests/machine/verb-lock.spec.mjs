// Function-backed host verbs use one adapter for the optional RIGHTS host lock.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { pathToFileURL } from 'node:url';
import { underHostLock } from '../../scripts/machine/verb-lock.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

test('an injected host lock is preferred and its held result is unchanged', async () => {
  let call;
  const withHostLock = async (options, fn) => {
    call = options;
    return await fn();
  };
  assert.deepEqual(await underHostLock({ role: 'lead', purpose: 'fixture', env: {} }, async () => 42, { withHostLock }), {
    ok: true, locked: true, value: 42,
  });
  assert.deepEqual(call, { role: 'lead', purpose: 'fixture' });

  const held = { ok: false, reason: 'held', owner: { role: 'release', purpose: 'cut' } };
  assert.equal(await underHostLock({ role: 'lead', purpose: 'fixture', env: {} }, async () => 42, {
    withHostLock: async () => held,
  }), held);
});

test('the sibling-compatible dynamic lock branch imports withHostLock from a fixture URL', async (t) => {
  const root = mkdtemp(t, 'starci-verb-lock-');
  const file = path.join(root, 'host-lock.mjs');
  fs.writeFileSync(file, `export async function withHostLock({role, purpose}, fn) {
  return {role, purpose, result: await fn()};
}\n`);
  const result = await underHostLock({ role: 'coordinator', purpose: 'land', env: {} }, async () => 'done', {
    hostLockUrl: pathToFileURL(file),
  });
  assert.deepEqual(result, {
    ok: true,
    locked: true,
    value: { role: 'coordinator', purpose: 'land', result: 'done' },
  });
});

test('the no-lock branch reports unlocked, and callback errors still propagate', async () => {
  assert.deepEqual(await underHostLock({ role: 'worker', purpose: 'test', env: {} }, async () => 'plain', {
    existsSync: () => false,
  }), { ok: true, locked: false, value: 'plain' });

  let released = false;
  await assert.rejects(() => underHostLock({ role: 'lead', purpose: 'test', env: {} }, async () => {
    throw new Error('boom');
  }, {
    withHostLock: async (options, fn) => {
      try { return await fn(); } finally { released = true; }
    },
  }), /boom/);
  assert.equal(released, true);
});
