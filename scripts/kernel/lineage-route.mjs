// lineage-route.mjs — retry-aware routing: a retry learns from its own lineage's failed attempts.
//
// Owner decision 2026-09-25 (starci-next wf-sn-foundation): the Kernel routed
// op-interface.implement-c3bcc0d5e4 with `api route --avoid qwen-agent,devin-agent` and the job went to
// codex gpt-6-luna, defeating the evidence routing (implementation goes to Devin first). A Kernel no
// longer biases a route (api route ignores --prefer/--avoid); the ROUTER decides, from ledger facts:
//   - a pool whose provider-health circuit is open is rejected by capacity (unchanged);
//   - this module: when the job is a retry, each earlier attempt of its retry lineage
//     (payload.retry.retryOf|resumeOf; scripts/kernel/owner-answers.mjs lineageJobsOf) that FAILED on
//     pool X for a pool-attributable cause demotes X for this retry (taken only when no other pool of the
//     order is eligible); two such failures in the lineage exclude X for it.
// Pool-attributable causes (the agent, not the work):
//   no-report          the worker died with no report (settled failed-no-report)
//   gate-loop          the worker looped on a host dialog (op-worker-gate-loop), then settled no-report
//   quota              the launch failed on the provider's quota (dispatch-rejected, quota circuit)
//   provider-outage    the attempt settled failed with no report while its pool's quota or capacity circuit
//                      opened (a worker screen or a launch showed the provider's outage row)
//   agent-crash        the launch failed on the provider's auth/readiness/worker start or lost its prompt
//                      (prompt-delivery-stalled): dispatch-rejected with an open provider-health circuit; a
//                      first worker-start or prompt-delivery-stalled strike opens none and counts nothing
//   report-rejected    the worker reported done and the Kernel's recorded checks overruled it (claimOverruled)
//   repeat-red-check   a partial report whose red check was already red on the attempt it retried
// Everything else is the product's or the environment's and never moves a pool: a blocked or
// awaiting-owner settle (a missing secret, an owner gate), a failed report or a first red check (a peer's
// red tests), a dispatch refused before any provider fault (leases, reserve), a cancelled or dropped row.
// Ledger reads only; never writes.
import { lineageJobsOf } from './owner-answers.mjs';
import { AWAITING_OWNER, sameWorkLineage } from '../../engine/admission.mjs';
import { OUTAGE_KEYS } from '../agent/provider-outage.mjs';
import { parseJsonOr } from '../lib/json.mjs';

export const EXCLUDE_AFTER = 2;
export const POOL_CAUSES = Object.freeze(['no-report', 'gate-loop', 'quota', 'provider-outage', 'agent-crash', 'report-rejected', 'repeat-red-check']);
const FAILED_NO_REPORT = 'failed-no-report';

const parse = parseJsonOr;
const payloadOf = (row) => parse(row?.payload_json ?? '{}');
const resultOf = (row) => parse(row?.result_json ?? '{}');
const opOf = (row) => row?.op_id ?? payloadOf(row).opId ?? null;

/** The pool an attempt ran on: its persisted route, else the runtime pool its hierarchy recorded. */
export const attemptPoolOf = (row) => {
  const p = payloadOf(row);
  return p.model ?? p.hierarchy?.runtime?.runtimePool ?? null;
};

const redChecksOf = (db, row) => {
  if (!row) return [];
  const checks = parse(db.prepare('SELECT checks_json FROM checks WHERE workflow_id=? AND op_id=? AND attempt=?')
    .get(row.workflow_id, opOf(row), row.attempt)?.checks_json ?? '{}')?.checks;
  return Array.isArray(checks) ? checks.filter((c) => c && c.exitCode !== 0).map((c) => c.name ?? 'unnamed-check') : [];
};
const reportOutcomeOf = (db, row) => parse(db.prepare(
  "SELECT payload_json FROM events WHERE entity_type='job' AND entity_id=? AND kind='op-settled' ORDER BY seq DESC LIMIT 1").get(row.job_id)?.payload_json ?? '{}')
  ?.reportOutcome ?? null;

// The outage circuit (quota or capacity) the attempt's pool opened while the attempt ran, or null.
const OUTAGE_KINDS = Object.values(OUTAGE_KEYS);
const outageDuringOf = (db, row, pool) => {
  if (!pool) return null;
  const hit = db.prepare(`SELECT payload_json FROM events WHERE entity_type='provider' AND kind='provider-unavailable'
    AND json_extract(payload_json,'$.model')=? AND created_at BETWEEN ? AND ?
    AND json_extract(payload_json,'$.failureKind') IN (${OUTAGE_KINDS.map(() => '?').join(',')}) ORDER BY seq LIMIT 1`)
    .get(pool, row.created_at, row.updated_at, ...OUTAGE_KINDS);
  return hit ? parse(hit.payload_json) : null;
};

