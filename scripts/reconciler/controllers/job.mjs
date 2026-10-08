#!/usr/bin/env node
// job.mjs — the reconciler's Job controller (DESIGN.md §8.1, §9.1; lane rc-job). Contract: modules/reconciler/job.yaml.
// Engine contract: LANES.md "Shared contract" (lane rc-engine discovers this file).
//
// Keys: `job:<ledgerId>:<jobId>` (one op job), `wf:<ledgerId>:<workflowId>` (the per-workflow dispatch pass) and
// `workers:supervisor` (the Supervisor ledger's [Worker] jobs). Each job pass reads the job, its report, the settler's
// events and the cached `starci kernel status` frontier, then does the FIRST due step (DESIGN §8.1 order):
//
//   dead worker (frontier.deadWorkerJobs)       -> starci kernel reconcile --job <id> --dead-worker --settle-failed   job.worker
//   held worker (frontier.heldWorkerJobs)       -> starci kernel reconcile --job <id> --release-worker                job.worker
//   reported, not yet settled or handed over    -> the runtime settler for this job                          job.settle
//                                                  (reconcileJobSettle({ repo: R, jobId: J }) -
//                                                  consume, re-verify or canon parity, starci kernel record-checks + starci kernel settle; wrapped, never
//                                                  re-implemented)
//   reported, handed to the Kernel              -> Decision Item settle-nongreen (one per report)             job.consume-check
//   answering                                   -> starci kernel questions --workflow (bridge) + DI worker-question    job.consume-check
//   effect_unknown older than effectUnknownMs   -> starci kernel reconcile --job <id>                                  job.worker
//   settled, worker release unproven            -> the settler for this job (its releaseSettled closes and    job.close-verify
//                                                  verifies the terminal), recordLeftover op-worker-after-settle
//   failed, nothing follows it                  -> starci kernel reconcile --job <id> --route-failure; a step that records   job.settle
//                                                  none, or a refusal, opens Decision Item retry-decision
//   awaiting_owner with no ask                  -> Decision Item retry-decision (the owner has nothing to answer)      job.consume-check
//   wf: running < allowedParallel, queued-ready -> starci kernel dispatch-ready --workflow <wf> (at most once per       job.dispatch
//                                                  dispatchEveryMs per workflow)
//   workers:supervisor                          -> scripts/supervisor/supervisor-watchdog.mjs sweepWorkers (called, not   job.close-verify
//                                                  copied); in shadow over a dry ledger and dry host seams
//
// Every job pass also keeps the job's SLA clocks (DESIGN §9.1 table; codes in modules/reconciler/sla.yaml, numbers in
// job.yaml): entity `job:<ledgerId>:<jobId>`, one clock per phase, the other phases' clocks cleared.
// Every act goes through ctx (ctx.api / ctx.run / ctx.openDecision carry the shadow gate). The pure planner planJob
// holds every decision, so specs read it without a ledger.
//
// Internal args (spawned by the reconciler engine): --dry [--repo <path>] [--workflow <id>] [--json].
//     one read-only pass over the live ledgers: prints each job's plan (step + clocks); writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseYaml } from '../../../engine/yaml.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { HEALTH_DEFAULTS } from '../worker-health.mjs';
import { reconcileHealth } from '../job-health.mjs';
import { OPENED_BY, SUPERVISOR_LEDGER, jobKey } from '../job-keys.mjs';
import { mapInOrder } from '../../lib/in-order.mjs';
import { clocksOf } from '../sla.mjs';
import { settlerSettings, releaseProofOf, EVENTS as SETTLE_EVENTS } from '../../kernel/settle/job-settle.mjs';
import { reportedJobs, kernelHandoverOf, KERNEL_ONLY_OPS } from '../../machine/reported-jobs.mjs';
import { SETTLED_JOB_LIST } from '../../../engine/admission.mjs'; import { isMain } from '../../lib/is-main.mjs';
import { positiveNumber } from '../../lib/number.mjs';
import { ownerOnlyQuestion } from '../../kernel/op-incident-policy.mjs';
import { TERMINAL_HOLDS, holdView, terminalFactsOf } from '../../kernel/terminal-step.mjs';
import { runMechanicalMoves } from '../mechanical-moves.mjs';
const selfFile = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(selfFile), '..', '..', '..');
const JOB_FILE = path.join(skillRoot, 'modules', 'reconciler', 'job.yaml');
export const SETTLER_SCRIPT = 'scripts/kernel/settle/job-settle-main.mjs';
const WORKERS_KEY = 'workers:supervisor';
const HEALTH_KEY = 'health:all';
const OPEN = ['queued', 'leased', 'running', 'answering', 'effect_unknown'];
const SETTLED = SETTLED_JOB_LIST;

