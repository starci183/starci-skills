// Function-backed host verbs use one adapter for the host lock.
import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';
import { underHostLock } from '../../scripts/machine/verb-lock.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

test('an injected host lock runs the operation and wraps its value', async () => {
  let call;
  const withHostLock = async (options, fn) => { call = options; return await fn(); };
  assert.deepEqual(await underHostLock({ role: 'lead', purpose: 'fixture', env: {} }, async () => 42, { withHostLock }), { ok: true, locked: true, value: 42 });
  assert.deepEqual(call, { role: 'lead', purpose: 'fixture', env: {} });
});

test('a held lock is returned unchanged and the operation never runs', async () => {
  const held = { ok: false, reason: 'held', owner: { role: 'release', purpose: 'cut' } };
  let ran = false;
  assert.equal(await underHostLock({ role: 'lead', purpose: 'fixture', env: {} }, async () => { ran = true; }, { withHostLock: async () => held }), held);
  assert.equal(ran, false);
});

test('the real host lock serialises two runs in one directory and an error still releases it', async (t) => {
  const dir = mkdtemp(t, 'starci-verb-lock-');
  const env = { STARCI_HOST_LOCK_DIR: path.join(dir, 'lock') };
  const inner = await underHostLock({ role: 'lead', purpose: 'outer', env }, async () => underHostLock({ role: 'worker', purpose: 'inner', env }, async () => 'nested'));
  assert.equal(inner.ok, false);
  assert.equal(inner.reason, 'held');
  await assert.rejects(() => underHostLock({ role: 'lead', purpose: 'boom', env }, async () => { throw new Error('boom'); }), /boom/);
  assert.equal((await underHostLock({ role: 'lead', purpose: 'after', env }, async () => 'free')).value, 'free');
});
