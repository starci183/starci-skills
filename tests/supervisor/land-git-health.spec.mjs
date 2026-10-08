// The land gate on a repo git cannot run work-tree operations in (2026-09-29, land runs 20-22): core.bare=true in the
// shared config made `git status` (live) and `git cherry-pick` (every scratch worktree) die with "fatal: this
// operation must be run in a work tree"; the gate reported the cherry-pick as {reason:"conflict", conflicts:[]}. Each land
// runs in a scratch repo (never the live one). Also: the gate's queue, scratch ownership and the `direct` spec selection.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { landCommits, land, runChecks, gitHealth, waitGitHealthy, specPlan, acquireLand, landQueue, describe } from '../../scripts/supervisor/land.mjs';
import { specsDirect, changedExports, headRanges, codeOf } from '../../scripts/supervisor/land-specs.mjs';
import { readMachine } from '../../engine/db/machine.mjs';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => { try { spawnSync('git', ['-C', dir, 'worktree', 'prune'], { windowsHide: true }); } catch { /* none */ } try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* best effort */ } });
  return dir;
};
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, files) => { for (const [f, c] of Object.entries(files)) { fs.mkdirSync(path.dirname(path.join(root, f)), { recursive: true }); fs.writeFileSync(path.join(root, f), c); } };
function repoFixture(t) {
  const root = tmp(t, 'land-gh-repo-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec');
  git(root, 'config', 'user.email', 'spec@example.invalid');
  git(root, 'config', 'core.autocrlf', 'false');
  git(root, 'config', 'extensions.worktreeConfig', 'true');
  write(root, { 'scripts/a.mjs': 'export const a = 1;\n' });
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  return root;
}
function sideCommit(root, name, files) {
  const wt = path.join(root, '..', `${path.basename(root)}-${name}`);
  git(root, 'worktree', 'add', '-q', '-b', name, wt, 'main');
  write(wt, files);
  git(wt, 'add', '-A');
  git(wt, 'commit', '-q', '-m', name);
  const sha = git(wt, 'rev-parse', 'HEAD');
  git(root, 'worktree', 'remove', '--force', wt);
  return sha;
}
const envOf = (t) => { const r = tmp(t, 'land-gh-env-'); return { STARCI_LOCAL_ROOT: path.join(r, 'la'), STARCI_SUPERVISOR_HOME: path.join(r, 'home'), STARCI_LANES_ROOT: path.join(r, 'lanes') }; };
const lightChecks = (opts) => runChecks({ ...opts, runSpecs: false });
const scratchesIn = (env) => { try { return fs.readdirSync(path.join(env.STARCI_LANES_ROOT, 'land')); } catch { return []; } };
const noWait = (o) => waitGitHealthy({ ...o, waitMs: 0 });

test('core.bare=true is git-unusable: refused before the queue with its own reason and the one fix, never a conflict', async (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const sha = sideCommit(root, 'lane-a', { 'scripts/b.mjs': 'export const b = 1;\n' });
  assert.equal(gitHealth({ root }).ok, true);
  git(root, 'config', 'core.bare', 'true');
  const h = gitHealth({ root });
  assert.equal(h.ok, false);
  assert.equal(h.bare, true);
  assert.match(h.hint, /config core\.bare false/);
  let queued = false;
  const out = await land({ commits: [sha], root, env, deps: { gitHealth: noWait, acquireLand: () => { queued = true; return { ok: false }; }, runChecks: lightChecks } });
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'git-unusable');
  assert.equal(out.preflight, true);
  assert.equal(queued, false, 'it never joined the queue');
  assert.deepEqual(out.conflicts ?? [], []);
  assert.match(describe(out), /LAND FAILED .*git-unusable[\s\S]*core\.bare/);
  const rows = readMachine((m) => m.landRuns({}), [], { env });
  assert.equal(rows[0].result, 'refused', 'recorded as a refusal, not a conflict');
  assert.equal(rows[0].reason, 'git-unusable');
  git(root, 'config', 'core.bare', 'false');
  const ok = await land({ commits: [sha], root, env, deps: { runChecks: lightChecks } });
  assert.ok(ok.ok, `the next land after the repo is healthy lands: ${JSON.stringify(ok)}`);
  assert.deepEqual(scratchesIn(env), [], 'no scratch left behind');
});

