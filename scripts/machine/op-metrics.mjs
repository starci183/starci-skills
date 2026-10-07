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
import { aggregate, inList, jobRecords } from './op-health.mjs';
import { clipLine } from '../lib/clip.mjs'; import { isMain } from '../lib/is-main.mjs';

export const SNAPSHOT_KIND = 'supervisor-op-metrics';
/** metrics_snapshots.kind of these snapshots (DBTREE B6). */
const METRICS_KIND = 'op-health';
export const WAIT_KINDS = Object.freeze(['owner-gate', 'peer-wait', 'dependency', 'retry-cap', 'deferred-settle', 'queued-ready', 'throttled']);
export const SEVERITIES = Object.freeze(['ok', 'warn', 'critical']);
/** queuedBecause values that are the runtime's capacity, not the workflow's own order. */
const THROTTLE_CAUSES = Object.freeze(['pool-full', 'circuit-open', 'max-ops', 'path-lease']);


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


export { fmtMs };
export { aggregate, failureClassOf, failureSignature, jobRecords, percentile } from './op-health.mjs';
const pct = (rate) => (rate == null ? '-' : `${Math.round(rate * 100)}%`);


/** severity of a wait of `ageMs` against {warnMs, criticalMs}. */
export const severityOf = (ageMs, sla) => { if (ageMs >= sla.criticalMs) { return 'critical'; } if (ageMs >= sla.warnMs) { return 'warn'; } return 'ok'; };

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

// One wait item of the workflow: its age, severity and detail on top of the fields the caller names.
function pushStuck({ workflowId, now, sla, out }, item) {
  const since = Number(item.since) || now;
  const ageMs = Math.max(0, now - since);
  const id = item.kind === 'deferred-settle' ? item.jobId : item.incidentId ?? item.jobId;
  out.push({ key: `stuck:${workflowId}:${item.kind}:${id}`, workflowId, cause: item.kind, jobId: null, opId: null, incidentId: null, blockedBy: null, count: 1, ...item,
    since, ageMs, severity: severityOf(ageMs, sla[item.kind]), detail: clipLine(item.detail ?? '', 240) });
}

// Retry caps: a failed job whose retry route reached its limit and handed the next step to an owner gate, by incident id.
function retryCapsOf(jobs) {
  const capped = new Map();
  for (const j of jobs) {
    if (j.status !== 'failed') continue;
    const step = parseJsonOr(j.result_json, {})?.nextStep;
    if (step?.kind === 'owner-gate' && step.route && step.incidentId) capped.set(step.incidentId, { job: j, step });
  }
  return capped;
}

function pushOwnerGate(ctx, gate, cap, pendingAsks) {
  const { db, workflowId } = ctx;
  if (cap) {
    pushStuck(ctx, { kind: 'retry-cap', incidentId: gate.incidentId, jobId: cap.job.job_id, opId: cap.job.op_id ?? null, since: Number(parseJsonOr(cap.job.result_json, {})?.at) || incidentRaisedAt(db, workflowId, gate.incidentId) || cap.job.updated_at,
      owner: 'supervisor', detail: `route ${cap.step.route} fired ${cap.step.firing ?? '?'} of ${cap.step.limit ?? '?'}: diagnose the root cause before anything runs it again` });
    return;
  }
  // Autopilot (scripts/kernel/autopilot-run.mjs): a supervisor-gate is the Supervisor's step, never the owner's.
  if (gate.kind === 'supervisor-gate') {
    pushStuck(ctx, { kind: 'owner-gate', cause: 'supervisor-gate', incidentId: gate.incidentId, opId: gate.opId ?? null, since: incidentRaisedAt(db, workflowId, gate.incidentId), owner: 'supervisor', detail: gate.detail ?? '' });
    return;
  }
  const holds = Array.isArray(gate.holds) ? gate.holds : [];
  const asked = ASK_NAMED.test(gate.detail ?? '') || pendingAsks.some((a) => holds.includes(a.jobId) || (a.opId && holds.includes(a.opId)));
  pushStuck(ctx, { kind: 'owner-gate', incidentId: gate.incidentId, opId: gate.opId ?? null, since: incidentRaisedAt(db, workflowId, gate.incidentId), owner: asked ? 'owner' : 'supervisor',
    detail: `${asked ? '' : 'no owner ask names it: '}${gate.detail ?? ''}` });
}

function pushPendingAsk(ctx, ask, jobRow) {
  const job = jobRow.get(ask.jobId);
  const since = Number(parseJsonOr(job?.result_json, {})?.at) || Number(job?.updated_at) || null;
  pushStuck(ctx, { kind: 'owner-gate', cause: 'owner-ask', jobId: ask.jobId, opId: ask.opId ?? null, since, owner: 'owner', detail: `ask ${ask.dispatchId ?? '-'} unanswered` });
}

const peerWaitDetail = (wait) => `${wait.peerRunning === false ? 'peer ' + wait.peer + ' is ' + (wait.peerPhase ?? 'gone') + ', re-point the wait: ' : ''}${wait.detail ?? ''}`;

