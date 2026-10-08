// progress-rca.mjs — "am I progressing toward the goal? if not, why, and which single change fixes the most?"
// computed in deterministic code, so a Kernel on a modest model only has to pick the top untried action.
//
// Owner ruling 2026-09-28: the workflows move themselves forward, not the supervisor. Ops draw the graph, the Kernel
// makes LIGHT edits (starci kernel graph-edit) and dispatches the owning op for a heavy redesign (starci kernel redesign). The Kernel
// stays on Devin, so the thinking lives here:
//
//   progressOf  units that PASSED their gates (a succeeded job; never a job count, never a self-marked done), units
//               per hour, share of legs done, running vs allowed parallelism (RAM cap, pools, priority reserve),
//               queued-ready, ETA, and a stall verdict with its reasons (runtimes.yaml allocation.progress).
//   rcaOf       every recent failed/blocked attempt of the workflow read TOGETHER (report summary, blocker kind,
//               failureClass, rootCause, worker liveness), clustered by cause.
//   actionsOf   a RANKED list of concrete candidate actions from a fixed catalogue: each carries its exact api
//               command, its expected effect, its tier (light = a direct Kernel edit; heavy = dispatch the owning op
//               with the RCA as its brief; proposal = a tier-2 kernel-proposal for the Supervisor; supervisor = a runtime
//               or cross-workflow cause the Kernel cannot fix) and whether the decision log already tried it (a failed try sinks, it is never offered as new).
//
// Read-only over the ledger. `starci kernel status` exposes `progress` and `rca` (scripts/kernel/status/*.mjs); the
// workflow controller (modules/reconciler/workflow.yaml) reuses it for the progress-stall DI and escalation.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { allocationSettings } from '../../engine/config.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { clipLine } from '../lib/clip.mjs';
import { SLOT_STATUSES, priorityTable, readThrottleState } from '../machine/ram-throttle.mjs';
import { specsOf } from '../route/spec-deferral.mjs';
import { loadRuntimes } from '../agent/models.mjs';
import { JOB_ROW } from '../machine/job-row.mjs';
import { kernelDecisionItems } from '../machine/reported-jobs.mjs';
import { importsBrokenOf } from './status/imports.mjs';
import { blockingDecisions, resolutionOf } from '../machine/decisions.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { HOUR, etaOf, stallOf } from './progress-stall.mjs';
import { MISSING_PATHS_RE, GRANT_NARROW_RE, TOOL_TIMEOUT_RE, TEST_GAP_RE, CHECKER_UNAVAILABLE_RE } from './rca-matchers.mjs';

const unitSpecsOff = () => { try { return specsOf({ skillRoot }).unit === false; } catch { return false; } };

export const OPEN_JOB = Object.freeze(['queued', 'leased', 'running', 'reported', 'effect_unknown', 'answering']);
export const DECISION_KIND = 'kernel-decision';
export const DECISION_RESULT_KIND = 'kernel-decision-result';
export const GRAPH_EDIT_KIND = 'kernel-graph-edit';
const one = (s, n = 240) => clipLine(s, n);
const parse = (s, d = {}) => parseJsonOr(s, d) ?? d;

/** runtimes.yaml allocation.progress with safe defaults (a missing block never breaks starci kernel status). */
export function progressSettings(allocation = null) {
  let a = allocation;
  if (!a) { try { a = allocationSettings(); } catch { a = {}; } }
  const p = a?.progress ?? {};
  const pos = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
  return {
    windowMs: pos(p.windowMs, HOUR), etaWindowMs: pos(p.etaWindowMs, 6 * HOUR), graceMs: pos(p.graceMs, 30 * 60_000),
    supervisorGraceMs: pos(p.supervisorGraceMs, HOUR),
    minUnitsPerHour: { priority: pos(p.minUnitsPerHour?.priority, 3), default: pos(p.minUnitsPerHour?.default, 0) },
    maxUnitsPerEdit: pos(p.maxUnitsPerEdit, 3),
    recutThreshold: pos(p.recutThreshold, 3),
    rca: { minFailures: pos(p.rca?.minFailures, 3), windowMs: pos(p.rca?.windowMs, 24 * HOUR), examples: pos(p.rca?.examples, 4) },
    commandTimeoutMs: pos(p.commandTimeoutMs, 600_000),
    settleBacklog: { max: pos(p.settleBacklog?.max, 3), ageMs: pos(p.settleBacklog?.ageMs, 120_000) },
  };
}

/* ------------------------------------------------------------ units */

