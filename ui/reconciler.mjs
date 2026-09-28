// reconciler.mjs (ui) — the read models behind the owner's four pages (lane rc-fleet-ui; DESIGN §17.2, §19, §20).
// Owner 2026-09-28: "sửa .claude ux ui cho dễ track chứ giờ loạn thông tin quá". Every page answers from ONE endpoint
// that the server builds once per tick (never per request):
//
//   progressRow     one live workflow: units that PASSED their gates (scripts/kernel/progress-rca.mjs workflowView,
//                   the same function behind `api status` progress/rca; never an attempt count), units/hour, ETA, a
//                   state pill (ok | slow | stuck | done), the top RCA reason, who is on it and the next action.
//   unitBoard       the workflow's units grouped by the job state machine (DESIGN §9.1): queued, running, reported,
//                   settled, released.
//   productWorktreesOf  the workflow's product worktrees as Lane H records them (_wf + one per isolated op job).
//   reconcilerState leader, epoch, heartbeat age, controller modes, queue depth, would/act rows per controller,
//                   services, open SLA violations, GC summaries (reconciler.sqlite + the supervisor ledger).
//   decisionsOf     Decision Items across ledgers (scripts/reconciler/decisions.mjs listDecisions).
//
// Read-only throughout: ledgers through openLedgerReader / withSupervisorRead, reconciler.sqlite opened readOnly. A
// piece that does not exist yet (the engine before lane rc-engine lands) reads as null with a `why`, never invented.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { workflowView, unitsOf, opJobsOf, reportsOf, progressSettings, OPEN_JOB } from '../scripts/kernel/progress-rca.mjs';
import { listDecisions, SUPERVISOR_WF } from '../scripts/reconciler/decisions.mjs';
import { withSupervisorRead } from '../scripts/supervisor/home.mjs';
import { attemptOf, diffRefOf, unitGraphOf } from './unit-graph.mjs';

const optional = (spec) => import(spec).catch((error) => { if (error?.code === 'ERR_MODULE_NOT_FOUND') return null; throw error; });
// Lane A (rc-engine) owns state.mjs; lanes D/F own services.mjs and sla.mjs. Each is read only when present.
const [engineState, services, sla] = await Promise.all([optional('../scripts/reconciler/state.mjs'), optional('../scripts/reconciler/services.mjs'), optional('../scripts/reconciler/sla.mjs')]);