/* ------------------------------------------------------------------------------------------------ settings */

const num = (v, d) => positiveNumber(v, d, { orZero: true });
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
    },
    health: Object.fromEntries(Object.entries(HEALTH_DEFAULTS).map(([k, v]) => [k, num(doc.health?.[k], v)])),
    allowedVerbs: Array.isArray(doc.allowedVerbs) && doc.allowedVerbs.length ? doc.allowedVerbs.map(String) : ['settle', 'record-checks', 'reconcile', 'enqueue', 'incident'],
  };
}
const CLOCK_CODES = Object.freeze(['READY_UNDISPATCHED', 'LEASE_STUCK', 'WORKER_START_STUCK', 'QUESTION_OVERDUE', 'CONSUME_OVERDUE',
  'SETTLE_OVERDUE', 'DECISION_OVERDUE', 'DEAD_WORKER_UNRECONCILED', 'EFFECT_UNKNOWN_STUCK', 'WORKER_RELEASE_LEAK']);

/* ------------------------------------------------------------------------------------------------ keys */

const wfKey = (ledgerId, workflowId) => `wf:${ledgerId}:${workflowId}`;
/** {type: 'job'|'wf'|'workers', ledgerId, id} of a key, or null. Pure. */
export function parseKey(key) {
  const s = String(key ?? '');
  if (s === WORKERS_KEY) return { type: 'workers', ledgerId: SUPERVISOR_LEDGER, id: null };
  if (s === HEALTH_KEY) return { type: 'health', ledgerId: null, id: null };
  const m = /^(job|wf):([^:]+):(.+)$/.exec(s);
  return m ? { type: m[1], ledgerId: m[2], id: m[3] } : null;
}
const jobRoute = (ev) => {
  if (ev?.ledgerId === SUPERVISOR_LEDGER) return [WORKERS_KEY];
  const keys = [];
  if (ev?.entityType === 'job' && ev.entityId) keys.push(jobKey(ev.ledgerId, ev.entityId));
  if (ev?.workflowId) keys.push(wfKey(ev.ledgerId, ev.workflowId));
  return keys;
};
const wfRoute = (ev) => ev?.ledgerId !== SUPERVISOR_LEDGER && ev?.workflowId ? wfKey(ev.ledgerId, ev.workflowId) : null;

/* ------------------------------------------------------------------------------------------------ reads */

