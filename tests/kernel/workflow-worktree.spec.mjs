// One worktree per Kernel workflow (owner decision WFWT, part A; scripts/kernel/workflow-worktree.mjs). Orca creates and
// owns it (a fake Orca client here: tests/helpers/fake-orca-worktrees.mjs behaves as the real CLI was measured to), the
// registry keys it by Orca's worktree id against the per-repo cap, every op launches on it, same-side ops wait for each
// other, and its release unlinks every link before `orca worktree rm` and leaves the main checkout byte-identical.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { withMachine } from '../../engine/db/machine.mjs';
import { workflowWorktreeSpec, ensureWorkflowWorktree, registerWorkflowWorktree, setCheckpoint, opWorktreeArgs, sideOf, canDispatchConcurrently, workflowSideWait, releaseWorkflowWorktree, markReleasePending, workflowAppRepo, workflowWorktreePromptRules, WORKFLOW_SIDE_BUSY } from '../../scripts/kernel/workflow-worktree.mjs';
import { createScratchWorktree } from '../../scripts/machine/worktree-git.mjs';
import { createOrcaWorktree } from '../../scripts/machine/worktree-orca.mjs';
import { isPendingRow } from '../../scripts/machine/worktree-registry.mjs';
import { gcWorktrees } from '../../scripts/machine/worktrees.mjs';
import { workflowWorktreeAt, workflowWorktreeOf } from '../../scripts/machine/workflow-tree.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';
import { FAKE_ORCA } from '../helpers/fake-orca.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';

const require = createRequire(import.meta.url);
const ROOT = path.resolve(import.meta.dirname, '..', '..');
const API = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const LINK = process.platform === 'win32' ? 'junction' : 'dir';
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const posix = (p) => String(p).split(path.sep).join('/');
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };

/** An app repo on main (be/ and fe/ sides, an installed node_modules), a machine registry and a fake Orca of its own. */
function fixture(t, opts = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wfwt-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const app = path.join(base, 'app');
  fs.mkdirSync(app);
  git(app, 'init', '-q', '-b', 'main');
  git(app, 'config', 'user.email', 'spec@starci.test');
  git(app, 'config', 'user.name', 'spec');
  git(app, 'config', 'core.autocrlf', 'false');
  write(app, '.gitignore', 'node_modules/\n');
  write(app, 'be/src/main.ts', 'export const be = 1;\n');
  write(app, 'fe/src/page.tsx', 'export const fe = 1;\n');
  git(app, 'add', '-A');
  git(app, 'commit', '-q', '-m', 'init');
  write(app, 'node_modules/dep/index.js', 'module.exports = 1;\n');
  write(app, 'packages/node_modules/shared/index.js', 'module.exports = 2;\n');
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite') };
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca'), ...opts });
  return { base, app, env, orca, ctx: { env, orca } };
}

/** Every file under `root` (links reported, never followed, .git skipped) -> sha256. */
function picture(root) {
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name), rel = path.relative(root, p).replace(/\\/g, '/');
      if (rel === '.git' || rel.startsWith('.git/')) continue;
      const st = fs.lstatSync(p);
      if (st.isSymbolicLink()) { out[rel] = 'link'; continue; }
      if (st.isDirectory()) walk(p);
      else out[rel] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(root);
  return out;
}
const rows = (env) => withMachine((m) => m.db.prepare('SELECT * FROM worktrees ORDER BY created_at').all(), { env });

test("the spec names the Orca creation: wf-<id> off main with setup; the workflow branch is Orca's wf-<id>", () => {
  const spec = workflowWorktreeSpec({ workflowId: 'wf-shop-k2', appRepo: path.resolve('/apps/app') });
  assert.equal(spec.name, 'wf-wf-shop-k2');
  assert.equal(spec.baseBranch, 'main');
  assert.equal(spec.branch, 'wf-wf-shop-k2');
  assert.deepEqual(spec.args.slice(0, 2), ['worktree', 'create']);
  for (const flag of ['--repo', '--name', '--base-branch', '--setup', '--no-parent']) assert.ok(spec.args.includes(flag), flag);
  assert.equal(spec.args[spec.args.indexOf('--setup') + 1], 'run', 'the repository setup hook (npm ci) runs: no junctions');
});