/** The op jobs of one workflow, parsed. */
export function opJobsOf(db, workflowId) {
  return db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind='op' ORDER BY created_at, job_id`)
    .all(workflowId).map((j) => ({ ...j, payload: parse(j.payload_json), result: parse(j.result_json) }));
}

/** The state of one unit's job list: done | open | awaiting-owner | dropped | failed. */
const unitStateOf = (jobs) => {
  if (jobs.at(-1)?.status === 'succeeded') return 'done';
  if (jobs.some((j) => OPEN_JOB.includes(j.status))) return 'open';
  if (jobs.at(-1)?.status === 'awaiting_owner') return 'awaiting-owner';
  return jobs.every((j) => j.status === 'cancelled') ? 'dropped' : 'failed';
};

/**
 * One unit per work unit (payload.unit.id, scripts/kernel/units.mjs): every try of one bounded piece of work, a
 * continuation (graph-edit continue --retry-of) included. A unit is `done` only when its latest try
 * succeeded (settled through its checks), `dropped` when every job was cancelled, `open` while a job is open, else
 * `failed`. Pure over `jobs`.
 */
export function unitsOf(jobs) {
  const keyOf = (j) => `${j.op_id}|${j.unit_id ?? j.job_id}`, units = new Map();
  for (const j of jobs) {
    const k = keyOf(j); if (!units.has(k)) units.set(k, { key: k, op: j.op_id, cut: j.payload?.cut ?? null, jobs: [] });
    units.get(k).jobs.push(j);
  }
  for (const u of units.values()) {
    const ok = u.jobs.filter((j) => j.status === 'succeeded'); u.doneAt = ok.length ? Math.min(...ok.map((j) => Number(j.updated_at))) : null;
    u.state = unitStateOf(u.jobs); u.last = u.jobs[u.jobs.length - 1];
    u.open = u.jobs.filter((j) => OPEN_JOB.includes(j.status));
  }
  return [...units.values()];
}

/* ------------------------------------------------------------ parallelism */

// The merged view (runtimes.yaml policy + registry.yaml `pools` under `runtimes`) comes from the one loader.
const runtimesDoc = (() => { let doc; return () => { if (doc === undefined) { try { doc = loadRuntimes(path.join(skillRoot, 'modules', 'models')); } catch { doc = null; } } return doc; }; })();

/** The priority table (runtimes.yaml ramThrottle.priorities + the Supervisor's host overrides). Never throws. */
export function priorities() {
  try { return priorityTable(null, readThrottleState()); }
  catch { try { return priorityTable(null, {}); } catch { return {}; } }
}

/**
 * How many units this workflow may run at once now: min(its priority reserve or maxParallelOps, running + what the
 * worker RAM cap, the pools and its queued-ready work allow). Pure over `core` (the starci kernel status fields ramThrottle,
 * poolLoad) and the counts. {allowed, why, workersFree, poolFree, cap}.
 */
function allowedParallelOf({ core = {}, running = 0, queuedReady = 0, workflowId, prio = priorities(), rt = runtimesDoc() }) {
  const rtCap = Number(rt?.maxParallelOps) || 20, thr = core.ramThrottle ?? {};
  const effective = Number(thr.effectiveCap ?? rtCap), workersRunning = Number(thr.running ?? running);
  const workersFree = Math.max(0, effective - workersRunning), pools = rt?.runtimes ?? {};
  const load = core.poolLoad?.running ?? {}; let poolFree = 0;
  for (const [id, p] of Object.entries(pools)) poolFree += Math.max(0, (Number(p?.maxParallel) || 0) - (Number(load[p?.target ?? id] ?? load[id]) || 0));
  const reserve = prio[workflowId]?.reserve || 0, cap = reserve > 0 ? reserve : rtCap;
  const add = Math.min(workersFree, poolFree, queuedReady), allowed = Math.min(cap, running + add);
  const holdFor = core.poolLoad?.routeHoldMs ? 'for ' + Math.round(core.poolLoad.routeHoldMs / 60_000) + 'm' : '';
  let binds = `pool slots (${poolFree} free; routed-but-undispatched jobs hold slots ${holdFor})`;
  if (add === queuedReady) binds = 'queued-ready';
  else if (add === workersFree) binds = `worker RAM cap ${effective} (${workersRunning} running worker-wide)`;
  return { allowed, cap, workersFree, poolFree, why: allowed >= cap ? `workflow cap ${cap}` : binds };
}

/* ------------------------------------------------------------ progress */

/** Whether this workflow is the top-priority one (highest weight > 1). */
function isPriority(workflowId, prio = priorities()) {
  const w = prio[workflowId]?.weight ?? 1;
  if (w <= 1) return false;
  return Object.values(prio).every((p) => (p.weight ?? 1) <= w);
}

/**
 * The progress block of `starci kernel status`. Pure over its inputs: `jobs` (opJobsOf), `core` (the starci kernel status out: legs,
 * frontier, ramThrottle, poolLoad, stuck), `createdAt` (the workflow row), `now`, `settings`.
 */
export function progressOf({ jobs, core = {}, workflowId, createdAt = null, now = Date.now(), settings = progressSettings(), prio = priorities(), kernelItems = null }) {
  const units = unitsOf(jobs).filter((u) => u.state !== 'dropped'), done = units.filter((u) => u.state === 'done');
  const total = units.length, inWin = (ms) => done.filter((u) => u.doneAt >= now - ms).length;
  const unitsPerHour = Math.round(inWin(settings.windowMs) / (settings.windowMs / HOUR) * 10) / 10;
  const etaRate = inWin(settings.etaWindowMs) / (settings.etaWindowMs / HOUR), remaining = total - done.length;
  const running = jobs.filter((j) => SLOT_STATUSES.includes(j.status)).length, queued = core.frontier?.queued ?? [];
  const readyJobs = queued.filter((q) => q.queuedBecause === 'ready').map((q) => q.jobId), queuedReady = readyJobs.length;
  const par = allowedParallelOf({ core, running, queuedReady, workflowId, prio });
  const legs = (Array.isArray(core.legs) ? core.legs : []).filter((l) => l.color !== 'external'), legsDone = legs.filter((l) => l.color === 'green').length;
  const lastDoneAt = done.length ? Math.max(...done.map((u) => u.doneAt)) : null, priority = isPriority(workflowId, prio);
  const minRate = priority ? settings.minUnitsPerHour.priority : settings.minUnitsPerHour.default;
  const quietSince = lastDoneAt ?? (createdAt != null && Number.isFinite(Number(createdAt)) ? Number(createdAt) : now);
  // SETTLE-FIRST, the Kernel's half (owner ruling settle-runtime-service): the runtime settles green reports itself
  // (scripts/kernel/settle/job-settle.mjs); what waits is only what it handed to the Kernel - non-green outcomes and done reports
  // it could not verify (`kernelItems`, oldest first, already aged past settleBacklog.ageMs). Without them the old reading stands: filed reports never consumed.
  const unsettled = kernelItems
    ? kernelItems.map((k) => ({ job_id: k.jobId, created_at: now - k.ageMin * 60_000, reason: k.reason }))
    : (core.reports ?? []).filter((r) => !r.consumed_at && now - Number(r.created_at) >= settings.settleBacklog.ageMs);
  const failedUnits = units.filter((u) => u.state === 'failed').length;
  const { reasons, since } = stallOf({ core, queuedReady, running, allowed: par.allowed, now, remaining, minRate, unitsPerHour, priority,
    lastDoneAt, quietSince, graceMs: settings.graceMs, unsettled, failedUnits, doneCount: done.length });
  const sinceMs = since == null ? 0 : Math.max(0, now - since), { etaHours, eta } = etaOf(remaining, etaRate, now);
  return {
    schema: 'starci/progress@1', priority, unitsTotal: total, unitsDone: done.length, unitsOpen: units.filter((u) => u.state === 'open').length, unitsFailed: failedUnits,
    unitsPerHour, minUnitsPerHour: minRate, share: total ? Math.round(done.length / total * 1000) / 1000 : null,
    legs: { done: legsDone, total: legs.length },
    unsettledReports: unsettled.map((r) => r.job_id ?? r.dispatch_id),
    settleDecisions: kernelItems ?? null,
    running, allowedParallel: par.allowed, parallelCap: par.cap, parallelWhy: par.why, queuedReady, readyJobs,
    etaHours, eta,
    lastUnitAt: lastDoneAt ? new Date(lastDoneAt).toISOString() : null,
    stall: { stalled: reasons.length > 0, reasons, since: since ? new Date(since).toISOString() : null, sinceMin: Math.round(sinceMs / 60_000),
      kernelDue: reasons.length > 0, supervisorDue: reasons.length > 0 && sinceMs >= settings.supervisorGraceMs },
  };
}

export const progressLine = (p) => `progress ${p.unitsDone}/${p.unitsTotal} units (${p.share == null ? '-' : Math.round(p.share * 100)}%), ${p.unitsPerHour}/h${p.minUnitsPerHour ? ' (min ' + p.minUnitsPerHour + ')' : ''}, legs ${p.legs.done}/${p.legs.total}, running ${p.running}/${p.allowedParallel} allowed (${p.parallelWhy}), queued-ready ${p.queuedReady}, ETA ${p.eta ? p.eta.slice(0, 16).replace('T', ' ') : 'unknown'}${p.stall.stalled ? ' - STALL ' + p.stall.sinceMin + 'm: ' + p.stall.reasons.join('; ') : ''}`;

/* ------------------------------------------------------------ failure causes */

// The cause catalogue: label -> {why, authority}. authority kernel = the Kernel fixes it inside its workflow;
// supervisor = a runtime/.claude or cross-workflow cause (the Kernel files a kernel-proposal, the Supervisor owns it).
export const CAUSES = Object.freeze({
  'dead-worker': { why: 'the worker died or wedged without a report', authority: 'supervisor' },
  'missing-paths': { why: 'the unit was cut on paths that do not exist in the target checkout', authority: 'kernel' },
  'grant-too-narrow': { why: 'the fix needs files outside the unit\'s owned paths (moves, shared files, config)', authority: 'kernel' },
  'tool-timeout': { why: 'a required validator did not finish inside the agent\'s command window', authority: 'kernel' },
  'test-gap': { why: 'no regression test covers the unit, so the refactor refuses to start', authority: 'kernel' },
  'partial-work': { why: 'the unit left in-ceiling work the runtime preserved (preserved/<wf>/<job>) and stopped: progress, not a failure', authority: 'kernel' },
  'canon-conflict': { why: 'the cut asks for a location a canon rule forbids', authority: 'kernel' },
  'binding-defect': { why: 'the runtime bound the job to the wrong repository/guard', authority: 'supervisor' },
  // FMEA #20 / DESIGN §16.7: code moved and its importers still point at the old path - fixed by ONE repoint unit per
  // wave, never by the Supervisor; a checker that fails on an unresolved import is this, not checker-unavailable.
  'broken-import': { why: 'code moved and its importers still import the old path (IMPORTS_BROKEN_AFTER_MOVE)', authority: 'kernel' },
  'checker-unavailable': { why: 'a required checker answered unavailable', authority: 'supervisor' },
  upstream: { why: 'the root cause lives in another workflow', authority: 'supervisor' },
  'product-defect': { why: 'the product code failed its checks', authority: 'kernel' },
  other: { why: 'unclassified', authority: 'kernel' },
});
const SHAPE_CAUSES = new Set(['missing-paths', 'grant-too-narrow', 'tool-timeout', 'test-gap', 'canon-conflict', 'product-defect']);
export const isShapeCause = (c) => SHAPE_CAUSES.has(c);

const PATH_RE = /(?:^|[\s`'"(,:])((?:apps|packages|src|libs|e2e)\/[A-Za-z0-9_@.\-[\]()/]+?[A-Za-z0-9_\])])(?=[\s`'",;:)]|$)/g;

/** The text-matched causes of one attempt (blocker kind + report/body text), appended via `add`. */
const textCauses = ({ text, kind, causes, add }) => {
  if (/guard file|bind(?:s|ing)? owned|role be, repo ledger|wrong repository/i.test(text)) add('binding-defect');
  if (MISSING_PATHS_RE.test(text)) add('missing-paths');
  if (kind === 'shared-change' || GRANT_NARROW_RE.test(text)) add('grant-too-narrow');
  if (TOOL_TIMEOUT_RE.test(text)) add('tool-timeout');
  if (kind === 'test-gap' || TEST_GAP_RE.test(text)) add('test-gap');
  if (kind === 'grammar-gap' || /MONOREPO_TIER|monorepo-tier|canon rule .* forbids/i.test(text)) add('canon-conflict');
  if (/IMPORTS_BROKEN_AFTER_MOVE|broken-import|Cannot find module ['"]?[@./]|Module not found: (?:Error: )?Can't resolve|TS2307|unresolved import|Failed to resolve import/i.test(text)) add('broken-import');
  if (!causes.includes('broken-import') && CHECKER_UNAVAILABLE_RE.test(text) && kind === 'environment') add('checker-unavailable');
};

/** The causes of one failed/blocked attempt, primary first. Pure. */
export function causesOf({ status = 'failed', result = {}, report = null }) {
  const blocker = report?.blocker ?? {}, kind = String(blocker.kind ?? '').toLowerCase();
  const text = [report?.summary, blocker.detail, report?.rootCause?.claim, JSON.stringify(report?.openItems ?? ''), ...(report?.checks ?? []).map((c) => `${c.name} ${c.evidence ?? ''} exit=${c.exitCode ?? ''}`)].join(' \n ');
  const causes = [], add = (c) => { if (!causes.includes(c)) causes.push(c); };
  if (!report && (result?.worker?.liveness || result?.reportFiled === false)) { add('dead-worker'); } textCauses({ text, kind, causes, add });
  if (report?.rootCause?.self === false && String(report?.rootCause?.node ?? '').startsWith('wf-')) add('upstream');
  if (report && preservedOf(result) && (report.outcome === 'blocked' || status === 'failed')) add('partial-work');
  if (!causes.length && report && (result?.verdict === 'fail' || report.outcome === 'failed')) add('product-defect');
  if (!causes.length) add(kind === 'environment' ? 'checker-unavailable' : 'other');
  // An unresolved import is the cause even when the attempt also reads as something else (its checker "unavailable").
  if (causes.includes('broken-import') && causes[0] !== 'broken-import') causes.unshift(...causes.splice(causes.indexOf('broken-import'), 1));
  // Partial work is a secondary fact: the blocker that stopped the unit leads.
  if (causes[0] === 'partial-work' && causes.length > 1) causes.push(causes.shift());
  return causes;
}

/** The repository paths a report names that its unit does not own (the destinations a move needs). Pure. */
export function destinationsOf(report, ownedPaths = []) {
  const text = [report?.summary, report?.blocker?.detail, report?.rootCause?.claim].join(' ');
  const owned = ownedPaths.map((p) => String(p).replaceAll('\\', '/').replace(/^[^/]*\/(?=(?:apps|packages)\/)/, '')), out = new Set();
  for (const m of text.matchAll(PATH_RE)) {
    const p = m[1].replace(/(?<![.,)])[.,)]+$/, '').replace(/(?<!\/)\/+$/, '');
    if (p.includes('<') || p.includes('*') || owned.some((o) => p === o || p.startsWith(`${o}/`) || o.startsWith(`${p}/`))) continue;
    out.add(p);
  }
  return [...out].slice(0, 8);
}

