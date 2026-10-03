// The mid-workflow rebase (WFWT2 2.1): after a green checkpoint, starci kernel settle asks milestoneRebase, which reads the facts
// and lets scripts/lib/rebase-milestone.mjs decide. Due: the branch is rebased onto main and the checkpoint follows. A
// conflict leaves the branch where it was, keeps its head as preserved/<wf>/rebase-<onto12> and escalates one
// rebase-conflict Decision Item; the same main tip is never tried twice. A live sibling op blocks it.
// Temp git repos and a fake part-A registry: no live Orca call.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rebaseMilestone } from '../../scripts/lib/rebase-milestone.mjs';
import { milestoneRebase, milestoneRefOf, settleCheckpoint } from '../../scripts/kernel/workflow-settle.mjs';
import { finishWorkflow, rebaseWorkflow } from '../../scripts/kernel/workflow-checkpoint.mjs';
import { DI_KINDS } from '../../scripts/machine/decisions.mjs';
import { ledgerFileFor, openLedger } from '../../engine/db/ledger.mjs';
import { openMachine, TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { workflowWorktreeOf } from '../../scripts/machine/workflow-tree.mjs';
import { writeGreenProofs } from '../helpers/sonar-scan.mjs';
import { acceptedEventFault, apiResult, awaitFile, emptyReceiptBarrier, milestoneRegistryFault, settleFixture } from '../helpers/workflow-settle-fixture.mjs';
import { milestoneFixture as fixture, MILESTONE_ID as WF, MILESTONE_TEXT as A } from '../helpers/workflow-settle-fixture.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write = (root, rel, text) => { fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true }); fs.writeFileSync(path.join(root, rel), text); };
const commit = (cwd, rel, text, msg = `edit ${rel}`) => { write(cwd, rel, text); git(cwd, 'add', '-A'); git(cwd, 'commit', '-q', '-m', msg); return git(cwd, 'rev-parse', 'HEAD'); };

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
  const { tree, env, workflowId, runApi, seed, read, capture } = settleFixture(t);

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

  write(tree, 'docs/pass.md', 'unaccepted change after this dispatch settled\n');
  const unchanged = () => ({ ...capture(passJob), file: fs.readFileSync(path.join(tree, 'docs/pass.md'), 'utf8') });
  const beforeDuplicate = unchanged();
  const duplicate = runApi(['settle', '--job', passJob, '--verdict', 'pass']);
  assert.notEqual(duplicate.status, 0, 'an already settled dispatch cannot settle twice');
  assert.equal(apiResult(duplicate).code, 'job-settled');
  assert.deepEqual(unchanged(), beforeDuplicate, 'duplicate refusal changes no branch, index, registry, checkpoint event, owned bytes or outbox');
  write(tree, 'docs/pass.md', 'settled green\n');

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

for (const refusal of [
  { name: 'missing done report', code: 'pass-report-missing', report: false },
  { name: 'independent checks red', code: 'checks-not-green', checkExit: 1 },
  { name: 'independent checks absent', code: 'checks-not-green', checkExit: null, opId: 'perf.verify' },
  { name: 'worker outcome disagrees', code: 'verdict-outcome-mismatch', outcome: 'failed' },
  { name: 'cut check names absent', code: 'cut-checks-missing', payload: { cut: { id: 'checkpoint-cut', ordinal: 1, total: 2 } } },
  { name: 'handover lacks owner approval', code: 'handover-not-approved', opId: 'handover.review' },
]) {
  test(`settle ${refusal.name} refuses before any checkpoint effect`, (t) => {
    const fx = settleFixture(t), jobId = 'op-late-refusal';
    fx.prepare({ jobId, ...refusal });
    git(fx.tree, 'add', 'docs/change.md');
    const before = fx.capture(jobId);
    const rejected = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass']);
    assert.notEqual(rejected.status, 0, `${refusal.name} must refuse`);
    assert.equal(apiResult(rejected).code, refusal.code);
    assert.deepEqual(fx.capture(jobId), before, `${refusal.name} leaves branch, index, owned delta, registry, accepted events and attempt unchanged`);
  });
}

test('an unchanged accepted dispatch explicitly reuses its checkpoint without another commit', (t) => {
  const fx = settleFixture(t), first = 'op-changed', second = 'op-unchanged';
  fx.prepare({ jobId: first });
  const accepted = fx.runApi(['settle', '--job', first, '--verdict', 'pass']);
  assert.equal(accepted.status, 0, accepted.stderr || accepted.stdout);
  const firstCheckpoint = apiResult(accepted).checkpoint;
  assert.equal(firstCheckpoint.committed, true);
  const next = fx.seed({ jobId: second, opId: 'docs.author', status: 'running', dispatchId: 'ctx-unchanged', payload: { opId: 'docs.author', owned_paths: ['docs/'] } });
  try {
    const files = fs.readdirSync(path.join(fx.tree, 'docs', 'proofs')).map((file) => `docs/proofs/${file}`);
    next.ledger.write.fileReport({ attemptId: next.attemptId, outcome: 'done', report: { schema: 'starci/op-report@1', outcome: 'done', summary: 'verified existing bytes', files, head: firstCheckpoint.sha } });
    next.ledger.write.recordCheckRun({ attemptId: next.attemptId, name: 'unit', phase: 'verify', runner: 'kernel', status: 'pass', exitCode: 0 });
  } finally { next.ledger.close(); }
  const result = fx.runApi(['settle', '--job', second, '--verdict', 'pass']);
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const checkpoint = apiResult(result).checkpoint;
  assert.deepEqual([checkpoint.committed, checkpoint.sha, checkpoint.files], [false, firstCheckpoint.sha, []]);
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), firstCheckpoint.sha);
  assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind='workflow-checkpoint'").get(second).n), 1);
});

