#!/usr/bin/env node
// workflow.mjs — the reconciler's Workflow controller (DESIGN.md §8.2, §9.2, §17.1; lane rc-sla-workflow). Contract:
// modules/reconciler/workflow.yaml. Engine contract: LANES.md "Shared contract" (lane rc-engine discovers this file).
//
// One key per running workflow, `workflow:<ledgerId>:<workflowId>`. Each pass reads ONE projection - the cached
// `starci kernel status --json` (ctx.status: progress, rca, frontier, stuck[], kernelRev) and scripts/supervisor/stall.mjs
// stallFindings over a read-only handle, its frontierOf answered from that same cached status - and from it:
//   - keeps the SLA clocks of the workflow (stalled, orphaned, rev-ack, goal text, one per stuck[] wait);
//   - opens one Decision Item per finding for the Kernel (progress-stall, stale-gate, stale-wait, stale-peer-wait,
//     unread-peer, orphaned-frontier, rev-ack), escalates a stall past progress.supervisorGraceMs to the Supervisor,
//     then rings the Kernel seat's doorbell (lane rc-decisions; a would-row until it lands and in shadow);
//   - re-parks an owner ask whose poll digest tag is dead, stale or unserved (starci kernel serve-ask);
//   - finishes a finish-ready workflow (starci kernel finish).
// Everything that acts goes through ctx (ctx.api / ctx.openDecision carry the shadow gate). The pure planner,
// planWorkflow, holds every decision so specs read it without a ledger.
//
// It wraps, never re-implements: progress + rca come from starci kernel status (scripts/kernel/progress-rca.mjs), the stall
// notice from scripts/kernel/progress-rca.mjs stallNotice, the waits and their SLA from
// scripts/machine/op-metrics.mjs (stuck[], opTelemetry.stuckSla), the findings from stall.mjs, the ask tags from
// scripts/supervisor/poll.mjs openAsks.
//
// Internal args (spawned by the reconciler engine): --dry [--repo <path>]... [--workflow <id>] [--json].
//     one read-only pass over the live ledgers: prints the plan (clocks, would-DIs, re-parks, finish); writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLedgerReader, ledgerFileFor } from '../../../engine/db/ledger.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { clipLine } from '../../lib/clip.mjs';
import { positiveNumber } from '../../lib/number.mjs';
import { productLedgers } from '../../lib/ledgers.mjs';
import { stallFindings, peerWaits, ownerGates, namedWorkflows, lastProgress, apiFrontier } from '../../supervisor/stall.mjs';
import { openAsks } from '../../supervisor/poll.mjs';
import { progressSettings } from '../../kernel/progress-rca.mjs';
import { telemetrySettings } from '../../machine/op-metrics.mjs';
import { unresolvedPlaceholders } from '../../goal/goal-text.mjs';
import { productRepos } from '../../machine/home.mjs';
import { slaCatalog, clocksOf, setClock, clearClock } from '../sla.mjs'; import { isMain } from '../../lib/is-main.mjs';
import { gateViewsFromLedger } from '../../kernel/gate-ladder.mjs';
import { fixCandidatesOf } from '../gate-fix-candidates.mjs';
import { closeGateItems, gateSightOf } from '../gate-close.mjs';
import { strandedSupervisorDis } from '../supervisor-mirror.mjs';
import { planWorkflow, stuckPrefix, workflowEntity, SUPERVISOR_LEDGER } from '../workflow-plan.mjs';
import { eachInOrder, mapInOrder } from '../../lib/in-order.mjs';
import { recordSwap } from '../revision-swap.mjs';
import { runtimeHead } from '../../machine/self-reload.mjs';
export { planWorkflow, SUPERVISOR_LEDGER };
const selfFile = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(selfFile), '..', '..', '..');
const WORKFLOW_FILE = path.join(skillRoot, 'modules', 'reconciler', 'workflow.yaml');
const DEFAULT_ROUTES = ['incident-raised', 'incident-resolved', 'ask-serving', 'ask-serving-expired', 'ask-notified', 'ask-answered', 'ask-superseded',
  'peer-message-sent', 'peer-message-acked', 'op-settled', 'plan-derived', 'runtime-rev-acked', 'handover-approved', 'goal-defined'];

