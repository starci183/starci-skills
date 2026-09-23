// dispatch's prior_attempt_failures: the red kernel checks of the attempt a
// retry follows, read from the checks rows (PK workflow_id, op_id, attempt).
// The row is taken from the job's own retry lineage - the rule
// engine/admission.mjs cutRetryLineage and api.mjs retryLineageFor define:
// an uncut op follows the op's latest earlier attempt; a cut ordinal follows
// only its own ordinal (same op, cut id AND ordinal), never a sibling slice
// that shares the op's durable attempt counter (inc-eafe6e1c3bc3,
// inc-49885f42c608, inc-2fa6209de98d: an ordinal retry inherited a sibling's
// checks and never saw its own red ones). Contract: modules/kernel/api.yaml
// commands.dispatch priorFailures. Ledger reads only.
import { cutOf } from '../../engine/admission.mjs';

const EVIDENCE_CHARS = 400;
const payloadOf = (job) => { try { return JSON.parse(job?.payload_json ?? '{}') ?? {}; } catch { return {}; } };

/**
 * The newest checks row of `job`'s retry lineage before it, or null. The
 * lineage is the op's earlier attempts, narrowed for a cut to the jobs of the
 * same cut id and ordinal. When payload.retry.retryOf names a job of that
 * lineage, rows after its attempt are not the predecessor's and are skipped;
 * a retryOf outside the lineage (a sibling ordinal a pre-fix enqueue wrote) is
 * ignored. A predecessor without a checks row falls back to the lineage's
 * newest earlier row, as an uncut op always has.
 */
export function priorChecksRow(db, job) {
  const attempt = Number(job?.attempt);
  if (!Number.isInteger(attempt) || attempt <= 1) return null;
  const payload = payloadOf(job);
  const op = job.op_id ?? payload.opId;
  if (!op) return null;
  const cut = cutOf(job);
  const sameCut = cut
    ? " AND json_extract(j.payload_json,'$.cut.id')=? AND json_extract(j.payload_json,'$.cut.ordinal')=?"
    : '';
  const cutArgs = cut ? [cut.id, cut.ordinal] : [];
  let ceiling = attempt - 1;
  const retryOf = payload.retry?.retryOf;
  if (retryOf) {
    const predecessor = db.prepare(`SELECT j.attempt FROM jobs j WHERE j.job_id=? AND j.workflow_id=? AND j.op_id=? AND j.attempt<?${sameCut}`)
      .get(retryOf, job.workflow_id, op, attempt, ...cutArgs);
    if (predecessor) ceiling = Number(predecessor.attempt);
  }
  const inLineage = cut
    ? ` AND EXISTS (SELECT 1 FROM jobs j WHERE j.workflow_id=c.workflow_id AND j.op_id=c.op_id AND j.attempt=c.attempt${sameCut})`
    : '';
  return db.prepare(`SELECT c.attempt, c.checks_json FROM checks c WHERE c.workflow_id=? AND c.op_id=? AND c.attempt<=?${inLineage}
    ORDER BY c.attempt DESC LIMIT 1`).get(job.workflow_id, op, ceiling, ...cutArgs) ?? null;
}

/** The red checks of priorChecksRow as the prompt's prior_attempt_failures: [{name, evidence}]. */
export function priorAttemptFailures(db, job) {
  const row = priorChecksRow(db, job);
  if (!row) return [];
  let checks = [];
  try { checks = JSON.parse(row.checks_json ?? '{}')?.checks ?? []; } catch { return []; }
  return checks
    .filter((c) => c && c.exitCode !== 0)
    .map((c) => ({ name: c.name ?? 'unnamed-check', evidence: `attempt ${row.attempt}: ${String(c.evidence ?? '').slice(0, EVIDENCE_CHARS)}` }));
}