/* ------------------------------------------------------------ RCA */

/** Reports keyed by job id for one workflow: each job's newest report (its latest attempt that filed one). */
export function reportsOf(db, workflowId) {
  const m = new Map();
  for (const r of db.prepare('SELECT job_id, outcome, report_json, created_at FROM reports WHERE workflow_id=? ORDER BY report_id').all(workflowId))
    m.set(r.job_id, { ...parse(r.report_json), outcome: r.outcome, at: Number(r.created_at) });
  return m;
}

/** The preserved ref settle recorded for a failed or blocked attempt in a workflow worktree (result.checkpoint), or null. */
const preservedOf = (result) => (typeof result?.checkpoint?.preservedRef === 'string' ? result.checkpoint.preservedRef : null);

/**
 * The failure-cluster RCA over every failed/blocked attempt of the workflow in the RCA window, read together.
 * Pure over `jobs`, `reports`. {window, attempts, byOp, clusters: [{cause, why, authority, count, open, units, jobs,
 * examples, preserved, destinations}], trigger}.
 */
export function rcaOf({ jobs, reports, now = Date.now(), settings = progressSettings(), stalled = false }) {
  const units = unitsOf(jobs), unitOf = new Map(units.flatMap((u) => u.jobs.map((j) => [j.job_id, u])));
  const since = now - settings.rca.windowMs, rows = [];
  for (const j of jobs) {
    if (j.status !== 'failed' || Number(j.updated_at) < since) continue;
    if (['dropped', 'superseded'].includes(j.result?.verdict)) continue;
    const report = reports.get(j.job_id) ?? null, u = unitOf.get(j.job_id);
    const causes = causesOf({ status: j.status, result: j.result, report });
    rows.push({ jobId: j.job_id, op: j.op_id, unit: u?.key ?? null, unitState: u?.state ?? null, causes, at: Number(j.updated_at),
      summary: one(report?.summary ?? report?.blocker?.detail ?? j.result?.environment ?? j.result?.worker?.liveness ?? j.result?.verdict, 200),
      preserved: preservedOf(j.result), destinations: report ? destinationsOf(report, j.payload?.owned_paths ?? []) : [], env: j.result?.environment ?? null,
      liveness: j.result?.worker?.liveness ?? null, paths: j.payload?.owned_paths ?? [] });
  }
  const byOp = {}; for (const r of rows) byOp[r.op] = (byOp[r.op] ?? 0) + 1;
  const trigger = stalled ? 'progress-stall' : Object.entries(byOp).filter(([, n]) => n >= settings.rca.minFailures).map(([op, n]) => `${op} x${n}`).join(', ') || null;
  const clusters = new Map();
  for (const r of rows) for (const c of r.causes) {
    if (!clusters.has(c)) clusters.set(c, { cause: c, why: CAUSES[c]?.why ?? c, authority: CAUSES[c]?.authority ?? 'kernel', rows: [] });
    clusters.get(c).rows.push(r);
  }
  const out = [...clusters.values()].map((c) => {
    const openRows = c.rows.filter((r) => r.unitState !== 'done');
    return {
      cause: c.cause, why: c.why, authority: c.authority, primary: c.rows.filter((r) => r.causes[0] === c.cause).length,
      count: c.rows.length, open: openRows.length, units: [...new Set(openRows.map((r) => r.unit).filter(Boolean))],
      jobs: c.rows.map((r) => r.jobId), examples: c.rows.slice(-settings.rca.examples).map((r) => `${r.jobId}: ${r.summary}`),
      preserved: [...new Set(c.rows.map((r) => r.preserved).filter(Boolean))], destinations: [...new Set(openRows.flatMap((r) => r.destinations))].slice(0, 12),
      envs: [...new Set(c.rows.map((r) => r.env ?? r.liveness).filter(Boolean))],
    };
  }).sort((a, b) => b.open - a.open || b.count - a.count);
  return { schema: 'starci/rca@1', windowMs: settings.rca.windowMs, attempts: rows.length, byOp, trigger, clusters: out, rows };
}

