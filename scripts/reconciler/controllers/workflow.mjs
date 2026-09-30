#!/usr/bin/env node
// workflow.mjs — the reconciler's Workflow controller (DESIGN.md §8.2, §9.2, §17.1; lane rc-sla-workflow). Contract:
// modules/reconciler/workflow.yaml. Engine contract: LANES.md "Shared contract" (lane rc-engine discovers this file).
//
// One key per running workflow, `workflow:<ledgerId>:<workflowId>`. Each pass reads ONE projection - the cached
// `api status --json` (ctx.status: progress, rca, frontier, stuck[], kernelRev) and scripts/supervisor/stall.mjs
// stallFindings over a read-only handle, its frontierOf answered from that same cached status - and from it:
//   - keeps the SLA clocks of the workflow (stalled, orphaned, rev-ack, goal text, one per stuck[] wait);
//   - opens one Decision Item per finding for the Kernel (progress-stall, stale-gate, stale-wait, stale-peer-wait,
//     unread-peer, orphaned-frontier, rev-ack), escalates a stall past progress.supervisorGraceMs to the Supervisor,
//     then rings the Kernel seat's doorbell (lane rc-decisions; a would-row until it lands and in shadow);
//   - re-parks an owner ask whose poll digest tag is dead, stale or unserved (api serve-ask);
//   - finishes a finish-ready workflow (api finish).
// Everything that acts goes through ctx (ctx.api / ctx.openDecision carry the shadow gate). The pure planner,
// planWorkflow, holds every decision so specs read it without a ledger.
//
// It wraps, never re-implements: progress + rca come from api status (scripts/kernel/progress-rca.mjs), the stall
// notice from scripts/kernel/progress-rca.mjs stallNotice, the waits and their SLA from
// scripts/supervisor/op-metrics.mjs (stuck[], opTelemetry.stuckSla), the findings from stall.mjs, the ask tags from
// scripts/supervisor/poll.mjs openAsks.
//
//   node scripts/reconciler/controllers/workflow.mjs --dry [--repo <path>]... [--workflow <id>] [--json]
//     one read-only pass over the live ledgers: prints the plan (clocks, would-DIs, re-parks, finish); writes nothing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openLedgerReader, ledgerFileFor } from '../../../engine/ledger-db.mjs';
import { parseYaml } from '../../../engine/yaml.mjs';
import { allocationSettings } from '../../../engine/config.mjs';
import { clipLine } from '../../lib/clip.mjs';
import { stallFindings, peerWaits, ownerGates, namedWorkflows, lastProgress, apiFrontier } from '../../supervisor/stall.mjs';
import { openAsks } from '../../supervisor/poll.mjs';
import { progressSettings } from '../../kernel/progress-rca.mjs';
import { stallNotice } from '../../kernel/progress-rca.mjs';
import { telemetrySettings } from '../../supervisor/op-metrics.mjs';
import { unresolvedPlaceholders } from '../../goal/goal-text.mjs';
import { shortRev } from '../../kernel/runtime-rev.mjs';
import { productRepos } from '../../supervisor/home.mjs';
import { slaCatalog, clocksOf, setClock, clearClock, CRITICAL_SUFFIX } from '../sla.mjs';

const selfFile = fileURLToPath(import.meta.url);
const skillRoot = path.resolve(path.dirname(selfFile), '..', '..', '..');
export const WORKFLOW_FILE = path.join(skillRoot, 'modules', 'reconciler', 'workflow.yaml');
export const DI_SCHEMA = 'starci/decision-item@1';
export const OPENED_BY = 'workflow-controller';
export const SUPERVISOR_LEDGER = 'supervisor';
/** api status stuck[] kind -> violation code (DESIGN Appendix A; a supervisor-gate is SUPERVISOR_GATE_OVERDUE). */
export const STUCK_CODES = Object.freeze({
  'owner-gate': 'WAIT_OVERDUE', 'peer-wait': 'PEER_WAIT_OVERDUE', dependency: 'WAIT_OVERDUE', 'retry-cap': 'WAIT_OVERDUE',
  'deferred-settle': 'WAIT_OVERDUE', 'queued-ready': 'READY_UNDISPATCHED', throttled: 'WAIT_OVERDUE',
});
/** stall.mjs finding type -> DI kind. */
export const FINDING_KINDS = Object.freeze({ 'STALE-GATE': 'stale-gate', 'STALE-WAIT': 'stale-wait', 'STALE-PEER-WAIT': 'stale-peer-wait', 'UNREAD-PEER': 'unread-peer' });
const DEFAULT_ROUTES = ['incident-raised', 'incident-resolved', 'ask-serving', 'ask-serving-expired', 'ask-notified', 'ask-answered', 'ask-superseded',
  'peer-message-sent', 'peer-message-acked', 'op-settled', 'plan-derived', 'runtime-rev-acked', 'handover-approved', 'goal-defined'];

