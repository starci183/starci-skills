#!/usr/bin/env node
// op-metrics.mjs — op health and the stuck SLA (owner, 2026-09-28: "upgrade supervisor to track properly": op health
// measurable, stuck items impossible to miss).
//
// OP HEALTH. Per op and per workflow over a window (runtimes.yaml allocation.opTelemetry.windowMs), from ledger rows
// only (jobs, events, reports, checks), read-only:
//   jobs                op jobs created or updated inside the window
//   successRate         succeeded / (succeeded + failed); an owner ask (verdict awaiting-owner), a dropped or
//                       cancelled job and an open job are neither
//   failureClasses      one class per failed job, first that holds: environment:host-terminal-wipe (a host-wide
//                       terminal loss), dead-worker:<liveness> (the worker died without a report),
//                       <settle class>[:<category or check>] (result_json.failureClass that
//                       scripts/kernel/verify-failure.mjs records: environment|tool|findings|product|deterministic|
//                       transient), root-cause:<category> (the report's rootCause), check:<name> (a failing check
//                       row of the attempt), blocked:<blocker kind> (report outcome blocked, verdict-contract.yaml
//                       blocker.kind), verdict:<verdict>
//   queueWait           op-dispatched - enqueued (the first dispatch), median and p90
//   runTime             report-filed (else op-settled) - the last dispatch before it
//   settleTime          op-settled - report-filed: how long the Kernel took to settle a filed report
//   attemptsPerNode     jobs per retry chain (payload.retry.retryOf followed to its root): mean and max
//   repeatedIdentical   failed attempts whose failure signature equals the previous failed attempt of the chain
//   deadWorkerRate      dispatched jobs with a dead-worker-* / worker-failed-no-report event
//   ownerWait           settled ask (result.askDispatchId) -> ask-answered / ask-superseded (open: now)
//   throttle            first dispatch-rejected -> the dispatch (open: now): time the runtime could not launch it
// Failure classes are this file's own; a sibling classification (owed.mjs patterns, actions.mjs classes) reads
// them by `failureClassOf`, never re-derives them.
//
// STUCK SLA. Every wait a running workflow holds gets an age (`stuckOf`, called by `starci kernel status`, which owns the
// frontier it reads): owner-gate (an open owner gate, a pending owner ask, or an autopilot supervisor-gate), peer-wait, dependency, retry-cap (a
// retry route fired its limit and handed the job to an owner gate), deferred-settle (a consumed report not settled,
// or a settle held behind a wait), queued-ready (a queued job nothing holds), throttled (pool-full, circuit-open,
// max-ops, path-lease). Past runtimes.yaml allocation.opTelemetry.stuckSla.<kind>.warnMs it is severity warn, past
// criticalMs severity critical; either is a Supervisor owed action (`stuckOwedItems`), the tick lists each and
// alerts the critical ones. Each item names the owner of the next action: owner | kernel | peer:<workflow> |
// supervisor.
//
// TREND. The supervisor tick records one `supervisor-op-metrics` event per run (the totals, per-op rows, stuck
// counts); `trendLine` compares the newest with the one closest to trendMs earlier and the owner digest
// (stall-alert.mjs ownerDigest) carries that one line.
//
//   starci machine op-metrics [--repo <path>]... [--window-ms <ms>] [--by op|workflow] [--json]
//   starci machine op-metrics --trend [--json]      the newest snapshots and the trend line
import path from 'node:path';
import { fullJson } from '../../engine/db/machine.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { fmtMs } from '../lib/time.mjs';
import { clipLine } from '../lib/clip.mjs'; import { isMain } from '../lib/is-main.mjs'; import { byCodeUnit } from '../lib/list.mjs';

export const SNAPSHOT_KIND = 'supervisor-op-metrics';
/** metrics_snapshots.kind of these snapshots (DBTREE B6). */
const METRICS_KIND = 'op-health';
export const WAIT_KINDS = Object.freeze(['owner-gate', 'peer-wait', 'dependency', 'retry-cap', 'deferred-settle', 'queued-ready', 'throttled']);
export const SEVERITIES = Object.freeze(['ok', 'warn', 'critical']);
/** queuedBecause values that are the runtime's capacity, not the workflow's own order. */
const THROTTLE_CAUSES = Object.freeze(['pool-full', 'circuit-open', 'max-ops', 'path-lease']);
const JOB_EVENT_KINDS = ['op-dispatched', 'report-filed', 'op-settled', 'dispatch-rejected', 'dead-worker-requeued', 'dead-worker-fenced', 'worker-failed-no-report'];
const DEAD_KINDS = new Set(['dead-worker-requeued', 'dead-worker-fenced', 'worker-failed-no-report']);
const OPEN_STATUSES = new Set(['queued', 'leased', 'running', 'answering', 'effect_unknown']);

/* ------------------------------------------------------------ settings */

