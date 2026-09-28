// progress-rca.mjs — "am I progressing toward the goal? if not, why, and which single change fixes the most?"
// computed in deterministic code, so a Kernel on a modest model only has to pick the top untried action.
//
// Owner, 2026-09-28: "trước đây supervisor không tư duy dc à?" then "sao workflows không tự điều phối dc mà đợi
// supervisor" then "kernel phải brainstorm dc, xử lý lỗi dc ... làm mọi thứ để workflows tiến", refined: ops draw
// the graph, the Kernel makes LIGHT edits (api graph-edit) and dispatches the owning op for a heavy redesign
// (api redesign). The Kernel stays on Devin, so the thinking lives here:
//
//   progressOf  units that PASSED their gates (a succeeded job; never a job count, never a self-marked done), units
//               per hour, share of legs done, running vs allowed parallelism (RAM cap, pools, priority reserve),
//               queued-ready, ETA, and a stall verdict with its reasons (runtimes.yaml allocation.progress).
//   rcaOf       every recent failed/blocked attempt of the workflow read TOGETHER (report summary, blocker kind,
//               failureClass, rootCause, worker liveness), clustered by cause.
//   actionsOf   a RANKED list of concrete candidate actions from a fixed catalogue: each carries its exact api
//               command, its expected effect, its tier (light = a direct Kernel edit; heavy = dispatch the owning
//               op with the RCA as its brief; proposal = a tier-2 kernel-proposal for the Supervisor; supervisor =
//               a runtime or cross-workflow cause the Kernel cannot fix) and whether the decision log already
//               tried it (a failed try sinks, it is never offered as new).
//
// Read-only over the ledger. `api status` exposes `progress` and `rca` (scripts/kernel/api-status/*.mjs); the
// Supervisor reuses it as the backstop (scripts/supervisor/progress-watch.mjs).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { allocationSettings } from '../../engine/config.mjs';
import { parseYaml } from '../../engine/yaml.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { clipLine } from '../lib/clip.mjs';
import { priorityTable, readThrottleState, throttleStateFile } from '../lib/ram-throttle.mjs';
import { specsOf } from './spec-deferral.mjs';

const unitSpecsOff = () => { try { return specsOf({ skillRoot }).unit === false; } catch { return false; } };

export const OPEN_JOB = Object.freeze(['queued', 'leased', 'running', 'reported', 'effect_unknown', 'answering']);
export const RUNNING_JOB = Object.freeze(['leased', 'running', 'reported', 'effect_unknown', 'answering']);
export const DECISION_KIND = 'kernel-decision';
export const DECISION_RESULT_KIND = 'kernel-decision-result';
export const GRAPH_EDIT_KIND = 'kernel-graph-edit';
const HOUR = 3_600_000;
const one = (s, n = 240) => clipLine(String(s ?? '').replace(/\s+/g, ' ').trim(), n);
const parse = (s, d = {}) => parseJsonOr(s, d) ?? d;

/** runtimes.yaml allocation.progress with safe defaults (a missing block never breaks api status). */
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
  };
}

/* ------------------------------------------------------------ units */

/** The op jobs of one workflow, parsed. */
export function opJobsOf(db, workflowId) {
  return db.prepare("SELECT job_id, op_id, attempt, status, payload_json, result_json, created_at, updated_at FROM jobs WHERE workflow_id=? AND kind='op' ORDER BY created_at, job_id")
    .all(workflowId).map((j) => ({ ...j, payload: parse(j.payload_json), result: parse(j.result_json) }));
}

/**
 * One unit per bounded piece of work: a cut slice (op|cut.id#ordinal) or, uncut, the root of a retry lineage. A
 * continuation (graph-edit continue) joins the unit it continues. A unit is `done` only when one of its jobs
 * succeeded (settled through its checks), `dropped` when every job was cancelled, `open` while a job is open, else
 * `failed`. Pure over `jobs`.
 */
export function unitsOf(jobs) {
  const byId = new Map(jobs.map((j) => [j.job_id, j]));
  const keyMemo = new Map();
  const keyOf = (j, depth = 0) => {
    if (keyMemo.has(j.job_id)) return keyMemo.get(j.job_id);
    const p = j.payload ?? {};
    const via = p.kernelEdit?.continuationOf ?? p.kernelEdit?.unitOf ?? null;
    let k;
    if (via && byId.has(via) && depth < 20) k = keyOf(byId.get(via), depth + 1);
    else if (p.cut?.id != null && p.cut?.ordinal != null) k = `${j.op_id}|${p.cut.id}#${p.cut.ordinal}`;
    else {
      const prior = p.retry?.retryOf ?? null;
      k = prior && byId.has(prior) && depth < 20 ? keyOf(byId.get(prior), depth + 1) : `${j.op_id}|${j.job_id}`;
    }
    keyMemo.set(j.job_id, k);
    return k;
  };
  const units = new Map();
  for (const j of jobs) {
    const k = keyOf(j);
    if (!units.has(k)) units.set(k, { key: k, op: j.op_id, cut: j.payload?.cut ?? null, jobs: [] });
    units.get(k).jobs.push(j);
  }
  for (const u of units.values()) {
    const ok = u.jobs.filter((j) => j.status === 'succeeded');
    u.doneAt = ok.length ? Math.min(...ok.map((j) => Number(j.updated_at))) : null;
    u.state = ok.length ? 'done' : u.jobs.some((j) => OPEN_JOB.includes(j.status)) ? 'open'
      : u.jobs.every((j) => j.status === 'cancelled') ? 'dropped' : 'failed';
    u.last = u.jobs[u.jobs.length - 1];
    u.open = u.jobs.filter((j) => OPEN_JOB.includes(j.status));
  }
  return [...units.values()];
}

