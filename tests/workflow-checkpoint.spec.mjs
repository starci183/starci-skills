// One worktree per Kernel workflow (WFWT part B): a green op is a checkpoint commit on the workflow branch, the op gate measures
// against the previous checkpoint, a failed or blocked op's side is preserved to preserved/<wf>/<op> and reset, and main
// moves only at finishWorkflow (full gate, merge guard, review.verify of the exact head, rebase, fast-forward, push, then
// release-pending: the finish never removes its own worktree). Only the runtime commits on the workflow branch, whose name
// (Orca's wf-<id>) the runtime only ever reads from the registry.
// Temp git repos and a fake part-A registry with a fake Orca client: no live Orca call, no real origin.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { resolveGateBase, GATE_SCHEMA } from '../scripts/checks/gate.mjs';
import { judgeLoop } from '../scripts/kernel/gate-settle.mjs';
import { checkpointOp, gateBaseAt, gateBaseOf, preserveAndReset, finishWorkflow, rebaseWorkflow, reviewVerifiedOf, FINISH_STEPS } from '../scripts/kernel/workflow-checkpoint.mjs';

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
function fakeDb(jobs, reports = {}) {
  return { prepare: (sql) => ({ all: (workflowId, exceptId, ...statuses) => jobs.filter((j) => j.workflow_id === workflowId && j.job_id !== exceptId && statuses.includes(j.status)),
    get: (...args) => {
    if (/FROM reports/.test(sql)) return args[0] in reports ? { head: reports[args[0]] } : null;
    if (/WHERE job_id=\?/.test(sql)) return jobs.find((j) => j.job_id === args[0]) ?? null;
    return jobs.filter((j) => j.workflow_id === args[0] && ['succeeded', 'failed'].includes(j.status)).sort((a, b) => b.updated_at - a.updated_at)[0] ?? null;
  } }) };
}
const job = (id, op, ownedPaths, extra = {}) => ({ job_id: id, op_id: op, workflow_id: WF, status: 'running', updated_at: 0, payload_json: JSON.stringify({ owned_paths: ownedPaths }), ...extra });

/** A product repo on main (checked out), a bare origin, and the workflow worktree on Orca's branch wf-<id> registered in a fake part A. */
function fixture(t, { jobs = [], orca = fakeOrca(), pendingFails = false, ...seams } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wf-cp-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
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
  const registry = new Map([[WF, { workflowId: WF, orcaWorktreeId: 'orca-wt-1', path: dir, branch: BRANCH, checkpoint: null }]]);
  const checkpoints = [], pending = [], reports = {};
  const worktree = {
    workflowWorktreeOf: (_ctx, id) => (registry.has(id) ? { ...registry.get(id) } : null),
    workflowWorktreeAt: (_ctx, at) => [...registry.values()].find((r) => path.resolve(r.path) === path.resolve(at)) ?? null,
    setCheckpoint: (_ctx, id, sha) => { checkpoints.push(sha); registry.get(id).checkpoint = sha; },
    markReleasePending: (_ctx, id) => { pending.push(id); return pendingFails ? { ok: false, reason: 'registry-unavailable' } : { ok: true }; },
    TERMINAL_JOB_STATUSES: OCCUPYING,
  };
  const ctx = { worktree, orca, db: fakeDb(jobs, reports), lockWaitMs: 5_000, gate: () => ({ exit: 0, counts: { new: 0 }, findings: [], errors: [] }), ...seams };
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
  assert.equal(reviewVerifiedOf(ctx([...verifiedJobs(), job('op-be-2', 'code.refactor', [], { status: 'succeeded', updated_at: 3 })]), { workflowId: WF, head }).code, 'workflow-finish-verify-missing');
  assert.equal(reviewVerifiedOf(ctx([job('op-rv-1', 'review.verify', [], { status: 'failed', updated_at: 2 })]), { workflowId: WF, head }).code, 'workflow-finish-verify-missing');
  assert.equal(reviewVerifiedOf({}, { workflowId: WF, head }).ok, false);
});

test('settle refuses a gate JSON whose base is not the workflow checkpoint (op-gate-base-mismatch)', () => {
  const cp = 'c'.repeat(40);
  const gate = (base) => ({ schema: GATE_SCHEMA, base, exit: 0, counts: { new: 0 }, findings: [], errors: [] });
  const off = judgeLoop({ gate: gate('d'.repeat(40)), digest: null, kinds: [], expectedBase: cp });
  assert.deepEqual([off.status, off.code], ['red', 'op-gate-base-mismatch']);
  assert.equal(judgeLoop({ gate: gate(undefined), digest: null, kinds: [], expectedBase: cp }).code, 'op-gate-base-mismatch');
  assert.notEqual(judgeLoop({ gate: gate(cp), digest: null, kinds: [], expectedBase: cp }).code, 'op-gate-base-mismatch', 'the checkpoint base passes on to the rest of the loop');
  assert.notEqual(judgeLoop({ gate: gate('d'.repeat(40)), digest: null, kinds: [] }).code, 'op-gate-base-mismatch', 'outside a workflow worktree any base is the op\'s own');
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
