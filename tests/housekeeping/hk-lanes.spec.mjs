// hk-lanes: the lanes root authority (the owner config roots.lanes, STARCI_LANES_ROOT,
// default <starciLocalRoot>/lanes) and sweepLanes — merged lane worktrees of a real repo are removed only
// link-safely (links unlinked first, never followed) and idle for allocation.housekeeping.laneGraceMs; the main
// checkout, dirty, detached and unmerged worktrees, a fresh lane with no commit yet
// (no-work-yet) and a landed lane still in use (recent-activity) are skipped with a reason.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { lanesRoot } from '../../scripts/machine/home.mjs';
import { sweepLanes, parseWorktreeList } from '../../scripts/housekeeping/hk-lanes.mjs';
import { pathKey } from '../../scripts/lib/path-key.mjs';

const tmp = (t, prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  t.after(() => {
    try { spawnSync('git', ['-C', dir, 'worktree', 'prune'], { windowsHide: true }); } catch { /* none */ }
    try { fs.rmSync(dir, { recursive: true, force: true, maxRetries: 20, retryDelay: 50 }); } catch { /* a worktree dir stays on a failure */ }
  });
  return dir;
};
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  if (r.status !== 0) throw Error(`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

function repoFixture(t) {
  const root = tmp(t, 'hk-repo-');
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.name', 'Spec');
  git(root, 'config', 'user.email', 'spec@example.invalid');
  fs.writeFileSync(path.join(root, 'a.txt'), 'a\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  return root;
}
/** A worktree of `root` at `dir` on `branch`, optionally with one committed file change. */
function addWorktree(root, dir, branch, { commit = null } = {}) {
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git(root, 'worktree', 'add', '-q', '-b', branch, dir, 'main');
  if (commit !== null) {
    fs.writeFileSync(path.join(dir, commit), `${commit}\n`);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', `work ${branch}`);
  }
  return dir;
}
const envOf = (lanes) => ({ STARCI_LANES_ROOT: lanes });
const GRACE_MS = 3_600_000;
const graceOf = (extra = {}) => ({ housekeeping: { laneGraceMs: GRACE_MS, ...extra } });
const pastGrace = () => Date.now() + 2 * GRACE_MS;
const samePathAs = (a, b) => assert.equal(pathKey(a), pathKey(b));

test('lanesRoot: the env override wins, then the owner config roots.lanes, then <starciLocalRoot>/lanes', () => {
  const state = path.join(os.tmpdir(), 'hk-lanes-state');
  const fleet = path.join(os.tmpdir(), 'fleet-lanes');
  const oneOff = path.join(os.tmpdir(), 'one-off');
  assert.equal(lanesRoot({ env: { STARCI_LOCAL_ROOT: state }, config: {} }), path.join(state, 'lanes'), 'no key anywhere: <starciLocalRoot>/lanes');
  assert.equal(lanesRoot({ env: {}, config: { roots: { lanes: fleet } } }), path.resolve(fleet));
  assert.equal(lanesRoot({ env: { STARCI_LANES_ROOT: oneOff }, config: { roots: { lanes: fleet } } }),
    path.resolve(oneOff), 'a one-off/spec env still overrides the owner config');
});

test('sweepLanes: a merged lane goes away with its branch; dirty, unmerged and outside trees stay and a lane holding a link is removed without touching the link target; the main checkout is never touched', (t) => {
  const root = repoFixture(t);
  const lanes = path.join(tmp(t, 'hk-lanes-'), 'lanes');
  // lane/done: committed work merged back into main -> merged.
  const done = addWorktree(root, path.join(lanes, 'done'), 'lane/done', { commit: 'done.txt' });
  git(root, 'merge', '-q', '--no-ff', 'lane/done', '-m', 'merge lane/done');
  // lane/wip: committed work never merged -> kept.
  const wip = addWorktree(root, path.join(lanes, 'wip'), 'lane/wip', { commit: 'wip.txt' });
  // lane/dirty: uncommitted changes -> kept.
  const dirty = addWorktree(root, path.join(lanes, 'dirty'), 'lane/dirty');
  fs.writeFileSync(path.join(dirty, 'scratch.txt'), 'unsaved\n');
  // lane/linked: a directory link into main inside -> the link goes as a link, main stays whole.
  const linked = addWorktree(root, path.join(lanes, 'linked'), 'lane/linked');
  fs.appendFileSync(path.join(root, '.git', 'info', 'exclude'), 'node_modules\n');
  fs.symlinkSync(root, path.join(linked, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
  // A detached scratch and a worktree outside the lanes root -> kept.
  const detached = path.join(lanes, 'det');
  git(root, 'worktree', 'add', '-q', '--detach', detached, 'main');
  const outside = addWorktree(root, path.join(tmp(t, 'hk-outside-'), 'wt'), 'lane/outside');

  const now = pastGrace();
  const dry = sweepLanes({ apply: false, now, env: envOf(lanes), allocation: graceOf(), root });
  assert.equal(dry.ok, true, JSON.stringify(dry.errors));
  assert.deepEqual(dry.removed, []);
  assert.deepEqual(dry.wouldRemove.map((w) => w.branch), ['lane/done', 'lane/linked'], JSON.stringify(dry, null, 1));
  assert.ok(fs.existsSync(done), 'a dry run removes nothing');

  const out = sweepLanes({ apply: true, now, env: envOf(lanes), allocation: graceOf(), root });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.equal(out.removed.length, 2);
  const doneRow = out.removed.find((r) => r.branch === 'lane/done');
  samePathAs(doneRow.path, done);
  assert.equal(doneRow.branchDeleted, true);
  assert.ok(!fs.existsSync(linked), 'the link-holding lane is removed');
  assert.ok(fs.existsSync(path.join(root, 'a.txt')), 'the link target (main) is untouched');
  assert.ok(out.freedBytes > 0);
  assert.ok(!fs.existsSync(done), 'the merged worktree directory is gone');
  assert.equal(git(root, 'branch', '--list', 'lane/done'), '', 'its merged branch is gone');
  assert.ok(!git(root, 'worktree', 'list', '--porcelain').includes('done'), 'the registration is pruned');

  const reason = (p) => out.skipped.find((s) => pathKey(s.path) === pathKey(p))?.reason;
  assert.equal(reason(wip), 'unmerged-commits');
  assert.ok(['dirty', 'uncommitted-changes'].includes(reason(dirty)), JSON.stringify(out.skipped));
  assert.equal(reason(detached), 'detached-head');
  assert.equal(reason(outside), 'outside-lanes-root');
  assert.equal(reason(root), 'main-checkout', 'the main checkout is always named and kept');
  for (const kept of [wip, dirty, detached, outside]) assert.ok(fs.existsSync(kept), `${kept} stays`);
  assert.ok(git(root, 'branch', '--list', 'lane/wip'), 'an unmerged branch is kept');
  assert.equal(git(root, 'rev-parse', 'HEAD'), git(root, 'rev-parse', 'main'), 'the main checkout still stands on its merge');
});

test('sweepLanes: the owner config roots.lanes is the authority when no env override is set', (t) => {
  const root = repoFixture(t);
  const lanes = path.join(tmp(t, 'hk-lanes-'), 'lanes');
  const done = addWorktree(root, path.join(lanes, 'done'), 'lane/done');
  const out = sweepLanes({ apply: true, now: pastGrace(), env: {}, allocation: graceOf(), config: { roots: { lanes } }, root });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.equal(out.lanesRoot, path.resolve(lanes));
  assert.equal(out.removed.length, 1, 'a lane with no commit, idle past laneGraceMs, is removed');
  assert.ok(!fs.existsSync(done));
});

test('sweepLanes: a fresh lane cut from main with no commit yet is no-work-yet and kept until laneGraceMs passes (loops2, 2026-09-26)', (t) => {
  const root = repoFixture(t);
  const lanes = path.join(tmp(t, 'hk-lanes-'), 'lanes');
  const fresh = addWorktree(root, path.join(lanes, 'fresh'), 'lane/fresh');
  const out = sweepLanes({ apply: true, env: envOf(lanes), allocation: graceOf(), root });
  assert.equal(out.ok, true, JSON.stringify(out.errors));
  assert.deepEqual(out.removed, [], 'a lane that has done no work yet is not landed');
  assert.equal(out.skipped.find((s) => pathKey(s.path) === pathKey(fresh))?.reason, 'no-work-yet', JSON.stringify(out.skipped));
  assert.ok(fs.existsSync(fresh), 'the fresh worktree stays');
  assert.ok(git(root, 'branch', '--list', 'lane/fresh'), 'its branch stays');

  const later = sweepLanes({ apply: true, now: pastGrace(), env: envOf(lanes), allocation: graceOf(), root });
  assert.equal(later.removed.length, 1, 'abandoned past laneGraceMs, it is swept');
  assert.ok(!fs.existsSync(fresh));
});

test('sweepLanes: a landed lane still in use is recent-activity; laneGraceMs unset removes no lane', (t) => {
  const root = repoFixture(t);
  const lanes = path.join(tmp(t, 'hk-lanes-'), 'lanes');
  const busy = addWorktree(root, path.join(lanes, 'busy'), 'lane/busy', { commit: 'busy.txt' });
  git(root, 'cherry-pick', git(root, 'rev-parse', 'lane/busy')); // land.mjs lands by cherry-pick
  const reasonIn = (out) => out.skipped.find((s) => pathKey(s.path) === pathKey(busy))?.reason;

  const unset = sweepLanes({ apply: true, now: pastGrace(), env: envOf(lanes), allocation: {}, root });
  assert.equal(reasonIn(unset), 'lane-grace-unset', JSON.stringify(unset.skipped));
  const fresh = sweepLanes({ apply: true, env: envOf(lanes), allocation: graceOf(), root });
  assert.equal(reasonIn(fresh), 'recent-activity', JSON.stringify(fresh.skipped));
  assert.ok(fs.existsSync(busy), 'a lane that just landed its first commit keeps working');

  const later = sweepLanes({ apply: true, now: pastGrace(), env: envOf(lanes), allocation: graceOf(), root });
  assert.equal(later.removed.length, 1, JSON.stringify(later));
  assert.ok(!fs.existsSync(busy));
});

test('parseWorktreeList reads branch/detached/dirty/locked attributes', () => {
  const rows = parseWorktreeList('worktree /a\nHEAD 123\nbranch refs/heads/main\n\nworktree /b\nHEAD 456\ndetached\ndirty\nlocked reason\n');
  assert.deepEqual(rows, [
    { path: '/a', branch: 'refs/heads/main', detached: false, dirty: false, locked: false, prunable: false },
    { path: '/b', branch: null, detached: true, dirty: true, locked: true, prunable: false },
  ]);
});
