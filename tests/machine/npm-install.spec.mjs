import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { runGit } from '../../scripts/api/git/lib.mjs';
import { npmInstall, resolveInstallPackages } from '../../scripts/machine/npm-install.mjs';
import { hostLockRetryBudget } from '../../scripts/machine/verb-lock.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

function git(cwd, args) {
  const result = runGit(args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, String(result.stderr ?? result.error?.message ?? 'git failed'));
}

function repo(t) {
  const cwd = mkdtemp(t, 'starci-npm-install-');
  git(cwd, ['init', '-b', 'main']);
  fs.writeFileSync(path.join(cwd, 'package.json'), '{"name":"fixture","version":"1.0.0"}\n');
  fs.writeFileSync(path.join(cwd, 'package-lock.json'), '{"name":"fixture","version":"1.0.0","lockfileVersion":3,"packages":{}}\n');
  git(cwd, ['add', 'package.json', 'package-lock.json']);
  git(cwd, ['-c', 'user.name=Spec', '-c', 'user.email=spec@example.test', 'commit', '-m', 'fixture']);
  return cwd;
}

test('exact package requests resolve without a registry lookup', () => {
  const pins = { name: '2.3.4', pinned: '4.5.6' };
  assert.deepEqual(resolveInstallPackages(['name'], pins), { ok: true, packages: ['name@2.3.4'] });
  assert.deepEqual(resolveInstallPackages(['other@1.2.3'], pins), { ok: true, packages: ['other@1.2.3'] });
  for (const request of ['other@^1', 'other@~1', 'other@latest', 'other@*']) {
    const result = resolveInstallPackages([request], pins);
    assert.equal(result.ok, false, request);
    assert.match(result.error, /not an exact x\.y\.z version/, request);
  }
  const mismatch = resolveInstallPackages(['pinned@1.2.3'], pins);
  assert.equal(mismatch.ok, false);
  assert.match(mismatch.error, /differs from its canon pin/);
});

test('a bare package without a canon pin asks for an owner decision', () => {
  const result = resolveInstallPackages(['unowned'], {});
  assert.equal(result.ok, false);
  assert.match(result.error, /ask the owner/);
});

test('npm install refuses the primary main worktree for a lead', async (t) => {
  const cwd = repo(t);
  const result = await npmInstall({ cwd, role: 'lead', positionals: ['name'], args: {} }, {
    loadPins: () => ({ name: '1.2.3' }),
    install: () => assert.fail('npm install must not run')
  });
  assert.equal(result.code, 2);
  assert.match(result.text, /primary main worktree/);
});

test('npm install refuses a linked node_modules', async (t) => {
  const cwd = repo(t);
  const target = path.join(cwd, 'dependency-cache');
  fs.mkdirSync(target);
  try {
    fs.symlinkSync(target, path.join(cwd, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  } catch (error) {
    if (error?.code === 'EPERM') { t.skip('this platform does not permit the symlink fixture'); return; }
    throw error;
  }
  const result = await npmInstall({ cwd, role: 'owner', positionals: ['name'], args: {} }, {
    loadPins: () => ({ name: '1.2.3' }),
    install: () => assert.fail('npm install must not run')
  });
  assert.equal(result.code, 2);
  assert.match(result.text, /junction or symbolic link/);
});

test('npm install uses exact specs under the host lock and reports the diff stat', async (t) => {
  const cwd = repo(t);
  const events = [];
  const times = [50, 70];
  const result = await npmInstall({ cwd, role: 'owner', env: { SPEC: '1' }, positionals: ['name'], args: { dev: true } }, {
    loadPins: () => ({ name: '1.2.3' }),
    now: () => times.shift(),
    underHostLock: async (options, fn, deps) => { events.push(['lock', options, deps.install != null]); return { ok: true, locked: true, value: await fn() }; },
    install: (actualCwd, packages, options) => { events.push(['install', actualCwd, packages, options]); return { ok: true }; },
    diff: (args, options) => { events.push(['diff', args, options]); return { status: 0, stdout: ' package.json | 2 +-' }; }
  });
  assert.equal(result.code, 0);
  assert.deepEqual(result.data, {
    schema: 'starci/npm-install@1', ok: true, cwd, packages: ['name@1.2.3'], dev: true,
    diffStat: 'package.json | 2 +-', ms: 20
  });
  assert.deepEqual(events, [
    ['lock', { role: 'owner', purpose: 'npm-install', env: { SPEC: '1' }, retry: hostLockRetryBudget() }, true],
    ['install', cwd, ['name@1.2.3'], { dev: true }],
    ['diff', ['--stat', '--', 'package.json', 'package-lock.json'], { cwd }]
  ]);
});
