// The mirror's loop (scripts/reconciler/supervisor-mirror.mjs, supervisor-ruling-withdraw.mjs), on a product ledger and a machine store of one temp world:
// every Supervisor-decided item kind is mirrored; an answered twin closes the product item and, for a Kernel escape the Supervisor did not rule on, tells the Kernel what
// became of it (record-defect, none-fits); an item whose job has settled is closed by the runtime with that reason; a ruling the runtime contradicts is withdrawn.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV, openMachine } from '../../engine/db/machine.mjs';
import { openDecisionRow, openDecision, listDecisions } from '../../scripts/machine/decisions.mjs';
import { mirrorPlan, twinAnswersOf } from '../../scripts/reconciler/supervisor-mirror.mjs';
import { contradictedRulings } from '../../scripts/reconciler/supervisor-ruling-withdraw.mjs';
import { UPSTREAM_ROUTE } from '../../scripts/kernel/upstream-retry.mjs';

const WF = 'wf-loop';
const T0 = Date.now() - 3_600_000;
const payload = { opId: 'work.author', records: [], owned_paths: ['.starciwork/features/auth/impl'], params: {} };
const job = (jobId, status, extra = {}) => ({ jobId, unitId: 'op-work.author-failed1', opId: 'work.author', status, createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 2000, payload, ...extra });
const seed = (ledger, jobs = []) => seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'loop' }, goalIdentity: 'g', goal: { revision: 0, identity: 'g', markdown: '# goal', json: {} }, jobs });
const envOf = (world) => ({ ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome });
const escapeOf = (ledger, item) => openDecisionRow(ledger, { workflowId: WF, kind: 'menu-escape', decider: 'supervisor', entity: { type: 'workflow', id: WF },
  idempotencyKey: `menu-escape:${WF}:${item}`, summary: `Kernel: no option of ${item} fits: why`, by: 'kernel' }, { now: T0 }).di;

/** The twin of `di` opened as the controller opens it, answered with `choice: reason`; the answers the controller reads. */
async function answered(world, ledger, di, choice, reason) {
  const name = path.basename(world.repoRoot);
  const twin = mirrorPlan(ledger.db, { ledgerId: 'l1', ledgerName: name, workflowId: WF, now: Date.now() }).twins.find((spec) => spec.refs.decision === di.id);
  const opened = await openDecision(world.repoRoot, twin, { env: envOf(world) });
  const machine = openMachine({ env: envOf(world) });
  try {
    machine.setSupDecision(opened.json.decision.id, { status: 'resolved', by: 'supervisor', verb: 'starci supervisor decide', choice: 'starci supervisor decide', rationale: `${choice}: ${reason}` });
    return { name, answers: twinAnswersOf(machine.db), twinId: opened.json.decision.id };
  } finally { machine.close(); }
}

test('every Supervisor-decided kind of a product ledger is mirrored, not only the Kernel escape', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger);
  for (const kind of ['menu-escape', 'seat-unrecoverable', 'runtime-defect', 'push-refused']) {
    openDecisionRow(ledger, { workflowId: WF, kind, decider: 'supervisor', entity: { type: 'workflow', id: WF }, summary: `a ${kind}`, by: 'host-controller' }, { now: T0 });
  }
  openDecisionRow(ledger, { workflowId: WF, kind: 'retry-decision', decider: 'kernel', entity: { type: 'job', id: 'op-x-1' }, summary: 'the Kernel own', by: 'reconciler/job' }, { now: T0 });
  const plan = mirrorPlan(ledger.db, { ledgerId: 'l1', ledgerName: 'product', workflowId: WF, now: Date.now() });
  assert.deepEqual(plan.twins.map((spec) => spec.kind).sort(), ['menu-escape', 'push-refused', 'runtime-defect', 'seat-unrecoverable']);
  assert.deepEqual([plan.closures, plan.notices], [[], []]);
  ledger.close();
}));

