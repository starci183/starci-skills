import test from 'node:test';
import assert from 'node:assert/strict';
import { underHostLock } from '../../scripts/machine/verb-lock.mjs';

const held = { ok: false, reason: 'held', owner: { role: 'release', purpose: 'land' } };
const budget = { intervalMs: 1000, maxIntervalMs: 4000, deadlineMs: 20_000 };

test('a held lock is retried on the budget interval until it is free', async () => {
  const waits = [];
  let calls = 0;
  const result = await underHostLock({ role: 'worker', purpose: 'npm-ci', retry: budget }, () => 'ran',
    { withHostLock: async (_options, fn) => (++calls < 3 ? held : fn()), sleep: async (ms) => { waits.push(ms); }, now: () => 0 });
  assert.deepEqual(result, { ok: true, locked: true, value: 'ran' });
  assert.deepEqual(waits, [1000, 2000]);
});

test('a lock that stays held refuses once the budget is spent, naming every attempt', async () => {
  let clock = 0;
  const result = await underHostLock({ role: 'worker', purpose: 'npm-ci', retry: budget }, () => 'ran',
    { withHostLock: async () => held, sleep: async (ms) => { clock += ms; }, now: () => clock });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'held');
  assert.equal(result.exhausted, 'deadline');
  assert.ok(result.retries.length >= 3);
  assert.ok(result.retries.every((entry) => entry.reason === 'lock-held'));
  assert.equal(result.retries.at(-1).delayMs, null, 'the last attempt has no next try');
});

test('without a budget a held lock refuses at once, and another refusal is never retried', async () => {
  let calls = 0;
  const plain = await underHostLock({ role: 'worker', purpose: 'x' }, () => 'ran', { withHostLock: async () => { calls += 1; return held; } });
  assert.deepEqual([plain.reason, calls, plain.retries], ['held', 1, undefined]);
  const denied = await underHostLock({ role: 'worker', purpose: 'x', retry: budget }, () => 'ran',
    { withHostLock: async () => { calls += 1; return { ok: false, reason: 'not-owner' }; }, sleep: async () => assert.fail('no wait') });
  assert.equal(denied.reason, 'not-owner');
  assert.equal(calls, 2);
});
