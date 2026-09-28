// dispatch's prior_attempt_failures: the red kernel checks of the try a retry follows, read from its check_runs
// (api-lib/check-evidence.mjs independentChecksOf, the predecessor's newest attempt). The predecessor is jobs.retry_of -
// by construction the previous FAILED try of the same work unit (scripts/kernel/units.mjs, H4) - never a sibling slice
// or another unit's job. Contract: modules/kernel/api.yaml commands.dispatch priorFailures. Ledger reads only.
import { independentChecksOf } from './api-lib/check-evidence.mjs';

const EVIDENCE_CHARS = 400;

/** The retry_of of `job`: its own column, else read back by id (a partial job object). */
const retryOfJob = (db, job) => ('retry_of' in (job ?? {}) ? job.retry_of
  : (job?.job_id ? db.prepare('SELECT retry_of FROM jobs WHERE job_id=?').get(job.job_id)?.retry_of : null)) ?? null;

/**
 * The checks of `job`'s predecessor try as {attempt (its try_no), checks: [...]}, or null (a first try, or a
 * predecessor without independent checks).
 */
export function priorChecksRow(db, job) {
  const retryOf = retryOfJob(db, job);
  if (!retryOf) return null;
  const prior = db.prepare('SELECT job_id, try_no FROM jobs WHERE job_id=? AND workflow_id=?').get(retryOf, job.workflow_id);
  if (!prior) return null;
  const evidence = independentChecksOf(db, { jobId: prior.job_id });
  return evidence ? { attempt: prior.try_no, checks: evidence.checks ?? [] } : null;
}

/** The red checks of priorChecksRow as the prompt's prior_attempt_failures: [{name, evidence}]. */
export function priorAttemptFailures(db, job) {
  const row = priorChecksRow(db, job);
  if (!row) return [];
  return row.checks
    .filter((c) => c && c.exitCode !== 0)
    .map((c) => ({ name: c.name ?? 'unnamed-check', evidence: `attempt ${row.attempt}: ${String(c.evidence ?? '').slice(0, EVIDENCE_CHARS)}` }));
}
