import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { ensureWorkflowHost, installWorkflowTree, workflowStartAuthority, commitWorkflowStart, recordWorkflowStartFailure } from '../../scripts/kernel/workflow-startup.mjs';
import { setSignal, updateSignal, bindKernelJob, transitionWorkflowToRunning, changeWorkflowPhase } from '../../engine/db/ledger.mjs';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';

const accepted = () => ({ workflow: { workflow_id: 'wf-approved', goal_identity: 'goal-a', phase: 'queued' },
  goal: { approved_by: 'owner', goal_identity: 'goal-a', revision: 0, markdown: 'Implement the accepted login scope.', json: '{}' } });

test('unapproved, incomplete, stale and inactive goals cause no host effect', async () => {
  const cases = [null, { ...accepted(), goal: { ...accepted().goal, approved_by: null } },
    { ...accepted(), goal: { ...accepted().goal, approved_by: 'supervisor' } },
    { ...accepted(), goal: { ...accepted().goal, markdown: '' } },
    { ...accepted(), goal: { ...accepted().goal, goal_identity: 'stale' } },
    { ...accepted(), goal: { ...accepted().goal, json: '{"provisional":true}' } },
    ...['awaiting-approval', 'stopped', 'paused', 'finished', 'archived'].map((phase) => ({ ...accepted(), workflow: { ...accepted().workflow, phase } }))];
  for (const input of cases) {
    const effects = [];
    const result = await ensureWorkflowHost(input ?? {}, { ensureHost: async () => { effects.push('host'); return { ok: true }; } });
    assert.equal(result.ok, false);
    assert.deepEqual(effects, []);
  }
});

test('accepted plan records authority without host or native worker effects', async () => {
  const result = await ensureWorkflowHost({ ...accepted(), plan: true }, { ensureHost: async () => { throw Error('plan must not reach the host'); } });
  assert.equal(result.ok, true);
  assert.equal(result.ready, false);
  assert.equal(result.planned, true);
  assert.equal(workflowStartAuthority(accepted()).goalRevision, 0);
});

test('accepted startup ensures the nonrecursive host and starts no debug agent', async () => {
  const calls = [], env = { fixture: 'owner' };
  const result = await ensureWorkflowHost({ ...accepted(), env }, {
    ensureHost: async (input) => { calls.push(['host', input]); return { ok: true, leader: 'engine-a' }; } });
  assert.equal(result.ready, true);
  assert.deepEqual(calls, [['host', { env, workflowSeats: false }]]);
  assert.equal(Object.hasOwn(result, 'maintenance'), false);
});

test('a red or throwing host leaves startup not ready with the host receipt', async () => {
  const red = await ensureWorkflowHost(accepted(), { ensureHost: async () => ({ ok: false, items: [{ id: 'harness-tunnel', status: 'red' }] }) });
  assert.equal(red.ready, false);
  assert.equal(red.reason, 'workflow-host-not-ready');
  assert.equal(red.host.items[0].id, 'harness-tunnel');
  const thrown = await ensureWorkflowHost(accepted(), { ensureHost: async () => { throw Error('native outcome unavailable'); } });
  assert.equal(thrown.ready, false);
  assert.equal(thrown.host.effectState, 'unknown');
});

test('workflow install uses the native npmCi owner in the exact tree with the shared lock role', async () => {
  const record = { path: '/owned/workflow', orcaWorktreeId: 'tree-a' }, env = { fixture: 'machine' }, calls = [];
  const result = await installWorkflowTree({ record, env }, { npmCi: async (ctx) => { calls.push(ctx); return { code: 0, data: { schema: 'starci/npm-ci@1', ok: true, cwd: ctx.cwd, ms: 42 } }; } });
  assert.deepEqual(calls, [{ cwd: record.path, role: 'coordinator', env, args: {}, ifNeeded: true }]);
  assert.equal(result.installed, true);
  assert.equal(result.receipt.ms, 42);
});

test('failed native installation retains the exact owned tree identity and never reports installed', async () => {
  const record = { path: '/owned/workflow', orcaWorktreeId: 'tree-a' };
  const result = await installWorkflowTree({ record }, { npmCi: async () => ({ code: 1, text: 'registry unavailable', data: { ok: false, cwd: record.path } }) });
  assert.equal(result.ok, false);
  assert.equal(result.installed, false);
  assert.equal(result.path, record.path);
  assert.equal(record.orcaWorktreeId, 'tree-a');
  assert.match(result.error, /registry unavailable/);
  const threw = await installWorkflowTree({ record }, { npmCi: async () => { throw Error('install receipt unreadable'); } });
  assert.equal(threw.ok, false);
  assert.equal(threw.installed, false);
  assert.equal(threw.path, record.path);
  assert.equal(threw.receipt, null);
  assert.match(threw.error, /receipt unreadable/);
});