for (const verdict of ['fail', 'blocked']) {
  test(`${verdict} preserves owned work once and a duplicate refuses without another reset`, (t) => {
    const fx = settleFixture(t), jobId = `op-${verdict}`;
    fx.prepare({ jobId, outcome: verdict === 'fail' ? 'failed' : 'blocked' });
    const base = git(fx.tree, 'rev-parse', 'HEAD');
    const result = fx.runApi(['settle', '--job', jobId, '--verdict', verdict]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const checkpoint = apiResult(result).checkpoint;
    assert.equal(checkpoint.kind, 'workflow-op-preserved');
    assert.equal(checkpoint.resetTo, base);
    assert.ok(checkpoint.preservedRef);
    assert.equal(git(fx.tree, 'show', `${checkpoint.preservedRef}:docs/change.md`), `owned change of ${jobId}`);
    assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), base);
    assert.equal(fs.existsSync(path.join(fx.tree, 'docs', 'change.md')), false);
    assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind='workflow-checkpoint'").get(jobId).n), 0);
    write(fx.tree, 'docs/change.md', 'later work must survive a duplicate verdict\n');
    const before = fx.capture(jobId), preserved = git(fx.tree, 'rev-parse', checkpoint.preservedRef);
    const duplicate = fx.runApi(['settle', '--job', jobId, '--verdict', verdict]);
    assert.notEqual(duplicate.status, 0);
    assert.equal(apiResult(duplicate).code, 'job-settled');
    assert.deepEqual(fx.capture(jobId), before);
    assert.equal(git(fx.tree, 'rev-parse', checkpoint.preservedRef), preserved);
  });
}

test('a registered Git placement whose registry row disappeared refuses instead of skipping checkpoint', (t) => {
  const fx = settleFixture(t), jobId = 'op-missing-registry';
  fx.prepare({ jobId });
  const machine = openMachine({ file: fx.env[TEST_REGISTRY_ENV], env: fx.env });
  try { machine.db.prepare("DELETE FROM worktrees WHERE kind='workflow' AND workflow_id=?").run(fx.workflowId); } finally { machine.close(); }
  const before = fx.capture(jobId);
  const rejected = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass']);
  assert.notEqual(rejected.status, 0, 'a bound Git workflow owes a checkpoint even if its registry row disappeared');
  assert.equal(apiResult(rejected).code, 'workflow-worktree-missing');
  assert.deepEqual(fx.capture(jobId), before);
});