const HOUR = 3_600_000;
const CONTROLLERS = ['job', 'host', 'gc', 'resource', 'workflow', 'fleet', 'learning'];
const parse = (value, fallback = {}) => { try { return JSON.parse(value) ?? fallback; } catch { return fallback; } };
const clip = (value, n = 240) => { const s = String(value ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };

/* ------------------------------------------------------------ progress */

/**
 * The state pill of one workflow. Pure over the progress block (starci/progress@1), `now` and the grace window
 * (runtimes.yaml allocation.progress.supervisorGraceMs, 60 min):
 *   done   every unit passed its gates;
 *   stuck  work remains and nothing runs, or no unit passed its gates within the grace window;
 *   slow   the rate is under the workflow's minimum, or ready units wait while parallel slots are free (under-dispatch);
 *   ok     at or above the minimum rate with the allowed parallelism in use.
 * A stall reason alone (e.g. settles waiting on the Kernel) is not "stuck" while units keep passing.
 */
export function pillOf(p, { now = Date.now(), graceMs = 3_600_000 } = {}) {
  if (!p) return 'unknown';
  if (p.unitsTotal > 0 && p.unitsDone === p.unitsTotal) return 'done';
  const last = p.lastUnitAt ? Date.parse(p.lastUnitAt) : null;
  const quiet = last == null ? Boolean(p.stall?.stalled) : now - last > graceMs;
  if (p.running === 0 || quiet) return 'stuck';
  const underRate = p.minUnitsPerHour > 0 && p.unitsPerHour < p.minUnitsPerHour;
  const underDispatch = p.queuedReady > 0 && p.running < p.allowedParallel;
  if (underRate || underDispatch) return 'slow';
  return 'ok';
}

/**
 * Who is on it and the next action. Pure. `actionKey` (an rca action) lets the UI say it in one Vietnamese line;
 * `next` keeps the runtime's own text for the tooltip and the detail view. Order: an owner-only item, the most urgent live Decision Item, a stall the
 * Supervisor now owns (supervisorDue, or the top action is a runtime cause), a stall the Kernel owns, else the Kernel
 * dispatching. {who: owner|supervisor|kernel, next, source}.
 */
export function onItOf({ progress, actions = [], decisions = [], ownerAsks = [] }) {
  if (ownerAsks.length) return { who: 'owner', next: clip(ownerAsks[0].text, 200), source: 'progress-report asks' };
  // A supervisor-ruling / rev-ack DI is a notice the Kernel acknowledges, not the work in hand.
  const di = decisions.find((d) => ['open', 'claimed', 'escalated'].includes(d.status) && !['supervisor-ruling', 'rev-ack'].includes(d.kind));
  if (di) return { who: di.decider ?? 'kernel', next: clip(di.summary ?? di.kind, 200), source: `decision ${di.id}` };
  const top = actions.find((a) => a.tried?.status !== 'revert') ?? null;
  const stalled = Boolean(progress?.stall?.stalled);
  const nextOf = (who) => ({ who, next: clip(top?.title ?? progress.stall.reasons[0], 600), actionKey: top?.key ?? null, unblocks: top?.unblocks ?? null, source: top ? `rca action ${top.key}` : 'progress.stall' });
  if (stalled && (progress.stall.supervisorDue || top?.tier === 'supervisor')) return nextOf('supervisor');
  if (stalled) return nextOf('kernel');
  if (!progress) return { who: 'kernel', next: null, source: null };
  return { who: 'kernel', next: progress.queuedReady ? `giao ${progress.queuedReady} đơn vị sẵn sàng` : null, source: 'progress' };
}

/** The one-line top reason when a workflow is slow or stuck: the stall reason, else the top open RCA cluster. Pure. */
export function topReasonOf(progress, rca) {
  if (progress?.stall?.reasons?.length) return { text: clip(progress.stall.reasons[0], 200), cause: null, source: 'progress.stall.reasons[0]' };
  const c = (rca?.clusters ?? []).find((x) => x.open > 0);
  return c ? { text: clip(`${c.cause} ×${c.count} (${c.open} còn mở): ${c.why}`, 200), cause: c.cause, source: `rca.clusters[${c.cause}]` } : null;
}

/**
 * One live workflow's progress row. `core` is what the last `api status` of the workflow said (legs, frontier,
 * stuck, ramThrottle, poolLoad) - the progress block reads the ready queue and legs from it; without it the unit
 * counts, speed and ETA still hold. `decisions` are its live DIs, `ownerAsks` its non-credential asks.
 */
export function progressRow(db, { workflowId, repo, core = {}, now = Date.now(), decisions = [], ownerAsks = [] }) {
  const view = workflowView({ db, workflowId, core, repo, now });
  const { progress, rca } = view;
  const pill = pillOf(progress, { now, graceMs: progressSettings().supervisorGraceMs });
  const top = pill === 'slow' || pill === 'stuck' ? topReasonOf(progress, rca) : null;
  return {
    progress: {
      unitsDone: progress.unitsDone, unitsTotal: progress.unitsTotal, unitsOpen: progress.unitsOpen, unitsFailed: progress.unitsFailed,
      share: progress.share, unitsPerHour: progress.unitsPerHour, minUnitsPerHour: progress.minUnitsPerHour, priority: progress.priority,
      running: progress.running, allowedParallel: progress.allowedParallel, parallelWhy: clip(progress.parallelWhy, 160), queuedReady: progress.queuedReady,
      etaHours: progress.etaHours, eta: progress.eta, lastUnitAt: progress.lastUnitAt, legs: progress.legs,
      stall: { stalled: progress.stall.stalled, reasons: progress.stall.reasons.map((r) => clip(r, 240)), since: progress.stall.since, sinceMin: progress.stall.sinceMin, supervisorDue: progress.stall.supervisorDue },
      unsettled: progress.unsettledReports?.length ?? 0,
    },
    pill, topReason: top,
    onIt: onItOf({ progress, actions: rca.actions, decisions, ownerAsks }),
    rca: {
      id: rca.id, attempts: rca.attempts, trigger: rca.trigger, why: rca.why,
      clusters: rca.clusters.map((c) => ({ cause: c.cause, why: c.why, authority: c.authority, count: c.count, open: c.open, units: c.units.length, examples: c.examples.map((e) => clip(e, 240)) })),
      actions: (rca.actions ?? []).slice(0, 8).map((a) => ({ rank: a.rank, key: a.key, tier: a.tier, cause: a.cause, unblocks: a.unblocks, title: clip(a.title, 300), expected: clip(a.expected, 200), tried: a.tried })),
    },
    decisionLog: (rca.decisions ?? []).map((d) => ({ id: d.id, actionKey: d.actionKey, status: d.status, hypothesis: d.hypothesis, observed: d.observed })),
  };
}

/* ------------------------------------------------------------ units by job state */

export const UNIT_STATES = Object.freeze(['queued', 'running', 'reported', 'settled', 'released']);
const TERMINAL = new Set(['succeeded', 'failed', 'cancelled']);

/**
 * A unit's phase on the job state machine (DESIGN §9.1), from its newest job. Pure.
 *   queued    not dispatched yet;
 *   running   dispatched, no report filed;
 *   reported  a report is filed, the settle has not happened (the settler or the Kernel decides next);
 *   settled   terminal, but no release of its worker/lease was recorded (a leak candidate, GC's concern);
 *   released  terminal and released (job-settle-released or the worker released on report).
 */
export function unitPhaseOf(job, { reported, released }) {
  if (job.status === 'queued') return 'queued';
  if (!TERMINAL.has(job.status)) return reported ? 'reported' : 'running';
  return released ? 'released' : 'settled';
}

/**
 * The workflow's units grouped by phase: {counts, groups: {phase: [unit]}, graph}; each group keeps its newest `cap`.
 * A unit carries its newest attempt's provider/model and timing (`attempt`, unit-graph.mjs attemptOf), the Op's
 * report outcome (`outcome`) apart from the Kernel's settle verdict (`verdict`), and a pointer to its stored settled
 * diff (`diff`, served by GET /api/diff). `graph` is the recorded dependency DAG between ALL its units
 * (unit-graph.mjs unitGraphOf).
 */
export function unitBoard(db, workflowId, { cap = 60, nameOf = () => null, now = Date.now() } = {}) {
  const jobs = opJobsOf(db, workflowId);
  const reports = reportsOf(db, workflowId);
  const releasedIds = new Set(db.prepare("SELECT entity_id FROM events WHERE workflow_id=? AND kind IN ('job-settle-released','worker-released-on-report')").all(workflowId).map((r) => r.entity_id));
  // Each job's ledger events (timing of its attempt); only op-dispatched payloads are parsed.
  const jobIds = new Set(jobs.map((j) => j.job_id));
  const eventsOf = new Map();
  for (const e of db.prepare('SELECT entity_id, kind, created_at, payload_json FROM events WHERE workflow_id=? ORDER BY seq').all(workflowId)) {
    if (!jobIds.has(e.entity_id)) continue;
    if (!eventsOf.has(e.entity_id)) eventsOf.set(e.entity_id, []);
    eventsOf.get(e.entity_id).push({ kind: e.kind, created_at: Number(e.created_at), payload: e.kind === 'op-dispatched' ? parse(e.payload_json) : null });
  }
  // Stored settled patches (api settle -> job_artifacts kind patch); the newest row of a job wins.
  const patches = new Map();
  if (hasTable(db, 'job_artifacts')) for (const r of db.prepare("SELECT job_id, label, head_sha, landed_sha, created_at FROM job_artifacts WHERE workflow_id=? AND kind='patch' ORDER BY created_at").all(workflowId)) patches.set(r.job_id, r);
  const units = unitsOf(jobs);
  const groups = Object.fromEntries(UNIT_STATES.map((s) => [s, []]));
  for (const u of units) {
    const job = u.last;
    const phase = unitPhaseOf(job, { reported: reports.has(`${job.op_id}|${job.attempt}`), released: releasedIds.has(job.job_id) || Boolean(job.payload?.workerReleased) });
    const report = reports.get(`${job.op_id}|${job.attempt}`);
    groups[phase].push({
      key: u.key, op: job.op_id, jobId: job.job_id, status: job.status, unitState: u.state, attempts: u.jobs.length,
      label: clip(u.cut ? `${u.cut.id} #${u.cut.ordinal}${u.cut.total ? `/${u.cut.total}` : ''}` : job.payload?.title ?? job.job_id, 120),
      title: clip(job.payload?.title ?? '', 160) || null, displayName: nameOf(job.job_id) ?? null,
      verdict: job.result?.verdict ?? null, outcome: report?.outcome ?? null, summary: report ? clip(report.summary ?? report.blocker?.detail ?? '', 220) : null,
      at: Number(job.updated_at) || Number(job.created_at) || null,
      attempt: attemptOf(job, eventsOf.get(job.job_id) ?? [], report ?? null),
      diff: diffRefOf(u, patches),
    });
  }
  const counts = {};
  for (const s of UNIT_STATES) { groups[s].sort((a, b) => (b.at ?? 0) - (a.at ?? 0)); counts[s] = groups[s].length; groups[s] = groups[s].slice(0, cap); }
  return { counts, groups, graph: { ...unitGraphOf(jobs, units), at: now, source: 'this workflow\'s ledger jobs (payload after, cut), read once per status tick' } };
}

/* ------------------------------------------------------------ worktrees */

/**
 * The product worktrees of one workflow as Lane H lays them out (scripts/kernel/product-worktree.mjs, the source of
 * its `status` verb, read here over the read-only ledger handle): <repo>/.starciwork/worktrees/<wf8>/_wf on branch
 * wf/<wf8>, and <wf8>/<op8> on op/<op8> per isolated op job. Each: {kind, path, branch, short, jobId, jobStatus,
 * exists, state: active | awaiting-reap | removed | missing}. [] when the module is absent or nothing is isolated.
 */
export async function productWorktreesOf(db, workflowId) {
  const pw = await optional('../scripts/kernel/product-worktree.mjs');
  if (!pw?.isolatedJobs) return [];
  let jobs = [];
  try { jobs = pw.isolatedJobs(db, { workflowId }); } catch { return []; }
  const removedKind = pw.EVENTS?.removed ?? 'job-worktree-removed';
  const removed = new Set(db.prepare('SELECT entity_id FROM events WHERE workflow_id=? AND kind=?').all(workflowId, removedKind).map((r) => r.entity_id));
  const out = [];
  const wfSeen = new Set();
  for (const { row, record } of jobs) {
    const wf = record.workflow;
    if (wf?.path && !wfSeen.has(wf.path)) {
      wfSeen.add(wf.path);
      const exists = fs.existsSync(wf.path);
      out.push({ kind: 'wf', path: wf.path, branch: wf.branch ?? null, short: wf.short ?? null, jobId: null, jobStatus: null, exists, state: exists ? 'active' : 'missing' });
    }
    const op = record.op;
    if (!op?.path) continue;
    const exists = fs.existsSync(op.path);
    const terminal = TERMINAL.has(row.status);
    out.push({ kind: 'op', path: op.path, branch: op.branch ?? null, short: op.short ?? null, jobId: row.job_id, jobStatus: row.status, exists,
      state: exists ? (terminal ? 'awaiting-reap' : 'active') : removed.has(row.job_id) || terminal ? 'removed' : 'missing', at: Number(row.updated_at) || null });
  }
  return out.sort((a, b) => (a.kind === 'wf' ? -1 : 0) - (b.kind === 'wf' ? -1 : 0) || (b.at ?? 0) - (a.at ?? 0));
}

/* ------------------------------------------------------------ decisions */

const diView = (d, ledger) => ({
  id: d.id, kind: String(d.kind ?? ''), decider: d.decider ?? null, status: String(d.status ?? ''), ledger, workflowId: d.productWorkflowId ?? d.workflowId ?? null,
  summary: clip(d.summary, 300), entity: d.entity ? { type: d.entity.type, id: clip(d.entity.id, 120) } : null,
  openedBy: d.openedBy ?? null, openedAt: d.openedAt ?? null, dueAt: d.dueAt ?? null, escalations: d.escalations ?? 0, severity: d.severity ?? null,
  claim: d.claim ? { by: clip(d.claim.by, 80), at: d.claim.at } : null,
  resolution: d.resolution ? { by: clip(d.resolution.by, 80), verb: clip(d.resolution.verb, 160), at: d.resolution.at } : null,
  options: (d.options ?? []).slice(0, 4).map((o) => ({ key: clip(o.key, 60), recommended: Boolean(o.recommended) })),
});

/** DIs of one product ledger (live ones, plus the newest `recent` closed ones): [DiView]. */
export function productDecisions(db, { ledger, workflowId = null, recent = 10, now = Date.now() } = {}) {
  try {
    const all = listDecisions(db, { workflowId, all: true, now });
    const live = all.filter((d) => ['open', 'claimed', 'escalated'].includes(d.status));
    const closed = all.filter((d) => !live.includes(d)).sort((a, b) => (b.resolution?.at ?? b.openedAt ?? 0) - (a.resolution?.at ?? a.openedAt ?? 0)).slice(0, recent);
    return [...live, ...closed].map((d) => diView(d, ledger));
  } catch { return []; }
}

/** The Supervisor's DIs (supervisor ledger, workflow wf-supervisor): live plus the newest `recent` closed. */
export function supervisorDecisions({ recent = 15, now = Date.now(), env = process.env } = {}) {
  return withSupervisorRead((db) => productDecisions(db, { ledger: 'supervisor', workflowId: SUPERVISOR_WF, recent, now }), [], { env });
}

/* ------------------------------------------------------------ the reconciler itself */

const stateFile = (env = process.env) => {
  if (engineState?.reconcilerStateFile) try { return engineState.reconcilerStateFile(env); } catch { /* fall through */ }
  if (services?.reconcilerDbFile) return services.reconcilerDbFile(env);
  return path.join(path.resolve(env.STARCI_SUPERVISOR_HOME || path.join(os.homedir(), '.starci', 'supervisor')), 'reconciler.sqlite');
};
function withStateReader(fn, fallback, env) {
  const file = stateFile(env);
  if (!fs.existsSync(file)) return fallback;
  let db = null;
  try { db = new DatabaseSync(file, { readOnly: true }); return fn(db); } catch { return fallback; } finally { try { db?.close(); } catch { /* closed */ } }
}
const hasTable = (db, name) => Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(name));