test('Orca creates the workflow worktree once; the registry keys it by Orca\'s id; the branch is the workflow branch', (t) => {
  const { app, env, orca, ctx } = fixture(t);
  const made = ensureWorkflowWorktree(ctx, { workflowId: 'wf-shop-k2', appRepo: app, ledgerId: 'ledger-1' });
  assert.ok(made.ok && made.created, JSON.stringify(made));
  const rec = made.record;
  assert.deepEqual(orca.names(), ['create']);
  assert.deepEqual({ ...orca.calls[0][1], repo: undefined }, { repo: undefined, name: 'wf-wf-shop-k2', baseBranch: 'main', setup: 'run',
    comment: 'starci:workflow:wf-wf-shop-k2;wf=wf-shop-k2;ledger=ledger-1' }, 'the ownership stamp rides on the create');
  assert.equal(orca.calls[0][1].repo, `path:${app.replace(/\\/g, '/')}`);
  assert.ok(!rec.path.startsWith(app), 'Orca places it under its own workspace root, not inside the app checkout');
  assert.equal(rec.branch, 'wf-wf-shop-k2');
  assert.equal(git(rec.path, 'rev-parse', '--abbrev-ref', 'HEAD'), 'wf-wf-shop-k2', 'Orca\'s own branch is the workflow branch, never renamed');
  assert.equal(git(rec.path, 'rev-parse', 'HEAD'), git(app, 'rev-parse', 'main'));
  const live = rows(env).filter((r) => r.removed_at == null);
  assert.equal(live.length, 1, 'no pending slot is left behind');
  assert.deepEqual([live[0].kind, live[0].orca_id, live[0].workflow_id, live[0].ledger_id], ['workflow', rec.orcaWorktreeId, 'wf-shop-k2', 'ledger-1']);
  assert.deepEqual(workflowWorktreeOf(ctx, 'wf-shop-k2'), rec);
  // A tool run inside the tree (gate.mjs) finds its workflow by path through the registry, never by a branch name.
  assert.deepEqual(workflowWorktreeAt(ctx, rec.path), rec);
  assert.deepEqual(workflowWorktreeAt(ctx, path.join(rec.path, 'be', 'src')), rec, 'a directory inside the tree is the tree');
  assert.equal(workflowWorktreeAt(ctx, app), null, 'the app checkout is no workflow worktree');
  assert.deepEqual(opWorktreeArgs(ctx, { workflowId: 'wf-shop-k2' }), ['--worktree', rec.path]);
  assert.deepEqual(opWorktreeArgs(ctx, { workflowId: 'wf-other' }), [], 'a workflow with no worktree runs its ops on the ledger repo');
  // A Kernel restart finds it again: Orca is not asked twice.
  const again = ensureWorkflowWorktree(ctx, { workflowId: 'wf-shop-k2', appRepo: app });
  assert.ok(again.ok && !again.created);
  assert.equal(again.record.path, rec.path);
  assert.deepEqual(orca.names(), ['create']);
  // Part B's checkpoint lands on the row.
  assert.equal(setCheckpoint(ctx, 'wf-shop-k2', 'abc123'), true);
  assert.equal(workflowWorktreeOf(ctx, 'wf-shop-k2').checkpoint, 'abc123');
  assert.equal(setCheckpoint(ctx, 'wf-none', 'abc123'), false);
  assert.match(workflowWorktreePromptRules(rec), /ONLY in .*wf-wf-shop-k2/);
  assert.equal(workflowWorktreePromptRules(null), '');
});

test('registerWorkflowWorktree records a worktree Orca reported (by id and path), and a second registration of the id moves it', (t) => {
  const { app, env, ctx } = fixture(t);
  const dir = path.join(path.dirname(app), 'wt-reported');
  git(app, 'worktree', 'add', '-q', '-b', 'wf/wf-reported', dir, 'main');
  const rec = registerWorkflowWorktree(ctx, { workflowId: 'wf-reported', orcaWorktreeId: 'repo-app::x', path: dir, branch: 'wf/wf-reported' });
  assert.deepEqual([rec.workflowId, rec.orcaWorktreeId, rec.path, rec.branch, rec.checkpoint], ['wf-reported', 'repo-app::x', path.resolve(dir), 'wf/wf-reported', null]);
  assert.equal(path.resolve(rec.repoRoot), path.resolve(app), 'keyed under the main checkout');
  assert.equal(rows(env).filter((r) => r.orca_id === 'repo-app::x').length, 1);
});