/** allocation.opTelemetry, every number checked: {windowMs, trendMs, stuckSla: {<kind>: {warnMs, criticalMs}}}. */
export function telemetrySettings(allocation = allocationSettings()) {
  const t = allocation?.opTelemetry;
  const need = (value, dotted) => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`modules/models/runtimes.yaml allocation.opTelemetry.${dotted} must be a positive number`);
    return n;
  };
  const stuckSla = {};
  for (const kind of WAIT_KINDS) {
    const warnMs = need(t?.stuckSla?.[kind]?.warnMs, `stuckSla.${kind}.warnMs`);
    const criticalMs = need(t?.stuckSla?.[kind]?.criticalMs, `stuckSla.${kind}.criticalMs`);
    if (criticalMs < warnMs) throw new Error(`modules/models/runtimes.yaml allocation.opTelemetry.stuckSla.${kind}.criticalMs must be >= warnMs`);
    stuckSla[kind] = { warnMs, criticalMs };
  }
  return { windowMs: need(t?.windowMs, 'windowMs'), trendMs: need(t?.trendMs, 'trendMs'), stuckSla };
}

/* ------------------------------------------------------------ small pure pieces */

/** Nearest-rank percentile of `values` (numbers), or null when empty. */
export function percentile(values, p) {
  const list = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  return list[Math.min(list.length - 1, Math.max(0, Math.ceil((p / 100) * list.length) - 1))];
}
const dist = (values) => ({ n: values.filter(Number.isFinite).length, p50: percentile(values, 50), p90: percentile(values, 90) });
const span = (from, to) => (Number.isFinite(from) && Number.isFinite(to) && to >= from ? to - from : null);

export { fmtMs };
const pct = (rate) => (rate == null ? '-' : `${Math.round(rate * 100)}%`);

/** severity of a wait of `ageMs` against {warnMs, criticalMs}. */
export const severityOf = (ageMs, sla) => (ageMs >= sla.criticalMs ? 'critical' : ageMs >= sla.warnMs ? 'warn' : 'ok');

/**
 * The failure class of one failed op job (see the header), or null when it did not fail. `result` is the job's
 * result_json, `report` its filed report envelope (or null), `checks` its check rows ([{name, exitCode, ok?}]),
 * `dead` the liveness of a dead-worker event of the job (or null).
 */
export function failureClassOf({ status, result = {}, report = null, checks = [], dead = null }) {
  if (status !== 'failed') return null;
  const verdict = result?.verdict ?? null;
  if (verdict === 'dropped' || verdict === 'superseded') return null;
  if (result?.environment === 'host-terminal-wipe') return 'environment:host-terminal-wipe';
  const liveness = result?.worker?.liveness ?? (report ? null : dead);
  if (liveness && !report) return `dead-worker:${liveness}`;
  const category = typeof report?.rootCause?.category === 'string' && report.rootCause.category.trim() ? report.rootCause.category.trim().toLowerCase() : null;
  const red = checks.filter((c) => c && (c.ok === false || (c.exitCode != null && Number(c.exitCode) !== 0))).map((c) => String(c.name ?? 'unnamed')).sort(byCodeUnit);
  // The settle's own class (scripts/kernel/verify-failure.mjs: result_json.failureClass {class, reason}, or the
  // report's failureClass) leads, narrowed by the root-cause category or the red check.
  const settled = typeof result?.failureClass?.class === 'string' ? result.failureClass.class
    : typeof result?.failureClass === 'string' ? result.failureClass : typeof report?.failureClass === 'string' ? report.failureClass : null;
  if (settled) return `${settled}${category ? `:${category}` : red.length ? `:${red[0]}` : ''}`;
  if (category) return `root-cause:${category}`;
  if (red.length) return `check:${red[0]}`;
  if (Number(result?.checkEvidence?.failed) > 0) return 'check:unnamed';
  if (report?.outcome === 'blocked' || verdict === 'blocked') return typeof report?.blocker?.kind === 'string' && report.blocker.kind.trim() ? `blocked:${report.blocker.kind.trim().toLowerCase()}` : 'blocked';
  if (!report && result?.reportFiled === false) return 'no-report';
  return `verdict:${verdict ?? 'unknown'}`;
}

/** One failed attempt's signature: its class plus every red check name, so two attempts failing alike compare equal. */
export const failureSignature = (klass, checks = []) => [klass, ...checks.filter((c) => c && (c.ok === false || (c.exitCode != null && Number(c.exitCode) !== 0))).map((c) => String(c.name ?? '')).sort(byCodeUnit)].join('|');

/* ------------------------------------------------------------ per-job records */

const inList = (n) => Array.from({ length: n }, () => '?').join(',');

/**
 * One normalized record per op job created or updated inside [since, now] (optionally of one workflow): {jobId,
 * workflowId, op, attempt, status, verdict, outcome (succeeded|failed|owner|dropped|cancelled|open), failureClass,
 * signature, retryOf, enqueuedAt, dispatchedAt, reportAt, settledAt, queueWaitMs, runMs, settleMs, throttleMs,
 * ownerWaitMs, dead}. Read-only.
 */
