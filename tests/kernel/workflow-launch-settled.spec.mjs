// A Kernel launch that failed at worker-start left a Dispatch but no bound terminal; Orca's own report of that Dispatch reconciles it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { setSignal } from '../../engine/db/ledger.mjs';
import { recoverWorkflowLaunch } from '../../scripts/kernel/workflow-launch-custody.mjs';
import { settledLaunchTerminal } from '../../scripts/kernel/workflow-launch-settled.mjs';

const TERMINAL = 'term_f6e207d5-7104-41c9-bff3-1570d59affd8', DISPATCH = 'ctx_f2c4afca353d';

/** The answer Orca gave `worker-show` for the audited Dispatch: failed at agent_readiness, its terminal released. */
const orcaAnswer = ({ status = 'failed', state = 'failed', handle = TERMINAL } = {}) => ({ ok: true, state, hostUnavailable: false,
  result: { dispatch: { id: DISPATCH, status, assigneeHandle: handle }, worker: { dispatchId: DISPATCH, state, stage: 'agent_readiness', agentTerminalHandle: handle, lastError: 'timeout' },
    terminal: { handle, connected: false }, observation: { status: 'exited', exactWorker: true } } });

const fixture = (t, run) => withLedger(t, ({ ledger, machine }) => {
  const workflowId = 'wf-launch-settled', token = 'kernel-e0f450d0ad9a';
  seedWorkflow(ledger, { id: workflowId, state: { phase: 'queued' }, generation: 0,
    goal: { revision: 1, markdown: 'The accepted settled-launch fixture.', json: {} } });
  ledger.db.prepare("UPDATE goals SET approved_by='owner' WHERE workflow_id=?").run(workflowId);
  const reserved = machine.reserveProvider({ provider: 'codex', model: 'gpt-6.1-sol', role: 'kernel', attemptId: 'kernel:settled', maxParallel: 2, scope: { workflowId } });
  assert.equal(reserved.ok, true);
  const observed = machine.markProviderReservation({ ...reserved.reservation, state: 'unknown', handle: TERMINAL,
    launchIdentity: 'host-launch:settled', hostRequestId: 'settled-request' });
  assert.equal(observed.ok, true);
  const receipt = observed.reservation, admission = { ok: true, receipt, selected: { provider: receipt.provider, model: receipt.model } };
  setSignal(ledger.db, { scope: 'kernel', key: workflowId, workflowId, holderPid: 58752, token,
    value: { state: 'launch-unknown', terminal: null, dispatch: DISPATCH, admission, hostRequestId: null, effectState: 'partial' }, expiresAt: null });
  const read = () => ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const calls = [];
  const recover = ({ show = () => orcaAnswer(), terminalOf = () => 'disconnected', close } = {}) => recoverWorkflowLaunch(ledger, { workflowId, signal: read() }, {
    settled: (input) => settledLaunchTerminal(input, { show, terminalOf }),
    close: close ?? ((dispatch, options) => { calls.push([dispatch, options.handle]);
      return { dispatch, ok: true, handle: options.handle, closed: { ok: true, proof: 'disconnected', before: 'disconnected' }, processes: { verdict: 'none' } }; }) });
  const budget = () => machine.providerReservations().find((r) => r.id === receipt.id)?.state;
  return run({ ledger, workflowId, read, recover, calls, budget });
});

test('a Dispatch Orca reports failed with its terminal disconnected is closed, its admission released and the signal cleared', (t) => fixture(t, (f) => {
  const result = f.recover();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.effectState, 'none');
  assert.deepEqual(f.calls, [[DISPATCH, TERMINAL]]);
  assert.equal(f.read(), undefined, 'a following start finds no held launch');
  assert.equal(f.budget(), 'released');
  const event = JSON.parse(f.ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-launch-reconciled'").get(f.workflowId).payload_json);
  assert.deepEqual([event.dispatch, event.terminal], [DISPATCH, TERMINAL]);
}));

test('Dispatches Orca reports stopped or released are reconciled too', (t) => fixture(t, (f) => {
  assert.equal(settledLaunchTerminal({ dispatch: DISPATCH, receipt: { handle: TERMINAL } },
    { show: () => orcaAnswer({ status: 'released', state: 'released' }), terminalOf: () => 'gone' }).ok, true);
  assert.equal(f.recover({ show: () => orcaAnswer({ status: 'stopped', state: 'stopped' }), terminalOf: () => 'gone' }).ok, true);
}));

test('every answer Orca cannot positively give keeps the hold, names what is missing and touches nothing', (t) => fixture(t, (f) => {
  const before = f.read();
  const cases = [
    ['kernel-launch-dispatch-unsettled', { show: () => orcaAnswer({ status: 'running', state: 'running' }) }],
    ['kernel-launch-dispatch-unsettled', { show: () => orcaAnswer({ status: 'running', state: 'failed' }) }],
    ['kernel-launch-dispatch-unsettled', { show: () => orcaAnswer({ status: 'failed', state: 'ready' }) }],
    ['kernel-launch-host-unavailable', { show: () => ({ ok: false, hostUnavailable: true, error: 'orca is not running' }) }],
    ['kernel-launch-host-unavailable', { show: () => ({ ok: false, error: 'unreadable' }) }],
    ['kernel-launch-host-unavailable', { show: () => { throw Error('spawn failed'); } }],
    ['kernel-launch-terminal-unproven', { terminalOf: () => 'connected' }],
    ['kernel-launch-terminal-unproven', { terminalOf: () => 'unknown' }],
    ['kernel-launch-terminal-unproven', { show: () => orcaAnswer({ handle: 'term_foreign' }) }]
  ];
  for (const [reason, options] of cases) {
    const result = f.recover({ ...options, close: () => { throw Error('no close may start'); } });
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.effectState, 'unknown');
    assert.deepEqual(f.read(), before);
    assert.equal(f.budget(), 'unknown');
  }
  assert.deepEqual(f.calls, []);
}));

test('an unproven process closure after a settled Dispatch still retains the signal and the capacity', (t) => fixture(t, (f) => {
  const before = f.read();
  const result = f.recover({ close: (dispatch, options) => ({ dispatch, ok: true, handle: options.handle,
    closed: { ok: true, proof: 'disconnected', before: 'disconnected' }, processes: { verdict: 'unverifiable' } }) });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'kernel-launch-closure-unverified');
  assert.deepEqual(f.read(), before);
  assert.equal(f.budget(), 'unknown');
}));