test('default workflow host crosses the declared private child boundary with the original role and no caller flags', async () => {
  const env = { STARCI_ROLE: 'lead', fixture: 'host' }, calls = [];
  const result = await ensureWorkflowHost({ ...accepted(), env }, {
    execNode: async (args, options) => {
      calls.push({ args, options });
      return { error: null, stdout: JSON.stringify({ ok: true, hostOk: true, items: [] }), stderr: '' };
    }
  });
  assert.equal(result.ready, true);
  assert.deepEqual(calls[0].args, [path.join(skillRoot, 'scripts/reconciler/workflow-up.mjs'), '--json']);
  assert.deepEqual(calls[0].options.env, { ...env, STARCI_RUNTIME: skillRoot });
  assert.equal(calls[0].options.cwd, skillRoot);
});

test('incomplete, killed or contradictory native startup outcomes remain unknown and refuse readiness', async () => {
  const green = JSON.stringify({ ok: true, hostOk: true });
  for (const made of [{ stdout: '{}' }, { stdout: green, error: { code: 1 } },
    { stdout: green, error: { code: 0, killed: true } }, { stdout: 'not-json', error: { code: 'ENOENT' } }]) {
    const result = await ensureWorkflowHost(accepted(), { execNode: async () => made });
    assert.equal(result.ready, false);
    assert.equal(result.reason, 'workflow-host-not-ready');
    assert.equal(result.host.effectState, 'unknown');
  }
});


const startupLedger = (t, fn) => withLedger(t, ({ ledger, machine }) => {
  const workflowId = 'wf-publication', token = 'reservation-a', holderPid = 7123, at = 1000;
  seedWorkflow(ledger, { id: workflowId, state: { phase: 'queued' }, generation: 0,
    goal: { revision: 1, markdown: 'The actual approved fixture goal.', json: {} } });
  ledger.db.prepare("UPDATE goals SET approved_by='owner' WHERE workflow_id=?").run(workflowId);
  setSignal(ledger.db, { scope: 'kernel', key: workflowId, workflowId, token, holderPid,
    value: { state: 'starting' }, at, expiresAt: at + 1000 });
  const input = () => ({ workflow: ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId),
    goal: ledger.db.prepare('SELECT * FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(workflowId) });
  fn({ ledger, machine, workflowId, token, holderPid, at, now: () => at, expected: workflowStartAuthority(input()) });
});

test('final publication atomically owns the original goal, reservation and running seat', (t) => startupLedger(t, (ctx) => {
  const { ledger, workflowId, token, at } = ctx;
  const result = commitWorkflowStart(ledger, ctx, ({ authority }) => {
    assert.equal(ledger.transaction.active(), true);
    assert.equal(updateSignal(ledger.db, { scope: 'kernel', key: workflowId, token, value: { terminal: 'new-kernel', dispatch: 'dispatch-a' }, expiresAt: null }), true);
    bindKernelJob(ledger.db, { workflowId, workerId: 'new-kernel', generation: authority.generation, at });
    assert.equal(transitionWorkflowToRunning(ledger, { workflowId, now: at }), true);
    ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'kernel-booted', payload: { terminal: 'new-kernel' }, createdAt: at });
  });
  assert.equal(result.ok, true);
  assert.equal(ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(workflowId).phase, 'running');
  assert.equal(ledger.db.prepare('SELECT worker_id FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`).worker_id, 'new-kernel');
  assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM events WHERE kind='kernel-booted'").get().n, 1);
}));

for (const change of ['goal-revision', 'goal-identity', 'approval', 'phase', 'generation', 'token', 'holder', 'expiry'])
test(`final publication refuses changed ${change} without a running seat or boot acknowledgement`, (t) => startupLedger(t, (ctx) => {
  const { ledger, workflowId, token, at } = ctx;
  if (change === 'goal-revision') ledger.db.prepare('UPDATE goals SET revision=revision+1 WHERE workflow_id=?').run(workflowId);
  if (change === 'goal-identity') ledger.db.prepare("UPDATE goals SET goal_identity='superseded' WHERE workflow_id=?").run(workflowId);
  if (change === 'approval') ledger.db.prepare('UPDATE goals SET approved_by=NULL WHERE workflow_id=?').run(workflowId);
  if (change === 'phase') {
    ledger.db.prepare("INSERT INTO lifecycle_changes(workflow_id,from_phase,to_phase,by,reason,at) VALUES(?,'queued','stopped','owner','fixture stop',?)").run(workflowId, at);
    ledger.db.prepare("UPDATE workflows SET phase='stopped' WHERE workflow_id=?").run(workflowId);
  }
  if (change === 'generation') ledger.db.prepare('UPDATE workflows SET generation=generation+1 WHERE workflow_id=?').run(workflowId);
  if (change === 'token') setSignal(ledger.db, { scope: 'kernel', key: workflowId, token: 'reservation-newer', holderPid: 9123, value: { state: 'starting' }, at, expiresAt: at + 1000 });
  if (change === 'holder') ledger.db.prepare("UPDATE signals SET holder_pid=9123 WHERE scope='kernel' AND key=?").run(workflowId);
  if (change === 'expiry') ledger.db.prepare("UPDATE signals SET expires_at=? WHERE scope='kernel' AND key=?").run(at, workflowId);
  const before = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  let writes = 0;
  assert.equal(commitWorkflowStart(ledger, ctx, () => { writes++; }).ok, false);
  assert.equal(writes, 0);
  assert.deepEqual(ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId), before);
  assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM jobs WHERE kind='kernel'").get().n, 0);
  assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM events WHERE kind='kernel-booted'").get().n, 0);
}));

test('a publication error rolls back the signal and seat before cleanup is required', (t) => startupLedger(t, (ctx) => {
  const { ledger, workflowId, token, at } = ctx;
  assert.throws(() => commitWorkflowStart(ledger, ctx, () => {
    updateSignal(ledger.db, { scope: 'kernel', key: workflowId, token, value: { terminal: 'unpublished-kernel' }, expiresAt: null });
    bindKernelJob(ledger.db, { workflowId, workerId: 'unpublished-kernel', generation: 0, at });
    throw Error('durable boot acknowledgement failed');
  }), /durable boot acknowledgement/);
  assert.deepEqual(JSON.parse(ledger.db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId).value_json), { state: 'starting' });
  assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM jobs WHERE kind='kernel'").get().n, 0);
}));