test('the per-repo cap: a full repository refuses worktree-cap before Orca is asked; a released slot admits the next', (t) => {
  const { app, env, orca, ctx } = fixture(t);
  const settings = { capPerRepo: 2, ownerGoneMs: 1_800_000, gcEveryMs: 1, gcBudgetMs: 1 };
  // A scratch tree counts against the cap but is never refused.
  assert.ok(createScratchWorktree({ repoRoot: app, dir: path.join(path.dirname(app), 'scratch'), kind: 'land-scratch', detach: true, base: 'main', env }).ok);
  const one = createOrcaWorktree({ repoRoot: app, kind: 'workflow', name: 'wf-wf-one', base: 'main', owner: { workflowId: 'wf-one' }, env, orca, settings });
  assert.equal(one.ok, true, JSON.stringify(one));
  const two = createOrcaWorktree({ repoRoot: app, kind: 'workflow', name: 'wf-wf-two', base: 'main', owner: { workflowId: 'wf-two' }, env, orca, settings });
  assert.deepEqual([two.ok, two.reason, two.live, two.cap], [false, 'worktree-cap', 2, 2]);
  assert.deepEqual(orca.names(), ['create'], 'nothing created for the waiting workflow');
  assert.equal(rows(env).filter((r) => r.removed_at == null && isPendingRow(r)).length, 0, 'no slot held');
  assert.ok(releaseWorkflowWorktree(ctx, 'wf-one').ok);
  const again = createOrcaWorktree({ repoRoot: app, kind: 'workflow', name: 'wf-wf-two', base: 'main', owner: { workflowId: 'wf-two' }, env, orca, settings });
  assert.equal(again.ok, true, JSON.stringify(again));
});

test('a refused Orca creation gives the slot back and reports orca-worktree-create-failed', (t) => {
  const { app, env, ctx } = fixture(t, { failCreate: true });
  const made = ensureWorkflowWorktree(ctx, { workflowId: 'wf-refused', appRepo: app });
  assert.deepEqual([made.ok, made.reason], [false, 'orca-worktree-create-failed']);
  assert.match(made.detail, /repo_not_found/);
  assert.equal(rows(env).filter((r) => r.removed_at == null).length, 0, 'the reserved slot was released');
  assert.equal(workflowWorktreeOf(ctx, 'wf-refused'), null);
});

test('release: every link removed as a link first, then orca worktree rm; the main checkout stays byte-identical', (t) => {
  const { app, env, orca, ctx } = fixture(t);
  const rec = ensureWorkflowWorktree(ctx, { workflowId: 'wf-rel', appRepo: app }).record;
  // Links into the main checkout (what a junction overlay used to be): the release must never walk them.
  fs.symlinkSync(path.join(app, 'node_modules'), path.join(rec.path, 'node_modules'), LINK);
  fs.mkdirSync(path.join(rec.path, 'packages'), { recursive: true });
  fs.symlinkSync(path.join(app, 'packages', 'node_modules'), path.join(rec.path, 'packages', 'node_modules'), LINK);
  write(rec.path, 'be/src/wip.ts', 'export const wip = 1;\n');
  const before = picture(app);
  const r = releaseWorkflowWorktree(ctx, 'wf-rel');
  assert.ok(r.ok && r.released, JSON.stringify(r));
  assert.equal(r.links, 2, 'both junctions removed as links');
  assert.deepEqual(orca.calls.at(-1), ['remove', { worktree: `id:${rec.orcaWorktreeId}`, force: true }]);
  assert.ok(!fs.existsSync(rec.path));
  assert.deepEqual(picture(app), before, 'the main checkout is byte-identical');
  assert.equal(git(app, 'status', '--porcelain', '--untracked-files=no'), '');
  assert.equal(workflowWorktreeOf(ctx, 'wf-rel'), null, 'the registry row is closed');
  assert.ok(rows(env).find((x) => x.orca_id === rec.orcaWorktreeId).removed_at != null);
  assert.deepEqual(releaseWorkflowWorktree(ctx, 'wf-rel'), { ok: true, released: false, note: 'the workflow has no worktree' }, 'idempotent');
});

