// live-node-modules-wiped (2026-09-29 13:29Z): the live runtime's node_modules was found with 0 entries, and land run 49
// read the missing deps as six red spec files (ERR_MODULE_NOT_FOUND ajv). Land scratches and [Worker] staging checkouts
// get node_modules as a junction to the live one, so no removal of them may reach it, and a gate running without
// its deps must say so (live-deps-missing) instead of blaming the commit.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import assert from 'node:assert/strict';
import { landCommits, removeScratch, liveDepsState } from '../../scripts/supervisor/land.mjs';
import { runHousekeeping, describe as describeHousekeeping } from '../../scripts/housekeeping/housekeeping.mjs';

// The land gate cherry-picks in its own scratch with the process environment: the spec brings the identity a bare CI host lacks.
for (const who of ['AUTHOR', 'COMMITTER']) { process.env[`GIT_${who}_NAME`] ??= 'spec'; process.env[`GIT_${who}_EMAIL`] ??= 'spec@example.invalid'; }
const LINK = process.platform === 'win32' ? 'junction' : 'dir';
const tmp = (t) => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-nm-wipe-')); t.after(() => fs.rmSync(d, { recursive: true, force: true })); return d; };
const git = (cwd, ...args) => {
  const r = spawnSync('git', ['-c', 'user.name=spec', '-c', 'user.email=spec@example.invalid', '-c', 'commit.gpgsign=false', ...args], { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const entries = (dir) => fs.readdirSync(dir).filter((n) => !n.startsWith('.'));

/** A "live" runtime: package.json declaring deps and a node_modules of three packages; with `repo`, a git repo on main. */
function liveRuntime(t, { repo = true } = {}) {
  const base = tmp(t);
  const root = path.join(base, 'live');
  fs.mkdirSync(root);
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'live', dependencies: { ajv: '1', yaml: '1' }, devDependencies: { typescript: '1' } }));
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\n');
  if (repo) {
    git(root, 'init', '-q', '-b', 'main');
    git(root, 'add', '--', 'package.json', '.gitignore');
    git(root, 'commit', '-q', '-m', 'base', '--', 'package.json', '.gitignore');
  }
  for (const dep of ['ajv', 'yaml', 'typescript']) {
    fs.mkdirSync(path.join(root, 'node_modules', dep, 'lib'), { recursive: true });
    fs.writeFileSync(path.join(root, 'node_modules', dep, 'lib', 'index.js'), `module.exports = '${dep}'\n`);
  }
  fs.writeFileSync(path.join(root, 'node_modules', '.package-lock.json'), '{}');
  return { base, root, env: { ...process.env, STARCI_LANES_ROOT: path.join(base, 'lanes') } };
}
/** A commit on a side branch the gate can cherry-pick onto main. */
function sideCommit(root) {
  git(root, 'checkout', '-q', '-b', 'side');
  fs.writeFileSync(path.join(root, 'change.txt'), 'x\n');
  git(root, 'add', '--', 'change.txt');
  git(root, 'commit', '-q', '-m', 'change', '--', 'change.txt');
  const sha = git(root, 'rev-parse', 'HEAD');
  git(root, 'checkout', '-q', 'main');
  return sha;
}
const healthy = () => ({ ok: true });

test('the land gate refuses to run specs when the live node_modules is empty (live-deps-missing)', (t) => {
  // No git needed: the refusal comes before the gate touches git.
  const { root, env } = liveRuntime(t, { repo: false });
  for (const dep of entries(path.join(root, 'node_modules'))) fs.rmSync(path.join(root, 'node_modules', dep), { recursive: true });
  assert.deepEqual(liveDepsState(root), { declared: 3, entries: 0 });
  let ran = 0;
  const r = landCommits({ commits: ['c0ffee'], root, env, push: false, deps: { gitHealth: healthy, runChecks: () => { ran += 1; return { ok: false, checks: [] }; } } });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'live-deps-missing');
  assert.match(r.hint, /npm ci/);
  assert.equal(ran, 0, 'no check runs without the live deps');
  // A missing node_modules is the same refusal; a manifest with no dependencies is not.
  fs.rmSync(path.join(root, 'node_modules'), { recursive: true });
  assert.equal(landCommits({ commits: ['x'], root, env, push: false, deps: { gitHealth: healthy } }).reason, 'live-deps-missing');
  fs.writeFileSync(path.join(root, 'package.json'), '{"name":"live"}');
  assert.equal(liveDepsState(root).declared, 0);
});

