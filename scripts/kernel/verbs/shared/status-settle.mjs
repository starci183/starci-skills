// The settle frontier of `starci kernel status` (verbs/status.mjs): consumed reports whose jobs are still
// open, split into the settles the Kernel owes now and the ones a recorded wait holds.
import { PEER_WAIT } from './peer-waits.mjs';
import { parkedBehindWaits, waitHeldOperations } from '../../frontier-parked.mjs';

// A filed report moves its job to reported (starci kernel report); a job still running/answering has a
// report filed on it by settle's fallback.
const settleOwedOf = (db, reports) => [...new Set(reports
  .filter((report) => report.consumed_at && report.job_id)
  .filter((report) => {
    const row = db.prepare('SELECT status FROM jobs WHERE job_id=?').get(report.job_id);
    return row && ['running', 'answering', 'reported'].includes(row.status);
  })
  .map((report) => report.job_id))];

const gateHold = (jobId, row, gate) => ({
  jobId, opId: row.op_id ?? null, attempt: row.attempt, heldBecause: 'owner-gate', blockedBy: { incident: gate.incidentId },
  detail: `owner-gate incident ${gate.incidentId} holds its settle; the Kernel resolves it (starci kernel incident --resolve) once the owner's step lands, then checks and settles`,
});

const waitHold = (jobId, row, wait) => {
  const resolution = wait.untilMessage ? ' and resolves the wait' : ', which resolves it (starci kernel incident --resolve) once the proof holds';
  return {
    jobId, opId: row.op_id ?? null, attempt: row.attempt, heldBecause: PEER_WAIT, blockedBy: { incident: wait.incidentId, peer: wait.peer },
    detail: `peer-wait incident ${wait.incidentId} holds its settle until peer ${wait.peer} lands what it waits on (${wait.detail.slice(0, 160)}); a peer message from ${wait.peer} wakes the Kernel${resolution}, then checks and settles`,
  };
};

// A held settle's worker has nothing left to do: its report is consumed and only the wait holds the
// job. Its terminal and path lease go back now (reconcile --release-worker; the watchdog runs it under
// --repair), the job stays unsettled for the settle the wait releases (a product's op-integration.verify-
// 25532858e7 sat leased with its terminal open through the whole peer-wait inc-8cce1cf1b330).
const heldWorkerState = (workers, item) => {
  const worker = workers.find((w) => w.jobId === item.jobId) ?? null;
  let state = 'none';
  if (worker?.terminalHandle) state = 'held';
  if (worker?.liveness === 'released') state = 'released';
  item.worker = state;
  if (worker?.terminalHandle) item.terminalHandle = worker.terminalHandle;
};

export const settlePhase = (s) => {
  const { db, internals } = s;
  const { ownerGateOf } = internals;
  s.unconsumedReports = s.reports.filter((report) => !report.consumed_at).length;
  // A consumed report whose job is still open is a verdict the Kernel owes:
  // it read the report and yielded before check/settle (a WSPV kernel sat
  // idle on one, and nothing woke it because the frontier read engaged).
  s.settleOwed = settleOwedOf(db, s.reports);
  // A settle the Kernel deliberately defers behind a recorded wait is not work it can do: an open
  // owner-gate or peer-wait whose --holds (else --op) names the job holds its settle the way it
  // holds a queued job (wf-<product>-app-auth-mudqjob3: op-backend.implement-86ff31372a's cut-closing
  // settle waited on wf-<product>-workspace-provision-mudqjokb's commit under peer-wait inc-9f2e1e7ff1f6,
  // while status read settle-ready ACTIONABLE and the watchdog re-woke the Kernel every tick for
  // nothing). Resolving the wait (starci kernel incident --resolve, or the peer's message for --until-message)
  // makes it settle-ready again, which is actionable and wakes the Kernel.
  s.settleReady = [];
  s.heldSettle = [];
  for (const jobId of s.settleOwed) {
    const row = s.workflowJobs.find((job) => job.job_id === jobId) ?? null;
    const gate = row ? ownerGateOf(s.ownerGates, row) : null;
    const wait = row && !gate ? ownerGateOf(s.peerWaits, row) : null;
    if (gate) s.heldSettle.push(gateHold(jobId, row, gate));
    else if (wait) s.heldSettle.push(waitHold(jobId, row, wait));
    else s.settleReady.push(jobId);
  }
  for (const item of s.heldSettle) heldWorkerState(s.workers, item);
  s.heldWorkers = s.heldSettle.filter((item) => item.worker === 'held').map((item) => item.jobId);
  // A queued dependant whose chain ends in a job a recorded wait holds (queued, or its settle deferred) is
  // parked behind that wait, not engaged work (scripts/kernel/frontier-parked.mjs): it keeps
  // queuedBecause dependency and names the wait in parkedBehind.
  s.parkedBehind = parkedBehindWaits(s.queued, s.heldSettle);
  for (const item of s.queued) {
    const root = s.parkedBehind.get(item.jobId);
    if (!root) continue;
    item.parkedBehind = root;
    const deferred = root.settle ? ' (its settle is deferred)' : '';
    item.detail = `${item.detail ?? ''}; parked behind ${root.heldBecause} ${root.incident} through ${root.via}${deferred}`;
  }
  s.waitHeld = waitHeldOperations(s.queued, s.heldSettle, s.parkedBehind);
  s.parkedDependants = s.queued.filter((item) => item.parkedBehind && (item.parkedBehind.settle || item.parkedBehind.heldBecause === PEER_WAIT));
};
