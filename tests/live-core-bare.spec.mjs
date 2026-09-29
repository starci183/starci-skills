// live-core-bare.spec.mjs — a spec's git fixtures never write a repository they did not create.
//
// 2026-09-29 10:27:39Z the live .claude repository's common config turned core.bare=true and the land gate refused
// land run 20 at fastForwardLive (live-path-status-failed: "this operation must be run in a work tree"). Every
// linked worktree (the gate's scratch, a [Worker]'s staging checkout, a lane) shares that config. git exports
// GIT_DIR=<main>/.git/worktrees/<wt> to every hook and alias it runs there; a spec run that inherits it points each
// fixture `git` at the live repository whatever cwd or -C it names: a temp dir's `git init` re-inits the live repo
// with core.bare=true, `git config user.email lane@starci.test` lands in its config (the stray [user] section the
// live config still carries). The fixtures drop git's repository-local variables (git rev-parse --local-env-vars)
// when the spec loads. Each spec below runs here with GIT_DIR leaked toward a THROWAWAY repository with its own
// linked worktree - never the live one - and that repository's config must come out untouched.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(import.meta.dirname, '..');
const LOCAL_ENV = spawnSync('git', ['rev-parse', '--local-env-vars'], { encoding: 'utf8', windowsHide: true }).stdout.split(/\s+/).filter(Boolean);
/** process.env without git's repository-local variables and the parent test runner's channel. */
const cleanEnv = () => {
  const env = { ...process.env };
  for (const key of LOCAL_ENV) delete env[key];
  delete env.NODE_TEST_CONTEXT;
  return env;
};
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, env: cleanEnv(), encoding: 'utf8', windowsHide: true });
  return { ok: r.status === 0, stdout: String(r.stdout ?? '').trim(), stderr: String(r.stderr ?? '').trim() };
};

/**
 * A throwaway repository `main` with one linked worktree `wt`, laid out the way `git worktree add` lays it out
 * (written by hand: an op worker's guard refuses `git worktree add`, and an unborn main needs no commit).
 */
function repoWithWorktree(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-core-bare-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }));
  const main = path.join(dir, 'main'), wt = path.join(dir, 'wt');
  const admin = path.join(main, '.git', 'worktrees', 'wt');
  assert.ok(git(dir, 'init', '-q', '-b', 'main', main).ok);
  fs.mkdirSync(admin, { recursive: true });
  fs.mkdirSync(wt);
  fs.writeFileSync(path.join(admin, 'HEAD'), 'ref: refs/heads/wt\n');
  fs.writeFileSync(path.join(admin, 'commondir'), '../..\n');
  fs.writeFileSync(path.join(admin, 'gitdir'), `${path.join(wt, '.git').replace(/\\/g, '/')}\n`);
  fs.writeFileSync(path.join(wt, '.git'), `gitdir: ${admin.replace(/\\/g, '/')}\n`);
  const common = git(wt, 'rev-parse', '--path-format=absolute', '--git-common-dir').stdout;
  assert.equal(fs.realpathSync(common), fs.realpathSync(path.join(main, '.git')), 'wt is a linked worktree of main');
  return { main, wt, admin };
}
const configOf = (main) => {
  const file = path.join(main, '.git', 'config');
  return { bare: git(main, 'config', '--file', file, '--get', 'core.bare').stdout, user: git(main, 'config', '--file', file, '--get-regexp', '^user\\.').stdout };
};
const assertUntouched = (main, what) => assert.deepEqual(configOf(main), { bare: 'false', user: '' }, what);

test('the hazard: with a linked worktree\'s GIT_DIR inherited, a temp dir\'s `git init` re-inits the main repo bare', (t) => {
  const { main, admin } = repoWithWorktree(t);
  const elsewhere = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-core-bare-tmp-'));
  t.after(() => fs.rmSync(elsewhere, { recursive: true, force: true }));
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: elsewhere, env: { ...cleanEnv(), GIT_DIR: admin }, encoding: 'utf8', windowsHide: true });
  assert.equal(configOf(main).bare, 'true', 'git re-inited the repository GIT_DIR names, not the cwd');
  assert.equal(fs.existsSync(path.join(elsewhere, '.git')), false, 'and created nothing in the temp dir');
});

// One git-fixture test of each spec that builds temp repositories, run in a child that inherited a hook's GIT_DIR.
const SPECS = [
  ['supervisor-kernel.spec.mjs', '^staging lifecycle'],
  ['supervisor-push.spec.mjs', 'a dry run stops at the scan'],
  ['settle-landed.spec.mjs', 'dirty owned path is refused not-landed'],
  ['settle-target-repo.spec.mjs', 'backend op.s bare owned path still resolves'],
];
for (const [spec, pattern] of SPECS) {
  test(`${spec}: its fixtures never write the repository an inherited GIT_DIR names`, (t) => {
    const { main, wt, admin } = repoWithWorktree(t);
    const r = spawnSync(process.execPath, ['--test', '--test-reporter=tap', `--test-name-pattern=${pattern}`, path.join(ROOT, 'tests', spec)],
      { cwd: wt, env: { ...cleanEnv(), GIT_DIR: admin }, encoding: 'utf8', windowsHide: true, timeout: 300_000 });
    assert.match(r.stdout, /# tests [1-9]/, `the pattern ran a test:\n${r.stdout.slice(-1500)}`);
    assertUntouched(main, `${spec} wrote the throwaway main repo's config:\n${r.stdout.slice(-3000)}\n${r.stderr.slice(-1500)}`);
  });
}
