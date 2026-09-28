// dispatch's prior_attempt_failures: the red kernel checks of the try a retry follows, read from the checks rows
// (PK workflow_id, op_id, attempt). The predecessor is payload.retry.retryOf - by construction the previous FAILED
// try of the same work unit (scripts/kernel/units.mjs, H4) - never a sibling slice or another unit's job.
// Contract: modules/kernel/api.yaml commands.dispatch priorFailures. Ledger reads only.
import { parseJsonOr } from '../lib/json.mjs';

const EVIDENCE_CHARS = 400;
const payloadOf = (job) => parseJsonOr(job?.payload_json);

/** The checks row of `job`'s predecessor try, or null (a first try, or a predecessor without checks). */
export function priorChecksRow(db, job) {
  const retryOf = payloadOf(job)?.retry?.retryOf;
  if (!retryOf) return null;
  const prior = db.prepare('SELECT workflow_id, op_id, attempt FROM jobs WHERE job_id=? AND workflow_id=?').get(retryOf, job.workflow_id);
  if (!prior) return null;
  return db.prepare('SELECT attempt, checks_json FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?').get(prior.workflow_id, prior.op_id, prior.attempt) ?? null;
}

/** The red checks of priorChecksRow as the prompt's prior_attempt_failures: [{name, evidence}]. */
export function priorAttemptFailures(db, job) {
  const row = priorChecksRow(db, job);
  if (!row) return [];
  const checks = parseJsonOr(row.checks_json)?.checks ?? [];
  return checks
    .filter((c) => c && c.exitCode !== 0)
    .map((c) => ({ name: c.name ?? 'unnamed-check', evidence: `attempt ${row.attempt}: ${String(c.evidence ?? '').slice(0, EVIDENCE_CHARS)}` }));
}