test('a refused orca worktree rm keeps the row live with its error; a removal that changes main is fatal', (t) => {
  const { app, env, ctx } = fixture(t, { failRemove: true });
  const rec = ensureWorkflowWorktree(ctx, { workflowId: 'wf-stuck', appRepo: app }).record;
  const r = releaseWorkflowWorktree(ctx, 'wf-stuck');
  assert.deepEqual([r.ok, r.reason], [false, 'orca-worktree-rm-failed']);
  const row = rows(env).find((x) => x.orca_id === rec.orcaWorktreeId);
  assert.equal(row.removed_at, null, 'still live: the GC retries');
  assert.match(row.remove_error, /orca worktree rm/);
  // An Orca whose removal also deletes a tracked file of main: the damage the guard must catch.
  const hostile = { ...ctx.orca, remove: (a) => { fs.rmSync(path.join(app, 'be', 'src', 'main.ts')); return { ok: true, removed: true, a }; } };
  const bad = releaseWorkflowWorktree({ env, orca: hostile }, 'wf-stuck');
  assert.deepEqual([bad.ok, bad.reason, bad.fatal], [false, 'main-checkout-damaged', true]);
  assert.match(bad.damage.join(' '), /tracked file deleted: be\/src\/main\.ts/);
});

test('sides: same side waits, across sides runs together, both-sides runs alone, Work-only never blocks', () => {
  const be = { owned_paths: ['be/src/a.ts', { path: 'be/test/a.spec.ts' }] };
  const fe = { ownedPaths: ['fe/src/page.tsx'] };
  const both = ['be/src/a.ts', 'fe/src/b.tsx'];
  const root = ['package.json'];
  const work = ['.starciwork/features/a.yaml'];
  assert.deepEqual([sideOf(be), sideOf(fe), sideOf(both), sideOf(root), sideOf(work), sideOf({})], ['be', 'fe', 'both', 'both', 'work', null]);
  assert.equal(sideOf(['be/src/a.ts', '.starciwork/features/a.yaml']), 'be', 'Work records ride along with a be/fe op');
  assert.equal(sideOf(['./fe/x.ts', '.starciwork/y']), 'fe');
  assert.equal(canDispatchConcurrently([be], fe), true, 'across sides');
  assert.equal(canDispatchConcurrently([be], { owned_paths: ['be/src/b.ts'] }), false, 'same side');
  assert.equal(canDispatchConcurrently([be], both), false);
  assert.equal(canDispatchConcurrently([both], fe), false);
  assert.equal(canDispatchConcurrently([root], fe), false, 'the app root counts as both sides');
  assert.equal(canDispatchConcurrently([be, fe], work), true, 'a Work-only op is its own side: it runs beside be and fe');
  assert.equal(canDispatchConcurrently([both], work), true);
  assert.equal(canDispatchConcurrently([work], ['.starciwork/decisions/b.yaml']), true, 'two Work ops are serialised by their path leases, not by the side');
  assert.equal(canDispatchConcurrently([work], be), true);
  assert.equal(canDispatchConcurrently([], both), true);
});

test('workflowSideWait reads the workflow\'s occupying jobs from the ledger and names who holds the side', () => {
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(':memory:');
  db.exec('CREATE TABLE jobs(job_id TEXT, workflow_id TEXT, op_id TEXT, kind TEXT, status TEXT, payload_json TEXT)');
  const add = (id, wf, status, paths, kind = 'op') => db.prepare('INSERT INTO jobs VALUES(?,?,?,?,?,?)').run(id, wf, 'code.refactor', kind, status, JSON.stringify({ owned_paths: paths }));
  add('op-be-1', 'wf-a', 'running', ['be/src/a.ts']);
  add('op-fe-done', 'wf-a', 'succeeded', ['fe/src/x.tsx']);
  add('op-fe-other-wf', 'wf-b', 'running', ['fe/src/x.tsx']);
  add('op-fe-queued', 'wf-a', 'queued', ['fe/src/y.tsx']);
  const job = (id) => ({ job_id: id, workflow_id: 'wf-a' });
  assert.equal(workflowSideWait(db, job('op-fe-new'), { owned_paths: ['fe/src/z.tsx'] }), null, 'fe is free in wf-a');
  const wait = workflowSideWait(db, job('op-be-new'), { owned_paths: ['be/src/b.ts'] });
  assert.equal(wait.reason, WORKFLOW_SIDE_BUSY);
  assert.deepEqual(wait.busy, [{ jobId: 'op-be-1', op: 'code.refactor', side: 'be' }]);
  assert.match(wait.detail, /be\/ side is in use by op-be-1/);
  assert.equal(workflowSideWait(db, job('op-be-1'), { owned_paths: ['be/src/a.ts'] }), null, 'a job never waits for itself');
  assert.equal(workflowSideWait(db, job('op-both'), { owned_paths: ['package.json'] }).side, 'both');
});

