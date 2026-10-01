// The runtime owns the worktree lifecycle (owner order lane WT, 2026-10-01: 600+ orphan worktrees had piled up; the
// .claude incident: a cleanup that listed links with `dir /AL /S` and deleted with robocopy /MIR followed lane junctions
// into the main checkout and deleted 490 tracked files). scripts/lib/worktrees.mjs is the one home: an agent's workspace
// (the workflow worktree, the critic) is created and removed by Orca (tests/workflow-worktree.spec.mjs), a runtime
// scratch tree by createScratchWorktree, the GC reclaims whatever outlives its owner through the home that made it, and
// every git removal goes through scripts/lib/safe-remove.mjs safeRemoveWorktree: links found without following one,
// removed as links, zero asserted, only then `git worktree remove`, and the main checkout asserted untouched. The per-op
// land (integrateOp, the reap) is exercised on a tree the spec makes itself until part B deletes it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { openLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { withMachine } from '../engine/machine-db.mjs';
import { integrateOp, reapJobWorktree, productSettings, preservedOpRef, EVENTS } from '../scripts/kernel/product-worktree.mjs';
import { evaluateCondition } from '../scripts/kernel/gate-conditions.mjs';
import { createScratchWorktree, removeScratchWorktree, gcWorktrees, worktreeCounts, worktreesRootOf, snapshotCommit, reserveOrcaSlot } from '../scripts/lib/worktrees.mjs';
import { ensureWorkflowWorktree } from '../scripts/kernel/workflow-worktree.mjs';
import { fakeOrcaWorktrees } from './helpers/fake-orca-worktrees.mjs';
import { linksUnder, mainCheckoutDamage } from '../scripts/lib/safe-remove.mjs';
import { scanWorktreeAdd, strayLines } from '../scripts/checks/check-worktree-add.mjs';
import { collectLanes, readLaneCursor, writeLaneCursor } from '../scripts/supervisor/gc.mjs';
import { createGcController } from '../scripts/reconciler/controllers/gc.mjs';
import { fakeCtx } from '../scripts/reconciler/testing.mjs';

const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const LINK = process.platform === 'win32' ? 'junction' : 'dir';
const WF = 'wf-nivo-fe-lifecycle-k2';
const HOUR = 3_600_000;

const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const gitOk = (cwd, ...args) => spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true }).status === 0;
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const branches = (repo, pattern) => git(repo, 'branch', '--list', pattern).split(/\r?\n/).map((l) => l.replace(/^[*+ ]+/, '').trim()).filter(Boolean);
const trees = (repo) => git(repo, 'worktree', 'list', '--porcelain').split(/\r?\n/).filter((l) => l.startsWith('worktree ')).length;

/** A product repo on main with a bare origin, and a machine registry of its own (no row of another spec is seen). */
function fixture(t, name = 'nivo-fe') {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wt-life-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, name);
  const origin = path.join(base, `${name}.git`);
  fs.mkdirSync(repo);
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'spec@starci.test');
  git(repo, 'config', 'user.name', 'spec');
  git(repo, 'config', 'core.autocrlf', 'false');
  write(repo, '.gitignore', 'node_modules/\n');
  write(repo, 'src/a.ts', 'export const a = 1;\n');
  write(repo, 'src/b.ts', 'export const b = 1;\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', 'origin', 'main');
  const env = { ...process.env, STARCI_TEST_MACHINE_FILE: path.join(base, 'machine.sqlite') };
  return { base, repo, origin, env };
}

