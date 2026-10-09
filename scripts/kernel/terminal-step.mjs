// terminal-step.mjs — what a job that sat down terminal still owes: the pure half of the `failed-no-step` and
// `owner-wait-no-ask` holds of modules/kernel/op-incident-policy.yaml.
//
// A failed or blocked job with no retry, no recorded next step, no Decision Item and no incident after it is a leg
// nobody owns. Status projects it as a `retry` action (scripts/kernel/graph-projection.mjs) and the Job controller
// takes the step itself (scripts/reconciler/controllers/job.mjs -> `starci kernel reconcile --route-failure`).
// Nothing here writes: upstreamPlanOf reads the ledger and says which step applies.
import { effectiveBlockerKind } from './critic-hold.mjs';
import { jobResult, JOB_STATUSES } from '../../engine/db/ledger.mjs';
import { readModuleJson } from '../../engine/runtime-root.mjs';
import { parseJson } from '../lib/json.mjs';
import { JOB_ROW } from '../machine/job-row.mjs';
import { unresolvedFailures } from './failure-steps.mjs';
import { retryAttemptOf } from './gate-conditions.mjs';
import { boundValue, incidentPolicy } from './op-incident-policy.mjs';

const FINAL_SETTLED = new Set(JOB_STATUSES.settled);

/** The hold ids the policy table lists for these two states. */
export const TERMINAL_HOLDS = Object.freeze({ failedNoStep: 'failed-no-step', ownerWaitNoAsk: 'owner-wait-no-ask' });

/** The failed rows nothing follows and whose settle recorded no next step at all. */
export const unsteppedFailures = (db, failedRows, workflowJobs) => unresolvedFailures(db, failedRows, workflowJobs)
  .filter((row) => !jobResult(db, row.job_id)?.nextStep);

/** The owner waits that name no ask dispatch: the owner has nothing to answer. */
export const ownerWaitsWithoutAsk = (awaitingOwner) => awaitingOwner.filter((item) => !item.dispatchId);

/** Whether one awaiting_owner job has neither an ask the owner can answer nor a retry that took its place. */
function ownerWaitIsAskless(db, row) {
  if (row.status !== 'awaiting_owner' || retryAttemptOf(db, row)) return false;
  const asked = jobResult(db, row.job_id)?.askDispatchId
    ?? db.prepare("SELECT dispatch_id FROM reports WHERE job_id=? AND outcome='ask' LIMIT 1").get(row.job_id)?.dispatch_id;
  return !asked;
}

/** The op that cures a gap blocker, read from the route table (`on.blocker`, `from: any`, reopening a repair kind), or null. */
export function gapUpstreamOf(blockerKind, catalog = readModuleJson('modules', 'models', 'kinds.yaml')) {
  const route = (catalog.routes ?? []).find((item) => item.on?.blocker === blockerKind && item.from === 'any'
    && item.then === 'reopen' && item.to?.kind && item.to.kind !== 'same');
  return route ? catalog.kinds?.[route.to.kind]?.operator ?? route.to.kind : null;
}

const latestJobOf = (db, workflowId, op, exceptJobId) => db.prepare(
  "SELECT job_id, status, updated_at FROM jobs WHERE workflow_id=? AND op_id=? AND job_id<>? AND kind='op' AND status<>'cancelled' ORDER BY created_at DESC, try_no DESC LIMIT 1")
  .get(workflowId, op, exceptJobId) ?? null;

const dispatchedAtOf = (db, jobId) => Number(db.prepare('SELECT max(dispatched_at) at FROM op_attempts WHERE job_id=?').get(jobId)?.at) || 0;
const settledAtOf = (db, jobId) => Number(db.prepare('SELECT max(settled_at) at FROM op_attempts WHERE job_id=?').get(jobId)?.at) || 0;

/**
 * Whether the leg that cures a blocker is still ahead of the blocked job, from the ledger:
 *   {action: 'wait', on}                       the cure has no job yet, or its own try failed: the plan proposes it
 *   {action: 'retry', after, mode}             the cure is in flight, or landed after the blocked attempt was dispatched:
 *                                              the blocked op runs again behind it, no try of the cure's route spent
 *   null                                       the cure ran before the attempt read its records: a real gap, the route table applies
 */
export function upstreamPlanOf(db, job, blockerKind, catalog) {
  const up = gapUpstreamOf(blockerKind, catalog);
  if (!up || up === job.op_id) return null;
  const latest = latestJobOf(db, job.workflow_id, up, job.job_id);
  if (!latest) return { action: 'wait', on: up, why: 'no-job' };
  if (latest.status === 'failed' || latest.status === 'awaiting_owner') return { action: 'wait', on: up, why: 'upstream-unfinished' };
  if (!FINAL_SETTLED.has(latest.status)) return { action: 'retry', after: latest.job_id, on: up, mode: 'in-flight' };
  return settledAtOf(db, latest.job_id) > dispatchedAtOf(db, job.job_id) ? { action: 'retry', after: latest.job_id, on: up, mode: 'landed' } : null;
}

/** The report a failed job's newest attempt filed: {outcome, blocker, envelope} or null when none was filed. */
export function filedReportOf(db, jobId) {
  const row = db.prepare('SELECT r.outcome, r.report_json FROM reports r JOIN op_attempts a ON a.attempt_id=r.attempt_id WHERE a.job_id=? ORDER BY a.attempt_id DESC LIMIT 1').get(jobId);
  if (!row) return null;
  const envelope = parseJson(row.report_json, {}) ?? {};
  return { outcome: row.outcome, blocker: row.outcome === 'blocked' ? effectiveBlockerKind(envelope) : null, envelope };
}

const LIVE_DECISION = ['open', 'claimed', 'escalated'];

/**
 * What a job owes the terminal holds, read from the ledger: {hold, jobId, op, since, taken} or null when it owes none
 * (not failed or waiting, its workflow not running, nothing unresolved). `taken` is true when an open Decision Item or
 * incident already names the job - that handler owns it.
 */
export function terminalFactsOf(db, jobId) {
  const row = db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=? AND kind='op'`).get(jobId);
  const wf = row ? db.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(row.workflow_id) : null;
  if (!wf || wf.phase !== 'running' || wf.archived_at || !['failed', 'awaiting_owner'].includes(row.status)) return null;
  let hold = null;
  if (row.status === 'awaiting_owner' && ownerWaitIsAskless(db, row)) hold = TERMINAL_HOLDS.ownerWaitNoAsk;
  if (row.status === 'failed' && unsteppedFailures(db, [row], db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind='op'`).all(row.workflow_id)).length) hold = TERMINAL_HOLDS.failedNoStep;
  if (!hold) return null;
  const named = (table) => db.prepare(`SELECT 1 FROM ${table} WHERE job_id=? AND status IN (${LIVE_DECISION.map(() => '?').join(',')}) LIMIT 1`).get(jobId, ...LIVE_DECISION) != null;
  const incident = db.prepare("SELECT 1 FROM incidents WHERE job_id=? AND status='open' LIMIT 1").get(jobId) != null;
  return { hold, jobId, op: row.op_id, since: Number(row.updated_at), taken: named('decision_items') || incident };
}

/** The table's view of one terminal hold: its handler, the chain to the owner and the bound after which the step escalates. */
export function holdView(id) {
  const hold = incidentPolicy().holds.find((item) => item.id === id);
  return { hold: id, handler: hold.handler, chain: hold.chain, deadlineMs: boundValue(hold.bound.deadlineMs) };
}