/* ------------------------------------------------------------------------------------------------ settings */

const num = (v, d) => positiveNumber(v, d, { orZero: true });

/** modules/reconciler/workflow.yaml + the runtimes.yaml numbers it cites. Never throws (defaults on a bad file). */
export function workflowSettings({ file = WORKFLOW_FILE, allocation = null, catalog = null } = {}) {
  let doc = {};
  try { doc = parseYaml(fs.readFileSync(file, 'utf8')) ?? {}; } catch { doc = {}; }
  let alloc = allocation;
  if (!alloc) { try { alloc = allocationSettings(); } catch { alloc = {}; } }
  const progress = progressSettings(alloc);
  let stuckSla = {};
  try { stuckSla = telemetrySettings(alloc).stuckSla; } catch { stuckSla = {}; }
  const cat = catalog ?? slaCatalog({ allocation: alloc });
  return {
    resyncMs: num(doc.resyncMs, 120_000), concurrency: num(doc.concurrency, 2),
    routes: Array.isArray(doc.routes) && doc.routes.length ? doc.routes.map(String) : DEFAULT_ROUTES,
    decisionDueMs: num(doc.decisionDueMs, 900_000),
    statusUnreadablePasses: Math.max(1, num(doc.statusUnreadablePasses, 3)),
    askRepark: { liveness: new Set((doc.askRepark?.liveness ?? ['dead', 'stale', 'unserved']).map(String)), minIntervalMs: num(doc.askRepark?.minIntervalMs, 1_800_000) },
    graceMs: progress.graceMs, supervisorGraceMs: progress.supervisorGraceMs,
    orphanedFrontierMs: num(alloc?.supervisorTick?.orphanedFrontierMs, 1_800_000),
    revAckMs: cat.codes.REV_ACK_OVERDUE?.slaMs ?? 1_800_000,
    goalMs: cat.codes.GOAL_TEXT_MISSING?.slaMs ?? 0,
    supervisorGateMs: cat.codes.SUPERVISOR_GATE_OVERDUE?.slaMs ?? num(alloc?.autopilot?.supervisorGateTimeoutMs, 21_600_000),
    stuckSla, supervisorOwed: Object.fromEntries(Object.entries(doc.supervisorOwed ?? {}).map(([kind, diKind]) => [kind, String(diKind)])),
  };
}

/* ------------------------------------------------------------------------------------------------ keys */

export const keyOf = (ledgerId, workflowId) => `workflow:${ledgerId}:${workflowId}`;
export function parseKey(key) {
  const m = /^workflow:([^:]+):(.+)$/.exec(String(key ?? ''));
  return m ? { ledgerId: m[1], workflowId: m[2] } : null;
}
const evWorkflow = (ev) => ev?.workflowId ?? ev?.workflow_id ?? null;
const evLedger = (ev) => ev?.ledgerId ?? ev?.ledger_id ?? null;

/* ------------------------------------------------------------------------------------------------ reads */

/** Read-only handles for every product ledger in view: Map(ledgerId -> {ledgerId, repo, file, db}); close with closeAll. */
function openReaders(ctx) {
  const out = new Map();
  for (const l of productLedgers(ctx)) {
    try { if (fs.existsSync(l.file)) out.set(l.ledgerId, { ...l, db: (ctx.openReader ?? openLedgerReader)(l.file) }); } catch { /* unreadable: out of view */ }
  }
  return out;
}
const closeAll = (readers) => { for (const r of readers.values()) { try { r.db.close(); } catch { /* closed */ } } };

/** The goal-text invariant of one workflow: {missing, why}. */
function goalOf(db, workflowId) {
  const row = db.prepare('SELECT markdown FROM goals WHERE workflow_id=? ORDER BY revision DESC, goal_seq DESC LIMIT 1').get(workflowId);
  if (!row) return { missing: true, why: 'no goal revision' };
  const text = String(row.markdown ?? '').trim();
  if (!text || /^null$/i.test(text)) return { missing: true, why: 'goal text empty or null' };
  const bad = unresolvedPlaceholders(text);
  if (bad.length) return { missing: true, why: `unrendered value ${bad.map((b) => 'line ' + b.line + ': ' + b.value).join('; ')}` };
  return { missing: false, why: null };
}

