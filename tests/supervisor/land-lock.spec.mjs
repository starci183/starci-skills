// land-lock.spec.mjs - the land runs under the host lock (role coordinator, purpose land): a held lock refuses it with a typed
// result naming the holder, a free lock runs it and hands back its result, and a spec run takes no host lock of its own.
import test from 'node:test';
import assert from 'node:assert/strict';
import { landUnderHostLock } from '../../scripts/supervisor/land-lock.mjs';

const ARGS = { commits: ['abc123'], env: { NODE_TEST_CONTEXT: '' }, deps: {} };

test('the land body runs inside the lock as role coordinator, purpose land, and its result is returned unchanged', () => {
  const calls = [];
  const lock = (options, work) => { calls.push(options); return work(); };
  const out = landUnderHostLock({ ...ARGS, deps: { hostLock: lock } }, (args) => ({ ok: true, landed: 'def456', commits: args.commits }));
  assert.deepEqual(out, { ok: true, landed: 'def456', commits: ['abc123'] });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].role, 'coordinator');
  assert.equal(calls[0].purpose, 'land');
});

test('a held lock refuses the land with a typed result that names the holder; the land body never runs', () => {
  let ran = false;
  const held = () => ({ ok: false, reason: 'held', owner: { role: 'release', purpose: 'release-cut', pid: 4242, since: '2026-10-03T00:00:00.000Z' } });
  const out = landUnderHostLock({ ...ARGS, deps: { hostLock: held } }, () => { ran = true; return { ok: true }; });
  assert.equal(ran, false);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'host-lock-held');
  assert.deepEqual(out.commits, ['abc123']);
  assert.match(out.detail, /held by release \(release-cut\) pid 4242 since 2026-10-03/);
  assert.match(out.hint, /never delete the lock directory by hand/);
});

test('a spec run takes no host lock unless one is injected: the body runs directly', () => {
  const out = landUnderHostLock({ commits: ['x'], env: { NODE_TEST_CONTEXT: 'child' }, deps: {} }, () => ({ ok: true, direct: true }));
  assert.deepEqual(out, { ok: true, direct: true });
});