function pushPeerWait(ctx, wait) {
  pushStuck(ctx, { kind: 'peer-wait', incidentId: wait.incidentId, opId: wait.opId ?? null, since: wait.since ?? incidentRaisedAt(ctx.db, ctx.workflowId, wait.incidentId),
    owner: wait.peerRunning === false ? 'kernel' : `peer:${wait.peer ?? '?'}`, blockedBy: wait.peer ? { workflow: wait.peer } : null, detail: peerWaitDetail(wait) });
}

function pushHeldSettle(ctx, item, jobRow) {
  const { db, out } = ctx;
  const since = firstJobEventAt(db, item.jobId, ['report-consumed', 'report-filed']) ?? Number(jobRow.get(item.jobId)?.updated_at);
  const byGate = item.heldBecause === 'owner-gate' || item.heldBecause === 'supervisor-gate';
  const gateOwnerOfItem = () => out.find((i) => i.incidentId === item.blockedBy?.incident && ['owner-gate', 'retry-cap'].includes(i.kind))?.owner ?? 'supervisor';
  pushStuck(ctx, { kind: 'deferred-settle', cause: `held-${item.heldBecause}`, jobId: item.jobId, opId: item.opId ?? null, incidentId: item.blockedBy?.incident ?? null, since,
    owner: byGate ? gateOwnerOfItem() : `peer:${item.blockedBy?.peer ?? '?'}`, blockedBy: item.blockedBy ?? null, detail: item.detail });
}

function pushSettleReady(ctx, jobId, jobRow) {
  const job = jobRow.get(jobId);
  pushStuck(ctx, { kind: 'deferred-settle', cause: 'settle-ready', jobId, opId: job?.op_id ?? null, since: firstJobEventAt(ctx.db, jobId, ['report-consumed', 'report-filed']) ?? Number(job?.updated_at),
    owner: 'kernel', detail: 'report consumed, not settled: starci kernel record-checks + starci kernel settle' });
}

const GATE_CAUSES = new Set(['owner-gate', 'supervisor-gate', 'peer-wait']);

// Who moves a queued job: a job a gate or wait holds is that item's owner; a dependency is whoever moves the job it waits on
// (followed through the chain), so N dependants of one held job are ONE item naming that owner.
function queueOwnersOf(out, queued) {
  const gateOwner = new Map(out.filter((i) => i.incidentId).map((i) => [i.incidentId, i.owner]));
  const byJob = new Map(queued.map((q) => [q.jobId, q]));
  const gateHeldOwner = (q) => {
    const owner = gateOwner.get(q.blockedBy?.incident);
    if (owner != null) return owner;
    if (q.queuedBecause === 'peer-wait') return `peer:${q.blockedBy?.peer ?? '?'}`;
    return q.queuedBecause === 'supervisor-gate' ? 'supervisor' : 'owner';
  };
  const ownerOfJob = (jobId, seen = new Set()) => {
    const q = byJob.get(jobId);
    if (!q || seen.has(jobId)) return 'kernel';
    seen.add(jobId);
    if (GATE_CAUSES.has(q.queuedBecause)) return gateHeldOwner(q);
    if (q.queuedBecause === 'dependency' && q.blockedBy?.job) return ownerOfJob(q.blockedBy.job, seen);
    return THROTTLE_CAUSES.includes(q.queuedBecause) ? 'supervisor' : 'kernel';
  };
  const dependencyOwnerOf = (parked, blockedBy) => {
    if (parked) return parked.heldBecause === 'peer-wait' ? `peer:${parked.peer ?? '?'}` : gateOwner.get(parked.incident) ?? 'owner';
    return blockedBy?.job ? ownerOfJob(blockedBy.job) : 'kernel';
  };
  return { dependencyOwnerOf };
}

// A queued job that waits on a dependency joins the item of the job it waits on (one item per blocker, counting its dependants).
function noteDependency(deps, q, { job, since, now, owners }) {
  const blocker = q.blockedBy?.job ?? q.blockedBy?.op ?? q.jobId;
  const at = Number(job?.created_at) || since || now;
  const held = deps.get(blocker);
  if (held) { held.count++; held.dependants.push(q.jobId); held.since = Math.min(held.since, at); return; }
  deps.set(blocker, { kind: 'dependency', jobId: q.blockedBy?.job ?? q.jobId, opId: q.blockedBy?.op ?? q.opId ?? null, since: at, count: 1, dependants: [q.jobId],
    owner: owners.dependencyOwnerOf(q.parkedBehind, q.blockedBy), blockedBy: q.blockedBy ?? null, detail: q.detail });
}