export function jobRecords(db, { since, now = Date.now(), workflowId = null } = {}) {
  const jobs = db.prepare(`SELECT job_id, workflow_id, op_id, attempt, status, payload_json, result_json, created_at, updated_at FROM jobs
    WHERE kind='op' AND (created_at>=? OR updated_at>=?)${workflowId ? ' AND workflow_id=?' : ''}`).all(since, since, ...(workflowId ? [workflowId] : []));
  if (!jobs.length) return [];
  const from = Math.min(...jobs.map((j) => Number(j.created_at)));
  const byJob = new Map();
  const events = db.prepare(`SELECT entity_id, kind, payload_json, created_at FROM events WHERE entity_type='job' AND kind IN (${inList(JOB_EVENT_KINDS.length)}) AND created_at>=?${workflowId ? ' AND workflow_id=?' : ''} ORDER BY seq`)
    .all(...JOB_EVENT_KINDS, from, ...(workflowId ? [workflowId] : []));
  for (const e of events) {
    if (!byJob.has(e.entity_id)) byJob.set(e.entity_id, []);
    byJob.get(e.entity_id).push(e);
  }
  const reports = new Map();
  for (const r of db.prepare(`SELECT workflow_id, op_id, attempt, outcome, report_json, created_at FROM reports WHERE created_at>=?${workflowId ? ' AND workflow_id=?' : ''} ORDER BY created_at`).all(from, ...(workflowId ? [workflowId] : []))) {
    reports.set(`${r.workflow_id}|${r.op_id}|${r.attempt}`, { outcome: r.outcome, at: Number(r.created_at), ...parseJsonOr(r.report_json, {}) });
  }
  const checks = new Map();
  for (const c of db.prepare(`SELECT workflow_id, op_id, attempt, checks_json FROM checks WHERE created_at>=?${workflowId ? ' AND workflow_id=?' : ''}`).all(from, ...(workflowId ? [workflowId] : []))) {
    const list = parseJsonOr(c.checks_json, {})?.checks;
    if (Array.isArray(list)) checks.set(`${c.workflow_id}|${c.op_id}|${c.attempt}`, [...(checks.get(`${c.workflow_id}|${c.op_id}|${c.attempt}`) ?? []), ...list]);
  }
  const asks = new Map();
  for (const a of db.prepare(`SELECT entity_id, kind, created_at FROM events WHERE entity_type='report' AND kind IN ('ask-answered','ask-superseded') AND created_at>=?${workflowId ? ' AND workflow_id=?' : ''} ORDER BY seq`).all(from, ...(workflowId ? [workflowId] : []))) {
    if (!asks.has(a.entity_id)) asks.set(a.entity_id, Number(a.created_at));
  }

  return jobs.map((job) => {
    const payload = parseJsonOr(job.payload_json, {});
    const result = parseJsonOr(job.result_json, {});
    const evs = byJob.get(job.job_id) ?? [];
    const first = (kind) => evs.find((e) => e.kind === kind) ?? null;
    const dispatches = evs.filter((e) => e.kind === 'op-dispatched').map((e) => Number(e.created_at));
    const key = `${job.workflow_id}|${job.op_id}|${job.attempt}`;
    const report = reports.get(key) ?? null;
    const reportAt = Number(first('report-filed')?.created_at ?? report?.at) || null;
    const settledEv = first('op-settled');
    const settledAt = Number(settledEv?.created_at ?? (OPEN_STATUSES.has(job.status) ? Number.NaN : result.at)) || null;
    const verdict = result.verdict ?? parseJsonOr(settledEv?.payload_json, {})?.verdict ?? null;
    const deadEv = evs.find((e) => DEAD_KINDS.has(e.kind));
    const dead = deadEv ? (parseJsonOr(deadEv.payload_json, {})?.worker?.liveness ?? parseJsonOr(deadEv.payload_json, {})?.liveness ?? 'dead') : null;
    const outcome = job.status === 'succeeded' ? 'succeeded'
      : job.status === 'awaiting_owner' ? 'owner'
        : job.status === 'failed' ? (['dropped', 'superseded'].includes(verdict) ? 'dropped' : 'failed')
          : job.status === 'cancelled' ? 'cancelled' : 'open';
    const jobChecks = checks.get(key) ?? [];
    const failureClass = outcome === 'failed' ? failureClassOf({ status: job.status, result, report, checks: jobChecks, dead }) : null;
    const dispatchedAt = dispatches[0] ?? null;
    const runStart = [...dispatches].reverse().find((t) => t <= (reportAt ?? settledAt ?? Infinity)) ?? dispatchedAt;
    const rejectAt = Number(first('dispatch-rejected')?.created_at) || null;
    const askId = result.askDispatchId ?? (report?.outcome === 'ask' ? report?.dispatch ?? null : null);
    const askStart = settledAt ?? reportAt;
    return {
      jobId: job.job_id, workflowId: job.workflow_id, op: job.op_id ?? payload.opId ?? '-', attempt: job.attempt, status: job.status, verdict, outcome,
      failureClass, signature: failureClass ? failureSignature(failureClass, jobChecks) : null,
      retryOf: payload.retry?.retryOf ?? null,
      enqueuedAt: Number(job.created_at), dispatchedAt, reportAt, settledAt,
      queueWaitMs: span(Number(job.created_at), dispatchedAt),
      runMs: span(runStart, reportAt ?? settledAt),
      settleMs: span(reportAt, settledAt),
      throttleMs: rejectAt ? span(rejectAt, dispatches.find((t) => t > rejectAt) ?? (outcome === 'open' ? now : settledAt)) : null,
      ownerWaitMs: askId && askStart ? span(askStart, asks.get(askId) ?? now) : null,
      dead: Boolean(deadEv),
    };
  });
}

/* ------------------------------------------------------------ aggregation */

