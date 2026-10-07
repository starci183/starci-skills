import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { setSignal, updateWorkflow } from '../../engine/db/ledger.mjs';
import { workflowStartAuthority } from '../../scripts/kernel/workflow-startup.mjs';
import { launchKernelGroup } from '../../scripts/kernel/launch-kernel-group.mjs';

const fixture = (t, run) => withLedger(t, ({ ledger }) => {
  const workflowId = 'wf-group-fence', token = 'starting-owner', at = 1000;
  seedWorkflow(ledger, { id: workflowId, state: { phase: 'queued' }, generation: 0,
    goal: { revision: 1, markdown: 'The accepted group fence fixture.', json: {} } });
  ledger.db.prepare("UPDATE goals SET approved_by='owner' WHERE workflow_id=?").run(workflowId);
  setSignal(ledger.db, { scope: 'kernel', key: workflowId, workflowId, token, holderPid: process.pid,
    value: { state: 'starting' }, expiresAt: at + 1000, at });
  const expected = workflowStartAuthority({
    workflow: ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId),
    goal: ledger.db.prepare('SELECT * FROM goals WHERE workflow_id=?').get(workflowId)
  });
  const members = [{ id: 'codex/gpt-6.1-sol', agent: 'codex', model: 'gpt-6.1-sol' }, { id: 'claude/claude-opus-5-5', agent: 'claude', model: 'claude-opus-5-5' }];
  const config = { ledger, workflowId, token, expected, members, route: { ...members[0], members, fallThrough: true },
    launch: { request: { workflow: workflowId } }, reservationMs: 1000, hostUnavailableExit: 75,
    memberLabel: m => m.agent, failStart: (step, error) => { throw Object.assign(Error(error), { step }); } };
  const read = () => ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  return run({ ledger, workflowId, token, at, config, read });
});

test('lost, expired, foreign-holder and stale-goal reservations cause zero group launch attempts', (t) => fixture(t, (f) => {
  const original = f.read();
  for (const changed of [{ token: 'newer-owner' }, { holderPid: process.pid + 1 }, { expiresAt: f.at }]) {
    setSignal(f.ledger.db, { scope: 'kernel', key: f.workflowId, workflowId: f.workflowId,
      token: original.token, holderPid: original.holder_pid, value: { state: 'starting' }, expiresAt: original.expires_at, ...changed });
    const before = f.read();
    assert.throws(() => launchKernelGroup(f.config, { now: () => f.at, start: () => { throw Error('launch must not occur'); } }),
      error => error.step === 'kernel-start-reservation-lost');
    assert.deepEqual(f.read(), before);
  }
  setSignal(f.ledger.db, { scope: 'kernel', key: f.workflowId, workflowId: f.workflowId,
    token: original.token, holderPid: original.holder_pid, value: { state: 'starting' }, expiresAt: original.expires_at });
  updateWorkflow(f.ledger.db, { workflowId: f.workflowId, generation: 1 });
  assert.throws(() => launchKernelGroup(f.config, { now: () => f.at, start: () => { throw Error('stale goal must not launch'); } }),
    error => error.step === 'workflow-goal-unverified');
}));

test('a lost fence after a no-effect first member refuses fallback without touching the newer reservation', (t) => fixture(t, (f) => {
  const calls = [];
  assert.throws(() => launchKernelGroup(f.config, { now: () => f.at, start: input => {
    calls.push(input.provider);
    setSignal(f.ledger.db, { scope: 'kernel', key: f.workflowId, workflowId: f.workflowId,
      token: 'newer-owner', holderPid: 5123, value: { state: 'starting' }, expiresAt: f.at + 1000 });
    return { ok: false, provider: input.provider, step: 'worker-start', error: 'fixture no effect', effectState: 'none' };
  } }), error => error.step === 'kernel-start-reservation-lost');
  assert.deepEqual(calls, ['codex']);
  assert.equal(f.read().token, 'newer-owner');
}));

test('a no-effect refusal falls through under the same renewed accepted reservation and remaining model group', (t) => fixture(t, (f) => {
  const calls = [];
  const result = launchKernelGroup(f.config, { now: () => f.at, start: input => {
    calls.push(input);
    assert.equal(f.read().token, f.token);
    assert.equal(f.read().expires_at, f.at + f.config.reservationMs);
    return calls.length === 1 ? { ok: false, step: 'worker-start', error: 'fixture no effect', effectState: 'none' }
      : { ok: true, provider: input.provider, model: input.model };
  } });
  assert.deepEqual(calls.map(c => c.provider), ['codex', 'claude']);
  assert.deepEqual(calls[1].allowGroup, [{ id: 'claude/claude-opus-5-5', provider: 'claude', model: 'claude-opus-5-5', effort: undefined }], 'the remaining members keep their tier ids for the pick record');
  assert.equal(result.spawned.ok, true);
  assert.equal(result.fellThrough.length, 1);
}));

test('a reservation that expires while entering the real transaction cannot be renewed or launch', (t) => fixture(t, (f) => {
  const before = f.read();
  const eventsBefore = f.ledger.db.prepare('SELECT count(*) AS n FROM events').get().n;
  let at = f.at, calls = 0, entered = false;
  const delayed = { ...f.ledger, transaction: callback => f.ledger.transaction(db => {
    assert.equal(f.ledger.transaction.active(), true, 'the real BEGIN IMMEDIATE already acquired the write transaction');
    entered = true;
    at = before.expires_at;
    return callback(db);
  }) };
  assert.throws(() => launchKernelGroup({ ...f.config, ledger: delayed }, {
    now: () => at, start: () => { calls += 1; throw Error('expired reservation must not launch'); }
  }), error => error.step === 'kernel-start-reservation-lost');
  assert.equal(entered, true);
  assert.equal(calls, 0);
  assert.deepEqual(f.read(), before, 'the expired row must not be renewed or replaced');
  assert.equal(f.ledger.db.prepare('SELECT count(*) AS n FROM events').get().n, eventsBefore);
}));