const lastServedAt = (db, workflowId, dispatchId) => Number(db.prepare(
  "SELECT MAX(created_at) at FROM events WHERE workflow_id=? AND kind IN ('ask-serving','ask-notified') AND json_extract(payload_json,'$.dispatchId')=?").get(workflowId, dispatchId)?.at) || null;

/** Whether an starci kernel status value carries a frontier to judge (apiFrontier's ok shape). */
const readable = (v) => Boolean(v && typeof v === 'object' && v.ok !== false && v.frontier);
/**
 * One starci kernel status read: {value, error, failure}; error names why it is unreadable (a throw, {ok:false,error}, no value).
 * Through ctx.statusRead when the ctx has it: failure = the spawn's cause (timeout | spawn | refused | exit | no-json),
 * exit code and stderr head, so a refusal cli.mjs printed on stderr (plan-edges-missing) is named, not 'no value'.
 */
async function readStatus(ctx, ledgerId, workflowId) {
  try {
    const { value: v, failure = null } = typeof ctx.statusRead === 'function' ? await ctx.statusRead(ledgerId, workflowId) : { value: await ctx.status(ledgerId, workflowId) };
    if (readable(v)) return { value: v, error: null, failure: null };
    const error = v && typeof v === 'object' ? (v.error ?? ((v.ok === false && 'ok:false with no error') || 'no frontier in the value'))
      : failure?.error ?? 'no value (starci kernel status timed out, exited non-zero or printed no JSON)';
    return { value: null, error: clipLine(error, 300), failure };
  } catch (error) { return { value: null, error: clipLine(`threw: ${error?.message ?? error}`, 200), failure: { cause: 'threw' } }; }
}
async function safeStatus(ctx, ledgerId, workflowId) { return (await readStatus(ctx, ledgerId, workflowId)).value; }

const heldOf = new WeakMap();
/**
 * The status this pass judges by. A readable read is kept as the workflow's last one; an unreadable read is not
 * evidence of anything (sdi-94355e8e, sdi-76a8404d, sdi-2f13ab61: 'frontier unreadable (status unreadable)' was
 * escalated as a progress-stall while an interface.draw op ran). It counts a miss and, below `passes` consecutive
 * misses, answers the last readable status; from `passes` on it answers null (stall.mjs then judges nothing).
 * Returns {status, unreadable: null | {misses, since, error, failure, heldAt}}. Kept per ctx, like recentlyOpened.
 */
function holdStatus(ctx, key, read, now, passes) {
  let m = heldOf.get(ctx);
  if (!m) { m = new Map(); heldOf.set(ctx, m); }
  const h = m.get(key) ?? { last: null, lastAt: null, misses: 0, since: null };
  if (read.value) { m.set(key, { last: read.value, lastAt: now, misses: 0, since: null }); return { status: read.value, unreadable: null }; }
  const next = { ...h, misses: h.misses + 1, since: h.since ?? now };
  m.set(key, next);
  const hold = next.last && next.misses < passes;
  return { status: hold ? next.last : null, unreadable: { misses: next.misses, since: next.since, error: read.error, failure: read.failure ?? null, heldAt: hold ? next.lastAt : null } };
}
/** An starci kernel status value in the shape stall.mjs frontierOf answers (apiFrontier). */
const asFrontier = (v) => (v?.frontier && v.ok !== false ? { ...v, ok: true, frontier: v.frontier ?? {}, workers: v.workers ?? [] } : { ok: false, error: v?.error ?? 'status unreadable' });

/* ------------------------------------------------------------------------------------------------ apply */

const memoOf = new WeakMap();
/** Whether this ctx opened `key` less than `ms` ago (a would-row or a DI once per decision window, not per pass). */
function recentlyOpened(ctx, key, now, ms) {
  let m = memoOf.get(ctx);
  if (!m) { m = new Map(); memoOf.set(ctx, m); }
  const at = m.get(key);
  if (at != null && now - at < ms) return true;
  m.set(key, now);
  return false;
}

/** lane rc-decisions scripts/machine/decisions.mjs, when it exists (guarded: this lane lands first or after). */
let decisionsModule;
async function decisionsMod() {
  if (decisionsModule !== undefined) return decisionsModule;
  try { decisionsModule = await import('../../machine/decisions.mjs'); } catch { decisionsModule = null; }
  return decisionsModule;
}