test('a cherry-pick git itself fails is git-failed or git-unusable, not conflict; a real conflict stays a conflict', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const sha = sideCommit(root, 'lane-a', { 'scripts/b.mjs': 'export const b = 1;\n' });
  git(root, 'config', 'core.bare', 'true'); // flips after the health check passed (a transient value)
  const failed = landCommits({ commits: [sha], root, env, deps: { gitHealth: () => ({ ok: true }), runChecks: lightChecks } });
  assert.equal(failed.reason, 'git-failed');
  assert.match(failed.detail, /must be run in a work tree/);
  assert.deepEqual(failed.conflicts ?? [], []);
  assert.match(failed.hint, /not a content conflict/);
  let calls = 0;
  const unusable = landCommits({ commits: [sha], root, env, deps: { gitHealth: () => (++calls === 1 ? { ok: true } : { ok: false, detail: 'core.bare=true', hint: 'fix' }), runChecks: lightChecks } });
  assert.equal(unusable.reason, 'git-unusable', 'the failing pick is traced to the repo, not the commit');
  assert.equal(unusable.hint, 'fix');
  assert.deepEqual(scratchesIn(env), [], 'every failed attempt removed its own scratch');
  git(root, 'config', 'core.bare', 'false');
  const theirs = sideCommit(root, 'theirs', { 'scripts/a.mjs': 'export const a = 2;\n' });
  const mine = sideCommit(root, 'mine', { 'scripts/a.mjs': 'export const a = 3;\n' });
  assert.ok(landCommits({ commits: [theirs], root, env, deps: { runChecks: lightChecks } }).ok);
  const conflict = landCommits({ commits: [mine], root, env, deps: { runChecks: lightChecks } });
  assert.equal(conflict.reason, 'conflict');
  assert.deepEqual(conflict.conflicts.map((c) => c.file), ['scripts/a.mjs']);
});

test('waitGitHealthy rides out a transient value and gives up with the last detail', () => {
  const seen = [];
  let t = 0;
  const check = () => { seen.push(1); return seen.length < 3 ? { ok: false, detail: 'core.bare=true' } : { ok: true }; };
  assert.equal(waitGitHealthy({ check, waitMs: 5000, pollMs: 1000, sleep: (ms) => { t += ms; }, now: () => t }).ok, true);
  assert.equal(seen.length, 3);
  t = 0;
  const never = waitGitHealthy({ check: () => ({ ok: false, detail: 'still bare', hint: 'h' }), waitMs: 3000, pollMs: 1000, sleep: (ms) => { t += ms; }, now: () => t });
  assert.equal(never.ok, false);
  assert.equal(never.detail, 'still bare');
  assert.equal(never.waitedMs, 3000);
});

test('each land owns one uniquely named scratch: a foreign scratch dir is never touched, and a land after a failure works', (t) => {
  const env = envOf(t);
  const root = repoFixture(t);
  const foreign = path.join(env.STARCI_LANES_ROOT, 'land', `scratch-${process.pid}`);
  fs.mkdirSync(foreign, { recursive: true });
  fs.writeFileSync(path.join(foreign, 'keep.txt'), 'another land in use');
  const bad = sideCommit(root, 'bad', { 'scripts/bad.mjs': 'export const = ;\n' });
  const good = sideCommit(root, 'good', { 'scripts/good.mjs': 'export const g = 1;\n' });
  const red = landCommits({ commits: [bad], root, env, deps: { runChecks: lightChecks } });
  assert.equal(red.reason, 'checks-red');
  assert.deepEqual(red.cleanup.left, []);
  const ok = landCommits({ commits: [good], root, env, deps: { runChecks: lightChecks } });
  assert.ok(ok.ok, JSON.stringify(ok));
  assert.equal(fs.readFileSync(path.join(foreign, 'keep.txt'), 'utf8'), 'another land in use');
  assert.deepEqual(scratchesIn(env), [path.basename(foreign)]);
  assert.doesNotMatch(git(root, 'worktree', 'list', '--porcelain'), /scratch-/, 'no scratch stays registered');
});

