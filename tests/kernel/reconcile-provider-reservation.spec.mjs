// A launch reconciled to no effect must release its attempt's provider reservation in the same commit
// that returns the job to ready: the slot belongs to the launch, not the job, so a job whose launch
// provably did nothing is dispatchable again. Live incident (op-business.decide-58d0a31e7e attempt 2):
// worker-start ended turn_start_unobserved, `starci kernel reconcile` proved effectState none and
// requeued the job, but the 'unknown' provider_reservations row held its slot and every later dispatch
// was refused at admission (no-eligible-candidate). The reaper covers the receipt a pre-fix runtime
// already left: an 'unknown' receipt releases when its attempt's recorded launches all settled
// no-effect — never one whose effect is still unknown or live.
import test from 'node:test';
import assert from 'node:assert/strict';
import { withLedger, seedWorkflow } from '../helpers/ledger-fixture.mjs';
import { readMachine } from '../../engine/db/machine.mjs';
import reconcileVerb from '../../scripts/kernel/verbs/reconcile.mjs';
import { reapProviderReservations } from '../../scripts/machine/provider-reservation-reap.mjs';
import { jobRowOf } from '../../scripts/kernel/verbs/shared/rows.mjs';

const WF = 'wf-leak', JOB = 'job-leak-1', DISPATCH = 'ctx-leak-1';
const PROVIDER = 'claude', ACCOUNT = 'default', MODEL = 'claude-opus-5-5';

// The reservation lifecycle of a launch whose worker-start answered an uncertain effect:
// reserved -> launching -> unknown, no terminal handle ever bound.
const seedUnknownReservation = (machine, { scopeId, jobId, attemptId, state = 'unknown', provider = PROVIDER }) => {
  const reserved = machine.reserveProvider({ provider, account: ACCOUNT, attemptId,
    role: 'op', model: MODEL, maxParallel: 1, scope: { scopeId, jobId } });
  assert.equal(reserved.ok, true, JSON.stringify(reserved));
  const { id, fence } = reserved.reservation;
  assert.equal(machine.markProviderReservation({ id, fence, attemptId, provider, account: ACCOUNT,
    model: MODEL, role: 'op', state: 'launching', launchIdentity: `launch-${attemptId}`, hostRequestId: `req-${attemptId}` }).ok, true);
  if (state === 'unknown')
    assert.equal(machine.markProviderReservation({ id, fence, attemptId, provider, account: ACCOUNT,
      model: MODEL, role: 'op', state: 'unknown' }).ok, true);
  return machine.providerReservations().find((row) => row.id === id);
};

// The cleanup reconcile saw in the incident: the Dispatch provably ended before model input
// (exact worker exited, release settled) — the managedNoEffectProof of scripts/kernel/cli.mjs.
const CLEANUP_NONE = { effectState: 'none', provenNoEffect: true,
  observation: { ok: true, state: 'failed', result: { observation: { exactWorker: true, status: 'exited' },
    worker: { stage: 'dispatch_input' }, dispatch: { last_failure: 'agent_prompt_stalled' } } },
  stop: { ok: true }, release: { ok: true, state: 'released' } };
const internals = { cleanupManagedWorker: () => CLEANUP_NONE };
const reservation = (machine, id) => machine.providerReservations().find((row) => row.id === id);

test('a dispatch reconciled to no effect releases its attempt provider reservation and the job admits again', (t) => withLedger(t, ({ repoRoot, ledger, machine }) => {
  const scopeId = `${ledger.ledgerId}:${JOB}:attempt:1`;
  seedWorkflow(ledger, { id: WF, jobs: [
    { jobId: JOB, opId: 'code.refactor', kind: 'op', status: 'effect_unknown',
      workerId: DISPATCH, leaseToken: 'tok-leak-1',
      payload: { opId: 'code.refactor', owned_paths: ['docs/'],
        rejectedDispatches: [{ dispatchId: DISPATCH, step: 'worker-start', at: Date.now() - 5000, effectState: 'unknown' }] } }],
    leases: [{ resourceKey: 'path:docs/', jobId: JOB }] });
  const held = seedUnknownReservation(machine, { scopeId, jobId: JOB, attemptId: 'op:leak-1' });
  const admit = () => machine.reserveProvider({ provider: PROVIDER, account: ACCOUNT, attemptId: 'op:leak-2',
    role: 'op', model: MODEL, maxParallel: 1, scope: { scopeId, jobId: JOB } });
  assert.equal(admit().ok, false, 'the held unknown receipt refuses the next admission');

  let out = null;
  reconcileVerb.run({ ledger, args: { job: JOB, json: true }, repo: repoRoot,
    emit: (result) => { out = result; }, internals });

  assert.equal(out?.ok, true, JSON.stringify(out));
  assert.equal(out?.reconciled, true);
  assert.equal(out?.effectState, 'none');
  assert.equal(jobRowOf(ledger.db, JOB).status, 'ready');
  const stored = reservation(machine, held.id);
  assert.equal(stored.state, 'released', 'the reconciled launch releases its provider reservation');
  assert.equal(stored.proof?.kind, 'reconciled-no-effect');
  assert.equal(stored.proof?.dispatchId, DISPATCH);
  assert.equal(stored.proof?.scopeId, scopeId);
  assert.equal(admit().ok, true, 'the same attempt scope admits again once the receipt releases');
}));

