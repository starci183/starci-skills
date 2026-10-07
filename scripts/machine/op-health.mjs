// op-health.mjs — the health of op jobs read from ledger rows: one normalized record per job, the failure class of a failed job and
// the health row over any grouping of records (see op-metrics.mjs for the metrics, the stuck SLA and the trend built on them).
import { parseJsonOr } from '../lib/json.mjs';
import { byCodeUnit } from '../lib/list.mjs';

const JOB_EVENT_KINDS = ['op-dispatched', 'report-filed', 'op-settled', 'dispatch-rejected', 'dead-worker-requeued', 'dead-worker-fenced', 'worker-failed-no-report'];
const DEAD_KINDS = new Set(['dead-worker-requeued', 'dead-worker-fenced', 'worker-failed-no-report']);
const OPEN_STATUSES = new Set(['queued', 'leased', 'running', 'answering', 'effect_unknown']);

/* ------------------------------------------------------------ small pure pieces */

/** Nearest-rank percentile of `values` (numbers), or null when empty. */
export function percentile(values, p) {
  const list = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  return list[Math.min(list.length - 1, Math.max(0, Math.ceil((p / 100) * list.length) - 1))];
}
const dist = (values) => ({ n: values.filter(Number.isFinite).length, p50: percentile(values, 50), p90: percentile(values, 90) });
const span = (from, to) => (Number.isFinite(from) && Number.isFinite(to) && to >= from ? to - from : null);

const settledClassOf = (result, report) => { if (typeof result?.failureClass?.class === 'string') { return result.failureClass.class; } if (typeof result?.failureClass === 'string') { return result.failureClass; } if (typeof report?.failureClass === 'string') { return report.failureClass; } return null; };
const settledSuffix = (settled, category, red) => { if (category) { return `${settled}:${category}`; } if (red.length) { return `${settled}:${red[0]}`; } return settled; };
const outcomeOf = (status, verdict) => { if (status === 'succeeded') { return 'succeeded'; } if (status === 'awaiting_owner') { return 'owner'; } if (status === 'failed') { return ['dropped', 'superseded'].includes(verdict) ? 'dropped' : 'failed'; } if (status === 'cancelled') { return 'cancelled'; } return 'open'; };

const isRedCheck = (c) => c && (c.ok === false || (c.exitCode != null && Number(c.exitCode) !== 0));
// A non-blank string, trimmed and lowercased; null otherwise.
const trimmedLower = (value) => (typeof value === 'string' && value.trim() ? value.trim().toLowerCase() : null);
const blockedClass = (report) => {
  const kind = trimmedLower(report?.blocker?.kind);
  return kind ? `blocked:${kind}` : 'blocked';
};

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
  const category = trimmedLower(report?.rootCause?.category);
  const red = checks.filter(isRedCheck).map((c) => String(c.name ?? 'unnamed')).sort(byCodeUnit);
  // The settle's own class (scripts/kernel/verify-failure.mjs: result_json.failureClass {class, reason}, or the
  // report's failureClass) leads, narrowed by the root-cause category or the red check.
  const settled = settledClassOf(result, report);
  if (settled) return settledSuffix(settled, category, red);
  if (category) return `root-cause:${category}`;
  if (red.length) return `check:${red[0]}`;
  if (Number(result?.checkEvidence?.failed) > 0) return 'check:unnamed';
  if (report?.outcome === 'blocked' || verdict === 'blocked') return blockedClass(report);
  if (!report && result?.reportFiled === false) return 'no-report';
  return `verdict:${verdict ?? 'unknown'}`;
}

/** One failed attempt's signature: its class plus every red check name, so two attempts failing alike compare equal. */
export const failureSignature = (klass, checks = []) => [klass, ...checks.filter(isRedCheck).map((c) => String(c.name ?? '')).sort(byCodeUnit)].join('|');

/* ------------------------------------------------------------ per-job records */

export const inList = (n) => Array.from({ length: n }, () => '?').join(',');

const scopeSql = (workflowId) => (workflowId ? ' AND workflow_id=?' : '');
const scopeArgs = (workflowId) => (workflowId ? [workflowId] : []);
const jobKeyOf = (row) => `${row.workflow_id}|${row.op_id}|${row.attempt}`;

// The job events of the window grouped by job id, in event order.
function eventsByJob(db, from, workflowId) {
  const byJob = new Map();
  const events = db.prepare(`SELECT entity_id, kind, payload_json, created_at FROM events WHERE entity_type='job' AND kind IN (${inList(JOB_EVENT_KINDS.length)}) AND created_at>=?${scopeSql(workflowId)} ORDER BY seq`)
    .all(...JOB_EVENT_KINDS, from, ...scopeArgs(workflowId));
  for (const e of events) {
    if (!byJob.has(e.entity_id)) byJob.set(e.entity_id, []);
    byJob.get(e.entity_id).push(e);
  }
  return byJob;
}

