// worker-staging-orca.spec.mjs — the [Worker] staging checkout is an Orca worktree (lane WSTAGE, deep map WT2). createStaging
// asks Orca (scripts/machine/worktrees.mjs createOrcaWorktree: `orca worktree create --name sup-<job> --base-branch main
// --comment starci:supervisor-staging:sup-<job>;sup=<job>`, the stamp createOrcaWorktree builds), records the path, branch, base and Orca id Orca reported, and registers the
// row kind supervisor-staging keyed by Orca's id. removeStaging is the link-safe Orca removal (links unlinked, `orca
// worktree rm`, the row closed, the branch deleted or kept). The git staging path is gone: createScratchWorktree refuses the
// kind and check-worktree-add fails a call that asks it. A fake Orca client (tests/helpers/fake-orca-worktrees.mjs) stands
// in for the CLI: no live Orca call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withMachine, openMachine } from '../../engine/db/machine.mjs';
import { createStaging, removeStaging, stagingNameOf, createJob, jobOf, spawnWorkers, STAGING_KIND } from '../../scripts/supervisor/workers.mjs';
import { gcWorktrees } from '../../scripts/machine/worktrees.mjs';
import { ORCA_KINDS, SCRATCH_KINDS } from '../../scripts/lib/worktree-kinds.mjs';
import { createScratchWorktree } from '../../scripts/machine/worktree-git.mjs';
import { strayLines } from '../../scripts/checks/check-worktree-add.mjs';
import { parseRuntimeStamp, runtimeStampOf } from '../../scripts/lib/orca-orphans.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

for (const key of ['GIT_DIR', 'GIT_COMMON_DIR', 'GIT_WORK_TREE', 'GIT_INDEX_FILE', 'GIT_OBJECT_DIRECTORY', 'GIT_PREFIX']) delete process.env[key];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const settings = { agent: 'claude', model: 'm', effort: 'high', repos: [], pollIntervalMs: 600000, language: 'vi', workers: { base: 4, max: 10 }, landGate: { mode: 'shared', push: false } };

/** A runtime repo on main with an installed node_modules, a machine registry and a fake Orca of its own. */
function fixture(t, opts = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wstage-')));
  t.after(() => { spawnSync('git', ['-C', path.join(base, 'rt'), 'worktree', 'prune'], { windowsHide: true }); fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }); });
  const root = path.join(base, 'rt');
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  git(root, 'init', '-q', '-b', 'main');
  git(root, 'config', 'user.email', 'spec@starci.test');
  git(root, 'config', 'user.name', 'spec');
  git(root, 'config', 'core.autocrlf', 'false');
  fs.writeFileSync(path.join(root, '.gitignore'), 'node_modules/\nconfig.yaml\n');
  fs.writeFileSync(path.join(root, 'scripts', 'a.mjs'), 'export const a = 1;\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'init');
  fs.mkdirSync(path.join(root, 'node_modules', 'dep'), { recursive: true });
  fs.writeFileSync(path.join(root, 'node_modules', 'dep', 'index.js'), 'module.exports = 1;\n');
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite'), STARCI_SUPERVISOR_MODE: 'kernel', STARCI_LOCAL_ROOT: path.join(base, 'la') };
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca'), ...opts });
  return { base, root, env, orca };
}
const rowOf = (env, orcaId) => withMachine((m) => m.db.prepare('SELECT * FROM worktrees WHERE orca_id=?').get(orcaId) ?? null, { env });

test('the staging kind is an Orca kind, never a git scratch kind', () => {
  assert.equal(STAGING_KIND, 'supervisor-staging');
  assert.ok(ORCA_KINDS.includes(STAGING_KIND));
  assert.ok(!SCRATCH_KINDS.includes(STAGING_KIND));
  assert.equal(stagingNameOf('fix-a-1'), 'sup-fix-a-1');
});