/** The root job id of every record's retry chain (retryOf followed through `records`; an unknown parent is the root). */
function chainRoots(records) {
  const byId = new Map(records.map((r) => [r.jobId, r]));
  const root = new Map();
  const find = (r, seen = new Set()) => {
    if (root.has(r.jobId)) return root.get(r.jobId);
    if (!r.retryOf || seen.has(r.jobId)) return r.retryOf ?? r.jobId;
    seen.add(r.jobId);
    const parent = byId.get(r.retryOf);
    const value = parent ? find(parent, seen) : r.retryOf;
    root.set(r.jobId, value);
    return value;
  };
  for (const r of records) root.set(r.jobId, find(r));
  return root;
}

/** One health row over `records` (any grouping): see the header for each field. Pure. */
function healthRow(key, records) {
  const count = (o) => records.filter((r) => r.outcome === o).length;
  const succeeded = count('succeeded'), failed = count('failed');
  const classes = new Map();
  for (const r of records) if (r.failureClass) classes.set(r.failureClass, (classes.get(r.failureClass) ?? 0) + 1);
  const failureClasses = [...classes].map(([klass, n]) => ({ class: klass, n })).sort((a, b) => b.n - a.n || a.class.localeCompare(b.class));
  const roots = chainRoots(records);
  const chains = new Map();
  for (const r of [...records].sort((a, b) => a.attempt - b.attempt || a.enqueuedAt - b.enqueuedAt)) {
    const k = `${r.workflowId}|${roots.get(r.jobId)}`;
    if (!chains.has(k)) chains.set(k, []);
    chains.get(k).push(r);
  }
  let repeated = 0;
  for (const list of chains.values()) {
    let last = null;
    for (const r of list) {
      if (r.outcome !== 'failed') { if (r.outcome === 'succeeded') { last = null; } continue; }
      if (last && r.signature === last) repeated++;
      last = r.signature;
    }
  }
  const sizes = [...chains.values()].map((l) => l.length);
  const dispatched = records.filter((r) => r.dispatchedAt != null);
  const owner = records.map((r) => r.ownerWaitMs).filter(Number.isFinite);
  const throttle = records.map((r) => r.throttleMs).filter(Number.isFinite);
  return {
    key, jobs: records.length, succeeded, failed, owner: count('owner'), dropped: count('dropped') + count('cancelled'), open: count('open'),
    successRate: succeeded + failed ? succeeded / (succeeded + failed) : null,
    failureClasses, topFailureClass: failureClasses[0]?.class ?? null,
    queueWait: dist(records.map((r) => r.queueWaitMs)), runTime: dist(records.map((r) => r.runMs)), settleTime: dist(records.map((r) => r.settleMs)),
    attemptsPerNode: { nodes: sizes.length, mean: sizes.length ? Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * 100) / 100 : null, max: sizes.length ? Math.max(...sizes) : null },
    repeatedIdentical: repeated,
    deadWorkerRate: dispatched.length ? records.filter((r) => r.dead).length / dispatched.length : null,
    ownerWait: { n: owner.length, totalMs: owner.reduce((a, b) => a + b, 0), p50: percentile(owner, 50) },
    throttle: { n: throttle.length, totalMs: throttle.reduce((a, b) => a + b, 0), p50: percentile(throttle, 50) },
  };
}

/** {schema, at, windowMs, totals, ops[], workflows[]} over `records` (one or several ledgers' jobRecords). Pure. */
export function aggregate(records, { now = Date.now(), windowMs } = {}) {
  const group = (by) => {
    const m = new Map();
    for (const r of records) { const k = r[by]; if (!m.has(k)) { m.set(k, []); } m.get(k).push(r); }
    return [...m].map(([k, list]) => healthRow(k, list)).sort((a, b) => b.jobs - a.jobs || String(a.key).localeCompare(String(b.key)));
  };
  return { schema: 'starci/op-metrics@1', at: now, windowMs, totals: healthRow('all', records), ops: group('op'), workflows: group('workflowId') };
}

/** Op health of one ledger (or one workflow of it) over the window. */
export function opMetrics(db, { now = Date.now(), windowMs = telemetrySettings().windowMs, workflowId = null } = {}) {
  return aggregate(jobRecords(db, { since: now - windowMs, now, workflowId }), { now, windowMs });
}

/* ------------------------------------------------------------ stuck SLA */

const incidentRaisedAt = (db, workflowId, incidentId) => Number(db.prepare(
  "SELECT MIN(created_at) at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised'").get(workflowId, incidentId)?.at) || null;
const firstJobEventAt = (db, jobId, kinds) => Number(db.prepare(
  `SELECT MAX(created_at) at FROM events WHERE entity_type='job' AND entity_id=? AND kind IN (${inList(kinds.length)})`).get(jobId, ...kinds)?.at) || null;
const ASK_NAMED = /\bask\b|\bctx_[0-9a-f]{12}\b|\bserve-ask\b/i;

/**
 * Every wait of one workflow with its age, severity and the owner of the next action, from what `starci kernel status`
 * already projected: `ownerGates` / `peerWaits` (open incidents), `queued` (frontier.queued with queuedBecause and
 * blockedBy), `heldSettle` (frontier.heldSettleJobs), `settleReady` (job ids whose report is consumed and not
 * settled), `awaitingOwner` (status.awaitingOwner). `jobs` are the workflow's job rows (read when omitted). Returns
 * [{key, workflowId, kind, cause, jobId, opId, incidentId, since, ageMs, severity, owner, blockedBy, count, detail}],
 * critical first, then oldest first. A dependency item is keyed by the job waited on and counts its dependants.
 * Read-only.
 */
