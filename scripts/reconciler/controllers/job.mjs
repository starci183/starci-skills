#!/usr/bin/env node
// job.mjs — the reconciler's Job controller (DESIGN.md §8.1, §9.1; lane rc-job). Contract: modules/reconciler/job.yaml.
// Engine contract: LANES.md "Shared contract" (lane rc-engine discovers this file).
//
// Keys: `job:<ledgerId>:<jobId>` (one op job), `wf:<ledgerId>:<workflowId>` (the per-workflow dispatch pass) and
// `workers:supervisor` (the Supervisor ledger's [Worker] jobs). Each job pass reads the job, its report, the settler's
// events and the cached `api status` frontier, then does the FIRST due step (DESIGN §8.1 order):
//
//   dead worker (frontier.deadWorkerJobs)       -> api reconcile --job <id> --dead-worker --settle-failed   job.worker
//   held worker (frontier.heldWorkerJobs)       -> api reconcile --job <id> --release-worker                job.worker
//   reported, not yet settled or handed over    -> the runtime settler for this job                          job.settle
//                                                  (node scripts/reconcile/job-settle.mjs --repo R --job J: reconcileJobSettle -
//                                                  consume, re-verify or canon parity, api check + api settle; wrapped, never
//                                                  re-implemented)
//   reported, handed to the Kernel              -> Decision Item settle-nongreen (one per report)             job.consume-check
//   answering                                   -> api questions --workflow (bridge) + DI worker-question    job.consume-check
//   effect_unknown older than effectUnknownMs   -> api reconcile --job <id>                                  job.worker
//   settled, worker release unproven            -> the settler for this job (its releaseSettled closes and    job.close-verify
//                                                  verifies the terminal), recordLeftover op-worker-after-settle
//   wf: running < allowedParallel, queued-ready -> api dispatch-ready --workflow <wf> (at most once per       job.dispatch
//                                                  dispatchEveryMs per workflow)
//   workers:supervisor                          -> scripts/supervisor/watchdog.mjs sweepWorkers (called, not   job.close-verify
//                                                  copied); in shadow over a dry ledger and dry host seams
//
// Every job pass also keeps the job's SLA clocks (DESIGN §9.1 table; codes in modules/reconciler/sla.yaml, numbers in
// job.yaml): entity `job:<ledgerId>:<jobId>`, one clock per phase, the other phases' clocks cleared.
// Every act goes through ctx (ctx.api / ctx.run / ctx.openDecision carry the shadow gate). The pure planner planJob
// holds every decision, so specs read it without a ledger.
//
//   node scripts/reconciler/controllers/job.mjs --dry [--repo <path>] [--workflow <id>] [--json]
//     one read-only pass over the live ledgers: prints each job's plan (step + clocks); writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { classifyWorker, planHealth, HEALTH_DEFAULTS } from '../worker-health.mjs';
import { clocksOf } from '../sla.mjs';
import { settlerSettings, reportedJobs, kernelHandoverOf, releaseProofOf, EVENTS as SETTLE_EVENTS, KERNEL_ONLY_OPS } from '../../reconcile/job-settle.mjs';

const selfFile = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(selfFile), '..', '..', '..');
export const JOB_FILE = path.join(skillRoot, 'modules', 'reconciler', 'job.yaml');
export const SETTLER_SCRIPT = 'scripts/reconcile/job-settle.mjs';
export const OPENED_BY = 'job-controller';
export const SUPERVISOR_LEDGER = 'supervisor';
export const WORKERS_KEY = 'workers:supervisor';
export const HEALTH_KEY = 'health:all';
const OPEN = ['queued', 'leased', 'running', 'answering', 'effect_unknown'];
const SETTLED = ['succeeded', 'failed', 'cancelled'];

/* ------------------------------------------------------------------------------------------------ settings */

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);
/** modules/reconciler/job.yaml + the runtimes.yaml numbers it cites. Never throws. */
export function jobSettings({ file = JOB_FILE, allocation = null } = {}) {
  let doc = {};
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')) ?? {}; } catch { doc = {}; }
  let alloc = allocation;
  if (!alloc) { try { alloc = allocationSettings(); } catch { alloc = {}; } }
  const settler = settlerSettings(alloc);
  const sla = doc.sla ?? {};
  const liveness = alloc?.liveness ?? {};
  return {
    resyncMs: num(doc.resyncMs, 60_000), concurrency: num(doc.concurrency, 2), timeoutMs: num(doc.timeoutMs, 960_000),
    decisionDueMs: num(doc.decisionDueMs, 900_000), effectUnknownMs: num(doc.effectUnknownMs, 300_000),
    dispatchEveryMs: num(doc.dispatchEveryMs, 60_000), settledWindowMs: num(doc.settledWindowMs, 3_600_000),
    settleRunTimeoutMs: num(doc.settleRunTimeoutMs, settler.itemBudgetMs + 60_000),
    sla: {
      READY_UNDISPATCHED: num(sla.READY_UNDISPATCHED, 120_000),
      LEASE_STUCK: num(sla.LEASE_STUCK, 300_000),
      WORKER_START_STUCK: num(sla.WORKER_START_STUCK, num(liveness.launchGraceMs, 90_000) + 120_000),
      QUESTION_OVERDUE: num(sla.QUESTION_OVERDUE, 600_000),
      CONSUME_OVERDUE: num(sla.CONSUME_OVERDUE, 60_000),
      SETTLE_OVERDUE: num(sla.SETTLE_OVERDUE, settler.invariantMaxAgeMs),
      DECISION_OVERDUE: num(sla.DECISION_OVERDUE, 900_000),
      DEAD_WORKER_UNRECONCILED: num(sla.DEAD_WORKER_UNRECONCILED, 120_000),
      EFFECT_UNKNOWN_STUCK: num(sla.EFFECT_UNKNOWN_STUCK, 600_000),
      WORKER_RELEASE_LEAK: num(sla.WORKER_RELEASE_LEAK, 60_000),
      WORKTREE_REMOVE_OVERDUE: num(sla.WORKTREE_REMOVE_OVERDUE, num(doc.worktreeRemoveSlaMs, 60_000)),
    },
    continuationCap: num(doc.continuationCap, 2),
    worktreeRemoveSlaMs: num(doc.worktreeRemoveSlaMs, 60_000),
    health: Object.fromEntries(Object.entries(HEALTH_DEFAULTS).map(([k, v]) => [k, num(doc.health?.[k], v)])),
    allowedVerbs: Array.isArray(doc.allowedVerbs) && doc.allowedVerbs.length ? doc.allowedVerbs.map(String) : ['settle', 'check', 'reconcile', 'enqueue', 'incident'],
  };
}
export const CLOCK_CODES = Object.freeze(['READY_UNDISPATCHED', 'LEASE_STUCK', 'WORKER_START_STUCK', 'QUESTION_OVERDUE', 'CONSUME_OVERDUE',
  'SETTLE_OVERDUE', 'DECISION_OVERDUE', 'DEAD_WORKER_UNRECONCILED', 'EFFECT_UNKNOWN_STUCK', 'WORKER_RELEASE_LEAK', 'WORKTREE_REMOVE_OVERDUE']);
