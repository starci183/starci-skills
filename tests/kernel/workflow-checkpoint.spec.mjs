// One worktree per Kernel workflow (WFWT part B): a green op is a checkpoint commit on the workflow branch, the op gate measures
// against the previous checkpoint, a failed or blocked op's side is preserved to preserved/<wf>/<op> and reset, and main
// moves only at finishWorkflow (full gate, merge guard, review.verify of the exact head, rebase, fast-forward, push, then
// release-pending: the finish never removes its own worktree). Only the runtime commits on the workflow branch, whose name
// (Orca's wf-<id>) the runtime only ever reads from the registry.
// Temp git repos and a fake part-A registry with a fake Orca client: no live Orca call, no real origin.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveGateBase, GATE_SCHEMA } from '../../scripts/gates/gate.mjs';
import { judgeLoop } from '../../scripts/kernel/gate-settle.mjs';
import { gateBaseAt, gateBaseOf, gateBasesOf } from '../../scripts/machine/workflow-tree.mjs';
import { checkpointOp, preserveAndReset, finishWorkflow, rebaseWorkflow, reviewVerifiedOf, FINISH_STEPS } from '../../scripts/kernel/workflow-checkpoint.mjs';

import { settleFixture, apiResult } from '../helpers/workflow-settle-fixture.mjs';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { workflowWorktreeOf } from '../../scripts/machine/workflow-tree.mjs';
const WF = 'wf-nivo-checkpoint-k1';
const BRANCH = `wf-${WF}`; // Orca's own name for the worktree branch; B reads it from the registry only
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const read = (root, rel) => fs.readFileSync(path.join(root, rel), 'utf8');
const exists = (root, rel) => fs.existsSync(path.join(root, rel));
const filesOf = (repo, sha) => git(repo, 'show', '--name-only', '--format=', sha).split(/\r?\n/).filter(Boolean).sort();

/** The fake Orca client: records every call. The finish must never reach it (release is part A's GC). */
function fakeOrca() {
  const calls = [];
  return { calls, worktreeRm(dir) { calls.push(['worktree', 'rm', dir]); return { ok: true }; } };
}

/** The ledger rows the module reads: jobs (owned paths, the last settled op) and reports (the head review.verify verified). */
const OCCUPYING = ['leased', 'running', 'answering', 'reported', 'deciding', 'effect_unknown'];
function fakeDb(jobs, reports = {}, settled = reports) {
  return { prepare: (sql) => ({ all: (workflowId, exceptId, ...statuses) => jobs.filter((j) => j.workflow_id === workflowId && j.job_id !== exceptId && statuses.includes(j.status)),
    get: (...args) => {
    if (/FROM reports/.test(sql)) return args[0] in reports ? { head: reports[args[0]] } : null;
    if (/FROM events/.test(sql)) return args[2] === 'workflow-checkpoint' && args[1] in settled ? { sha: settled[args[1]] } : null;
    if (/WHERE job_id=\?/.test(sql)) return jobs.find((j) => j.job_id === args[0]) ?? null;
    return jobs.filter((j) => j.workflow_id === args[0] && ['succeeded', 'failed'].includes(j.status)).sort((a, b) => b.updated_at - a.updated_at)[0] ?? null;
  } }) };
}
const job = (id, op, ownedPaths, extra = {}) => ({ job_id: id, op_id: op, workflow_id: WF, status: 'running', updated_at: 0, payload_json: JSON.stringify({ owned_paths: ownedPaths }), ...extra });

/** One product repo, bare origin, and workflow worktree shared by this serial spec process. */
let sharedGit = null;
function sharedWorkflow() {
  if (sharedGit) {
    git(sharedGit.dir, 'reset', '-q', '--hard', sharedGit.seed);
    git(sharedGit.dir, 'clean', '-q', '-d', '-f', '-x');
    git(sharedGit.repo, 'reset', '-q', '--hard', sharedGit.seed);
    git(sharedGit.origin, 'update-ref', 'refs/heads/main', sharedGit.seed);
    git(sharedGit.repo, 'update-ref', '-d', `refs/heads/preserved/${WF}/op-fe-9`);
    return sharedGit;
  }
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wf-cp-')));
  const repo = path.join(base, 'nivo'), origin = path.join(base, 'nivo.git'), dir = path.join(base, 'wf');
  fs.mkdirSync(repo);
  git(base, 'init', '-q', '--bare', '-b', 'main', origin);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  write(repo, '.gitignore', 'node_modules/\n');
  write(repo, 'be/a.ts', 'export const a = 1;\n');
  write(repo, 'fe/b.ts', 'export const b = 1;\n');
  write(repo, 'docs/readme.md', 'nivo\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'remote', 'add', 'origin', origin);
  git(repo, 'push', '-q', 'origin', 'main');
  git(repo, 'worktree', 'add', '-q', '-b', BRANCH, dir, 'main');
  sharedGit = { base, repo, origin, dir, seed: git(repo, 'rev-parse', 'HEAD') };
  return sharedGit;
}
after(() => {
  if (sharedGit) fs.rmSync(sharedGit.base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 });
});