const parse = (text) => { try { return JSON.parse(text); } catch { return null; } };
/** Everything the planner needs about one job, from a read-only handle. Null when the job is not an op job. */
export function jobFacts(db, jobId, { now = Date.now(), settings = jobSettings() } = {}) {
  const row = db.prepare("SELECT job_id, workflow_id, op_id, try_no AS attempt, status, worker_id, payload_json, created_at, updated_at FROM jobs WHERE job_id=? AND kind='op'").get(jobId);
  if (!row) return null;
  const payload = parse(row.payload_json) ?? {};
  const reported = reportedJobs(db, { jobId })[0] ?? null, handover = reported ? kernelHandoverOf(db, reported) : null;
  const released = db.prepare('SELECT 1 FROM events WHERE kind=? AND entity_id=? LIMIT 1').get(SETTLE_EVENTS.released, jobId) != null;
  const lastEventAt = (kind) => Number(db.prepare('SELECT MAX(created_at) at FROM events WHERE entity_id=? AND kind=?').get(jobId, kind)?.at) || null;
  return {
    jobId: row.job_id, workflowId: row.workflow_id, op: row.op_id, attempt: row.attempt, status: row.status, workerId: row.worker_id,
    payload, createdAt: Number(row.created_at), updatedAt: Number(row.updated_at),
    report: reported ? { dispatchId: reported.dispatchId, outcome: reported.outcome, filedAt: reported.filedAt, consumedAt: reported.consumedAt } : null,
    handover: handover ? { reason: handover.reason ?? null, detail: handover.detail ?? null, at: handover.at } : null,
    released, releaseProof: releaseProofOf(payload), settledAt: SETTLED.includes(row.status) ? Number(payload.settledAt ?? row.updated_at) : null,
    dispatchedAt: lastEventAt('op-dispatched'), questionAt: lastEventAt('worker-question-bridged'), now, windowMs: settings.settledWindowMs,
    terminal: terminalFactsOf(db, jobId),
  };
}

/** Keys of the resync: open op jobs of running workflows, settled ones of the last settledWindowMs, and each running workflow. */
export function listKeysOf(db, ledgerId, { now = Date.now(), settings = jobSettings(), openClockJobs = [] } = {}) {
  const live = db.prepare(`SELECT j.job_id, j.workflow_id FROM jobs j JOIN workflows w ON w.workflow_id=j.workflow_id
    WHERE j.kind='op' AND w.archived_at IS NULL AND COALESCE(w.phase,'') <> 'finished' AND j.status IN (${OPEN.map(() => '?').join(',')})`).all(...OPEN);
  const settled = db.prepare(`SELECT job_id, workflow_id FROM jobs WHERE kind='op' AND status IN (${SETTLED.map(() => '?').join(',')}) AND updated_at>?`)
    .all(...SETTLED, now - settings.settledWindowMs);
  const owing = db.prepare("SELECT j.job_id FROM jobs j JOIN workflows w ON w.workflow_id=j.workflow_id WHERE j.kind='op' AND w.archived_at IS NULL AND w.phase='running' AND j.status IN ('failed','awaiting_owner')").all()
    .filter((r) => terminalFactsOf(db, r.job_id) !== null);
  const keys = new Set();
  for (const r of [...live, ...settled, ...owing]) keys.add(jobKey(ledgerId, r.job_id));
  for (const id of openClockJobs) keys.add(jobKey(ledgerId, id));
  for (const r of live) keys.add(wfKey(ledgerId, r.workflow_id));
  return [...keys];
}

/* ------------------------------------------------------------------------------------------------ the planner */

/**
 * The plan of one job: {step: {kind, concern, ...} | null, clocks: [{state, enteredAt, slaMs}]}. Pure.
 * `frontier` is starci kernel status frontier (deadWorkerJobs, heldWorkerJobs); `questions` the status workerQuestions of this job.
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
  if (live && f.report) planReport(f, clock, set);
  if (f.status === 'answering') {
    clock('QUESTION_OVERDUE', f.questionAt ?? f.updatedAt);
    set({ kind: 'questions', concern: 'job.consume-check', questions: questions.filter((q) => q?.jobId === f.jobId) });
  }
  if (f.status === 'effect_unknown') {
    clock('EFFECT_UNKNOWN_STUCK', f.updatedAt);
    if (f.now - f.updatedAt > settings.effectUnknownMs) set({ kind: 'effect-unknown', concern: 'job.worker', verb: 'reconcile', argv: ['--job', f.jobId] });
  }
  if (SETTLED.includes(f.status) && !f.released && f.now - f.updatedAt <= f.windowMs) planCloseVerify(f, clock, set);
  if (f.terminal && !f.terminal.taken) planTerminal(f, clock, set);
  return { step, clocks };
}

/** The clock and step of a live job with a report. Consume is part of settle (settle-runtime-service): SETTLE_OVERDUE / DECISION_OVERDUE time the report, no separate CONSUME_OVERDUE clock. */
function planReport(f, clock, set) {
  if (f.handover) {
    clock('DECISION_OVERDUE', f.handover.at);
    set({ kind: 'settle-nongreen', concern: 'job.consume-check', reason: f.handover.reason });
  } else if (f.report.outcome !== 'done' || KERNEL_ONLY_OPS.includes(f.op)) {
    // The settler never settles these; its handover is the Kernel's item (starci kernel status settleDecisions).
    clock('DECISION_OVERDUE', f.report.filedAt);
    set({ kind: 'settle-nongreen', concern: 'job.consume-check', reason: KERNEL_ONLY_OPS.includes(f.op) ? 'owner-act' : `outcome-${f.report.outcome}` });
  } else {
    clock('SETTLE_OVERDUE', f.report.filedAt);
    set({ kind: 'settle', concern: 'job.settle' });
  }
}