/** A ledger holding one settled isolated op job (status `status`) with the given product worktree record. */
function ledgerWith(t, base, record, jobId, status) {
  const ledgerRepo = path.join(base, 'ledger-repo');
  fs.mkdirSync(ledgerRepo, { recursive: true });
  const ledger = openLedger({ file: ledgerFileFor(ledgerRepo) });
  t.after(() => { try { ledger.close(); } catch { /* closed */ } });
  ledger.ensureWorkflow({ workflowId: WF, title: 'lifecycle' });
  ledger.write.createUnit({ workflowId: WF, unitId: jobId, opId: 'code.refactor', subjectKey: jobId, goalRevision: 1 });
  ledger.enqueueJob({ jobId, workflowId: WF, unitId: jobId, opId: 'code.refactor', kind: 'op',
    payload: { opId: 'code.refactor', productWorktree: record, terminalClosed: { ok: true, verified: { ok: true, proof: 'spec' } } } });
  const now = Date.now();
  for (const s of ['ready', 'leased', 'running', 'reported', status]) ledger.db.prepare('UPDATE jobs SET status=?, updated_at=? WHERE job_id=?').run(s, now, jobId);
  return { ledger, ledgerRepo, now };
}
const liveRows = (env) => withMachine((m) => m.liveWorktrees(), { env });
/** The per-op tree the per-op land (part B's, until it is deleted) works on, made by the spec: <repo>/.starciwork/worktrees/<short> on op/<short>. */
function opTree(repo, jobId) {
  const short = jobId.split('-').pop().slice(-8);
  const dir = path.join(worktreesRootOf(repo), short);
  const branch = `op/${short}`;
  const baseSha = git(repo, 'rev-parse', 'main');
  fs.mkdirSync(path.dirname(dir), { recursive: true });
  git(repo, 'worktree', 'add', '-q', '-b', branch, dir, baseSha);
  git(repo, 'config', `branch.${branch}.description`, jobId);
  return { repoRoot: repo, workflowId: WF, jobId, main: 'main', op: { short, branch, path: dir }, baseSha, createdAt: Date.now() };
}
const green = () => ({ exit: 0, findings: [], errors: [], counts: { new: 0 } });

test('an op settles: rebased onto main, gated, main fast-forwarded and pushed; then no worktree and no branch are left', (t) => {
  const { base, repo, origin, env } = fixture(t);
  const jobId = 'op-code.refactor-a1b2c3d4e5';
  const rec = opTree(repo, jobId);
  write(rec.op.path, 'src/a.ts', 'export const a = 2;\n');
  git(rec.op.path, 'commit', '-qam', 'op: a = 2');
  // main moved meanwhile (another op landed): the land rebases, main's change is kept.
  write(repo, 'src/b.ts', 'export const b = 2;\n');
  git(repo, 'commit', '-qam', 'main: b = 2');
  const mainBefore = git(repo, 'rev-parse', 'main');
  // A red gate lands nothing.
  const red = integrateOp({ record: rec, gate: () => ({ exit: 1, findings: [{ engine: 'lint', rule: 'x' }], errors: [], counts: { new: 1 } }) });
  assert.equal(red.ok, false);
  assert.equal(red.reason, 'land-gate-red');
  assert.equal(git(repo, 'rev-parse', 'main'), mainBefore, 'main untouched by a red gate');
  const gates = [];
  const landed = integrateOp({ record: rec, gate: (g) => { gates.push(g); return green(); } });
  assert.ok(landed.ok, JSON.stringify(landed));
  assert.equal(gates.length, 1);
  assert.equal(gates[0].root, rec.op.path, 'the gate runs on the op worktree');
  assert.equal(gates[0].base, mainBefore, 'against the main it lands on');
  assert.equal(git(repo, 'rev-parse', 'main'), landed.after, 'main advanced');
  assert.ok(gitOk(repo, 'merge-base', '--is-ancestor', mainBefore, 'main'), 'a fast-forward of main');
  assert.equal(fs.readFileSync(path.join(repo, 'src/a.ts'), 'utf8'), 'export const a = 2;\n', 'the live checkout carries the op');
  assert.equal(fs.readFileSync(path.join(repo, 'src/b.ts'), 'utf8'), 'export const b = 2;\n', 'main\'s own change is kept');
  assert.equal(landed.push.pushed, true, JSON.stringify(landed.push));
  assert.equal(git(origin, 'rev-parse', 'main'), landed.after, 'origin/main pushed');
  assert.equal(integrateOp({ record: rec, gate: green }).already, true, 'idempotent');
  // The settle releases the worker, then the reap removes the tree and the branch.
  const { ledger, ledgerRepo, now } = ledgerWith(t, base, rec, jobId, 'succeeded');
  const r = reapJobWorktree({ ledger, ledgerRepo, jobId, now: now + 1000, env });
  assert.equal(r.removed, true, JSON.stringify(r));
  assert.equal(r.preserved, null, 'a landed op preserves nothing');
  assert.ok(!fs.existsSync(rec.op.path), 'no worktree');
  assert.equal(trees(repo), 1, 'only the main checkout is registered');
  assert.deepEqual(branches(repo, 'op/*'), [], 'no op branch');
  assert.deepEqual(branches(repo, 'preserved/*'), []);
  assert.equal(liveRows(env).length, 0, 'the registry row is removed');
  assert.equal(git(repo, 'status', '--porcelain'), '', 'the product checkout is clean');
});