/** A reset registry and ledger view over the shared workflow checkout. */
function fixture(_t, { jobs = [], orca = fakeOrca(), pendingFails = false, ...seams } = {}) {
  const { base, repo, origin, dir } = sharedWorkflow();
  const registry = new Map([[WF, { workflowId: WF, orcaWorktreeId: 'orca-wt-1', path: dir, branch: BRANCH, checkpoint: null }]]);
  const checkpoints = [], pending = [], reports = {};
  const worktree = {
    workflowWorktreeOf: (_ctx, id) => (registry.has(id) ? { ...registry.get(id) } : null),
    workflowWorktreeAt: (_ctx, at) => [...registry.values()].find((r) => path.resolve(r.path) === path.resolve(at)) ?? null,
    setCheckpoint: (_ctx, id, sha) => { checkpoints.push(sha); registry.get(id).checkpoint = sha; return true; },
    markReleasePending: (_ctx, id) => { pending.push(id); return pendingFails ? { ok: false, reason: 'registry-unavailable' } : { ok: true }; },
    TERMINAL_JOB_STATUSES: OCCUPYING,
  };
  // The temp repository is reset by hand between cases: the runtime's history hook is exercised in tests/kernel/workflow-rewind-hook.spec.mjs.
  const ctx = { worktree, orca, db: fakeDb(jobs, reports), ensureHistoryHook: () => ({ installed: false }), lockWaitMs: 5_000, gate: () => ({ exit: 0, counts: { new: 0 }, findings: [], errors: [] }), ...seams };
  return { base, repo, origin, dir, ctx, registry, checkpoints, pending, reports, orca };
}