/* ------------------------------------------------------------ parallelism */

const runtimesDoc = (() => { let doc; return () => { if (doc === undefined) { try { doc = parseYaml(fs.readFileSync(path.join(skillRoot, 'modules', 'models', 'runtimes.yaml'), 'utf8')); } catch { doc = null; } } return doc; }; })();

/** The priority table (runtimes.yaml ramThrottle.priorities + the Supervisor's host overrides). Never throws. */
export function priorities() {
  try { return priorityTable(null, readThrottleState(throttleStateFile())); }
  catch { try { return priorityTable(null, {}); } catch { return {}; } }
}

/**
 * How many units this workflow may run at once now: min(its priority reserve or maxParallelOps, running + what the
 * fleet RAM cap, the pools and its queued-ready work allow). Pure over `core` (the api status fields ramThrottle,
 * poolLoad) and the counts. {allowed, why, fleetFree, poolFree, cap}.
 */
export function allowedParallelOf({ core = {}, running = 0, queuedReady = 0, workflowId, prio = priorities(), rt = runtimesDoc() }) {
  const rtCap = Number(rt?.maxParallelOps) || 20;
  const thr = core.ramThrottle ?? {};
  const effective = Number(thr.effectiveCap ?? rtCap);
  const fleetRunning = Number(thr.running ?? running);
  const fleetFree = Math.max(0, effective - fleetRunning);
  const pools = rt?.runtimes ?? {};
  const load = core.poolLoad?.running ?? {};
  let poolFree = 0;
  for (const [id, p] of Object.entries(pools)) poolFree += Math.max(0, (Number(p?.maxParallel) || 0) - (Number(load[p?.target ?? id] ?? load[id]) || 0));
  const reserve = prio[workflowId]?.reserve || 0;
  const cap = reserve > 0 ? reserve : rtCap;
  const add = Math.min(fleetFree, poolFree, queuedReady);
  const allowed = Math.min(cap, running + add);
  const binds = add === queuedReady ? 'queued-ready' : add === fleetFree ? `fleet RAM cap ${effective} (${fleetRunning} running fleet-wide)` : `pool slots (${poolFree} free; routed-but-undispatched jobs hold slots ${core.poolLoad?.routeHoldMs ? `for ${Math.round(core.poolLoad.routeHoldMs / 60_000)}m` : ''})`;
  return { allowed, cap, fleetFree, poolFree, why: allowed >= cap ? `workflow cap ${cap}` : binds };
}

/* ------------------------------------------------------------ progress */

/** Whether this workflow is the top-priority one (highest weight > 1). */
export function isPriority(workflowId, prio = priorities()) {
  const w = prio[workflowId]?.weight ?? 1;
  if (w <= 1) return false;
  return Object.values(prio).every((p) => (p.weight ?? 1) <= w);
}

/**
 * The progress block of `api status`. Pure over its inputs: `jobs` (opJobsOf), `core` (the api status out: legs,
 * frontier, ramThrottle, poolLoad, stuck), `createdAt` (the workflow row), `now`, `settings`.
 */