async function ringKernelDoorbell(ctx, { ledgerId, workflowId, keys }) {
  const mod = ctx.mode === 'active' ? await decisionsMod() : null;
  if (mod && typeof mod.ringDoorbell === 'function') {
    try { return { rung: true, result: await mod.ringDoorbell(ctx, { ledgerId, workflowId, decider: 'kernel', keys, wake: (await import('../../kernel/wake-delivery.mjs')).wakeKernel }) }; } catch (error) { return { rung: false, error: String(error?.message ?? error).slice(0, 160) }; }
  }
  try { await ctx.log?.('reconciler.would', `doorbell kernel ${workflowId}: ${keys.length} decision(s)`, { controller: 'workflow', action: 'doorbell', ledgerId, workflowId, keys }); } catch { /* best effort */ }
  return { rung: false, would: true };
}

/** Clear every open clock of one workflow (it ended or left view). */
async function clearWorkflowClocks(ctx, ledgerId, workflowId) {
  const wfEntity = workflowEntity(ledgerId, workflowId), prefix = stuckPrefix(ledgerId, workflowId);
  const open = clocksOf(ctx, { prefixes: [wfEntity, prefix] }).filter((c) => c.entity === wfEntity || c.entity.startsWith(prefix));
  await eachInOrder(open, (c) => clearClock(ctx, c));
  return open.length;
}

/* ------------------------------------------------------------------------------------------------ the controller */

const settingsNow = () => workflowSettings();
/** The stall-episode clocks an unjudged pass (starci kernel status unreadable, none held) keeps open. */
const UNJUDGED_KEEP = new Set(['STALL_UNOWNED', 'STALL_ESCALATED', 'ORPHANED_FRONTIER']);
const defaults = settingsNow();

/** The status of each peer workflow a gate or wait of `workflowId` names (never a second read of its own): Map(workflowId -> status). */
async function peerStatuses(ctx, readers, own, workflowId, status) {
  const peers = new Set([...peerWaits(own.db, workflowId).map((w) => w.peer), ...ownerGates(own.db, workflowId).flatMap((g) => namedWorkflows(g.text))]
    .filter((p) => p && p !== workflowId));
  const statuses = new Map([[workflowId, status]]);
  await eachInOrder(peers, async (p) => {
    const holder = [...readers.values()].find((r) => { try { return Boolean(r.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(p)); } catch { return false; } });
    if (holder) statuses.set(p, await safeStatus(ctx, holder.ledgerId, p));
  });
  return statuses;
}