test('an answered twin closes the product item; a ruling needs no notice, record-defect and none-fits tell the Kernel what became of the escape', (t) => withLedger(t, async (world) => {
  const { ledger } = world;
  seed(ledger);
  const ruled = escapeOf(ledger, 'leg-ready:a'), defect = escapeOf(ledger, 'leg-ready:b'), owner = escapeOf(ledger, 'leg-ready:c');
  const answers = new Map();
  for (const [di, choice, reason] of [[ruled, 'rule', 'use the plan'], [defect, 'record-defect', 'the manifest is refused'], [owner, 'none-fits', 'nothing fits']]) {
    const done = await answered(world, ledger, di, choice, reason);
    for (const [key, value] of done.answers) answers.set(key, value);
  }
  const plan = mirrorPlan(ledger.db, { ledgerId: 'l1', ledgerName: path.basename(world.repoRoot), workflowId: WF, now: Date.now(), answers });
  assert.deepEqual(plan.twins, []);
  assert.deepEqual(plan.closures.map((c) => [c.id, c.by, c.verb]).sort(), [[defect.id, 'supervisor', 'supervisor-record-defect'], [owner.id, 'supervisor', 'supervisor-none-fits'], [ruled.id, 'supervisor', 'supervisor-rule']].sort());
  assert.equal(plan.notices.length, 2, 'the ruled escape was told by the ruling itself');
  const text = plan.notices.map((notice) => notice.summary).join('\n');
  assert.match(text, new RegExp(`${defect.id}.*runtime defect for Debug.*do not retry`));
  assert.match(text, new RegExp(`${owner.id}.*handed it to the owner`));
  assert.ok(plan.notices.every((notice) => notice.kind === 'supervisor-ruling' && notice.decider === 'kernel'));
  ledger.close();
}));

test('an item whose job has settled is closed by the runtime with that reason, not mirrored', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger, [job('op-work.author-a1b2c3d4e5', 'succeeded')]);
  openDecisionRow(ledger, { workflowId: WF, kind: 'seat-unrecoverable', decider: 'supervisor', entity: { type: 'job', id: 'op-work.author-a1b2c3d4e5' }, summary: 'the seat', by: 'host-controller' }, { now: T0 });
  const escape = escapeOf(ledger, 'job-decision:op-work.author-a1b2c3d4e5');
  const plan = mirrorPlan(ledger.db, { ledgerId: 'l1', ledgerName: 'product', workflowId: WF, now: Date.now() });
  assert.deepEqual(plan.twins, []);
  assert.equal(plan.closures.length, 2);
  assert.ok(plan.closures.every((c) => c.by === 'runtime' && c.verb === 'supervisor-item-stale' && /op-work.author-a1b2c3d4e5 it names has succeeded/.test(c.note)), JSON.stringify(plan.closures));
  assert.ok(plan.closures.some((c) => c.id === escape.id));
  ledger.close();
}));

test('a ruling "not the same shape again" is withdrawn once the dispatch guard stops refusing that shape, and kept while it refuses', (t) => withLedger(t, async (world) => {
  const { ledger } = world;
  const step = { kind: 'retry', route: UPSTREAM_ROUTE, counted: false, upstream: 'architecture.decide', mode: 'landed', jobs: ['op-work.author-retry02'] };
  seed(ledger, [job('op-work.author-failed1', 'failed', { result: { verdict: 'blocked', nextStep: step } }), job('op-work.author-retry02', 'queued', { tryNo: 2, retryOf: 'op-work.author-failed1' })]);
  const attempt = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=?').get('op-work.author-failed1');
  ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(WF, attempt.attempt_id, attempt.dispatch_id, 'op-work.author-failed1', 'blocked', JSON.stringify({ outcome: 'blocked', summary: 'needs a shared file', blocker: { kind: 'shared-change', detail: 'files outside the owned paths' } }), T0 + 60_000, T0 + 30_000);
  const escape = escapeOf(ledger, 'shape-refused:op-work.author-retry02');
  const { twinId } = await answered(world, ledger, escape, 'rule', 'do not run it again in the same shape');
  const ruling = openDecisionRow(ledger, { workflowId: WF, kind: 'supervisor-ruling', decider: 'kernel', entity: { type: 'workflow', id: WF }, summary: '[supervisor] do not run it again in the same shape',
    item: twinId, by: 'supervisor' }, { now: T0 }).di;
  const machine = openMachine({ env: envOf(world) });
  try {
    const withdrawn = contradictedRulings(ledger.db, machine.db, { workflowId: WF, now: Date.now() });
    assert.deepEqual(withdrawn.map((entry) => [entry.id, entry.job]), [[ruling.id, 'op-work.author-retry02']]);
    assert.match(withdrawn[0].reason, /no longer refuses the shape of op-work\.author-retry02/);
    ledger.db.prepare("UPDATE op_attempts SET settle_json=json_remove(settle_json,'$.nextStep') WHERE job_id=?").run('op-work.author-failed1');
    assert.deepEqual(contradictedRulings(ledger.db, machine.db, { workflowId: WF, now: Date.now() }), [], 'while the guard still refuses the shape the ruling stands');
    assert.equal(listDecisions(ledger.db, { workflowId: WF, decider: 'kernel', now: Date.now() }).find((di) => di.id === ruling.id).status, 'open');
  } finally { machine.close(); }
  ledger.close();
}));