test('an accepted-event write failure resumes its frozen native decision and original dispatch commit', (t) => {
  const fx = settleFixture(t), jobId = 'op-native-event-interruption';
  const attemptId = fx.prepare({ jobId }), base = git(fx.tree, 'rev-parse', 'HEAD');
  const preload = acceptedEventFault(fx);
  const interrupted = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass'], {}, preload);
  assert.notEqual(interrupted.status, 0);
  assert.equal(apiResult(interrupted).code, 'injected-accepted-event-failure');
  const prepared = fx.read((db) => JSON.parse(db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND attempt_id=? AND kind='workflow-checkpoint-prepared'").get(jobId, attemptId).payload_json));
  assert.ok(prepared.settlement, 'native acceptance custody survives separately from the failed final transaction');
  assert.deepEqual([prepared.committed, prepared.attemptId, prepared.dispatchId], [true, attemptId, `ctx-${jobId}`]);
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), prepared.sha);
  assert.equal(git(fx.tree, 'rev-parse', `${prepared.sha}^`), base);
  assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, prepared.sha);
  assert.equal(fx.read((db) => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status), 'running');
  assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind IN ('workflow-checkpoint','op-settled')").get(jobId).n), 0);
  const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
  try { ledger.write.recordCheckRun({ attemptId, name: 'unit', phase: 'verify', runner: 'kernel', status: 'fail', exitCode: 1 }); } finally { ledger.close(); }
  const resumed = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass']);
  assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
  const result = apiResult(resumed);
  assert.deepEqual([result.checkEvidence.green, result.checkpoint.sha, result.checkpoint.committed, result.checkpoint.attemptId, result.checkpoint.dispatchId],
    [true, prepared.sha, true, attemptId, `ctx-${jobId}`]);
  assert.equal(git(fx.tree, 'rev-list', '--count', `${base}..HEAD`), '1');
  assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND attempt_id=? AND kind='workflow-checkpoint'").get(jobId, attemptId).n), 1);
  assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND attempt_id=? AND kind='op-settled'").get(jobId, attemptId).n), 1);
});

for (const verdict of ['pass', 'fail']) test(`a same-dispatch ${verdict} waiter refreshes acceptance after its initial empty receipt read`, async (t) => {
  const fx = settleFixture(t), jobId = `op-waiter-${verdict}`;
  const attemptId = fx.prepare({ jobId });
  const { preload, seen, release } = emptyReceiptBarrier(fx);
  const waiter = fx.runConcurrentApi(['settle', '--job', jobId, '--verdict', verdict], preload);
  let completed = false;
  try {
    await awaitFile(seen);
    assert.equal(JSON.parse(fs.readFileSync(seen, 'utf8')), null, 'the waiter actually read before the first intent existed');
    const interrupted = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass'], {}, acceptedEventFault(fx));
    assert.notEqual(interrupted.status, 0);
    assert.equal(apiResult(interrupted).code, 'injected-accepted-event-failure');
    const prepared = fx.read((db) => JSON.parse(db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND attempt_id=? AND kind='workflow-checkpoint-prepared'").get(jobId, attemptId).payload_json));
    assert.equal(prepared.settlement.verdict, 'pass');
    const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
    try { ledger.write.recordCheckRun({ attemptId, name: 'unit', phase: 'verify', runner: 'kernel', status: 'fail', exitCode: 1 }); } finally { ledger.close(); }
    const before = fx.capture(jobId);
    fs.writeFileSync(release, 'continue\n');
    const result = await waiter;
    completed = true;
    if (verdict === 'fail') {
      assert.notEqual(result.status, 0);
      assert.equal(apiResult(result).code, 'workflow-checkpoint-recovery-conflict');
      assert.deepEqual(fx.capture(jobId), before, 'an opposite verdict cannot replace the intent observed after acquiring the workflow lock');
      const resumed = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass']);
      assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
      assert.equal(apiResult(resumed).checkpoint.sha, prepared.sha);
    } else {
      assert.equal(result.status, 0, result.stderr || result.stdout);
      const resumed = apiResult(result);
      assert.deepEqual([resumed.checkEvidence.green, resumed.checkpoint.sha, resumed.checkpoint.committed, resumed.checkpoint.attemptId, resumed.checkpoint.dispatchId],
        [true, prepared.sha, true, attemptId, `ctx-${jobId}`]);
    }
    assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), prepared.sha);
    assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind='workflow-op-preserved-prepared'").get(jobId).n), 0);
    for (const kind of ['workflow-checkpoint-prepared', 'workflow-checkpoint-applied', 'workflow-checkpoint', 'op-settled']) {
      assert.equal(fx.read((db) => db.prepare('SELECT count(*) n FROM events WHERE entity_id=? AND attempt_id=? AND kind=?').get(jobId, attemptId, kind).n), 1);
    }
  } finally {
    fs.writeFileSync(release, 'continue\n');
    if (!completed) await waiter;
  }
});