/** What one pass reads of a running workflow: {base, findings, asks, status, unreadable}, or {early} for a workflow out of view or ended. */
async function readFacts(ctx, readers, { key, ledgerId, workflowId, now, settings }) {
  const own = readers.get(ledgerId);
  if (!own) return { early: { ok: true, key, skipped: 'ledger-out-of-view', cleared: await clearWorkflowClocks(ctx, ledgerId, workflowId) } };
  const row = own.db.prepare('SELECT workflow_id, phase, archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
  if (row?.phase !== 'running' || row?.archived_at != null) {
    return { early: { ok: true, key, ended: row?.phase ?? 'unknown', cleared: await clearWorkflowClocks(ctx, ledgerId, workflowId) } };
  }
  const base = { goal: goalOf(own.db, workflowId), lastProgress: lastProgress(own.db, workflowId) };
  const { status, unreadable } = holdStatus(ctx, key, await readStatus(ctx, ledgerId, workflowId), now, settings.statusUnreadablePasses ?? 3);
  const statuses = await peerStatuses(ctx, readers, own, workflowId, status);
  const findings = stallFindings(own.db, {
    repo: own.repo, ledgers: [...readers.values()].map((r) => ({ repo: r.repo, db: r.db })), now, wanted: new Set([workflowId]),
    frontierOf: (_repo, wf) => asFrontier(statuses.get(wf)),
    ...(ctx.kernelTurnOf ? { kernelTurnOf: ctx.kernelTurnOf } : {}),
  });
  const open = await (ctx.openAsks ?? openAsks)(own.db, new Set([workflowId]));
  const asks = open.map((a) => ({ dispatchId: a.dispatch_id, liveness: a.liveness, lastServedAt: lastServedAt(own.db, workflowId, a.dispatch_id) }));
  const gates = gatesOf(status, own.db, workflowId, { now, timeoutMs: settings.supervisorGateMs });
  return { base, findings, asks, status, unreadable, gates, sight: gateSightOf([own]),
    stranded: strandedSupervisorDis(own.db, { ledgerId, ledgerName: path.basename(own.repo), workflowId, now }) };
}

/**
 * The open supervisor-gates of the pass: the status's own view, else the ledger's (an unreadable status never leaves a gate without its Supervisor item).
 * A runtime-defect gate carries the live runtime revision and the commits since it was raised that touch what its cause names (gate-fix-candidates.mjs).
 */
function gatesOf(status, db, workflowId, { now, timeoutMs }) {
  const gates = status?.autopilot?.supervisorGates ?? gateViewsFromLedger(db, workflowId, { now, timeoutMs });
  const rev = runtimeHead({ root: skillRoot });
  return gates.map((gate) => (gate.cause === 'runtime-defect' || gate.cause === 'unclassified' ? { ...gate, runtimeRev: rev, fixCandidates: fixCandidatesOf(gate, rev) } : gate));
}

/** Start / keep the plan's clocks and clear the rest of the workflow's; how many were cleared. */
async function syncClocks(ctx, plan, existing, { ledgerId, workflowId, wfEntity, status }) {
  const wanted = new Set(plan.clocks.map((c) => `${c.entity}\u0000${c.state}`));
  await eachInOrder(plan.clocks, (c) => setClock(ctx, { ...c, ledgerId, meta: { controller: 'workflow', workflowId } }));
  let cleared = 0;
  // A pass that judged nothing (no status) neither starts nor ends a stall episode: its clocks stay as they were.
  const unjudged = (c) => !status && c.entity === wfEntity && UNJUDGED_KEEP.has(c.state);
  await eachInOrder(existing, async (c) => { if (!wanted.has(`${c.entity}\u0000${c.state}`) && !unjudged(c)) { await clearClock(ctx, c); cleared += 1; } });
  return cleared;
}

/** Open the plan's Decision Items once per decision window; the ones opened. */
async function openDecisions(ctx, plan, now, settings) {
  const opened = [];
  await eachInOrder(plan.decisions, async (d) => {
    if (recentlyOpened(ctx, d.idempotencyKey, now, settings.decisionDueMs)) return;
    try { await ctx.openDecision(d); opened.push(d); } catch (error) { plan.lines.push(`DI ${d.idempotencyKey} failed: ${String(error?.message ?? error).slice(0, 120)}`); }
  });
  return opened;
}

/**
 * The key a runtime land (the Supervisor ledger's land-passed event) routes to: every running workflow is looked at at once, so a Kernel
 * whose acknowledged revision the land made stale is woken now instead of at the next resync. The wake itself is the one reconcileWorkflow
 * rings (planRev: one doorbell per workflow and revision), so a land wakes a seat at most once.
 */
export const REV_WAKE_KEY = 'rev-wake';

/** The re-look of every running workflow after a land: {ok, key, looked: [workflow keys]}. The status cache is dropped first so the pass reads the new revision; the re-look is recorded as a runtime-change-applied signal. */
async function reconcileAfterLand(ctx, settings) {
  ctx.dropStatusCache?.();
  const keys = await listWorkflows(ctx);
  const results = await mapInOrder(keys, (workflowKey) => reconcileWorkflow(workflowKey, ctx, { settings }));
  const doorbells = results.filter((r) => r?.doorbell).length;
  const applied = [{ action: 'workflows-looked-at', count: keys.length }, { action: 'kernel-doorbells-rung', count: doorbells }];
  recordSwap(ctx.machine, { cause: 'land', toRev: runtimeHead({ root: skillRoot }), applied, at: ctx.now() });
  return { ok: results.every((r) => r?.ok !== false), key: REV_WAKE_KEY, looked: keys, doorbells };
}

export async function reconcileWorkflow(key, ctx, { settings = workflowSettings() } = {}) {
  if (key === REV_WAKE_KEY) return reconcileAfterLand(ctx, settings);
  const k = parseKey(key);
  if (!k) return { ok: false, key, skipped: 'bad-key' };
  const { ledgerId, workflowId } = k;
  const now = ctx.now();
  const readers = openReaders(ctx);
  const wfEntity = workflowEntity(ledgerId, workflowId), prefix = stuckPrefix(ledgerId, workflowId);
  let facts;
  try { facts = await readFacts(ctx, readers, { key, ledgerId, workflowId, now, settings }); } finally { closeAll(readers); }
  if (facts.early) return facts.early;
  const { base, findings, asks, status, unreadable, gates, sight, stranded } = facts;

  const existing = clocksOf(ctx, { prefixes: [wfEntity, prefix] }).filter((c) => c.entity === wfEntity || c.entity.startsWith(prefix));
  const plan = planWorkflow({ ledgerId, workflowId, status, findings, goal: base.goal, asks, gates, clocks: existing, unreadable, now, settings });

  const cleared = await syncClocks(ctx, plan, existing, { ledgerId, workflowId, wfEntity, status });

  // decisions, then one doorbell for the Kernel's
  const opened = await openDecisions(ctx, plan, now, settings);
  // The items a Kernel verb opened for the Supervisor in this product ledger reach the Supervisor's own store.
  await openDecisions(ctx, { decisions: stranded, lines: plan.lines }, now, settings);
  // The Supervisor's items of this workflow's gates close with the gate, and an older revision's item closes when the newer one stands.
  if (ctx.mode === 'active') closeGateItems(sight, { env: ctx.env ?? process.env, now });
  const kernelKeys = opened.filter((d) => d.decider === 'kernel').map((d) => d.idempotencyKey);
  // A stale runtime rev not yet overdue is a re-wake, not a decision: one doorbell per (workflow, rev).
  if (plan.rewake && !recentlyOpened(ctx, `rev-wake:${workflowId}:${plan.rewake}`, now, settings.revAckMs)) kernelKeys.push(`rev:${plan.rewake}`);
  const doorbell = kernelKeys.length ? await ringKernelDoorbell(ctx, { ledgerId, workflowId, keys: kernelKeys }) : null;

  // asks and finish: api verbs (ctx.api is the shadow gate)
  const acted = await mapInOrder(plan.reparks, async (dispatchId) => ({ verb: 'serve-ask', dispatchId, result: await ctx.api(ledgerId, 'serve-ask', ['--workflow', workflowId, '--dispatch', dispatchId], { timeoutMs: 120_000 }) }));
  if (plan.finish) acted.push({ verb: 'finish', result: await ctx.api(ledgerId, 'finish', ['--workflow', workflowId], { timeoutMs: 240_000 }) });

  return { ok: true, key, statusRead: !unreadable, ...(unreadable ? { statusUnreadable: unreadable } : {}), findings: findings.map((f) => f.type), clocks: plan.clocks.length, cleared,
    decisions: opened.map((d) => d.idempotencyKey), doorbell, acted: acted.map((a) => ({ verb: a.verb, ...(a.dispatchId ? { dispatchId: a.dispatchId } : {}), shadow: a.result?.shadow === true, ok: a.result?.ok !== false })),
    lastProgress: base.lastProgress, lines: plan.lines };
}

/** Keys for the periodic resync: every running workflow, plus any workflow that still holds an open clock. */
export async function listWorkflows(ctx) {
  const keys = new Set();
  const readers = openReaders(ctx);
  try {
    for (const r of readers.values()) {
      try { for (const w of r.db.prepare("SELECT workflow_id FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id").all()) keys.add(keyOf(r.ledgerId, w.workflow_id)); } catch { /* unreadable */ }
    }
  } finally { closeAll(readers); }
  for (const c of clocksOf(ctx, { prefixes: ['workflow:', 'stuck:'] })) {
    const p = c.entity.split(':');
    if (p[0] === 'workflow' && p.length >= 3) keys.add(keyOf(p[1], p.slice(2).join(':')));
    else if (p[0] === 'stuck' && p.length >= 4) keys.add(keyOf(p[1], p[2]));
  }
  return [...keys];
}

const route = (ev) => {
  const wf = evWorkflow(ev), ledgerId = evLedger(ev);
  return wf && ledgerId && ledgerId !== SUPERVISOR_LEDGER ? keyOf(ledgerId, wf) : null;
};

export default {
  name: 'workflow',
  concerns: ['workflow.stall-wake', 'workflow.progress', 'workflow.ask-repark'],
  resyncMs: defaults.resyncMs,
  concurrency: defaults.concurrency,
  routes: { ...Object.fromEntries(defaults.routes.map((kind) => [kind, route])), 'land-passed': (ev) => (evLedger(ev) === SUPERVISOR_LEDGER ? REV_WAKE_KEY : null) },
  list: (ctx) => listWorkflows(ctx),
  reconcile: (key, ctx) => reconcileWorkflow(key, ctx, { settings: settingsNow() }),
};

/* ------------------------------------------------------------------------------------------------ --dry */

/** A ctx that writes nothing: statuses through starci kernel status (read-only), every action recorded. */
function dryCtx({ repos = productRepos(), now = Date.now() } = {}) {
  const would = [];
  const cache = new Map();
  const ledgers = repos.map((repo) => ({ ledgerId: path.basename(repo), repo, file: ledgerFileFor(repo) }));
  const repoOf = (id) => ledgers.find((l) => l.ledgerId === id)?.repo ?? null;
  return {
    mode: 'shadow', now: () => now, ledgers, would,
    status: async (ledgerId, wf) => {
      const k = `${ledgerId}|${wf}`;
      if (!cache.has(k)) cache.set(k, apiFrontier(repoOf(ledgerId), wf));
      return cache.get(k);
    },
    api: async (ledgerId, verb, argv) => { would.push({ type: 'api', ledgerId, verb, argv }); return { ok: true, shadow: true }; },
    run: async (cmd, args) => { would.push({ type: 'run', cmd, args }); return { ok: true, shadow: true }; },
    openDecision: async (di) => { would.push({ type: 'decision', key: di.idempotencyKey, decider: di.decider, summary: di.summary }); return { ok: true, shadow: true }; },
    clock: async (entity, state, slaMs, meta) => { would.push({ type: 'clock', entity, state, slaMs, enteredAt: meta?.enteredAt }); },
    clear: async (entity, state) => { would.push({ type: 'clear', entity, state }); },
    log: async (kind, msg) => { would.push({ type: 'log', kind, msg }); },
    owns: () => false,
    stateFile: path.join(path.dirname(selfFile), '__no_state_db__.sqlite'),
  };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [path.resolve(argv[i + 1])] : []));
  const only = argv.flatMap((a, i) => (a === '--workflow' && argv[i + 1] ? [argv[i + 1]] : []));
  if (!argv.includes('--dry')) {
    console.log('args: --dry [--repo <path>]... [--workflow <id>] [--json]\n(the reconciler engine runs this controller)');
  } else {
    const ctx = dryCtx(repos.length ? { repos } : {});
    const keys = (await listWorkflows(ctx)).filter((k) => !only.length || only.includes(parseKey(k)?.workflowId));
    const results = [];
    await eachInOrder(keys, async (key) => {
      const before = ctx.would.length;
      const r = await reconcileWorkflow(key, ctx);
      results.push({ ...r, would: ctx.would.slice(before).filter((w) => w.type !== 'clock' && w.type !== 'clear') , clockRows: ctx.would.slice(before).filter((w) => w.type === 'clock').map((w) => `${w.entity} ${w.state}`) });
    });
    if (argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
    else {
      for (const r of results) {
        console.log(r.key + (r.ended ? ` ended (${r.ended})` : '') + (r.skipped ? ` skipped ${r.skipped}` : '') + `: findings [${(r.findings ?? []).join(', ')}] clocks ${r.clocks ?? 0}`);
        for (const w of r.would) console.log('  would ' + ((w.type === 'decision' && `DI ${w.decider} ${w.key}: ${clipLine(w.summary, 140)}`) || (w.type === 'api' && `api ${w.verb} ${w.argv.join(' ')}`) || `${w.type} ${w.kind ?? ''} ${w.msg ?? ''}`));
        for (const c of r.clockRows) console.log(`  clock ${c}`);
      }
      console.log(`${results.length} workflow(s); ${results.reduce((n, r) => n + r.would.filter((w) => w.type === 'decision').length, 0)} would-DI(s)`);
    }
  }
}