/* ------------------------------------------------------------------------------------------------ settings */

const num = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : d);

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
    stuckSla,
  };
}

/* ------------------------------------------------------------------------------------------------ keys */

export const keyOf = (ledgerId, workflowId) => `workflow:${ledgerId}:${workflowId}`;
export function parseKey(key) {
  const m = /^workflow:([^:]+):(.+)$/.exec(String(key ?? ''));
  return m ? { ledgerId: m[1], workflowId: m[2] } : null;
}
export const workflowEntity = (ledgerId, workflowId) => `workflow:${ledgerId}:${workflowId}`;
export const stuckPrefix = (ledgerId, workflowId) => `stuck:${ledgerId}:${workflowId}:`;
const productLedgers = (ctx) => (ctx.ledgers ?? []).filter((l) => l && l.ledgerId !== SUPERVISOR_LEDGER && l.file);
const evWorkflow = (ev) => ev?.workflowId ?? ev?.workflow_id ?? null;
const evLedger = (ev) => ev?.ledgerId ?? ev?.ledger_id ?? null;

/* ------------------------------------------------------------------------------------------------ the planner */

const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const firstUntried = (rca) => (rca?.actions ?? []).find((a) => !a.tried) ?? null;

/** One DI (DESIGN §10.3), the ledger's own; lane rc-decisions assigns the id. Pure. */
export function decisionOf({ kind, subject, decider = 'kernel', ledgerId, workflowId, entity, summary, evidence = [], top = null, now, dueMs, escalatedFrom = null, ledger = null }) {
  return {
    schema: DI_SCHEMA, idempotencyKey: `${kind}:${workflowId}:${subject}${escalatedFrom ? '@supervisor' : ''}`, kind, decider,
    ledger: ledger ?? (decider === 'supervisor' && escalatedFrom ? SUPERVISOR_LEDGER : ledgerId), productLedger: ledgerId, workflowId,
    entity: entity ?? { type: 'workflow', id: workflowId },
    summary: clipLine(summary, 300),
    evidence: evidence.filter(Boolean).map((line) => ({ ref: clipLine(line, 400) })),
    options: top ? [{ key: top.key, verb: top.command, title: top.title, tier: top.tier, recommended: true }] : [],
    openedBy: OPENED_BY, openedAt: now, dueAt: now + dueMs,
    escalateTo: decider === 'kernel' ? 'supervisor' : 'owner', escalations: escalatedFrom ? 1 : 0,
    ...(escalatedFrom ? { escalatedFrom } : {}), status: 'open',
  };
}

/**
 * Everything one pass decides for one running workflow. Pure: no ledger, no clock, no spawn.
 *   status    the cached api status value (null when unreadable)
 *   findings  stallFindings of this workflow
 *   goal      {missing: bool, why}
 *   asks      [{dispatchId, liveness, lastServedAt}] (poll.mjs openAsks)
 *   clocks    the workflow's open clocks [{entity, state, enteredAt}] (to read an episode's age)
 *   unreadable  {misses, since, error, heldAt} when this pass could not read api status (holdStatus), else null
 * Returns {clocks: [{entity, state, slaMs, enteredAt}], decisions: [DI], reparks: [dispatchId], finish, stalled, lines}.
 */