export function stuckOf({ db, workflowId, now = Date.now(), sla = telemetrySettings().stuckSla, ownerGates = [], peerWaits = [], queued = [], heldSettle = [], settleReady = [], awaitingOwner = [], jobs = null }) {
  const out = [];
  jobs ??= db.prepare("SELECT job_id, op_id, status, result_json, created_at, updated_at FROM jobs WHERE workflow_id=? AND kind<>'kernel'").all(workflowId);
  const jobRow = new Map(jobs.map((j) => [j.job_id, j]));
  const push = (item) => {
    const since = Number(item.since) || now;
    const ageMs = Math.max(0, now - since);
    const id = item.kind === 'deferred-settle' ? item.jobId : item.incidentId ?? item.jobId;
    out.push({ key: `stuck:${workflowId}:${item.kind}:${id}`, workflowId, cause: item.kind, jobId: null, opId: null, incidentId: null, blockedBy: null, count: 1, ...item,
      since, ageMs, severity: severityOf(ageMs, sla[item.kind]), detail: clipLine(item.detail ?? '', 240) });
  };
  // Retry caps: a failed job whose retry route reached its limit and handed the next step to an owner gate.
  const capped = new Map();
  for (const j of jobs) {
    if (j.status !== 'failed') continue;
    const step = parseJsonOr(j.result_json, {})?.nextStep;
    if (step?.kind === 'owner-gate' && step.route && step.incidentId) capped.set(step.incidentId, { job: j, step });
  }
  const pendingAsks = awaitingOwner.filter((a) => (a.answer ?? 'pending') === 'pending');
  for (const gate of ownerGates) {
    const cap = capped.get(gate.incidentId);
    if (cap) {
      push({ kind: 'retry-cap', incidentId: gate.incidentId, jobId: cap.job.job_id, opId: cap.job.op_id ?? null, since: Number(parseJsonOr(cap.job.result_json, {})?.at) || incidentRaisedAt(db, workflowId, gate.incidentId) || cap.job.updated_at,
        owner: 'supervisor', detail: `route ${cap.step.route} fired ${cap.step.firing ?? '?'} of ${cap.step.limit ?? '?'}: diagnose the root cause before anything runs it again` });
      continue;
    }
    // Autopilot (scripts/kernel/autopilot-run.mjs): a supervisor-gate is the Supervisor's step, never the owner's.
    if (gate.kind === 'supervisor-gate') {
      push({ kind: 'owner-gate', cause: 'supervisor-gate', incidentId: gate.incidentId, opId: gate.opId ?? null, since: incidentRaisedAt(db, workflowId, gate.incidentId), owner: 'supervisor', detail: gate.detail ?? '' });
      continue;
    }
    const holds = Array.isArray(gate.holds) ? gate.holds : [];
    const asked = ASK_NAMED.test(gate.detail ?? '') || pendingAsks.some((a) => holds.includes(a.jobId) || (a.opId && holds.includes(a.opId)));
    push({ kind: 'owner-gate', incidentId: gate.incidentId, opId: gate.opId ?? null, since: incidentRaisedAt(db, workflowId, gate.incidentId), owner: asked ? 'owner' : 'supervisor',
      detail: `${asked ? '' : 'no owner ask names it: '}${gate.detail ?? ''}` });
  }
  for (const ask of pendingAsks) {
    const job = jobRow.get(ask.jobId);
    const since = Number(parseJsonOr(job?.result_json, {})?.at) || Number(job?.updated_at) || null;
    push({ kind: 'owner-gate', cause: 'owner-ask', jobId: ask.jobId, opId: ask.opId ?? null, since, owner: 'owner', detail: `ask ${ask.dispatchId ?? '-'} unanswered` });
  }
  for (const wait of peerWaits) {
    push({ kind: 'peer-wait', incidentId: wait.incidentId, opId: wait.opId ?? null, since: wait.since ?? incidentRaisedAt(db, workflowId, wait.incidentId),
      owner: wait.peerRunning === false ? 'kernel' : `peer:${wait.peer ?? '?'}`, blockedBy: wait.peer ? { workflow: wait.peer } : null,
      detail: `${wait.peerRunning === false ? `peer ${wait.peer} is ${wait.peerPhase ?? 'gone'}, re-point the wait: ` : ''}${wait.detail ?? ''}` });
  }
  for (const item of heldSettle) {
    const since = firstJobEventAt(db, item.jobId, ['report-consumed', 'report-filed']) ?? Number(jobRow.get(item.jobId)?.updated_at);
    const byGate = item.heldBecause === 'owner-gate' || item.heldBecause === 'supervisor-gate';
    push({ kind: 'deferred-settle', cause: `held-${item.heldBecause}`, jobId: item.jobId, opId: item.opId ?? null, incidentId: item.blockedBy?.incident ?? null, since,
      owner: byGate ? (out.find((i) => i.incidentId === item.blockedBy?.incident && ['owner-gate', 'retry-cap'].includes(i.kind))?.owner ?? 'supervisor') : `peer:${item.blockedBy?.peer ?? '?'}`, blockedBy: item.blockedBy ?? null, detail: item.detail });
  }
  for (const jobId of settleReady) {
    const job = jobRow.get(jobId);
    push({ kind: 'deferred-settle', cause: 'settle-ready', jobId, opId: job?.op_id ?? null, since: firstJobEventAt(db, jobId, ['report-consumed', 'report-filed']) ?? Number(job?.updated_at),
      owner: 'kernel', detail: 'report consumed, not settled: starci kernel record-checks + starci kernel settle' });
  }
  // Who moves each queued job: a job a gate or wait holds is that item's owner; a dependency is whoever moves the
  // job it waits on (followed through the chain), so N dependants of one held job are ONE item naming that owner.
  const gateOwner = new Map(out.filter((i) => i.incidentId).map((i) => [i.incidentId, i.owner]));
  const byJob = new Map(queued.map((q) => [q.jobId, q]));
  const ownerOfJob = (jobId, seen = new Set()) => {
    const q = byJob.get(jobId);
    if (!q || seen.has(jobId)) return 'kernel';
    seen.add(jobId);
    if (['owner-gate', 'supervisor-gate', 'peer-wait'].includes(q.queuedBecause)) return gateOwner.get(q.blockedBy?.incident) ?? (q.queuedBecause === 'peer-wait' ? `peer:${q.blockedBy?.peer ?? '?'}` : q.queuedBecause === 'supervisor-gate' ? 'supervisor' : 'owner');
    if (q.queuedBecause === 'dependency' && q.blockedBy?.job) return ownerOfJob(q.blockedBy.job, seen);
    if (THROTTLE_CAUSES.includes(q.queuedBecause)) return 'supervisor';
    return 'kernel';
  };
  const deps = new Map();
  for (const q of queued) {
    const job = jobRow.get(q.jobId);
    const since = Number(job?.updated_at ?? job?.created_at) || null;
    const because = q.queuedBecause;
    if (['owner-gate', 'supervisor-gate', 'peer-wait'].includes(because)) continue; // the gate / wait itself is the item
    // Parked for the owner's one review at handover by design (autopilot): not a wait anyone owes a move on now.
    if (because === 'deferred' || because === 'deferred-to-handover') continue;
    if (because === 'dependency') {
      const blocker = q.blockedBy?.job ?? q.blockedBy?.op ?? q.jobId;
      const at = Number(job?.created_at) || since || now;
      const held = deps.get(blocker);
      if (held) { held.count++; held.dependants.push(q.jobId); held.since = Math.min(held.since, at); continue; }
      const parked = q.parkedBehind;
      deps.set(blocker, { kind: 'dependency', jobId: q.blockedBy?.job ?? q.jobId, opId: q.blockedBy?.op ?? q.opId ?? null, since: at, count: 1, dependants: [q.jobId],
        owner: parked ? (parked.heldBecause === 'peer-wait' ? `peer:${parked.peer ?? '?'}` : gateOwner.get(parked.incident) ?? 'owner') : q.blockedBy?.job ? ownerOfJob(q.blockedBy.job) : 'kernel',
        blockedBy: q.blockedBy ?? null, detail: q.detail });
    } else if (because === 'dependency-failed') {
      push({ kind: 'queued-ready', cause: because, jobId: q.jobId, opId: q.opId ?? null, since, owner: 'kernel', blockedBy: q.blockedBy ?? null, detail: q.detail });
    } else if (THROTTLE_CAUSES.includes(because)) {
      push({ kind: 'throttled', cause: because, jobId: q.jobId, opId: q.opId ?? null, since, owner: 'supervisor', blockedBy: q.blockedBy ?? null, detail: q.detail });
    } else {
      push({ kind: 'queued-ready', cause: because ?? 'ready', jobId: q.jobId, opId: q.opId ?? null, since, owner: 'kernel', detail: q.detail ?? 'ready: route and dispatch it' });
    }
  }
  for (const d of deps.values()) {
    const { dependants, ...item } = d;
    push({ ...item, detail: `${dependants.length} job(s) wait on ${d.jobId}${d.opId ? ` (${d.opId})` : ''}: ${dependants.slice(0, 4).join(', ')}${dependants.length > 4 ? ', ...' : ''}; ${d.detail ?? ''}` });
  }
  const rank = { critical: 2, warn: 1, ok: 0 };
  return out.sort((a, b) => rank[b.severity] - rank[a.severity] || b.ageMs - a.ageMs);
}