function reportsByKey(db, from, workflowId) {
  const reports = new Map();
  for (const r of db.prepare(`SELECT workflow_id, op_id, attempt, outcome, report_json, created_at FROM reports WHERE created_at>=?${scopeSql(workflowId)} ORDER BY created_at`).all(from, ...scopeArgs(workflowId))) {
    reports.set(jobKeyOf(r), { outcome: r.outcome, at: Number(r.created_at), ...parseJsonOr(r.report_json, {}) });
  }
  return reports;
}

function checksByKey(db, from, workflowId) {
  const checks = new Map();
  for (const c of db.prepare(`SELECT workflow_id, op_id, attempt, checks_json FROM checks WHERE created_at>=?${scopeSql(workflowId)}`).all(from, ...scopeArgs(workflowId))) {
    const list = parseJsonOr(c.checks_json, {})?.checks;
    if (Array.isArray(list)) checks.set(jobKeyOf(c), [...(checks.get(jobKeyOf(c)) ?? []), ...list]);
  }
  return checks;
}

// When each ask was first answered or superseded, by the ask's report id.
function askAnswerTimes(db, from, workflowId) {
  const asks = new Map();
  for (const a of db.prepare(`SELECT entity_id, kind, created_at FROM events WHERE entity_type='report' AND kind IN ('ask-answered','ask-superseded') AND created_at>=?${scopeSql(workflowId)} ORDER BY seq`).all(from, ...scopeArgs(workflowId))) {
    if (!asks.has(a.entity_id)) asks.set(a.entity_id, Number(a.created_at));
  }
  return asks;
}

const deadLivenessOf = (deadEv) => {
  if (!deadEv) return null;
  const payload = parseJsonOr(deadEv.payload_json, {});
  return payload?.worker?.liveness ?? payload?.liveness ?? 'dead';
};
const askIdOf = (result, report) => result.askDispatchId ?? (report?.outcome === 'ask' ? report?.dispatch ?? null : null);

// The time a rejected dispatch waited for its launch: the next dispatch, else now while open, else the settle.
const throttleMsOf = ({ rejectAt, dispatches, outcome, now, settledAt }) => {
  if (!rejectAt) return null;
  const openEnd = outcome === 'open' ? now : settledAt;
  return span(rejectAt, dispatches.find((t) => t > rejectAt) ?? openEnd);
};

// The record of one op job over the window's events, reports, checks and ask answers.
function jobRecord(job, { byJob, reports, checks, asks, now }) {
  const payload = parseJsonOr(job.payload_json, {});
  const result = parseJsonOr(job.result_json, {});
  const evs = byJob.get(job.job_id) ?? [];
  const first = (kind) => evs.find((e) => e.kind === kind) ?? null;
  const dispatches = evs.filter((e) => e.kind === 'op-dispatched').map((e) => Number(e.created_at));
  const key = jobKeyOf(job);
  const report = reports.get(key) ?? null;
  const reportAt = Number(first('report-filed')?.created_at ?? report?.at) || null;
  const settledEv = first('op-settled');
  const settledAt = Number(settledEv?.created_at ?? (OPEN_STATUSES.has(job.status) ? Number.NaN : result.at)) || null;
  const verdict = result.verdict ?? parseJsonOr(settledEv?.payload_json, {})?.verdict ?? null;
  const deadEv = evs.find((e) => DEAD_KINDS.has(e.kind));
  const outcome = outcomeOf(job.status, verdict);
  const jobChecks = checks.get(key) ?? [];
  const failureClass = outcome === 'failed' ? failureClassOf({ status: job.status, result, report, checks: jobChecks, dead: deadLivenessOf(deadEv) }) : null;
  const dispatchedAt = dispatches[0] ?? null;
  const runStart = [...dispatches].reverse().find((t) => t <= (reportAt ?? settledAt ?? Infinity)) ?? dispatchedAt;
  const rejectAt = Number(first('dispatch-rejected')?.created_at) || null;
  const askId = askIdOf(result, report);
  const askStart = settledAt ?? reportAt;
  return {
    jobId: job.job_id, workflowId: job.workflow_id, op: job.op_id ?? payload.opId ?? '-', attempt: job.attempt, status: job.status, verdict, outcome,
    failureClass, signature: failureClass ? failureSignature(failureClass, jobChecks) : null,
    retryOf: payload.retry?.retryOf ?? null,
    enqueuedAt: Number(job.created_at), dispatchedAt, reportAt, settledAt,
    queueWaitMs: span(Number(job.created_at), dispatchedAt),
    runMs: span(runStart, reportAt ?? settledAt),
    settleMs: span(reportAt, settledAt),
    throttleMs: throttleMsOf({ rejectAt, dispatches, outcome, now, settledAt }),
    ownerWaitMs: askId && askStart ? span(askStart, asks.get(askId) ?? now) : null,
    dead: Boolean(deadEv),
  };
}

