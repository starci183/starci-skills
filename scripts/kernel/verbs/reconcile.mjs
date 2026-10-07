// starci kernel reconcile: recover a fenced launch or handle one typed recovery mode.
import { recordWhy } from '../why-record.mjs';
import { recordJobResult, releaseLeases, setJobStatus, updateAttempt } from '../../../engine/db/ledger.mjs';
import { readMachine, withMachine } from '../../../engine/db/machine.mjs';
import { parseJson } from '../../lib/json.mjs';
import { jobPayloadOf, jobRowOf, operationTerminalHandleOf } from './shared/rows.mjs';
import { latestAttemptOf } from '../../machine/job-row.mjs';
import { latestContractOf } from '../../machine/contract-version.mjs';
import { leaseCanonOf } from './shared/peer-waits.mjs';
import { VerbExit } from './shared/verb-exit.mjs';

// A requeued job waits queued or ready (running -> ready after a dead worker, H13).
function reconcileHeldJob({ ledger, job, jobId, payload, repo, internals, emit, args }) {
  const db = ledger.db;
  const worker = operationTerminalHandleOf(job) ? internals.observeOperationWorker(job) : null;
  const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId ?? null;
  const contract = latestContractOf(db, jobId);
  if (worker?.connected && worker?.writable && contract && (!dispatchId || contract.dispatch_id === dispatchId)) {
    const reserve = internals.reserveOpLeases(ledger, job, payload, { repo });
    if (!reserve?.ok) {
      throw Object.assign(new Error(`live worker ${worker.terminalHandle} cannot recover its exact lease: ${(reserve?.reasons ?? [reserve?.reason]).filter(Boolean).join('; ') || 'reservation refused'}`), {
        code: 'live-worker-lease-conflict', worker, reserve,
      });
    }
    const workerId = payload.managed?.dispatchId ?? worker.terminalHandle;
    ledger.transaction(() => {
      const now = Date.now();
      const result = { reason: 'live-worker-reconciled', effectState: 'committed', attemptConsumed: false,
        worker: worker.terminalHandle, dispatchId: contract.dispatch_id, leaseToken: reserve.leaseToken, at: now };
      // reserveOpLeases moved the job to leased with its fencing token; the live worker takes it on.
      setJobStatus(db, { jobId, to: 'running', reason: 'live-worker-reconciled', expect: 'leased', workerId, at: now });
      recordJobResult(db, { jobId, result, at: now });
      ledger.appendEvent({
        workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
        kind: 'live-worker-reconciled', payload: { terminal: worker.terminalHandle, dispatchId: contract.dispatch_id,
          attempt: job.attempt, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
      });
    });
    const out = { ok: true, jobId, reconciled: true, status: 'running', attempt: job.attempt,
      effectState: 'committed', worker, dispatchId: contract.dispatch_id, leasesRecovered: reserve.leases?.length ?? internals.opLeaseRequests(payload, leaseCanonOf(db, repo), job.op_id).length };
    emit(out, `reconciled ${jobId}: reattached live worker ${worker.terminalHandle}; exact leases restored; no duplicate spawned`, args.json);
    return;
  }
  const out = { ok: true, jobId, reconciled: false, alreadyQueued: true, attempt: job.attempt };
  emit(out, `reconcile ${jobId}: already queued (attempt ${job.attempt})`, args.json);
}

// What reconcile must prove no-effect is the launch that left the job
// effect_unknown — the newest rejected dispatch that is not already settled
// (payload.rejectedDispatches, where rejectDispatch records the evidence,
// never over managed.dispatchId). Only when no rejection owns this
// state is the job's own managed binding the thing to reconcile.
function dispatchIdentityOf(payload, job) {
  const unsettled = [...(payload.rejectedDispatches ?? [])].reverse()
    .find((entry) => entry?.dispatchId && entry.effectState && entry.effectState !== 'none')?.dispatchId ?? null;
  return unsettled ?? payload.managed?.dispatchId
    ?? (String(job.worker_id ?? '').startsWith('ctx_') || String(job.worker_id ?? '').startsWith('dispatch-') ? job.worker_id : null);
}

// The launch's provider receipts release with its leases, inside the same transaction that returns the
// job to ready: every 'unknown' or 'reserved' receipt of this attempt scope belongs to a rejected
// dispatch of the same try, and reconcile only reaches this point after proving the one unsettled
// rejection had no effect (earlier rejections of the try were already settled 'none'). A 'reserved'
// receipt never crossed worker-start; 'launching' and 'live' receipts are another launch's custody and
// stay held. A refused release aborts the reconcile — the job keeps its fence rather than leak the slot.
function releaseAttemptReservations(ledger, job, { jobId, dispatchId }) {
  const scopeId = `${ledger.ledgerId ?? ledger.path}:${jobId}:attempt:${job.attempt ?? job.try_no ?? 0}`;
  const held = readMachine((m) => m.providerReservations({ activeOnly: true }), [])
    .filter((row) => row.scope?.scopeId === scopeId && (row.state === 'reserved' || row.state === 'unknown'));
  if (!held.length) return [];
  const released = [];
  withMachine((m) => {
    for (const row of held) {
      const proof = row.state === 'reserved'
        ? { kind: 'failed-before-launch', confirmed: true, source: 'kernel-reconcile', dispatchId, scopeId }
        : { kind: 'reconciled-no-effect', confirmed: true, source: 'kernel-reconcile', dispatchId, scopeId, effectState: 'none' };
      const result = m.releaseProviderReservation({ ...row, proof });
      if (!result.ok) throw Object.assign(new Error(`reconcile ${jobId}: provider reservation ${row.id} (${row.state}) refused the no-effect release: ${result.reason}`),
        { code: 'provider-reservation-held', result });
      if (!result.reused) released.push({ id: row.id, attemptId: row.attemptId, state: row.state });
    }
  });
  return released;
}

export default {
  verb: 'reconcile',
  required: [],
  kernelOnly: true,
  usageInCore: true,
  validate(args, need) {
    need(args.job || args['orphan-kernel-jobs'],
      'reconcile needs --job <job_id> (or --orphan-kernel-jobs)');
  },
  run({ ledger, args, repo, emit, internals }) {
    const { reconcileOrphanKernelJobs,
      reconcileDrop, reconcileReap, reconcileReleaseWorker, reconcileDeadWorker,
      cleanupManagedWorker } = internals;
  if (args['orphan-kernel-jobs']) return reconcileOrphanKernelJobs(ledger, args);
  const db = ledger.db, jobId = args.job;
  const job = jobRowOf(db, jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (args.drop) return reconcileDrop(ledger, args, job);
  if (args.reap) return reconcileReap(ledger, args, job);
  if (args['release-worker']) return reconcileReleaseWorker(ledger, args, job, repo);
  if (args['dead-worker']) return reconcileDeadWorker(ledger, args, job, repo);
  if (job.status === 'effect_unknown' && parseJson(job.result_json ?? '', {})?.reason === 'dead-worker-fenced') {
    throw Object.assign(new Error(`job ${jobId} was fenced by --dead-worker on effect evidence (${(parseJson(job.result_json, {})?.evidence ?? []).join(', ')}); no host proof can requeue it - inspect the evidence and starci kernel settle it fail or blocked, then retry as a new attempt`), { code: 'dead-worker-fenced' });
  }
  const payload = jobPayloadOf(job);
  if (job.status === 'queued' || job.status === 'ready') {
    reconcileHeldJob({ ledger, job, jobId, payload, repo, internals, emit, args });
    return;
  }
  if (job.status !== 'effect_unknown') {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; reconcile requires effect_unknown`), { code: 'job-not-reconcilable' });
  }
  const dispatchId = dispatchIdentityOf(payload, job);
  if (!dispatchId) throw Object.assign(new Error(`job ${jobId} has no managed dispatch identity`), { code: 'dispatch-identity-missing' });

  // An accepted contract or worker report is evidence that the operation may
  // have begun.  Never turn that evidence back into a reusable launch slot.
  // The launch that left the job effect_unknown is its newest attempt.
  const contract = latestContractOf(db, jobId);
  const report = db.prepare('SELECT dispatch_id,outcome FROM reports WHERE workflow_id=? AND dispatch_id=?')
    .get(job.workflow_id, dispatchId);
  if (contract || report) {
    const out = { ok: false, jobId, reconciled: false, dispatchId, effectState: 'unknown',
      reason: contract ? 'accepted-contract-exists' : 'worker-report-exists', contract: contract ?? null, report: report ?? null };
    emit(out, `reconcile REFUSED for ${jobId}: ${out.reason}; exact-path lease retained`, args.json);
    throw new VerbExit(1);
  }

  const cleanup = cleanupManagedWorker(dispatchId);
  if (cleanup.effectState !== 'none') {
    const out = { ok: false, jobId, reconciled: false, dispatchId, effectState: cleanup.effectState, cleanup };
    emit(out, `reconcile WAIT for ${jobId}: effect=${cleanup.effectState}; exact-path lease retained`, args.json);
    throw new VerbExit(1);
  }

  let leasesReleased = 0, reservationsReleased = [];
  ledger.transaction(() => {
    const now = Date.now();
    leasesReleased = releaseLeases(db, { jobId });
    reservationsReleased = releaseAttemptReservations(ledger, job, { jobId, dispatchId });
    const nextPayload = jobPayloadOf(job);
    delete nextPayload.managed;
    // The rejection is settled now: keep it as evidence, but stop it naming
    // the state a later reconcile would have to prove again.
    if (Array.isArray(nextPayload.rejectedDispatches)) {
      nextPayload.rejectedDispatches = nextPayload.rejectedDispatches.map((entry) =>
        entry?.dispatchId === dispatchId ? { ...entry, effectState: 'none', reconciledAt: now } : entry);
    }
    if (nextPayload.hierarchy?.runtime) {
      nextPayload.hierarchy.runtime = Object.fromEntries(Object.entries(nextPayload.hierarchy.runtime)
        .filter(([key]) => key !== 'taskId' && key !== 'dispatchId' && key !== 'terminalHandle'));
    }
    const result = {
      reason: 'dispatch-reconciled', dispatchId, effectState: 'none',
      attemptConsumed: false, retryable: true, proof: {
        exactWorker: cleanup.observation?.result?.observation?.exactWorker === true,
        workerState: cleanup.observation?.state ?? null,
        workerStage: cleanup.observation?.result?.worker?.stage ?? cleanup.observation?.result?.stage ?? null,
        lastFailure: cleanup.observation?.result?.dispatch?.last_failure ?? cleanup.observation?.dispatch?.last_failure ?? null,
        releaseState: cleanup.release?.state ?? null,
        releaseReason: cleanup.release?.result?.reason ?? null,
      }, at: now,
    };
    // effect_unknown -> ready (job_transitions): the same try is dispatchable again. The proven-no-effect launch's
    // attempt ends requeued, so the next dispatch opens a new attempt of the same job.
    const attempt = latestAttemptOf(db, jobId);
    recordJobResult(db, { jobId, result, at: now });
    if (attempt && attempt.end_state == null && attempt.settled_at == null) updateAttempt(db, { attemptId: attempt.attempt_id, endState: 'requeued', effectState: 'none', settledBy: 'reconcile', at: now });
    if (attempt) recordWhy(db, attempt.attempt_id, { at: now });
    setJobStatus(db, { jobId, to: 'ready', reason: 'dispatch-reconciled', expect: 'effect_unknown', workerId: null, leaseToken: null, deadline: null, payload: nextPayload, at: now });
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'dispatch-reconciled', payload: { dispatchId, effectState: 'none', attempt: job.attempt,
        attemptConsumed: false, leasesReleased, reservationsReleased, proof: result.proof },
    });
  });

  const out = { ok: true, jobId, reconciled: true, dispatchId, status: 'ready', attempt: job.attempt,
    effectState: 'none', attemptConsumed: false, leasesReleased, reservationsReleased, cleanup };
  emit(out, `reconciled ${jobId}: ${dispatchId} proved no-effect; same try ${job.attempt} ready (leases released: ${leasesReleased}, provider receipts released: ${reservationsReleased.length})`, args.json);

  },
};
