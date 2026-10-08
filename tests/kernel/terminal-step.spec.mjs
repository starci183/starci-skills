// The failed-no-step hold of modules/kernel/op-incident-policy.yaml, on the shape the 2026-10-08 StarCi ledger showed:
// work.author blocked `sds-gap` (job op-work.author-c10c110700) before architecture.decide had a job, architecture.decide
// then settled succeeded, and nothing followed the blocked job for fifteen hours (digest op-step-missing).
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { jobResult, openLedger } from '../../engine/db/ledger.mjs';
import { terminalFactsOf, upstreamPlanOf, gapUpstreamOf, holdView, TERMINAL_HOLDS } from '../../scripts/kernel/terminal-step.mjs';
import { planJob, retryDecision, jobSettings } from '../../scripts/reconciler/controllers/job.mjs';
import { incidentPolicy, boundValue } from '../../scripts/kernel/op-incident-policy.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-terminal';
const T0 = 1_800_000_000_000;
const BLOCKED = 'op-work.author-c10c110700';
const ARCH = 'op-architecture.decide-e12b49e1e8';

const report = (blocker) => ({ schema: 'starci/op-report@1', outcome: 'blocked', summary: 'blocked', files: [], checks: [], blocker: { kind: blocker, detail: 'the design is silent' } });

/** The 2026-10-08 StarCi shape: work.author blocked first, architecture.decide created later and settled after it. */
const seed = (ledger, { blocker = 'sds-gap', archStatus = 'succeeded', archSettled = T0 + 600_000, withArch = true } = {}) => {
  const payload = (opId) => ({ opId, records: [], owned_paths: [`.starciwork/${opId}`] });
  const jobs = [
    { jobId: BLOCKED, unitId: BLOCKED, opId: 'work.author', status: 'failed', createdAt: T0, dispatchedAt: T0 + 1_000, updatedAt: T0 + 120_000, payload: payload('work.author'),
      result: { verdict: 'blocked', report: { reportId: 1 } } },
    ...(withArch ? [{ jobId: ARCH, unitId: ARCH, opId: 'architecture.decide', status: archStatus, createdAt: T0 + 300_000, dispatchedAt: T0 + 310_000, updatedAt: archSettled, payload: payload('architecture.decide'),
      result: archStatus === 'succeeded' ? { verdict: 'pass' } : { verdict: 'blocked' } }] : []),
  ];
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'terminal' }, goalIdentity: 'terminalgoal', goal: { revision: 0, identity: 'terminalgoal', markdown: '# goal', json: {} }, jobs });
  const attempt = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=?').get(BLOCKED);
  ledger.db.prepare("UPDATE op_attempts SET report_outcome='blocked', verdict='blocked' WHERE attempt_id=?").run(attempt.attempt_id);
  ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WF, attempt.attempt_id, attempt.dispatch_id, BLOCKED, 'blocked', JSON.stringify(report(blocker)), T0 + 100_000);
};

const cli = (env, ...args) => spawnSync(process.execPath, [CLI, ...args], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 120_000, env: { ...process.env, ...env, STARCI_AUTOPILOT: 'off' } });
const envOf = (world) => ({ [TEST_REGISTRY_ENV]: world.machineFile, STARCI_PROJECTS_ROOT: process.env.STARCI_PROJECTS_ROOT, STARCI_LOCAL_ROOT: world.machineHome });
const json = (r) => { try { return JSON.parse(r.stdout); } catch { return null; } };

test('the table lists failed-no-step, owner-wait-no-ask, reported-unsettled and orphaned-frontier with a handler, a bound and a chain to the owner', () => {
  const policy = incidentPolicy();
  for (const id of ['failed-no-step', 'owner-wait-no-ask', 'reported-unsettled', 'orphaned-frontier']) {
    const hold = policy.holds.find((item) => item.id === id);
    assert.ok(hold, `${id} is a listed hold`);
    assert.ok(boundValue(hold.bound.deadlineMs) > 0, `${id}: its bound resolves`);
    assert.equal(hold.chain.at(-1), 'owner', `${id}: its chain ends at the owner`);
    assert.equal(hold.gap, undefined, `${id}: it meets every invariant`);
  }
  assert.equal(holdView(TERMINAL_HOLDS.failedNoStep).handler, 'runtime-auto');
  assert.ok(policy.rows.some((row) => row.id === 'error-unrouted' && row.handler === 'runtime-auto' && row.next === 'kernel'));
});

