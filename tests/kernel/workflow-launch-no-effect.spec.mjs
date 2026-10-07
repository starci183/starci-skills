import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { setSignal } from '../../engine/db/ledger.mjs';
import { recoverWorkflowLaunch } from '../../scripts/kernel/workflow-launch-custody.mjs';
import { kernelLaunchNoEffect } from '../../scripts/kernel/workflow-launch-no-effect.mjs';
import { orcaRequestIdOf } from '../../scripts/lib/orca-request-id.mjs';

// The row a Kernel start left when run-create was refused with no_active_sender_terminal and the wrapper dropped the
// effect state: no terminal, no Dispatch, a kernel admission whose attempt scope names the kernel attempt.
const NO_SENDER = 'no_active_sender_terminal: Could not determine the sender terminal for this orchestration command. '
  + 'Pass --from with your own terminal handle or run the command inside a live Orca terminal with ORCA_TERMINAL_HANDLE set.';

const fixture = (t, run, { failure = { step: 'run-create', error: NO_SENDER }, release = false } = {}) => withLedger(t, ({ ledger, machine }) => {
  const workflowId = 'wf-no-sender', token = 'kernel-4d388b2d11f6';
  seedWorkflow(ledger, { id: workflowId, state: { phase: 'queued' }, generation: 0,
    goal: { revision: 1, markdown: 'The accepted no-sender fixture.', json: {} } });
  ledger.db.prepare("UPDATE goals SET approved_by='owner' WHERE workflow_id=?").run(workflowId);
  const scopeId = `ledger:${workflowId}:kernel-attempt:1`;
  const reserved = machine.reserveProvider({ provider: 'claude', model: 'claude-opus-5-5', role: 'kernel', attemptId: 'kernel:ff2e6d14',
    maxParallel: 6, scope: { scopeId, jobId: `kernel-${workflowId}` } });
  assert.equal(reserved.ok, true, JSON.stringify(reserved));
  let receipt = reserved.reservation;
  if (release) {
    const released = machine.releaseProviderReservation({ ...receipt, proof: { kind: 'failed-before-launch', confirmed: true } });
    assert.equal(released.ok, true);
    receipt = released.reservation;
  }
  const admission = { ok: true, receipt, selected: { provider: 'claude', model: 'claude-opus-5-5' } };
  setSignal(ledger.db, { scope: 'kernel', key: workflowId, workflowId, holderPid: 3440, token,
    value: { state: 'launch-unknown', terminal: null, dispatch: null, admission, effectState: 'unknown' }, expiresAt: null });
  if (failure) ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation: 0,
    kind: 'kernel-start-failed', createdAt: Date.now(),
    payload: { terminal: null, effectState: 'unknown', admission, reservation: token, signalRetained: true, ...failure } }));
  const read = () => ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const state = () => machine.providerReservations().find((r) => r.id === receipt.id)?.state;
  const asked = [];
  const recover = ({ requestState = 'absent', runs = [] } = {}) => recoverWorkflowLaunch(ledger, { workflowId, signal: read() }, {
    close: () => { throw Error('no worker exists to close'); },
    noEffect: (l, a) => kernelLaunchNoEffect(l, a, { requestState: (id) => { asked.push(id); return requestState; }, runs: () => runs }) });
  return run({ ledger, machine, workflowId, token, read, state, asked, recover, admission });
});

test('a launch-unknown row left by a refused run-create (no terminal, no Dispatch) is released from the recorded Orca refusal', (t) => fixture(t, (f) => {
  assert.equal(f.state(), 'reserved');
  const result = f.recover();
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.effectState, 'none');
  assert.equal(f.read(), undefined);
  assert.equal(f.state(), 'released', 'the provider slot of the failed attempt is released, not leaked');
  assert.deepEqual(f.asked, [orcaRequestIdOf('run-create', { workflow: f.workflowId, kernelAttempt: 1, reservation: f.token, entry: null, replaces: null })]);
  const row = f.ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-launch-reconciled'").get(f.workflowId);
  const event = JSON.parse(row.payload_json);
  assert.equal(event.evidence.refusal.code, 'no_active_sender_terminal');
  assert.equal(event.evidence.requestState, 'absent');
}));

test('a refused run-create whose reservation was already released recovers and keeps the release', (t) => fixture(t, (f) => {
  assert.equal(f.state(), 'released');
  assert.equal(f.recover().ok, true);
  assert.equal(f.read(), undefined);
  assert.equal(f.state(), 'released');
}, { release: true }));

test('the stored request id is the one asked of Orca', (t) => fixture(t, (f) => {
  const value = JSON.parse(f.read().value_json);
  setSignal(f.ledger.db, { scope: 'kernel', key: f.workflowId, workflowId: f.workflowId, holderPid: 3440, token: f.token,
    value: { ...value, hostRequestId: 'stored-request-id' }, expiresAt: null });
  assert.equal(f.recover().ok, true);
  assert.deepEqual(f.asked, ['stored-request-id']);
}));

test('a request Orca shows taken, pending or unreadable, or a Run that exists, keeps the held launch and its capacity', (t) => fixture(t, (f) => {
  const before = f.read();
  const later = new Date(Date.now() + 5000).toISOString();
  const cases = [[{ requestState: 'completed' }, 'kernel-launch-effect-partial'], [{ requestState: 'pending' }, 'kernel-launch-effect-partial'],
    [{ requestState: null }, 'kernel-launch-request-unreadable'], [{ runs: null }, 'kernel-launch-runs-unreadable'],
    [{ runs: [{ id: 'run_1', objective: `[Kernel] Name — ${f.workflowId}`, created_at: later }] }, 'kernel-launch-run-exists']];
  for (const [answers, reason] of cases) {
    const result = f.recover(answers);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
    assert.equal(result.effectState, 'unknown');
    assert.deepEqual(f.read(), before);
    assert.equal(f.state(), 'reserved');
  }
}));

test('a Run of an earlier attempt or of another workflow does not block the recovery', (t) => fixture(t, (f) => {
  const runs = [{ id: 'run_old', objective: `[Kernel] Name — ${f.workflowId}`, created_at: '2020-01-01T00:00:00Z' },
    { id: 'run_other', objective: '[Kernel] Name — wf-other', created_at: new Date(Date.now() + 5000).toISOString() }];
  assert.equal(f.recover({ runs }).ok, true);
}));

test('without a recorded typed Orca refusal at run-create the row stays held', (t) => fixture(t, (f) => {
  const result = f.recover();
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'kernel-launch-custody-incomplete');
  assert.deepEqual(f.asked, []);
  assert.equal(f.state(), 'reserved');
}, { failure: null }));

test('an ambiguous failure (an unsettled receipt, or a step other than run-create) is not evidence of no effect', (t) => {
  for (const failure of [{ step: 'run-create', error: 'Orca mutation receipt is unsettled: request-absent' }, { step: 'worker-start', error: NO_SENDER }])
    fixture(t, (f) => {
      assert.equal(f.recover().reason, 'kernel-launch-custody-incomplete');
      assert.equal(f.state(), 'reserved');
    }, { failure });
});