export function planWorkflow({ ledgerId, workflowId, status = null, findings = [], goal = { missing: false }, asks = [], clocks = [], unreadable = null, now, settings }) {
  const s = settings;
  const wfEntity = workflowEntity(ledgerId, workflowId);
  const out = { clocks: [], decisions: [], reparks: [], finish: false, stalled: false, lines: [] };
  const clock = (entity, state, slaMs, enteredAt) => { if (Number.isFinite(slaMs)) out.clocks.push({ entity, state, slaMs, enteredAt: Number.isFinite(enteredAt) ? enteredAt : now }); };
  const openClock = (state) => clocks.find((c) => c.entity === wfEntity && c.state === state) ?? null;
  const di = (args) => out.decisions.push(decisionOf({ ledgerId, workflowId, now, dueMs: s.decisionDueMs, ...args }));
  const progress = status?.progress ?? null;
  const rca = status?.rca ?? null;
  const frontier = status?.frontier ?? null;
  const top = firstUntried(rca);
  const topLine = top ? `rca #${top.rank} [${top.tier}] ${top.title}: ${top.command}` : null;

  // ---- goal text (INV-W4)
  if (goal?.missing) {
    clock(wfEntity, 'GOAL_TEXT_MISSING', s.goalMs, now);
    out.lines.push(`GOAL_TEXT_MISSING ${workflowId}: ${goal.why}`);
  }

  // ---- stall: api status progress.stall and the STALLED finding are one episode
  const stalledFinding = findings.find((f) => f.type === 'STALLED' && f.alert) ?? null;
  const orphaned = frontier?.state === 'orphaned-frontier';
  const progressStalled = progress?.stall?.stalled === true;
  const progressSince = progressStalled && progress.stall.since ? Date.parse(progress.stall.since) : NaN;
  const episodeStarts = [progressSince, stalledFinding ? Number(stalledFinding.idleSince) : NaN].filter(Number.isFinite);
  const planned = episodeStarts.length ? Math.min(...episodeStarts) : now;
  if (progressStalled || stalledFinding) {
    out.stalled = true;
    clock(wfEntity, 'STALL_UNOWNED', s.graceMs, planned);
    clock(wfEntity, 'STALL_ESCALATED', s.supervisorGraceMs, planned);
    const episode = Math.min(openClock('STALL_UNOWNED')?.enteredAt ?? planned, planned);
    const ageMs = now - episode;
    const progressDue = progressStalled && Number.isFinite(progressSince) && now - progressSince > s.graceMs;
    const findingDue = Boolean(stalledFinding) && !orphaned;
    if (progressDue || findingDue) {
      const evidence = [
        stalledFinding?.line,
        progressStalled ? stallNotice({ workflowId, progress, rca }) : null,
        topLine,
      ];
      const summary = `progress-stall ${Math.round(ageMs / 60_000)}m: ${progressStalled ? progress.stall.reasons.join('; ') : clipLine(stalledFinding.line, 200)}`;
      di({ kind: 'progress-stall', subject: 'stall', summary, evidence, top });
      if (ageMs >= s.supervisorGraceMs) {
        di({ kind: 'progress-stall', subject: 'stall', decider: 'supervisor', escalatedFrom: `progress-stall:${workflowId}:stall`,
          summary: `ESCALATED (${Math.round(ageMs / 60_000)}m >= supervisorGraceMs ${Math.round(s.supervisorGraceMs / 60_000)}m): ${summary}`, evidence, top });
      }
    }
  }

  // ---- orphaned frontier
  if (orphaned) {
    const since = openClock('ORPHANED_FRONTIER')?.enteredAt ?? (stalledFinding ? Number(stalledFinding.idleSince) : now);
    clock(wfEntity, 'ORPHANED_FRONTIER', s.orphanedFrontierMs, since);
    if (stalledFinding || now - since >= s.orphanedFrontierMs) {
      di({ kind: 'orphaned-frontier', subject: 'frontier', summary: `orphaned-frontier for ${Math.round((now - since) / 60_000)}m: nothing open and no next step; set the next leg or revise`,
        evidence: [stalledFinding?.line, frontier?.reason ? `frontier: ${clipLine(frontier.reason, 240)}` : null, topLine], top });
    }
  }

  // ---- runtime rev not acked. Every runtime land makes every running Kernel's rev stale: that is no decision. The
  // Kernel's next wake carries the new rev (scripts/kernel/runtime-rev.mjs revWakeLine), so the plan only asks for a
  // re-wake (out.rewake, one doorbell per rev); ONE rev-ack DI per workflow (subject 'runtime-rev', whatever the rev)
  // opens only once the ack is overdue past REV_ACK_OVERDUE (s.revAckMs), counted from the first stale read.
  const rev = status?.kernelRev ?? null;
  if (rev?.stale === true) {
    const since = openClock('REV_ACK_OVERDUE')?.enteredAt ?? now;
    clock(wfEntity, 'REV_ACK_OVERDUE', s.revAckMs, since);
    const cur = shortRev(rev.current) ?? 'unknown';
    if (now - since < s.revAckMs) {
      out.rewake = cur;
      out.lines.push(`rev-ack pending ${workflowId}: rev ${cur} rides the Kernel's next wake; a decision only after ${Math.round(s.revAckMs / 60_000)}m`);
    } else di({ kind: 'rev-ack', subject: 'runtime-rev', summary: `runtime rev ${cur} not acked (acked ${shortRev(rev.acked) ?? 'none'}); re-read ${rev.full ? 'kernel-prompt.md and driver-loop.yaml in full' : (rev.files ?? []).slice(0, 6).join(', ')} then api kernel-ack-rev --workflow ${workflowId} --rev ${cur}`,
      evidence: [`kernelRev acked ${rev.acked ?? 'none'} current ${rev.current ?? '-'}`, ...(rev.changes ?? []).slice(0, 3).map((c) => (typeof c === 'string' ? c : `change ${c.id ?? ''} ${c.summary ?? ''}`))] });
  }

  // ---- api status unreadable: never a progress-stall (the pass holds the last readable status, or judges nothing);
  // statusUnreadablePasses consecutive misses are a runtime defect of the read itself, the Supervisor's, naming the error.
  // It lands in the SUPERVISOR ledger (like cap-starved / service-quarantined): a product-ledger DI with decider supervisor
  // never reaches `decisions.mjs supervisor --list` (nivo-backend di-8f93adc4). productLedger/workflowId keep the refs.
  if (unreadable) {
    const held = unreadable.heldAt != null && status ? `holding the status read ${Math.round((now - unreadable.heldAt) / 60_000)}m ago` : 'no readable status held; stall not judged';
    out.lines.push(`STATUS-UNREADABLE ${workflowId}: ${unreadable.misses} consecutive pass(es) since ${iso(unreadable.since)}: ${unreadable.error}; ${held}`);
    if (unreadable.misses >= (s.statusUnreadablePasses ?? 3)) {
      const f = unreadable.failure ?? null;
      di({ kind: 'runtime-defect', subject: 'status-unreadable', decider: 'supervisor', ledger: SUPERVISOR_LEDGER, entity: { type: 'workflow', id: workflowId },
        summary: `status-unreadable: api status --workflow ${workflowId} failed ${unreadable.misses} consecutive reconciler passes since ${iso(unreadable.since)} (${unreadable.error}); no stall is judged until it reads again`,
        evidence: [`last error: ${unreadable.error}`, f ? `cause ${f.cause ?? '?'}; exit ${f.code ?? '-'}; timedOut ${Boolean(f.timedOut)}${f.refusal ? `; refusal ${f.refusal}` : ''}` : null,
          f?.stderrHead ? `stderr: ${f.stderrHead}` : null, `ledger ${ledgerId} workflow ${workflowId}`, findings.find((x) => x.type === 'STATUS-UNREADABLE')?.line] });
    }
  }

  // ---- STALE-* / UNREAD-PEER findings (this replaces the [stall] wake of stall-alert.mjs)
  for (const f of findings) {
    const kind = FINDING_KINDS[f.type];
    if (!kind) continue;
    const subject = f.type === 'STALE-WAIT' ? f.jobId : f.type === 'UNREAD-PEER' ? f.peerMessage : f.incidentId;
    const decider = f.type === 'STALE-GATE' && f.gateKind === 'supervisor-gate' ? 'supervisor' : 'kernel';
    di({ kind, subject: subject ?? f.key, decider, summary: f.line, evidence: [f.line, topLine],
      entity: f.jobId ? { type: 'job', id: f.jobId } : f.incidentId ? { type: 'incident', id: f.incidentId } : { type: 'workflow', id: workflowId }, top });
  }

  // ---- one clock per api status stuck[] wait (opTelemetry.stuckSla)
  for (const item of status?.stuck ?? []) {
    const id = String(item.key ?? '').split(':').slice(3).join(':') || item.incidentId || item.jobId;
    if (!id || !item.kind) continue;
    const entity = `${stuckPrefix(ledgerId, workflowId)}${item.kind}:${id}`;
    const since = Number(item.since);
    if (item.kind === 'owner-gate' && item.cause === 'supervisor-gate') { clock(entity, 'SUPERVISOR_GATE_OVERDUE', s.supervisorGateMs, since); continue; }
    const code = STUCK_CODES[item.kind] ?? 'WAIT_OVERDUE';
    const sla = s.stuckSla?.[item.kind];
    if (!sla) continue;
    clock(entity, code, sla.warnMs, since);
    clock(entity, `${code}${CRITICAL_SUFFIX}`, sla.criticalMs, since);
  }

  // ---- asks: re-park a dead / stale / unserved one; on-demand is healthy
  for (const a of asks) {
    if (!s.askRepark.liveness.has(a.liveness)) continue;
    if (a.lastServedAt && now - a.lastServedAt < s.askRepark.minIntervalMs) continue;
    out.reparks.push(a.dispatchId);
    out.lines.push(`ASK-REPARK ${workflowId} ${a.dispatchId} (${a.liveness})`);
  }

  // ---- finish: every job settled and the handover approved (api status frontier finish-ready)
  if ((status?.phase ?? 'running') === 'running' && frontier?.state === 'finish-ready' && !(Number(frontier.openOperations) > 0)) out.finish = true;

  for (const d of out.decisions) out.lines.push(`DI ${d.decider} ${d.idempotencyKey}: ${clipLine(d.summary, 160)}`);
  return out;
}

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
export function goalOf(db, workflowId) {
  const row = db.prepare('SELECT markdown FROM goals WHERE workflow_id=? ORDER BY revision DESC, goal_seq DESC LIMIT 1').get(workflowId);
  if (!row) return { missing: true, why: 'no goal revision' };
  const text = String(row.markdown ?? '').trim();
  if (!text || /^null$/i.test(text)) return { missing: true, why: 'goal text empty or null' };
  const bad = unresolvedPlaceholders(text);
  if (bad.length) return { missing: true, why: `unrendered value ${bad.map((b) => `line ${b.line}: ${b.value}`).join('; ')}` };
  return { missing: false, why: null };
}