test('a gap blocker names the leg that cures it from the route table', () => {
  assert.equal(gapUpstreamOf('sds-gap'), 'architecture.decide');
  assert.equal(gapUpstreamOf('srs-gap'), 'business.decide');
  assert.equal(gapUpstreamOf('interface-gap'), 'interface.draw');
  assert.equal(gapUpstreamOf('environment'), null);
});

test('a blocked job nothing follows owes failed-no-step; the cure that landed after its dispatch plans a retry behind it', (t) => withLedger(t, ({ ledger }) => {
  seed(ledger);
  const facts = terminalFactsOf(ledger.db, BLOCKED);
  assert.equal(facts.hold, TERMINAL_HOLDS.failedNoStep);
  assert.equal(facts.taken, false);
  const job = ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(BLOCKED);
  assert.deepEqual(upstreamPlanOf(ledger.db, job, 'sds-gap'), { action: 'retry', after: ARCH, on: 'architecture.decide', mode: 'landed' });
}));

test('a cure that settled before the attempt was dispatched is a real gap: the route table applies', (t) => withLedger(t, ({ ledger }) => {
  seed(ledger, { archSettled: T0 - 5_000 });
  const job = ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(BLOCKED);
  assert.equal(upstreamPlanOf(ledger.db, job, 'sds-gap'), null);
}));

test('a cure with no job waits, and its absence is named so the controller can bound it', (t) => withLedger(t, ({ ledger }) => {
  seed(ledger, { withArch: false });
  const job = ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(BLOCKED);
  assert.deepEqual(upstreamPlanOf(ledger.db, job, 'sds-gap'), { action: 'wait', on: 'architecture.decide', why: 'no-job' });
}));

test('reconcile --route-failure enqueues the retry behind the landed cure, records the step, and is idempotent', (t) => withLedger(t, (world) => {
  const { ledger, repoRoot } = world;
  seed(ledger);
  ledger.close();
  const first = cli(envOf(world), 'reconcile', '--repo', repoRoot, '--job', BLOCKED, '--route-failure', '--json');
  const out = json(first);
  assert.equal(first.status, 0, first.stderr + first.stdout);
  assert.equal(out.routed, true);
  assert.equal(out.step.kind, 'retry');
  assert.equal(out.step.route, 'upstream-lands-first');
  assert.equal(out.step.counted, false);
  const again = json(cli(envOf(world), 'reconcile', '--repo', repoRoot, '--job', BLOCKED, '--route-failure', '--json'));
  assert.equal(again.routed, false);
  assert.equal(again.reason, 'owes-no-step');
  const check = openLedger({ file: world.ledgerFile });
  try {
    const retry = check.db.prepare('SELECT job_id, retry_of, status, payload_json FROM jobs WHERE retry_of=?').get(BLOCKED);
    assert.ok(retry, 'the blocked job has a retry');
    assert.equal(retry.status, 'queued');
    assert.deepEqual(JSON.parse(retry.payload_json).after, [ARCH], 'it waits behind the cure');
    assert.equal(jobResult(check.db, BLOCKED).nextStep.jobs[0], retry.job_id);
    assert.equal(terminalFactsOf(check.db, BLOCKED), null, 'a job with a retry owes nothing');
  } finally { check.close(); }
}));

test('a cure with no job records no step: the job still owes failed-no-step and the verb answers a wait', (t) => withLedger(t, (world) => {
  seed(world.ledger, { withArch: false });
  world.ledger.close();
  const out = json(cli(envOf(world), 'reconcile', '--repo', world.repoRoot, '--job', BLOCKED, '--route-failure', '--json'));
  assert.equal(out.routed, false);
  assert.equal(out.wait.on, 'architecture.decide');
  const check = openLedger({ file: world.ledgerFile });
  try { assert.equal(terminalFactsOf(check.db, BLOCKED).hold, TERMINAL_HOLDS.failedNoStep); } finally { check.close(); }
}));