/**
 * Why one lineage attempt failed: {cause, attributable, detail}. `previous` is the attempt it retried (the
 * next older lineage row), used for repeat-red-check.
 */
export function attemptCauseOf(db, row, previous = null) {
  if (row.status !== 'failed') return { cause: row.status, attributable: false, detail: `settled ${row.status}` };
  const result = resultOf(row);
  if (result.verdict === AWAITING_OWNER || result.verdict === 'blocked') {
    return { cause: 'blocked', attributable: false, detail: `settled ${result.verdict} (owner or environment)` };
  }
  if (result.reason !== 'dispatch-rejected' && !result.report && !reportOutcomeOf(db, row)) {
    const outage = outageDuringOf(db, row, attemptPoolOf(row));
    if (outage) return { cause: 'provider-outage', attributable: true, detail: `settled with no report while ${outage.provider ?? 'the provider'} was out of ${outage.failureKind}` };
  }
  if (result.reason === FAILED_NO_REPORT) {
    const loop = result.worker?.liveness === 'gate-loop' || Boolean(db.prepare(
      "SELECT 1 FROM events WHERE entity_id=? AND kind='op-worker-gate-loop' AND json_extract(payload_json,'$.attempt')=?").get(row.job_id, row.attempt));
    return loop
      ? { cause: 'gate-loop', attributable: true, detail: 'the worker looped on a host dialog and settled with no report' }
      : { cause: 'no-report', attributable: true, detail: `the worker died with no report${result.worker?.liveness ? ` (${result.worker.liveness})` : ''}` };
  }
  if (result.reason === 'dispatch-rejected') {
    const health = result.providerHealth;
    if (health?.failureKind === 'quota') return { cause: 'quota', attributable: true, detail: `launch refused on ${health.provider ?? 'the provider'}'s quota` };
    if (health) return { cause: 'agent-crash', attributable: true, detail: `launch failed at ${result.step ?? '-'} (${health.failureKind ?? 'provider'})` };
    return { cause: 'dispatch-rejected', attributable: false, detail: `dispatch refused at ${result.step ?? '-'} with no provider fault` };
  }
  if (result.claimOverruled) return { cause: 'report-rejected', attributable: true, detail: 'reported done; the recorded checks were red' };
  const outcome = reportOutcomeOf(db, row);
  if (outcome === 'partial') {
    const prior = new Set(redChecksOf(db, previous));
    const repeated = redChecksOf(db, row).filter((name) => prior.has(name));
    if (repeated.length) return { cause: 'repeat-red-check', attributable: true, detail: `partial again on ${repeated.join(', ')}` };
  }
  return { cause: outcome ? `report-${outcome}` : 'fail', attributable: false, detail: 'the work or its environment, not the pool' };
}

/**
 * The lineage adjustment for routing `job`: null for a first attempt (no lineage), else
 * {attempts:[{jobId, attempt, pool, cause, attributable, detail}], demote:[pool], exclude:[pool],
 *  pools:{<pool>: {failures, causes[]}}}. `demote` holds pools with one pool-attributable failure,
 * `exclude` pools with EXCLUDE_AFTER or more.
 */
export function lineageRouteAdjust(db, job) {
  const uncut = !payloadOf(job).cut;
  // A lineage row of another unit of work (a chain an older enqueue mislinked) is not this job's history.
  const lineage = lineageJobsOf(db, job).filter((row) => !uncut || sameWorkLineage(row, job));
  if (!lineage.length) return null;
  const attempts = lineage.map((row, i) => {
    const { cause, attributable, detail } = attemptCauseOf(db, row, lineage[i + 1] ?? null);
    return { jobId: row.job_id, attempt: row.attempt, pool: attemptPoolOf(row), cause, attributable, detail };
  });
  const pools = {};
  for (const a of attempts) {
    if (!a.attributable || !a.pool) continue;
    (pools[a.pool] ??= { failures: 0, causes: [] }).failures += 1;
    pools[a.pool].causes.push(`${a.cause} (${a.jobId})`);
  }
  const entries = Object.entries(pools);
  return {
    attempts,
    pools,
    demote: entries.filter(([, p]) => p.failures < EXCLUDE_AFTER).map(([pool]) => pool),
    exclude: entries.filter(([, p]) => p.failures >= EXCLUDE_AFTER).map(([pool]) => pool),
  };
}