/** Settle refusals of an isolated op's integration into its workflow branch (lane rc-product-worktrees). */
export const INTEGRATE_REFUSALS = Object.freeze(['product-integrate-conflict', 'product-integrate-red']);
export const PRODUCT_EVENTS = Object.freeze({ integrateRefused: 'product-integrate-refused', worktreeRemoved: 'job-worktree-removed', overlap: 'product-wf-overlap' });

/* ------------------------------------------------------------------------------------------------ keys */

export const jobKey = (ledgerId, jobId) => `job:${ledgerId}:${jobId}`;
export const wfKey = (ledgerId, workflowId) => `wf:${ledgerId}:${workflowId}`;
/** {type: 'job'|'wf'|'workers', ledgerId, id} of a key, or null. Pure. */
export function parseKey(key) {
  const s = String(key ?? '');
  if (s === WORKERS_KEY) return { type: 'workers', ledgerId: SUPERVISOR_LEDGER, id: null };
  if (s === HEALTH_KEY) return { type: 'health', ledgerId: null, id: null };
  const m = /^(job|wf|overlap):([^:]+):(.+)$/.exec(s);
  return m ? { type: m[1], ledgerId: m[2], id: m[3] } : null;
}
const jobRoute = (ev) => {
  if (ev?.ledgerId === SUPERVISOR_LEDGER) return WORKERS_KEY;
  const keys = [];
  if (ev?.entityType === 'job' && ev.entityId) keys.push(jobKey(ev.ledgerId, ev.entityId));
  if (ev?.workflowId) keys.push(wfKey(ev.ledgerId, ev.workflowId));
  return keys;
};
const overlapRoute = (ev) => (ev?.ledgerId && ev.seq != null ? `overlap:${ev.ledgerId}:${ev.seq}` : null);
const wfRoute = (ev) => (ev?.ledgerId === SUPERVISOR_LEDGER ? null : ev?.workflowId ? wfKey(ev.ledgerId, ev.workflowId) : null);

/* ------------------------------------------------------------------------------------------------ reads */

