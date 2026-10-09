// The Kernel is woken only for an item it has not answered, and an answer whose step failed is not asked again while the item's facts stand:
// the StarCi Kernel answered the leg named forgot-password with none-fits 14 times (the event stores the id through the redaction filter, which
// blanks what follows `password:`, so the answer never matched the live id), and the Nivo Kernel answered a failed Critic verdict three times with
// a settle-fail that reverted. Each ask was a wake, and a wake counts toward the 8-wake rotation, so both Kernels were replaced every 10 to 23 minutes.
// A failed Critic verdict is also never offered accept.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { openLedger } from '../../engine/db/ledger.mjs';
import { openDecisionRow } from '../../scripts/machine/decisions.mjs';
import { buildMenu, itemFactsOf } from '../../scripts/kernel/kernel-menu.mjs';
import { redactText } from '../../scripts/lib/redact.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-answered';
const T0 = Date.now() - 3_600_000;
const sources = (over = {}) => ({ workflow: WF, rev: null, jobDecisions: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions: [], handover: null, snoozed: new Set(), ...over });
const shape = (jobId) => ({ shapeRefused: [{ jobId, op: 'work.author', failedJobId: 'j1', situation: `${jobId} is ready but has the shape of j1` }] });

test('an answer stored through the redaction filter still holds its item back (a leg named forgot-password)', () => {
  const jobId = 'op-forgot-password:approved-leg-open';
  const [item] = buildMenu(sources(shape(jobId)));
  assert.equal(item.id, `shape-refused:${jobId}`);
  const stored = redactText(item.id);
  assert.notEqual(stored, item.id, 'the filter blanks what follows password:');
  assert.equal(buildMenu(sources({ ...shape(jobId), snoozed: new Set([stored]) })).length, 0, 'the stored spelling snoozes the live item');
  assert.equal(buildMenu(sources({ ...shape(jobId), snoozed: new Set(['shape-refused:another']) })).length, 1);
});

test('an item whose answer failed is held while its facts are unchanged and offered again when they change', () => {
  const [item] = buildMenu(sources(shape('op-x-1')));
  const answered = new Map([[item.id, itemFactsOf(item)]]);
  assert.equal(buildMenu(sources({ ...shape('op-x-1'), answered })).length, 0, 'the same question and options: nothing new to decide');
  const changed = new Map([[item.id, itemFactsOf({ ...item, question: `${item.question} (and more)` })]]);
  assert.equal(buildMenu(sources({ ...shape('op-x-1'), answered: changed })).length, 1, 'a changed fact asks again');
  const options = new Map([[item.id, itemFactsOf({ ...item, options: item.options.slice(1) })]]);
  assert.equal(buildMenu(sources({ ...shape('op-x-1'), answered: options })).length, 1, 'a changed option asks again');
});

const envOf = (world) => ({ ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome, STARCI_AUTOPILOT: 'off', ORCA_TERMINAL_HANDLE: '' });
const status = (world) => JSON.parse(spawnSync(process.execPath, [CLI, 'status', '--repo', world.repoRoot, '--workflow', WF, '--json'], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000, env: envOf(world) }).stdout);

/** A reported architecture.decide job the runtime handed over with `code`, and its Decision Item. */
function reportedWith(ledger, code) {
  const REPORTED = 'op-architecture.decide-e78adc94cc';
  const payload = { opId: 'architecture.decide', records: [], owned_paths: ['.starciwork/x'] };
  seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'answered' }, goalIdentity: 'g', goal: { revision: 0, identity: 'g', markdown: '# goal', json: {} },
    jobs: [{ jobId: REPORTED, unitId: REPORTED, opId: 'architecture.decide', status: 'reported', createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 120_000, payload }] });
  const { attempt_id: attemptId, dispatch_id: dispatchId } = ledger.db.prepare('SELECT attempt_id, dispatch_id FROM op_attempts WHERE job_id=?').get(REPORTED);
  ledger.db.prepare("INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,?,?,'m',?)").run(attemptId, WF, REPORTED, T0);
  ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?)')
    .run(WF, attemptId, dispatchId, REPORTED, 'done', '{}', T0 + 60_000, T0 + 30_000);
  ledger.transaction(() => ledger.appendEvent({ workflowId: WF, entityType: 'job', entityId: REPORTED, attemptId, kind: 'job-settle-needs-kernel',
    payload: { dispatchId, reason: 'settle-refused', code, detail: [code], outcome: 'done', op: 'architecture.decide' } }));
  openDecisionRow(ledger, { workflowId: WF, kind: 'settle-nongreen', entity: { type: 'job', id: REPORTED }, summary: `${REPORTED} reported done: the runtime did not settle it`, by: 'reconciler/job' }, { now: T0 });
  return REPORTED;
}

test('a failed Critic verdict is never offered accept, and the choices say what they do with the critique', (t) => withLedger(t, (world) => {
  const REPORTED = reportedWith(world.ledger, 'op-critic-verdict-failed');
  world.ledger.close();
  const [item] = status(world).menu;
  assert.equal(item.id, `job-decision:${REPORTED}`);
  const choices = item.options.map((option) => option.choice);
  assert.ok(!choices.includes('accept'), `accept settles pass, which the runtime refuses again against a failed verdict: ${choices.join(', ')}`);
  assert.match(item.options.find((option) => option.choice === 'settle-fail').effect, /critique/);
  assert.match(item.options.find((option) => option.choice === 'continue').effect, /critique/);
}));

test('another refusal of a done report still offers accept', (t) => withLedger(t, (world) => {
  reportedWith(world.ledger, 'op-gate-new-findings');
  world.ledger.close();
  assert.ok(status(world).menu[0].options.some((option) => option.choice === 'accept'));
}));

test('an answer whose step failed holds the job item while the facts stand; a changed item is offered again', (t) => withLedger(t, (world) => {
  const REPORTED = reportedWith(world.ledger, 'op-critic-verdict-failed');
  world.ledger.close();
  const [item] = status(world).menu;
  const answer = (facts) => {
    const writer = openLedger({ file: world.ledgerFile });
    writer.transaction(() => {
      writer.appendEvent({ workflowId: WF, entityType: 'kernel', entityId: 'dec-spec', kind: 'kernel-decision', payload: { hypothesis: 'spec', actionKey: `settle-fail:${item.id}:spec`, metric: 'm', command: 'c', baseline: {}, menu: { item: item.id, choice: 'settle-fail', facts } } });
      writer.appendEvent({ workflowId: WF, entityType: 'kernel', entityId: 'dec-spec', kind: 'kernel-decision-result', payload: { result: 'revert', observed: 'settle failed: workflow-reset-failed' } });
    });
    writer.close();
  };
  answer('not-the-facts-of-the-item');
  assert.equal(status(world).menu.length, 1, 'an answer to other facts holds nothing back');
  answer(itemFactsOf(item));
  const held = status(world);
  assert.deepEqual(held.menu, [], `${REPORTED}: the failed answer is not asked again`);
  assert.equal(held.frontier.actionable, false, 'so the watchdog does not wake the Kernel for it');
}));
