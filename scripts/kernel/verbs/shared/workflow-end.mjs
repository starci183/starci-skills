// api-lib/workflow-end.mjs — the teardown both ways a workflow ends run (`api finish`, `api archive`;
// split out of cli.mjs, lane slim-06): the Kernel seat released, the ledger retained, the Kernel
// terminal closed last. An op's Orca Task is never closed here: it settles with the op's own
// worker_done (or the Dispatch fence settle issues). The worker release helpers stay in cli.mjs
// (the settle and report paths share them) — they arrive through `internals`, the same extension
// surface the verbs get.
import { JOB_STATUSES, clearSignal, recordJobResult, releaseLeases, setJobStatus } from '../../../../engine/db/ledger.mjs';
import { retainLedgerDb } from '../../../housekeeping/hk-ledger.mjs';
import { closeSelfSafe } from '../../../machine/close-verify.mjs';

/**
 * Move a job to `to` along the shortest job_transitions path from its current status (inside the caller's
 * transaction); `fields` ride on the last step. False when the job is already settled or no path leads there.
 */
const walkJobStatus = (db, { jobId, to, reason, at = Date.now(), ...fields }) => {
  const from = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;
  if (!from || JOB_STATUSES.settled.includes(from)) return false;
  const edges = db.prepare('SELECT from_status, to_status FROM job_transitions').all();
  const prev = new Map([[from, null]]), queue = [from];
  while (queue.length && !prev.has(to)) {
    const node = queue.shift();
    for (const e of edges) if (e.from_status === node && !prev.has(e.to_status)) { prev.set(e.to_status, node); queue.push(e.to_status); }
  }
  if (!prev.has(to)) return false;
  const steps = [];
  for (let node = to; node !== from; node = prev.get(node)) steps.unshift(node);
  steps.forEach((step, i) => setJobStatus(db, { jobId, to: step, reason, at, ...(i === steps.length - 1 ? fields : {}) }));
  return true;
};
// Inside the caller's transaction: the singleton signal is deleted and the Kernel job settles as
// `status` with `result`, its terminal binding cleared and `stamp` merged into its payload.
// The Kernel job moves to `status` along the shortest job_transitions path (a running seat reaches succeeded through
// reported); a job already settled, or with no path there, is left as is and counts 0.
export const releaseKernelSeat = (db, workflowId, seat, { status, result, stamp, now }) => {
  const kernelSignalsReleased = clearSignal(db, { scope: 'kernel', key: workflowId }) ? 1 : 0;
  let kernelJobsSettled = 0;
  if (seat.job) {
    const nextPayload = { ...seat.payload, ...stamp };
    if (nextPayload.hierarchy?.runtime) {
      nextPayload.hierarchy = { ...nextPayload.hierarchy, runtime: { ...nextPayload.hierarchy.runtime, terminalHandle: null, releasedAt: now } };
    }
    const jobId = seat.job.job_id;
    releaseLeases(db, { jobId });
    if (walkJobStatus(db, { jobId, to: status, reason: `kernel-seat-${status}`, at: now, payload: nextPayload, workerId: null, leaseToken: null, deadline: null })) {
      recordJobResult(db, { jobId, result, at: now });
      kernelJobsSettled = 1;
    }
  }
  return { kernelSignalsReleased, kernelJobsSettled };
};
// E1 ledger retention: the ending transaction released this kernel's seat, so the ledger is
// retainable when no other workflow in it is still live — retainLedgerDb re-proves that under the
// write lock and no-ops otherwise. Housekeeping never fails the caller.
export const retainAfterEnd = (db, now) => {
  try { return retainLedgerDb(db, { now }); }
  catch (error) { return { retained: false, reason: 'retention-error', error: String(error?.message ?? error) }; }
};
// Called after the durable receipt is emitted, because a Kernel normally closes its own terminal
// this way: the ledger is already authoritative if the host closes the PTY first.
// The close is verified (close-verify.mjs): from another terminal inline; from the Kernel's own terminal a detached
// verifier closes it after this process exits and writes the proof to the Supervisor's machine log (gc.collect). A
// Kernel terminal still open after that is a leftover the Supervisor's tick GC closes and records as a lesson.
export const closeKernelTerminal = (kernelTerminal, { owner = 'kernel' } = {}) => {
  if (!kernelTerminal) return null;
  try { return closeSelfSafe(kernelTerminal, { owner }); } catch { return null; /* the ledger state stands; the tick GC reconciles host cleanup */ }
};
// The worker of a dropped operation: a managed Dispatch is stopped and released, a plain terminal
// quits and closes. A queued job holds no worker.
export const releaseDroppedWorker = (db, job, payload, repo, internals) => {
  if (payload.managed?.dispatchId) return { managedWorker: internals.releaseManagedWorker(db, job, payload, repo) };
  const handle = internals.operationTerminalHandleOf(job, payload);
  return handle ? { terminalClosed: internals.quitWorkerTerminal(handle, payload) } : {};
};