// One queued job as a stuck item (or none: a gate or wait is itself the item, and a deferred job waits by design).
function pushQueued(ctx, q, { jobRow, deps, owners }) {
  const job = jobRow.get(q.jobId);
  const since = Number(job?.updated_at ?? job?.created_at) || null;
  const because = q.queuedBecause;
  if (GATE_CAUSES.has(because)) return; // the gate / wait itself is the item
  // Parked for the owner's one review at handover by design (autopilot): not a wait anyone owes a move on now.
  if (because === 'deferred' || because === 'deferred-to-handover') return;
  if (because === 'dependency') noteDependency(deps, q, { job, since, now: ctx.now, owners });
  else if (because === 'dependency-failed') pushStuck(ctx, { kind: 'queued-ready', cause: because, jobId: q.jobId, opId: q.opId ?? null, since, owner: 'kernel', blockedBy: q.blockedBy ?? null, detail: q.detail });
  else if (THROTTLE_CAUSES.includes(because)) pushStuck(ctx, { kind: 'throttled', cause: because, jobId: q.jobId, opId: q.opId ?? null, since, owner: 'supervisor', blockedBy: q.blockedBy ?? null, detail: q.detail });
  else pushStuck(ctx, { kind: 'queued-ready', cause: because ?? 'ready', jobId: q.jobId, opId: q.opId ?? null, since, owner: 'kernel', detail: q.detail ?? 'ready: route and dispatch it' });
}

const dependencyDetail = (d, dependants) => `${dependants.length} job(s) wait on ${d.jobId}${d.opId ? ' (' + d.opId + ')' : ''}: ${dependants.slice(0, 4).join(', ')}${dependants.length > 4 ? ', ...' : ''}; ${d.detail ?? ''}`;

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
  const ctx = { db, workflowId, now, sla, out };
  const capped = retryCapsOf(jobs);
  const pendingAsks = awaitingOwner.filter((a) => (a.answer ?? 'pending') === 'pending');
  for (const gate of ownerGates) pushOwnerGate(ctx, gate, capped.get(gate.incidentId), pendingAsks);
  for (const ask of pendingAsks) pushPendingAsk(ctx, ask, jobRow);
  for (const wait of peerWaits) pushPeerWait(ctx, wait);
  for (const item of heldSettle) pushHeldSettle(ctx, item, jobRow);
  for (const jobId of settleReady) pushSettleReady(ctx, jobId, jobRow);
  const deps = new Map();
  const owners = queueOwnersOf(out, queued);
  for (const q of queued) pushQueued(ctx, q, { jobRow, deps, owners });
  for (const d of deps.values()) {
    const { dependants, ...item } = d;
    pushStuck(ctx, { ...item, detail: dependencyDetail(d, dependants) });
  }
  const rank = { critical: 2, warn: 1, ok: 0 };
  return out.sort((a, b) => rank[b.severity] - rank[a.severity] || b.ageMs - a.ageMs);
}

/** Stuck items past their SLA as Supervisor owed actions (owed.mjs item shape plus severity). Pure. */
export const stuckOwedItems = (stuck, { repo = null } = {}) => stuck.filter((s) => s.severity !== 'ok').map((s) => ({
  key: s.key, class: 'supervisor', kind: `stuck-${s.kind}`, workflowId: s.workflowId, repo, severity: s.severity, owner: s.owner,
  incidentId: s.incidentId, jobId: s.jobId, raisedAt: s.since, ageMin: Math.round(s.ageMs / 60_000),
  summary: `${s.kind}${s.cause && s.cause !== s.kind ? ' (' + s.cause + ')' : ''} ${s.incidentId ?? s.jobId ?? ''} ${fmtMs(s.ageMs)}; next: ${s.owner}${s.detail ? ' - ' + s.detail : ''}`,
  action: stuckAction(s), line: stuckLine(s),
}));

/** What the Supervisor does about one stuck item (the owner of its next action decides the verb). */
function stuckAction(s) {
  if (s.owner === 'owner') return 'the owner holds it: make sure the ask reached the owner (Telegram /asks), remind once per digest; never answer it';
  if (s.owner === 'supervisor') { if (s.kind === 'retry-cap') { return 'diagnose the repeated failure (root cause, not a blind retry), then tell the Kernel the disposition'; } if (s.kind === 'throttled') { return 'capacity holds it: check the pool/circuit/lease holder and free or re-route it'; } return 'no owner ask names this gate: rule it or type it (--until-*) and tell the Kernel'; }
  if (String(s.owner).startsWith('peer:')) return `notify the peer Kernel ${s.owner.slice(5)} (what it owes is its next move) and the waiting Kernel`;
  return 'wake the Kernel (notify.mjs) with the item; a second breach is a wake/dispatch defect to fix in a lane';
}
export const stuckLine = (s) => 'STUCK ' + s.severity + ' ' + s.workflowId + ' ' + s.kind + (s.cause && s.cause !== s.kind ? '/' + s.cause : '') + ' ' + (s.incidentId ?? s.jobId ?? '-') + (s.opId ? ' (' + s.opId + ')' : '') + ' age=' + fmtMs(s.ageMs) + ' next=' + s.owner + (s.detail ? ': ' + clipLine(s.detail, 160) : '');

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
const signed = (n, fmt) => { if (n == null || n === 0) { return ''; } return ` (${n > 0 ? '+' : '-'}${fmt(Math.abs(n))})`; };

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
