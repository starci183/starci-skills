// failure-steps.mjs — which failed attempts the frontier still owes a step (jobs.result_json.nextStep, recorded by
// api.mjs enqueueNextStep on a failed settle). api status reads unresolvedFailures for nextActions and leg colours;
// scripts/work/migrate-runtime.mjs reads stepOwedFailures: failed settles from before the router.
import { AWAITING_OWNER, sameUnit } from '../../engine/admission.mjs';
import { parseJson } from '../lib/json.mjs';
import { retryAttemptOf } from './gate-conditions.mjs';

const payloadOf = (row) => parseJson(row?.payload_json ?? '', {}) ?? {};
const resultOf = (row) => parseJson(row?.result_json ?? '', {}) ?? {};

/**
 * A settled attempt that asked the owner a question is a wait, not a failure. Settle records it as
 * result.verdict `awaiting-owner`; an attempt a kernel settled `blocked` on a filed `ask` report
 * before that verdict existed reads the same, so its successor is accounted identically.
 */
export const isAwaitingOwner = (db, row) => {
  const result = resultOf(row);
  if (result.verdict === AWAITING_OWNER) return true;
  if (row?.status !== 'failed' || result.verdict !== 'blocked' || !row.op_id) return false;
  return Boolean(db.prepare("SELECT 1 FROM reports WHERE workflow_id=? AND op_id=? AND attempt=? AND outcome='ask' LIMIT 1")
    .get(row.workflow_id, row.op_id, row.attempt));
};

/** Two jobs are tries of one work unit (scripts/kernel/units.mjs). */
export const sameUnitOfWork = sameUnit;

/**
 * The failed jobs nothing follows: no retry names them, the step their settle recorded enqueued nothing, and no
 * later attempt of the same unit of work succeeded. An owner wait or a peer-blocked attempt is not one.
 */
export function unresolvedFailures(db, failedRows, workflowJobs) {
  return failedRows.filter((row) => {
    const result = resultOf(row), step = result.nextStep;
    if (isAwaitingOwner(db, row) || result.peerBlocked || retryAttemptOf(db, row)) return false;
    if (step?.jobs?.length) return false;
    return !workflowJobs.some((other) => other.op_id === row.op_id && other.attempt > row.attempt && other.status === 'succeeded' && sameUnitOfWork(other, row));
  });
}

/**
 * Failed settles of `workflowId` that predate the router: verdict fail, no recorded step, still unresolved. Each is
 * {job, supersededBy}: supersededBy names the newest later attempt of the same op on the same work (its paths or
 * records, whatever cut it ran under) that did not end cancelled - the Kernel already re-ran that work - else null:
 * nothing names it in nextActions and its leg reads red.
 */
export function stepOwedFailures(db, workflowId) {
  const jobs = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind<>'kernel' ORDER BY created_at,job_id").all(workflowId);
  const failed = jobs.filter((row) => row.status === 'failed');
  return unresolvedFailures(db, failed, jobs)
    .filter((row) => resultOf(row).verdict === 'fail' && !resultOf(row).nextStep)
    .map((job) => {
      const later = jobs.filter((other) => other.op_id === job.op_id && other.attempt > job.attempt && other.status !== 'cancelled' && sameUnit(other, job));
      return { job, supersededBy: later.at(-1)?.job_id ?? null };
    });
}