test('a checkpoint per green op: exactly its owned paths are committed on the workflow branch; another live op\'s work stays; a stray change refuses the pass', (t) => {
  const fx = fixture(t, { jobs: [job('op-be-1', 'code.refactor', ['be']), job('op-fe-1', 'code.refactor', ['fe']), job('op-work-1', 'work.author', ['.starciwork/work'])] });
  write(fx.dir, 'be/a.ts', 'export const a = 2;\n');
  write(fx.dir, 'be/new.ts', 'export const n = 1;\n');
  write(fx.dir, 'fe/b.ts', 'export const b = 2; // fe op still running\n');
  write(fx.dir, '.starciwork/work/scope.yaml', 'scope: in flight\n');
  fs.mkdirSync(path.join(fx.dir, 'be', 'node_modules', 'x'), { recursive: true });
  write(fx.dir, 'be/node_modules/x/index.js', 'module.exports = 1;\n');
  const before = git(fx.dir, 'rev-parse', 'HEAD');
  const cp = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  assert.equal(cp.committed, true);
  assert.deepEqual(cp.scope, ['be']);
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD'), cp.sha, 'the branch is on the checkpoint');
  assert.equal(git(fx.dir, 'rev-parse', `${cp.sha}^`), before);
  assert.deepEqual(filesOf(fx.dir, cp.sha), ['be/a.ts', 'be/new.ts'], 'node_modules, the fe op and the Work op are never in a be checkpoint');
  assert.deepEqual(fx.checkpoints, [cp.sha], 'setCheckpoint was called with the commit');
  assert.equal(git(fx.dir, 'status', '--porcelain', '--', 'be'), '', 'the be paths are clean against their checkpoint');
  assert.match(git(fx.dir, 'status', '--porcelain', '--', 'fe'), /fe\/b\.ts/, 'the fe op\'s in-flight work is untouched');
  assert.equal(git(fx.repo, 'rev-parse', 'main'), before, 'main never moves at a checkpoint');
  // A green op with nothing changed under its leases: the checkpoint is the head, no empty commit.
  const again = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  assert.deepEqual([again.committed, again.sha], [false, cp.sha]);
  // A Work-owner op (work.author) runs in the workflow worktree: its owned .starciwork records are its checkpoint.
  const work = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-work-1' });
  assert.equal(work.committed, true);
  assert.deepEqual(filesOf(fx.dir, work.sha), ['.starciwork/work/scope.yaml']);
  assert.match(git(fx.dir, 'status', '--porcelain', '--', 'fe'), /fe\/b\.ts/, 'the fe side is never swept in');
  // A change under no live op's leases is foreign: the pass is refused and nothing moves.
  write(fx.dir, 'docs/stray.md', 'nobody owns this\n');
  assert.throws(() => checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' }), (e) => e.code === 'workflow-foreign-change' && e.files.includes('docs/stray.md'));
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD'), work.sha);
  // An unknown workflow, or a registry row with no branch, is a typed refusal: B never constructs the branch name.
  fx.registry.get(WF).branch = null;
  assert.throws(() => checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' }), (e) => e.code === 'workflow-worktree-missing');
  fx.registry.get(WF).branch = BRANCH;
  assert.throws(() => checkpointOp(fx.ctx, { workflowId: 'wf-none', opId: 'x' }), (e) => e.code === 'workflow-worktree-missing');
});

test('the gate base is the previous checkpoint (the merge-base with main before the first one)', (t) => {
  const fx = fixture(t, { jobs: [job('op-be-1', 'code.refactor', ['be/a.ts']), job('op-fe-1', 'code.refactor', ['fe/b.ts'])] });
  const mainTip = git(fx.repo, 'rev-parse', 'main');
  assert.equal(gateBaseOf(fx.ctx, WF), mainTip);
  write(fx.dir, 'be/a.ts', 'export const a = 3;\n');
  const first = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  assert.equal(gateBaseOf(fx.ctx, WF), first.sha);
  write(fx.dir, 'fe/b.ts', 'export const b = 3;\n');
  const second = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-fe-1' });
  assert.equal(gateBaseOf(fx.ctx, WF), second.sha);
  fx.registry.get(WF).checkpoint = 'f'.repeat(40);
  assert.throws(() => gateBaseOf(fx.ctx, WF), (e) => e.code === 'workflow-gate-base-unknown');
});

test('gate.mjs without --base in a workflow worktree measures against the workflow checkpoint (gateBaseOf)', (t) => {
  const fx = fixture(t, { jobs: [job('op-be-1', 'code.refactor', ['be/a.ts'])] });
  write(fx.dir, 'be/a.ts', 'export const a = 11;\n');
  const cp = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  write(fx.dir, 'be/a.ts', 'export const a = 12;\n');
  git(fx.dir, '-c', 'user.name=op', '-c', 'user.email=op@x', 'commit', '-qam', 'an op commit past the checkpoint');
  const asked = [];
  const workflowBase = (dir) => { asked.push(dir); return gateBaseAt(fx.ctx, dir); };
  assert.equal(resolveGateBase(fx.dir, null, { workflowBase }), cp.sha, 'the previous checkpoint, not the merge-base of HEAD');
  assert.deepEqual(asked, [fx.dir], 'the registry names the workflow from the worktree path, never from a branch name');
  const mainTip = git(fx.repo, 'rev-parse', 'main');
  assert.equal(resolveGateBase(fx.dir, mainTip, { workflowBase }), mainTip, 'an explicit --base wins');
  assert.equal(resolveGateBase(fx.repo, null, { workflowBase }), mainTip, 'outside a workflow branch: the merge-base with main');
  assert.equal(asked.length, 2, 'the main checkout is asked too and is no workflow worktree');
});

test('a failed op: its owned paths and any stray change are preserved to preserved/<wf>/<op> and reset; another live op is untouched', (t) => {
  const fx = fixture(t, { jobs: [job('op-be-1', 'code.refactor', ['be']), job('op-fe-9', 'code.refactor', ['fe'])] });
  write(fx.dir, 'be/a.ts', 'export const a = 4;\n');
  const cp = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  write(fx.dir, 'fe/b.ts', 'export const b = "broken";\n');
  write(fx.dir, 'fe/untracked.ts', 'export const u = 1;\n');
  write(fx.dir, 'docs/stray.md', 'outside every lease\n');
  write(fx.dir, 'be/a.ts', 'export const a = 5; // a be op in flight\n');
  const out = preserveAndReset(fx.ctx, { workflowId: WF, opId: 'op-fe-9' });
  assert.equal(out.preservedRef, `refs/heads/preserved/${WF}/op-fe-9`);
  assert.equal(out.resetTo, cp.sha);
  assert.equal(git(fx.repo, 'show', `${out.preservedRef}:fe/b.ts`), 'export const b = "broken";');
  assert.equal(git(fx.repo, 'show', `${out.preservedRef}:fe/untracked.ts`), 'export const u = 1;');
  assert.equal(git(fx.repo, 'show', `${out.preservedRef}:docs/stray.md`), 'outside every lease', 'a stray change is folded into the preserved ref');
  assert.equal(read(fx.dir, 'fe/b.ts'), 'export const b = 1;\n', 'the fe paths are back on the checkpoint');
  assert.equal(exists(fx.dir, 'fe/untracked.ts'), false);
  assert.equal(exists(fx.dir, 'docs/stray.md'), false);
  assert.equal(read(fx.dir, 'be/a.ts'), 'export const a = 5; // a be op in flight\n', 'the be op\'s work is untouched');
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD'), cp.sha);
  // An op that committed past the checkpoint: the branch goes back, the commit is preserved.
  write(fx.dir, 'fe/b.ts', 'export const b = 6;\n');
  git(fx.dir, 'add', 'fe/b.ts');
  git(fx.dir, '-c', 'user.name=op', '-c', 'user.email=op@x', 'commit', '-q', '--no-verify', '-m', 'op commit');
  // Only the runtime commits on the workflow branch: a green settle over a commit checkpointOp did not make is refused...
  assert.throws(() => checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-fe-9' }), (e) => e.code === 'workflow-foreign-commit' && e.commits.length === 1);
  assert.equal(fx.registry.get(WF).checkpoint, cp.sha, 'the refused checkpoint moved nothing');
  // ...and a failed or blocked op's foreign commit is folded into its preserved ref, the branch back on the checkpoint.
  const back = preserveAndReset(fx.ctx, { workflowId: WF, opId: 'op-fe-9' });
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD'), cp.sha);
  assert.equal(git(fx.repo, 'show', `${back.preservedRef}:fe/b.ts`), 'export const b = 6;');
  assert.equal(read(fx.dir, 'fe/b.ts'), 'export const b = 1;\n');
  assert.equal(read(fx.dir, 'be/a.ts'), 'export const a = 5; // a be op in flight\n');
  // Nothing to keep: no ref, still a reset.
  const none = preserveAndReset(fx.ctx, { workflowId: WF, opId: 'op-fe-9' });
  assert.deepEqual([none.preservedRef, none.resetTo], [null, cp.sha]);
});

test('a rebase at a milestone: the workflow branch onto main\'s new tip, the checkpoint follows; a dirty tree is refused', (t) => {
  const fx = fixture(t, { jobs: [job('op-be-1', 'code.refactor', ['be/a.ts'])] });
  write(fx.dir, 'be/a.ts', 'export const a = 7;\n');
  checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  write(fx.repo, 'docs/readme.md', 'nivo moved\n');
  git(fx.repo, 'commit', '-qam', 'main moves');
  const tip = git(fx.repo, 'rev-parse', 'main');
  write(fx.dir, 'be/a.ts', 'export const a = 8; // in flight\n');
  assert.equal(rebaseWorkflow(fx.ctx, { workflowId: WF }).code, 'workflow-rebase-dirty');
  git(fx.dir, 'checkout', '-q', '--', 'be/a.ts');
  const r = rebaseWorkflow(fx.ctx, { workflowId: WF });
  assert.equal(r.ok, true);
  assert.equal(r.onto, tip);
  assert.equal(git(fx.dir, 'merge-base', '--is-ancestor', tip, 'HEAD') === '', true);
  assert.equal(fx.registry.get(WF).checkpoint, r.head);
  assert.equal(gateBaseOf(fx.ctx, WF), r.head);
  assert.equal(rebaseWorkflow(fx.ctx, { workflowId: WF }).already, true);
});

const verifiedJobs = () => [job('op-be-1', 'code.refactor', ['be/a.ts'], { status: 'succeeded', updated_at: 1 }), job('op-rv-1', 'review.verify', [], { status: 'succeeded', updated_at: 2 })];

test('finish, the happy path: a rebase that moves the head forces a re-review; then main lands, is pushed, and the worktree is only marked release-pending', (t) => {
  const gates = [];
  const fx = fixture(t, { jobs: verifiedJobs(), gate: (g) => { gates.push(g); return { exit: 0, counts: { new: 0 }, findings: [], errors: [] }; } });
  write(fx.dir, 'be/a.ts', 'export const a = 9;\n');
  checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  fx.reports['op-rv-1'] = git(fx.dir, 'rev-parse', 'HEAD');
  write(fx.repo, 'docs/readme.md', 'nivo moved\n');
  git(fx.repo, 'commit', '-qam', 'main moves');
  const mainBefore = git(fx.repo, 'rev-parse', 'main');
  const first = finishWorkflow(fx.ctx, { workflowId: WF });
  assert.equal(first.ok, false);
  assert.deepEqual([first.refusal.step, first.refusal.code], ['rebase', 'workflow-finish-verify-stale'], JSON.stringify(first.refusal));
  assert.equal(gates.length, 2, 'the rebased head is gated before the re-review is asked for');
  assert.equal(git(fx.repo, 'rev-parse', 'main'), mainBefore, 'nothing lands on a stale review');
  const rebased = git(fx.dir, 'rev-parse', 'HEAD');
  assert.equal(first.refusal.head, rebased);
  // review.verify runs again on the rebased head; the finish lands it.
  fx.reports['op-rv-1'] = rebased;
  const out = finishWorkflow(fx.ctx, { workflowId: WF });
  assert.equal(out.ok, true, JSON.stringify(out.refusal));
  assert.deepEqual([out.landed, out.releasePending], [true, true]);
  assert.deepEqual(out.steps.map((s) => s.step), FINISH_STEPS);
  assert.equal(out.head, rebased);
  assert.equal(git(fx.repo, 'rev-parse', 'main'), rebased);
  assert.equal(read(fx.repo, 'be/a.ts'), 'export const a = 9;\n', 'the live checkout follows main');
  assert.equal(git(fx.origin, 'rev-parse', 'main'), rebased, 'main is pushed');
  assert.deepEqual(fx.pending, [WF], 'the worktree is marked release-pending');
  assert.deepEqual(fx.orca.calls, [], 'no removal is attempted from inside the finish');
  assert.ok(exists(fx.dir, 'be/a.ts'), 'the worktree is still there');
  assert.equal(git(fx.repo, 'branch', '--list', BRANCH).replace(/^[*+ ]+/, ''), BRANCH, 'the workflow branch is left to the GC');
});

test('the default review.verify: the last settled op is a passing review.verify that verified the exact head', () => {
  const ctx = (jobs, reports = { 'op-rv-1': 'a'.repeat(40) }) => ({ db: fakeDb(jobs, reports) });
  const head = 'a'.repeat(40);
  assert.equal(reviewVerifiedOf(ctx(verifiedJobs()), { workflowId: WF, head }).ok, true);
  const stale = reviewVerifiedOf(ctx(verifiedJobs()), { workflowId: WF, head: 'b'.repeat(40) });
  assert.deepEqual([stale.ok, stale.code, stale.verifiedHead], [false, 'workflow-finish-verify-stale', head]);
  assert.equal(reviewVerifiedOf(ctx(verifiedJobs(), {}), { workflowId: WF, head }).code, 'workflow-finish-verify-stale', 'a review that names no head verified nothing');
  // Head-pinned (WFWT2 2.5): the runtime's checkpoint at the review's settle is the verified head, never the report alone.
  const pinned = (reports, settled) => reviewVerifiedOf({ db: fakeDb(verifiedJobs(), reports, settled) }, { workflowId: WF, head });
  assert.equal(pinned({ 'op-rv-1': head.slice(0, 12) }, { 'op-rv-1': head }).ok, true, 'an abbreviated report head of the settled tree passes');
  const moved = pinned({ 'op-rv-1': 'b'.repeat(40) }, { 'op-rv-1': head });
  assert.deepEqual([moved.ok, moved.code, moved.verifiedHead], [false, 'workflow-finish-verify-stale', head], 'an op checkpointed while the review ran');
  assert.match(moved.detail, /checkpointed while it ran/);
  assert.equal(pinned({ 'op-rv-1': head }, {}).code, 'workflow-finish-verify-stale', 'no runtime-recorded checkpoint: the report alone pins nothing');
  assert.equal(pinned({ 'op-rv-1': 'b'.repeat(40) }, { 'op-rv-1': 'b'.repeat(40) }).code, 'workflow-finish-verify-stale', 'a review of another head');
  assert.equal(reviewVerifiedOf(ctx([...verifiedJobs(), job('op-be-2', 'code.refactor', [], { status: 'succeeded', updated_at: 3 })]), { workflowId: WF, head }).code, 'workflow-finish-verify-missing');
  assert.equal(reviewVerifiedOf(ctx([job('op-rv-1', 'review.verify', [], { status: 'failed', updated_at: 2 })]), { workflowId: WF, head }).code, 'workflow-finish-verify-missing');
  assert.equal(reviewVerifiedOf({}, { workflowId: WF, head }).ok, false);
});

test('settle refuses a gate JSON whose base is not an accepted workflow checkpoint (op-gate-base-mismatch)', () => {
  const cp = 'c'.repeat(40), older = 'e'.repeat(40);
  const gate = (base) => ({ schema: GATE_SCHEMA, base, exit: 0, counts: { new: 0 }, findings: [], errors: [] });
  const off = judgeLoop({ gate: gate('d'.repeat(40)), digest: null, kinds: [], gateBases: [cp, older] });
  assert.deepEqual([off.status, off.code], ['red', 'op-gate-base-mismatch']);
  assert.match(off.detail, /cccccccccccc/, 'the refusal names the current checkpoint');
  assert.equal(judgeLoop({ gate: gate(undefined), digest: null, kinds: [], gateBases: [cp] }).code, 'op-gate-base-mismatch');
  assert.notEqual(judgeLoop({ gate: gate(cp), digest: null, kinds: [], gateBases: [cp] }).code, 'op-gate-base-mismatch', 'the checkpoint base passes on to the rest of the loop');
  assert.notEqual(judgeLoop({ gate: gate(older), digest: null, kinds: [], gateBases: [cp, older] }).code, 'op-gate-base-mismatch', 'an older checkpoint its side has not moved since passes');
  assert.notEqual(judgeLoop({ gate: gate('d'.repeat(40)), digest: null, kinds: [] }).code, 'op-gate-base-mismatch', 'outside a workflow worktree any base is the op\'s own');
});

test('per-side gate bases: an fe op gated before a be checkpoint keeps its base; its own side moving drops it', (t) => {
  const fx = fixture(t, { jobs: [job('op-be-1', 'code.refactor', ['be']), job('op-fe-1', 'code.refactor', ['fe']), job('op-be-2', 'code.refactor', ['be'])] });
  const start = git(fx.dir, 'rev-parse', 'HEAD');
  assert.deepEqual(gateBasesOf(fx.ctx, WF, { owned: ['fe'] }), [start], 'no checkpoint yet: the merge-base only');
  write(fx.dir, 'be/a.ts', 'export const a = 2;\n');
  const c1 = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' }).sha;
  assert.deepEqual(gateBasesOf(fx.ctx, WF, { owned: ['fe'] }), [c1, start], 'a be checkpoint never forces the fe op to re-gate');
  assert.deepEqual(gateBasesOf(fx.ctx, WF, { owned: ['be'] }), [c1], 'the be side moved at c1');
  write(fx.dir, 'fe/b.ts', 'export const b = 2;\n');
  const c2 = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-fe-1' }).sha;
  write(fx.dir, 'be/a.ts', 'export const a = 3;\n');
  const c3 = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-2' }).sha;
  assert.deepEqual(gateBasesOf(fx.ctx, WF, { owned: ['fe'] }), [c3, c2], 'the fe side moved at c2: c1 and the merge-base are gone');
  assert.deepEqual(gateBasesOf(fx.ctx, WF, { owned: ['be'] }), [c3]);
  assert.deepEqual(gateBasesOf(fx.ctx, WF, { owned: ['.'] }), [c3], 'an op owning the whole tree gets the current checkpoint only');
  assert.deepEqual(gateBasesOf(fx.ctx, WF, { owned: [] }), [c3], 'an op with no known paths gets the current checkpoint only');
  assert.deepEqual(gateBasesOf(fx.ctx, WF, { owned: ['docs'] }), [c3, c2, c1, start], 'an untouched side walks back to the merge-base');
});

test('finish refused at each step with its typed code; main moves at none of the refusals before fast-forward', (t) => {
  const cases = [
    ['dirty', (fx) => write(fx.dir, 'fe/b.ts', 'dirty\n'), {}, 'gate', 'workflow-finish-dirty'],
    ['gate red', null, { gate: () => ({ exit: 1, counts: { new: 1 }, findings: [{ engine: 'lint', rule: 'x' }], errors: [] }) }, 'gate', 'workflow-finish-gate-red'],
    ['gate unavailable', null, { gate: () => ({ exit: 2, findings: [], errors: ['tsc missing'] }) }, 'gate', 'workflow-finish-gate-unavailable'],
    ['guard', null, { guard: () => ({ checked: ['m'], findings: [{ path: 'docs/readme.md' }], errors: [] }) }, 'merge-guard', 'workflow-finish-merge-dropped-main'],
    ['guard unavailable', null, { guard: () => ({ checked: [], findings: [], errors: ['merge-tree failed'] }) }, 'merge-guard', 'workflow-finish-guard-unavailable'],
    ['foreign commit', (fx) => { write(fx.dir, 'be/a.ts', 'export const a = "op";\n'); git(fx.dir, '-c', 'user.name=op', '-c', 'user.email=op@x', 'commit', '-qam', 'an op commit'); }, {}, 'gate', 'workflow-foreign-commit'],
    ['verify', null, { verify: () => ({ ok: false, detail: 'no review.verify' }) }, 'review-verify', 'workflow-finish-verify-missing'],
    ['verify stale', (fx) => { fx.reports['op-rv-1'] = 'e'.repeat(40); }, {}, 'review-verify', 'workflow-finish-verify-stale'],
    ['rebase conflict', (fx) => { write(fx.repo, 'be/a.ts', 'export const a = "main";\n'); git(fx.repo, 'commit', '-qam', 'main edits be/a.ts'); }, {}, 'rebase', 'workflow-finish-rebase-conflict'],
    ['main refused', (fx) => write(fx.repo, 'be/a.ts', 'live checkout dirty\n'), {}, 'fast-forward', 'workflow-finish-main-refused'],
    ['push', null, { push: () => ({ ok: false, detail: 'rejected' }) }, 'push', 'workflow-finish-push-failed'],
    ['release pending', null, { pendingFails: true }, 'release-pending', 'workflow-finish-release-pending-failed'],
  ];
  for (const [name, arrange, seams, step, code] of cases) {
    const fx = fixture(t, { jobs: verifiedJobs(), ...seams });
    write(fx.dir, 'be/a.ts', 'export const a = 10;\n');
    fx.reports['op-rv-1'] = checkpointOp(fx.ctx, { workflowId: WF, opId: 'op-be-1' }).sha;
    arrange?.(fx);
    const mainBefore = git(fx.repo, 'rev-parse', 'main');
    const out = finishWorkflow(fx.ctx, { workflowId: WF });
    assert.equal(out.ok, false, name);
    assert.deepEqual([out.refusal.step, out.refusal.code], [step, code], `${name}: ${JSON.stringify(out.refusal)}`);
    assert.equal(out.steps.at(-1).code, code);
    if (FINISH_STEPS.indexOf(step) < FINISH_STEPS.indexOf('fast-forward')) assert.equal(git(fx.repo, 'rev-parse', 'main'), mainBefore, `${name}: main untouched`);
    if (step === 'rebase') assert.equal(git(fx.dir, 'status', '--porcelain'), '', 'the conflicted rebase was aborted');
    assert.deepEqual(fx.orca.calls, [], `${name}: no removal from inside the finish`);
  }
});

for (const phase of ['prepared', 'branch-applied', 'index-applied', 'registry-applied', 'applied']) {
  test(`checkpoint interruption at ${phase} recovers the original dispatch commit exactly once`, (t) => {
    const fx = settleFixture(t), jobId = 'op-interrupted-checkpoint';
    const attemptId = fx.prepare({ jobId }), before = git(fx.tree, 'rev-parse', 'HEAD');
    const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
    try {
      const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env };
      assert.throws(() => checkpointOp({ ...ctx, checkpointPhase: (at) => {
        if (at === phase) throw Object.assign(new Error(`interrupted at ${phase}`), { code: 'injected-checkpoint-interruption' });
      } }, { workflowId: fx.workflowId, opId: jobId }), (error) => error.code === 'injected-checkpoint-interruption');
      const prepared = ledger.db.prepare("SELECT attempt_id,payload_json FROM events WHERE entity_id=? AND kind='workflow-checkpoint-prepared' ORDER BY seq DESC LIMIT 1").get(jobId);
      assert.ok(prepared, 'the intent is durable before applying branch/index/registry effects');
      const intent = JSON.parse(prepared.payload_json);
      assert.deepEqual([prepared.attempt_id, intent.attemptId, intent.dispatchId, intent.before, intent.committed], [attemptId, attemptId, `ctx-${jobId}`, before, true]);
      assert.equal(git(fx.tree, 'rev-parse', `${intent.sha}^`), before);
      assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind='workflow-checkpoint'").get(jobId).n, 0, 'a partial effect has no accepted checkpoint event');
      assert.equal(ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status, 'running');
      const recovered = checkpointOp(ctx, { workflowId: fx.workflowId, opId: jobId });
      assert.deepEqual([recovered.sha, recovered.committed, recovered.attemptId, recovered.dispatchId], [intent.sha, true, attemptId, `ctx-${jobId}`]);
      assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), intent.sha);
      assert.equal(git(fx.tree, 'rev-list', '--count', `${before}..HEAD`), '1', 'recovery attaches the saved one-parent commit without another commit');
      assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, intent.sha);
      assert.equal(git(fx.tree, 'status', '--porcelain'), '');
      assert.equal(fs.readFileSync(path.join(fx.tree, 'docs', 'change.md'), 'utf8'), `owned change of ${jobId}\n`);
      for (const kind of ['workflow-checkpoint-prepared', 'workflow-checkpoint-applied']) {
        assert.equal(ledger.db.prepare('SELECT count(*) n FROM events WHERE entity_id=? AND attempt_id=? AND kind=?').get(jobId, attemptId, kind).n, 1);
      }
      const again = checkpointOp(ctx, { workflowId: fx.workflowId, opId: jobId });
      assert.deepEqual([again.sha, again.committed, again.attemptId, again.dispatchId], [intent.sha, true, attemptId, `ctx-${jobId}`], 'completed effect replay preserves the original attribution');
    } finally { ledger.close(); }
    const accepted = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass']);
    assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
    const checkpoint = apiResult(accepted).checkpoint;
    assert.deepEqual([checkpoint.committed, checkpoint.attemptId, checkpoint.dispatchId], [true, attemptId, `ctx-${jobId}`]);
    assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND attempt_id=? AND kind='workflow-checkpoint'").get(jobId, attemptId).n), 1);
    const stored = fx.read((db) => JSON.parse(db.prepare('SELECT settle_json FROM op_attempts WHERE attempt_id=?').get(attemptId).settle_json));
    assert.deepEqual(stored.checkpoint, checkpoint, 'accepted attempt result owns the recovered receipt');
  });
}