for (const [verdict, outcome, kind] of [['pass', 'done', 'workflow-checkpoint'], ['blocked', 'blocked', 'workflow-op-preserved']]) {
  test(`direct rebase and finish hold an unfinished native ${kind} intent without touching Git or gates`, (t) => {
    const fx = settleFixture(t), jobId = `op-pending-${verdict}`;
    fx.prepare({ jobId, outcome });
    const interrupted = fx.runApi(['settle', '--job', jobId, '--verdict', verdict], {}, acceptedEventFault(fx, kind));
    assert.notEqual(interrupted.status, 0);
    assert.equal(apiResult(interrupted).code, 'injected-accepted-event-failure');
    const prepared = fx.read((db) => JSON.parse(db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=?').get(jobId, `${kind}-prepared`).payload_json));
    assert.ok(prepared.settlement);
    assert.equal(fx.read((db) => db.prepare('SELECT count(*) n FROM events WHERE entity_id=? AND kind=?').get(jobId, kind).n), 0);
    const main = commit(fx.repo, 'docs/main.md', 'main advanced independently\n');
    const before = fx.capture(jobId), ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
    let gated = 0;
    try {
      const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env, gate: () => { gated++; throw new Error('a pending intent must stop before the branch gate'); } };
      assert.throws(() => rebaseWorkflow(ctx, { workflowId: fx.workflowId }), { code: 'workflow-checkpoint-recovery-required' });
      assert.deepEqual(fx.capture(jobId), before);
      const finish = finishWorkflow(ctx, { workflowId: fx.workflowId });
      assert.equal(finish.ok, false);
      assert.deepEqual([finish.refusal.step, finish.refusal.code], ['gate', 'workflow-checkpoint-recovery-required']);
      assert.equal(gated, 0);
      assert.deepEqual(fx.capture(jobId), before);
      assert.equal(git(fx.repo, 'rev-parse', 'HEAD'), main);
    } finally { ledger.close(); }
    const resumed = fx.runApi(['settle', '--job', jobId, '--verdict', verdict]);
    assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
    assert.equal(apiResult(resumed).checkpoint.sha, prepared.sha);
  });
}

test('an accepted native checkpoint permits its own due milestone before its final event', (t) => {
  const fx = settleFixture(t, { baseText: A }), jobId = 'op-own-milestone';
  fx.prepare({ jobId });
  write(fx.tree, 'docs/base.md', A.replace('l1', 'workflow1'));
  const onto = commit(fx.repo, 'docs/base.md', A.replace('l9', 'main9'));
  const settled = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass']);
  assert.equal(settled.status, 0, settled.stderr || settled.stdout);
  const result = apiResult(settled), head = git(fx.tree, 'rev-parse', 'HEAD');
  assert.deepEqual([result.checkpoint.milestone.due, result.checkpoint.milestone.why, result.checkpoint.milestone.rebased], [true, 'overlap', true]);
  assert.equal(result.checkpoint.milestone.onto, onto);
  assert.equal(result.checkpoint.milestone.head, head);
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD^'), onto);
  assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, head);
  assert.equal(fs.readFileSync(path.join(fx.tree, 'docs/base.md'), 'utf8'), A.replace('l1', 'workflow1').replace('l9', 'main9'));
  assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind='workflow-checkpoint'").get(jobId).n), 1);
});

