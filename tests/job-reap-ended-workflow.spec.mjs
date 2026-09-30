// The worktree reap of a settled job whose workflow has ended (archived / finished): the folder is still removed and
// verified, no ledger event is attempted (events_refuse_archived refuses every write of an archived workflow), and the
// Job controller stops scheduling the reap once the folder is gone - no hot loop of refused writes
// (job:nivo-backend:op-interface.implement-01d5d0ea13, ~110 failed `run node` per hour).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { openLedger, ledgerFileFor } from '../engine/ledger-db.mjs';
import { ensureOpWorktree, reapJobWorktree, productWorktreeDuty, EVENTS } from '../scripts/kernel/product-worktree.mjs';
import job, { jobFacts, planJob, jobSettings, isArchivedRefusal, _terminalRuns } from '../scripts/reconciler/controllers/job.mjs';
import { fakeCtx } from '../scripts/reconciler/testing.mjs';

const WF = 'wf-nivo-backend-ended-k1';
const JOB = 'op-interface.implement-01d5d0ea13';
const settings = jobSettings({ allocation: {} });
const git = (cwd, ...args) => {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

/** A product repo with one isolated op worktree of a settled job in a workflow that then ends (`to`). */
function fixture(t, to) {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'starci-reap-ended-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true, maxRetries: 20, retryDelay: 25 }));
  const repo = path.join(base, 'nivo-backend-src');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'config', 'user.email', 'spec@starci.test');
  git(repo, 'config', 'user.name', 'spec');
  fs.writeFileSync(path.join(repo, 'a.txt'), 'a\n');
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', 'init');
  const ledgerRepo = path.join(base, 'nivo-backend');
  fs.mkdirSync(ledgerRepo);
  const ledger = openLedger({ file: ledgerFileFor(ledgerRepo) });
  t.after(() => { try { ledger.close(); } catch { /* closed */ } });
  ledger.ensureWorkflow({ workflowId: WF, title: 'ended' });
  const made = ensureOpWorktree({ repoRoot: repo, workflowId: WF, jobId: JOB });
  ledger.write.createUnit({ workflowId: WF, unitId: JOB, opId: 'interface.implement', subjectKey: JOB, goalRevision: 1 });
  ledger.enqueueJob({ jobId: JOB, workflowId: WF, unitId: JOB, opId: 'interface.implement', kind: 'op',
    payload: { opId: 'interface.implement', productWorktree: made.record, terminalClosed: { ok: true, verified: { ok: true, proof: 'spec' } } } });
  const now = Date.now();
  for (const s of ['ready', 'leased', 'running', 'reported', 'succeeded']) ledger.db.prepare('UPDATE jobs SET status=?, updated_at=? WHERE job_id=?').run(s, now, JOB);
  for (const p of ['running', 'finished', ...(to === 'archived' ? ['archived'] : [])])
    ledger.write.changeWorkflowPhase({ workflowId: WF, to: p, by: 'spec', reason: 'spec' });
  return { repo, ledger, ledgerRepo, dir: made.record.op.path, now };
}
const jobEvents = (ledger) => ledger.db.prepare('SELECT kind FROM events WHERE entity_id=?').all(JOB).map((r) => r.kind);
const planOf = (ledger, now) => planJob(jobFacts(ledger.db, JOB, { now, settings }), { settings });

for (const to of ['archived', 'finished']) {
  test(`a ${to} workflow's settled job: one reap removes the folder, writes no event, the next pass schedules nothing`, async (t) => {
    const { repo, ledger, ledgerRepo, dir, now } = fixture(t, to);
    assert.ok(fs.existsSync(dir), 'the leftover worktree folder');
    assert.equal(planOf(ledger, now).step?.kind, 'worktree-reap', 'the folder exists: the reap is due');
    const before = jobEvents(ledger);
    const r = reapJobWorktree({ ledger, ledgerRepo, jobId: JOB, now: now + 1000 });
    assert.equal(r.removed, true, JSON.stringify(r));
    assert.equal(r.workflowEnded, true);
    assert.ok(!fs.existsSync(dir), 'the folder is removed from disk');
    assert.ok(!git(repo, 'worktree', 'list', '--porcelain').includes(path.basename(dir)), 'no registration left');
    assert.deepEqual(jobEvents(ledger), before, 'no ledger event for an ended workflow');
    assert.ok(!jobEvents(ledger).includes(EVENTS.removed));
    // The next pass: nothing scheduled, no clock, and the reap itself is a no-op skip.
    const next = planOf(ledger, now + 2000);
    assert.equal(next.step, null, JSON.stringify(next.step));
    assert.ok(!next.clocks.some((c) => c.state === 'WORKTREE_REMOVE_OVERDUE'));
    const ctx = fakeCtx({ controller: 'job', now: () => now + 2000, ledgers: [{ ledgerId: 'nivo-backend', repo: ledgerRepo, file: ledgerFileFor(ledgerRepo) }], dbs: { 'nivo-backend': ledger.db } });
    const pass = await job.reconcile(`job:nivo-backend:${JOB}`, ctx);
    assert.equal(pass.action, 'idle');
    assert.equal(ctx.calls.run.length, 0, 'no reap run');
    assert.equal(reapJobWorktree({ ledger, ledgerRepo, jobId: JOB, now: now + 3000 }).skipped, 'workflow-ended');
    // The settler's duty over the same ledger: no refused write, no error.
    const duty = productWorktreeDuty({ ledger, ledgerRepo, now: now + 4000, sync: false });
    assert.deepEqual(duty.errors, []);
    assert.deepEqual(jobEvents(ledger), before);
  });
}

test('a run refused as workflow-archived is terminal: recorded once, never retried by the next pass', async (t) => {
  const { ledger, ledgerRepo, dir, now } = fixture(t, 'archived');
  assert.ok(fs.existsSync(dir));
  _terminalRuns.clear();
  const refused = { ok: false, code: 1, stderr: 'Error: workflow-archived: no further writes\n    at insertRow (engine/ledger-db.mjs:440)' };
  assert.equal(isArchivedRefusal(refused), true);
  assert.equal(isArchivedRefusal({ ok: false, stderr: 'EBUSY: resource busy' }), false, 'a busy folder stays transient');
  const ctx = fakeCtx({ mode: 'active', owns: () => true, controller: 'job', now: () => now + 1000, runResult: () => refused,
    ledgers: [{ ledgerId: 'nivo-backend', repo: ledgerRepo, file: ledgerFileFor(ledgerRepo) }], dbs: { 'nivo-backend': ledger.db } });
  const first = await job.reconcile(`job:nivo-backend:${JOB}`, ctx);
  assert.equal(first.terminal, 'workflow-archived');
  assert.equal(first.ok, true);
  const second = await job.reconcile(`job:nivo-backend:${JOB}`, ctx);
  assert.equal(second.action, 'terminal');
  assert.equal(ctx.calls.run.length, 1, 'the refused reap ran once');
  _terminalRuns.clear();
});