test('the land refuses before main moves: a merge that dropped main\'s change, a red pre-land verify, a dirty op tree', (t) => {
  const { repo } = fixture(t);
  const base = productSettings();
  // 1. a merge on the op branch that kept the lane side over main's change of src/b.ts.
  const rec = opTree(repo, 'op-code.refactor-9e1d000001');
  write(rec.op.path, 'src/b.ts', 'export const b = "lane";\n');
  git(rec.op.path, 'commit', '-qam', 'lane: b');
  write(repo, 'src/b.ts', 'export const b = "main";\n');
  git(repo, 'commit', '-qam', 'main: b');
  spawnSync('git', ['merge', 'main'], { cwd: rec.op.path, encoding: 'utf8' });
  write(rec.op.path, 'src/b.ts', 'export const b = "lane";\n');
  git(rec.op.path, 'commit', '-qam', 'merge main, keep lane');
  const mainBefore = git(repo, 'rev-parse', 'main');
  const dropped = integrateOp({ record: rec, gate: green });
  assert.equal(dropped.reason, 'land-merge-dropped-main', JSON.stringify(dropped));
  assert.deepEqual(dropped.dropped, ['src/b.ts']);
  assert.equal(git(repo, 'rev-parse', 'main'), mainBefore, 'main untouched');
  // 2. a land check red on the rebased tree: product-integrate-red with a continuation; the op tree is back on its head.
  const two = opTree(repo, 'op-code.refactor-9e1d000002');
  write(two.op.path, 'src/c.ts', 'export const c = 1;\n');
  git(two.op.path, 'add', '-A'); git(two.op.path, 'commit', '-qm', 'c');
  const own = git(two.op.path, 'rev-parse', 'HEAD');
  write(repo, 'src/a.ts', 'export const a = 3;\n');
  git(repo, 'commit', '-qam', 'main: a = 3');
  const mainTwo = git(repo, 'rev-parse', 'main');
  const redSettings = { ...base, land: { ...base.land, push: false, checks: [{ name: 'always-red', argv: [process.execPath, '-e', 'process.exit(1)'] }] } };
  const red = integrateOp({ record: two, gate: green, settings: redSettings });
  assert.equal(red.reason, 'product-integrate-red', JSON.stringify(red));
  assert.match(red.failures.join(' '), /always-red/);
  assert.equal(red.continuation.resumeFrom, own);
  assert.equal(git(two.op.path, 'rev-parse', 'HEAD'), own, 'the op worktree is put back on its own head');
  assert.equal(git(repo, 'rev-parse', 'main'), mainTwo, 'main untouched');
  // 3. a tracked change left in the op tree: op-worktree-dirty, nothing rebased.
  write(two.op.path, 'src/c.ts', 'export const c = 2;\n');
  assert.equal(integrateOp({ record: two, gate: green, settings: redSettings }).reason, 'op-worktree-dirty');
});