/** Stuck items past their SLA as Supervisor owed actions (owed.mjs item shape plus severity). Pure. */
export const stuckOwedItems = (stuck, { repo = null } = {}) => stuck.filter((s) => s.severity !== 'ok').map((s) => ({
  key: s.key, class: 'supervisor', kind: `stuck-${s.kind}`, workflowId: s.workflowId, repo, severity: s.severity, owner: s.owner,
  incidentId: s.incidentId, jobId: s.jobId, raisedAt: s.since, ageMin: Math.round(s.ageMs / 60_000),
  summary: `${s.kind}${s.cause && s.cause !== s.kind ? ` (${s.cause})` : ''} ${s.incidentId ?? s.jobId ?? ''} ${fmtMs(s.ageMs)}; next: ${s.owner}${s.detail ? ` - ${s.detail}` : ''}`,
  action: stuckAction(s), line: stuckLine(s),
}));

/** What the Supervisor does about one stuck item (the owner of its next action decides the verb). */
function stuckAction(s) {
  if (s.owner === 'owner') return 'the owner holds it: make sure the ask reached the owner (Telegram /asks), remind once per digest; never answer it';
  if (s.owner === 'supervisor') return s.kind === 'retry-cap' ? 'diagnose the repeated failure (root cause, not a blind retry), then tell the Kernel the disposition'
    : s.kind === 'throttled' ? 'capacity holds it: check the pool/circuit/lease holder and free or re-route it'
      : 'no owner ask names this gate: rule it or type it (--until-*) and tell the Kernel';
  if (String(s.owner).startsWith('peer:')) return `notify the peer Kernel ${s.owner.slice(5)} (what it owes is its next move) and the waiting Kernel`;
  return 'wake the Kernel (notify.mjs) with the item; a second breach is a wake/dispatch defect to fix in a lane';
}
export const stuckLine = (s) => `STUCK ${s.severity} ${s.workflowId} ${s.kind}${s.cause && s.cause !== s.kind ? `/${s.cause}` : ''} ${s.incidentId ?? s.jobId ?? '-'}${s.opId ? ` (${s.opId})` : ''} age=${fmtMs(s.ageMs)} next=${s.owner}${s.detail ? `: ${clipLine(s.detail, 160)}` : ''}`;