test('reconcile releases only the settled launch: a launching receipt and another scope stay held', (t) => withLedger(t, ({ repoRoot, ledger, machine }) => {
  const scopeId = `${ledger.ledgerId}:${JOB}:attempt:1`, OTHER = 'job-leak-other';
  seedWorkflow(ledger, { id: WF, jobs: [
    { jobId: JOB, opId: 'code.refactor', kind: 'op', status: 'effect_unknown',
      workerId: DISPATCH, leaseToken: 'tok-leak-1',
      payload: { opId: 'code.refactor', owned_paths: ['docs/'],
        rejectedDispatches: [{ dispatchId: DISPATCH, step: 'worker-start', at: Date.now() - 5000, effectState: 'unknown' }] } },
    { jobId: OTHER, opId: 'code.refactor', kind: 'op', status: 'ready',
      payload: { opId: 'code.refactor', owned_paths: ['docs/other/'] } }] });
  const settled = seedUnknownReservation(machine, { scopeId, jobId: JOB, attemptId: 'op:leak-settled' });
  const crashed = seedUnknownReservation(machine, { scopeId, jobId: JOB, attemptId: 'op:leak-crashed', state: 'launching', provider: 'claude-crashed' });
  const otherScope = seedUnknownReservation(machine, { scopeId: `${ledger.ledgerId}:${OTHER}:attempt:1`, jobId: OTHER, attemptId: 'op:leak-other', provider: 'claude-other' });

  let out = null;
  reconcileVerb.run({ ledger, args: { job: JOB, json: true }, repo: repoRoot,
    emit: (result) => { out = result; }, internals });

  assert.equal(out?.reconciled, true);
  assert.equal(reservation(machine, settled.id).state, 'released');
  assert.equal(reservation(machine, crashed.id).state, 'launching', 'a receipt whose launch never observed an outcome keeps its slot');
  assert.equal(reservation(machine, otherScope.id).state, 'unknown', 'another attempt scope keeps its slot');
}));

test('the reaper releases an unknown receipt whose recorded launches all settled no-effect, and keeps an unproven one', (t) => withLedger(t, ({ ledger, machine }) => {
  const provenJob = 'job-leak-proven', fencedJob = 'job-leak-fenced';
  const provenScope = `${ledger.ledgerId}:${provenJob}:attempt:1`;
  const fencedScope = `${ledger.ledgerId}:${fencedJob}:attempt:1`;
  seedWorkflow(ledger, { id: WF, jobs: [
    // The post-reconcile shape a pre-fix runtime left: the job is ready again and its one
    // rejected dispatch is recorded effectState 'none', but its 'unknown' receipt still holds.
    { jobId: provenJob, opId: 'code.refactor', kind: 'op', status: 'ready',
      payload: { opId: 'code.refactor', owned_paths: ['docs/proven/'],
        rejectedDispatches: [{ dispatchId: 'ctx-proven', step: 'worker-start', at: Date.now() - 300000,
          effectState: 'none', reconciledAt: Date.now() - 299000 }] } },
    { jobId: fencedJob, opId: 'code.refactor', kind: 'op', status: 'effect_unknown',
      workerId: 'ctx-fenced', leaseToken: 'tok-leak-2',
      payload: { opId: 'code.refactor', owned_paths: ['docs/fenced/'],
        rejectedDispatches: [{ dispatchId: 'ctx-fenced', step: 'worker-start', at: Date.now() - 5000,
          effectState: 'unknown' }] } }] });
  const proven = seedUnknownReservation(machine, { scopeId: provenScope, jobId: provenJob, attemptId: 'op:leak-proven', provider: 'claude-proven' });
  const fenced = seedUnknownReservation(machine, { scopeId: fencedScope, jobId: fencedJob, attemptId: 'op:leak-fenced', provider: 'claude-fenced' });

  const reaped = reapProviderReservations({ env: process.env },
    { status: () => ({ reachable: false }), list: () => ({ ok: true, terminals: [] }), table: () => [], env: () => [] });

  assert.ok(reaped.released.some((row) => row.id === proven.id && row.why === 'no-effect-recorded'),
    `proven no-effect receipt reaped: ${JSON.stringify(reaped)}`);
  assert.equal(reservation(machine, proven.id).state, 'released');
  assert.equal(reservation(machine, proven.id).proof?.kind, 'reconciled-no-effect');
  assert.equal(reservation(machine, fenced.id).state, 'unknown', 'an unsettled launch keeps its slot');
  assert.ok(reaped.kept.some((row) => row.id === fenced.id), `unproven receipt reported kept: ${JSON.stringify(reaped)}`);
}));