test('snapshotCommit preserves tracked and untracked work and never a node_modules entry', (t) => {
  const { repo } = fixture(t);
  const rec = opTree(repo, 'op-code.refactor-5aa0000001');
  write(rec.op.path, 'src/a.ts', 'export const a = 7;\n');
  write(rec.op.path, 'notes/todo.md', 'todo\n');
  fs.mkdirSync(path.join(rec.op.path, 'packages', 'x'), { recursive: true });
  fs.symlinkSync(path.join(repo, 'src'), path.join(rec.op.path, 'packages', 'x', 'node_modules'), LINK);
  const head = git(rec.op.path, 'rev-parse', 'HEAD');
  const snap = snapshotCommit(rec.op.path, head, 'spec snapshot');
  assert.ok(snap.ok && snap.dirty, JSON.stringify(snap));
  const files = git(repo, 'ls-tree', '-r', '--name-only', snap.sha).split(/\r?\n/);
  assert.ok(files.includes('src/a.ts') && files.includes('notes/todo.md'));
  assert.ok(!files.some((f) => f.includes('node_modules')), 'no node_modules entry is ever preserved');
  assert.equal(git(rec.op.path, 'status', '--porcelain', '--', 'src/a.ts'), 'M src/a.ts', 'the worktree index is untouched');
  assert.equal(snapshotCommit(repo, git(repo, 'rev-parse', 'HEAD'), 'clean').dirty, false);
});

test('a per-op product-op-landed event is what --until-landed reads', (t) => {
  const { base, repo } = fixture(t);
  const ledgerRepo = path.join(base, 'ledger-ev');
  fs.mkdirSync(ledgerRepo);
  const ledger = openLedger({ file: ledgerFileFor(ledgerRepo) });
  t.after(() => { try { ledger.close(); } catch { /* closed */ } });
  ledger.ensureWorkflow({ workflowId: WF, title: 'landed' });
  const cond = { type: 'landed', workflowId: WF, repository: path.basename(repo) };
  assert.equal(evaluateCondition(ledger.db, cond, { repo: ledgerRepo, workflowId: 'wf-other' }).met, false);
  assert.equal(EVENTS.landed, 'product-op-landed');
  ledger.transaction(() => ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: 'op-x', kind: EVENTS.landed, payload: { repoRoot: repo, branch: 'main', head: 'abc' } }));
  assert.equal(evaluateCondition(ledger.db, cond, { repo: ledgerRepo, workflowId: 'wf-other' }).met, true);
});

test('a failed op: its uncommitted work is preserved to preserved/<job>, and its worktree and branch are removed', (t) => {
  const { base, repo, env } = fixture(t);
  const jobId = 'op-code.refactor-f00dfeed01';
  const rec = opTree(repo, jobId);
  write(rec.op.path, 'src/a.ts', 'export const a = 99;\n');
  write(rec.op.path, 'src/new.ts', 'export const fresh = true;\n');
  const { ledger, ledgerRepo, now } = ledgerWith(t, base, rec, jobId, 'failed');
  const r = reapJobWorktree({ ledger, ledgerRepo, jobId, now: now + 1000, env });
  assert.equal(r.removed, true, JSON.stringify(r));
  assert.equal(r.preserved?.ref, `refs/heads/preserved/${jobId}`);
  assert.equal(git(repo, 'show', `preserved/${jobId}:src/a.ts`), 'export const a = 99;', 'the tracked change is preserved');
  assert.equal(git(repo, 'show', `preserved/${jobId}:src/new.ts`), 'export const fresh = true;', 'the untracked file is preserved');
  assert.equal(preservedOpRef(repo, jobId)?.sha, git(repo, 'rev-parse', `preserved/${jobId}`));
  assert.ok(!fs.existsSync(rec.op.path), 'the worktree is removed all the same');
  assert.deepEqual(branches(repo, 'op/*'), []);
  assert.equal(trees(repo), 1);
  assert.equal(git(repo, 'rev-parse', 'main'), git(repo, 'rev-parse', `preserved/${jobId}~1`), 'main untouched');
  assert.equal(liveRows(env).length, 0);
});

