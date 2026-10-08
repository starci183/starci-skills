// The Kernel's menu (modules/kernel/kernel-menu.yaml, scripts/kernel/kernel-menu.mjs) and the verb that answers it
// (`starci kernel decide --item`): what the menu holds for the main states of a workflow, that mechanical work is never in it, and that
// a choice is validated against the state, recorded and executed in-process.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { TEST_REGISTRY_ENV } from '../../engine/db/machine.mjs';
import { openLedger } from '../../engine/db/ledger.mjs';
import { openDecisionRow, listDecisions } from '../../scripts/machine/decisions.mjs';
import { incidentPolicy } from '../../scripts/kernel/op-incident-policy.mjs';
import { buildMenu, menuCatalog, originOf, parseKernelCommand, resolveArgs } from '../../scripts/kernel/kernel-menu.mjs';
import { decisionsOf } from '../../scripts/kernel/progress-rca.mjs';

const ROOT = path.resolve(import.meta.dirname, '..', '..');
const CLI = path.join(ROOT, 'scripts', 'kernel', 'cli.mjs');
const WF = 'wf-menu';
const T0 = Date.now() - 3_600_000;
const FAILED = 'op-work.author-aaaa1111';

const payload = (opId) => ({ opId, records: [], owned_paths: ['.starciwork/x'] });
const failedJob = { jobId: FAILED, unitId: FAILED, opId: 'work.author', status: 'failed', createdAt: T0, dispatchedAt: T0 + 1000, updatedAt: T0 + 120_000, payload: payload('work.author'), result: { verdict: 'fail' } };
const seed = (ledger, jobs = [failedJob]) => seedWorkflow(ledger, { id: WF, state: { phase: 'running', job: 'menu' }, goalIdentity: 'menu-goal', goal: { revision: 0, identity: 'menu-goal', markdown: '# goal', json: {} }, jobs });
const retryDecision = (ledger, jobId = FAILED) => openDecisionRow(ledger, { workflowId: WF, kind: 'retry-decision', entity: { type: 'job', id: jobId }, summary: `${jobId} failed: nothing follows it`, by: 'reconciler/job' }, { now: T0 }).di;

const envOf = (world) => ({ ...process.env, [TEST_REGISTRY_ENV]: world.machineFile, STARCI_LOCAL_ROOT: world.machineHome, STARCI_AUTOPILOT: 'off', ORCA_TERMINAL_HANDLE: '' });
const cli = (world, ...args) => spawnSync(process.execPath, [CLI, ...args, '--repo', world.repoRoot], { cwd: ROOT, encoding: 'utf8', windowsHide: true, timeout: 180_000, env: envOf(world) });
const status = (world) => JSON.parse(cli(world, 'status', '--workflow', WF, '--json').stdout);
const decide = (world, item, choice, ...more) => cli(world, 'decide', '--workflow', WF, '--item', item, '--choice', choice, '--reason', 'spec', '--json', ...more);
const withReader = (world, fn) => {
  const reader = openLedger({ file: world.ledgerFile });
  try { return fn(reader.db); } finally { reader.close(); }
};
const sources = (over = {}) => ({ workflow: WF, rev: null, jobDecisions: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions: [], handover: null, snoozed: new Set(), ...over });

test('the catalog classifies every origin, and every kind that names a hold names one the table lists with the Kernel as handler', () => {
  const catalog = menuCatalog();
  const kinds = new Set(catalog.kinds.map((kind) => kind.id));
  for (const origin of catalog.origins) {
    assert.ok(['mechanical', 'pending', 'wait', 'duty'].includes(origin.class), `${origin.id}: class`);
    if (origin.class === 'pending' || origin.class === 'duty') assert.ok(kinds.has(origin.menu), `${origin.id} names its menu kind`);
    else assert.ok(origin.doneBy, `${origin.id} says who does it`);
  }
  const holds = new Map(incidentPolicy().holds.map((hold) => [hold.id, hold]));
  for (const kind of catalog.kinds.filter((entry) => entry.hold)) assert.equal(holds.get(kind.hold)?.handler, 'kernel', `${kind.id}: hold ${kind.hold} is the Kernel's`);
  for (const state of catalog.frontier.filter((row) => row.class === 'judgment' || row.class === 'pending')) assert.ok(kinds.has(state.kind), `${state.state} names a kind`);
  assert.equal(originOf({ origin: 'ready-queued' }).class, 'mechanical');
  assert.equal(originOf({ origin: 'approved-leg' }).class, 'pending');
  assert.equal(originOf({ origin: 'supervisor-gate' }).class, 'wait');
});