test('a due milestone registry failure and final-event failure recover the original dispatch without another rebase', (t) => {
  const fx = settleFixture(t, { baseText: A }), jobId = 'op-milestone-registry-recovery';
  const attemptId = fx.prepare({ jobId });
  write(fx.tree, 'docs/base.md', A.replace('l1', 'workflow1'));
  const onto = commit(fx.repo, 'docs/base.md', A.replace('l9', 'main9'));
  const { preload, writes } = milestoneRegistryFault(fx);
  const interrupted = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass'], {}, preload);
  assert.notEqual(interrupted.status, 0);
  assert.equal(apiResult(interrupted).code, 'workflow-worktree-missing');
  const [original, rebased] = JSON.parse(fs.readFileSync(writes, 'utf8'));
  assert.ok(original && rebased && original !== rebased, 'the fault actually happened after the branch rebase');
  const prepared = fx.read((db) => JSON.parse(db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND attempt_id=? AND kind='workflow-checkpoint-prepared'").get(jobId, attemptId).payload_json));
  assert.deepEqual([prepared.sha, prepared.committed, prepared.attemptId, prepared.dispatchId], [original, true, attemptId, `ctx-${jobId}`]);
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), rebased);
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD^'), onto);
  assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, original);
  assert.equal(fx.read((db) => db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status), 'running');
  assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind IN ('workflow-checkpoint','op-settled')").get(jobId).n), 0);
  const finalFault = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass'], {}, acceptedEventFault(fx));
  assert.notEqual(finalFault.status, 0);
  assert.equal(apiResult(finalFault).code, 'injected-accepted-event-failure', 'recovery must reach the native final transaction');
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), rebased);
  assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, rebased);
  const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
  try { ledger.write.recordCheckRun({ attemptId, name: 'unit', phase: 'verify', runner: 'kernel', status: 'fail', exitCode: 1 }); } finally { ledger.close(); }
  const resumed = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass']);
  assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
  const result = apiResult(resumed);
  assert.deepEqual([result.checkEvidence.green, result.checkpoint.sha, result.checkpoint.committed, result.checkpoint.attemptId, result.checkpoint.dispatchId],
    [true, original, true, attemptId, `ctx-${jobId}`]);
  assert.deepEqual([result.checkpoint.milestone.due, result.checkpoint.milestone.rebased, result.checkpoint.milestone.onto, result.checkpoint.milestone.head],
    [true, true, onto, rebased]);
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), rebased);
  assert.equal(git(fx.tree, 'rev-list', '--count', `${onto}..HEAD`), '1');
  assert.equal(git(fx.tree, 'status', '--porcelain'), '');
  assert.equal(fs.readFileSync(path.join(fx.tree, 'docs/base.md'), 'utf8'), A.replace('l1', 'workflow1').replace('l9', 'main9'));
  for (const kind of ['workflow-checkpoint-prepared', 'workflow-checkpoint-applied', 'workflow-checkpoint', 'op-settled']) {
    assert.equal(fx.read((db) => db.prepare('SELECT count(*) n FROM events WHERE entity_id=? AND attempt_id=? AND kind=?').get(jobId, attemptId, kind).n), 1);
  }
  const event = fx.read((db) => JSON.parse(db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND attempt_id=? AND kind='workflow-checkpoint'").get(jobId, attemptId).payload_json));
  assert.deepEqual(event, result.checkpoint);
});