export function progressOf({ jobs, core = {}, workflowId, createdAt = null, now = Date.now(), settings = progressSettings(), prio = priorities() }) {
  const units = unitsOf(jobs).filter((u) => u.state !== 'dropped');
  const done = units.filter((u) => u.state === 'done');
  const total = units.length;
  const inWin = (ms) => done.filter((u) => u.doneAt >= now - ms).length;
  const unitsPerHour = Math.round(inWin(settings.windowMs) / (settings.windowMs / HOUR) * 10) / 10;
  const etaRate = inWin(settings.etaWindowMs) / (settings.etaWindowMs / HOUR);
  const remaining = total - done.length;
  const running = jobs.filter((j) => RUNNING_JOB.includes(j.status)).length;
  const queued = core.frontier?.queued ?? [];
  const readyJobs = queued.filter((q) => q.queuedBecause === 'ready').map((q) => q.jobId);
  const queuedReady = readyJobs.length;
  const par = allowedParallelOf({ core, running, queuedReady, workflowId, prio });
  const legs = Array.isArray(core.legs) ? core.legs : [];
  const legsDone = legs.filter((l) => l.color === 'green').length;
  const lastDoneAt = done.length ? Math.max(...done.map((u) => u.doneAt)) : null;
  const priority = isPriority(workflowId, prio);
  const minRate = priority ? settings.minUnitsPerHour.priority : settings.minUnitsPerHour.default;
  const reasons = [];
  let since = null;
  const readySince = (core.stuck ?? []).filter((s) => s.kind === 'queued-ready').map((s) => Number(s.since)).filter(Number.isFinite);
  if (queuedReady > 0 && running < par.allowed) {
    reasons.push(`under-dispatched: ${running} running of ${par.allowed} allowed with ${queuedReady} queued-ready`);
    since = readySince.length ? Math.min(...readySince) : now;
  }
  const quietSince = lastDoneAt ?? Number(createdAt) ?? now;
  if (remaining > 0 && minRate > 0 && unitsPerHour < minRate && now - quietSince >= settings.graceMs) {
    reasons.push(`slow: ${unitsPerHour} units/h < ${minRate}/h${priority ? ' (priority workflow)' : ''}, last unit ${lastDoneAt ? `${Math.round((now - lastDoneAt) / 60_000)}m ago` : 'never'}`);
    since = since == null ? quietSince : Math.min(since, quietSince);
  }
  const failedUnits = units.filter((u) => u.state === 'failed').length;
  if (failedUnits > 0 && failedUnits >= done.length && remaining > 0) reasons.push(`failing: ${failedUnits} unit(s) parked failed vs ${done.length} done`);
  const sinceMs = since == null ? 0 : Math.max(0, now - since);
  return {
    schema: 'starci/progress@1', priority, unitsTotal: total, unitsDone: done.length, unitsOpen: units.filter((u) => u.state === 'open').length, unitsFailed: failedUnits,
    unitsPerHour, minUnitsPerHour: minRate, share: total ? Math.round(done.length / total * 1000) / 1000 : null,
    legs: { done: legsDone, total: legs.length },
    running, allowedParallel: par.allowed, parallelCap: par.cap, parallelWhy: par.why, queuedReady, readyJobs,
    etaHours: remaining === 0 ? 0 : etaRate > 0 ? Math.round(remaining / etaRate * 10) / 10 : null,
    eta: remaining === 0 ? new Date(now).toISOString() : etaRate > 0 ? new Date(now + remaining / etaRate * HOUR).toISOString() : null,
    lastUnitAt: lastDoneAt ? new Date(lastDoneAt).toISOString() : null,
    stall: { stalled: reasons.length > 0, reasons, since: since ? new Date(since).toISOString() : null, sinceMin: Math.round(sinceMs / 60_000),
      kernelDue: reasons.length > 0, supervisorDue: reasons.length > 0 && sinceMs >= settings.supervisorGraceMs },
  };
}

export const progressLine = (p) => `progress ${p.unitsDone}/${p.unitsTotal} units (${p.share == null ? '-' : Math.round(p.share * 100)}%), ${p.unitsPerHour}/h${p.minUnitsPerHour ? ` (min ${p.minUnitsPerHour})` : ''}, legs ${p.legs.done}/${p.legs.total}, running ${p.running}/${p.allowedParallel} allowed (${p.parallelWhy}), queued-ready ${p.queuedReady}, ETA ${p.eta ? p.eta.slice(0, 16).replace('T', ' ') : 'unknown'}${p.stall.stalled ? ` - STALL ${p.stall.sinceMin}m: ${p.stall.reasons.join('; ')}` : ''}`;

/* ------------------------------------------------------------ failure causes */

// The cause catalogue: label -> {why, authority}. authority kernel = the Kernel fixes it inside its workflow;
// supervisor = a runtime/.claude or cross-workflow cause (the Kernel files a kernel-proposal, the Supervisor owns it).
export const CAUSES = Object.freeze({
  'dead-worker': { why: 'the worker died or wedged without a report', authority: 'supervisor' },
  'missing-paths': { why: 'the unit was cut on paths that do not exist in the target checkout', authority: 'kernel' },
  'grant-too-narrow': { why: 'the fix needs files outside the unit\'s owned paths (moves, shared files, config)', authority: 'kernel' },
  'tool-timeout': { why: 'a required validator did not finish inside the agent\'s command window', authority: 'kernel' },
  'test-gap': { why: 'no regression test covers the unit, so the refactor refuses to start', authority: 'kernel' },
  'partial-commit': { why: 'the unit committed its in-ceiling part and stopped: progress, not a failure', authority: 'kernel' },
  'canon-conflict': { why: 'the cut asks for a location a canon rule forbids', authority: 'kernel' },
  'binding-defect': { why: 'the runtime bound the job to the wrong repository/guard', authority: 'supervisor' },
  'checker-unavailable': { why: 'a required checker answered unavailable', authority: 'supervisor' },
  upstream: { why: 'the root cause lives in another workflow', authority: 'supervisor' },
  'product-defect': { why: 'the product code failed its checks', authority: 'kernel' },
  other: { why: 'unclassified', authority: 'kernel' },
});
const SHAPE_CAUSES = new Set(['missing-paths', 'grant-too-narrow', 'tool-timeout', 'test-gap', 'canon-conflict', 'product-defect']);
export const isShapeCause = (c) => SHAPE_CAUSES.has(c);