/** {total, ok, warn, critical, byKind: {<kind>: n past SLA}, byOwner: {<owner>: n past SLA}} of stuck items. Pure. */
export function stuckCounts(stuck) {
  const out = { total: stuck.length, ok: 0, warn: 0, critical: 0, byKind: {}, byOwner: {} };
  for (const s of stuck) {
    out[s.severity]++;
    if (s.severity === 'ok') continue;
    out.byKind[s.kind] = (out.byKind[s.kind] ?? 0) + 1;
    const owner = String(s.owner).startsWith('peer:') ? 'peer' : s.owner;
    out.byOwner[owner] = (out.byOwner[owner] ?? 0) + 1;
  }
  return out;
}

/* ------------------------------------------------------------ snapshots and trend */

const slim = (r) => ({ key: r.key, jobs: r.jobs, succeeded: r.succeeded, failed: r.failed, successRate: r.successRate == null ? null : Math.round(r.successRate * 1000) / 1000,
  queueWaitP50: r.queueWait.p50, queueWaitP90: r.queueWait.p90, runP50: r.runTime.p50, settleP50: r.settleTime.p50, topFailureClass: r.topFailureClass,
  repeatedIdentical: r.repeatedIdentical, deadWorkerRate: r.deadWorkerRate == null ? null : Math.round(r.deadWorkerRate * 1000) / 1000,
  attemptsMax: r.attemptsPerNode.max, ownerWaitMs: r.ownerWait.totalMs, throttleMs: r.throttle.totalMs });

/** The event payload one tick records (kind SNAPSHOT_KIND): compact totals, per-op rows, stuck counts. Pure. */
export const snapshotPayload = (metrics, stuck = []) => ({ schema: 'starci/op-metrics-snapshot@1', windowMs: metrics.windowMs,
  totals: slim(metrics.totals), ops: metrics.ops.map(slim), stuck: stuckCounts(stuck) });

/** Record one snapshot: a machine.sqlite metrics_snapshots row (kind 'op-health', worker-wide). Returns snap_id. */
export const recordSnapshot = (m, payload) => m.recordMetrics({ kind: METRICS_KIND, windowMs: payload?.windowMs ?? null, subject: SNAPSHOT_KIND, data: payload });
/** The newest `limit` snapshots (machine.sqlite metrics_snapshots over the machine handle `m`), oldest first: [{at, ...payload}]. */
export const readSnapshots = (m, { limit = 96 } = {}) => m.db.prepare('SELECT at, data_json, data_sha FROM metrics_snapshots WHERE kind=? AND ledger_id IS NULL ORDER BY snap_id DESC LIMIT ?')
  .all(METRICS_KIND, limit).reverse().map((r) => ({ at: Number(r.at), ...fullJson(JSON.parse(r.data_json ?? 'null')) }));

const TREND_TEXT = (tr, d) => tr('Op health {window}: success {rate}{rateDelta}, median wait {wait}{waitDelta}, stuck {stuck} ({critical} critical){stuckDelta}{top}{vs}',
  { window: fmtMs(d.windowMs), rate: d.rate, rateDelta: d.rateDelta, wait: d.wait, waitDelta: d.waitDelta, stuck: d.stuck, critical: d.critical, stuckDelta: d.stuckDelta,
    top: d.top ? tr('; top failure {top}', { top: d.top }) : '', vs: d.vs ? tr(' [vs {vs} ago]', { vs: d.vs }) : '' });
const signed = (n, fmt) => (n == null || n === 0 ? '' : ` (${n > 0 ? '+' : '-'}${fmt(Math.abs(n))})`);

/**
 * One short trend line from snapshots (oldest first): the newest against the one closest to `trendMs` before it.
 * null when there is no snapshot. Pure.
 */