test('createStaging asks Orca and records the path, branch, base and id Orca reported; the row is keyed by Orca\'s id', (t) => {
  const { root, env, orca } = fixture(t);
  const s = createStaging({ jobId: 'fix-a-1', root, env, orca });
  assert.ok(s.ok, s.error);
  const [verb, args] = orca.calls.find((c) => c[0] === 'create');
  assert.equal(verb, 'create');
  assert.deepEqual([args.name, args.baseBranch, args.setup, args.comment], ['sup-fix-a-1', 'main', 'skip', 'starci:supervisor-staging:sup-fix-a-1;sup=fix-a-1']);
  assert.equal(args.comment, runtimeStampOf({ kind: STAGING_KIND, slot: 'sup-fix-a-1', owner: { supJobId: 'fix-a-1' } }), 'the one stamp helper builds it');
  assert.deepEqual([parseRuntimeStamp(args.comment)?.kind, parseRuntimeStamp(args.comment)?.supJobId], [STAGING_KIND, 'fix-a-1'], 'the orphan scan reads the owning Supervisor job back');
  assert.equal(args.repo, `path:${root.replace(/\\/g, '/')}`);
  const tree = [...orca.trees.values()][0];
  assert.deepEqual([s.path, s.branch, s.orcaId], [path.resolve(tree.path), tree.branch, tree.id], 'what Orca reported, never a name built here');
  assert.equal(s.base, git(root, 'rev-parse', 'main'));
  assert.ok(!path.resolve(s.path).startsWith(path.resolve(root)), 'Orca places it under its own workspace root');
  const row = rowOf(env, s.orcaId);
  assert.deepEqual([row?.kind, row?.lane, row?.branch, row?.removed_at, path.resolve(row?.path ?? '')], [STAGING_KIND, 'fix-a-1', s.branch, null, s.path]);
  assert.equal(fs.existsSync(path.join(s.path, 'node_modules')), false, 'no node_modules link to the live runtime (RT_NODE_MODULES_LINK); no lockfile, no install');
});

test('a staging checkout with a package-lock gets its own npm ci (the install seam), never a linked node_modules; a failed ci removes it', (t) => {
  const { root, env, orca } = fixture(t);
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'lock');
  const installs = [];
  const s = createStaging({ jobId: 'fix-ci-1', root, env, orca, install: (dir) => { installs.push(path.resolve(dir)); return { ok: true, status: 0, stderr: '' }; } });
  assert.ok(s.ok, s.error);
  assert.deepEqual(installs, [path.resolve(s.path)], 'npm ci runs once, in the staging checkout');
  assert.equal(fs.existsSync(path.join(s.path, 'node_modules')), false, 'never a link to the live node_modules');
  const failed = createStaging({ jobId: 'fix-ci-2', root, env, orca, install: () => ({ ok: false, status: 1, stderr: 'npm ERR! boom' }) });
  assert.deepEqual([failed.ok, failed.reason, failed.code], [false, 'staging-install-failed', 'WORKER_STAGING_CREATE_FAILED']);
  assert.match(failed.error, /npm ci in the staging checkout failed \(exit 1\)/);
});

test('every staging install runs under the host lock (purpose npm-ci), so several spawns in one call each own the lock their install needs; a lock that stays held fails the staging with the holder named', (t) => {
  const { root, env, orca } = fixture(t);
  fs.writeFileSync(path.join(root, 'package-lock.json'), '{}\n');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'lock');
  const locked = [];
  const hostLock = (options, work) => { locked.push(options.purpose); const out = work(); locked.push('released'); return out; };
  const install = () => ({ ok: true, status: 0, stderr: '' });
  const first = createStaging({ jobId: 'fix-l-1', root, env, orca, install, lockDeps: { hostLock } });
  const second = createStaging({ jobId: 'fix-l-2', root, env, orca, install, lockDeps: { hostLock } });
  assert.ok(first.ok && second.ok, first.error ?? second.error);
  assert.deepEqual(locked, ['npm-ci', 'released', 'npm-ci', 'released']);
  let t0 = 0;
  const held = { ok: false, reason: 'held', owner: { role: 'coordinator', purpose: 'land', pid: 7 } };
  const refused = createStaging({ jobId: 'fix-l-3', root, env, orca, install, lockDeps: { hostLock: () => held, now: () => t0, sleep: (ms) => { t0 += ms; }, hostLockWaitMs: 4000 } });
  assert.deepEqual([refused.ok, refused.reason], [false, 'staging-install-failed']);
  assert.match(refused.error, /held by coordinator \(land\) pid 7/);
});

