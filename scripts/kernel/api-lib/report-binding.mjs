// Durable worker report binding and identity for one dispatched job.
import { contractDispatchIdOf, jobPayloadOf } from './rows.mjs';

export const resolveJob = (db, jobId) => {
  const job = db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
  if (!job) throw Object.assign(new Error(`unknown job ${jobId}`), { code: 'job-unknown' });
  return job;
};
// reports.dispatch_id is the orchestration Dispatch id whenever one exists.
// command-terminal jobs retain their terminal handle in worker_id for exact
// cleanup, so payload.orca.dispatchId is the durable report identity.
// The contracts row for (workflow, op, attempt) IS the dispatch authority —
// `api dispatch` writes it before the job goes running, on both launch kinds.
// The payload is a cache of the same fact and can lag it (a launch rejected
// after an earlier one succeeded leaves a stale id behind), so the contract
// answers first and the payload only fills in for an attempt that has none.
const rejectedDispatchIdsOf = (job) => new Set(
  (jobPayloadOf(job).rejectedDispatches ?? []).map((entry) => entry?.dispatchId).filter(Boolean));
export const reportDispatchIdOf = (db, job) => {
  const payload = jobPayloadOf(job);
  return contractDispatchIdOf(db, job) ?? explicitReportDispatchIdOf(db, job)
    ?? payload.orca?.dispatchId ?? job.worker_id ?? job.job_id;
};
export const REPORTABLE_JOB_STATUSES = new Set(['running', 'answering', 'effect_unknown']);
const explicitReportDispatchIdOf = (db, job) => {
  const contract = contractDispatchIdOf(db, job);
  if (contract) return contract;
  // No contract for this attempt: the payload is the only binding there is,
  // and a dispatch that was rejected is never one.
  const payload = jobPayloadOf(job);
  const rejected = rejectedDispatchIdsOf(job);
  const bound = payload.managed?.dispatchId ?? payload.orca?.dispatchId ?? null;
  return bound && !rejected.has(bound) ? bound : null;
};
export const requireDispatchedReportBinding = (db, job) => {
  if (!REPORTABLE_JOB_STATUSES.has(job.status)) {
    throw Object.assign(new Error(`job ${job.job_id} cannot file or verify a worker report while ${job.status}`), {
      code: 'report-job-not-active', status: job.status,
    });
  }
  const dispatchId = explicitReportDispatchIdOf(db, job);
  if (!dispatchId) {
    throw Object.assign(new Error(`job ${job.job_id} has no bound operation dispatch`), { code: 'report-dispatch-unbound' });
  }
  const contract = contractDispatchIdOf(db, job);
  if (!contract || contract !== dispatchId) {
    throw Object.assign(new Error(`job ${job.job_id} has no contract bound to dispatch ${dispatchId}`), {
      code: 'report-contract-unbound', dispatchId,
    });
  }
  return dispatchId;
};
export const parseAttempt = (v) => {
  if (v == null) return null;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 1) throw Object.assign(new Error(`--attempt must be a positive integer, got '${v}'`), { code: 'bad-attempt' });
  return n;
};

export const reportIdentityOf = (db, job) => {
  const payload = jobPayloadOf(job);
  return { run: payload.managed?.runId ?? payload.orca?.runId ?? null,
           task: payload.managed?.taskId ?? payload.orca?.taskId ?? null,
           dispatch: reportDispatchIdOf(db, job), from: job.job_id };
};