for (const phase of ['prepared', 'branch-applied', 'index-applied', 'applied']) {
  test(`preservation interruption at ${phase} recovers its original ref and reset exactly once`, (t) => {
    const fx = settleFixture(t), jobId = 'op-interrupted-preserve';
    const attemptId = fx.prepare({ jobId, outcome: 'blocked' }), base = git(fx.tree, 'rev-parse', 'HEAD');
    const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
    try {
      const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env };
      assert.throws(() => preserveAndReset({ ...ctx, checkpointPhase: (at) => {
        if (at === phase) throw Object.assign(new Error(`preserve interrupted at ${phase}`), { code: 'injected-preserve-interruption' });
      } }, { workflowId: fx.workflowId, opId: jobId }), (error) => error.code === 'injected-preserve-interruption');
      const prepared = ledger.db.prepare("SELECT attempt_id,payload_json FROM events WHERE entity_id=? AND kind='workflow-op-preserved-prepared'").get(jobId);
      assert.ok(prepared);
      const intent = JSON.parse(prepared.payload_json);
      assert.deepEqual([prepared.attempt_id, intent.attemptId, intent.dispatchId, intent.resetTo], [attemptId, attemptId, `ctx-${jobId}`, base]);
      const recovered = preserveAndReset(ctx, { workflowId: fx.workflowId, opId: jobId });
      assert.deepEqual([recovered.preservedRef, recovered.sha, recovered.resetTo, recovered.attemptId, recovered.dispatchId],
        [intent.preservedRef, intent.sha, base, attemptId, `ctx-${jobId}`]);
      assert.equal(git(fx.tree, 'rev-parse', intent.preservedRef), intent.sha);
      assert.equal(git(fx.tree, 'show', `${intent.preservedRef}:docs/change.md`), `owned change of ${jobId}`);
      assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), base);
      assert.equal(git(fx.tree, 'status', '--porcelain'), '');
      assert.equal(fs.existsSync(path.join(fx.tree, 'docs', 'change.md')), false);
      const replay = preserveAndReset(ctx, { workflowId: fx.workflowId, opId: jobId });
      assert.deepEqual(replay, recovered);
      for (const kind of ['workflow-op-preserved-prepared', 'workflow-op-preserved-applied']) {
        assert.equal(ledger.db.prepare('SELECT count(*) n FROM events WHERE entity_id=? AND attempt_id=? AND kind=?').get(jobId, attemptId, kind).n, 1);
      }
    } finally { ledger.close(); }
  });
}