test('the GC reclaims orphans: an ended workflow\'s tree (through Orca), an unregistered tree, a scratch whose owner is gone, a slot never bound', (t) => {
  const { base, repo, env } = fixture(t);
  const orca = fakeOrcaWorktrees({ root: path.join(base, 'orca') });
  const now = Date.now() + 2 * HOUR;
  // 1. the workflow worktree of a workflow that finished: preserved, removed through Orca.
  const ended = ensureWorkflowWorktree({ env, orca }, { workflowId: 'wf-nivo-fe-ended-1a', appRepo: repo }).record;
  write(ended.path, 'src/wip.ts', 'export const wip = 1;\n');
  // 2. a tree under the worktrees root the registry never knew (made before the registry, or by a crashed run).
  const orphan = path.join(worktreesRootOf(repo), 'legacy', '_wf');
  fs.mkdirSync(path.dirname(orphan), { recursive: true });
  git(repo, 'worktree', 'add', '-q', '-b', 'wf/legacy', orphan, 'main');
  git(repo, 'config', 'branch.wf/legacy.description', 'wf-nivo-fe-legacy-9z');
  write(orphan, 'src/unlanded.ts', 'export const u = 1;\n');
  git(orphan, 'add', '-A'); git(orphan, 'commit', '-qm', 'unlanded work');
  // 3. a land scratch whose creating process is gone.
  const scratch = path.join(worktreesRootOf(repo), 'scratch-dead');
  assert.ok(createScratchWorktree({ repoRoot: repo, dir: scratch, kind: 'land-scratch', detach: true, base: 'main', ownerPid: 2 ** 22 + 12345, env }).ok);
  // 4. a running workflow keeps its tree.
  const live = ensureWorkflowWorktree({ env, orca }, { workflowId: 'wf-nivo-fe-live-2b', appRepo: repo }).record;
  // 5. an Orca slot whose creator died before Orca answered.
  const slot = reserveOrcaSlot({ repoRoot: repo, kind: 'workflow', slotKey: 'wf-crashed', owner: { workflowId: 'wf-crashed' }, env });
  assert.ok(slot.ok);
  withMachine((m) => m.db.prepare('UPDATE worktrees SET created_at=? WHERE path=?').run(1, slot.pending), { env });
  const phase = { 'wf-nivo-fe-ended-1a': 'finished', 'wf-nivo-fe-live-2b': 'running' };
  const lookup = Object.assign(() => null, { workflowPhase: (_, id) => phase[id] ?? null });
  const items = gcWorktrees({ env, now, repos: [repo], jobStatusOf: lookup, ownerAlive: () => false, orca });
  const by = (p) => items.find((i) => i.path && path.resolve(i.path) === path.resolve(p));
  assert.equal(by(ended.path)?.reason, 'owner-settled', JSON.stringify(items));
  assert.equal(by(ended.path)?.home, 'orca');
  assert.equal(by(ended.path)?.ok, true);
  assert.equal(by(ended.path)?.preserved, 'refs/heads/preserved/wf-nivo-fe-ended-1a/gc');
  assert.ok(orca.calls.some(([verb, a]) => verb === 'remove' && a.worktree === `id:${ended.orcaWorktreeId}`), 'Orca removed it');
  assert.equal(by(orphan)?.reason, 'orphan');
  assert.equal(by(orphan)?.ok, true);
  assert.equal(by(orphan)?.preserved, 'refs/heads/preserved/wf-nivo-fe-legacy-9z', 'the unlanded commit is preserved');
  assert.equal(git(repo, 'show', 'preserved/wf-nivo-fe-legacy-9z:src/unlanded.ts'), 'export const u = 1;');
  assert.equal(by(scratch)?.reason, 'owner-gone');
  assert.equal(by(scratch)?.home, 'git');
  assert.equal(by(slot.pending)?.reason, 'slot-never-bound');
  assert.equal(by(live.path), undefined, 'a running workflow is never collected');
  for (const p of [ended.path, orphan, scratch]) assert.ok(!fs.existsSync(p), `${p} removed`);
  assert.ok(!fs.existsSync(path.dirname(orphan)), 'the empty legacy <wf> directory goes too');
  assert.ok(fs.existsSync(live.path));
  assert.deepEqual(branches(repo, 'wf/legacy'), []);
  assert.equal(trees(repo), 2, 'main + the live workflow');
  const counts = worktreeCounts({ env, repos: [repo], now }).find((c) => c.repoRoot === repo);
  assert.deepEqual({ live: counts.live, cap: counts.cap, orphans: counts.orphans.length, over: counts.over }, { live: 1, cap: 10, orphans: 0, over: false });
});

