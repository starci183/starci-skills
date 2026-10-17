// land-record.mjs - what one land of scripts/supervisor/land.mjs leaves in machine.sqlite: the core outcome as ONE idempotent
// write (landOutcomeOf), then the job and self-job follow-ups (recordLand).
import { newSpanId } from '../../engine/db/machine.mjs';
import { SKILL_ROOT } from '../machine/home.mjs';
import { finishLanded, selfJobsLandedBy, recordLandFailed } from './workers.mjs';
import { describe } from './land-format.mjs';


const landResultOf = (r) => { if (r.ok) { return 'passed'; } if (r.reason === 'conflict') { return 'conflict'; } if (['dirty', 'not-on-main', 'live-not-on-main', 'main-moved', 'gate-busy', 'git-unusable', 'host-lock-held'].includes(r.reason)) { return 'refused'; } return 'failed'; };
const landLogKind = (result) => (result.ok && 'land.passed') || (!result.ok && result.reason === 'gate-busy' && 'land.gate-busy') || 'land.failed';

/** The gate-loosening step of a land as {loosening: {id, approved, findings}} for the land record, or nothing when the change loosened no gate. */
const looseningOf = (result) => {
  const step = (result.checks ?? []).find((c) => c.name === 'gate-loosening');
  return step ? { loosening: { id: step.id ?? null, approved: step.approved === true, findings: (step.findings ?? []).length } } : {};
};

/**
 * The core record of one land as ONE idempotent write (machine-db recordLandOutcome, keyed on spanId): the
 * land_runs row (full result as the stdout blob), the lane head and the log line. Plain data, so a refused write can wait
 * in the machine-db outbox and be replayed by the next land.
 */
export function landOutcomeOf(result, { ticketId = null, lane = null, commits, jobId = null, startedAt, spanId = newSpanId() }) {
  const failed = (result.checks ?? []).filter((c) => !c.ok);
  const run = { ticketId, commitSha: commits[commits.length - 1], commits, landedSha: result.landed ?? null, result: landResultOf(result),
    // an already-landed pick moved nothing: no landed_sha (direct-commit detection keys on the mains the gate produced)
    reason: result.reason ?? (result.alreadyLanded ? `already-landed ${result.alreadyLanded}` : null), // specs_json (machine.sql land_runs) keeps its column name: it now holds the failed check names and the loosening step; the runtime runs no specs (owner ruling no-runtime-specs).
    specs: { failed: failed.map((c) => c.name), ...looseningOf(result) },
    stdout: JSON.stringify(result, null, 2), stderr: failed.map((c) => `## ${c.name}\n${c.output ?? ''}`).join('\n') || null, startedAt, finishedAt: Date.now() };
  const log = { actor: 'land', kind: landLogKind(result), level: result.ok ? 'info' : 'warn', msg: describe(result, { jobId }).slice(0, 2000),
    data: { ticketId, lane, jobId, commits, landed: result.landed ?? null, reason: result.reason ?? null }, refs: [...(lane ? [`lane:${lane}`] : []), ...commits.map((c) => `commit:${c}`)] };
  return { spanId, lane, run, laneHead: result.ok && lane ? (result.landed ?? result.alreadyLanded ?? null) : null, log };
}

// A landed job is succeeded, its leases released, its checkout, branch and [Worker] terminal gone (finishLanded).
// --commit of a self checkout's commits closes that self job as --job would: left open, it kept its file leases
// and blocked every worker needing them. A red gate keeps the failure on the job.
const finishLandedJobs = (m, result, { root, env, commits, jobId, orca, startedAt }) => {
  const landedSha = result.landed ?? result.alreadyLanded ?? null;
  const withOrca = orca ? { orca } : {};
  if (result.ok && jobId && m.supJob(jobId)) result.finished = finishLanded(m, { jobId, landedSha, root, env, ...withOrca });
  if (result.ok && !jobId) {
    const self = selfJobsLandedBy(m, commits, { root });
    if (self.done.length) result.finished = self.done.map((id) => finishLanded(m, { jobId: id, landedSha, root, env, ...withOrca }));
    if (self.partial.length) result.selfPending = self.partial;
  }
  if (!result.ok && jobId) recordLandFailed(m, { jobId, reason: result.reason ?? null, startedAt });
};

/** The machine records of one land: the core outcome (landOutcomeOf), then the job and self-job follow-ups. */
export function recordLand(m, { result, root = SKILL_ROOT, env = process.env, ticketId = null, lane = null, commits, jobId = null, startedAt, outcome = null, orca = undefined }) {
  const { runId } = m.recordLandOutcome(outcome ?? landOutcomeOf(result, { ticketId, lane, commits, jobId, startedAt }));
  finishLandedJobs(m, result, { root, env, commits, jobId, orca, startedAt });
  return runId;
}
