// shim-e2e.spec.mjs - inside a terminal whose PATH starts with the guarded wrappers, an agent's own `git commit` is refused by the
// command policy while `starci git commit` (a runtime verb the same agent started) still commits where its role allows.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { writeRuntimeShim } from '../../packages/cli/src/shim.mjs';
import { mkdtemp } from '../helpers/tmpdir.mjs';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const win = process.platform === 'win32';

const git = (cwd, args) => {
  const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
  assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
};

function setup(t) {
  const home = mkdtemp(t, 'starci-shim-home-');
  writeRuntimeShim({ root: repoRoot, home });
  const shim = path.join(home, '.starci', 'bin');
  const repo = mkdtemp(t, 'starci-shim-repo-');
  git(repo, ['init', '-q', '-b', 'lane/shim']);
  git(repo, ['config', 'user.email', 'shim@example.test']);
  git(repo, ['config', 'user.name', 'Shim']);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'one\n');
  git(repo, ['add', 'a.txt']);
  git(repo, ['commit', '-q', '-m', 'init']);
  fs.writeFileSync(path.join(repo, 'a.txt'), 'two\n');
  const guards = mkdtemp(t, 'starci-shim-guards-');
  const env = {
    ...process.env,
    PATH: [shim, process.env.PATH].join(path.delimiter),
    HOME: home,
    USERPROFILE: home,
    STARCI_ROLE: 'coordinator',
    STARCI_GUARDS_ROOT: guards,
    STARCI_RUNTIME: repoRoot,
    ORCA_TERMINAL_HANDLE: '',
  };
  const wrapper = (program, args) => win
    ? spawnSync('cmd.exe', ['/d', '/s', '/c', `"${path.join(shim, `${program}.cmd`)}"`, ...args], { cwd: repo, env, encoding: 'utf8', windowsVerbatimArguments: true })
    : spawnSync(path.join(shim, program), args, { cwd: repo, env, encoding: 'utf8' });
  return { repo, env, shim, wrapper };
}

test('the wrapper refuses a raw git commit for a coordinator and passes a read-only git status', (t) => {
  const { repo, wrapper } = setup(t);
  const refused = wrapper('git', ['commit', '-am', 'raw']);
  assert.equal(refused.status, 2, refused.stderr);
  assert.match(refused.stderr, /RIGHTS_GIT_COMMIT/);
  assert.match(refused.stderr, /starci git commit/);
  assert.equal(git(repo, ['log', '--format=%s']).split('\n').length, 1, 'no raw commit was made');
  const status = wrapper('git', ['status', '--short']);
  assert.equal(status.status, 0, status.stderr);
  assert.match(status.stdout, /a\.txt/);
});

test('starci git commit, started from the same shimmed terminal, commits with the real git', (t) => {
  const { repo, env } = setup(t);
  const cli = path.join(repoRoot, 'packages', 'cli', 'bin', 'starci.mjs');
  const done = spawnSync(process.execPath, [cli, 'git', 'commit', '--type', 'chore', '--summary', 'edit through the verb', '--paths', 'a.txt', '--cwd', repo], { cwd: repo, env, encoding: 'utf8' });
  assert.equal(done.status, 0, `${done.stdout}${done.stderr}`);
  assert.equal(git(repo, ['log', '-1', '--format=%s']), 'chore: edit through the verb');
});