test('the ban check fires on a stray `git worktree add` and on nothing else', (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wt-ban-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const files = {
    'scripts/stray.mjs': "const r = git(['worktree', 'add', '--detach', dir, base], { cwd: root });\n",
    'scripts/shell.mjs': 'execSync(`git -C ${repo} worktree add ${dir} main`);\n',
    'scripts/tool.ps1': 'git worktree add $dir main\n',
    'scripts/message.mjs': "return { ok: false, error: added.stderr || 'git worktree add failed' };\n",
    'scripts/prose.mjs': "const rule = 'never create a worktree (git worktree add, mklink): report a need';\n// git(['worktree', 'add', x]) in a comment\n",
    'scripts/lib/worktrees.mjs': "export function createScratchWorktree() {\n  run(['worktree', 'add', target, branch]);\n}\nexport function createOrcaWorktree() {\n  run(['worktree', 'add', target, branch]);\n}\n",
    'tests/fixture.spec.mjs': "git(root, 'worktree', 'add', lane);\ngit(['worktree', 'add', lane]);\n",
  };
  for (const [rel, text] of Object.entries(files)) write(root, rel, text);
  const r = scanWorktreeAdd(root, { files: Object.keys(files) });
  assert.equal(r.ok, false);
  assert.deepEqual(r.hits.map((h) => h.file).sort(), ['scripts/lib/worktrees.mjs', 'scripts/shell.mjs', 'scripts/stray.mjs', 'scripts/tool.ps1']);
  assert.deepEqual(r.hits.filter((h) => h.file === 'scripts/lib/worktrees.mjs').map((h) => h.line), [5], 'the worktree API itself: only its one home may hold the invocation');
  assert.deepEqual(strayLines("git(repoRoot, ['worktree',\t'add', dir])"), [{ line: 1, text: "git(repoRoot, ['worktree',\t'add', dir])" }]);
  const live = scanWorktreeAdd(SKILL_ROOT);
  assert.equal(live.ok, true, `the runtime itself is clean: ${JSON.stringify(live.hits.slice(0, 3))}`);
});

/** Every file under `root` (links reported, never followed) -> sha256; a stable picture of a tree. */
function picture(root) {
  const out = {};
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name), rel = path.relative(root, p).replace(/\\/g, '/');
      if (rel === '.git' || rel.startsWith('.git/')) continue;
      const st = fs.lstatSync(p);
      let link = st.isSymbolicLink();
      if (!link && st.isDirectory()) { try { fs.readlinkSync(p); link = true; } catch { link = false; } }
      if (link) { out[rel] = `link->${path.resolve(path.dirname(p), fs.readlinkSync(p))}`; continue; }
      if (st.isDirectory()) walk(p);
      else out[rel] = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
    }
  };
  walk(root);
  return out;
}