for (const transferred of [false, true]) test(`uncertain cleanup retains its exact original custody without overwriting a newer ${transferred ? 'holder' : 'token'}`, (t) => startupLedger(t, (ctx) => {
  const { ledger, workflowId, token, at } = ctx;
  setSignal(ledger.db, { scope: 'kernel', key: workflowId, token: transferred ? token : 'reservation-newer', holderPid: 9123,
    value: { state: 'starting' }, at, expiresAt: at + 1000 });
  const before = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  const extra = { effectState: 'unknown', dispatch: 'dispatch-old', admission: { receipt: { id: 'capacity-old', fence: 1 } } };
  const failure = recordWorkflowStartFailure(ledger, { ...ctx, step: 'kernel-start-reservation-lost', error: 'closure remains unverified', handle: 'old-kernel', extra });
  assert.equal(failure.signalRetained, false);
  assert.equal(failure.reservation, token);
  assert.deepEqual(ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId), before);
  const event = JSON.parse(ledger.db.prepare("SELECT payload_json FROM events WHERE kind='kernel-start-failed'").get().payload_json);
  assert.equal(event.dispatch, 'dispatch-old');
  assert.deepEqual(event.admission, extra.admission);
  assert.equal(ledger.db.prepare("SELECT COUNT(*) n FROM incidents WHERE status='open'").get().n, 1);
  recordWorkflowStartFailure(ledger, { ...ctx, step: 'publication-refused', error: 'exact old worker closure proven', extra: { effectState: 'none' } });
  assert.deepEqual(ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId), before);
}));

test('uncertain cleanup preserves its own singleton without treating expiry as worker exit', (t) => startupLedger(t, (ctx) => {
  const { ledger, workflowId } = ctx;
  const failure = recordWorkflowStartFailure(ledger, { ...ctx, step: 'publication-refused', error: 'cleanup unknown', handle: 'unsettled-kernel',
    extra: { effectState: 'unknown', dispatch: 'dispatch-a', admission: { receipt: { id: 'capacity-a' } } } });
  assert.equal(failure.signalRetained, true);
  const signal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  assert.equal(signal.token, ctx.token);
  assert.equal(signal.expires_at, null);
  assert.equal(JSON.parse(signal.value_json).state, 'launch-unknown');
}));


