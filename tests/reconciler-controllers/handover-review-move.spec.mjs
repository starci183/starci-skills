// The handover step the Job controller performs (scripts/kernel/handover-move.mjs): a due handover, and an ask answered approve or question, are each one
// enqueue of handover.review on the handover evidence path. A reported defect (answer feedback) is a judgment and stays on the menu.
import test from 'node:test';
import assert from 'node:assert/strict';
import { handoverReviewAction } from '../../scripts/kernel/handover-move.mjs';
import { buildMenu, originOf } from '../../scripts/kernel/kernel-menu.mjs';
import { mechanicalMovesOf, runMechanicalMoves } from '../../scripts/reconciler/mechanical-moves.mjs';

const WF = 'wf-handover-move';
const PATHS = `.starciwork/evidence/${WF}.handover`;
const ask = (decision, over = {}) => ({ dispatchId: 'ho-d1', jobId: 'op-handover-1', attempt: 1, state: 'answered', decision, answeredBy: 'owner', byOwner: true, note: null, ...over });
const answered = (decision, over) => ({ state: 'answered', due: false, jobId: 'op-handover-1', jobStatus: 'succeeded', ask: ask(decision, over) });
const sources = (handover, nextActions = [], feedback = null) => ({ workflow: WF, rev: null, jobDecisions: [], questions: [], peers: [], wedged: [], deadWaits: [], decisions: [], nextActions, handover, feedback, snoozed: new Set() });

test('a due handover is the enqueue of handover.review on the evidence path, a mechanical origin the menu never holds', () => {
  const due = { state: 'not-started', due: true, jobId: null, jobStatus: null, ask: null };
  const action = handoverReviewAction(due, WF);
  assert.deepEqual([action.origin, action.op, action.kind], ['handover-review', 'handover.review', 'dispatch']);
  assert.deepEqual(action.move, { verb: 'enqueue', args: { workflow: WF, op: 'handover.review', paths: PATHS } });
  assert.equal(originOf(action).class, 'mechanical');
  assert.deepEqual(buildMenu(sources(due, [action])), [], 'nothing is left for the Kernel');
});

test('an ask answered approve (by the owner or by a delegate that never approves) or question is the same enqueue; no answer reading no option too', () => {
  for (const decision of ['approve', 'question', null]) {
    const action = handoverReviewAction(answered(decision), WF);
    assert.equal(action.move.args.op, 'handover.review', String(decision));
    assert.equal(action.round, 'ho-d1');
  }
  const delegated = handoverReviewAction(answered('approve', { answeredBy: 'supervisor', byOwner: false }), WF);
  assert.equal(delegated.move.args.paths, PATHS, 'a delegated approve re-asks the owner: the review runs again');
});

test('a defect the owner reported stays the Kernel\'s: no move, and the handover-step item keeps its typed routing choices', () => {
  const handover = answered('feedback', { note: 'the save button does nothing' });
  assert.equal(handoverReviewAction(handover, WF), null);
  const slice = { jobId: 'op-screen-1', op: 'interface.implement', label: 'save button', move: { verb: 'enqueue', args: { workflow: WF, op: 'interface.implement', paths: 'src/screens/save' } } };
  const [item] = buildMenu(sources(handover, [], { title: 'handover feedback ho-d1: the save button does nothing', slices: [slice] }));
  assert.deepEqual([item.kind, item.mode], ['handover-step', 'judgment']);
  assert.deepEqual(item.options.map((option) => option.choice), ['route-fix-op-screen-1', 'route-requirement-gap', 'route-design-gap', 'route-interface-gap', 'none-fits']);
});

test('nothing is owed while the review runs, awaits the owner, was approved, or its job failed (the retry origin owns a failed one)', () => {
  const states = [{ state: 'running', due: false }, { state: 'awaiting-owner', due: false }, { state: 'approved', due: false }, { state: 'not-started', due: false }, { state: 'due', due: true, jobId: 'op-handover-1', jobStatus: 'failed' }];
  for (const handover of states) assert.equal(handoverReviewAction({ ...handover, ask: null }, WF), null, handover.state + handover.jobStatus);
  assert.equal(handoverReviewAction(null, WF), null);
});

test('the controller enqueues it once per round and again for a later round of the same handover', async () => {
  const calls = [];
  const ctx = { now: () => 1, api: async (_ledger, verb, argv) => { calls.push([verb, ...argv]); return { ok: true }; }, openDecision: async () => ({ ok: true }) };
  const deps = { facts: () => null, refused: () => null, workflowId: WF, settings: { allowedVerbs: ['enqueue'], decisionDueMs: 1 } };
  const first = { nextActions: [handoverReviewAction(answered('question'), WF)] };
  const second = { nextActions: [handoverReviewAction(answered('question', { dispatchId: 'ho-d2' }), WF)] };
  assert.deepEqual((await runMechanicalMoves(ctx, 'ledger-handover', first, deps)).map((r) => [r.origin, r.ok]), [['handover-review', true]]);
  assert.deepEqual(await runMechanicalMoves(ctx, 'ledger-handover', first, deps), [], 'a move made is not made again');
  assert.equal((await runMechanicalMoves(ctx, 'ledger-handover', second, deps)).length, 1, 'the owner\'s next answer is a new round');
  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ['enqueue', '--workflow', WF, '--op', 'handover.review', '--paths', PATHS]);
  assert.equal(mechanicalMovesOf(first)[0].key, `handover.review:handover-review:ho-d1`);
});