test('a failed job with a retry-decision pending is a menu item with typed options and the escape', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger);
  retryDecision(ledger);
  ledger.close();
  const out = status(world);
  assert.equal(out.menu.length, 1);
  const [item] = out.menu;
  assert.equal(item.id, `job-decision:${FAILED}`);
  assert.equal(item.mode, 'judgment');
  assert.equal(item.hold, 'settle-nongreen');
  assert.deepEqual(item.options.map((o) => o.choice), ['continue', 'none-fits']);
  assert.equal(item.options[0].verb, 'enqueue');
  assert.equal(item.options[0].args['retry-of'], FAILED);
  assert.ok(item.evidence.some((e) => e.ref === `job:${FAILED}`));
  assert.equal(out.frontier.actionable, true);
  const text = cli(world, 'status', '--workflow', WF).stdout;
  assert.match(text, /^Decide \(1\)/m);
  assert.doesNotMatch(text, /^ {2}next \d+:/m, 'the next lines are not an actionable section any more');
}));

test('a workflow with nothing to decide has an empty menu and is not actionable, whatever mechanical work is pending', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger, [{ jobId: 'op-work.author-cccc3333', unitId: 'op-work.author-cccc3333', opId: 'work.author', status: 'queued', createdAt: T0, payload: payload('work.author') }]);
  ledger.close();
  const out = status(world);
  assert.deepEqual(out.menu, []);
  assert.equal(out.frontier.actionable, false, 'a ready queued job is the Workflow controller\'s dispatch, not a reason to wake the Kernel');
}));

test('a gate that needs a ruling is the Supervisor\'s, and the work the controllers perform is not offered', () => {
  const menu = buildMenu(sources({ nextActions: [{ kind: 'supervisor-gate', origin: 'supervisor-gate', incidentId: 'inc-1' }, { kind: 'owner-gate', origin: 'owner-gate', incidentId: 'inc-2' },
    { kind: 'dispatch', origin: 'ready-queued', op: 'x', jobId: 'op-x-1' }, { kind: 'retry', origin: 'answered-ask', op: 'x', jobId: 'op-x-2' }] }));
  assert.deepEqual(menu, []);
});

test('the main kinds build their items: a stale runtime revision, a worker question, a peer message, a wedged worker, work the runtime does not yet do', () => {
  const menu = buildMenu(sources({ rev: { stale: true, acked: 'a'.repeat(40), current: 'b'.repeat(40) },
    questions: [{ messageId: 'msg-1', jobId: 'op-x-1', opId: 'x', question: 'which table?', askedAt: new Date(T0).toISOString() }], peers: [{ key: 'pm-1', from: 'wf-other', kind: 'request', subject: 'port', at: T0 }],
    wedged: [{ jobId: 'op-x-2', opId: 'x' }], nextActions: [{ kind: 'dispatch', origin: 'approved-leg', op: 'architecture.decide', reason: 'approved leg has no job' }] }));
  assert.deepEqual(menu.map((item) => item.id), ['rev-ack:wf-menu', 'worker-question:msg-1', 'peer-message:pm-1', 'worker-wedged:op-x-2', 'leg-ready:architecture.decide:approved-leg']);
  assert.equal(menu[0].mode, 'duty');
  assert.equal(menu[0].options[0].direct, true);
  assert.equal(menu.at(-1).mode, 'mechanical-pending');
  const question = menu[1];
  assert.deepEqual(question.options.map((o) => o.choice), ['answer', 'ask-owner', 'none-fits']);
  assert.equal(question.options[0].args.body, '$text', 'the caller\'s --text binds to the placeholder');
  assert.equal(question.options[0].text, 'body');
  assert.ok(Number.isFinite(question.deadline), 'an ISO ask time still gives a deadline from the hold table');
  assert.ok(menu.every((item) => item.options.at(-1).choice === 'none-fits'), 'every item carries the typed escape');
});

test('a chosen wait snoozes its item; arguments resolve from the subject and drop what it does not know', () => {
  const wedged = sources({ wedged: [{ jobId: 'op-x-2', opId: 'x' }] });
  assert.equal(buildMenu(wedged).length, 1);
  assert.equal(buildMenu({ ...wedged, snoozed: new Set(['worker-wedged:op-x-2']) }).length, 0);
  assert.deepEqual(resolveArgs({ a: '$known', b: '$unknown', c: true, d: 'literal', e: '$text' }, { known: 'v' }), { a: 'v', c: true, d: 'literal', e: '$text' });
  assert.deepEqual(parseKernelCommand('starci kernel dispatch-ready --workflow wf-1 --foreground'), { verb: 'dispatch-ready', args: { workflow: 'wf-1', foreground: true } });
  assert.equal(parseKernelCommand('fix the settle step'), null);
  assert.equal(parseKernelCommand('starci kernel graph-edit --decision <id>'), null, 'an option with a placeholder is prose, not a step');
});