const COMMIT_RE = /\b(?:commit(?:ted)?|land(?:ed)?(?: commit)?|đã (?:land )?commit)\s+([0-9a-f]{7,40})\b/i;
const PATH_RE = /(?:^|[\s`'"(,:])((?:apps|packages|src|libs|e2e)\/[A-Za-z0-9_@.\-[\]()/]+?[A-Za-z0-9_\])])(?=[\s`'",;:)]|$)/g;

/** The causes of one failed/blocked attempt, primary first. Pure. */
export function causesOf({ status = 'failed', result = {}, report = null }) {
  const blocker = report?.blocker ?? {};
  const kind = String(blocker.kind ?? '').toLowerCase();
  const text = [report?.summary, blocker.detail, report?.rootCause?.claim, JSON.stringify(report?.openItems ?? ''), ...(report?.checks ?? []).map((c) => `${c.name} ${c.evidence ?? ''} exit=${c.exitCode ?? ''}`)].join(' \n ');
  const causes = [];
  const add = (c) => { if (!causes.includes(c)) causes.push(c); };
  if (!report && (result?.worker?.liveness || result?.reportFiled === false)) add('dead-worker');
  if (/guard file|bind(?:s|ing)? owned|role be, repo ledger|wrong repository/i.test(text)) add('binding-defect');
  if (/không tồn tại|vắng mặt|does not exist|do not exist|not exist(?:ing)?\b|are absent|is absent|files=0|0 tệp|quét 0|scanned 0/i.test(text)) add('missing-paths');
  if (kind === 'shared-change' || /ngoài owned|outside (?:the )?(?:owned|allowlist|grant|binding)|ngoài allowlist|ngoài grant|NGOÀI own|beyond the grant/i.test(text)) add('grant-too-narrow');
  if (/timed? ?out|timeout|30[- ]?s(?:econd)?\b|30 giây|exit(?:code)?[=: ]*124|ngắt sau/i.test(text)) add('tool-timeout');
  if (kind === 'test-gap' || /regression suite|kiểm thử hồi quy|no (?:existing )?regression/i.test(text)) add('test-gap');
  if (kind === 'grammar-gap' || /MONOREPO_TIER|monorepo-tier|canon rule .* forbids/i.test(text)) add('canon-conflict');
  if (/status[= ]unavailable|unavailable \(exit|checker (?:is )?unavailable|không khả dụng/i.test(text) && kind === 'environment') add('checker-unavailable');
  if (report?.rootCause && report.rootCause.self === false && /^wf-/.test(String(report.rootCause.node ?? ''))) add('upstream');
  if (report && COMMIT_RE.test(text) && (report.outcome === 'blocked' || status === 'failed')) add('partial-commit');
  if (!causes.length && report && (result?.verdict === 'fail' || report.outcome === 'failed')) add('product-defect');
  if (!causes.length) add(kind === 'environment' ? 'checker-unavailable' : 'other');
  // A partial commit is a secondary fact: the blocker that stopped the unit leads.
  if (causes[0] === 'partial-commit' && causes.length > 1) causes.push(causes.shift());
  return causes;
}

/** The repository paths a report names that its unit does not own (the destinations a move needs). Pure. */
export function destinationsOf(report, ownedPaths = []) {
  const text = [report?.summary, report?.blocker?.detail, report?.rootCause?.claim].join(' ');
  const owned = ownedPaths.map((p) => String(p).replace(/\\/g, '/').replace(/^[^/]*\/(?=(?:apps|packages)\/)/, ''));
  const out = new Set();
  for (const m of text.matchAll(PATH_RE)) {
    const p = m[1].replace(/[.,)]+$/, '').replace(/\/+$/, '');
    if (p.includes('<') || p.includes('*')) continue;
    if (owned.some((o) => p === o || p.startsWith(`${o}/`) || o.startsWith(`${p}/`))) continue;
    out.add(p);
  }
  return [...out].slice(0, 8);
}

/* ------------------------------------------------------------ RCA */

/** Reports keyed op|attempt for one workflow. */
export function reportsOf(db, workflowId) {
  const m = new Map();
  for (const r of db.prepare('SELECT op_id, attempt, outcome, report_json, created_at FROM reports WHERE workflow_id=? ORDER BY report_id').all(workflowId)) {
    m.set(`${r.op_id}|${r.attempt}`, { ...parse(r.report_json), outcome: r.outcome, at: Number(r.created_at) });
  }
  return m;
}

const commitOf = (report) => { const m = COMMIT_RE.exec([report?.summary, report?.blocker?.detail].join(' ')); return m ? m[1] : null; };

/**
 * The failure-cluster RCA over every failed/blocked attempt of the workflow in the RCA window, read together.
 * Pure over `jobs`, `reports`. {window, attempts, byOp, clusters: [{cause, why, authority, count, open, units, jobs,
 * examples, commits, destinations}], trigger}.
 */
export function rcaOf({ jobs, reports, now = Date.now(), settings = progressSettings(), stalled = false }) {
  const units = unitsOf(jobs);
  const unitOf = new Map(units.flatMap((u) => u.jobs.map((j) => [j.job_id, u])));
  const since = now - settings.rca.windowMs;
  const rows = [];
  for (const j of jobs) {
    if (j.status !== 'failed' || Number(j.updated_at) < since) continue;
    if (['dropped', 'superseded', 'awaiting-owner'].includes(j.result?.verdict)) continue;
    const report = reports.get(`${j.op_id}|${j.attempt}`) ?? null;
    const u = unitOf.get(j.job_id);
    const causes = causesOf({ status: j.status, result: j.result, report });
    rows.push({ jobId: j.job_id, op: j.op_id, unit: u?.key ?? null, unitState: u?.state ?? null, causes, at: Number(j.updated_at),
      summary: one(report?.summary ?? report?.blocker?.detail ?? j.result?.environment ?? j.result?.worker?.liveness ?? j.result?.verdict, 200),
      commit: commitOf(report), destinations: report ? destinationsOf(report, j.payload?.owned_paths ?? []) : [], env: j.result?.environment ?? null,
      liveness: j.result?.worker?.liveness ?? null, paths: j.payload?.owned_paths ?? [] });
  }
  const byOp = {};
  for (const r of rows) byOp[r.op] = (byOp[r.op] ?? 0) + 1;
  const trigger = stalled ? 'progress-stall' : Object.entries(byOp).filter(([, n]) => n >= settings.rca.minFailures).map(([op, n]) => `${op} x${n}`).join(', ') || null;
  const clusters = new Map();
  for (const r of rows) {
    for (const c of r.causes) {
      if (!clusters.has(c)) clusters.set(c, { cause: c, why: CAUSES[c]?.why ?? c, authority: CAUSES[c]?.authority ?? 'kernel', rows: [] });
      clusters.get(c).rows.push(r);
    }
  }
  const out = [...clusters.values()].map((c) => {
    const openRows = c.rows.filter((r) => r.unitState !== 'done');
    return {
      cause: c.cause, why: c.why, authority: c.authority, primary: c.rows.filter((r) => r.causes[0] === c.cause).length,
      count: c.rows.length, open: openRows.length, units: [...new Set(openRows.map((r) => r.unit).filter(Boolean))],
      jobs: c.rows.map((r) => r.jobId), examples: c.rows.slice(-settings.rca.examples).map((r) => `${r.jobId}: ${r.summary}`),
      commits: [...new Set(c.rows.map((r) => r.commit).filter(Boolean))], destinations: [...new Set(openRows.flatMap((r) => r.destinations))].slice(0, 12),
      envs: [...new Set(c.rows.map((r) => r.env ?? r.liveness).filter(Boolean))],
    };
  }).sort((a, b) => b.open - a.open || b.count - a.count);
  return { schema: 'starci/rca@1', windowMs: settings.rca.windowMs, attempts: rows.length, byOp, trigger, clusters: out, rows };
}

/* ------------------------------------------------------------ decisions (the Kernel's log) */

/** The Kernel's decision log folded: [{id, hypothesis, actionKey, command, status: open|keep|revert, ...}]. */
export function decisionsOf(db, workflowId) {
  const out = new Map();
  for (const e of db.prepare('SELECT kind, entity_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN (?,?) ORDER BY seq').all(workflowId, DECISION_KIND, DECISION_RESULT_KIND)) {
    const p = parse(e.payload_json);
    if (e.kind === DECISION_KIND) out.set(e.entity_id, { id: e.entity_id, ...p, status: 'open', at: Number(e.created_at) });
    else if (out.has(e.entity_id)) Object.assign(out.get(e.entity_id), { status: p.result, observed: p.observed ?? null, closedAt: Number(e.created_at), after: p.after ?? null });
  }
  return [...out.values()];
}

/* ------------------------------------------------------------ ranked actions */

const q = (s) => (/[\s,;"'[\]()]/.test(String(s)) ? `"${String(s).replace(/"/g, '\\"')}"` : String(s));
const actionKey = (...parts) => parts.join(':');

/**
 * The ranked candidate actions. Pure over what it is given: `progress`, `rca`, `units` (unitsOf), `workflowId`,
 * `repo`, `decisions`, `missingQueued` ([{jobId, paths}] of queued units whose every owned path is absent on disk).
 * Each: {rank, key, tier: light|heavy|proposal|supervisor, title, command, expected, unblocks, cause, tried}.
 */
export function actionsOf({ progress, rca, units = [], workflowId, repo = '<repo>', decisions = [], missingQueued = [], settings = progressSettings(), recutOp = null }) {
  const api = `node scripts/kernel/api.mjs`;
  const base = `--repo ${q(repo)} --workflow ${workflowId}`;
  const acts = [];
  const add = (a) => acts.push(a);
  const N = settings.maxUnitsPerEdit;
  const openUnits = (keys) => units.filter((u) => keys.includes(u.key));
  const queuedOf = (u) => u.jobs.filter((j) => j.status === 'queued');
  const lastFailedOf = (u) => [...u.jobs].reverse().find((j) => j.status === 'failed') ?? null;
  const cl = new Map((rca?.clusters ?? []).map((c) => [c.cause, c]));

  // 1. parallelism: the cheapest, most certain win.
  if (progress && progress.queuedReady > 0 && progress.running < progress.allowedParallel) {
    const k = progress.allowedParallel - progress.running;
    add({ key: actionKey('dispatch-ready'), tier: 'light', cause: 'under-dispatched', unblocks: k,
      title: `dispatch ${k} more queued-ready unit(s) (running ${progress.running} of ${progress.allowedParallel} allowed)`,
      command: `${api} dispatch-ready ${base} --max ${k}`, expected: `running ${progress.running} -> ${progress.allowedParallel}; units/h rises within the next wake` });
  }
  // 2. heavy re-cut when the cut itself is wrong (missing paths + grants too narrow across many units).
  const cutWrong = (cl.get('missing-paths')?.open ?? 0) + (cl.get('grant-too-narrow')?.open ?? 0) + missingQueued.length;
  // The cut itself is wrong when its wrong-shaped units reach recutThreshold AND a quarter of the open units: below
  // that, the light edits (drop, widen, wire) fix it without disturbing the units that are right.
  const openCount = units.filter((u) => u.state === 'open' || u.state === 'failed').length;
  const cutIsWrong = cutWrong >= Math.max(settings.recutThreshold, Math.ceil(openCount / 4));
  if (missingQueued.length) {
    const drop = missingQueued.slice(0, N).map((m) => m.jobId);
    add({ key: actionKey('drop', ...drop), tier: 'light', cause: 'missing-paths', unblocks: drop.length,
      title: `drop ${drop.length} queued unit(s) whose every owned path is absent in the checkout (${missingQueued.slice(0, N).map((m) => m.paths[0]).join(', ')})`,
      command: `${api} graph-edit ${base} --edit drop --jobs ${drop.join(',')} --reason "every owned path is absent in the checkout" --decision <id>`,
      expected: 'no agent spends an attempt on a unit with nothing to refactor; if the paths were meant as move targets, re-enqueue them with their sources' });
  }
  if (cutWrong >= settings.recutThreshold && recutOp) {
    const canon = recutOp.canon;
    add({ key: actionKey('recut', recutOp.op, recutOp.cutId), tier: 'heavy', cause: 'missing-paths+grant-too-narrow', unblocks: cutIsWrong ? Math.max(cutWrong, openCount) : 0.5,
      title: canon
        ? `re-cut the remaining ${recutOp.op} units of cut ${recutOp.cutId} from a FRESH canon-scan (the goal's own cut method): ${cutWrong} unit(s) were cut on absent paths or too-narrow grants`
        : `dispatch work.author to re-cut the remaining ${recutOp.op} units of cut ${recutOp.cutId} with this RCA as its brief`,
      command: canon
        ? `${api} graph-edit ${base} --edit scan --op ${recutOp.op} --cut-id ${recutOp.cutId} --decision <id>   (then, when it reports done: ${api} graph-edit ${base} --edit recut --op ${recutOp.op} --cut-id ${recutOp.cutId} --from-scan <file it names> --decision <id>)`
        : `${api} redesign ${base} --op work.author --rca latest --paths <work.author write set> --decision <id>`,
      expected: 'every remaining unit owns paths that exist, grouped so moves and their consumers share a unit; the parked failed units retire' });
  }
  // 3. per cluster, the catalogue action.
  for (const c of rca?.clusters ?? []) {
    if (!c.open && c.cause !== 'dead-worker') continue;
    const us = openUnits(c.units);
    if (c.cause === 'partial-commit') {
      const targets = us.filter((u) => !u.open.length && lastFailedOf(u)).slice(0, N);
      if (targets.length) add({ key: actionKey('continue', ...targets.map((u) => u.key)), tier: 'light', cause: c.cause, unblocks: targets.length,
        title: `continue ${targets.length} partial commit(s) as continuation units instead of failures (${c.commits.slice(0, 3).join(', ')})`,
        command: targets.map((u) => `${api} graph-edit ${base} --edit continue --job ${lastFailedOf(u).job_id}${c.destinations.length ? ` --add-paths ${q(c.destinations.slice(0, 4).join(','))}` : ''} --decision <id>`).join(' && '),
        expected: 'the in-ceiling commits count toward the unit, the continuation starts from them' });
    } else if (c.cause === 'grant-too-narrow') {
      const rows = (rca.rows ?? []).filter((r) => r.causes.includes('grant-too-narrow') && r.unitState !== 'done');
      const shared = c.destinations.filter((d) => rows.filter((r) => r.destinations.includes(d)).length >= 2);
      const befores = us.flatMap(queuedOf).slice(0, N - 1).map((j) => j.job_id);
      if (shared.length) add({ key: actionKey('wire', ...shared.slice(0, 4)), tier: 'light', cause: c.cause, unblocks: us.length,
        title: `add ONE serial wire unit owning the shared destinations ${shared.slice(0, 4).join(', ')} that ${us.length} unit(s) need`,
        command: `${api} graph-edit ${base} --edit wire --op ${us[0]?.op ?? 'code.refactor'} --paths ${q(shared.slice(0, 6).join(','))}${befores.length ? ` --before ${befores.join(',')}` : ''} --decision <id>`,
        expected: 'the shared files move once, serially; the units that needed them run after it (a failed one: graph-edit retry --after <wire job>)' });
      const widen = us.filter((u) => queuedOf(u).length).slice(0, N);
      if (widen.length && c.destinations.length) add({ key: actionKey('widen', ...widen.map((u) => u.key)), tier: 'light', cause: c.cause, unblocks: widen.length,
        title: `widen ${widen.length} queued unit(s) to the destinations their reports name`,
        command: widen.map((u) => `${api} graph-edit ${base} --edit widen --job ${queuedOf(u)[0].job_id} --add-paths ${q(c.destinations.slice(0, 4).join(','))} --decision <id>`).join(' && '),
        expected: 'the unit may move its files into their canonical home (leases of other workflows are refused by the api)' });
      const retry = us.filter((u) => !u.open.length && lastFailedOf(u)).slice(0, N);
      for (const u of retry) {
        const r = rows.find((x) => x.unit === u.key);
        const dest = (r?.destinations ?? []).filter((d) => !shared.includes(d)).slice(0, 4);
        const commit = Boolean(r?.commit);
        if (!dest.length && !commit) continue;
        add({ key: actionKey(commit ? 'continue' : 'retry', u.key), tier: 'light', cause: c.cause, unblocks: 1,
          title: `${commit ? 'continue' : 'retry'} ${u.key} with the destinations its report names${dest.length ? ` (${dest.join(', ')})` : ''}`,
          command: `${api} graph-edit ${base} --edit ${commit ? 'continue' : 'retry'} --job ${lastFailedOf(u).job_id}${dest.length ? ` --add-paths ${q(dest.join(','))}` : ''} --decision <id>`,
          expected: 'the unit owns what its fix must touch; the api refuses the same failing shape and the paths of other workflows' });
      }
    } else if (c.cause === 'tool-timeout') {
      add({ key: actionKey('params', 'commandTimeoutMs'), tier: 'light', cause: c.cause, unblocks: c.open,
        title: 'give the op a longer command window and the background-run rule for long validators',
        command: `${api} op-override ${base} --op ${us[0]?.op ?? 'code.refactor'} --set '${JSON.stringify({ commandTimeoutMs: settings.commandTimeoutMs, notes: ['Long validators (canon-scan, scoped lint, typecheck) may exceed your tool window: start them in the background writing to a file, then poll that file until it is complete; never report blocked on a tool timeout.'] })}' --decision <id>`,
        expected: 'no unit blocks on a 30 s tool window; applies to every later dispatch of the op in this workflow' });
    } else if (c.cause === 'test-gap' && unitSpecsOff()) {
      add({ key: actionKey('params', 'specs-unit-off'), tier: 'light', cause: c.cause, unblocks: c.open,
        title: 'unit tests are deferred by the owner (config.yaml specs.unit=false): tell the op to guard behaviour with typecheck + canon-scan before/after instead of stopping',
        command: `${api} op-override ${base} --op ${us[0]?.op ?? 'code.refactor'} --set '${JSON.stringify({ notes: ['The owner deferred unit tests (config.yaml specs.unit=false): a missing regression suite is not a blocker in this workflow. Guard behaviour with typecheck and canon-scan before and after, and list the untested seams in the report.'] })}' --decision <id>`,
        expected: 'no unit stops on a missing regression suite while unit tests are deferred' });
    } else if (c.cause === 'test-gap') {
      const t = us.slice(0, N);
      if (t.length) add({ key: actionKey('test', ...t.map((u) => u.key)), tier: 'light', cause: c.cause, unblocks: t.length,
        title: `add a test.author unit before ${t.length} unit(s) that lack a regression test`,
        command: t.map((u) => `${api} graph-edit ${base} --edit wire --op test.author --paths ${q((lastFailedOf(u)?.payload?.owned_paths ?? []).slice(0, 3).join(','))} --before ${queuedOf(u)[0]?.job_id ?? '<the unit\'s next job>'} --decision <id>`).join(' && '),
        expected: 'the refactor unit starts with a regression test to hold parity' });
    } else if (c.cause === 'canon-conflict') {
      add({ key: actionKey('proposal', 'canon-conflict'), tier: 'proposal', cause: c.cause, unblocks: c.open,
        title: 'the cut asks for a location a canon rule forbids: propose the canon/cut fix (tier 2) and widen the unit to the canonical home meanwhile',
        command: `${api} kernel-proposal ${base} --title "cut vs canon location conflict" --evidence ${q(c.examples.join(' | ').slice(0, 400))} --decision <id>`,
        expected: 'the Supervisor lands the canon/cut fix or forwards it to the owner; the widened unit keeps moving' });
    } else if (c.cause === 'dead-worker' || c.cause === 'binding-defect' || c.cause === 'checker-unavailable') {
      add({ key: actionKey('proposal', c.cause), tier: 'supervisor', cause: c.cause, unblocks: c.open,
        title: `${c.cause} x${c.count} (${c.envs.join(', ') || 'no env'}): a runtime cause - file it once, then keep dispatching the healthy units`,
        command: `${api} kernel-proposal ${base} --title "${c.cause} x${c.count}" --evidence ${q(`${c.envs.join(',')} | ${c.examples.join(' | ')}`.slice(0, 400))} --decision <id>`,
        expected: 'the Supervisor fixes the runtime cause; the Kernel does not retry the same shape waiting for it' });
    } else if (c.cause === 'upstream') {
      add({ key: actionKey('supervisor', 'upstream'), tier: 'supervisor', cause: c.cause, unblocks: c.open,
        title: 'the root cause is in another workflow: message the peer and keep other units moving',
        command: `${api} notify ${base} --to peers --kind request --subject "root cause in your workflow" --body ${q(c.examples[0] ?? '')}`,
        expected: 'the peer fixes its side; the Supervisor watches the cross-workflow wait' });
    }
  }
  // Decision-log memory: an action tried and reverted sinks and is marked; an open one is measuring.
  const byKey = new Map();
  for (const d of decisions) if (d.actionKey) byKey.set(d.actionKey, d);
  for (const a of acts) {
    const d = byKey.get(a.key);
    a.tried = d ? { decision: d.id, status: d.status } : null;
  }
  const tierRank = { light: 0, heavy: 1, proposal: 2, supervisor: 3 };
  acts.sort((a, b) => (a.tried?.status === 'revert') - (b.tried?.status === 'revert') || (a.tried?.status === 'open') - (b.tried?.status === 'open')
    || b.unblocks - a.unblocks || tierRank[a.tier] - tierRank[b.tier]);
  // A heavy re-cut outranks the light edits it would make moot when it unblocks more.
  acts.forEach((a, i) => { a.rank = i + 1; });
  return acts;
}

/** The `why slow` line (Vietnamese owner digest / English lines). */
export function whyLine(rca, { language = 'vi', limit = 5 } = {}) {
  const cls = (rca?.clusters ?? []).filter((c) => c.open || c.cause === 'dead-worker').slice(0, limit);
  if (!cls.length) return null;
  const head = language === 'vi' ? 'Vì sao chậm' : 'Why slow';
  return `${head}: ${cls.map((c) => `${c.cause} x${c.count}${c.open !== c.count ? ` (${c.open} open)` : ''}`).join(', ')}`;
}

/** A stable id for one RCA snapshot (clusters + counts). */
export const rcaDigest = (rca) => crypto.createHash('sha1').update(JSON.stringify((rca?.clusters ?? []).map((c) => [c.cause, c.count, c.open]))).digest('hex').slice(0, 10);

/* ------------------------------------------------------------ the whole view */

/**
 * The cut to re-cut: the op|cut.id with the most open or failed units. {op, cutId, canon, units}. Pure.
 */
export function recutTargetOf(units) {
  const byCut = new Map();
  for (const u of units) {
    if (!u.cut?.id || u.state === 'done' || u.state === 'dropped') continue;
    const k = `${u.op}|${u.cut.id}`;
    if (!byCut.has(k)) byCut.set(k, { op: u.op, cutId: u.cut.id, canon: Boolean(u.last?.payload?.params?.canonFamilies), units: 0 });
    byCut.get(k).units += 1;
  }
  return [...byCut.values()].sort((a, b) => b.units - a.units)[0] ?? null;
}

/**
 * Queued, never-dispatched units whose every owned path is absent on disk: [{jobId, paths}]. `resolve(job)` maps a
 * job to absolute paths (null when it cannot tell - such a unit is never called missing).
 */
export function missingQueuedOf(units, resolve) {
  const out = [];
  // A path a running unit of this workflow owns (or sits under/over) may be created by it: never called missing.
  const low = (p) => String(p).replace(/\\/g, '/').toLowerCase();
  const running = units.flatMap((u) => u.jobs.filter((j) => RUNNING_JOB.includes(j.status))).flatMap((j) => (j.payload?.owned_paths ?? []).map(low));
  const near = (p) => running.some((r) => r === p || r.startsWith(`${p}/`) || p.startsWith(`${r}/`) || r.split('/').slice(0, -1).join('/') === p.split('/').slice(0, -1).join('/'));
  for (const u of units) {
    for (const j of u.jobs.filter((x) => x.status === 'queued' && !(x.payload?.after ?? []).length)) {
      if ((j.payload?.owned_paths ?? []).some((p) => near(low(p)))) continue;
      let abs = null;
      try { abs = resolve(j); } catch { abs = null; }
      if (Array.isArray(abs) && abs.length && abs.every((p) => p && !fs.existsSync(p))) out.push({ jobId: j.job_id, paths: j.payload?.owned_paths ?? [] });
    }
  }
  return out;
}

/**
 * progress + rca + ranked actions for one workflow, from its ledger. `resolve` as in missingQueuedOf.
 * {progress, rca, actions}.
 */
export function workflowView({ db, workflowId, core = {}, repo, now = Date.now(), settings = progressSettings(), resolve = null }) {
  const wf = db.prepare('SELECT created_at FROM workflows WHERE workflow_id=?').get(workflowId);
  const jobs = opJobsOf(db, workflowId);
  const progress = progressOf({ jobs, core, workflowId, createdAt: wf?.created_at ?? null, now, settings });
  const reports = reportsOf(db, workflowId);
  const rca = rcaOf({ jobs, reports, now, settings, stalled: progress.stall.stalled });
  const units = unitsOf(jobs);
  const missingQueued = resolve ? missingQueuedOf(units, resolve) : [];
  const decisions = decisionsOf(db, workflowId);
  const actions = actionsOf({ progress, rca, units, workflowId, repo, decisions, missingQueued, settings, recutOp: recutTargetOf(units) });
  const { rows, ...rcaOut } = rca;
  return { progress, rca: { ...rcaOut, id: rcaDigest(rca), why: whyLine(rca, { language: 'en' }), missingQueued, actions,
    decisions: decisions.slice(-8).map((d) => ({ id: d.id, actionKey: d.actionKey ?? null, status: d.status, hypothesis: one(d.hypothesis, 120), observed: d.observed ? one(d.observed, 120) : null })) } };
}