test('removeStaging is the link-safe Orca removal: links first, orca rm, row closed; a branch with work is kept, a landed one deleted', (t) => {
  const { root, env, orca } = fixture(t);
  const s = createStaging({ jobId: 'fix-b-2', root, env, orca });
  assert.ok(s.ok, s.error);
  fs.writeFileSync(path.join(s.path, 'scripts', 'a.mjs'), 'export const a = 2;\n');
  git(s.path, 'commit', '-q', '-am', 'work');
  const kept = removeStaging({ jobId: 'fix-b-2', staging: s, root, env, orca });
  assert.ok(kept.removed, kept.error);
  assert.equal(kept.branchKept, s.branch, 'unlanded commits keep their branch');
  assert.ok(!fs.existsSync(s.path));
  assert.ok(fs.existsSync(path.join(root, 'node_modules', 'dep', 'index.js')), 'the live node_modules is untouched');
  assert.deepEqual(orca.calls.filter((c) => c[0] === 'remove').map((c) => c[1]), [{ worktree: `id:${s.orcaId}`, force: true }]);
  assert.ok(rowOf(env, s.orcaId)?.removed_at, 'the registry row is closed');
  const s2 = createStaging({ jobId: 'fix-c-3', root, env, orca });
  fs.writeFileSync(path.join(s2.path, 'scripts', 'a.mjs'), 'export const a = 3;\n');
  git(s2.path, 'commit', '-q', '-am', 'landed by cherry-pick');
  const landed = removeStaging({ jobId: 'fix-c-3', staging: s2, root, env, landed: true, orca });
  assert.ok(landed.removed && landed.branchDeleted, landed.error);
  assert.equal(git(root, 'branch', '--list', s2.branch), '');
  const s3 = createStaging({ jobId: 'fix-d-4', root, env, orca });
  const clean = removeStaging({ jobId: 'fix-d-4', staging: s3, root, env, orca });
  assert.ok(clean.removed && clean.branchDeleted, 'a branch with nothing beyond main goes');
});

test('typed failures: Orca refuses the creation (no live row left); a job without an Orca record; Orca refuses the removal', (t) => {
  const { root, env } = fixture(t);
  const refusing = fakeOrcaWorktrees({ root: path.join(path.dirname(root), 'orca-r'), failCreate: true });
  const made = createStaging({ jobId: 'fix-e-5', root, env, orca: { ...refusing, addRepo: undefined } });
  assert.deepEqual([made.ok, made.code, made.reason], [false, 'WORKER_STAGING_CREATE_FAILED', 'orca-worktree-create-failed']);
  assert.equal(withMachine((m) => m.liveWorktrees().length, { env }), 0, 'the reserved slot went back');
  const none = removeStaging({ jobId: 'fix-e-5', staging: { path: path.join(root, 'x'), branch: 'sup-fix-e-5', base: 'abc' }, root, env, orca: refusing });
  assert.deepEqual([none.removed, none.code, none.reason], [false, 'WORKER_STAGING_REMOVE_FAILED', undefined]);
  assert.match(none.error, /records no Orca staging checkout/);
  assert.ok(!refusing.names().includes('remove'), 'no Orca call without an Orca id');
  const orca = fakeOrcaWorktrees({ root: path.join(path.dirname(root), 'orca-ok') });
  const s = createStaging({ jobId: 'fix-f-6', root, env, orca });
  const stuck = removeStaging({ jobId: 'fix-f-6', staging: s, root, env, orca: { ...orca, remove: (a) => { orca.calls.push(['remove', a]); return { ok: false, removed: false, errorCode: 'busy', error: 'busy' }; } } });
  assert.deepEqual([stuck.removed, stuck.code, stuck.reason], [false, 'WORKER_STAGING_REMOVE_FAILED', 'orca-worktree-rm-failed']);
  assert.ok(fs.existsSync(path.join(root, 'node_modules', 'dep', 'index.js')));
});

