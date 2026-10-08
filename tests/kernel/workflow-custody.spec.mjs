// A workflow keeps its branch (scripts/kernel/workflow-custody.mjs). The 2026-10-08 shape, with real temporary git
// repositories and the fake Orca: a host restart left a running workflow's tree to the GC, which removed it after preserving
// its uncommitted work (preserved/<id>/gc, one commit above the last checkpoint); the next start created a tree "-2" from
// main, so the Kernel would have worked without its checkpoints. Now the tree comes back at the branch, the preserved work
// is restored as uncommitted work, and a wrong tree already registered is moved onto the branch by the next start.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withMachine } from '../../engine/db/machine.mjs';
import { ensureWorkflowWorktree, registerWorkflowWorktree, setCheckpoint } from '../../scripts/kernel/workflow-worktree.mjs';
import { gcWorktrees } from '../../scripts/machine/worktrees.mjs';
import { workflowWorktreeOf } from '../../scripts/machine/workflow-tree.mjs';
import { fakeOrcaWorktrees } from '../helpers/fake-orca-worktrees.mjs';

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const refSha = (cwd, ref) => spawnSync('git', ['rev-parse', '--verify', '--quiet', `refs/heads/${ref}`], { cwd, encoding: 'utf8' }).stdout.trim() || null;
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const WF = 'wf-keep-one';
const BRANCH = `wf-${WF}`;
const LEDGER = 'ledger-1';
const startArgs = (app) => ({ workflowId: WF, appRepo: app, ledgerId: LEDGER });

function fixture(t) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-custody-')));
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
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite') };
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
  return { app, env, orca, ctx: { env, orca } };
}

/** A workflow with two checkpoints and uncommitted work (a change, a new file, a deletion), then collected by the real GC (preserved/<id>/gc). */
function collectedWorkflow(t, { branchSurvives = true } = {}) {
  const world = fixture(t);
  const { app, env, orca, ctx } = world;
  const first = ensureWorkflowWorktree(ctx, startArgs(app));
  assert.ok(first.ok && first.created, JSON.stringify(first));
  const dir = first.record.path;
  for (const n of [1, 2]) {
    write(dir, `be/src/step${n}.ts`, `export const step${n} = ${n};\n`);
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', `checkpoint ${n}`);
    setCheckpoint(ctx, WF, git(dir, 'rev-parse', 'HEAD'));
  }
  const checkpoint = git(dir, 'rev-parse', 'HEAD');
  write(dir, 'fe/src/page.tsx', 'export const fe = 2;\n');
  write(dir, 'be/src/new.ts', 'export const added = 1;\n');
  fs.rmSync(path.join(dir, 'be/src/main.ts'));
  const lookup = Object.assign(() => null, { workflowPhase: () => 'stopped' });
  const items = gcWorktrees({ env, repos: [app], jobStatusOf: lookup, orca });
  const item = items.find((i) => i.path && path.resolve(i.path) === dir);
  assert.deepEqual([item?.ok, item?.preserved], [true, `refs/heads/preserved/${WF}/gc`], JSON.stringify(items));
  assert.ok(!fs.existsSync(dir));
  if (branchSurvives) git(app, 'branch', '-f', BRANCH, checkpoint); // the real case: the removal left the branch (dir-remains)
  else assert.equal(refSha(app, BRANCH), null, 'the GC deleted the abandoned branch with its tree');
  const preserved = refSha(app, `preserved/${WF}/gc`);
  assert.notEqual(preserved, checkpoint, 'the preserved commit holds the uncommitted work above the checkpoint');
  orca.calls.length = 0;
  return { ...world, checkpoint, preserved };
}

/** The wrong tree the old code made: Orca cuts it from main (branch -2) and the registry takes it. */
function wrongTree({ app, env, orca }) {
  const made = orca.create({ repo: `path:${app}`, name: `wf-${WF}`, baseBranch: 'main', setup: 'skip', comment: '' });
  const w = made.worktree;
  registerWorkflowWorktree({ env }, { workflowId: WF, orcaWorktreeId: w.id, path: w.path, branch: w.branch, ledgerId: LEDGER });
  return w;
}

const dirtOf = (dir) => git(dir, 'status', '--porcelain').split(/\r?\n/).map((l) => l.trim()).filter(Boolean).sort();
const DIRT = ['?? be/src/new.ts', 'D be/src/main.ts', 'M fe/src/page.tsx'];