test('archived-during-launch refuses publication and durably retains unknown custody in the private machine only', (t) => startupLedger(t, (ctx) => {
  const { ledger, machine, workflowId, token, at } = ctx;
  const capacity = machine.reserveProvider({ provider: 'codex', account: 'fixture', attemptId: 'archive-start',
    model: 'fixture-model', role: 'kernel', maxParallel: 1, scope: { workflowId } });
  assert.equal(capacity.ok, true);
  assert.equal(machine.markProviderReservation({ ...capacity.reservation, state: 'unknown',
    launchIdentity: 'archive-launch', hostRequestId: 'archive-host-request', handle: 'archived-kernel' }).ok, true);
  ledger.transaction(() => {
    changeWorkflowPhase(ledger.db, { workflowId, to: 'stopped', by: 'owner', reason: 'retire during worker start', at });
    changeWorkflowPhase(ledger.db, { workflowId, to: 'archived', by: 'owner', reason: 'fixture archive', at: at + 1 });
  });
  const product = () => Object.fromEntries(['workflows', 'signals', 'events', 'incidents', 'jobs'].map((table) =>
    [table, ledger.db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all()]));
  const before = product(), reservations = machine.providerReservations();
  let published = 0;
  assert.equal(commitWorkflowStart(ledger, ctx, () => { published++; }).reason, 'workflow-not-startable');
  assert.equal(published, 0);
  const extra = { effectState: 'unknown', dispatch: 'archive-dispatch', admission: { receipt: capacity.reservation },
    cleanup: { ok: false, error: 'exact closure remains unknown' } };
  const failure = recordWorkflowStartFailure(ledger, { ...ctx, step: 'workflow-not-startable',
    error: 'workflow retired while the exact worker was awaited', handle: 'archived-kernel', extra });
  assert.equal(failure.signalRetained, false);
  assert.equal(failure.custody.ok, true);
  assert.equal(failure.custody.owner, 'machine-supervisor');
  assert.deepEqual(product(), before);
  assert.deepEqual(machine.providerReservations(), reservations);
  const event = machine.supEvents({ kind: 'kernel-start-failed', entityId: workflowId })[0];
  assert.equal(event.event_id, failure.custody.event.eventId);
  assert.equal(event.payload.reservation, token);
  assert.equal(event.payload.dispatch, extra.dispatch);
  assert.deepEqual(event.payload.admission, extra.admission);
  const decisions = machine.listSupDecisions({ kind: 'runtime-defect' });
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].di_id, failure.custody.decision.diId);
  assert.deepEqual(decisions[0].evidence, { step: failure.step, error: failure.error, terminal: failure.terminal,
    ...extra, reservation: token, signalRetained: false, runtimeRev: event.payload.runtimeRev });
  assert.match(event.payload.runtimeRev, /^[0-9a-f]{40}$/, 'the failure records the runtime revision it failed under');
  const replay = recordWorkflowStartFailure(ledger, { ...ctx, step: failure.step, error: failure.error, handle: failure.terminal, extra });
  assert.equal(replay.custody.decision.diId, failure.custody.decision.diId);
  assert.equal(replay.custody.decision.created, false);
  assert.equal(machine.listSupDecisions({ kind: 'runtime-defect' }).length, 1);
  assert.deepEqual(product(), before);
  assert.deepEqual(machine.providerReservations(), reservations);
}));

test('retired custody write failure stays visible and does not mutate the archived product or provider reservation', (t) => startupLedger(t, (ctx) => {
  const { ledger, machine, workflowId, at } = ctx;
  ledger.transaction(() => {
    changeWorkflowPhase(ledger.db, { workflowId, to: 'stopped', by: 'owner', reason: 'retire', at });
    changeWorkflowPhase(ledger.db, { workflowId, to: 'archived', by: 'owner', reason: 'archive', at: at + 1 });
  });
  const before = ledger.db.prepare('SELECT * FROM events ORDER BY seq').all();
  const signals = ledger.db.prepare('SELECT * FROM signals').all(), reservations = machine.providerReservations();
  const failure = recordWorkflowStartFailure(ledger, { ...ctx, step: 'publication-refused', error: 'worker closure unknown',
    handle: 'retained-kernel', extra: { effectState: 'unknown', dispatch: 'retained-dispatch' } }, {
    machine: () => { throw Error('private machine writer unavailable'); }
  });
  assert.equal(failure.custody.ok, false);
  assert.match(failure.custody.error, /machine writer unavailable/);
  assert.equal(failure.dispatch, 'retained-dispatch');
  assert.equal(failure.terminal, 'retained-kernel');
  assert.deepEqual(ledger.db.prepare('SELECT * FROM events ORDER BY seq').all(), before);
  assert.deepEqual(ledger.db.prepare('SELECT * FROM signals').all(), signals);
  assert.deepEqual(machine.providerReservations(), reservations);
}));