test('a stray file a Kernel shell left after the receipt was prepared does not make the fail decision unrecoverable (Nivo: a file named 0 in the tree root)', (t) => {
  const fx = settleFixture(t), jobId = 'op-stray-after-prepare';
  fx.prepare({ jobId, outcome: 'blocked' });
  const base = git(fx.tree, 'rev-parse', 'HEAD');
  const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
  try {
    const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env, ensureHistoryHook: () => ({ installed: false }) };
    assert.throws(() => preserveAndReset({ ...ctx, checkpointPhase: (at) => {
      if (at === 'prepared') throw Object.assign(new Error('interrupted'), { code: 'injected-preserve-interruption' });
    } }, { workflowId: fx.workflowId, opId: jobId }), (error) => error.code === 'injected-preserve-interruption');
    fs.writeFileSync(path.join(fx.tree, '0'), '{"ok":true}');
    const recovered = preserveAndReset(ctx, { workflowId: fx.workflowId, opId: jobId });
    assert.equal(recovered.resetTo, base);
    assert.equal(git(fx.tree, 'status', '--porcelain'), '', 'the tree is back on its checkpoint, the stray file kept with the preserved work');
    assert.equal(git(fx.tree, 'show', `${recovered.preservedRef}:0`), '{"ok":true}');
    assert.equal(git(fx.tree, 'show', `${recovered.preservedRef}:docs/change.md`), `owned change of ${jobId}`);
  } finally { ledger.close(); }
});