/** The modes the config asks for (lane A reconcilerConfig), else null. */
function configuredModes() {
  if (!engineState?.configuredMode || !engineState?.reconcilerConfig) return null;
  try { const conf = engineState.reconcilerConfig(); return Object.fromEntries(CONTROLLERS.map((c) => [c, engineState.configuredMode(c, conf)])); } catch { return null; }
}

/**
 * The engine as the UI shows it. {engine: {running, why, holder, pid, epoch, heartbeatAgeMs, rev}, controllers:
 * [{name, mode, modeAt, lastPassAt, would, acts, failed, errors, events, lastActAt, lastErrorAt, lastError, queue}] for
 * the seven controllers, others (engine/SLA rows), windowMs, logSource, queueDepth, services: {healthy, total, rows,
 * source}, violations: {open, byCode, rows}, gc: {lastAt, summary, leftovers}}. The engine does not measure CPU or RAM
 * per controller, so there is no such field.
 */
export function reconcilerState({ now = Date.now(), env = process.env, serviceProbe = null, windowMs = 24 * HOUR } = {}) {
  const st = withStateReader((db) => ({
    leader: hasTable(db, 'leader') ? db.prepare('SELECT * FROM leader ORDER BY heartbeat_at DESC LIMIT 1').get() ?? null : null,
    modes: hasTable(db, 'modes') ? Object.fromEntries(db.prepare('SELECT controller, mode, set_at FROM modes').all().map((r) => [r.controller, { mode: r.mode, at: r.set_at }])) : {},
    queue: hasTable(db, 'queue') ? db.prepare('SELECT controller, count(*) n, min(due_at) due, sum(CASE WHEN last_error IS NOT NULL THEN 1 ELSE 0 END) failing FROM queue GROUP BY controller').all() : [],
    actions: hasTable(db, 'actions') ? db.prepare('SELECT controller, state, count(*) n, max(finished_at) last FROM actions WHERE started_at>=? GROUP BY controller, state').all(now - windowMs) : [],
    services: hasTable(db, 'services') ? db.prepare('SELECT name, state, since, restarts_json, last_probe_json FROM services').all() : [],
    clocks: hasTable(db, 'sla_clocks') ? db.prepare('SELECT entity, state, entered_at, sla_ms, violated_at FROM sla_clocks WHERE cleared_at IS NULL').all() : [],
  }), null, env);
  const leader = st?.leader ?? null;
  const heartbeatAgeMs = leader ? Math.max(0, now - Number(leader.heartbeat_at)) : null;
  const running = Boolean(leader && Number(leader.expires_at) > now);
  const engine = { running, holder: leader?.holder ?? null, pid: leader?.pid ?? null, epoch: leader?.epoch ?? null, heartbeatAgeMs, rev: leader?.rev ?? null,
    why: running ? null : !st ? 'chưa có reconciler.sqlite' : !leader ? 'engine chưa từng giữ leader (lane rc-engine chưa land hoặc chưa khởi động)' : 'leader đã hết hạn' };

  // would/act/error rows per controller from the supervisor ledger's typed log (ctx.mjs writes them).
  const rows = withSupervisorRead((db) => {
    if (!hasTable(db, 'logs')) return { byController: {}, gc: null };
    const byController = {};
    for (const r of db.prepare("SELECT kind, count(*) n, max(at) last FROM logs WHERE workflow_id=? AND kind LIKE 'reconciler.%' AND at>=? GROUP BY kind").all(SUPERVISOR_WF, now - windowMs)) {
      byController._all ??= {}; byController._all[r.kind] = { n: r.n, last: r.last };
    }
    // A row names its controller in data.controller (ctx.mjs). The engine logs a controller's failed reconcile as
    // controller `engine` with data.name = the controller that failed (engine.mjs reconcile-failed): that error is
    // the named controller's. Rows of the engine itself and of the SLA layer are not a controller's (`others`).
    for (const r of db.prepare("SELECT kind, msg, data_json, at FROM logs WHERE workflow_id=? AND kind IN ('reconciler.would','reconciler.act','reconciler.error','reconciler.event') AND at>=? ORDER BY seq DESC LIMIT 5000").all(SUPERVISOR_WF, now - windowMs)) {
      const data = parse(r.data_json);
      const failedOf = data.controller === 'engine' && data.kind === 'reconciler.reconcile-failed' && typeof data.name === 'string' && data.name ? data.name : null;
      const c = failedOf ?? data.controller ?? data.ctl ?? 'unknown';
      const slot = (byController[c] ??= { would: 0, acts: 0, errors: 0, events: 0, last: null, lastWould: null, lastActAt: null, lastErrorAt: null, lastError: null });
      const at = Number(r.at);
      if (r.kind === 'reconciler.would') { slot.would++; slot.lastWould ??= clip(`${data.verb ?? data.action ?? ''} ${data.argv ?? ''}`, 160); }
      else if (r.kind === 'reconciler.act') { slot.acts++; slot.lastActAt = Math.max(slot.lastActAt ?? 0, at); }
      else if (r.kind === 'reconciler.error') { slot.errors++; if (at > (slot.lastErrorAt ?? 0)) { slot.lastErrorAt = at; slot.lastError = clip(r.msg, 240); } }
      else slot.events++;
      slot.last = Math.max(slot.last ?? 0, at);
    }
    const gcRow = db.prepare("SELECT msg, data_json, at FROM logs WHERE workflow_id=? AND kind='gc.summary' ORDER BY seq DESC LIMIT 1").get(SUPERVISOR_WF);
    const gcDay = db.prepare("SELECT count(*) n FROM logs WHERE workflow_id=? AND kind='gc.collect' AND at>=?").get(SUPERVISOR_WF, now - windowMs);
    return { byController, gc: gcRow ? { at: Number(gcRow.at), msg: clip(gcRow.msg, 300), data: parse(gcRow.data_json), collected24h: gcDay?.n ?? 0 } : null };
  }, { byController: {}, gc: null }, { env });

  const conf = configuredModes();
  const queueOf = new Map((st?.queue ?? []).map((q) => [q.controller, q]));
  const actsOf = (c) => (st?.actions ?? []).filter((a) => a.controller === c);
  const empty = { would: 0, acts: 0, errors: 0, events: 0, last: null, lastWould: null, lastActAt: null, lastErrorAt: null, lastError: null };
  const controllers = CONTROLLERS.map((name) => {
    const r = rows.byController[name] ?? empty;
    const q = queueOf.get(name);
    const journal = actsOf(name);
    return { name, mode: st?.modes?.[name]?.mode ?? conf?.[name] ?? null, modeSource: st?.modes?.[name] ? 'reconciler.sqlite modes' : conf ? 'config.yaml reconciler.controllers' : null,
      modeAt: Number(st?.modes?.[name]?.at) || null,
      lastPassAt: r.last ?? (journal.length ? Math.max(...journal.map((a) => Number(a.last) || 0)) || null : null),
      would: r.would, acts: r.acts || journal.filter((a) => a.state === 'done').reduce((n, a) => n + a.n, 0), failed: journal.filter((a) => a.state === 'failed').reduce((n, a) => n + a.n, 0), errors: r.errors,
      events: r.events, lastActAt: r.lastActAt, lastErrorAt: r.lastErrorAt, lastError: r.lastError,
      lastWould: r.lastWould, queue: q ? { depth: q.n, failing: q.failing, dueAt: q.due } : { depth: 0, failing: 0, dueAt: null } };
  });
  // Rows that are no controller's: the engine's own (leader, epoch, its own failures) and the SLA layer's.
  const others = Object.entries(rows.byController).filter(([name]) => !CONTROLLERS.includes(name) && name !== '_all')
    .map(([name, r]) => ({ name, would: r.would, acts: r.acts, errors: r.errors, events: r.events, lastAt: r.last, lastErrorAt: r.lastErrorAt, lastError: r.lastError }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Services: the Host controller's store when it has rows, else the UI's own probe (serviceProbe, same registry).
  const stored = (st?.services ?? []).map((s) => {
    const probe = parse(s.last_probe_json);
    const last = probe.lastProbe ?? probe;
    return { name: s.name, state: s.state, since: s.since, restarts: parse(s.restarts_json, []).length, lastAt: last?.at ?? probe.lastAt ?? probe.lastCheckAt ?? null,
      detail: clip(last?.error ?? (last?.exists === false ? 'không tồn tại' : ''), 160) || null };
  });
  // The Host controller's store holds machine services, Kernel/Supervisor seats (seat:*) and ledger health (ledger:*).
  const all = stored.length ? stored : serviceProbe?.rows ?? [];
  const groupOf = (name) => (name.startsWith('seat:') ? 'seat' : name.startsWith('ledger:') ? 'ledger' : 'service');
  const down = (s) => (services?.DOWN_STATES ? services.DOWN_STATES.has(s.state) : ['starting', 'degraded', 'failed', 'backoff', 'quarantined'].includes(s.state)) || s.state === 'failed';
  const svcRows = all.filter((s) => groupOf(s.name) === 'service').map((s) => ({ ...s, down: down(s) }));
  const svc = { rows: svcRows, managed: svcRows.filter((s) => s.state !== 'unmanaged').length, healthy: svcRows.filter((s) => s.state === 'healthy').length,
    down: svcRows.filter((s) => s.down).map((s) => s.name),
    seats: all.filter((s) => groupOf(s.name) === 'seat'), ledgers: all.filter((s) => groupOf(s.name) === 'ledger'),
    source: stored.length ? 'reconciler.sqlite services (Host controller)' : serviceProbe ? `UI probe (services.mjs serviceRegistry) ${new Date(serviceProbe.at).toISOString()}` : null };

  let open = [];
  try { open = sla?.openViolations ? sla.openViolations({ env }) : []; } catch { open = []; }
  const byCode = {};
  for (const v of open) byCode[v.code ?? '?'] = (byCode[v.code ?? '?'] ?? 0) + 1;
  const violations = { open: open.length, critical: open.filter((v) => v.severity === 'critical').length, byCode,
    rows: open.slice(0, 40).map((v) => ({ key: clip(v.dedupeKey, 160), code: v.code ?? null, severity: v.severity ?? null, entity: typeof v.entity === 'string' ? clip(v.entity, 120) : clip(JSON.stringify(v.entity ?? ''), 120), at: Number(v.at) || null })),
    clocks: (st?.clocks ?? []).length, source: sla ? 'supervisor ledger runtime-invariant-violated (sla.mjs openViolations)' : null };

  const g = rows.gc;
  // gc.summary data (scripts/supervisor/gc.mjs): leftovers is what a close/verify found still alive after its owner step.
  const lo = g?.data?.leftovers;
  const leftovers = typeof lo === 'number' ? lo : lo && typeof lo === 'object' ? Object.values(lo).reduce((n, v) => n + (Number(v) || 0), 0) : null;
  const gcCounts = g?.data ? { agents: g.data.agents ?? 0, terminals: g.data.terminals ?? 0, worktrees: g.data.worktrees ?? 0, freedBytes: g.data.freedBytes ?? 0, refused: g.data.refused ?? 0, errors: g.data.errors ?? 0 } : null;
  return { at: now, engine, controllers, others, windowMs, logSource: 'supervisor ledger logs reconciler.would/act/error/event (workflow wf-supervisor, data.controller)', queueDepth: (st?.queue ?? []).reduce((n, q) => n + q.n, 0), services: svc, violations,
    gc: g ? { at: g.at, msg: g.msg, collected24h: g.collected24h, leftovers, counts: gcCounts, source: 'supervisor ledger gc.summary' } : null };
}

/**
 * Probe the declared services once (services.mjs serviceRegistry, checkers excluded). Used only while the Host
 * controller has not written its store. {at, rows: [{name, state: healthy|failed, detail}]} or null.
 */
export async function probeServices({ timeoutMs = 20_000 } = {}) {
  if (!services?.serviceRegistry) return null;
  let registry;
  try { registry = services.serviceRegistry().filter((s) => s.kind === 'service'); } catch { return null; }
  const rows = await Promise.all(registry.map(async (s) => {
    try {
      const r = await Promise.race([s.probe(), new Promise((resolve) => setTimeout(() => resolve({ ok: false, error: 'probe timeout' }), timeoutMs))]);
      const unmanaged = r?.unmanaged === true;
      return { name: s.name, state: r?.ok ? 'healthy' : unmanaged ? 'unmanaged' : 'failed', since: null, restarts: 0, detail: r?.ok ? null : clip(r?.error ?? (r?.exists === false ? 'không tồn tại' : 'không trả lời'), 160) };
    } catch (error) { return { name: s.name, state: 'failed', since: null, restarts: 0, detail: clip(error?.message, 160) }; }
  }));
  return { at: Date.now(), rows };
}

/* ------------------------------------------------------------ host */

/** RAM of this host: {percent, usedBytes, totalBytes}. Pure over os. */
export const hostRam = () => { const total = os.totalmem(), free = os.freemem(); return { percent: Math.round((1 - free / total) * 1000) / 10, usedBytes: total - free, totalBytes: total }; };

export { OPEN_JOB };