/** The clock and step of a job left terminal with nothing after it (policy holds failed-no-step, owner-wait-no-ask). */
function planTerminal(f, clock, set) {
  clock('DECISION_OVERDUE', f.terminal.since);
  // An owner wait with no ask is the retry move of mechanical-moves.mjs (its refusal opens the retry-decision item).
  if (f.terminal.hold === TERMINAL_HOLDS.failedNoStep) set({ kind: 'route-failure', concern: 'job.settle', verb: 'reconcile', argv: ['--job', f.jobId, '--route-failure'] });
}

/** The clock and step of a settled job whose worker release is not proven. */
function planCloseVerify(f, clock, set) {
  const handle = f.payload.managed ? null : (f.workerId ?? f.payload.orca?.agentTerminalHandle ?? f.payload.launchTerminal?.handle ?? null);
  if (!handle && !f.payload.managed) return;
  if (!f.releaseProof) clock('WORKER_RELEASE_LEAK', f.settledAt ?? f.updatedAt);
  set({ kind: 'close-verify', concern: 'job.close-verify', proven: Boolean(f.releaseProof), handle });
}

/** The per-workflow dispatch plan from starci kernel status progress. Pure. */
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

/** The retry-decision Decision Item of a terminal job whose step the runtime could not take: the Kernel's judgment, one per job. Pure. */
export function retryDecision(f, ledgerId, reason, { now = Date.now(), settings = jobSettings() } = {}) {
  return {
    schema: 'starci/decision-item@1', kind: 'retry-decision', idempotencyKey: `retry-decision:${f.jobId}`,
    decider: 'kernel', ledger: ledgerId, workflowId: f.workflowId, entity: { type: 'job', id: f.jobId },
    summary: `${f.op} ${f.jobId} ${f.status}: nothing follows it (${String(reason).slice(0, 220)}); retry with the failure fed back, switch agent, re-plan, or raise the typed gate`,
    evidence: [{ ref: `hold:${f.terminal?.hold ?? TERMINAL_HOLDS.failedNoStep}` }, { ref: `job:${f.jobId}` }],
    allowedVerbs: settings.allowedVerbs, dueAt: now + settings.decisionDueMs, escalateTo: 'supervisor', openedBy: OPENED_BY, openedAt: now,
  };
}

/* ------------------------------------------------------------------------------------------------ the [Worker] sweep */

/** Host seams for sweepWorkers (the same primitives as scripts/supervisor/supervisor-watchdog.mjs hostDeps):
 * worker-show reads the Dispatch's worker state, worker-stop fences it and worker-release (closeWorker) releases
 * the Dispatch, closes the terminal and proves the process tree ended - which also frees its provider reservation.
 * closeLeftover is the finished-job close of scripts/supervisor/workers.mjs closeWorkerTerminal (its own retry budget). */