test('a land scratch carries no link to the live node_modules; links a check makes in it are removed without touching the live deps', (t) => {
  const { root, env } = liveRuntime(t);
  const main = git(root, 'rev-parse', 'main');
  let scratch = null;
  const r = landCommits({ commits: [sideCommit(root)], root, env, push: false, deps: { gitHealth: healthy, runChecks: ({ dir }) => {
    scratch = dir;
    const nm = path.join(dir, 'node_modules');
    assert.equal(fs.existsSync(nm), false, 'the scratch gets its own npm ci, never a link to the live deps (RT_NODE_MODULES_LINK)');
    // A check that links the live deps in anyway, top-level and nested: the removal must follow neither.
    fs.symlinkSync(path.join(root, 'node_modules'), nm, LINK);
    fs.mkdirSync(path.join(dir, 'packages', 'x'), { recursive: true });
    fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'packages', 'x', 'node_modules'), LINK);
    return { ok: false, checks: [{ name: 'spec', ok: false }] };
  } } });
  assert.equal(r.reason, 'checks-red');
  assert.ok(scratch && !fs.existsSync(scratch), 'the scratch is gone');
  assert.deepEqual(r.cleanup.left, []);
  assert.equal(r.cleanup.liveDepsLost, undefined);
  assert.deepEqual(entries(path.join(root, 'node_modules')).sort(), ['ajv', 'typescript', 'yaml']);
  assert.equal(fs.readFileSync(path.join(root, 'node_modules', 'ajv', 'lib', 'index.js'), 'utf8'), "module.exports = 'ajv'\n");
  assert.equal(git(root, 'rev-parse', 'main'), main);
});

test('checks that emptied the live node_modules through a link refuse the land (live-deps-missing), never land it', (t) => {
  const { root, env } = liveRuntime(t);
  const main = git(root, 'rev-parse', 'main');
  const r = landCommits({ commits: [sideCommit(root)], root, env, push: false, deps: { gitHealth: healthy, runChecks: ({ dir }) => {
    // What an npm reify (or any delete) through a link to the live deps does: the children go, the directory stays.
    const nm = path.join(dir, 'node_modules');
    fs.symlinkSync(path.join(root, 'node_modules'), nm, LINK);
    for (const dep of fs.readdirSync(nm)) fs.rmSync(path.join(nm, dep), { recursive: true, force: true });
    return { ok: true, checks: [], rows: [['A', 'change.txt']], changed: ['change.txt'] };
  } } });
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'live-deps-missing');
  assert.match(r.detail, /went from 3 to 0 entries/);
  assert.equal(git(root, 'rev-parse', 'main'), main, 'main did not move');
});

test('removeScratch unlinks the node_modules junction before the tree goes and the live entry count is unchanged', (t) => {
  const { root, base } = liveRuntime(t);
  const dir = path.join(base, 'lanes', 'land', 'scratch-spec');
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git(root, 'worktree', 'add', '-q', '--detach', dir, 'main');
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'node_modules'), LINK);
  fs.mkdirSync(path.join(dir, 'deep', 'er'), { recursive: true });
  fs.symlinkSync(path.join(root, 'node_modules'), path.join(dir, 'deep', 'er', 'node_modules'), LINK);
  const before = entries(path.join(root, 'node_modules')).length;
  assert.equal(removeScratch(dir, { root }), true);
  assert.equal(fs.existsSync(dir), false);
  assert.equal(entries(path.join(root, 'node_modules')).length, before);
  assert.doesNotMatch(git(root, 'worktree', 'list', '--porcelain'), /scratch-spec/);
});

test('housekeeping fails its run when the live node_modules lost entries during the sweeps', async (t) => {
  const { root } = liveRuntime(t, { repo: false });
  const clean = await runHousekeeping({ only: ['tmp'], depsRoot: root, allocation: {}, sweeps: { tmp: () => ({ ok: true }) } });
  assert.equal(clean.ok, true);
  assert.deepEqual({ before: clean.liveDeps.before, after: clean.liveDeps.after, ok: clean.liveDeps.ok }, { before: 3, after: 3, ok: true });
  const wiped = await runHousekeeping({ only: ['lanes'], depsRoot: root, allocation: {}, sweeps: { lanes: () => {
    for (const dep of entries(path.join(root, 'node_modules'))) fs.rmSync(path.join(root, 'node_modules', dep), { recursive: true });
    return { ok: true };
  } } });
  assert.equal(wiped.areas.lanes.ok, true);
  assert.equal(wiped.ok, false, 'a sweep that emptied the live deps fails the run');
  assert.deepEqual({ before: wiped.liveDeps.before, after: wiped.liveDeps.after, ok: wiped.liveDeps.ok }, { before: 3, after: 0, ok: false });
  assert.match(describeHousekeeping(wiped), /LIVE node_modules lost entries 3 -> 0/);
});