test('a lost tree comes back at the workflow branch, not at main, with the preserved work restored as uncommitted work', (t) => {
  const { app, ctx, orca, checkpoint, preserved } = collectedWorkflow(t);
  const made = ensureWorkflowWorktree(ctx, startArgs(app));
  assert.ok(made.ok && made.created, JSON.stringify(made));
  assert.equal(orca.calls[0][1].baseBranch, BRANCH, 'Orca cuts the new tree at the workflow branch, never main');
  const { record } = made;
  assert.equal(record.branch, `${BRANCH}-2`);
  assert.equal(git(record.path, 'rev-parse', 'HEAD'), checkpoint, 'HEAD is the last checkpoint: the checkpoint chain holds');
  assert.equal(record.checkpoint, checkpoint);
  assert.equal(workflowWorktreeOf(ctx, WF).checkpoint, checkpoint);
  assert.deepEqual(dirtOf(record.path), DIRT);
  assert.equal(fs.readFileSync(path.join(record.path, 'fe/src/page.tsx'), 'utf8'), 'export const fe = 2;\n');
  assert.equal(refSha(app, `preserved/${WF}/gc`), null, 'the collector\'s ref is retired once restored');
  assert.equal(refSha(app, `preserved/${WF}/restored-${preserved.slice(0, 12)}`), preserved, 'its content stays reachable under the restored name');
  assert.equal(refSha(app, BRANCH), checkpoint, 'the old branch is untouched');
  const again = ensureWorkflowWorktree(ctx, startArgs(app));
  assert.deepEqual([again.ok, again.created, again.repaired], [true, false, undefined], 'a second start restores nothing twice');
  assert.deepEqual(dirtOf(record.path), DIRT);
});

test('a tree already registered from main (the wrong -2 tree) is moved onto the branch by the next start, its own work preserved', (t) => {
  const world = collectedWorkflow(t);
  const { app, ctx, checkpoint, preserved } = world;
  const wrong = wrongTree(world);
  assert.equal(wrong.branch, `${BRANCH}-2`);
  const main = git(app, 'rev-parse', 'main');
  write(wrong.path, 'notes/from-the-kernel.md', 'a note written in the wrong tree\n');
  const fixed = ensureWorkflowWorktree(ctx, startArgs(app));
  assert.ok(fixed.ok && !fixed.created, JSON.stringify(fixed));
  assert.deepEqual([fixed.repaired.from, fixed.repaired.to, fixed.repaired.wrongTree], [main, preserved, `refs/heads/preserved/${WF}/wrong-tree`]);
  assert.equal(path.resolve(fixed.record.path), path.resolve(wrong.path), 'the registration keeps its tree');
  assert.equal(git(fixed.record.path, 'rev-parse', 'HEAD'), checkpoint);
  assert.equal(fixed.record.checkpoint, checkpoint);
  assert.deepEqual(dirtOf(fixed.record.path), ['?? notes/', ...DIRT].sort());
  const kept = refSha(app, `preserved/${WF}/wrong-tree`);
  assert.equal(git(app, 'show', `${kept}:notes/from-the-kernel.md`), 'a note written in the wrong tree', 'the wrong tree\'s own work is preserved');
  assert.equal(refSha(app, BRANCH), checkpoint);
  assert.ok(fs.existsSync(wrong.path), 'nothing was deleted');
});

test('the GC deleted the branch with the tree: the preserved ref is the whole chain, the registry checkpoint stays the checkpoint', (t) => {
  const { app, ctx, orca, checkpoint, preserved } = collectedWorkflow(t, { branchSurvives: false });
  const made = ensureWorkflowWorktree(ctx, startArgs(app));
  assert.ok(made.ok && made.created, JSON.stringify(made));
  assert.equal(orca.calls[0][1].baseBranch, `preserved/${WF}/gc`);
  assert.equal(git(made.record.path, 'rev-parse', 'HEAD'), checkpoint, 'the uncommitted work is not folded into a checkpoint');
  assert.equal(made.record.checkpoint, checkpoint);
  assert.deepEqual(dirtOf(made.record.path), DIRT);
  assert.equal(refSha(app, `preserved/${WF}/restored-${preserved.slice(0, 12)}`), preserved);
});

test('a collected tree with nothing uncommitted (preserved ref equals the branch) is restored with nothing to put back', (t) => {
  const { app, ctx, checkpoint } = collectedWorkflow(t);
  git(app, 'update-ref', `refs/heads/preserved/${WF}/gc`, checkpoint);
  const made = ensureWorkflowWorktree(ctx, startArgs(app));
  assert.ok(made.ok && made.created, JSON.stringify(made));
  assert.equal(git(made.record.path, 'rev-parse', 'HEAD'), checkpoint);
  assert.deepEqual(dirtOf(made.record.path), []);
  assert.equal(refSha(app, `preserved/${WF}/gc`), checkpoint, 'a ref that adds nothing is left as it is');
});