test('a worktree with nested junctions into a fake main is removed and the fake main stays byte-identical', (t) => {
  const { base, repo: main, env } = fixture(t, 'dot-claude');
  write(main, 'packages/eslint/be/index.mjs', 'export default "be";\n');
  write(main, 'packages/eslint/fe/index.mjs', 'export default "fe";\n');
  git(main, 'add', '-A'); git(main, 'commit', '-qm', 'eslint packages');
  write(main, 'node_modules/dep/index.js', 'module.exports = 1;\n');
  write(main, 'packages/node_modules/shared/index.js', 'module.exports = 2;\n');
  // main's own internal link: the kind `dir /AL /S` from inside a lane listed through a junction and deleted.
  fs.symlinkSync(path.join(main, 'packages', 'eslint', 'be'), path.join(main, 'node_modules', 'eslint-be'), LINK);
  const lane = path.join(base, 'lanes', 'wt');
  assert.ok(createScratchWorktree({ repoRoot: main, dir: lane, kind: 'lane', branch: 'lane/wt', newBranch: true, base: 'main', owner: { lane: 'wt' }, env }).ok);
  fs.symlinkSync(path.join(main, 'node_modules'), path.join(lane, 'node_modules'), LINK);
  fs.symlinkSync(path.join(main, 'packages', 'node_modules'), path.join(lane, 'packages', 'node_modules'), LINK);
  fs.mkdirSync(path.join(lane, 'deep', 'a'), { recursive: true });
  fs.symlinkSync(path.join(main, 'packages'), path.join(lane, 'deep', 'a', 'packages'), LINK);
  write(lane, 'scratch.txt', 'lane work\n');
  const found = linksUnder(lane).map((p) => path.relative(lane, p).replace(/\\/g, '/')).sort();
  assert.deepEqual(found, ['deep/a/packages', 'node_modules', 'packages/node_modules'], 'the lane\'s own links only, none of main\'s behind them');
  const before = picture(main);
  assert.ok(Object.keys(before).includes('node_modules/eslint-be'));
  const r = removeScratchWorktree({ repoRoot: main, dir: lane, branch: 'lane/wt', deleteBranch: 'force', env });
  assert.ok(r.ok, JSON.stringify(r));
  assert.equal(r.links, 3);
  assert.ok(!fs.existsSync(lane));
  assert.deepEqual(picture(main), before, 'the main checkout is byte-identical, its own link included');
  assert.equal(git(main, 'status', '--porcelain', '--untracked-files=no'), '', 'no tracked deletion in main');
  assert.equal(trees(main), 1);
});

test('a removal that changes the main checkout stops the GC, and it stays stopped until resumed', (t) => {
  const { repo, env } = fixture(t);
  const dead = 2 ** 22 + 12345;
  const later = Date.now() + 2 * HOUR;
  const one = path.join(worktreesRootOf(repo), 'bad1');
  for (const dir of [one, path.join(worktreesRootOf(repo), 'bad2')]) assert.ok(createScratchWorktree({ repoRoot: repo, dir, kind: 'land-scratch', detach: true, base: 'main', ownerPid: dead, env }).ok);
  // A git whose worktree removal also deletes a tracked file of main: the damage the guard must catch.
  const hostile = (args, opts) => {
    const r = spawnSync('git', args, { cwd: opts?.cwd, encoding: 'utf8', windowsHide: true, env: opts?.env ?? process.env });
    if (args[0] === 'worktree' && args[1] === 'remove') fs.rmSync(path.join(repo, 'src', 'b.ts'));
    return r;
  };
  const items = gcWorktrees({ env, now: later, repos: [repo], ownerAlive: () => false, git: hostile });
  const bad = items.find((i) => i.fatal);
  assert.ok(bad, JSON.stringify(items));
  assert.match(bad.damage.join(' '), /tracked file deleted: src\/b\.ts/);
  assert.equal(items.at(-1).action, 'stopped');
  assert.equal(items.filter((i) => i.action === 'remove').length, 1, 'nothing after the violation is touched');
  assert.equal(withMachine((m) => m.worktreeGcStop(), { env }).path, bad.path);
  const next = gcWorktrees({ env, now: later, repos: [repo], ownerAlive: () => false });
  assert.deepEqual(next.map((i) => i.action), ['stopped'], 'a later pass refuses to remove anything');
  assert.ok(fs.existsSync(path.join(worktreesRootOf(repo))) && liveRows(env).length >= 1, 'the other scratch tree is still there');
  withMachine((m) => m.setWorktreeGcStop(null), { env });
  git(repo, 'checkout', '--', 'src/b.ts');
  const resumed = gcWorktrees({ env, now: later, repos: [repo], ownerAlive: () => false });
  assert.ok(resumed.every((i) => i.ok !== false), JSON.stringify(resumed));
  assert.ok(!fs.existsSync(one));
  assert.deepEqual(mainCheckoutDamage({ ok: true, deleted: new Set(), nodeModules: 3, packagesNodeModules: null }, { ok: true, deleted: new Set(['x']), nodeModules: 2, packagesNodeModules: null }),
    ['tracked file deleted: x', 'node_modules entries 3 -> 2']);
});

