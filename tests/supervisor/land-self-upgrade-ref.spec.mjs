// land-self-upgrade-ref.spec.mjs - a Supervisor self-upgrade land preserves its result commit under the first free
// refs/self-upgrade/<id>[-N] name. The ref is local-only, collision-safe, and best effort: a write failure is reported
// on the successful land result without turning the land red.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  selfUpgradeBranchContaining,
  selfUpgradeIdOf,
  withSelfUpgradeRef,
  writeSelfUpgradeRef,
} from '../../scripts/supervisor/self-upgrade-ref.mjs';

test('self-upgrade identity comes from sup/<id>, with a Supervisor job id as the fallback', () => {
  assert.equal(selfUpgradeIdOf({ branch: 'refs/heads/sup/runtime rights' }), 'runtime_rights');
  assert.equal(selfUpgradeIdOf({ lane: 'sup/a/b' }), 'a_b');
  assert.equal(selfUpgradeIdOf({ branch: 'lane/ordinary', jobId: 'fix-hooks-123' }), 'fix-hooks-123');
  assert.equal(selfUpgradeIdOf({ branch: 'lane/ordinary' }), null);
  assert.match(selfUpgradeIdOf({ branch: 'sup/../odd.lock' }), /^[A-Za-z0-9._-]+$/);

  const calls = [];
  const branch = selfUpgradeBranchContaining({ root: 'repo', commit: 'abc', list: (args, options) => {
    calls.push({ args, options });
    return { status: 0, stdout: 'sup/two\nsup/three\n' };
  } });
  assert.equal(branch, 'sup/two');
  assert.deepEqual(calls[0].args, ['--format=%(refname:short)', '--contains', 'abc', 'sup/*']);
  assert.equal(calls[0].options.dir, 'repo');
});

test('writeSelfUpgradeRef uses update-ref create semantics and suffixes collisions without overwriting', () => {
  const refs = new Set();
  const updates = [];
  const exists = (ref) => refs.has(ref);
  const update = (root, ref, head, options) => {
    updates.push({ root, ref, head, options });
    assert.equal(refs.has(ref), false, 'an occupied ref is never sent to update-ref');
    refs.add(ref);
    return { status: 0 };
  };
  const args = { root: 'repo', id: 'guard/hooks', head: 'a'.repeat(40), exists, update };
  assert.deepEqual(writeSelfUpgradeRef(args), { ok: true, ref: 'refs/self-upgrade/guard_hooks' });
  assert.deepEqual(writeSelfUpgradeRef(args), { ok: true, ref: 'refs/self-upgrade/guard_hooks-2' });
  assert.deepEqual(writeSelfUpgradeRef(args), { ok: true, ref: 'refs/self-upgrade/guard_hooks-3' });
  assert.deepEqual(updates.map((call) => call.ref), [...refs]);
  assert.ok(updates.every((call) => call.options.old === '0'.repeat(40)));
});

test('a self-upgrade ref failure is reported but never changes a passed land to failed', () => {
  const passed = { ok: true, landed: 'b'.repeat(40), checks: [] };
  const failed = withSelfUpgradeRef(passed, { root: 'repo', id: 'hooks', write: () => ({ ok: false, ref: 'refs/self-upgrade/hooks', error: 'read only' }) });
  assert.equal(failed.ok, true);
  assert.equal(failed.selfUpgradeRef, 'refs/self-upgrade/hooks');
  assert.equal(failed.selfUpgradeRefError, 'read only');

  const thrown = withSelfUpgradeRef(passed, { root: 'repo', id: 'hooks', write: () => { throw Error('disk offline'); } });
  assert.equal(thrown.ok, true);
  assert.match(thrown.selfUpgradeRefError, /disk offline/);

  const success = withSelfUpgradeRef(passed, { root: 'repo', id: 'hooks', write: () => ({ ok: true, ref: 'refs/self-upgrade/hooks-2' }) });
  assert.deepEqual(success, { ...passed, selfUpgradeRef: 'refs/self-upgrade/hooks-2' });
  assert.equal(withSelfUpgradeRef({ ok: true, alreadyLanded: passed.landed }, { id: 'hooks' }).selfUpgradeRef, undefined, 'no ref when main did not move');
});