test('a blocked job with no gap cure takes the route table: an environment blocker raises its typed gate and stops owing a step', (t) => withLedger(t, (world) => {
  seed(world.ledger, { blocker: 'environment', withArch: false });
  world.ledger.close();
  const out = json(cli(envOf(world), 'reconcile', '--repo', world.repoRoot, '--job', BLOCKED, '--route-failure', '--json'));
  assert.equal(out.routed, true);
  assert.ok(['owner-gate', 'supervisor-gate', 'deferred', 'none'].includes(out.step.kind), out.step.kind);
  const check = openLedger({ file: world.ledgerFile });
  try { assert.equal(terminalFactsOf(check.db, BLOCKED), null); } finally { check.close(); }
}));

test('status shows the unstepped failure as a retry action and a terminal hold, never an empty frontier', (t) => withLedger(t, (world) => {
  seed(world.ledger);
  world.ledger.close();
  const status = json(cli(envOf(world), 'status', '--repo', world.repoRoot, '--workflow', WF, '--json'));
  const action = status.nextActions.find((item) => item.jobId === BLOCKED);
  assert.equal(action.kind, 'retry');
  assert.match(action.reason, /reconcile --job op-work\.author-c10c110700 --route-failure/);
  assert.deepEqual(status.terminal.map((item) => [item.jobId, item.hold, item.handler]), [[BLOCKED, 'failed-no-step', 'runtime-auto']]);
  assert.notEqual(status.frontier.state, 'orphaned-frontier');
}));

test('the Job controller plans route-failure for a terminal job, whatever its age, and a taken one plans nothing', () => {
  const settings = jobSettings();
  const facts = { jobId: BLOCKED, workflowId: WF, op: 'work.author', attempt: 1, status: 'failed', payload: {}, createdAt: T0, updatedAt: T0, report: null, handover: null,
    released: true, releaseProof: true, settledAt: T0, dispatchedAt: T0, questionAt: null, now: T0 + 30 * 86_400_000, windowMs: settings.settledWindowMs,
    terminal: { hold: TERMINAL_HOLDS.failedNoStep, jobId: BLOCKED, op: 'work.author', since: T0, taken: false } };
  const plan = planJob(facts, { settings });
  assert.deepEqual(plan.step, { kind: 'route-failure', concern: 'job.settle', verb: 'reconcile', argv: ['--job', BLOCKED, '--route-failure'] });
  assert.deepEqual(plan.clocks.map((clock) => clock.state), ['DECISION_OVERDUE']);
  assert.equal(planJob({ ...facts, terminal: { ...facts.terminal, taken: true } }, { settings }).step, null);
  const ask = planJob({ ...facts, status: 'awaiting_owner', terminal: { ...facts.terminal, hold: TERMINAL_HOLDS.ownerWaitNoAsk } }, { settings });
  assert.equal(ask.step, null, 'an owner wait with no ask is the retry move of the workflow pass, not a job step');
  assert.deepEqual(ask.clocks.map((clock) => clock.state), ['DECISION_OVERDUE']);
});

test('the retry-decision Decision Item belongs to the Kernel, one per job, with the way out named', () => {
  const di = retryDecision({ jobId: BLOCKED, workflowId: WF, op: 'work.author', status: 'failed', terminal: { hold: TERMINAL_HOLDS.failedNoStep } }, 'ledger-1', 'no route resolves', { now: T0 });
  assert.equal(di.kind, 'retry-decision');
  assert.equal(di.decider, 'kernel');
  assert.equal(di.escalateTo, 'supervisor');
  assert.equal(di.idempotencyKey, `retry-decision:${BLOCKED}`);
  assert.match(di.summary, /retry with the failure fed back, switch agent, re-plan, or raise the typed gate/);
});