test('the lanes sweep is bounded: a large backlog is judged in budgeted passes that resume where the last stopped', (t) => {
  const { base, repo, env: baseEnv } = fixture(t, 'runtime');
  const lanes = path.join(base, 'lanes');
  const env = { ...baseEnv, STARCI_LANES_ROOT: lanes };
  const N = 24;
  for (let i = 0; i < N; i += 1) git(repo, 'worktree', 'add', '-q', '-b', `lane/l${String(i).padStart(2, '0')}`, path.join(lanes, `l${String(i).padStart(2, '0')}`), 'main');
  let tick = 0;
  const clock = () => { tick += 1000; return tick; };
  const settings = { laneGraceMs: 1, laneIdleMs: 1, laneBudgetMs: 5_000 };
  const seen = new Set();
  let cursor = null, passes = 0;
  for (;;) {
    passes += 1;
    assert.ok(passes <= 20, 'the backlog is drained in a bounded number of passes');
    const r = collectLanes({ apply: false, root: repo, env, now: Date.now() + HOUR, settings, sup: { jobs: [] }, cursor, clock });
    assert.ok(r.progress.done <= 6, `a pass stops at its budget (${r.progress.done} judged)`);
    assert.equal(r.progress.total, N);
    for (const i of r.items) if (i.target && path.resolve(i.target).startsWith(path.resolve(lanes))) seen.add(path.resolve(i.target));
    if (r.progress.complete) break;
    assert.ok(r.progress.next, 'a partial pass names where the next one resumes');
    cursor = r.progress.next;
  }
  assert.ok(passes > 1, 'more than one pass was needed');
  assert.equal(seen.size, N, 'every lane was judged by the time a pass reached the end');
  // The cursor lives in machine.sqlite between sweeps.
  writeLaneCursor('d:/somewhere/l07', env);
  assert.equal(readLaneCursor(env), 'd:/somewhere/l07');
  writeLaneCursor(null, env);
  assert.equal(readLaneCursor(env), null);
});

test('the reconciler GC controller runs the worktree pass ACTIVE even in shadow mode, and escalates a stop', async () => {
  const runs = [];
  const decisions = [];
  const c = createGcController({ worktrees: async (a) => { runs.push(a); return [{ path: 'x', action: 'remove', ok: true, reason: 'orphan' }, { path: 'y', fatal: true, damage: ['tracked file deleted: z'], ok: false, action: 'remove' }, { action: 'stopped', ok: false, reason: 'main-checkout-damaged', error: 'stopped' }]; },
    worktreeSettings: async () => ({ gcEveryMs: 1 }), recordRun: async () => 1 });
  const ctx = fakeCtx({ mode: 'shadow', controller: 'gc', now: () => Date.now(), ledgers: [{ ledgerId: 'nivo', repo: os.tmpdir(), file: null }] });
  ctx.openDecision = async (di) => { decisions.push(di); return { ok: true }; };
  assert.ok((await c.list()).includes('gc:worktrees'));
  const r = await c.reconcile('gc:worktrees', ctx);
  assert.equal(r.active, true, JSON.stringify(r));
  assert.equal(runs.length, 1, 'the pass ran in shadow mode');
  assert.equal(r.removed, 1);
  assert.equal(decisions[0]?.kind, 'runtime-defect');
  assert.match(decisions[0].summary, /main checkout/);
});
