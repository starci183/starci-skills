import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { setSignal, changeWorkflowPhase } from '../../engine/db/ledger.mjs';
import { recoverWorkflowLaunch, releaseWorkflowWorker } from '../../scripts/kernel/workflow-launch-custody.mjs';

const fixture = (t, run) => withLedger(t, ({ ledger, machine }) => {
  const workflowId = 'wf-launch-recovery', token = 'original-launch', terminal = 'owned-kernel-terminal', dispatch = 'owned-dispatch';
  seedWorkflow(ledger, { id: workflowId, state: { phase: 'queued' }, generation: 0,
    goal: { revision: 1, markdown: 'The accepted recovery fixture.', json: {} } });
  ledger.db.prepare("UPDATE goals SET approved_by='owner' WHERE workflow_id=?").run(workflowId);
  const reserved = machine.reserveProvider({ provider: 'codex', model: 'gpt-6.1-sol', role: 'kernel', attemptId: 'original-attempt',
    maxParallel: 2, scope: { workflowId } });
  assert.equal(reserved.ok, true);
  const observed = machine.markProviderReservation({ ...reserved.reservation, state: 'unknown', handle: terminal,
    launchIdentity: 'original-launch-identity', hostRequestId: 'original-request' });
  assert.equal(observed.ok, true);
  const receipt = observed.reservation, admission = { ok: true, receipt, selected: { provider: receipt.provider, model: receipt.model } };
  const foreign = machine.reserveProvider({ provider: 'codex', model: 'gpt-6.1-sol', role: 'kernel', attemptId: 'foreign-attempt', maxParallel: 2 });
  assert.equal(foreign.ok, true);
  setSignal(ledger.db, { scope: 'kernel', key: workflowId, workflowId, holderPid: 4123, token,
    value: { state: 'launch-unknown', terminal, dispatch, admission }, expiresAt: null });
  const read = () => ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const closed = () => ({ ok: true, handle: terminal, closed: { ok: true, proof: 'gone' }, processes: { verdict: 'none' } });
  return run({ ledger, machine, workflowId, token, terminal, dispatch, admission, foreign: foreign.reservation, read, closed });
});

test('held launch recovery closes the exact worker and actual original provider fence before clearing its reservation', (t) => fixture(t, (f) => {
  const calls = [], foreignBefore = f.machine.providerReservations().find(r => r.id === f.foreign.id);
  const result = recoverWorkflowLaunch(f.ledger, { workflowId: f.workflowId, signal: f.read() }, {
    close: (dispatch, options) => { calls.push([dispatch, options.handle]); return f.closed(); }
  });
  assert.equal(result.ok, true, JSON.stringify(result));
  assert.equal(result.effectState, 'none');
  assert.deepEqual(calls, [[f.dispatch, f.terminal]]);
  assert.equal(f.read(), undefined);
  assert.equal(f.machine.providerReservations().find(r => r.id === f.admission.receipt.id).state, 'released');
  assert.deepEqual(f.machine.providerReservations().find(r => r.id === f.foreign.id), foreignBefore);
  const row = f.ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-launch-reconciled'").get(f.workflowId);
  const event = JSON.parse(row.payload_json);
  assert.equal(event.reservation, f.token);
  assert.equal(event.admission.id, f.admission.receipt.id);
  assert.equal(event.budget.ok, true);
}));

test('missing identity or provider custody causes no closure call and retains the original machine reservations', (t) => fixture(t, (f) => {
  const before = f.read(), budgets = f.machine.providerReservations();
  const original = JSON.parse(before.value_json);
  for (const changed of [{ dispatch: null }, { terminal: null }, { admission: null },
    { admission: { ...original.admission, receipt: { ...original.admission.receipt, handle: 'foreign-terminal' } } }]) {
    setSignal(f.ledger.db, { scope: 'kernel', key: f.workflowId, workflowId: f.workflowId, token: f.token,
      holderPid: before.holder_pid, value: { ...original, ...changed }, expiresAt: null });
    const signal = f.read();
    const result = recoverWorkflowLaunch(f.ledger, { workflowId: f.workflowId, signal }, { close: () => { throw Error('no effect permitted'); } });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'kernel-launch-custody-incomplete');
    assert.deepEqual(f.read(), signal);
    assert.deepEqual(f.machine.providerReservations(), budgets);
  }
}));

test('incomplete, contradictory and throwing closure never releases capacity or clears the held signal', (t) => fixture(t, (f) => {
  const before = f.read(), budgets = f.machine.providerReservations();
  for (const close of [() => ({ ok: true }), () => ({ ...f.closed(), handle: 'foreign-terminal' }),
    () => ({ ...f.closed(), processes: { verdict: 'unverifiable' } }), () => { throw Error('host unavailable'); }]) {
    const result = recoverWorkflowLaunch(f.ledger, { workflowId: f.workflowId, signal: before }, { close });
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'kernel-launch-closure-unverified');
    assert.deepEqual(f.read(), before);
    assert.deepEqual(f.machine.providerReservations(), budgets);
  }
}));

test('provider release refusal after exact closure keeps the singleton and reports the remaining capacity custody', (t) => fixture(t, (f) => {
  const before = f.read(), budgets = f.machine.providerReservations();
  const result = recoverWorkflowLaunch(f.ledger, { workflowId: f.workflowId, signal: before }, {
    close: f.closed, releaseAdmission: () => ({ ok: false, reason: 'store-unavailable' })
  });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'kernel-launch-capacity-retained');
  assert.equal(result.closure.ok, true);
  assert.equal(result.budget.ok, false);
  assert.deepEqual(f.read(), before);
  assert.deepEqual(f.machine.providerReservations(), budgets);
}));

test('a newer reservation or accepted goal after closure is never overwritten by the old recovery', (t) => fixture(t, (f) => {
  const before = f.read();
  const result = recoverWorkflowLaunch(f.ledger, { workflowId: f.workflowId, signal: before }, { close: () => {
    setSignal(f.ledger.db, { scope: 'kernel', key: f.workflowId, workflowId: f.workflowId,
      token: 'newer-launch', holderPid: 5123, value: { state: 'starting' }, expiresAt: Date.now() + 60000 });
    return f.closed();
  } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'kernel-launch-recovery-authority-lost');
  assert.equal(f.read().token, 'newer-launch');
  assert.equal(f.ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='kernel-launch-reconciled'").get().n, 0);
}));

test('retirement during closure keeps the signal without an archived product event or rollback assertion', (t) => fixture(t, (f) => {
  const before = f.read();
  const result = recoverWorkflowLaunch(f.ledger, { workflowId: f.workflowId, signal: before }, { close: () => {
    assert.equal(changeWorkflowPhase(f.ledger.db, { workflowId: f.workflowId, to: 'stopped', by: 'owner', reason: 'fixture stop' }), true);
    assert.equal(changeWorkflowPhase(f.ledger.db, { workflowId: f.workflowId, to: 'archived', by: 'owner', reason: 'fixture archive' }), true);
    return f.closed();
  } });
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'kernel-launch-recovery-authority-lost');
  assert.deepEqual(f.read(), before);
  assert.equal(f.ledger.db.prepare("SELECT count(*) n FROM events WHERE kind='kernel-launch-reconciled'").get().n, 0);
}));

test('the shared worker closer refuses an accepted release without exact terminal and process-tree exit', () => {
  for (const made of [{ ok: true }, { ok: true, handle: 'owned', closed: { ok: true, proof: 'requested' }, processes: { verdict: 'none' } }]) {
    assert.equal(releaseWorkflowWorker('dispatch', 'owned', { close: () => made }).ok, false);
  }
});