test('decide executes the chosen option in-process, records it in the decision log, resolves the item and enqueues the retry', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger);
  const di = retryDecision(ledger);
  ledger.close();
  const r = decide(world, `job-decision:${FAILED}`, 'continue', '--evidence', 'event:42,job:x');
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.choice, 'continue');
  assert.equal(out.steps[0].verb, 'enqueue');
  assert.equal(out.steps[0].ok, true);
  assert.equal(out.resolved, di.id);
  assert.match(out.decision, /^dec-/);
  const after = status(world);
  assert.deepEqual(after.menu, [], 'the item is answered');
  assert.equal(after.jobs.queued, 1, 'the retry is queued');
  const [entry] = withReader(world, (db) => decisionsOf(db, WF));
  assert.deepEqual([entry.status, entry.menu.item, entry.menu.choice], ['keep', `job-decision:${FAILED}`, 'continue']);
  assert.deepEqual(entry.evidence, ['event:42', 'job:x']);
}));

test('a choice off the menu, an item that is not open and a missing reason are refused with a typed code and the menu', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger);
  retryDecision(ledger);
  ledger.close();
  const choice = decide(world, `job-decision:${FAILED}`, 'enqueue-everything');
  assert.equal(choice.status, 1);
  const refusedChoice = JSON.parse(choice.stdout);
  assert.equal(refusedChoice.code, 'menu-choice-unknown');
  assert.equal(refusedChoice.menu[0].id, `job-decision:${FAILED}`, 'the answer carries the current menu');
  const item = JSON.parse(decide(world, 'job-decision:op-gone-0', 'continue').stdout);
  assert.equal(item.code, 'menu-item-unknown');
  assert.equal(item.menu.length, 1);
  const text = cli(world, 'decide', '--workflow', WF, '--item', `job-decision:${FAILED}`, '--choice', 'nope', '--reason', 'x');
  assert.match(text.stdout, /decide REFUSED \(menu-choice-unknown\)/);
  assert.match(text.stdout, /^Decide \(1\)/m, 'the text answer prints the menu');
  assert.equal(withReader(world, (db) => decisionsOf(db, WF)).length, 0, 'a refused answer records nothing');
  const bare = cli(world, 'decide', '--workflow', WF, '--item', `job-decision:${FAILED}`, '--choice', 'continue');
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /decide-answer-incomplete/);
}));

test('none-fits records the reason and escalates the item\'s Decision Item to the Supervisor', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger);
  const di = retryDecision(ledger);
  ledger.close();
  const r = decide(world, `job-decision:${FAILED}`, 'none-fits');
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).escalated, di.id);
  const row = withReader(world, (db) => listDecisions(db, { workflowId: WF, all: true }).find((d) => d.id === di.id));
  assert.deepEqual([row.status, row.escalateTo], ['escalated', 'supervisor']);
}));

test('none-fits on an item without a Decision Item opens the Supervisor\'s menu-escape item', (t) => withLedger(t, (world) => {
  const { ledger } = world;
  seed(ledger, [{ jobId: 'op-x-wedged1', unitId: 'op-x-wedged1', opId: 'work.author', status: 'queued', createdAt: T0, payload: payload('work.author') }]);
  openDecisionRow(ledger, { workflowId: WF, kind: 'progress-stall', entity: { type: 'workflow', id: WF }, summary: 'no unit passed', by: 'reconciler/workflow' }, { now: T0 });
  ledger.close();
  const [item] = status(world).menu;
  assert.equal(item.kind, 'decision-item');
  assert.ok(item.options.some((o) => o.choice === 'keep-waiting'), 'a stall can be waited on');
  const wait = JSON.parse(decide(world, item.id, 'keep-waiting').stdout);
  assert.equal(wait.ok, true);
  assert.deepEqual(status(world).menu, [], 'the chosen wait snoozes the item');
}));

test('a wait that can no longer end on its own is a judgment item whose release needs the evidence, and a move a gate holds is not offered', () => {
  const menu = buildMenu(sources({ deadWaits: [{ incidentId: 'inc-9', situation: 'peer-wait inc-9 on wf-peer can no longer be met' }],
    nextActions: [{ kind: 'dispatch', origin: 'approved-leg', op: 'interface.implement', heldBy: { incident: 'inc-gate' } }] }));
  assert.deepEqual(menu.map((item) => item.id), ['dead-wait:inc-9']);
  const [release] = menu[0].options;
  assert.deepEqual([release.choice, release.verb, release.args.resolve, release.args.detail, release.text], ['release-wait', 'incident', 'inc-9', '$text', 'detail']);
});
