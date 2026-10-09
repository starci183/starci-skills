// A held Kernel launch (launch-unknown signal) that names a Dispatch but no terminal, whose provider receipt names no handle either: Orca's worker-start answered
// outcome_unknown / turn_start_unobserved without naming the terminal it had created (live, 2026-10-09: both workflows, codex Kernels, kernel-launch-custody-incomplete for ever).
// The Dispatch id is identity-bound to the launch, so Orca's own record of that exact Dispatch names the terminal; it is adopted, closed and its original reservation released
// only while the signal and the start authority are unchanged and no turn ever started. Every refusal keeps custody and opens one Supervisor item.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { setSignal } from '../../engine/db/ledger.mjs';
import { recoverWorkflowLaunch } from '../../scripts/kernel/workflow-launch-custody.mjs';
import { unobservedLaunchTerminal } from '../../scripts/kernel/workflow-launch-settled.mjs';

const TERMINAL = 'term_orca_named', DISPATCH = 'ctx_unreceipted';
const shown = (over = {}) => ({ ok: true, state: over.worker?.state ?? 'start_unknown', result: {
  dispatch: { id: DISPATCH, status: 'pending', assigneeHandle: TERMINAL, lastHeartbeatAt: null, ...(over.dispatch ?? {}) },
  worker: { state: 'start_unknown', stage: 'turn_start_unobserved', agentTerminalHandle: TERMINAL, ...(over.worker ?? {}) } }, ...(over.top ?? {}) });

const fixture = (t, run) => withLedger(t, ({ ledger, machine }) => {
  const workflowId = 'wf-unreceipted', token = 'original-launch';
  seedWorkflow(ledger, { id: workflowId, state: { phase: 'queued' }, generation: 0, goal: { revision: 1, markdown: 'The accepted recovery fixture.', json: {} } });
  ledger.db.prepare("UPDATE goals SET approved_by='owner' WHERE workflow_id=?").run(workflowId);
  const reserved = machine.reserveProvider({ provider: 'codex', model: 'gpt-6.1-sol', role: 'kernel', attemptId: 'original-attempt', maxParallel: 2, scope: { workflowId } });
  assert.equal(reserved.ok, true);
  // The receipt as the live launch left it: an unknown launch with an identity and a host request, and NO handle.
  const observed = machine.markProviderReservation({ ...reserved.reservation, state: 'unknown', launchIdentity: 'original-launch-identity', hostRequestId: 'original-request' });
  assert.equal(observed.ok, true);
  const receipt = observed.reservation, admission = { ok: true, receipt, selected: { provider: receipt.provider, model: receipt.model } };
  setSignal(ledger.db, { scope: 'kernel', key: workflowId, workflowId, holderPid: 4123, token, value: { state: 'launch-unknown', terminal: null, dispatch: DISPATCH, admission }, expiresAt: null });
  const read = () => ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const closed = () => ({ ok: true, handle: TERMINAL, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'none' } });
  const reservation = () => machine.providerReservations().find((r) => r.id === receipt.id);
  const items = () => machine.db.prepare('SELECT * FROM sup_decision_items').all();
  return run({ ledger, machine, workflowId, token, admission, read, closed, reservation, items });
});

test('the terminal Orca reports for the exact Dispatch is adopted, closed, its original reservation released and the signal cleared with the evidence journaled', (t) => fixture(t, (f) => {
  const calls = [];
  const result = recoverWorkflowLaunch(f.ledger, { workflowId: f.workflowId, signal: f.read() }, {
    unobserved: ({ dispatch }) => unobservedLaunchTerminal({ dispatch }, { show: () => shown() }),
    close: (dispatch, options) => { calls.push([dispatch, options.handle]); return f.closed(); } });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.deepEqual(calls, [[DISPATCH, TERMINAL]]);
  assert.equal(f.read(), undefined, 'the signal is cleared');
  assert.equal(f.reservation().state, 'released');
  assert.equal(f.reservation().handle, TERMINAL, 'the terminal was bound to the original reservation before it was released');
  const event = JSON.parse(f.ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-launch-reconciled'").get(f.workflowId).payload_json);
  assert.equal(event.terminal, TERMINAL);
  assert.equal(event.evidence.stage, 'turn_start_unobserved');
  assert.deepEqual(f.items(), [], 'a reconciled launch opens no item');
}));

const refused = (f, show, over = {}) => recoverWorkflowLaunch(f.ledger, { workflowId: f.workflowId, signal: f.read() }, {
  unobserved: ({ dispatch }) => unobservedLaunchTerminal({ dispatch }, { show }),
  close: () => { throw new Error('no closure permitted'); }, ...over });

for (const [name, reason, show] of [
  ['a turn that is or may be running (a heartbeat) is bound, never closed', 'kernel-launch-worker-live', () => shown({ dispatch: { lastHeartbeatAt: 1 } })],
  ['a worker Orca reports ready is a live seat, never closed', 'kernel-launch-worker-live', () => shown({ worker: { state: 'ready' } })],
  ['an Orca that does not answer proves nothing', 'kernel-launch-host-unavailable', () => ({ ok: false, hostUnavailable: true, error: 'orca down' })],
  ['an answer that names no terminal has nothing to adopt', 'kernel-launch-terminal-unnamed', () => shown({ dispatch: { assigneeHandle: null }, worker: { agentTerminalHandle: null } })],
  ['an answer for another Dispatch is not this launch\'s', 'kernel-launch-dispatch-mismatch', () => shown({ dispatch: { id: 'ctx_other' } })],
]) {
  test(`${name}: custody is kept and one Supervisor item names the Dispatch and the evidence`, (t) => fixture(t, (f) => {
    const before = f.read();
    const result = refused(f, show);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.deepEqual(f.read(), before, 'the signal stays');
    assert.notEqual(f.reservation().state, 'released', 'the original reservation stays');
    assert.equal(f.items().length, 1);
    const item = f.items()[0];
    assert.equal(item.decider, 'supervisor');
    assert.match(item.summary, new RegExp(DISPATCH));
    assert.equal(JSON.parse(item.evidence_json).reason, reason);
    refused(f, show);
    assert.equal(f.items().length, 1, 'asking again opens no second item');
  }));
}



test('a signal that changed while recovery ran is not this launch: nothing is adopted and no item is opened', (t) => fixture(t, (f) => {
  const stale = { ...f.read(), token: 'someone-else' };
  const result = recoverWorkflowLaunch(f.ledger, { workflowId: f.workflowId, signal: stale }, { unobserved: () => { throw new Error('Orca must not be asked'); }, close: () => { throw new Error('no'); } });
  assert.notEqual(result.ok, true);
  assert.equal(f.items().length, 0);
}));

test('the real receipt of the live stall (start_unknown, turn_start_unobserved, pending, no heartbeat) is adopted; a settled Dispatch is too', () => {
  assert.equal(unobservedLaunchTerminal({ dispatch: DISPATCH }, { show: () => shown() }).handle, TERMINAL);
  assert.equal(unobservedLaunchTerminal({ dispatch: DISPATCH }, { show: () => shown({ dispatch: { status: 'failed' }, worker: { state: 'failed' } }) }).ok, true);
  assert.equal(unobservedLaunchTerminal({ dispatch: DISPATCH }, { show: () => shown({ dispatch: { status: 'running' } }) }).reason, 'kernel-launch-worker-live');
});
