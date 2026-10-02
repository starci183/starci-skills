// The mid-workflow rebase (WFWT2 2.1): after a green checkpoint, starci kernel settle asks milestoneRebase, which reads the facts
// and lets scripts/lib/rebase-milestone.mjs decide. Due: the branch is rebased onto main and the checkpoint follows. A
// conflict leaves the branch where it was, keeps its head as preserved/<wf>/rebase-<onto12> and escalates one
// rebase-conflict Decision Item; the same main tip is never tried twice. A live sibling op blocks it.
// Temp git repos and a fake part-A registry: no live Orca call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rebaseMilestone } from '../../scripts/lib/rebase-milestone.mjs';
import { milestoneRebase, milestoneRefOf, settleCheckpoint } from '../../scripts/kernel/workflow-settle.mjs';
import { DI_KINDS } from '../../scripts/machine/decisions.mjs';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { registerWorkflowWorktree } from '../../scripts/kernel/workflow-worktree.mjs';
import { workflowWorktreeOf } from '../../scripts/machine/workflow-tree.mjs';
import { seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { writeGreenProofs } from '../helpers/sonar-scan.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const WF = 'wf-nivo-milestone-k1';
const BRANCH = `wf-${WF}`;
const A = ['l1', 'l2', 'l3', 'l4', 'l5', 'l6', 'l7', 'l8', 'l9', ''].join('\n');
const OCCUPYING = ['leased', 'running', 'answering', 'reported', 'deciding', 'effect_unknown'];
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const commit = (cwd, rel, text, msg = `edit ${rel}`) => { write(cwd, rel, text); git(cwd, 'add', '-A'); git(cwd, 'commit', '-q', '-m', msg); return git(cwd, 'rev-parse', 'HEAD'); };

function fixture(t, { live = [], behindLimit = 3 } = {}) {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wf-ms-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'app'), dir = path.join(base, 'wf');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [k, v] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', k, v);
  write(repo, 'be/a.ts', A);
  write(repo, 'fe/b.ts', 'export const b = 1;\n');
  write(repo, 'docs/readme.md', 'app\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'worktree', 'add', '-q', '-b', BRANCH, dir, 'main');
  const registry = new Map([[WF, { workflowId: WF, orcaWorktreeId: 'orca-wt-1', path: dir, branch: BRANCH, checkpoint: null }]]);
  const escalations = [];
  const jobs = live.map((id) => ({ job_id: id, workflow_id: WF, status: 'running' }));
  const db = { prepare: () => ({ get: () => null, all: (workflowId, exceptId, ...statuses) => jobs.filter((j) => j.workflow_id === workflowId && j.job_id !== exceptId && statuses.includes(j.status)) }) };
  const worktree = {
    workflowWorktreeOf: (_ctx, id) => (registry.has(id) ? { ...registry.get(id) } : null),
    workflowWorktreeAt: () => null,
    setCheckpoint: (_ctx, id, sha) => { registry.get(id).checkpoint = sha; },
    TERMINAL_JOB_STATUSES: OCCUPYING,
  };
  const ctx = { worktree, db, behindLimit, escalate: (e) => { escalations.push(e); return { ok: true, decisionId: `di-${escalations.length}` }; } };
  // The workflow's first checkpoint: a be change on the branch.
  const cp = commit(dir, 'be/a.ts', A.replace('l1', 'wf1'), 'checkpoint be');
  registry.get(WF).checkpoint = cp;
  return { repo, dir, ctx, registry, escalations, cp };
}

test('the milestone policy: every reason, in order', () => {
  const at = (facts) => rebaseMilestone({ idle: true, behind: 1, overlap: 0, onto: 'o', conflictedOnto: null, behindLimit: 5, ...facts });
  assert.deepEqual(at({ idle: false, overlap: 3 }), { due: false, why: 'not-idle' }, 'a live sibling wins over everything');
  assert.deepEqual(at({ behind: 0, overlap: 2 }), { due: false, why: 'up-to-date' });
  assert.deepEqual(at({ overlap: 1, conflictedOnto: 'o' }), { due: false, why: 'conflict-known' });
  assert.deepEqual(at({ overlap: 1, conflictedOnto: 'older' }), { due: true, why: 'overlap' }, 'a main that moved past the conflict is a new attempt');
  assert.deepEqual(at({ behind: 5 }), { due: true, why: 'behind' });
  assert.deepEqual(at({ behind: 4 }), { due: false, why: 'quiet' });
});

test('main moved on a path the branch changed, without conflict: rebased now and the checkpoint follows', (t) => {
  const fx = fixture(t);
  commit(fx.repo, 'fe/y.ts', 'export const y = 1;\n', 'main, a path the branch never touched');
  const r0 = milestoneRebase(fx.ctx, { workflowId: WF, opId: 'op-be-2' });
  assert.deepEqual([r0.due, r0.why], [false, 'quiet'], 'main 1 commit ahead on other paths, under the limit');
  commit(fx.repo, 'be/a.ts', A.replace('l9', 'main9'), 'main edits another hunk of the file the branch changed');
  const r = milestoneRebase(fx.ctx, { workflowId: WF, opId: 'op-be-2' });
  assert.deepEqual([r.due, r.why, r.rebased], [true, 'overlap', true], JSON.stringify(r));
  const head = git(fx.dir, 'rev-parse', 'HEAD');
  assert.equal(r.head, head);
  assert.equal(fx.registry.get(WF).checkpoint, head, 'the checkpoint follows the rebased head');
  assert.equal(spawnSync('git', ['merge-base', '--is-ancestor', git(fx.repo, 'rev-parse', 'main'), head], { cwd: fx.dir }).status, 0, 'main is in the branch');
  assert.equal(fs.readFileSync(path.join(fx.dir, 'be', 'a.ts'), 'utf8'), A.replace('l1', 'wf1').replace('l9', 'main9'), 'both sides kept');
  assert.equal(fx.escalations.length, 0);
  const again = milestoneRebase(fx.ctx, { workflowId: WF, opId: 'op-be-3' });
  assert.deepEqual([again.due, again.why], [false, 'up-to-date']);
});

test('main far ahead on unrelated paths: rebased once it passes the limit', (t) => {
  const fx = fixture(t, { behindLimit: 3 });
  commit(fx.repo, 'fe/x1.ts', '1\n');
  commit(fx.repo, 'fe/x2.ts', '2\n');
  assert.equal(milestoneRebase(fx.ctx, { workflowId: WF, opId: 'op-be-1' }).why, 'quiet');
  commit(fx.repo, 'fe/x3.ts', '3\n');
  const r = milestoneRebase(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  assert.deepEqual([r.due, r.why, r.rebased, r.behind], [true, 'behind', true, 3]);
  assert.ok(fs.existsSync(path.join(fx.dir, 'fe', 'x3.ts')));
});

test('a live sibling op: never rebased, however far main moved', (t) => {
  const fx = fixture(t, { live: ['op-fe-1'], behindLimit: 1 });
  commit(fx.repo, 'be/a.ts', 'export const a = 9;\n');
  const before = git(fx.dir, 'rev-parse', 'HEAD');
  const r = milestoneRebase(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  assert.deepEqual([r.due, r.why], [false, 'not-idle']);
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD'), before);
});

test('a conflict: the branch stays, its head is preserved, one rebase-conflict DI; the same main tip is never retried', (t) => {
  const fx = fixture(t);
  const onto = commit(fx.repo, 'be/a.ts', A.replace('l1', 'main1'));
  const before = git(fx.dir, 'rev-parse', 'HEAD');
  const r = milestoneRebase(fx.ctx, { workflowId: WF, opId: 'op-be-1' });
  assert.deepEqual([r.due, r.why, r.rebased], [true, 'overlap', false], JSON.stringify(r));
  assert.deepEqual(r.conflict.files, ['be/a.ts']);
  assert.equal(r.conflict.preservedRef, milestoneRefOf(WF, onto));
  assert.match(r.conflict.preservedRef, new RegExp(`^refs/heads/preserved/${WF}/rebase-${onto.slice(0, 12)}$`));
  assert.equal(git(fx.dir, 'rev-parse', r.conflict.preservedRef), before, 'the preserved ref holds the head that could not move');
  assert.equal(git(fx.dir, 'rev-parse', 'HEAD'), before, 'the branch stays where it was');
  assert.equal(git(fx.dir, 'status', '--porcelain'), '', 'the aborted rebase leaves a clean tree');
  assert.equal(fx.registry.get(WF).checkpoint, before);
  assert.equal(fx.escalations.length, 1);
  assert.deepEqual([fx.escalations[0].onto, fx.escalations[0].head, fx.escalations[0].files], [onto, before, ['be/a.ts']]);
  const again = milestoneRebase(fx.ctx, { workflowId: WF, opId: 'op-be-2' });
  assert.deepEqual([again.due, again.why], [false, 'conflict-known']);
  assert.equal(fx.escalations.length, 1, 'never escalated twice for one main tip');
  commit(fx.repo, 'docs/readme.md', 'moved on\n');
  const later = milestoneRebase(fx.ctx, { workflowId: WF, opId: 'op-be-3' });
  assert.equal(later.due, true, 'a main that moved further is a new attempt');
  assert.equal(fx.escalations.length, 2);
});

test('settleCheckpoint rebases only after a green checkpoint; rebase-conflict is a Decision Item kind', (t) => {
  const fx = fixture(t, { behindLimit: 1 });
  commit(fx.repo, 'fe/x1.ts', '1\n');
  write(fx.dir, 'be/d.ts', 'export const d = 1;\n');
  const failed = settleCheckpoint(fx.ctx, { workflowId: WF, opId: 'op-be-1', pass: false });
  assert.equal(failed.kind, 'workflow-op-preserved');
  assert.equal(failed.milestone, undefined, 'a failed op never rebases');
  write(fx.dir, 'be/d.ts', 'export const d = 2;\n');
  const green = settleCheckpoint(fx.ctx, { workflowId: WF, opId: 'op-be-2', pass: true });
  assert.equal(green.kind, 'workflow-checkpoint');
  assert.deepEqual([green.milestone.due, green.milestone.why, green.milestone.rebased], [true, 'behind', true]);
  assert.equal(fx.registry.get(WF).checkpoint, green.milestone.head, 'the checkpoint follows the milestone rebase');
  assert.ok(DI_KINDS.includes('rebase-conflict'));
  const codes = fs.readFileSync(path.join(ROOT, 'modules', 'kernel', 'failure-codes.yaml'), 'utf8');
  assert.match(codes, /^rebase-conflict:\n/m, 'the DI kind has its failure-code entry');
});

test('starci kernel settle records a workflow checkpoint only for a green op', (t) => {
  const base = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'starci-wf-settle-')));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'app'), tree = path.join(base, 'workflow');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  for (const [key, value] of [['user.email', 'spec@starci.test'], ['user.name', 'spec'], ['core.autocrlf', 'false']]) git(repo, 'config', key, value);
  write(repo, '.gitignore', '.starciwork/\n');
  write(repo, 'docs/base.md', 'base\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  const workflowId = 'wf-settle-caller', branch = `wf-${workflowId}`;
  git(repo, 'worktree', 'add', '-q', '-b', branch, tree, 'main');
  const env = { ...process.env, [TEST_REGISTRY_ENV]: path.join(base, 'machine.sqlite'), LOCALAPPDATA: path.join(base, 'localappdata'),
    STARCI_OWNER_ROOT: path.join(base, 'owner') };
  registerWorkflowWorktree({ env }, { workflowId, orcaWorktreeId: 'repo-settle::workflow', path: tree, branch });
  const runApi = (args, extraEnv = {}) => spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'kernel', 'cli.mjs'), ...args, '--repo', repo, '--json'],
    { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180000, env: { ...env, ...extraEnv } });
  const seed = (job) => {
    const ledger = openLedger({ file: ledgerFileFor(repo, { env }) });
    try {
      const exists = ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(workflowId) != null;
      seedWorkflow(ledger, { id: workflowId, ...(exists ? {} : { goal: { revision: 1, markdown: '# Settle caller' } }), jobs: [job] });
      const attemptId = ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(job.jobId).attempt_id;
      ledger.write.writeContract({ attemptId, markdown: '# contract', context: { worktree: tree } });
      return { ledger, attemptId };
    } catch (error) { ledger.close(); throw error; }
  };
  const read = (fn) => { const ledger = inspectLedger({ file: ledgerFileFor(repo, { env }) }); try { return fn(ledger.db); } finally { ledger.close(); } };

  const passJob = 'op-docs.author-checkpoint';
  const pass = seed({ jobId: passJob, opId: 'docs.author', status: 'running', dispatchId: 'ctx-pass', payload: { opId: 'docs.author', owned_paths: ['docs/'] } });
  try {
    write(tree, 'docs/pass.md', 'settled green\n');
    const proofFiles = writeGreenProofs(path.join(tree, 'docs', 'proofs')).map((file) => path.relative(tree, file).replace(/\\/g, '/'));
    pass.ledger.write.fileReport({ attemptId: pass.attemptId, outcome: 'done', report: { schema: 'starci/op-report@1', outcome: 'done', summary: 'green', files: ['docs/pass.md', ...proofFiles], checks: [{ name: 'unit', command: 'true', exitCode: 0 }] } });
  } finally { pass.ledger.close(); }
  const checked = runApi(['record-checks', '--job', passJob, '--checks', JSON.stringify({ checks: [{ name: 'unit', command: 'true', exitCode: 0, evidence: 'green' }] })], { STARCI_CALLER: 'runtime-settler' });
  assert.equal(checked.status, 0, checked.stderr || checked.stdout);
  const settled = runApi(['settle', '--job', passJob, '--verdict', 'pass']);
  assert.equal(settled.status, 0, settled.stderr || settled.stdout);
  const checkpoint = read((db) => db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='workflow-checkpoint'").get(passJob));
  assert.ok(checkpoint, 'starci kernel settle writes the workflow-checkpoint event');
  const passHead = JSON.parse(checkpoint.payload_json).sha;
  assert.equal(workflowWorktreeOf({ env }, workflowId).checkpoint, passHead, 'starci kernel settle advances the workflow checkpoint head');

  const failJob = 'op-docs.author-failed';
  const failed = seed({ jobId: failJob, opId: 'docs.author', status: 'running', dispatchId: 'ctx-fail', payload: { opId: 'docs.author', owned_paths: ['failed/'] } });
  failed.ledger.close();
  write(tree, 'failed/work.md', 'not accepted\n');
  const rejected = runApi(['settle', '--job', failJob, '--verdict', 'fail']);
  assert.equal(rejected.status, 0, rejected.stderr || rejected.stdout);
  assert.equal(read((db) => db.prepare("SELECT count(*) AS n FROM events WHERE entity_id=? AND kind='workflow-checkpoint'").get(failJob).n), 0,
    'a failed verdict produces no workflow checkpoint');
  assert.equal(read((db) => db.prepare("SELECT count(*) AS n FROM events WHERE entity_id=? AND kind='workflow-op-preserved'").get(failJob).n), 1);
  assert.equal(workflowWorktreeOf({ env }, workflowId).checkpoint, passHead, 'the failed verdict leaves the checkpoint head unchanged');
});
