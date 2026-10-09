// land-lock.spec.mjs - the host lock covers one step of a land (the publish) and the dependency install of a staging checkout, never the gate:
// a held lock is waited for within a bound and then refused with a typed result naming the holder; a free lock runs the work once and
// returns its result; a spec run takes no host lock unless one is injected.
import test from 'node:test';
import assert from 'node:assert/strict';
import { underHostLockWaiting } from '../../scripts/supervisor/land-lock.mjs';

const HELD = { ok: false, reason: 'held', owner: { role: 'release', purpose: 'release-cut', pid: 4242, since: '2026-10-03T00:00:00.000Z' } };
const clock = () => { let t = 0; return { now: () => t, sleep: (ms) => { t += ms; } }; };

test('the work runs inside the lock as role coordinator, purpose land by default, and its result is returned unchanged', () => {
  const calls = [];
  const lock = (options, work) => { calls.push(options); return work(); };
  const out = underHostLockWaiting({ env: { NODE_TEST_CONTEXT: '' }, deps: { hostLock: lock } }, () => ({ ok: true, landed: 'def456' }));
  assert.deepEqual(out, { ok: true, landed: 'def456' });
  assert.deepEqual(calls.map((c) => [c.role, c.purpose]), [['coordinator', 'land']]);
});



test('a lock that is held is polled until it frees, then the work runs exactly once', () => {
  const { now, sleep } = clock();
  let attempts = 0, ran = 0;
  const lock = (_options, work) => { attempts += 1; return attempts < 4 ? HELD : work(); };
  const out = underHostLockWaiting({ env: { NODE_TEST_CONTEXT: '' }, deps: { hostLock: lock, now, sleep } }, () => { ran += 1; return { ok: true }; });
  assert.deepEqual(out, { ok: true });
  assert.deepEqual([attempts, ran], [4, 1]);
});

test('a lock that stays held is refused after the bounded wait with a typed result naming the holder; the work never runs', () => {
  const { now, sleep } = clock();
  let ran = false;
  const out = underHostLockWaiting({ env: { NODE_TEST_CONTEXT: '' }, deps: { hostLock: () => HELD, now, sleep, hostLockWaitMs: 10_000 } }, () => { ran = true; return { ok: true }; });
  assert.equal(ran, false);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'host-lock-held');
  assert.equal(out.waitedMs, 10_000);
  assert.match(out.detail, /held by release \(release-cut\) pid 4242 since 2026-10-03.*waited 10s/);
  assert.match(out.hint, /never delete the lock directory by hand/);
});

test('a spec run takes no host lock unless one is injected: the work runs directly', () => {
  assert.deepEqual(underHostLockWaiting({ env: { NODE_TEST_CONTEXT: 'child' }, deps: {} }, () => ({ ok: true, direct: true })), { ok: true, direct: true });
});