test('spawnWorkers records the Orca staging (with its id) on the job and starts the worker on the reported path', async (t) => {
  const { root, env, orca } = fixture(t);
  const m = openMachine({ env });
  const started = [];
  let r, job, staging;
  try {
    ({ job } = createJob(m, { cluster: 'wstage', files: ['scripts/a.mjs'] }));
    r = await spawnWorkers(m, { settings, env, root, deps: { orca, guard: () => ({ receipt: {} }),
      load: () => ({ cpuBusy: 0, freeMem: 1 }), route: async () => ({ pool: 'claude-agent', agent: 'claude', model: 'm' }),
      start: (opts) => { started.push(opts); return { ok: true, terminal: 'term_w', dispatchId: 'ctx_w' }; } } });
    staging = jobOf(m, job.job_id).payload.staging;
  } finally { m.close(); }
  assert.equal(r.launched.length, 1, JSON.stringify(r));
  const tree = [...orca.trees.values()][0];
  assert.deepEqual(staging, { path: path.resolve(tree.path), branch: tree.branch, base: git(root, 'rev-parse', 'main'), orcaId: tree.id });
  assert.equal(started[0].worktree, staging.path);
});

test('the worktree GC removes a settled job\'s staging through Orca and keeps a live one', (t) => {
  const { root, env, orca } = fixture(t);
  const live = createStaging({ jobId: 'fix-live-7', root, env, orca });
  const done = createStaging({ jobId: 'fix-done-8', root, env, orca });
  const status = { 'fix-live-7': 'running', 'fix-done-8': 'succeeded' };
  const items = gcWorktrees({ env, repos: [root], jobStatusOf: Object.assign(() => null, {}), supStatusOf: (jobId) => status[jobId] ?? null, orca });
  const item = items.find((i) => i.path && path.resolve(i.path) === done.path);
  assert.deepEqual([item?.reason, item?.home, item?.ok], ['owner-settled', 'orca', true], JSON.stringify(items));
  assert.ok(!fs.existsSync(done.path));
  assert.ok(fs.existsSync(live.path), 'a running job keeps its checkout');
  assert.ok(!items.some((i) => i.path && path.resolve(i.path) === live.path));
});

test('the git staging path is gone: createScratchWorktree refuses the kind, check-worktree-add fails a call asking it', (t) => {
  const { root, env } = fixture(t);
  assert.throws(() => createScratchWorktree({ repoRoot: root, dir: path.join(root, '..', 'x'), kind: 'supervisor-staging', branch: 'sup/x', newBranch: true, base: 'main', env }), /not a scratch kind/);
  const hits = strayLines("  const added = createScratchWorktree({ repoRoot: root, dir, kind: 'supervisor-staging', branch, newBranch: true });", 'scripts/supervisor/workers.mjs');
  assert.deepEqual(hits.map((h) => [h.line, h.orcaKind]), [[1, 'supervisor-staging']]);
  assert.deepEqual(strayLines("createScratchWorktree({ repoRoot, dir, kind: 'land-scratch', detach: true })", 'scripts/supervisor/land.mjs'), [], 'a scratch kind is the one home\'s caller, never red');
  assert.deepEqual(strayLines("// createScratchWorktree({ kind: 'supervisor-staging' }) was the old path", 'scripts/x.mjs'), [], 'a comment is not a call');
});