export function trendLine(snaps, { trendMs, language = ownerLanguage() } = {}) {
  const last = snaps[snaps.length - 1];
  if (!last?.totals) return null;
  const target = last.at - trendMs;
  const base = snaps.slice(0, -1).reduce((best, s) => (best == null || Math.abs(s.at - target) < Math.abs(best.at - target) ? s : best), null);
  const t = last.totals, b = base?.totals;
  const rate = t.successRate, baseRate = b?.successRate;
  const d = {
    windowMs: last.windowMs, rate: pct(rate), rateDelta: rate != null && baseRate != null ? signed(Math.round((rate - baseRate) * 100), (n) => `${n}pt`) : '',
    wait: fmtMs(t.queueWaitP50), waitDelta: t.queueWaitP50 != null && b?.queueWaitP50 != null ? signed(t.queueWaitP50 - b.queueWaitP50, fmtMs) : '',
    stuck: (last.stuck?.warn ?? 0) + (last.stuck?.critical ?? 0), critical: last.stuck?.critical ?? 0,
    stuckDelta: base?.stuck ? signed(((last.stuck?.warn ?? 0) + (last.stuck?.critical ?? 0)) - ((base.stuck.warn ?? 0) + (base.stuck.critical ?? 0)), String) : '',
    top: t.topFailureClass, vs: base ? fmtMs(last.at - base.at) : null,
  };
  return TREND_TEXT(translator(language), d);
}

/** The trend line from machine.sqlite (home.mjs readSupervisor), or null. Never throws. */
export async function currentTrend({ env = process.env, language = ownerLanguage(), settings = null } = {}) {
  try {
    const { readSupervisor } = await import('./home.mjs');
    const s = settings ?? telemetrySettings();
    const snaps = readSupervisor((m) => readSnapshots(m), [], { env });
    return trendLine(snaps, { trendMs: s.trendMs, language });
  } catch { return null; }
}

/* ------------------------------------------------------------ the tick duty */


/* ------------------------------------------------------------ tables */

/** The health table as text lines (ops or workflows rows). Pure. */
function healthTable(rows, { label = 'op' } = {}) {
  const head = [label, 'jobs', 'ok%', 'fail', 'wait p50', 'wait p90', 'run p50', 'settle p50', 'att/node', 'repeat', 'dead%', 'owner-wait', 'throttle', 'top failure'];
  const body = rows.map((r) => [String(r.key), r.jobs, pct(r.successRate), r.failed, fmtMs(r.queueWait.p50), fmtMs(r.queueWait.p90), fmtMs(r.runTime.p50), fmtMs(r.settleTime.p50),
    r.attemptsPerNode.mean == null ? '-' : `${r.attemptsPerNode.mean}/${r.attemptsPerNode.max}`, r.repeatedIdentical, pct(r.deadWorkerRate), fmtMs(r.ownerWait.totalMs || null), fmtMs(r.throttle.totalMs || null), r.topFailureClass ?? '-'].map(String));
  const widths = head.map((h, i) => Math.max(h.length, ...body.map((row) => row[i].length)));
  const line = (cells) => cells.map((c, i) => (i === 0 || i === cells.length - 1 ? c.padEnd(widths[i]) : c.padStart(widths[i]))).join('  ').trimEnd();
  return [line(head), ...body.map(line)];
}

/* ------------------------------------------------------------ CLI */

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const asJson = argv.includes('--json');
  const { inspectLedger, ledgerFileFor } = await import('../../engine/db/ledger.mjs');
  const home = await import('./home.mjs');
  const settings = telemetrySettings();
  if (argv.includes('--trend')) {
    const snaps = home.readSupervisor((m) => readSnapshots(m), []);
    const line = trendLine(snaps, { trendMs: settings.trendMs });
    console.log(asJson ? JSON.stringify({ ok: true, snapshots: snaps, trend: line }) : [line ?? 'no op-metrics snapshot yet', ...snaps.slice(-12).map((s) => `  ${new Date(s.at).toISOString()} ok ${pct(s.totals?.successRate)} wait ${fmtMs(s.totals?.queueWaitP50)} stuck ${(s.stuck?.warn ?? 0) + (s.stuck?.critical ?? 0)} (${s.stuck?.critical ?? 0} critical)`)].join('\n'));
    process.exit(0);
  }
  const at = argv.indexOf('--window-ms');
  const windowMs = at >= 0 ? Number(argv[at + 1]) : settings.windowMs;
  if (!Number.isFinite(windowMs) || windowMs <= 0) { console.error('--window-ms must be a positive number'); process.exit(2); }
  const by = argv.includes('--by') ? argv[argv.indexOf('--by') + 1] : 'op';
  const listed = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [path.resolve(argv[i + 1])] : []));
  const repos = listed.length ? listed : home.productRepos();
  const now = Date.now();
  const records = [], errors = [];
  for (const repo of repos) {
    let handle = null;
    try { handle = inspectLedger({ file: ledgerFileFor(repo) }); records.push(...jobRecords(handle.db, { since: now - windowMs, now }).map((r) => ({ ...r, repo }))); }
    catch (error) { errors.push({ repo, error: clipLine(error?.message ?? error, 200) }); }
    finally { try { handle?.close(); } catch { /* closed */ } }
  }
  const metrics = aggregate(records, { now, windowMs });
  if (asJson) console.log(JSON.stringify({ ok: errors.length === 0, repos, errors, ...metrics }));
  else {
    console.log(`op health over ${fmtMs(windowMs)} across ${repos.length} ledger(s): ${metrics.totals.jobs} job(s), success ${pct(metrics.totals.successRate)}, wait p50 ${fmtMs(metrics.totals.queueWait.p50)}`);
    for (const l of healthTable(by === 'workflow' ? metrics.workflows : metrics.ops, { label: by === 'workflow' ? 'workflow' : 'op' })) console.log(`  ${l}`);
    for (const e of errors) console.log(`  ERROR ${e.repo}: ${e.error}`);
  }
  process.exit(errors.length ? 1 : 0);
}
