import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { npmCi } from '../../scripts/machine/npm-ci.mjs';
import { hostLockRetryBudget } from '../../scripts/machine/verb-lock.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

function git(cwd, args) {
  const result = runGit(args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, String(result.stderr ?? result.error?.message ?? 'git failed'));
  return String(result.stdout ?? '').trim();
}

function repo(t) {
  const cwd = mkdtemp(t, 'starci-npm-ci-');
  git(cwd, ['init', '-b', 'main']);
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{"name":"fixture","version":"1.0.0","lockfileVersion":3,"packages":{}}\n');
  git(cwd, ['add', 'package.json', 'package-lock.json']);
  git(cwd, ['-c', 'user.name=Spec', '-c', 'user.email=spec@example.test', 'commit', '-m', 'fixture']);
  return cwd;
}

test('npm ci refuses the primary main worktree for a worker role', async (t) => {
  const cwd = repo(t);
  let called = false;
  const result = await npmCi({ cwd, role: 'worker', args: {} }, { ci: () => { called = true; } });
  assert.equal(result.code, 2);
  assert.match(result.text, /primary main worktree/);
  assert.equal(called, false);
});

for (const filename of ['package.json', 'package-lock.json']) {
  test(`npm ci refuses a dirty ${filename}`, async (t) => {
    const cwd = repo(t);
    fs.appendFileSync(path.join(cwd, filename), ' ');
    const result = await npmCi({ cwd, role: 'owner', args: {} }, { ci: () => assert.fail('npm ci must not run') });
    assert.equal(result.code, 2);
    assert.match(result.text, /uncommitted changes/);
  });
}

test('npm ci refuses a linked node_modules', async (t) => {
  const cwd = repo(t);
  const target = path.join(cwd, 'dependency-cache');
  fs.mkdirSync(target);
  try {
    fs.symlinkSync(target, path.join(cwd, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error?.code === 'EPERM') { t.skip('this platform does not permit the symlink fixture'); return; }
    throw error;
  }
  const result = await npmCi({ cwd, role: 'owner', args: {} }, { ci: () => assert.fail('npm ci must not run') });
  assert.equal(result.code, 2);
  assert.match(result.text, /junction or symbolic link/);
});

test('npm ci forwards workspaces and holds the npm-ci host lock', async (t) => {
  const cwd = repo(t);
  const events = [];
  const times = [100, 125];
  const result = await npmCi({ cwd, role: 'owner', env: { SPEC: '1' }, args: { workspace: ['a', 'b'] } }, {
    now: () => times.shift(),
    underHostLock: async (options, fn, deps) => { events.push(['lock', options, deps.ci != null]); return { ok: true, locked: true, value: await fn() }; },
    ci: (actualCwd, options) => { events.push(['ci', actualCwd, options]); return { ok: true, status: 0, stderr: '' }; }
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, { schema: 'starci/npm-ci@1', ok: true, cwd, ms: 25 });
  assert.deepEqual(events, [
    ['lock', { role: 'owner', purpose: 'npm-ci', env: { SPEC: '1' }, retry: hostLockRetryBudget() }, true],
    ['ci', cwd, { workspaces: ['a', 'b'] }]
  ]);
});

test('npm ci reports a failed call file without losing elapsed time', async (t) => {
  const cwd = repo(t);
  const times = [10, 19];
  const result = await npmCi({ cwd, role: 'owner', args: {} }, {
    now: () => times.shift(),
    underHostLock: async (_options, fn) => ({ ok: true, locked: true, value: await fn() }),
    ci: () => ({ ok: false, status: 7, stderr: 'lockfile rejected' })
  });
  assert.equal(result.code, 1);
  assert.equal(result.data.ms, 9);
  assert.match(result.text, /lockfile rejected/);
});