const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
/** Everything the planner needs about one job, from a read-only handle. Null when the job is not an op job. */
export function jobFacts(db, jobId, { now = Date.now(), settings = jobSettings() } = {}) {
  const row = db.prepare("SELECT job_id, workflow_id, op_id, attempt, status, worker_id, payload_json, created_at, updated_at FROM jobs WHERE job_id=? AND kind='op'").get(jobId);
  if (!row) return null;
  const payload = parse(row.payload_json) ?? {};
  const reported = reportedJobs(db, { jobId })[0] ?? null;
  const handover = reported ? kernelHandoverOf(db, reported) : null;
  const released = db.prepare('SELECT 1 FROM events WHERE kind=? AND entity_id=? LIMIT 1').get(SETTLE_EVENTS.released, jobId) != null;
  const lastEvent = (kind) => { const r = db.prepare('SELECT payload_json, created_at FROM events WHERE entity_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(jobId, kind); return r ? { ...(parse(r.payload_json) ?? {}), at: Number(r.created_at) } : null; };
  const refused = reported ? lastEvent(PRODUCT_EVENTS.integrateRefused) : null;
  const releasedAt = Number(db.prepare('SELECT MAX(created_at) at FROM events WHERE kind=? AND entity_id=?').get(SETTLE_EVENTS.released, jobId)?.at) || null;
  const successor = db.prepare("SELECT job_id FROM jobs WHERE workflow_id=? AND json_extract(payload_json,'$.retry.retryOf')=? LIMIT 1").get(row.workflow_id, jobId)?.job_id ?? null;
  // Continuations already in this job's lineage (each a retry carrying params.resumeFrom), for the cap.
  let continuations = 0;
  for (let cur = payload, i = 0; cur && i < 12; i += 1) {
    if (String(cur.params?.resumeFrom ?? '')) continuations += 1;
    const prev = cur.retry?.retryOf;
    cur = prev ? parse(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(prev)?.payload_json) : null;
  }
  const lastEventAt = (kind) => Number(db.prepare('SELECT MAX(created_at) at FROM events WHERE entity_id=? AND kind=?').get(jobId, kind)?.at) || null;
  return {
    jobId: row.job_id, workflowId: row.workflow_id, op: row.op_id, attempt: row.attempt, status: row.status, workerId: row.worker_id,
    payload, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
    report: reported ? { dispatchId: reported.dispatchId, outcome: reported.outcome, filedAt: reported.filedAt, consumedAt: reported.consumedAt } : null,
    handover: handover ? { reason: handover.reason ?? null, detail: handover.detail ?? null, at: handover.at } : null,
    released, releaseProof: releaseProofOf(payload), settledAt: SETTLED.includes(row.status) ? Number(payload.settledAt ?? row.updated_at) : null,
    integrateRefused: refused && (!reported || refused.at >= reported.filedAt) ? { reason: refused.reason, files: refused.files ?? null, conflicts: refused.conflicts ?? null, continuation: refused.continuation ?? null, at: refused.at } : null,
    head: reported?.report?.head ?? null,
    successor, continuations, releasedAt,
    worktree: payload.productWorktree?.op?.path ? (() => {
      const event = db.prepare('SELECT 1 FROM events WHERE kind=? AND entity_id=? LIMIT 1').get(PRODUCT_EVENTS.worktreeRemoved, jobId) != null;
      const gone = !fs.existsSync(payload.productWorktree.op.path);
      // Removed when the event exists OR the folder is gone (a failed first removal may have finished later); a
      // gone folder with no event still gets the reap, which writes the missing job-worktree-removed.
      return { path: payload.productWorktree.op.path, removed: event || gone, eventMissing: !event };
    })() : null,
    dispatchedAt: lastEventAt('op-dispatched'), questionAt: lastEventAt('worker-question-bridged'), now, windowMs: settings.settledWindowMs,
  };
}

/** Keys of the resync: open op jobs of running workflows, settled ones of the last settledWindowMs, and each running workflow. */
export function listKeysOf(db, ledgerId, { now = Date.now(), settings = jobSettings(), openClockJobs = [] } = {}) {
  const live = db.prepare(`SELECT j.job_id, j.workflow_id FROM jobs j JOIN workflows w ON w.workflow_id=j.workflow_id
    WHERE j.kind='op' AND w.archived_at IS NULL AND COALESCE(w.phase,'') <> 'finished' AND j.status IN (${OPEN.map(() => '?').join(',')})`).all(...OPEN);
  const settled = db.prepare(`SELECT job_id, workflow_id FROM jobs WHERE kind='op' AND status IN (${SETTLED.map(() => '?').join(',')}) AND updated_at>?`)
    .all(...SETTLED, now - settings.settledWindowMs);
  const keys = new Set();
  const unreaped = db.prepare(`SELECT job_id FROM jobs j WHERE kind='op' AND status IN (${SETTLED.map(() => '?').join(',')})
    AND json_extract(payload_json,'$.productWorktree.op.path') IS NOT NULL AND updated_at>?
    AND NOT EXISTS (SELECT 1 FROM events e WHERE e.kind=? AND e.entity_id=j.job_id)`).all(...SETTLED, now - 7 * 86_400_000, PRODUCT_EVENTS.worktreeRemoved);
  for (const r of [...live, ...settled, ...unreaped]) keys.add(jobKey(ledgerId, r.job_id));
  for (const id of openClockJobs) keys.add(jobKey(ledgerId, id));
  for (const r of live) keys.add(wfKey(ledgerId, r.workflow_id));
  return [...keys];
}

/* ------------------------------------------------------------------------------------------------ the planner */

/**
 * The plan of one job: {step: {kind, concern, ...} | null, clocks: [{state, enteredAt, slaMs}]}. Pure.
 * `frontier` is api status frontier (deadWorkerJobs, heldWorkerJobs); `questions` the status workerQuestions of this job.
 */
export function planJob(f, { frontier = {}, questions = [], settings = jobSettings() } = {}) {
  const S = settings.sla;
  const clocks = [];
  const clock = (state, enteredAt) => clocks.push({ state, enteredAt: Number(enteredAt) || f.now, slaMs: S[state] });
  let step = null;
  const set = (s) => { if (!step) step = s; };
  const live = ['running', 'answering', 'effect_unknown'].includes(f.status);
  if (f.status === 'leased') clock('LEASE_STUCK', f.updatedAt);
  if (live && (frontier.deadWorkerJobs ?? []).includes(f.jobId)) {
    clock('DEAD_WORKER_UNRECONCILED', f.updatedAt);
    set({ kind: 'dead-worker', concern: 'job.worker', verb: 'reconcile', argv: ['--job', f.jobId, '--dead-worker', '--settle-failed'] });
  }
  if (live && (frontier.heldWorkerJobs ?? []).includes(f.jobId)) set({ kind: 'release-worker', concern: 'job.worker', verb: 'reconcile', argv: ['--job', f.jobId, '--release-worker'] });
  if (live && f.report) {
    // Consume is part of settle (settle-runtime-service): SETTLE_OVERDUE / DECISION_OVERDUE time the report, no
    // separate CONSUME_OVERDUE clock.
    const refusal = f.handover && f.integrateRefused ? f.integrateRefused.reason : null;
    if (refusal && INTEGRATE_REFUSALS.includes(refusal) && !f.successor && f.continuations < settings.continuationCap) {
      // A continuation on the new workflow-branch base, never a failure (product-worktree.mjs integrateOp).
      clock('DECISION_OVERDUE', f.handover.at);
      set({ kind: 'continuation', concern: 'job.settle', reason: refusal, resumeFrom: f.integrateRefused.continuation?.resumeFrom ?? f.head ?? null });
    } else if (refusal === 'deps-unit-required' && !f.successor && (f.integrateRefused.files ?? []).length) {
      clock('DECISION_OVERDUE', f.handover.at);
      set({ kind: 'deps-unit', concern: 'job.settle', reason: refusal, files: f.integrateRefused.files });
    } else if (f.handover) {
      clock('DECISION_OVERDUE', f.handover.at);
      set({ kind: 'settle-nongreen', concern: 'job.consume-check', reason: f.handover.reason });
    } else if (f.report.outcome !== 'done' || KERNEL_ONLY_OPS.includes(f.op)) {
      // The settler never settles these; its handover is the Kernel's item (api status settleDecisions).
      clock('DECISION_OVERDUE', f.report.filedAt);
      set({ kind: 'settle-nongreen', concern: 'job.consume-check', reason: KERNEL_ONLY_OPS.includes(f.op) ? 'owner-act' : `outcome-${f.report.outcome}` });
    } else {
      clock('SETTLE_OVERDUE', f.report.filedAt);
      set({ kind: 'settle', concern: 'job.settle' });
    }
  }
  if (f.status === 'answering') {
    clock('QUESTION_OVERDUE', f.questionAt ?? f.updatedAt);
    set({ kind: 'questions', concern: 'job.consume-check', questions: questions.filter((q) => q?.jobId === f.jobId) });
  }
  if (f.status === 'effect_unknown') {
    clock('EFFECT_UNKNOWN_STUCK', f.updatedAt);
    if (f.now - f.updatedAt > settings.effectUnknownMs) set({ kind: 'effect-unknown', concern: 'job.worker', verb: 'reconcile', argv: ['--job', f.jobId] });
  }
  if (SETTLED.includes(f.status) && !f.released && f.now - f.updatedAt <= f.windowMs) {
    const handle = f.payload.managed ? null : (f.workerId ?? f.payload.orca?.agentTerminalHandle ?? f.payload.launchTerminal?.handle ?? null);
    if (handle || f.payload.managed) {
      if (!f.releaseProof) clock('WORKER_RELEASE_LEAK', f.settledAt ?? f.updatedAt);
      set({ kind: 'close-verify', concern: 'job.close-verify', proven: Boolean(f.releaseProof), handle });
    }
  }
  // released -> worktree-removed (DESIGN §16.7): an isolated op's worktree goes within worktreeRemoveSlaMs of its release;
  // the settler's pass for the job reaps it.
  if (SETTLED.includes(f.status) && f.worktree && f.worktree.eventMissing) {
    if (!f.worktree.removed) clock('WORKTREE_REMOVE_OVERDUE', f.releasedAt ?? f.settledAt ?? f.updatedAt);
    // product-worktree.mjs reap --job is idempotent: it removes and verifies, or records the missing event for a
    // folder already gone, or records job-worktree-remove-failed and is retried on the next pass.
    set({ kind: 'worktree-reap', concern: 'job.close-verify', worktree: f.worktree.path });
  }
  return { step, clocks };
}

/** The per-workflow dispatch plan from api status progress. Pure. */
export function planWorkflow(status, { lastDispatchAt = 0, now = Date.now(), settings = jobSettings() } = {}) {
  const p = status?.progress ?? {};
  const running = Number(p.running) || 0, allowed = Number(p.allowedParallel) || 0, ready = Number(p.queuedReady) || 0;
  const readyJobs = Array.isArray(p.readyJobs) ? p.readyJobs.map(String) : [];
  if (!ready || running >= allowed) return { step: null, readyJobs, why: !ready ? 'nothing queued-ready' : `running ${running} >= allowed ${allowed}` };
  if (now - lastDispatchAt < settings.dispatchEveryMs) return { step: null, readyJobs, why: 'dispatched within dispatchEveryMs' };
  return { step: { kind: 'dispatch-ready', concern: 'job.dispatch', verb: 'dispatch-ready' }, readyJobs, why: `running ${running} < allowed ${allowed}, ${ready} queued-ready` };
}

/** The settle-nongreen Decision Item (DESIGN §10.3), one per report. Pure. */
export function settleDecision(f, ledgerId, { now = Date.now(), settings = jobSettings() } = {}) {
  const reason = f.handover?.reason ?? (f.report?.outcome !== 'done' ? `outcome-${f.report?.outcome}` : 'needs-kernel');
  return {
    schema: 'starci/decision-item@1', kind: 'settle-nongreen', idempotencyKey: `settle-nongreen:${f.jobId}:${f.report?.dispatchId}`,
    decider: 'kernel', ledger: ledgerId, workflowId: f.workflowId, entity: { type: 'job', id: f.jobId },
    summary: `${f.op} ${f.jobId} reported ${f.report?.outcome}: the runtime did not settle it (${reason})`,
    evidence: [{ ref: `report:${f.report?.dispatchId}` }, ...(f.handover ? [{ ref: `event:${SETTLE_EVENTS.needsKernel}` }] : []), ...(f.handover?.detail ?? []).slice(0, 6).map((d) => ({ ref: String(d) }))],
    allowedVerbs: settings.allowedVerbs, dueAt: now + settings.decisionDueMs, escalateTo: 'supervisor', openedBy: OPENED_BY, openedAt: now,
  };
}

/**
 * The enqueue argv of a continuation (product-integrate-conflict/-red: the same op, same owned paths and cut, from the
 * refused head on the new workflow-branch base) or of the deps unit (deps-unit-required: the manifest files, params.depsUnit).
 * Pure.
 */
export function enqueueArgvOf(f, step) {
  const cut = f.payload.cut;
  const cutArgs = cut?.id ? ['--cut-id', String(cut.id), '--cut-ordinal', String(cut.ordinal), '--cut-total', String(cut.total)] : [];
  if (step.kind === 'continuation') {
    const params = { ...(f.payload.params ?? {}), ...(step.resumeFrom ? { resumeFrom: String(step.resumeFrom) } : {}) };
    return ['--workflow', f.workflowId, '--op', f.op, '--paths', (f.payload.owned_paths ?? []).join(','), '--retry-of', f.jobId,
      '--params', JSON.stringify(params), ...(f.payload.repository ? ['--repository', String(f.payload.repository)] : []), ...cutArgs];
  }
  // deps-unit-required: the refusal names repository-relative manifest files; owned paths carry the repository prefix.
  const owned = (f.payload.owned_paths ?? []).map(String);
  const head = owned.length && owned.every((o) => o.split('/')[0] === owned[0].split('/')[0]) && owned[0].includes('/') ? owned[0].split('/')[0] : null;
  const paths = step.files.map((file) => (head && !String(file).startsWith(`${head}/`) ? `${head}/${file}` : String(file)));
  return ['--workflow', f.workflowId, '--op', f.op, '--paths', paths.join(','), '--retry-of', f.jobId, '--what', 'deps unit',
    '--params', JSON.stringify({ ...(f.payload.params ?? {}), depsUnit: true, resumeFrom: '' }), ...(f.payload.repository ? ['--repository', String(f.payload.repository)] : [])];
}

/* ------------------------------------------------------------------------------------------------ the [Worker] sweep */

/** Host seams for sweepWorkers (the same primitives as scripts/supervisor/watchdog.mjs hostDeps). */
export async function workerSweepDeps() {
  const [{ terminalRead }, host, liveness, closeMod, quitMod] = await Promise.all([
    import('../../api/orca/terminal-read.mjs'), import('../../kernel/host-outage.mjs'), import('../../kernel/terminal-liveness.mjs'),
    import('../../kernel/close-op-terminal.mjs'), import('../../kernel/quit-agent.mjs')]);
  return {
    verdict: (h) => host.kernelTerminalVerdict(h),
    screen: (h) => { try { const r = terminalRead({ terminal: h, screen: true }); return r?.ok ? String(r.screen ?? '') : null; } catch { return null; } },
    exitedRow: liveness.exitedAgentPromptRow,
    quit: (handle, agent) => quitMod.quitAgent({ handle, agent }),
    close: (handle) => closeMod.closeOperationTerminal(handle),
    closeExited: (handle) => closeMod.closeExitedTerminal(handle),
  };
}
/** Shadow seams: the reads are real, every write is a recorded no-op. `would` collects them. */
export function drySweep(deps, would) {
  return {
    verdict: deps.verdict, screen: deps.screen, exitedRow: deps.exitedRow,
    quit: (handle) => { would.push({ act: 'quit', handle }); return { exited: false, shadow: true }; },
    close: (handle) => { would.push({ act: 'close', handle }); return { ok: false, shadow: true }; },
    closeExited: (handle) => { would.push({ act: 'close-exited', handle }); return { ok: false, shadow: true }; },
  };
}
/** A machine handle whose transactions record instead of writing (the shadow sweep reads the live rows). */
export const dryLedger = (m, would) => ({ ...m, transaction: () => { would.push({ act: 'ledger-write' }); } });

/* ------------------------------------------------------------------------------------------------ the controller */

const lastDispatch = new Map(); // `${ledgerId}:${workflowId}` -> ms (per engine process)
const ledgerOf = (ctx, ledgerId) => (ctx.ledgers ?? []).find((l) => l.ledgerId === ledgerId) ?? null;
const may = (ctx, concern) => ctx.mode !== 'active' || ctx.owns(concern);

async function keepClocks(ctx, ledgerId, jobId, clocks) {
  const entity = jobKey(ledgerId, jobId);
  const on = new Set(clocks.map((c) => c.state));
  for (const c of clocks) ctx.clock(entity, c.state, c.slaMs, { ledgerId, enteredAt: c.enteredAt });
  for (const state of CLOCK_CODES) if (!on.has(state)) ctx.clear(entity, state);
}

async function reconcileJob(ctx, ledgerId, jobId, settings) {
  const f = ctx.read(ledgerId, (db) => jobFacts(db, jobId, { now: ctx.now(), settings }));
  if (!f) { for (const state of CLOCK_CODES) ctx.clear(jobKey(ledgerId, jobId), state); return { ok: true, action: 'gone' }; }
  const status = OPEN.includes(f.status) ? await ctx.status(ledgerId, f.workflowId) : null;
  const plan = planJob(f, { frontier: status?.frontier ?? {}, questions: status?.workerQuestions ?? [], settings });
  await keepClocks(ctx, ledgerId, jobId, plan.clocks);
  if (!OPEN.includes(f.status)) ctx.clear(jobKey(ledgerId, jobId), 'WORKER_STALLED');
  const s = plan.step;
  if (!s) return { ok: true, action: 'idle', clocks: plan.clocks.map((c) => c.state) };
  if (!may(ctx, s.concern)) return { ok: true, action: 'not-owned', step: s.kind };
  const repo = ledgerOf(ctx, ledgerId)?.repo;
  switch (s.kind) {
    case 'dead-worker': case 'release-worker': case 'effect-unknown':
      return { action: s.kind, ...(await ctx.api(ledgerId, s.verb, s.argv)) };
    case 'settle':
      // The runtime settler for this one job: reconcileJobSettle (consume, re-verify / canon parity, api check + settle, release).
      return { action: 'settle', ...(await ctx.run('node', [SETTLER_SCRIPT, '--repo', repo, '--job', jobId, '--json'], { timeoutMs: settings.settleRunTimeoutMs })) };
    case 'continuation': case 'deps-unit':
      return { action: s.kind, reason: s.reason, ...(await ctx.api(ledgerId, 'enqueue', enqueueArgvOf(f, s))) };
    case 'settle-nongreen':
      return { action: 'settle-nongreen', ...(await ctx.openDecision(settleDecision(f, ledgerId, { now: ctx.now(), settings }))) };
    case 'questions': {
      const bridged = await ctx.api(ledgerId, 'questions', ['--workflow', f.workflowId]);
      const opened = [];
      for (const q of s.questions) {
        const id = q.questionId ?? q.id ?? q.dispatchId ?? q.at ?? 'q';
        opened.push(await ctx.openDecision({ schema: 'starci/decision-item@1', kind: 'worker-question', idempotencyKey: `worker-question:${jobId}:${id}`,
          decider: 'kernel', ledger: ledgerId, workflowId: f.workflowId, entity: { type: 'job', id: jobId },
          summary: `${f.op} ${jobId} asks: ${String(q.text ?? q.question ?? '').slice(0, 300)}`, evidence: [{ ref: `worker-question:${id}` }],
          allowedVerbs: ['reply', 'nudge', 'reconcile'], dueAt: ctx.now() + settings.sla.QUESTION_OVERDUE, escalateTo: 'supervisor', openedBy: OPENED_BY, openedAt: ctx.now() }));
      }
      return { action: 'questions', ok: bridged.ok !== false, decisions: opened.length };
    }
    case 'worktree-reap':
      return { action: 'worktree-reap', ...(await ctx.run('node', ['scripts/kernel/product-worktree.mjs', 'reap', '--repo', repo, '--job', jobId, '--json'], { timeoutMs: 300_000 })) };
    case 'close-verify': {
      if (s.proven) {
        // The settler records the release (job-settle-released) from the payload proof on its next pass; nothing to close.
        return { action: 'close-verify', ...(await ctx.run('node', [SETTLER_SCRIPT, '--repo', repo, '--job', jobId, '--json'], { timeoutMs: settings.settleRunTimeoutMs })) };
      }
      const r = await ctx.run('node', [SETTLER_SCRIPT, '--repo', repo, '--job', jobId, '--json'], { timeoutMs: settings.settleRunTimeoutMs });
      const closedNow = (r?.value?.results ?? []).flatMap((x) => x.released ?? []).filter((x) => x.closedNow);
      if (closedNow.length && ctx.mode === 'active') {
        // A terminal the settle step should have closed is a bug of that step (INV-J2): one lesson per day.
        try { (await import('../../supervisor/lessons.mjs')).recordLeftover({ klass: 'op-worker-after-settle', count: closedNow.length, examples: closedNow.map((x) => x.jobId), env: ctx.env }); } catch { /* a lesson */ }
      }
      return { action: 'close-verify', closedNow: closedNow.length, ...r };
    }
    default: return { ok: true, action: 'idle' };
  }
}

async function reconcileWorkflow(ctx, ledgerId, workflowId, settings) {
  const status = await ctx.status(ledgerId, workflowId);
  if (!status || status.phase === 'finished' || status.archivedAt) return { ok: true, action: 'ended' };
  const id = `${ledgerId}:${workflowId}`;
  const plan = planWorkflow(status, { lastDispatchAt: lastDispatch.get(id) ?? 0, now: ctx.now(), settings });
  const entity = wfKey(ledgerId, workflowId);
  if (plan.readyJobs.length && (Number(status.progress?.running) || 0) < (Number(status.progress?.allowedParallel) || 0)) ctx.clock(entity, 'READY_UNDISPATCHED', settings.sla.READY_UNDISPATCHED, { ledgerId });
  else ctx.clear(entity, 'READY_UNDISPATCHED');
  if (!plan.step) return { ok: true, action: 'idle', why: plan.why };
  if (!may(ctx, plan.step.concern)) return { ok: true, action: 'not-owned' };
  // IMPORTS_BROKEN_AFTER_MOVE (DESIGN §16.7): the next wave's slices wait until the repoint (canon-wire) unit settles.
  // dispatch-ready cannot pick the wire unit alone, so the push is held and the Kernel dispatches the repoint itself.
  const broken = status.importsBroken;
  if (broken?.count > 0) {
    const di = await ctx.openDecision({ schema: 'starci/decision-item@1', kind: broken.blocksNextWave ? 'repoint-needed' : 'repoint-dispatch',
      idempotencyKey: `imports-broken:${workflowId}:${broken.blocksNextWave ? 'none' : 'queued'}`, decider: 'kernel', ledger: ledgerId, workflowId,
      entity: { type: 'workflow', id: workflowId }, summary: `${broken.count} broken import(s) in ${broken.files} file(s) after a move: ${broken.blocksNextWave ? 'enqueue the repoint (canon-wire) unit' : 'dispatch the queued repoint unit'}; the next wave's dispatch is held until it settles`,
      evidence: (broken.sample ?? []).slice(0, 5).map((x) => ({ ref: `${x.from} -> ${x.spec}` })), allowedVerbs: ['enqueue', 'route', 'dispatch'],
      dueAt: ctx.now() + settings.decisionDueMs, escalateTo: 'supervisor', openedBy: OPENED_BY, openedAt: ctx.now() });
    return { ok: true, action: 'dispatch-held', why: `imports broken (${broken.count})`, decision: di?.ok !== false };
  }
  lastDispatch.set(id, ctx.now());
  return { action: 'dispatch-ready', why: plan.why, ...(await ctx.api(ledgerId, 'dispatch-ready', ['--workflow', workflowId])) };
}

/** product-wf-overlap (two workflows' branches touch the same files as main moved): a cross-workflow DI for the Supervisor. */
async function reconcileOverlap(ctx, ledgerId, seq, settings) {
  const ev = ctx.read(ledgerId, (db) => db.prepare('SELECT workflow_id, entity_id, payload_json, created_at FROM events WHERE seq=? AND kind=?').get(seq, PRODUCT_EVENTS.overlap));
  if (!ev) return { ok: true, action: 'gone' };
  const payload = parse(ev.payload_json) ?? {};
  const files = [...(payload.files ?? payload.conflicts ?? [])].map((x) => (typeof x === 'string' ? x : x?.file)).filter(Boolean);
  const di = await ctx.openDecision({ schema: 'starci/decision-item@1', kind: 'product-wf-overlap',
    idempotencyKey: `product-wf-overlap:${ev.workflow_id}:${payload.main ?? payload.mainSha ?? seq}`, decider: 'supervisor', ledger: SUPERVISOR_LEDGER,
    workflowId: ev.workflow_id, entity: { type: 'workflow', id: ev.workflow_id },
    summary: `${ev.workflow_id} (${ledgerId}): its workflow branch ${payload.branch ?? ''} overlaps main${files.length ? ` on ${files.length} file(s): ${files.slice(0, 5).join(', ')}` : ''} - order the workflows or re-cut`,
    evidence: [{ ref: `event:${ledgerId}:${seq}` }], allowedVerbs: ['decide', 'notify', 'incident'], dueAt: ctx.now() + settings.decisionDueMs, escalateTo: 'owner',
    openedBy: OPENED_BY, openedAt: ctx.now() });
  return { action: 'overlap', ...(di ?? {}) };
}

async function reconcileWorkers(ctx, settings) {
  if (!may(ctx, 'job.close-verify')) return { ok: true, action: 'not-owned' };
  const { sweepWorkers } = await import('../../supervisor/watchdog.mjs');
  const deps = await workerSweepDeps();
  if (ctx.mode !== 'active') {
    const would = [];
    const { readSupervisor } = await import('../../supervisor/home.mjs');
    const out = readSupervisor((m) => sweepWorkers(dryLedger(m, would), drySweep(deps, would), { now: ctx.now() }), null, { env: ctx.env ?? process.env }) ?? { deaths: [], closed: [] };
    if (out.deaths.length || would.some((w) => w.act !== 'ledger-write')) ctx.log('reconciler.would', `job would sweep [Worker] jobs: ${out.deaths.length} death(s), ${would.filter((w) => w.act !== 'ledger-write').length} close(s)`, { deaths: out.deaths, would: would.slice(0, 20) });
    return { ok: true, action: 'workers', shadow: true, deaths: out.deaths.length };
  }
  const { withSupervisor } = await import('../../supervisor/home.mjs');
  return withSupervisor((m) => {
    const out = sweepWorkers(m, deps, { now: ctx.now() });
    if (out.deaths?.length || out.closed?.length) ctx.log('reconciler.act', `job swept [Worker] jobs: ${out.deaths.length} death(s), ${out.closed.length} closed`, out);
    return { ok: true, action: 'workers', ...out };
  }, { env: ctx.env ?? process.env });
}

/* ------------------------------------------------------------------------------------------------ worker health */

const healthMem = new Map(); // jobId -> probe memory (worker-health.mjs planHealth), per engine process
let lastSendAt = 0;          // the stagger across every worker of the host
const LIVE_WORKER = ['leased', 'running', 'answering'];
const TERMINAL_SEND = 'scripts/api/orca/terminal-send.mjs';

/** One probe: every live op job's worker, classified from ONE orca terminal list. */
async function showTerminal(handle, ctx) {
  try {
    if (ctx.terminalShow) return (await ctx.terminalShow(handle)) ?? null;
    const r = (await import('../../api/orca/terminal-show.mjs')).terminalShow({ terminal: handle });
    return r?.ok ? r.terminal ?? null : null;
  } catch { return null; }
}
async function reconcileHealth(ctx, settings, { list = null } = {}) {
  const H = settings.health;
  let listed;
  try { listed = list ? await list() : (await import('../../api/orca/terminal-list.mjs')).terminalList({}); } catch (error) { listed = { ok: false, error: String(error?.message ?? error) }; }
  if (!listed?.ok || listed.hostUnavailable) return { ok: true, action: 'host-unavailable', error: listed?.error ?? null };
  const byHandle = new Map((listed.terminals ?? []).map((t) => [t.handle, t]));
  const now = ctx.now();
  const out = { ok: true, action: 'health', probed: 0, states: {}, sends: 0, decisions: 0 };
  const seen = new Set();
  for (const l of ctx.ledgers ?? []) {
    if (l.ledgerId === SUPERVISOR_LEDGER) continue;
    const jobs = ctx.read(l.ledgerId, (db) => db.prepare(`SELECT job_id, workflow_id, op_id, status, worker_id, payload_json FROM jobs WHERE kind='op' AND worker_id IS NOT NULL
      AND status IN (${LIVE_WORKER.map(() => '?').join(',')})`).all(...LIVE_WORKER).map((r) => ({ ...r, reportFiled: reportedJobs(db, { jobId: r.job_id }).length > 0 }))) ?? [];
    for (const j of jobs) {
      out.probed += 1;
      seen.add(j.job_id);
      // A product-worktree terminal is not in the default list: read it by handle.
      if (!byHandle.has(j.worker_id)) byHandle.set(j.worker_id, await showTerminal(j.worker_id, ctx));
      const term = byHandle.get(j.worker_id) ?? null;
      const mem = healthMem.get(j.job_id) ?? {};
      const c = classifyWorker(term, { mem, reportFiled: j.reportFiled, now, settings: H });
      out.states[c.state] = (out.states[c.state] ?? 0) + 1;
      const planned = planHealth(c, { mem, now, settings: H });
      const entity = jobKey(l.ledgerId, j.job_id);
      if (['rate-limited', 'idle-at-prompt', 'done-without-report'].includes(c.state)) ctx.clock(entity, 'WORKER_STALLED', H.idleMs, { ledgerId: l.ledgerId, enteredAt: planned.mem.since ?? now });
      else ctx.clear(entity, 'WORKER_STALLED');
      const payload = parse(j.payload_json) ?? {};
      const who = { jobId: j.job_id, workflowId: j.workflow_id, op: j.op_id, terminal: j.worker_id, provider: term?.agentIdentity ?? payload.provider ?? null, pool: payload.agent ?? payload.provider ?? null, model: payload.model ?? null };
      if (c.state !== mem.state && c.state !== 'working') {
        ctx.log('reconciler.worker-health', `${j.job_id} ${c.state}${c.resetMs != null ? ` (reset in ${Math.round(c.resetMs / 1000)}s)` : ''}`, { ...who, state: c.state, preview: String(term?.preview ?? '').slice(0, 200) });
        if (c.state === 'rate-limited') ctx.log('reconciler.provider-rate-limited', `provider ${who.provider ?? '?'} rate-limited (${j.job_id})`, { ...who, resetMs: c.resetMs ?? null });
      }
      let next = planned.mem;
      const a = planned.action;
      if (a && ctx.mode === 'active' && !ctx.owns('job.worker')) { healthMem.set(j.job_id, mem); continue; }
      if (a?.kind === 'send') {
        if (now - lastSendAt < H.staggerMs) { healthMem.set(j.job_id, { ...mem, state: c.state, since: planned.mem.since, seenAt: planned.mem.seenAt }); continue; }
        lastSendAt = now;
        await ctx.run('node', [TERMINAL_SEND, '--terminal', j.worker_id, '--text', a.text], { timeoutMs: 60_000 });
        out.sends += 1;
      } else if (a?.kind === 'fail-no-report') {
        // done-without-report past doneFailAfterMs: the failed-no-report path (its salvage continues from the commits).
        await ctx.api(l.ledgerId, 'reconcile', ['--job', j.job_id, '--dead-worker', '--settle-failed']);
      } else if (a?.kind === 'decision') {
        await ctx.openDecision({ schema: 'starci/decision-item@1', kind: 'worker-stalled', idempotencyKey: `worker-stalled:${j.job_id}:${c.state}:${planned.mem.since ?? now}`,
          decider: 'kernel', ledger: l.ledgerId, workflowId: j.workflow_id, entity: { type: 'job', id: j.job_id },
          summary: `${j.op_id} ${j.job_id} (${who.provider ?? 'worker'}) is ${c.state}: ${a.why}; the automatic nudges did not move it`,
          evidence: [{ ref: `terminal:${j.worker_id}` }, { ref: String(term?.preview ?? '').slice(0, 200) }], allowedVerbs: ['nudge', 'reconcile', 'route', 'enqueue'],
          dueAt: now + settings.decisionDueMs, escalateTo: 'supervisor', openedBy: OPENED_BY, openedAt: now });
        out.decisions += 1;
      }
      healthMem.set(j.job_id, next);
    }
  }
  for (const id of [...healthMem.keys()]) if (!seen.has(id)) healthMem.delete(id); // a job no longer live forgets its probe memory
  return out;
}
export const _health = { reset: () => { healthMem.clear(); lastSendAt = 0; }, mem: healthMem };

export default {
  name: 'job',
  concerns: ['job.settle', 'job.worker', 'job.dispatch', 'job.consume-check', 'job.close-verify'],
  resyncMs: 30_000,
  concurrency: 2,
  timeoutMs: 960_000,
  routes: {
    'op-dispatched': jobRoute, 'op-reported': jobRoute, 'report-consumed': jobRoute, 'checks-recorded': jobRoute, 'op-settled': jobRoute,
    'op-auto-settled': jobRoute, 'product-integrate-refused': jobRoute, 'job-worktree-removed': jobRoute, 'product-wf-overlap': overlapRoute, 'job-settle-*': jobRoute, 'worker-*': jobRoute, 'incident-raised': wfRoute, 'incident-resolved': wfRoute,
  },
  async list(ctx) {
    const settings = jobSettings();
    const keys = [];
    // The [Worker] jobs are machine.sqlite sup_jobs (no supervisor ledger).
    const { readSupervisor } = await import('../../supervisor/home.mjs');
    if (readSupervisor((m) => m.db.prepare("SELECT COUNT(*) n FROM sup_jobs WHERE status IN ('running','reported')").get()?.n ?? 0, 0, { env: ctx.env ?? process.env })) keys.push(WORKERS_KEY);
    for (const l of ctx.ledgers ?? []) {
      if (l.ledgerId === SUPERVISOR_LEDGER) continue;
      if (!keys.includes(HEALTH_KEY)) keys.push(HEALTH_KEY);
      // Every job with an open clock is listed too: a job that left the settled window still gets the pass that clears it.
      let openClockJobs = [];
      try { openClockJobs = [...new Set(clocksOf(ctx, { prefixes: [`job:${l.ledgerId}:`] }).map((c) => c.entity.slice(`job:${l.ledgerId}:`.length)))]; } catch { openClockJobs = []; }
      keys.push(...(ctx.read(l.ledgerId, (db) => listKeysOf(db, l.ledgerId, { now: ctx.now(), settings, openClockJobs })) ?? []));
    }
    return keys;
  },
  async reconcile(key, ctx) {
    const k = parseKey(key);
    if (!k) return { ok: false, action: 'bad-key', key };
    const settings = jobSettings();
    if (k.type === 'workers') return reconcileWorkers(ctx, settings);
    if (k.type === 'health') return reconcileHealth(ctx, settings, { list: ctx.terminalList ?? null });
    if (k.type === 'wf') return reconcileWorkflow(ctx, k.ledgerId, k.id, settings);
    if (k.type === 'overlap') return reconcileOverlap(ctx, k.ledgerId, Number(k.id), settings);
    return reconcileJob(ctx, k.ledgerId, k.id, settings);
  },
};

/* ------------------------------------------------------------------------------------------------ --dry */

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const val = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  if (!argv.includes('--dry')) { console.error('use: job.mjs --dry [--repo <path>] [--workflow <id>] [--json]'); process.exit(2); }
  const { openLedgerReader, ledgerFileFor } = await import('../../../engine/ledger-db.mjs');
  const { productRepos } = await import('../../supervisor/home.mjs');
  const repos = val('repo') ? [path.resolve(val('repo'))] : productRepos();
  const settings = jobSettings();
  const out = [];
  for (const repo of repos) {
    const file = ledgerFileFor(repo);
    if (!fs.existsSync(file)) continue;
    const db = openLedgerReader(file);
    try {
      for (const key of listKeysOf(db, path.basename(repo), { settings })) {
        const k = parseKey(key);
        if (k.type !== 'job') continue;
        const f = jobFacts(db, k.id, { settings });
        if (!f || (val('workflow') && f.workflowId !== val('workflow'))) continue;
        const plan = planJob(f, { settings });
        if (plan.step || plan.clocks.length) out.push({ key, status: f.status, step: plan.step?.kind ?? null, reason: plan.step?.reason ?? null, clocks: plan.clocks.map((c) => `${c.state} ${Math.round((Date.now() - c.enteredAt) / 60_000)}m/${Math.round(c.slaMs / 60_000)}m`) });
      }
    } finally { db.close(); }
  }
  if (argv.includes('--json')) console.log(JSON.stringify({ ok: true, plans: out }));
  else for (const p of out) console.log(`${p.key} ${p.status} step=${p.step ?? '-'}${p.reason ? ` (${p.reason})` : ''} clocks=[${p.clocks.join(', ')}]`);
}