const lastServedAt = (db, workflowId, dispatchId) => Number(db.prepare(
  "SELECT MAX(created_at) at FROM events WHERE workflow_id=? AND kind IN ('ask-serving','ask-notified') AND json_extract(payload_json,'$.dispatchId')=?").get(workflowId, dispatchId)?.at) || null;

/** Whether an api status value carries a frontier to judge (apiFrontier's ok shape). */
const readable = (v) => Boolean(v && typeof v === 'object' && v.ok !== false && v.frontier);
/**
 * One api status read: {value, error, failure}; error names why it is unreadable (a throw, {ok:false,error}, no value).
 * Through ctx.statusRead when the ctx has it: failure = the spawn's cause (timeout | spawn | refused | exit | no-json),
 * exit code and stderr head, so a refusal api.mjs printed on stderr (plan-edges-missing) is named, not 'no value'.
 */
async function readStatus(ctx, ledgerId, workflowId) {
  try {
    const { value: v, failure = null } = typeof ctx.statusRead === 'function' ? await ctx.statusRead(ledgerId, workflowId) : { value: await ctx.status(ledgerId, workflowId) };
    if (readable(v)) return { value: v, error: null, failure: null };
    const error = v && typeof v === 'object' ? (v.error ?? (v.ok === false ? 'ok:false with no error' : 'no frontier in the value'))
      : failure?.error ?? 'no value (api status timed out, exited non-zero or printed no JSON)';
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
/** An api status value in the shape stall.mjs frontierOf answers (apiFrontier). */
const asFrontier = (v) => (v && v.ok !== false && v.frontier ? { ...v, ok: true, frontier: v.frontier ?? {}, workers: v.workers ?? [] } : { ok: false, error: v?.error ?? 'status unreadable' });

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

/** lane rc-decisions scripts/reconciler/decisions.mjs, when it exists (guarded: this lane lands first or after). */
let decisionsModule;
async function decisionsMod() {
  if (decisionsModule !== undefined) return decisionsModule;
  try { decisionsModule = await import('../decisions.mjs'); } catch { decisionsModule = null; }
  return decisionsModule;
}

async function ringKernelDoorbell(ctx, { ledgerId, workflowId, keys }) {
  const mod = ctx.mode === 'active' ? await decisionsMod() : null;
  if (mod && typeof mod.ringDoorbell === 'function') {
    try { return { rung: true, result: await mod.ringDoorbell(ctx, { ledgerId, workflowId, decider: 'kernel', keys }) }; } catch (error) { return { rung: false, error: String(error?.message ?? error).slice(0, 160) }; }
  }
  try { await ctx.log?.('reconciler.would', `doorbell kernel ${workflowId}: ${keys.length} decision(s)`, { controller: 'workflow', action: 'doorbell', ledgerId, workflowId, keys }); } catch { /* best effort */ }
  return { rung: false, would: true };
}

/** Clear every open clock of one workflow (it ended or left view). */
async function clearWorkflowClocks(ctx, ledgerId, workflowId) {
  const wfEntity = workflowEntity(ledgerId, workflowId), prefix = stuckPrefix(ledgerId, workflowId);
  const open = clocksOf(ctx, { prefixes: [wfEntity, prefix] }).filter((c) => c.entity === wfEntity || c.entity.startsWith(prefix));
  for (const c of open) await clearClock(ctx, c);
  return open.length;
}

/* ------------------------------------------------------------------------------------------------ the controller */

const settingsNow = () => workflowSettings();
/** The stall-episode clocks an unjudged pass (api status unreadable, none held) keeps open. */
const UNJUDGED_KEEP = new Set(['STALL_UNOWNED', 'STALL_ESCALATED', 'ORPHANED_FRONTIER']);
const defaults = settingsNow();

export async function reconcileWorkflow(key, ctx, { settings = workflowSettings() } = {}) {
  const k = parseKey(key);
  if (!k) return { ok: false, key, skipped: 'bad-key' };
  const { ledgerId, workflowId } = k;
  const now = ctx.now();
  const readers = openReaders(ctx);
  let base = null, findings = [], asks = [], status = null, unreadable = null;
  const wfEntity = workflowEntity(ledgerId, workflowId), prefix = stuckPrefix(ledgerId, workflowId);
  try {
    const own = readers.get(ledgerId);
    if (!own) return { ok: true, key, skipped: 'ledger-out-of-view', cleared: await clearWorkflowClocks(ctx, ledgerId, workflowId) };
    const row = own.db.prepare('SELECT workflow_id, phase, archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
    if (!row || row.phase !== 'running' || row.archived_at != null) {
      return { ok: true, key, ended: row?.phase ?? 'unknown', cleared: await clearWorkflowClocks(ctx, ledgerId, workflowId) };
    }
    base = { goal: goalOf(own.db, workflowId), lastProgress: lastProgress(own.db, workflowId) };
    ({ status, unreadable } = holdStatus(ctx, key, await readStatus(ctx, ledgerId, workflowId), now, settings.statusUnreadablePasses ?? 3));
    // The peers a gate or wait of this workflow names: their status answers the peer-busy probe (never a second read).
    const peers = new Set([...peerWaits(own.db, workflowId).map((w) => w.peer), ...ownerGates(own.db, workflowId).flatMap((g) => namedWorkflows(g.text))]
      .filter((p) => p && p !== workflowId));
    const statuses = new Map([[workflowId, status]]);
    for (const p of peers) {
      const holder = [...readers.values()].find((r) => { try { return Boolean(r.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(p)); } catch { return false; } });
      if (holder) statuses.set(p, await safeStatus(ctx, holder.ledgerId, p));
    }
    findings = stallFindings(own.db, {
      repo: own.repo, ledgers: [...readers.values()].map((r) => ({ repo: r.repo, db: r.db })), now, wanted: new Set([workflowId]),
      frontierOf: (_repo, wf) => asFrontier(statuses.get(wf)),
      ...(ctx.kernelTurnOf ? { kernelTurnOf: ctx.kernelTurnOf } : {}),
    });
    const open = await (ctx.openAsks ?? openAsks)(own.db, new Set([workflowId]));
    asks = open.map((a) => ({ dispatchId: a.dispatch_id, liveness: a.liveness, lastServedAt: lastServedAt(own.db, workflowId, a.dispatch_id) }));
  } finally { closeAll(readers); }

  const existing = clocksOf(ctx, { prefixes: [wfEntity, prefix] }).filter((c) => c.entity === wfEntity || c.entity.startsWith(prefix));
  const plan = planWorkflow({ ledgerId, workflowId, status, findings, goal: base.goal, asks, clocks: existing, unreadable, now, settings });

  // clocks: start / keep the wanted ones, clear the rest of this workflow's
  const wanted = new Set(plan.clocks.map((c) => `${c.entity}\u0000${c.state}`));
  for (const c of plan.clocks) await setClock(ctx, { ...c, ledgerId, meta: { controller: 'workflow', workflowId } });
  let cleared = 0;
  // A pass that judged nothing (no status) neither starts nor ends a stall episode: its clocks stay as they were.
  const unjudged = (c) => !status && c.entity === wfEntity && UNJUDGED_KEEP.has(c.state);
  for (const c of existing) if (!wanted.has(`${c.entity}\u0000${c.state}`) && !unjudged(c)) { await clearClock(ctx, c); cleared += 1; }

  // decisions, then one doorbell for the Kernel's
  const opened = [];
  for (const d of plan.decisions) {
    if (recentlyOpened(ctx, d.idempotencyKey, now, settings.decisionDueMs)) continue;
    try { await ctx.openDecision(d); opened.push(d); } catch (error) { plan.lines.push(`DI ${d.idempotencyKey} failed: ${String(error?.message ?? error).slice(0, 120)}`); }
  }
  const kernelKeys = opened.filter((d) => d.decider === 'kernel').map((d) => d.idempotencyKey);
  // A stale runtime rev not yet overdue is a re-wake, not a decision: one doorbell per (workflow, rev).
  if (plan.rewake && !recentlyOpened(ctx, `rev-wake:${workflowId}:${plan.rewake}`, now, settings.revAckMs)) kernelKeys.push(`rev:${plan.rewake}`);
  const doorbell = kernelKeys.length ? await ringKernelDoorbell(ctx, { ledgerId, workflowId, keys: kernelKeys }) : null;

  // asks and finish: api verbs (ctx.api is the shadow gate)
  const acted = [];
  for (const dispatchId of plan.reparks) acted.push({ verb: 'serve-ask', dispatchId, result: await ctx.api(ledgerId, 'serve-ask', ['--workflow', workflowId, '--dispatch', dispatchId], { timeoutMs: 120_000 }) });
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
  routes: Object.fromEntries(defaults.routes.map((kind) => [kind, route])),
  list: (ctx) => listWorkflows(ctx),
  reconcile: (key, ctx) => reconcileWorkflow(key, ctx, { settings: settingsNow() }),
};

/* ------------------------------------------------------------------------------------------------ --dry */

/** A ctx that writes nothing: statuses through api status (read-only), every action recorded. */
export function dryCtx({ repos = productRepos(), now = Date.now() } = {}) {
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

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const repos = argv.flatMap((a, i) => (a === '--repo' && argv[i + 1] ? [path.resolve(argv[i + 1])] : []));
  const only = argv.flatMap((a, i) => (a === '--workflow' && argv[i + 1] ? [argv[i + 1]] : []));
  if (!argv.includes('--dry')) {
    console.log('usage: node scripts/reconciler/controllers/workflow.mjs --dry [--repo <path>]... [--workflow <id>] [--json]\n(the engine runs this controller: node scripts/reconciler/engine.mjs --once --controller workflow)');
  } else {
    const ctx = dryCtx(repos.length ? { repos } : {});
    const keys = (await listWorkflows(ctx)).filter((k) => !only.length || only.includes(parseKey(k)?.workflowId));
    const results = [];
    for (const key of keys) {
      const before = ctx.would.length;
      const r = await reconcileWorkflow(key, ctx);
      results.push({ ...r, would: ctx.would.slice(before).filter((w) => w.type !== 'clock' && w.type !== 'clear') , clockRows: ctx.would.slice(before).filter((w) => w.type === 'clock').map((w) => `${w.entity} ${w.state}`) });
    }
    if (argv.includes('--json')) console.log(JSON.stringify(results, null, 2));
    else {
      for (const r of results) {
        console.log(`${r.key}${r.ended ? ` ended (${r.ended})` : ''}${r.skipped ? ` skipped ${r.skipped}` : ''}: findings [${(r.findings ?? []).join(', ')}] clocks ${r.clocks ?? 0}`);
        for (const w of r.would) console.log(`  would ${w.type === 'decision' ? `DI ${w.decider} ${w.key}: ${clipLine(w.summary, 140)}` : w.type === 'api' ? `api ${w.verb} ${w.argv.join(' ')}` : `${w.type} ${w.kind ?? ''} ${w.msg ?? ''}`}`);
        for (const c of r.clockRows) console.log(`  clock ${c}`);
      }
      console.log(`${results.length} workflow(s); ${results.reduce((n, r) => n + r.would.filter((w) => w.type === 'decision').length, 0)} would-DI(s)`);
    }
  }
}