/**
 * One normalized record per op job created or updated inside [since, now] (optionally of one workflow): {jobId,
 * workflowId, op, attempt, status, verdict, outcome (succeeded|failed|owner|dropped|cancelled|open), failureClass,
 * signature, retryOf, enqueuedAt, dispatchedAt, reportAt, settledAt, queueWaitMs, runMs, settleMs, throttleMs,
 * ownerWaitMs, dead}. Read-only.
 */
export function jobRecords(db, { since, now = Date.now(), workflowId = null } = {}) {
  const jobs = db.prepare(`SELECT job_id, workflow_id, op_id, attempt, status, payload_json, result_json, created_at, updated_at FROM jobs
    WHERE kind='op' AND (created_at>=? OR updated_at>=?)${scopeSql(workflowId)}`).all(since, since, ...scopeArgs(workflowId));
  if (!jobs.length) return [];
  const from = Math.min(...jobs.map((j) => Number(j.created_at)));
  const context = { byJob: eventsByJob(db, from, workflowId), reports: reportsByKey(db, from, workflowId), checks: checksByKey(db, from, workflowId),
    asks: askAnswerTimes(db, from, workflowId), now };
  return jobs.map((job) => jobRecord(job, context));
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

// Every record grouped by its workflow and retry-chain root, each chain in attempt order.
function retryChains(records) {
  const roots = chainRoots(records);
  const chains = new Map();
  for (const r of [...records].sort((a, b) => a.attempt - b.attempt || a.enqueuedAt - b.enqueuedAt)) {
    const k = `${r.workflowId}|${roots.get(r.jobId)}`;
    if (!chains.has(k)) chains.set(k, []);
    chains.get(k).push(r);
  }
  return chains;
}

// Failed attempts whose signature equals the previous failed attempt of their chain (a success resets the chain).
function repeatedIdenticalOf(chains) {
  let repeated = 0;
  for (const list of chains.values()) {
    let last = null;
    for (const r of list) {
      if (r.outcome !== 'failed') { if (r.outcome === 'succeeded') { last = null; } continue; }
      if (last && r.signature === last) repeated++;
      last = r.signature;
    }
  }
  return repeated;
}

// The failure classes of `records`, most frequent first.
function failureClassesOf(records) {
  const classes = new Map();
  for (const r of records) if (r.failureClass) classes.set(r.failureClass, (classes.get(r.failureClass) ?? 0) + 1);
  return [...classes].map(([klass, n]) => ({ class: klass, n })).sort((a, b) => b.n - a.n || a.class.localeCompare(b.class));
}

const meanOf = (sizes) => (sizes.length ? Math.round((sizes.reduce((a, b) => a + b, 0) / sizes.length) * 100) / 100 : null);

/** One health row over `records` (any grouping): see the header for each field. Pure. */
function healthRow(key, records) {
  const count = (o) => records.filter((r) => r.outcome === o).length;
  const succeeded = count('succeeded'), failed = count('failed');
  const failureClasses = failureClassesOf(records);
  const chains = retryChains(records);
  const sizes = [...chains.values()].map((l) => l.length);
  const dispatched = records.filter((r) => r.dispatchedAt != null);
  const owner = records.map((r) => r.ownerWaitMs).filter(Number.isFinite);
  const throttle = records.map((r) => r.throttleMs).filter(Number.isFinite);
  return {
    key, jobs: records.length, succeeded, failed, owner: count('owner'), dropped: count('dropped') + count('cancelled'), open: count('open'),
    successRate: succeeded + failed ? succeeded / (succeeded + failed) : null,
    failureClasses, topFailureClass: failureClasses[0]?.class ?? null,
    queueWait: dist(records.map((r) => r.queueWaitMs)), runTime: dist(records.map((r) => r.runMs)), settleTime: dist(records.map((r) => r.settleMs)),
    attemptsPerNode: { nodes: sizes.length, mean: meanOf(sizes), max: sizes.length ? Math.max(...sizes) : null },
    repeatedIdentical: repeatedIdenticalOf(chains),
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