test('the gate serializes: a running holder blocks the next waiter, the ticket is honoured when it is released', (t) => {
  const env = envOf(t);
  const first = acquireLand({ env, waitMs: 200, pollMs: 20, lane: 'one', commits: ['a'.repeat(40)] });
  assert.equal(first.ok, true);
  const blocked = acquireLand({ env, waitMs: 100, pollMs: 20, lane: 'two', commits: ['b'.repeat(40)] });
  assert.equal(blocked.ok, false);
  assert.equal(blocked.holder.lane, 'one');
  first.release('passed');
  const second = acquireLand({ env, waitMs: 200, pollMs: 20, lane: 'two', commits: ['b'.repeat(40)] });
  assert.equal(second.ok, true);
  second.release('failed');
  assert.deepEqual(landQueue({ env }), []);
});

/* ------------------------------------------------------------ --specs direct */

const SRC = [
  'export const A = 1;',
  'const helper = () => A + 1;',
  'export function used() {',
  '  return helper();',
  '}',
  'export function other() {',
  '  return 2;',
  '}',
].join('\n');

test('changedExports maps a diff to the exports it reaches through the declarations that use it', () => {
  assert.deepEqual(changedExports({ source: SRC, ranges: [[7, 1]] }).symbols, ['other']);
  assert.deepEqual(changedExports({ source: SRC, ranges: [[2, 1]] }).symbols.sort(), ['used'], 'a helper reaches the export that calls it');
  assert.deepEqual(changedExports({ source: SRC, ranges: [[1, 1]] }).symbols.sort(), ['A', 'used']);
  assert.equal(changedExports({ source: `import x from 'y';\n${SRC}`, ranges: [[1, 1]] }).symbols, null, 'a changed line outside every declaration is not mapped');
  assert.equal(changedExports({ source: `${SRC}\nexport * from './z.mjs';`, ranges: [[7, 1]] }).symbols, null);
  assert.deepEqual(changedExports({ source: `${SRC}\nexport { helper };`, ranges: [[2, 1]] }).symbols.sort(), ['helper', 'other', 'used'], 'a trailing export line is part of the last declaration: over-kept, never under-kept');
  assert.deepEqual(headRanges('@@ -1,2 +3,4 @@ x\n+a\n@@ -9 +11 @@\n'), [[3, 4], [11, 1]]);
});

test('specsDirect: named specs and code mentions only; a hub keeps the importers that can see the change', () => {
  const specs = [
    { file: 'tests/hubmod.spec.mjs', text: "import { other } from '../engine/hubmod.mjs';" },
    { file: 'tests/hubmod-extra.spec.mjs', text: "// mentions engine/hubmod.mjs in prose only\nimport '../x.mjs';" },
    ...Array.from({ length: 5 }, (_, i) => ({ file: `tests/u${i}.spec.mjs`, text: `import { ${i === 0 ? 'other' : 'A'} } from '../engine/hubmod.mjs';` })),
    { file: 'tests/both.spec.mjs', text: "import '../engine/hubmod.mjs'; import '../scripts/w.mjs';" },
    { file: 'tests/w.spec.mjs', text: "import '../scripts/w.mjs';" },
  ];
  const d = specsDirect(['engine/hubmod.mjs', 'scripts/w.mjs'], { specs, symbolsOf: () => ({ symbols: ['other'] }), hub: 3 });
  assert.deepEqual([...d.files].sort(), ['tests/both.spec.mjs', 'tests/hubmod-extra.spec.mjs', 'tests/hubmod.spec.mjs', 'tests/u0.spec.mjs', 'tests/w.spec.mjs']);
  assert.equal(d.narrowed[0].file, 'engine/hubmod.mjs');
  assert.equal(d.narrowed[0].importers, 7);
  const unmapped = specsDirect(['engine/hubmod.mjs'], { specs, symbolsOf: () => ({ symbols: null, why: 'x' }), hub: 3 });
  assert.equal(unmapped.files.filter((f) => /^tests\/(u[0-4]|both|hubmod)\.spec/.test(f)).length, 7, 'unknown reach keeps every importer');
  assert.equal(codeOf('// a\n/* b\n c */\nx'), 'x');
  assert.deepEqual(specPlan({ enabled: true, asked: ['direct'] }), { mode: 'direct', named: [] });
  assert.deepEqual(specPlan({ enabled: false, asked: ['direct', 'tests/a.spec.mjs'] }), { mode: 'direct', named: ['tests/a.spec.mjs'] });
});
