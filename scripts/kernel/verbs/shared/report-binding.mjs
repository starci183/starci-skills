// Durable worker report binding and identity for one dispatched job (alpha.3 runtime schema).
//
// The binding is the job's OPEN attempt: the op_attempts row of its latest dispatch that has no end state and is
// not settled. Its dispatch_id is the report's identity, and it must carry a contracts row (api dispatch writes the
// contract, keyed by attempt_id, before the job goes running). A redispatch after a dead worker is a new attempt
// (dispatch_seq + 1) with its own contract, so an old dispatch can never file into the new one.
import { jobRowOf } from './rows.mjs';
import { latestAttemptOf } from '../../../machine/job-row.mjs';

/** The jobs row through JOB_ROW (`attempt` = try_no, `result_json` = the settle result), or a typed refusal. */
export const resolveJob = (db, jobId) => {
  const job = jobRowOf(db, jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  return job;
};
// 'reported' stays reportable: the same report filed again replays the stored result (H10), and settle verifies it.
export const REPORTABLE_JOB_STATUSES = new Set(['running', 'answering', 'effect_unknown', 'reported']);

/** The job's open attempt (no end state, not settled), or null. */
const openAttemptOf = (db, job) => db.prepare(`SELECT * FROM op_attempts WHERE job_id=? AND end_state IS NULL AND settled_at IS NULL
  ORDER BY dispatch_seq DESC LIMIT 1`).get(job.job_id) ?? null;

/** The dispatch id a report of this job carries: its open attempt's, else its latest attempt's, else null. */
export const reportDispatchIdOf = (db, job) => (openAttemptOf(db, job) ?? latestAttemptOf(db, job, { order: 'dispatch_seq' }))?.dispatch_id ?? null;

/** The open attempt a report of `job` files into; refused unless the job is live and the attempt has its contract. */
export const requireReportAttempt = (db, job) => {
  if (!REPORTABLE_JOB_STATUSES.has(job.status)) {
    throw Object.assign(new Error(`job ${job.job_id} cannot file or verify a worker report while ${job.status}`), {
      code: 'report-job-not-active', status: job.status,
    });
  }
  const attempt = openAttemptOf(db, job);
  if (!attempt) throw Object.assign(new Error(`job ${job.job_id} has no open dispatched attempt`), { code: 'report-dispatch-unbound' });
  if (!db.prepare('SELECT 1 FROM contracts WHERE attempt_id=?').get(attempt.attempt_id)) {
    throw Object.assign(new Error(`job ${job.job_id} has no contract bound to dispatch ${attempt.dispatch_id}`), {
      code: 'report-contract-unbound', dispatchId: attempt.dispatch_id,
    });
  }
  return attempt;
};
/** requireReportAttempt's dispatch id (the verbs that only need the identity). */
export const requireDispatchedReportBinding = (db, job) => requireReportAttempt(db, job).dispatch_id;
export const parseAttempt = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw Object.assign(new Error(`--attempt must be a positive integer, got '${v}'`), { code: 'bad-attempt' });
  return n;
};

/** The identity fields a report must match (report-envelope.mjs validateOpReport): the open attempt's. */
export const reportIdentityOf = (db, job) => {
  const attempt = openAttemptOf(db, job) ?? latestAttemptOf(db, job, { order: 'dispatch_seq' });
  return { run: attempt?.run_id ?? null, task: attempt?.task_id ?? null, dispatch: attempt?.dispatch_id ?? null, from: job.job_id };
};
