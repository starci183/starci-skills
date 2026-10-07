// land-record.mjs - what one land of scripts/supervisor/land.mjs leaves in machine.sqlite: the core outcome as ONE idempotent
// write (landOutcomeOf), then the job, self-job, specs-red-on-main and push-owed follow-ups (recordLand).
import path from 'node:path';
import { createHash } from 'node:crypto';
import { newSpanId } from '../../engine/db/machine.mjs';
import { SKILL_ROOT } from '../machine/home.mjs';
import { DEFAULT_DUE_MS } from '../machine/decisions.mjs';
import { finishLanded, selfJobsLandedBy, recordLandFailed } from './workers.mjs';
import { describe, failList, specsRedOnMainOf } from './land-format.mjs';

/** A spec failure's identity: its file and its test name. */
export const failKey = (f) => `${f.file}\u0000${f.name}`;

const landResultOf = (r) => { if (r.ok) { return 'passed'; } if (r.reason === 'conflict') { return 'conflict'; } if (['dirty', 'not-on-main', 'live-not-on-main', 'main-moved', 'gate-busy', 'git-unusable', 'host-lock-held'].includes(r.reason)) { return 'refused'; } return 'failed'; };
/** MB-12: a land that moved main but whose push did not happen (refused or failed, not skipped). */
export const pushOwedOf = (r) => Boolean(r?.ok && r.landed && r.push && !r.push.pushed && !r.push.skipped);

const pushRowOf = (result, root, commits) => {
  const p = result.push;
  if (!p) return null;
  return { repoRoot: root, branch: 'main', head: result.landed ?? commits[commits.length - 1], result: (p.pushed && 'pushed') || (p.skipped && 'skipped') || (p.refused && 'refused') || 'failed',
    reason: p.refused ?? p.skipped ?? p.error ?? null,
    failureSignature: p.pushed || p.skipped ? null : (p.refused && `secret-scan:${(p.findings ?? []).map((x) => x.rule ?? x.id ?? 'finding')[0] ?? 'finding'}`) || 'push:error',
    scan: p.findings ? { findings: p.findings } : null, stderr: p.error ?? null };
};

const landLogKind = (result) => (result.ok && (pushOwedOf(result) && 'land.push-owed' || 'land.passed')) || (!result.ok && result.reason === 'gate-busy' && 'land.gate-busy') || 'land.failed';

/**
 * The core record of one land as ONE idempotent write (machine-db recordLandOutcome, keyed on spanId): the push row, the
 * land_runs row (full result as the stdout blob), the lane head and the log line. Plain data, so a refused write can wait
 * in the machine-db outbox and be replayed by the next land.
 */
export function landOutcomeOf(result, { root = SKILL_ROOT, ticketId = null, lane = null, commits, jobId = null, specMode = null, startedAt, spanId = newSpanId() }) {
  const push = pushRowOf(result, root, commits);
  const failed = (result.checks ?? []).filter((c) => !c.ok);
  const run = { ticketId, commitSha: commits[commits.length - 1], commits, landedSha: result.landed ?? null, result: landResultOf(result),
    // an already-landed pick moved nothing: no landed_sha (direct-commit detection keys on the mains the gate produced)
    reason: result.reason ?? (result.alreadyLanded ? `already-landed ${result.alreadyLanded}` : null), specs: { mode: specMode, ...(result.specReason ? { reason: result.specReason } : {}), failed: failed.map((c) => c.name) },
    stdout: JSON.stringify(result, null, 2), stderr: failed.map((c) => `## ${c.name}\n${c.output ?? ''}`).join('\n') || null, startedAt, finishedAt: Date.now() };
  const log = { actor: 'land', kind: landLogKind(result), level: result.ok ? 'info' : 'warn', msg: describe(result, { jobId }).slice(0, 2000),
    data: { ticketId, lane, jobId, commits, landed: result.landed ?? null, reason: result.reason ?? null }, refs: [...(lane ? [`lane:${lane}`] : []), ...commits.map((c) => `commit:${c}`)] };
  return { spanId, lane, push, run, laneHead: result.ok && lane ? (result.landed ?? result.alreadyLanded ?? null) : null, log };
}

/** The openSupDecision args of the specs-red-on-main DI: ONE per set of failing tests, due like any Supervisor-decided DI. */
export function specsRedOnMainDecision({ redOnMain, root, commits, now }) {
  const signature = createHash('sha1').update(redOnMain.inherited.map(failKey).sort().join('/')).digest('hex').slice(0, 12);
  return { keyParts: { kind: 'specs-red-on-main', repo: path.basename(root).replace(/[^\w.-]/g, '_') || 'runtime', signature }, kind: 'runtime-defect',
    summary: `${redOnMain.name} at ${String(redOnMain.base).slice(0, 9)}: the land gate tolerated them as inherited; fix main: ${failList(redOnMain.inherited)}`.slice(0, 1000), entityType: 'repo', entityId: root, openedBy: 'land-gate',
    dueAt: now + DEFAULT_DUE_MS.supervisor, escalateTo: 'owner',
    evidence: redOnMain.inherited.slice(0, 20).map((f) => ({ ref: `spec:${f.file}`, why: f.name.slice(0, 300) })), payload: { base: redOnMain.base, inherited: redOnMain.inherited, commits } };
}

/** MB-12: main moved but GitHub did not: ONE Supervisor DI per landed head (the workers:push duty retries). */
const pushOwedDecision = (result, root) => {
  const why = result.push.refused ?? result.push.error ?? 'push failed';
  return { keyParts: { kind: 'push-owed', repo: path.basename(root).replace(/[^\w.-]/g, '_') || 'runtime', head: String(result.landed).slice(0, 12) }, kind: 'push-refused',
    summary: `Land passed ${String(result.landed).slice(0, 9)} but its push did not: ${String(why).slice(0, 300)}`, entityType: 'repo', entityId: root, openedBy: 'land-gate', dueAt: Date.now() + DEFAULT_DUE_MS.supervisor, escalateTo: 'owner',
    evidence: [{ ref: `commit:${result.landed}`, why: String(why).slice(0, 500) }], options: [{ key: 'push', verb: 'starci supervisor push-mains --repo <runtime root> --json', recommended: true }] };
};

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

/** The machine records of one land: the core outcome (landOutcomeOf), then the job, self-job and push-owed follow-ups. */
export function recordLand(m, { result, root = SKILL_ROOT, env = process.env, ticketId = null, lane = null, commits, jobId = null, specMode = null, startedAt, outcome = null, orca = undefined }) {
  const { runId } = m.recordLandOutcome(outcome ?? landOutcomeOf(result, { root, ticketId, lane, commits, jobId, specMode, startedAt }));
  finishLandedJobs(m, result, { root, env, commits, jobId, orca, startedAt });
  // Specs red on main (inherited, not this land's fault): ONE Supervisor DI per set of failing tests, so main gets fixed.
  const redOnMain = specsRedOnMainOf(result);
  if (redOnMain) {
    try {
      m.openSupDecision(specsRedOnMainDecision({ redOnMain, root, commits, now: Date.now() }));
    } catch { /* the land_runs row carries the advisory */ }
  }
  if (pushOwedOf(result)) {
    try {
      m.openSupDecision(pushOwedDecision(result, root));
    } catch { /* the land_runs row and its push row are the record */ }
  }
  return runId;
}