test('a zero-row registry update fails visibly and retry keeps the existing checkpoint identity', (t) => {
  const fx = settleFixture(t), jobId = 'op-registry-failed';
  const attemptId = fx.prepare({ jobId }), before = git(fx.tree, 'rev-parse', 'HEAD');
  const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
  try {
    const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env };
    assert.throws(() => checkpointOp({ ...ctx, worktree: { setCheckpoint: () => false } }, { workflowId: fx.workflowId, opId: jobId }),
      (error) => error.code === 'workflow-worktree-missing');
    const saved = JSON.parse(ledger.db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='workflow-checkpoint-prepared'").get(jobId).payload_json);
    assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, null, 'no live registry row accepted the update');
    assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), saved.sha, 'the visible failure retains its partial branch effect');
    const recovered = checkpointOp(ctx, { workflowId: fx.workflowId, opId: jobId });
    assert.deepEqual([recovered.sha, recovered.committed, recovered.attemptId, recovered.dispatchId], [saved.sha, true, attemptId, `ctx-${jobId}`]);
    assert.equal(git(fx.tree, 'rev-list', '--count', `${before}..HEAD`), '1');
    assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, saved.sha);
  } finally { ledger.close(); }
});

for (const phase of ['prepared', 'branch-applied']) {
  test(`new owned bytes after ${phase} hold recovery without committing or discarding them`, (t) => {
    const fx = settleFixture(t), jobId = 'op-changed-after-intent';
    fx.prepare({ jobId });
    const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
    try {
      const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env };
      assert.throws(() => checkpointOp({ ...ctx, checkpointPhase: (at) => {
        if (at === phase) throw Object.assign(new Error('stop after durable preparation'), { code: 'injected-checkpoint-interruption' });
      } }, { workflowId: fx.workflowId, opId: jobId }), (error) => error.code === 'injected-checkpoint-interruption');
      const intent = JSON.parse(ledger.db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='workflow-checkpoint-prepared'").get(jobId).payload_json);
      write(fx.tree, 'docs/change.md', 'new bytes outside the prepared checkpoint\n');
      const before = fx.capture(jobId);
      assert.throws(() => checkpointOp(ctx, { workflowId: fx.workflowId, opId: jobId }),
        (error) => error.code === 'workflow-checkpoint-recovery-conflict');
      assert.deepEqual(fx.capture(jobId), before, 'the hold retains new owned bytes and every existing branch/index/registry effect');
      assert.equal(git(fx.tree, 'show', `${intent.sha}:docs/change.md`), `owned change of ${jobId}`);
      assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind='workflow-checkpoint-applied'").get(jobId).n, 0);
    } finally { ledger.close(); }
  });
}