test('a native accepted dispatch interrupted after the milestone branch CAS recovers its saved rebase proposal', (t) => {
  const fx = settleFixture(t, { baseText: A }), jobId = 'op-milestone-cas-interruption';
  const attemptId = fx.prepare({ jobId });
  write(fx.tree, 'docs/base.md', A.replace('l1', 'workflow1'));
  const interrupted = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass'], {}, acceptedEventFault(fx));
  assert.equal(apiResult(interrupted).code, 'injected-accepted-event-failure');
  const checkpoint = fx.read((db) => JSON.parse(db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='workflow-checkpoint-prepared'").get(jobId).payload_json));
  const onto = commit(fx.repo, 'docs/base.md', A.replace('l9', 'main9'));
  const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
  let proposal;
  try {
    const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env, settlement: checkpoint.settlement, checkpointPhase: (phase) => {
      if (phase === 'rebase-branch-applied') throw Object.assign(new Error('private crash after milestone CAS'), { code: 'injected-rebase-interruption' });
    } };
    assert.throws(() => settleCheckpoint(ctx, { workflowId: fx.workflowId, opId: jobId, pass: true }), { code: 'injected-rebase-interruption' });
    proposal = JSON.parse(ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='workflow-rebase-prepared'").get(fx.workflowId).payload_json);
    assert.deepEqual([proposal.before, proposal.onto, proposal.attemptId, proposal.dispatchId], [checkpoint.sha, onto, attemptId, `ctx-${jobId}`]);
    assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), proposal.proposed);
    assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, checkpoint.sha);
    assert.equal(ledger.db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND kind='workflow-checkpoint'").get(jobId).n, 0);
  } finally { ledger.close(); }
  const resumed = fx.runApi(['settle', '--job', jobId, '--verdict', 'pass']);
  assert.equal(resumed.status, 0, resumed.stderr || resumed.stdout);
  const result = apiResult(resumed);
  assert.deepEqual([result.checkpoint.sha, result.checkpoint.committed, result.checkpoint.attemptId, result.checkpoint.dispatchId], [checkpoint.sha, true, attemptId, `ctx-${jobId}`]);
  assert.deepEqual([result.checkpoint.milestone.rebased, result.checkpoint.milestone.head, result.checkpoint.milestone.onto], [true, proposal.proposed, onto]);
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD'), proposal.proposed);
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD^'), onto);
  assert.equal(git(fx.tree, 'status', '--porcelain'), '');
  assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, proposal.proposed);
  for (const kind of ['workflow-rebase-prepared', 'workflow-rebase-applied', 'workflow-checkpoint', 'op-settled']) {
    assert.equal(fx.read((db) => db.prepare('SELECT count(*) n FROM events WHERE workflow_id=? AND attempt_id=? AND kind=?').get(fx.workflowId, attemptId, kind).n), 1);
  }
});