/* ------------------------------------------------------------ decisions (the Kernel's log) */

/** The Kernel's decision log folded: [{id, hypothesis, actionKey, command, status: open|keep|revert, ...}]. */
export function decisionsOf(db, workflowId) {
  const out = new Map(); for (const e of db.prepare('SELECT kind, entity_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN (?,?) ORDER BY seq').all(workflowId, DECISION_KIND, DECISION_RESULT_KIND)) {
    const p = parse(e.payload_json); if (e.kind === DECISION_KIND) out.set(e.entity_id, { id: e.entity_id, ...p, status: 'open', at: Number(e.created_at) });
    else if (out.has(e.entity_id)) Object.assign(out.get(e.entity_id), { status: p.result, observed: p.observed ?? null, closedAt: Number(e.created_at), after: p.after ?? null });
  }
  return [...out.values()];
}

/* ------------------------------------------------------------ ranked actions */

const ESCAPED_QUOTE = String.raw`\"`, q = (s) => (/[\s,;"'[\]()]/.test(String(s)) ? `"${String(s).replaceAll('"', ESCAPED_QUOTE)}"` : String(s));
const actionKey = (...parts) => parts.join(':'), reasonSuffixOf = (item) => item.reason ? ` [${item.reason}]` : '', openCountSuffixOf = (cluster) => cluster.open !== cluster.count ? ` (${cluster.open} open)` : '';
const act = (key, tier, cause, unblocks, title, command, expected) => ({ key, tier, cause, unblocks, title, command, expected });
const repointCommandOf = (files, nextUnits, api, base) => {
  if (!files.length) return `${api} status ${base} --json   (read importsBroken.brokenFiles, then: ${api} graph-edit ${base} --edit wire --op code.refactor --paths <them> --before <the next queued units> --decision <id>)`;
  const paths = q(files.slice(0, 60).join(','));
  const before = nextUnits.length ? ` --before ${nextUnits.join(',')}` : '';
  return `${api} graph-edit ${base} --edit wire --op code.refactor --paths ${paths}${before} --decision <id>`;
};

/** The settle verdict an unsettled report's outcome maps to for starci kernel settle --verdict. */
const settleVerdictOf = (it) => {
  if (it.outcome === 'done') { return 'pass'; } if (it.outcome === 'blocked' || it.outcome === 'ask') { return 'blocked'; }
  return it.outcome ? 'fail' : '<pass|fail|blocked from its report>';
};
// 0. NEEDS-KERNEL-DECISION first (owner ruling settle-runtime-service): the runtime settled every green report; what is left
// is a judgment - a blocked/failed/ask/partial outcome, or a done report whose checks the settler could not re-verify. Each keeps its slot and its unit's verdict hostage until the Kernel decides it.
const settleBacklogAct = (progress, { api, repo }) => {
  if (!progress?.unsettledReports?.length) return null;
  const ids = progress.unsettledReports.filter(Boolean); const items = progress.settleDecisions ?? ids.map((id) => ({ jobId: id, outcome: null, reason: null }));
  return act(actionKey('settle-backlog', ids.length), 'light', 'needs-kernel-decision', 1000 + ids.length,
    `decide ${ids.length} needs-kernel-decision settle(s) BEFORE any route or dispatch (starci kernel route/dispatch refuse settle-backlog meanwhile): ${items.slice(0, 8).map((it) => it.jobId + reasonSuffixOf(it)).join(', ')}`,
    items.slice(0, 20).map((it) => (it.outcome === 'done' ? `${api} check --repo ${q(repo)} --job ${it.jobId} --checks-file <your re-run> && ` : '') + `${api} settle --repo ${q(repo)} --job ${it.jobId} --verdict ${settleVerdictOf(it)}`).join(' ; '),
    'each settle closes its [Op] terminal (verified close), frees its slot and lets the unit count or route its repair');
};
// 0b. IMPORTS_BROKEN_AFTER_MOVE (DESIGN §16.7, FMEA #20): moved code left importers on the old path and no repoint unit owns
// them. ONE wire unit owning every broken importer, before the next queued units - ranked right after the settle backlog: every later unit's checker fails on these imports until it runs.
const repointAct = ({ importsBroken, brokenCluster, units, queuedOf, N, api, base }) => {
  if (!((importsBroken?.count && !importsBroken.repointQueued) || (!importsBroken && brokenCluster?.open))) return null;
  const files = importsBroken?.brokenFiles ?? []; const nextUnits = units.flatMap((unit) => queuedOf(unit)).slice(0, N - 1).map((j) => j.job_id);
  return act(actionKey('repoint', ...(files.length ? files.slice(0, 4) : ['rca'])), 'light', 'broken-import', 500 + (importsBroken?.files ?? brokenCluster?.open ?? 1),
    importsBroken
      ? `enqueue ONE repoint unit owning the ${importsBroken.files} file(s) whose ${importsBroken.count} import(s) resolve to nothing (IMPORTS_BROKEN_AFTER_MOVE): repoint imports to the new locations; no other change`
      : `${brokenCluster.open} unit(s) failed on an unresolved import: enqueue ONE repoint unit owning the importers of the moved paths`,
    repointCommandOf(files, nextUnits, api, base),
    'the importers point at the moved code; importsBroken clears and later checkers stop failing on the old paths');
};
// 1. parallelism: the cheapest, most certain win.
const dispatchReadyAct = (progress, { api, base }) => {
  if (!(progress && progress.queuedReady > 0 && progress.running < progress.allowedParallel)) return null;
  const k = progress.allowedParallel - progress.running;
  return act(actionKey('dispatch-ready'), 'light', 'under-dispatched', k,
    `dispatch ${k} more queued-ready unit(s) (running ${progress.running} of ${progress.allowedParallel} allowed)`,
    `${api} dispatch-ready ${base} --max ${k}`, `running ${progress.running} -> ${progress.allowedParallel}; units/h rises within the next wake`);
};
/** Drop queued units whose every owned path is absent in the checkout. */
const dropAct = ({ missingQueued, N, api, base }) => {
  if (!missingQueued.length) return null;
  const drop = missingQueued.slice(0, N).map((m) => m.jobId);
  return act(actionKey('drop', ...drop), 'light', 'missing-paths', drop.length,
    `drop ${drop.length} queued unit(s) whose every owned path is absent in the checkout (${missingQueued.slice(0, N).map((m) => m.paths[0]).join(', ')})`,
    `${api} graph-edit ${base} --edit drop --jobs ${drop.join(',')} --reason "every owned path is absent in the checkout" --decision <id>`,
    'no agent spends an attempt on a unit with nothing to refactor; if the paths were meant as move targets, re-enqueue them with their sources');
};
// 2. heavy re-cut when the cut itself is wrong (missing paths + grants too narrow across many units).
const recutAct = ({ recutOp, cutWrong, cutIsWrong, openCount, settings, api, base }) => {
  if (!(cutWrong >= settings.recutThreshold && recutOp)) return null;
  const canon = recutOp.canon;
  return act(actionKey('recut', recutOp.op, recutOp.cutId), 'heavy', 'missing-paths+grant-too-narrow', cutIsWrong ? Math.max(cutWrong, openCount) : 0.5,
    canon
      ? `re-cut the remaining ${recutOp.op} units of cut ${recutOp.cutId} from a FRESH canon-scan (the goal's own cut method): ${cutWrong} unit(s) were cut on absent paths or too-narrow grants`
      : `dispatch work.author to re-cut the remaining ${recutOp.op} units of cut ${recutOp.cutId} with this RCA as its brief`,
    canon
      ? `${api} graph-edit ${base} --edit scan --op ${recutOp.op} --cut-id ${recutOp.cutId} --decision <id>   (then, when it reports done: ${api} graph-edit ${base} --edit recut --op ${recutOp.op} --cut-id ${recutOp.cutId} --from-scan <file it names> --decision <id>)`
      : `${api} redesign ${base} --op work.author --rca latest --paths <work.author write set> --decision <id>`,
    'every remaining unit owns paths that exist, grouped so moves and their consumers share a unit; the parked failed units retire');
};
/** partial-work: continue the settled units from their preserved work. */
const partialWorkActs = ({ c, us, lastFailedOf, N, api, base }) => {
  const targets = us.filter((u) => !u.open.length && lastFailedOf(u)).slice(0, N); if (!targets.length) return [];
  return [act(actionKey('continue', ...targets.map((u) => u.key)), 'light', c.cause, targets.length,
    `continue ${targets.length} unit(s) from their preserved work instead of failures (${c.preserved.slice(0, 3).join(', ')})`,
    targets.map((u) => `${api} graph-edit ${base} --edit continue --job ${lastFailedOf(u).job_id}${c.destinations.length ? ' --add-paths ' + q(c.destinations.slice(0, 4).join(',')) : ''} --decision <id>`).join(' && '),
    'the preserved in-ceiling work counts toward the unit, the continuation starts from it')];
};
/** One continue/retry act for each settled failed unit whose report names destinations beyond the shared ones, or preserved work. */
const failedUnitActs = ({ c, us, rows, shared, lastFailedOf, N, api, base }) => {
  const acts = [];
  for (const u of us.filter((u) => !u.open.length && lastFailedOf(u)).slice(0, N)) {
    const r = rows.find((x) => x.unit === u.key); const kept = Boolean(r?.preserved);
    const dest = (r?.destinations ?? []).filter((d) => !shared.includes(d)).slice(0, 4); if (!dest.length && !kept) continue;
    acts.push(act(actionKey(kept ? 'continue' : 'retry', u.key), 'light', c.cause, 1,
      `${kept ? 'continue' : 'retry'} ${u.key} with the destinations its report names${dest.length ? ' (' + dest.join(', ') + ')' : ''}`,
      `${api} graph-edit ${base} --edit ${kept ? 'continue' : 'retry'} --job ${lastFailedOf(u).job_id}${dest.length ? ' --add-paths ' + q(dest.join(',')) : ''} --decision <id>`,
      'the unit owns what its fix must touch; the api refuses the same failing shape and the paths of other workflows'));
  }
  return acts;
};
/** grant-too-narrow: ONE wire unit for the shared destinations, widen the queued units, retry or continue the failed. */
const narrowActs = ({ c, us, rows, queuedOf, lastFailedOf, N, api, base }) => {
  const acts = [];
  const shared = c.destinations.filter((d) => rows.filter((r) => r.destinations.includes(d)).length >= 2);
  const befores = us.flatMap((unit) => queuedOf(unit)).slice(0, N - 1).map((j) => j.job_id);
  if (shared.length) acts.push(act(actionKey('wire', ...shared.slice(0, 4)), 'light', c.cause, us.length,
    `add ONE serial wire unit owning the shared destinations ${shared.slice(0, 4).join(', ')} that ${us.length} unit(s) need`,
    `${api} graph-edit ${base} --edit wire --op ${us[0]?.op ?? 'code.refactor'} --paths ${q(shared.slice(0, 6).join(','))}${befores.length ? ' --before ' + befores.join(',') : ''} --decision <id>`,
    'the shared files move once, serially; the units that needed them run after it (a failed one: graph-edit retry --after <wire job>)'));
  const widen = us.filter((u) => queuedOf(u).length).slice(0, N);
  if (widen.length && c.destinations.length) acts.push(act(actionKey('widen', ...widen.map((u) => u.key)), 'light', c.cause, widen.length,
    `widen ${widen.length} queued unit(s) to the destinations their reports name`,
    widen.map((u) => `${api} graph-edit ${base} --edit widen --job ${queuedOf(u)[0].job_id} --add-paths ${q(c.destinations.slice(0, 4).join(','))} --decision <id>`).join(' && '),
    'the unit may move its files into their canonical home (leases of other workflows are refused by the api)'));
  acts.push(...failedUnitActs({ c, us, rows, shared, lastFailedOf, N, api, base }));
  return acts;
};
/** tool-timeout, or test-gap while unit specs are deferred: an op-override params edit covers either. */
const paramsAct = ({ c, us, api, base, settings }) => (c.cause === 'tool-timeout'
  ? act(actionKey('params', 'commandTimeoutMs'), 'light', c.cause, c.open,
    'give the op a longer command window and the background-run rule for long validators',
    `${api} op-override ${base} --op ${us[0]?.op ?? 'code.refactor'} --set '${JSON.stringify({ commandTimeoutMs: settings.commandTimeoutMs, notes: ['Long validators (canon-scan, gate.mjs, starci app lint) may exceed your tool window: start them in the background writing to a file, then poll that file until it is complete; never report blocked on a tool timeout.'] })}' --decision <id>`,
    'no unit blocks on a 30 s tool window; applies to every later dispatch of the op in this workflow')
  : act(actionKey('params', 'specs-unit-off'), 'light', c.cause, c.open,
    'unit tests are deferred by the owner (config.yaml specs.unit=false): tell the op to guard behaviour with typecheck + canon-scan before/after instead of stopping',
    `${api} op-override ${base} --op ${us[0]?.op ?? 'code.refactor'} --set '${JSON.stringify({ notes: ['The owner deferred unit tests (config.yaml specs.unit=false): a missing regression suite is not a blocker in this workflow. Guard behaviour with typecheck and canon-scan before and after, and list the untested seams in the report.'] })}' --decision <id>`,
    'no unit stops on a missing regression suite while unit tests are deferred'));
/** test-gap: a test.author wire unit before each unit that lacks a regression test. */
const testGapActs = ({ c, us, lastFailedOf, queuedOf, N, api, base }) => {
  const t = us.slice(0, N); if (!t.length) return [];
  return [act(actionKey('test', ...t.map((u) => u.key)), 'light', c.cause, t.length,
    `add a test.author unit before ${t.length} unit(s) that lack a regression test`,
    t.map((u) => `${api} graph-edit ${base} --edit wire --op test.author --paths ${q((lastFailedOf(u)?.payload?.owned_paths ?? []).slice(0, 3).join(','))} --before ${queuedOf(u)[0]?.job_id ?? '<the unit\'s next job>'} --decision <id>`).join(' && '),
    'the refactor unit starts with a regression test to hold parity')];
};
/** canon-conflict: a tier-2 kernel-proposal. */
const canonAct = ({ c, api, base }) => [act(actionKey('proposal', 'canon-conflict'), 'proposal', c.cause, c.open,
  'the cut asks for a location a canon rule forbids: propose the canon/cut fix (tier 2) and widen the unit to the canonical home meanwhile',
  `${api} kernel-proposal ${base} --title "cut vs canon location conflict" --evidence ${q(c.examples.join(' | ').slice(0, 400))} --decision <id>`,
  'the Supervisor lands the canon/cut fix or forwards it to the owner; the widened unit keeps moving')];
/** dead-worker / binding-defect / checker-unavailable: a runtime cause the Kernel files once, then keeps dispatching. */
const supervisorAct = ({ c, api, base }) => [act(actionKey('proposal', c.cause), 'supervisor', c.cause, c.open,
  `${c.cause} x${c.count} (${c.envs.join(', ') || 'no env'}): a runtime cause - file it once, then keep dispatching the healthy units`,
  `${api} kernel-proposal ${base} --title "${c.cause} x${c.count}" --evidence ${q((c.envs.join(',') + ' | ' + c.examples.join(' | ')).slice(0, 400))} --decision <id>`,
  'the Supervisor fixes the runtime cause; the Kernel does not retry the same shape waiting for it')];
/** upstream: the root cause lives in another workflow - message the peer. */
const upstreamAct = ({ c, api, base }) => [act(actionKey('supervisor', 'upstream'), 'supervisor', c.cause, c.open,
  'the root cause is in another workflow: message the peer and keep other units moving',
  `${api} notify ${base} --to peers --kind request --subject "root cause in your workflow" --body ${q(c.examples[0] ?? '')}`,
  'the peer fixes its side; the Supervisor watches the cross-workflow wait')];
/** The catalogue action(s) of one RCA cluster (dead-worker also fires with zero open). */
const clusterActs = (c, ctx) => {
  if (c.cause === 'partial-work') return partialWorkActs({ c, ...ctx });
  if (c.cause === 'grant-too-narrow') return narrowActs({ c, ...ctx });
  if (c.cause === 'tool-timeout' || (c.cause === 'test-gap' && unitSpecsOff())) return [paramsAct({ c, ...ctx })];
  if (c.cause === 'test-gap') return testGapActs({ c, ...ctx });
  if (c.cause === 'canon-conflict') return canonAct({ c, api: ctx.api, base: ctx.base });
  if (c.cause === 'dead-worker' || c.cause === 'binding-defect' || c.cause === 'checker-unavailable') return supervisorAct({ c, api: ctx.api, base: ctx.base });
  if (c.cause === 'upstream') return upstreamAct({ c, api: ctx.api, base: ctx.base });
  return [];
};

/**
 * The ranked candidate actions. Pure over what it is given: `progress`, `rca`, `units` (unitsOf), `workflowId`,
 * `repo`, `decisions`, `missingQueued` ([{jobId, paths}] of queued units whose every owned path is absent on disk).
 * Each: {rank, key, tier: light|heavy|proposal|supervisor, title, command, expected, unblocks, cause, tried}.
 */
export function actionsOf({ progress, rca, units = [], workflowId, repo = '<repo>', decisions = [], missingQueued = [], settings = progressSettings(), recutOp = null, importsBroken = null }) {
  const api = `starci kernel`, base = `--repo ${q(repo)} --workflow ${workflowId}`, N = settings.maxUnitsPerEdit;
  const openUnits = (keys) => units.filter((u) => keys.includes(u.key));
  const queuedOf = (u) => u.jobs.filter((j) => j.status === 'queued'), cl = new Map((rca?.clusters ?? []).map((c) => [c.cause, c]));
  const lastFailedOf = (u) => [...u.jobs].reverse().find((j) => j.status === 'failed') ?? null;
  // The cut itself is wrong when its wrong-shaped units reach recutThreshold AND a quarter of the open units: below
  // that, the light edits (drop, widen, wire) fix it without disturbing the units that are right.
  const cutWrong = (cl.get('missing-paths')?.open ?? 0) + (cl.get('grant-too-narrow')?.open ?? 0) + missingQueued.length;
  const openCount = units.filter((u) => u.state === 'open' || u.state === 'failed').length;
  const cutIsWrong = cutWrong >= Math.max(settings.recutThreshold, Math.ceil(openCount / 4));
  const acts = [
    settleBacklogAct(progress, { api, repo }),
    repointAct({ importsBroken, brokenCluster: cl.get('broken-import'), units, queuedOf, N, api, base }),
    dispatchReadyAct(progress, { api, base }),
    dropAct({ missingQueued, N, api, base }),
    recutAct({ recutOp, cutWrong, cutIsWrong, openCount, settings, api, base }),
  ].filter(Boolean);
  // 3. per cluster, the catalogue action.
  for (const c of rca?.clusters ?? []) {
    if (!c.open && c.cause !== 'dead-worker') continue;
    const rows = (rca.rows ?? []).filter((r) => r.causes.includes(c.cause) && r.unitState !== 'done');
    acts.push(...clusterActs(c, { us: openUnits(c.units), rows, queuedOf, lastFailedOf, N, api, base, settings }));
  }
  // Decision-log memory: an action tried and reverted sinks and is marked; an open one is measuring.
  const byKey = new Map(); for (const d of decisions) if (d.actionKey) byKey.set(d.actionKey, d);
  for (const a of acts) { const d = byKey.get(a.key); a.tried = d ? { decision: d.id, status: d.status } : null; }
  const tierRank = { light: 0, heavy: 1, proposal: 2, supervisor: 3 };
  acts.sort((a, b) => (a.tried?.status === 'revert') - (b.tried?.status === 'revert') || (a.tried?.status === 'open') - (b.tried?.status === 'open')
    || b.unblocks - a.unblocks || tierRank[a.tier] - tierRank[b.tier]);
  // A heavy re-cut outranks the light edits it would make moot when it unblocks more.
  acts.forEach((a, i) => { a.rank = i + 1; });
  return acts;
}
/** The `why slow` line (Vietnamese owner digest / English lines). */
export function whyLine(rca, { language = ownerLanguage(), limit = 5 } = {}) {
  const cls = (rca?.clusters ?? []).filter((c) => c.open || c.cause === 'dead-worker').slice(0, limit); if (!cls.length) return null;
  return `${translator(language)('Why slow')}: ${cls.map((c) => c.cause + ' x' + c.count + openCountSuffixOf(c)).join(', ')}`;
}

/** A stable id for one RCA snapshot (clusters + counts). */
const rcaDigest = (rca) => crypto.createHash('sha1').update(JSON.stringify((rca?.clusters ?? []).map((c) => [c.cause, c.count, c.open]))).digest('hex').slice(0, 10);

/* ------------------------------------------------------------ the whole view */

/**
 * The cut to re-cut: the op|cut.id with the most open or failed units. {op, cutId, canon, units}. Pure.
 */
function recutTargetOf(units) {
  const byCut = new Map();
  for (const u of units) {
    if (!u.cut?.id || u.state === 'done' || u.state === 'dropped') continue;
    const k = `${u.op}|${u.cut.id}`; if (!byCut.has(k)) byCut.set(k, { op: u.op, cutId: u.cut.id, canon: Boolean(u.last?.payload?.params?.canonFamilies), units: 0 });
    byCut.get(k).units += 1;
  }
  return [...byCut.values()].sort((a, b) => b.units - a.units)[0] ?? null;
}

/**
 * Queued, never-dispatched units whose every owned path is absent on disk: [{jobId, paths}]. `resolve(job)` maps a
 * job to absolute paths (null when it cannot tell - such a unit is never called missing).
 */
function missingQueuedOf(units, resolve) {
  // A path a running unit of this workflow owns (or sits under/over) may be created by it: never called missing.
  const out = [], low = (p) => String(p).replaceAll('\\', '/').toLowerCase();
  const running = units.flatMap((u) => u.jobs.filter((j) => SLOT_STATUSES.includes(j.status))).flatMap((j) => (j.payload?.owned_paths ?? []).map(low));
  const near = (p) => running.some((r) => r === p || r.startsWith(`${p}/`) || p.startsWith(`${r}/`) || r.split('/').slice(0, -1).join('/') === p.split('/').slice(0, -1).join('/'));
  for (const u of units) for (const j of u.jobs.filter((x) => x.status === 'queued' && !(x.payload?.after ?? []).length)) {
      if ((j.payload?.owned_paths ?? []).some((p) => near(low(p)))) continue;
      let abs = null; try { abs = resolve(j); } catch { abs = null; }
      if (Array.isArray(abs) && abs.length && abs.every((p) => p && !fs.existsSync(p))) out.push({ jobId: j.job_id, paths: j.payload?.owned_paths ?? [] });
  }
  return out;
}

/**
 * progress + rca + ranked actions for one workflow, from its ledger. `resolve` as in missingQueuedOf.
 * {progress, rca, actions}.
 */
export function workflowView({ db, workflowId, core = {}, repo, now = Date.now(), settings = progressSettings(), resolve = null }) {
  const wf = db.prepare('SELECT created_at FROM workflows WHERE workflow_id=?').get(workflowId), jobs = opJobsOf(db, workflowId);
  let kernelItems = null; try { kernelItems = kernelDecisionItems(db, workflowId, { now, ageMs: settings.settleBacklog.ageMs }); } catch { kernelItems = null; }
  const progress = progressOf({ jobs, core, workflowId, createdAt: wf?.created_at ?? null, now, settings, kernelItems });
  const reports = reportsOf(db, workflowId);
  const rca = rcaOf({ jobs, reports, now, settings, stalled: progress.stall.stalled }), units = unitsOf(jobs);
  const missingQueued = resolve ? missingQueuedOf(units, resolve) : [], decisions = decisionsOf(db, workflowId);
  let importsBroken = null; try { importsBroken = repo ? importsBrokenOf({ db, workflowId, repo, now }) : null; } catch { importsBroken = null; }
  const actions = actionsOf({ progress, rca, units, workflowId, repo, decisions, missingQueued, settings, recutOp: recutTargetOf(units), importsBroken });
  // DECISIONS FIRST: the oldest open Kernel Decision Item is the top action, in copy-paste form (route, dispatch, enqueue
  // and dispatch-ready refuse decisions-first meanwhile; scripts/machine/decisions.mjs).
  try {
    const blocking = blockingDecisions(db, workflowId, { now });
    if (blocking.length) {
      const top = resolutionOf(db, blocking[0], { repo: repo ?? '<repo>', now });
      actions.unshift({ key: `decisions-first|${top.id}`, tier: 'light', cause: 'decisions-first', unblocks: 2000 + blocking.length, decisionItem: top.id,
        title: `DECIDE ${top.id} FIRST (${blocking.length} open Decision Item(s); route/dispatch/enqueue refuse decisions-first): ${top.what}`,
        command: [top.decide, ...top.commands.map((c) => c.run), top.resolve].filter(Boolean).join(' ; '),
        options: top.commands, decide: top.decide, resolve: top.resolve,
        expected: `${top.id} resolved; the unit moves and new work is admitted again` });
    }
  } catch { /* the ranked actions stand without it */ }
  const { rows, ...rcaOut } = rca;
  return { progress, rca: { ...rcaOut, id: rcaDigest(rca), why: whyLine(rca, { language: 'en' }), missingQueued, actions,
    decisions: decisions.slice(-8).map((d) => ({ id: d.id, actionKey: d.actionKey ?? null, status: d.status, hypothesis: one(d.hypothesis, 120), observed: d.observed ? one(d.observed, 120) : null })) } };
}

/** The Kernel notice for one stalled workflow (the Workflow controller's progress-stall DI text). Pure. */
export function stallNotice(w, { lang = ownerLanguage() } = {}) {
  const p = w.progress, r = w.rca, tr = translator(lang), top = (r?.actions ?? []).find((a) => !a.tried) ?? null;
  return [
    `PROGRESS-STALL ${p.stall.sinceMin}m: ${p.stall.reasons.join('; ')}.`,
    r ? `${whyLine(r, { language: lang }) ?? ''}` : '',
    p.queuedReady > 0 && p.running < p.allowedParallel ? tr('Run now: starci kernel dispatch-ready --workflow {wf} (running {running}/{allowed}, {ready} ready).', { wf: w.workflowId, running: p.running, allowed: p.allowedParallel, ready: p.queuedReady }) : '',
    top ? tr('Action #{rank} [{tier}] {title}. Log: starci kernel decide --workflow {wf} --hypothesis "..." --action-key {key} --metric "units/h". Run: {command}', { rank: top.rank, tier: top.tier, title: top.title, wf: w.workflowId, key: top.key, command: top.command }) : '',
    'driver-loop.yaml progress: FIRST DUTY every wake.',
  ].filter(Boolean).join(' ');
}
