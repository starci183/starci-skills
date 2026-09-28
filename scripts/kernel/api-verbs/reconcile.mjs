// api reconcile: recover a fenced launch or handle one typed recovery mode.
import path from 'node:path';
import { openMachine, machineFileFor } from '../../../engine/ledger-db.mjs';
import { parseJson } from '../../lib/json.mjs';
import { jobPayloadOf, operationTerminalHandleOf } from '../api-lib/rows.mjs';
import { leaseCanonOf } from '../api-lib/peers.mjs';

export default {
  verb: 'reconcile',
  required: [],
  kernelOnly: true,
  usageInCore: true,
  validate(args, need) {
    need(args.job || args['orphan-kernel-jobs'] || args['orca-tasks'] || args['work-debt'],
      'reconcile needs --job <job_id> (or --orphan-kernel-jobs | --orca-tasks | --work-debt)');
  },
  run({ ledger, args, repo, emit, internals }) {
    const { reconcileOrphanKernelJobs, reconcileOrcaTasks, reconcileWorkDebt, reconcileRetryLineage,
      reconcileDrop, reconcileReap, reconcileReleaseWorker, reconcileDeadWorker, reconcileDebris,
      observeOperationWorker, reserveOpLeases, opLeaseRequests, cleanupManagedWorker } = internals;
  if (args['orphan-kernel-jobs']) return reconcileOrphanKernelJobs(ledger, args);
  if (args['orca-tasks']) return reconcileOrcaTasks(ledger, args);
  if (args['work-debt']) return reconcileWorkDebt(ledger, args, repo);
  const db = ledger.db, jobId = args.job;
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  if (args['retry-lineage']) return reconcileRetryLineage(ledger, args, job);
  if (args.drop) return reconcileDrop(ledger, args, job);
  if (args.reap) return reconcileReap(ledger, args, job);
  if (args['release-worker']) return reconcileReleaseWorker(ledger, args, job, repo);
  if (args['dead-worker']) return reconcileDeadWorker(ledger, args, job, repo);
  if (args.debris) return reconcileDebris(ledger, args, job, repo);
  if (job.status === 'effect_unknown' && parseJson(job.result_json ?? '', {})?.reason === 'dead-worker-fenced') {
    throw Object.assign(new Error(`job ${jobId} was fenced by --dead-worker on effect evidence (${(parseJson(job.result_json, {})?.evidence ?? []).join(', ')}); no host proof can requeue it - inspect the evidence and api settle it fail or blocked, then retry as a new attempt`), { code: 'dead-worker-fenced' });
  }
  const payload = jobPayloadOf(job);
  if (job.status === 'queued') {
    const worker = operationTerminalHandleOf(job) ? observeOperationWorker(job) : null;
    const dispatchId = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? payload.hierarchy?.runtime?.dispatchId ?? null;
    const contract = db.prepare('SELECT dispatch_id FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
      .get(job.workflow_id, job.op_id, job.attempt);
    if (worker?.connected && worker?.writable && contract && (!dispatchId || contract.dispatch_id === dispatchId)) {
      const reserve = reserveOpLeases(ledger, job, payload, { repo });
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
        db.prepare("UPDATE jobs SET status='running',worker_id=?,result_json=?,updated_at=? WHERE job_id=?")
          .run(workerId, JSON.stringify(result), now, jobId);
        ledger.appendEvent({
          workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
          kind: 'live-worker-reconciled', payload: { terminal: worker.terminalHandle, dispatchId: contract.dispatch_id,
            attempt: job.attempt, leaseToken: reserve.leaseToken, fencing: reserve.fencing },
        });
      });
      const out = { ok: true, jobId, reconciled: true, status: 'running', attempt: job.attempt,
        effectState: 'committed', worker, dispatchId: contract.dispatch_id, leasesRecovered: reserve.leases?.length ?? opLeaseRequests(payload, leaseCanonOf(db, repo), job.op_id).length };
      emit(out, `reconciled ${jobId}: reattached live worker ${worker.terminalHandle}; exact leases restored; no duplicate spawned`, args.json);
      return;
    }
    const out = { ok: true, jobId, reconciled: false, alreadyQueued: true, attempt: job.attempt };
    emit(out, `reconcile ${jobId}: already queued (attempt ${job.attempt})`, args.json);
    return;
  }
  if (job.status !== 'effect_unknown') {
    throw Object.assign(new Error(`job ${jobId} is ${job.status}; reconcile requires effect_unknown`), { code: 'job-not-reconcilable' });
  }
  // What reconcile must prove no-effect is the launch that left the job
  // effect_unknown — the newest rejected dispatch that is not already settled
  // (payload.rejectedDispatches, where rejectDispatch records the evidence it
  // used to write over managed.dispatchId). Only when no rejection owns this
  // state is the job's own managed binding the thing to reconcile.
  const unsettledRejection = [...(payload.rejectedDispatches ?? [])].reverse()
    .find((entry) => entry?.dispatchId && entry.effectState && entry.effectState !== 'none')?.dispatchId ?? null;
  const dispatchId = unsettledRejection ?? payload.managed?.dispatchId
    ?? (String(job.worker_id ?? '').startsWith('ctx_') || String(job.worker_id ?? '').startsWith('dispatch-') ? job.worker_id : null);
  if (!dispatchId) throw Object.assign(new Error(`job ${jobId} has no managed dispatch identity`), { code: 'dispatch-identity-missing' });

  // An accepted contract or worker report is evidence that the operation may
  // have begun.  Never turn that evidence back into a reusable launch slot.
  const contract = db.prepare('SELECT dispatch_id FROM contracts WHERE workflow_id=? AND op_id=? AND attempt=?')
    .get(job.workflow_id, job.op_id, job.attempt);
  const report = db.prepare('SELECT dispatch_id,outcome FROM reports WHERE workflow_id=? AND dispatch_id=?')
    .get(job.workflow_id, dispatchId);
  if (contract || report) {
    const out = { ok: false, jobId, reconciled: false, dispatchId, effectState: 'unknown',
      reason: contract ? 'accepted-contract-exists' : 'worker-report-exists', contract: contract ?? null, report: report ?? null };
    emit(out, `reconcile REFUSED for ${jobId}: ${out.reason}; exact-path lease retained`, args.json);
    process.exit(1);
  }

  const cleanup = cleanupManagedWorker(dispatchId);
  if (cleanup.effectState !== 'none') {
    const out = { ok: false, jobId, reconciled: false, dispatchId, effectState: cleanup.effectState, cleanup };
    emit(out, `reconcile WAIT for ${jobId}: effect=${cleanup.effectState}; exact-path lease retained`, args.json);
    process.exit(1);
  }

  let machineRefs = [], leasesReleased = 0;
  ledger.transaction(() => {
    const now = Date.now();
    machineRefs = db.prepare('SELECT machine_ref FROM leases WHERE job_id=? AND machine_ref IS NOT NULL')
      .all(jobId).map((r) => r.machine_ref);
    leasesReleased = db.prepare('DELETE FROM leases WHERE job_id=?').run(jobId).changes;
    const nextPayload = jobPayloadOf(job);
    delete nextPayload.managed;
    // The rejection is settled now: keep it as evidence, but stop it naming
    // the state a later reconcile would have to prove again.
    if (Array.isArray(nextPayload.rejectedDispatches)) {
      nextPayload.rejectedDispatches = nextPayload.rejectedDispatches.map((entry) =>
        entry?.dispatchId === dispatchId ? { ...entry, effectState: 'none', reconciledAt: now } : entry);
    }
    if (nextPayload.hierarchy?.runtime) {
      const { taskId, dispatchId: ignoredDispatch, terminalHandle, ...runtime } = nextPayload.hierarchy.runtime;
      nextPayload.hierarchy.runtime = runtime;
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
    db.prepare("UPDATE jobs SET status='queued',worker_id=NULL,payload_json=?,result_json=?,lease_token=NULL,deadline=NULL,updated_at=? WHERE job_id=?")
      .run(JSON.stringify(nextPayload), JSON.stringify(result), now, jobId);
    ledger.appendEvent({
      workflowId: job.workflow_id, entityType: 'job', entityId: jobId,
      kind: 'dispatch-reconciled', payload: { dispatchId, effectState: 'none', attempt: job.attempt,
        attemptConsumed: false, leasesReleased, machineRefs, proof: result.proof },
    });
  });

  let machineRefsReleased = 0;
  if (machineRefs.length) {
    try {
      const machine = openMachine({ file: machineFileFor() });
      try { machineRefsReleased = machine.release(machineRefs).released; } finally { machine.close(); }
    } catch { /* ledger proof stands; machine TTLs expire independently */ }
  }
  const out = { ok: true, jobId, reconciled: true, dispatchId, status: 'queued', attempt: job.attempt,
    effectState: 'none', attemptConsumed: false, leasesReleased, machineRefsReleased, cleanup };
  emit(out, `reconciled ${jobId}: ${dispatchId} proved no-effect; same attempt ${job.attempt} queued (leases released: ${leasesReleased})`, args.json);

  },
};