test('refs that do not form one chain are refused typed, with no tree made and nothing moved', (t) => {
  const { app, ctx, orca, checkpoint } = collectedWorkflow(t);
  const main = git(app, 'rev-parse', 'main');
  const stray = git(app, 'commit-tree', `${main}^{tree}`, '-p', main, '-m', 'stray');
  git(app, 'update-ref', `refs/heads/preserved/${WF}/gc`, stray);
  const refused = ensureWorkflowWorktree(ctx, startArgs(app));
  assert.deepEqual([refused.ok, refused.reason], [false, 'workflow-custody-diverged'], JSON.stringify(refused));
  assert.match(refused.detail, new RegExp(BRANCH));
  assert.deepEqual(orca.names(), [], 'Orca is not asked for a tree');
  assert.equal(refSha(app, BRANCH), checkpoint);
  assert.equal(refSha(app, `preserved/${WF}/gc`), stray);
});

test('a registered tree holding commits of its own is refused diverged and left as it is', (t) => {
  const world = collectedWorkflow(t);
  const wrong = wrongTree(world);
  write(wrong.path, 'own.txt', 'own\n');
  git(wrong.path, 'add', '-A');
  git(wrong.path, 'commit', '-q', '-m', 'own commit');
  const own = git(wrong.path, 'rev-parse', 'HEAD');
  const refused = ensureWorkflowWorktree(world.ctx, startArgs(world.app));
  assert.deepEqual([refused.ok, refused.reason], [false, 'workflow-custody-diverged'], JSON.stringify(refused));
  assert.equal(git(wrong.path, 'rev-parse', 'HEAD'), own);
});

test('a registered tree that cannot fast-forward (an untracked file in the way) is refused conflict; both sides stay', (t) => {
  const world = collectedWorkflow(t);
  const { app, ctx, env, preserved } = world;
  const wrong = wrongTree(world);
  write(wrong.path, 'be/src/step1.ts', 'a different file in the way\n');
  const refused = ensureWorkflowWorktree(ctx, startArgs(app));
  assert.deepEqual([refused.ok, refused.reason], [false, 'workflow-custody-conflict'], JSON.stringify(refused));
  assert.equal(fs.readFileSync(path.join(wrong.path, 'be/src/step1.ts'), 'utf8'), 'a different file in the way\n');
  assert.equal(refSha(app, `preserved/${WF}/gc`), preserved, 'the collector\'s ref is not retired');
  assert.ok(refSha(app, `preserved/${WF}/wrong-tree`), 'the tree\'s own work is preserved');
  const live = withMachine((m) => m.db.prepare('SELECT COUNT(*) AS n FROM worktrees WHERE workflow_id=? AND removed_at IS NULL').get(WF).n, { env });
  assert.equal(live, 1);
});

const CLI = path.resolve(import.meta.dirname, '..', '..', 'scripts', 'kernel', 'workflow-custody-cli.mjs');
const custodyCli = (world, ...args) => {
  const env = { ...world.env, STARCI_PROJECTS_ROOT: path.join(path.dirname(world.app), 'projects'), STARCI_LOCAL_ROOT: path.join(path.dirname(world.app), 'local') };
  const r = spawnSync(process.execPath, [CLI, '--workflow', WF, '--repo', world.app, '--json', ...args], { cwd: world.app, env, encoding: 'utf8', windowsHide: true });
  return { status: r.status, out: JSON.parse(r.stdout.trim().split(/\r?\n/).at(-1) || '{}'), stderr: r.stderr };
};

test('starci workflow custody reads the state without writing, and --apply puts the wrong tree onto the branch', (t) => {
  const world = collectedWorkflow(t);
  const wrong = wrongTree(world);
  const before = git(wrong.path, 'rev-parse', 'HEAD');
  const plan = custodyCli(world);
  assert.deepEqual([plan.status, plan.out.state, plan.out.tree.head], [0, 'behind', before], JSON.stringify(plan));
  assert.equal(plan.out.custody.branchTip.sha, world.checkpoint);
  assert.equal(git(wrong.path, 'rev-parse', 'HEAD'), before, 'the plan wrote nothing');
  const applied = custodyCli(world, '--apply');
  assert.deepEqual([applied.status, applied.out.applied, applied.out.state], [0, true, 'attached'], JSON.stringify(applied));
  assert.equal(git(wrong.path, 'rev-parse', 'HEAD'), world.checkpoint);
  assert.deepEqual(dirtOf(wrong.path), DIRT);
  assert.equal(custodyCli(world).out.state, 'attached');
});

test('starci workflow custody refuses a diverged chain with the typed code and exit 1', (t) => {
  const world = collectedWorkflow(t);
  const main = git(world.app, 'rev-parse', 'main');
  git(world.app, 'update-ref', `refs/heads/preserved/${WF}/gc`, git(world.app, 'commit-tree', `${main}^{tree}`, '-p', main, '-m', 'stray'));
  const refused = custodyCli(world, '--apply');
  assert.deepEqual([refused.status, refused.out.ok, refused.out.reason], [1, false, 'workflow-custody-diverged'], JSON.stringify(refused));
});