export async function workerSweepDeps() {
  const [{ workerShow }, { workerStop }, { closeWorker }, closeWorkers] = await Promise.all([
    import('../../api/orca/worker-show.mjs'), import('../../api/orca/worker-stop.mjs'), import('../../machine/worker-close.mjs'),
    import('../../supervisor/workers.mjs')]);
  return {
    show: (dispatch) => workerShow({ dispatch }),
    stop: (dispatch) => workerStop({ dispatch }),
    release: (dispatch) => closeWorker({ dispatch }),
    closeLeftover: (m, args) => closeWorkers.closeWorkerTerminal(m, args),
  };
}
/** Shadow seams: worker-show stays a real read; worker-stop and worker-release are recorded no-ops answered as if
 * done, so the would-be close is visible in the result. `would` collects them. */
export function drySweep(deps, would) {
  return {
    show: deps.show,
    stop: (dispatch) => { would.push({ act: 'stop', dispatch }); return { ok: true, shadow: true }; },
    release: (dispatch) => { would.push({ act: 'release', dispatch }); return { ok: true, shadow: true }; },
    closeLeftover: (m, args) => { would.push({ act: 'close-leftover', jobId: args.jobId }); return { ok: true, shadow: true }; },
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

/**
 * A run refused because the job's workflow is archived (events_refuse_archived): terminal, never transient - retrying
 * it only repeats the refusal. Per engine process, per key and step; a new pass with other facts plans afresh.
 */
const ARCHIVED_REFUSAL = /workflow-archived: no further writes/;
const terminalRuns = new Map(); // jobKey -> step kind whose run was refused as workflow-archived
const isArchivedRefusal = (r) => ARCHIVED_REFUSAL.test(`${r?.error ?? ''}
${r?.stderr ?? ''}
${r?.stdout ?? ''}
${JSON.stringify(r?.value ?? null)}`);

async function reconcileJob(ctx, ledgerId, jobId, settings) {
  const f = ctx.read(ledgerId, (db) => jobFacts(db, jobId, { now: ctx.now(), settings }));
  if (!f) { for (const state of CLOCK_CODES) { ctx.clear(jobKey(ledgerId, jobId), state); } return { ok: true, action: 'gone' }; }
  const status = OPEN.includes(f.status) ? await ctx.status(ledgerId, f.workflowId) : null;
  const plan = planJob(f, { frontier: status?.frontier ?? {}, questions: status?.workerQuestions ?? [], settings });
  await keepClocks(ctx, ledgerId, jobId, plan.clocks);
  if (!OPEN.includes(f.status)) ctx.clear(jobKey(ledgerId, jobId), 'WORKER_STALLED');
  const s = plan.step;
  if (!s) return { ok: true, action: 'idle', clocks: plan.clocks.map((c) => c.state) };
  if (!may(ctx, s.concern)) return { ok: true, action: 'not-owned', step: s.kind };
  const key = jobKey(ledgerId, jobId);
  if (terminalRuns.get(key) === s.kind) return { ok: true, action: 'terminal', step: s.kind, why: 'workflow-archived' };
  const r = await actJob(ctx, ledgerId, jobId, f, s, settings);
  if (r?.ok === false && isArchivedRefusal(r)) {
    terminalRuns.set(key, s.kind);
    ctx.log('reconciler.event', `job ${key} ${s.kind}: workflow-archived refused the write; terminal, not retried`, { kind: 'reconciler.terminal-refusal', key, step: s.kind });
    return { ...r, ok: true, action: s.kind, terminal: 'workflow-archived' };
  }
  return r;
}

async function actJob(ctx, ledgerId, jobId, f, s, settings) {
  const repo = ledgerOf(ctx, ledgerId)?.repo;
  switch (s.kind) {
    case 'dead-worker': case 'release-worker': case 'effect-unknown':
      return { action: s.kind, ...(await ctx.api(ledgerId, s.verb, s.argv)) };
    case 'settle':
      // The runtime settler for this one job: reconcileJobSettle (consume, re-verify / canon parity, starci kernel record-checks + settle, release).
      return { action: 'settle', ...(await ctx.run('node', [SETTLER_SCRIPT, '--repo', repo, '--job', jobId, '--json'], { timeoutMs: settings.settleRunTimeoutMs })) };
    case 'route-failure':
      return routeFailure(ctx, ledgerId, f, s, settings);
    case 'settle-nongreen':
      return { action: 'settle-nongreen', ...(await ctx.openDecision(settleDecision(f, ledgerId, { now: ctx.now(), settings }))) };
    case 'questions': {
      const bridged = await ctx.api(ledgerId, 'questions', ['--workflow', f.workflowId]);
      const opened = await mapInOrder(s.questions, (q) => {
        const id = q.questionId ?? q.id ?? q.dispatchId ?? q.at ?? 'q';
        const ownerOnly = ownerOnlyQuestion(q.text ?? q.question);
        return ctx.openDecision({ schema: 'starci/decision-item@1', kind: 'worker-question', idempotencyKey: `worker-question:${jobId}:${id}`,
          decider: ownerOnly ? 'owner' : 'kernel', ledger: ledgerId, workflowId: f.workflowId, entity: { type: 'job', id: jobId },
          summary: `${f.op} ${jobId} asks: ${String(q.text ?? q.question ?? '').slice(0, 300)}`, evidence: [{ ref: `worker-question:${id}` }],
          allowedVerbs: ['reply', 'nudge', 'reconcile'], dueAt: ctx.now() + settings.sla.QUESTION_OVERDUE, escalateTo: ownerOnly ? 'owner' : 'supervisor', openedBy: OPENED_BY, openedAt: ctx.now() });
      });
      return { action: 'questions', ok: bridged.ok !== false, decisions: opened.length };
    }
    case 'close-verify': {
      if (s.proven) {
        // The settler records the release (job-settle-released) from the payload proof on its next pass; nothing to close.
        return { action: 'close-verify', ...(await ctx.run('node', [SETTLER_SCRIPT, '--repo', repo, '--job', jobId, '--json'], { timeoutMs: settings.settleRunTimeoutMs })) };
      }
      const r = await ctx.run('node', [SETTLER_SCRIPT, '--repo', repo, '--job', jobId, '--json'], { timeoutMs: settings.settleRunTimeoutMs });
      const closedNow = (r?.value?.results ?? []).flatMap((x) => x.released ?? []).filter((x) => x.closedNow);
      if (closedNow.length && ctx.mode === 'active') {
        // A terminal the settle step should have closed is a bug of that step (INV-J2): one lesson per day.
        try { (await import('../../machine/lessons.mjs')).recordLeftover({ klass: 'op-worker-after-settle', count: closedNow.length, examples: closedNow.map((x) => x.jobId), env: ctx.env }); } catch { /* a lesson */ }
      }
      return { action: 'close-verify', closedNow: closedNow.length, ...r };
    }
    default: return { ok: true, action: 'idle' };
  }
}

/**
 * The failed-no-step step: the Kernel verb routes the job. A step that records none, a refusal, or a wait on a leg that has
 * no job past the hold's bound is the Kernel's judgment, so it opens the retry-decision Decision Item.
 */
async function routeFailure(ctx, ledgerId, f, s, settings) {
  const r = await ctx.api(ledgerId, s.verb, s.argv);
  const step = r?.value?.step ?? null;
  const wait = r?.value?.wait ?? null;
  const stale = ctx.now() - f.terminal.since > holdView(TERMINAL_HOLDS.failedNoStep).deadlineMs;
  let reason = null;
  if (r?.ok === false) reason = `route-failure refused: ${String(r.error ?? r.stderr ?? 'no reason').slice(0, 200)}`;
  else if (step?.kind === 'none') reason = step.reason;
  else if (wait?.why === 'no-job' && stale) reason = `it waits for ${wait.on}, which has no job`;
  if (!reason) return { action: 'route-failure', ...r };
  return { action: 'route-failure', ...r, decision: (await ctx.openDecision(retryDecision(f, ledgerId, reason, { now: ctx.now(), settings }))) };
}

async function reconcileWorkflow(ctx, ledgerId, workflowId, settings) {
  const status = await ctx.status(ledgerId, workflowId);
  if (!status || status.phase === 'finished' || status.archivedAt) return { ok: true, action: 'ended' };
  const id = `${ledgerId}:${workflowId}`;
  const moved = may(ctx, 'job.settle') ? await runMechanicalMoves(ctx, ledgerId, status, { facts: (jobId) => ctx.read(ledgerId, (db) => jobFacts(db, jobId, { now: ctx.now(), settings })), refused: (f, reason) => retryDecision(f, ledgerId, reason, { now: ctx.now(), settings }) }) : [];
  if (moved.length) ctx.log('reconciler.act', `workflow ${id} ran ${moved.length} mechanical retry move(s)`, { moved });
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

async function reconcileWorkers(ctx, settings) {
  if (!may(ctx, 'job.close-verify')) return { ok: true, action: 'not-owned' };
  const { sweepWorkers } = await import('../../supervisor/supervisor-watchdog.mjs');
  const deps = await workerSweepDeps();
  if (ctx.mode !== 'active') {
    const would = [];
    const { readSupervisor } = await import('../../machine/home.mjs');
    const out = readSupervisor((m) => sweepWorkers(dryLedger(m, would), drySweep(deps, would), { now: ctx.now() }), null, { env: ctx.env ?? process.env }) ?? { deaths: [], closed: [] };
    if (out.deaths.length || out.closed.length || out.skipped?.length) ctx.log('reconciler.would', `job would sweep [Worker] jobs: ${out.deaths.length} death(s), ${out.closed.length} close(s), ${out.skipped?.length ?? 0} skipped`, { deaths: out.deaths, closed: out.closed, skipped: out.skipped ?? [], would: would.slice(0, 20) });
    return { ok: true, action: 'workers', shadow: true, deaths: out.deaths.length, closed: out.closed.length, skipped: out.skipped?.length ?? 0 };
  }
  const { withSupervisor } = await import('../../machine/home.mjs');
  return withSupervisor((m) => {
    const out = sweepWorkers(m, deps, { now: ctx.now() });
    if (out.deaths?.length || out.closed?.length || out.skipped?.length) ctx.log('reconciler.act', `job swept [Worker] jobs: ${out.deaths.length} death(s), ${out.closed.length} closed, ${out.skipped?.length ?? 0} skipped`, out);
    return { ok: true, action: 'workers', ...out };
  }, { env: ctx.env ?? process.env });
}

export { _health } from '../job-health.mjs';

export default {
  name: 'job',
  concerns: ['job.settle', 'job.worker', 'job.dispatch', 'job.consume-check', 'job.close-verify'],
  resyncMs: 30_000,
  concurrency: 2,
  timeoutMs: 960_000,
  routes: {
    'op-dispatched': jobRoute, 'op-reported': jobRoute, 'report-consumed': jobRoute, 'checks-recorded': jobRoute, 'op-settled': jobRoute,
    'op-auto-settled': jobRoute, 'job-settle-*': jobRoute, 'worker-*': jobRoute, 'incident-raised': wfRoute, 'incident-resolved': wfRoute,
  },
  async list(ctx) {
    const settings = jobSettings();
    const keys = [];
    // The [Worker] jobs are machine.sqlite sup_jobs (no supervisor ledger).
    const { readSupervisor } = await import('../../machine/home.mjs');
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
    return reconcileJob(ctx, k.ledgerId, k.id, settings);
  },
};

/* ------------------------------------------------------------------------------------------------ --dry */

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const val = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  if (!argv.includes('--dry')) { console.error('use: job.mjs --dry [--repo <path>] [--workflow <id>] [--json]'); process.exit(2); }
  const { openLedgerReader, ledgerFileFor } = await import('../../../engine/db/ledger.mjs');
  const { productRepos } = await import('../../machine/home.mjs');
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
  else for (const p of out) console.log(`${p.key} ${p.status} step=${p.step ?? '-'}${p.reason ? ' (' + p.reason + ')' : ''} clocks=[${p.clocks.join(', ')}]`);
}