for (const phase of ['before', 'rebase-prepared', 'rebase-branch-applied', 'rebase-index-applied', 'rebase-applied']) {
  test(`a directory obstructing a main file after ${phase} keeps its private untracked bytes during rebase retry`, (t) => {
    const fx = settleFixture(t), jobId = 'op-rebase-obstruction';
    const seeded = fx.seed({ jobId, opId: 'docs.author', status: 'running', dispatchId: 'ctx-obstruction', payload: { opId: 'docs.author', owned_paths: ['docs/'] } });
    seeded.ledger.close();
    const onto = commit(fx.repo, 'docs/blocker', 'the tracked file on main\n');
    const ledger = openLedger({ file: ledgerFileFor(fx.repo, { env: fx.env }) });
    try {
      const ctx = { db: ledger.db, ledger, repo: fx.repo, env: fx.env };
      if (phase !== 'before') {
        assert.throws(() => rebaseWorkflow({ ...ctx, checkpointPhase: (at) => {
          if (at === phase) throw Object.assign(new Error(`private interruption at ${phase}`), { code: 'injected-rebase-interruption' });
        } }, { workflowId: fx.workflowId }), { code: 'injected-rebase-interruption' });
      }
      const blocker = path.join(fx.tree, 'docs/blocker');
      if (fs.existsSync(blocker)) fs.rmSync(blocker, { force: true });
      write(fx.tree, 'docs/blocker/local.txt', 'private untracked bytes must survive\n');
      const before = fx.capture(jobId);
      let refused;
      try { refused = rebaseWorkflow(ctx, { workflowId: fx.workflowId }); } catch (error) { refused = { ok: false, code: error.code }; }
      const proof = JSON.stringify({ result: refused, directory: git(fx.tree, 'ls-files', '--others', '--directory', '--no-empty-directory', '-z'),
        plain: git(fx.tree, 'ls-files', '--others', '-z'), scoped: git(fx.tree, 'ls-files', '--others', '-z', '--', ':(literal)docs/blocker/') });
      const local = path.join(blocker, 'local.txt');
      assert.ok(fs.existsSync(local), `private untracked file disappeared: ${proof}`);
      assert.equal(fs.readFileSync(local, 'utf8'), 'private untracked bytes must survive\n', proof);
      assert.deepEqual(fx.capture(jobId), before, `HEAD, index, registry and every durable effect remain unchanged: ${proof}`);
      if (phase === 'rebase-applied') assert.deepEqual([refused.ok, refused.already], [true, true], 'a completed rebase has no reset left to perform');
      else {
        assert.equal(refused.ok, false, `a scratch proposal cannot authorize replacing the real untracked directory: ${proof}`);
        assert.equal(refused.code, 'workflow-checkpoint-recovery-conflict', proof);
      }
      assert.equal(git(fx.repo, 'rev-parse', 'HEAD'), onto);
    } finally { ledger.close(); }
  });
}

test('concurrent direct settle calls each attach one scoped checkpoint on the workflow chain', async (t) => {
  const fx = settleFixture(t), jobs = ['op-sibling-a', 'op-sibling-b'];
  const attempts = jobs.map((jobId, index) => fx.prepare({ jobId, ownedRoot: `docs/${index === 0 ? 'a' : 'b'}` }));
  const base = git(fx.tree, 'rev-parse', 'HEAD');
  const results = await Promise.all(jobs.map((jobId) => fx.runConcurrentApi(['settle', '--job', jobId, '--verdict', 'pass'])));
  const checkpoints = results.map((result, index) => {
    assert.equal(result.status, 0, result.stderr || result.stdout);
    const checkpoint = apiResult(result).checkpoint;
    assert.deepEqual([checkpoint.committed, checkpoint.attemptId, checkpoint.dispatchId], [true, attempts[index], `ctx-${jobs[index]}`]);
    const root = `docs/${index === 0 ? 'a' : 'b'}/`;
    assert.ok(checkpoint.files.length > 0);
    assert.ok(checkpoint.files.every((file) => file.startsWith(root)), 'no sibling source or proof enters the other commit');
    const committed = git(fx.tree, 'show', '--name-only', '--format=', checkpoint.sha).split(/\r?\n/).filter(Boolean).sort();
    assert.deepEqual(committed, [...checkpoint.files].sort());
    assert.equal(fx.read((db) => db.prepare("SELECT count(*) n FROM events WHERE entity_id=? AND attempt_id=? AND kind='workflow-checkpoint'").get(jobs[index], attempts[index]).n), 1);
    return checkpoint;
  });
  const head = git(fx.tree, 'rev-parse', 'HEAD'), parent = git(fx.tree, 'rev-parse', 'HEAD^');
  assert.deepEqual(new Set([head, parent]), new Set(checkpoints.map((checkpoint) => checkpoint.sha)));
  assert.equal(git(fx.tree, 'rev-parse', 'HEAD^^'), base);
  assert.equal(git(fx.tree, 'rev-list', '--count', `${base}..HEAD`), '2');
  assert.equal(workflowWorktreeOf({ env: fx.env }, fx.workflowId).checkpoint, head);
  assert.equal(git(fx.tree, 'status', '--porcelain'), '');
});
