// failure-steps.mjs — which failed attempts the frontier still owes a step (the job's settle result nextStep, recorded by
// cli.mjs enqueueNextStep on a failed settle). starci kernel status reads unresolvedFailures for nextActions and leg colours.
import { AWAITING_OWNER_STATUS, sameUnit } from '../../engine/admission.mjs';
import { parseJson } from '../lib/json.mjs';
import { retryAttemptOf } from './gate-conditions.mjs';

const payloadOf = (row) => parseJson(row?.payload_json ?? '', {}) ?? {};
const resultOf = (row) => parseJson(row?.result_json ?? '', {}) ?? {};

/**
 * A settled attempt that asked the owner a question is a wait, not a failure: settle ends it with jobs.status
 * `awaiting_owner` (and result.verdict `awaiting-owner`). Nothing else is one.
 */
export const isAwaitingOwner = (db, row) => row?.status === AWAITING_OWNER_STATUS;

/** Two jobs are tries of one work unit (scripts/kernel/units.mjs). */
const sameUnitOfWork = sameUnit;

/**
 * The failed jobs nothing follows: no retry names them, the step their settle recorded enqueued nothing, and no
 * later attempt of the same unit of work succeeded. An owner wait or a peer-blocked attempt is not one.
 */
export function unresolvedFailures(db, failedRows, workflowJobs) {
  return failedRows.filter((row) => {
    const result = resultOf(row), step = result.nextStep;
    if (isAwaitingOwner(db, row) || result.peerBlocked || retryAttemptOf(db, row)) return false;
    if (step?.jobs?.length) return false;
    return !workflowJobs.some((other) => other.op_id === row.op_id && sameUnitOfWork(other, row) && Number(other.try_no) > Number(row.try_no) && other.status === 'succeeded');
  });
}