test("every workflow in a git checkout gets a worktree: the bound app, else the ledger repo's checkout, the runtime repo included", (t) => {
  const { base, app } = fixture(t);
  assert.equal(workflowAppRepo(app, { binding: { appRoot: app } }), app);
  assert.equal(workflowAppRepo(path.join(app, 'be'), { binding: null }), app, 'an unbound ledger repo inside a git checkout: that checkout');
  assert.equal(workflowAppRepo(app, { binding: { appRoot: path.join(app, 'missing') } }), app, 'a binding that is no checkout falls back to the repo checkout');
  const plain = path.join(base, 'not-git');
  fs.mkdirSync(plain);
  assert.equal(workflowAppRepo(plain, { binding: null }), null, 'no git checkout: no worktree (the Kernel starts on it; nothing to checkpoint)');
  const runtime = path.resolve(import.meta.dirname, '..', '..');
  const runtimeMain = git(runtime, 'worktree', 'list', '--porcelain').split(/\r?\n/)[0].slice('worktree '.length);
  assert.equal(workflowAppRepo(runtime, { binding: null }), path.resolve(runtimeMain), 'the runtime repo gets a wf-<id> worktree of its main checkout too');
});

test('release is host-side: a release-pending worktree with live terminals stays; once they are released the GC removes it, then branch -d', (t) => {
  const { app, env, orca, ctx } = fixture(t);
  const rec = ensureWorkflowWorktree(ctx, { workflowId: 'wf-fin', appRepo: app }).record;
  // Part B's finish: the branch merged into main, the row marked release-pending.
  git(app, 'merge', '-q', '--ff-only', rec.branch);
  assert.deepEqual(markReleasePending(ctx, 'wf-fin'), { ok: true });
  assert.equal(workflowWorktreeOf(ctx, 'wf-fin').releasePending, true);
  assert.deepEqual(markReleasePending(ctx, 'wf-none'), { ok: false });
  orca.terminals.set(rec.orcaWorktreeId, 2); // Orca's worktree ps: the Kernel and one op still hold a terminal in it
  const lookup = Object.assign(() => null, { workflowPhase: () => 'finished' });
  const held = gcWorktrees({ env, repos: [app], jobStatusOf: lookup, orca });
  assert.equal(held.find((i) => i.path && path.resolve(i.path) === rec.path), undefined, 'never removed while an agent works in it');
  assert.ok(fs.existsSync(rec.path));
  assert.ok(!orca.names().includes('remove'));
  // Never from inside itself either.
  assert.deepEqual([releaseWorkflowWorktree(ctx, 'wf-fin', { cwd: path.join(rec.path, 'be') }).reason], ['release-from-inside']);
  assert.ok(fs.existsSync(rec.path));
  orca.terminals.set(rec.orcaWorktreeId, 0); // the Kernel's and the ops' terminals are released
  const items = gcWorktrees({ env, repos: [app], jobStatusOf: lookup, orca });
  const item = items.find((i) => i.path && path.resolve(i.path) === rec.path);
  assert.deepEqual([item?.reason, item?.home, item?.ok], ['release-pending', 'orca', true], JSON.stringify(items));
  assert.ok(!fs.existsSync(rec.path));
  assert.equal(spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${rec.branch}`], { cwd: app }).status, 1, 'the merged workflow branch is deleted (branch -d)');
  assert.equal(workflowWorktreeOf(ctx, 'wf-fin'), null);
});

test('1.9: an rm Orca refuses for a live terminal leaves the release-pending row and tree; the GC retries once the Kernel terminal is closed', (t) => {
  const { app, env, orca, ctx } = fixture(t);
  const rec = ensureWorkflowWorktree(ctx, { workflowId: 'wf-refused', appRepo: app }).record;
  git(app, 'merge', '-q', '--ff-only', rec.branch);
  assert.deepEqual(markReleasePending(ctx, 'wf-refused'), { ok: true });
  const lookup = Object.assign(() => null, { workflowPhase: () => 'finished' });
  // ps says no terminal is left, but the Kernel's own terminal (closed after the finish's receipt) still lives when the GC asks.
  orca.refuseRm(true);
  const first = gcWorktrees({ env, repos: [app], jobStatusOf: lookup, orca }).find((i) => i.path && path.resolve(i.path) === rec.path);
  assert.deepEqual([first?.reason, first?.ok], ['release-pending', false], JSON.stringify(first));
  assert.match(String(first?.error ?? ''), /rm-failed/);
  assert.ok(fs.existsSync(rec.path), 'the tree is untouched');
  assert.equal(workflowWorktreeOf(ctx, 'wf-refused')?.releasePending, true, 'the row stays registered and release-pending');
  // The Kernel terminal is closed (closeKernelTerminal): the next GC pass removes the tree and deletes the merged branch.
  orca.refuseRm(false);
  const second = gcWorktrees({ env, repos: [app], jobStatusOf: lookup, orca }).find((i) => i.path && path.resolve(i.path) === rec.path);
  assert.deepEqual([second?.reason, second?.ok], ['release-pending', true], JSON.stringify(second));
  assert.ok(!fs.existsSync(rec.path));
  assert.equal(workflowWorktreeOf(ctx, 'wf-refused'), null);
});

test('an app repository Orca does not know yet is registered once, then the worktree is created', (t) => {
  const { app, orca, ctx } = fixture(t, { unknownRepo: true });
  const made = ensureWorkflowWorktree(ctx, { workflowId: 'wf-new-repo', appRepo: app });
  assert.ok(made.ok, JSON.stringify(made));
  assert.deepEqual(orca.names(), ['create', 'addRepo', 'create']);
  assert.equal(orca.calls[1][1].path, app.split(path.sep).join('/'));
});

test('startAgent threads a new worktree\'s creation flags to worker-start, and none for an existing worktree', async () => {
  const { startAgent } = await import('../../scripts/agent/lib.mjs');
  const starts = [];
  const io = {
    runShow: () => ({ ok: false }), runCreate: () => ({ ok: true, runId: 'run_1' }),
    spawn: {
      trust: () => ({ status: 'skipped', paths: [] }),
      start: (a) => { starts.push(a); return { ok: true, outcome: 'ok', dispatchId: `ctx_${starts.length}`, taskId: `task_${starts.length}`, agentTerminalHandle: 'term_1' }; },
      rename: () => ({ ok: true }),
      show: () => ({ ok: true, state: 'ready', effective: { agent: 'claude', model: 'claude-opus-5-5' } }),
      stop: () => ({ ok: true }), release: () => ({ ok: true }),
    },
  };
  const spec = workflowWorktreeSpec({ workflowId: 'wf-k', appRepo: path.resolve('/apps/k') });
  const kernel = startAgent({ provider: 'claude', model: 'claude-opus-5-5', worktree: 'new-child', repo: `path:${posix(path.resolve('/apps/k'))}`, baseBranch: spec.baseBranch, name: spec.name, setup: 'run',
    title: '[Kernel] k', prompt: 'go', objective: 'k', request: { workflow: 'wf-k', kernelAttempt: 1 }, io });
  assert.ok(kernel.ok, JSON.stringify(kernel));
  assert.deepEqual({ worktree: starts[0].worktree, repo: starts[0].repo, baseBranch: starts[0].baseBranch, name: starts[0].name, setup: starts[0].setup },
    { worktree: 'new-child', repo: `path:${posix(path.resolve('/apps/k'))}`, baseBranch: 'main', name: 'wf-wf-k', setup: 'run' });
  const op = startAgent({ provider: 'claude', model: 'claude-opus-5-5', worktree: path.resolve('/orca/k/wf-wf-k'), repo: 'path:/ignored', name: 'ignored', title: '[Op] x', prompt: 'go', objective: 'x', request: { job: 'op-x' }, io });
  assert.ok(op.ok, JSON.stringify(op));
  assert.equal(starts[1].worktree, path.resolve('/orca/k/wf-wf-k'));
  for (const k of ['repo', 'baseBranch', 'name', 'setup']) assert.equal(starts[1][k], undefined, `an existing worktree takes no --${k}`);
});

test('guardLaunch writes the workflow worktree into an op guard file', async (t) => {
  const { guardLaunch } = await import('../../scripts/guards/hook-install.mjs');
  const { base, app, ctx } = fixture(t);
  const rec = ensureWorkflowWorktree(ctx, { workflowId: 'wf-guard', appRepo: app }).record;
  const skillRoot = path.join(base, 'skill');
  const into = guardLaunch({ skillRoot, jobId: 'op-guarded', workflowId: 'wf-guard', ledgerRepo: app, owned: [path.join(rec.path, 'be', 'src')], repos: [],
    config: { guards: { historyHook: false, workHook: false } }, workflowWorktree: rec.path });
  const guard = JSON.parse(fs.readFileSync(into.receipt.jobFile, 'utf8'));
  assert.equal(guard.workflowWorktree, path.resolve(rec.path));
  assert.equal(guard.workflowId, 'wf-guard');
  const outside = guardLaunch({ skillRoot, jobId: 'op-plain', workflowId: 'wf-none', ledgerRepo: app, owned: [], repos: [], config: { guards: { historyHook: false, workHook: false } } });
  assert.equal(JSON.parse(fs.readFileSync(outside.receipt.jobFile, 'utf8')).workflowWorktree, null, 'no workflow worktree, no field value');
});

test('starci kernel dispatch passes the registered workflow worktree to the guard, and null when there is none', (t) => {
  const { base, app, env, ctx } = fixture(t);
  if (process.env.STARCI_TEST_TEMP_DIR) t.after(() => fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR, 'starci-job-scratch'),
    { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const rec = ensureWorkflowWorktree(ctx, { workflowId: 'wf-dispatch-guard', appRepo: app }).record;
  const fake = path.join(base, 'fake-orca.mjs'), state = path.join(base, 'orca-state.json');
  fs.writeFileSync(fake, FAKE_ORCA);
  const childEnv = { ...env, STARCI_ORCA_COMMAND: process.execPath, STARCI_ORCA_ARGS: JSON.stringify([fake]), STARCI_FAKE_ORCA_MODE: 'healthy',
    STARCI_FAKE_ORCA_LOG: path.join(base, 'orca-calls.jsonl'), STARCI_FAKE_ORCA_STATE: state, LOCALAPPDATA: path.join(base, 'localappdata'),
    STARCI_OWNER_ROOT: path.join(base, 'owner') };
  for (const key of ['ORCA_TERMINAL_HANDLE', 'STARCI_ROLE', 'STARCI_OP_JOB', 'STARCI_GUARD_FILE']) delete childEnv[key];
  const seed = (repo, workflowId, jobId, owned) => {
    const ledger = openLedger({ file: ledgerFileFor(repo) });
    try {
      seedWorkflow(ledger, { id: workflowId, goal: { revision: 1, markdown: '# Dispatch guard' }, jobs: [
        { jobId: `kernel-${workflowId}`, kind: 'kernel', role: 'kernel', status: 'running', workerId: `term-${workflowId}`, payload: {} },
        { jobId, opId: 'code.refactor', status: 'queued', payload: { opId: 'code.refactor', owned_paths: owned } },
      ] });
    } finally { ledger.close(); }
  };
  const dispatch = (repo, jobId) => spawnSync(process.execPath, [API, 'dispatch', '--repo', repo, '--job', jobId, '--model', 'codex-agent', '--spawn', '--json'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180000, env: childEnv });
  const guardOf = (repo, jobId) => {
    const ledger = inspectLedger({ file: ledgerFileFor(repo) });
    try {
      const row = ledger.db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='op-dispatched'").get(jobId);
      const jobFile = JSON.parse(row.payload_json).guard.jobFile;
      return JSON.parse(fs.readFileSync(jobFile, 'utf8'));
    } finally { ledger.close(); }
  };

  const guarded = 'op-code.refactor-guarded';
  seed(app, 'wf-dispatch-guard', guarded, ['be/src/']);
  const inTree = dispatch(app, guarded);
  assert.equal(inTree.status, 0, inTree.stderr || inTree.stdout);
  assert.equal(guardOf(app, guarded).workflowWorktree, path.resolve(rec.path));

  const plain = path.join(base, 'plain');
  fs.mkdirSync(path.join(plain, 'docs'), { recursive: true });
  const unbound = 'op-code.refactor-unbound';
  seed(plain, 'wf-dispatch-no-tree', unbound, ['docs/']);
  const withoutTree = dispatch(plain, unbound);
  assert.equal(withoutTree.status, 0, withoutTree.stderr || withoutTree.stdout);
  assert.equal(guardOf(plain, unbound).workflowWorktree, null);
});
