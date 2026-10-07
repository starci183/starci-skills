// A job's check re-run executes in its workflow's registered worktree, never the main checkout (kprop-2fd7cb3586):
// a record the op created exists only in the worktree, so a re-run on main is a false red (or a vacuous green).
import { fileDispatchContract } from '../helpers/filed-contract.mjs';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { recordCheck } from '../../scripts/machine/evidence-store.mjs';
import { verifyReported, settlerSettings } from '../../scripts/kernel/settle/job-settle.mjs';
import { checkRerunRootOf } from '../../scripts/kernel/verbs/shared/check-evidence.mjs';
import { registerWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';

const RECORD = '.starciwork/features/authentication/scope.md';
const git = (cwd, ...args) => { const r = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8' }); assert.equal(r.status, 0, r.stderr); return r.stdout.trim(); };
const settings = { ...settlerSettings({}), itemBudgetMs: 60_000 };

/** A main checkout and its workflow worktree; the op's new record exists only in the worktree. */
function mainAndWorktree(root) {
  git(root, 'init', '-q', '-b', 'main'); git(root, 'config', 'user.email', 't@t'); git(root, 'config', 'user.name', 't');
  fs.writeFileSync(path.join(root, 'README.md'), 'main\n');
  git(root, 'add', '-A'); git(root, 'commit', '-qm', 'base');
  const tree = path.join(path.dirname(root), 'wf-tree');
  git(root, 'worktree', 'add', '-q', '-b', 'wf-x', tree, 'main');
  fs.mkdirSync(path.dirname(path.join(tree, RECORD)), { recursive: true });
  fs.writeFileSync(path.join(tree, RECORD), '# scope\n');
  return tree;
}

/** A reported code.refactor job declaring the incident's validate check (exit 0), its contract filed in `tree`. */
function reportedJob(ledger, { root, tree, workflowWorktree, workflowId = 'wf-x', jobId = 'op-code.refactor-aaa' }) {
  const item = { jobId, workflowId, op: 'code.refactor', attempt: 1, outcome: 'done', dispatchId: `ctx_${jobId}`,
    payload: { owned_paths: ['src/slice'] },
    report: { checks: [{ name: 'validate-strict', command: 'starci runtime validate .starciwork/features/authentication --json --strict', exitCode: 0 }] } };
  seedWorkflow(ledger, { id: workflowId, state: { phase: 'running' }, jobs: [{ jobId, opId: item.op, status: 'running', dispatchId: item.dispatchId, payload: item.payload }] });
  fileDispatchContract(ledger, { jobId, repo: root, tree, workflowWorktree });
  const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
  ledger.transaction((db) => { for (const c of item.report.checks) recordCheck(db, { attemptId, name: c.name, phase: 'after', runner: 'op', command: c.command, exitCode: c.exitCode }); });
  return item;
}

/** A re-run seam that passes only where the op's record exists, remembering every cwd it ran in. */
const recordingRerun = (cwds) => (c, { repo }) => {
  cwds.push(path.resolve(repo));
  const ok = fs.existsSync(path.join(repo, RECORD));
  return { exitCode: ok ? 0 : 1, ms: 5, tail: ok ? '' : 'TARGET_MISSING', processStatus: ok ? 0 : 1, cwd: repo };
};

test('the settler re-runs a declared check in the registered workflow worktree, where the op\'s record exists', async (t) => withLedger(t, async ({ repoRoot: root, ledger }) => {
  const tree = mainAndWorktree(root);
  const workflowWorktree = registerWorkflowWorktree({ env: process.env }, { workflowId: 'wf-x', orcaWorktreeId: 'check-rerun::wf-x', path: tree, branch: 'wf-x' });
  const item = reportedJob(ledger, { root, tree, workflowWorktree });
  assert.equal(checkRerunRootOf(ledger.db, ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(item.jobId), { repo: root }), path.resolve(tree));
  const cwds = [];
  const verdict = await verifyReported(ledger.db, item, { repo: root, settings, rerun: recordingRerun(cwds), parity: null });
  assert.deepEqual(cwds, [path.resolve(tree)], 'the re-run ran in the worktree, never in main');
  assert.equal(verdict.green, true, JSON.stringify(verdict));
}));

test('a Git workflow whose worktree is not registered refuses the re-run, never falling back to main', async (t) => withLedger(t, async ({ repoRoot: root, ledger }) => {
  const tree = mainAndWorktree(root);
  const item = reportedJob(ledger, { root, tree, workflowWorktree: { workflowId: 'wf-x', path: tree, branch: 'wf-x' } });
  const job = ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(item.jobId);
  assert.throws(() => checkRerunRootOf(ledger.db, job, { repo: root }), (e) => e.code === 'check-rerun-worktree-unresolved' && e.reason === 'workflow-worktree-missing');
  const cwds = [];
  const verdict = await verifyReported(ledger.db, item, { repo: root, settings, rerun: recordingRerun(cwds), parity: null });
  assert.deepEqual(cwds, [], 'nothing re-ran in main');
  assert.equal(verdict.green, false);
  assert.equal(verdict.unavailable, true, 'an unresolved tree is unavailable (H7), never a red or a green');
  assert.equal(verdict.code, 'check-rerun-worktree-unresolved');
}));

test('a workflow worktree that is gone refuses the re-run', async (t) => withLedger(t, async ({ repoRoot: root, ledger }) => {
  const tree = mainAndWorktree(root);
  const workflowWorktree = registerWorkflowWorktree({ env: process.env }, { workflowId: 'wf-x', orcaWorktreeId: 'check-rerun::gone', path: tree, branch: 'wf-x' });
  const item = reportedJob(ledger, { root, tree, workflowWorktree });
  git(root, 'worktree', 'remove', '--force', tree);
  const cwds = [];
  const verdict = await verifyReported(ledger.db, item, { repo: root, settings, rerun: recordingRerun(cwds), parity: null });
  assert.deepEqual(cwds, []);
  assert.equal(verdict.unavailable, true);
  assert.equal(verdict.code, 'check-rerun-worktree-unresolved');
}));

test('a non-Git ledger with no registered tree re-runs in the ledger repo', (t) => withLedger(t, ({ repoRoot: root, ledger }) => {
  seedWorkflow(ledger, { id: 'wf-plain', state: { phase: 'running' }, jobs: [{ jobId: 'op-plain', opId: 'code.refactor', status: 'running', dispatchId: 'ctx_plain', payload: { owned_paths: ['src/slice'] } }] });
  const job = ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get('op-plain');
  assert.equal(checkRerunRootOf(ledger.db, job, { repo: root, appRepoOf: () => null }), path.resolve(root));
}));