test('an applied checkpoint replay refuses a later foreign HEAD without replacing it', (t) => {
  const fx = settleFixture(t), jobId = 'op-applied-before-foreign';
  fx.prepare({ jobId });
  const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
  try {
    const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env };
    assert.throws(() => checkpointOp({ ...ctx, checkpointPhase: (phase) => {
      if (phase === 'applied') throw Object.assign(new Error('acknowledgement lost'), { code: 'injected-checkpoint-interruption' });
    } }, { workflowId: fx.workflowId, opId: jobId }), (error) => error.code === 'injected-checkpoint-interruption');
    write(fx.tree, 'docs/foreign.md', 'a foreign commit after the partial dispatch\n');
    git(fx.tree, 'add', 'docs/foreign.md');
    git(fx.tree, 'commit', '-q', '-m', 'foreign commit in private fault fixture');
    const before = fx.capture(jobId);
    assert.throws(() => checkpointOp(ctx, { workflowId: fx.workflowId, opId: jobId }), (error) => error.code === 'workflow-foreign-commit');
    assert.deepEqual(fx.capture(jobId), before, 'foreign history remains visible and is not rewound or accepted');
  } finally { ledger.close(); }
});

test('a saved dispatch replays after a legitimate sibling checkpoint without rewinding that sibling', (t) => {
  const fx = settleFixture(t), first = 'op-original', second = 'op-later-sibling';
  fx.prepare({ jobId: first, ownedRoot: 'docs/a' });
  const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
  try {
    const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env };
    const original = checkpointOp(ctx, { workflowId: fx.workflowId, opId: first });
    fx.prepare({ jobId: second, ownedRoot: 'docs/b' });
    const sibling = checkpointOp(ctx, { workflowId: fx.workflowId, opId: second });
    assert.equal(git(fx.tree, 'rev-parse', `${sibling.sha}^`), original.sha);
    const before = fx.capture(first);
    const replay = checkpointOp(ctx, { workflowId: fx.workflowId, opId: first });
    assert.deepEqual(replay, original);
    assert.deepEqual(fx.capture(first), before);
    assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, sibling.sha);
    assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), sibling.sha);
  } finally { ledger.close(); }
});
