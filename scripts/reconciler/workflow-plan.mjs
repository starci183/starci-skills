// scripts/reconciler/workflow-plan.mjs — the pure planner of the Workflow controller (controllers/workflow.mjs; DESIGN.md
// §8.2, §9.2, §17.1). planWorkflow holds every decision of one pass for one running workflow, so specs read it without a
// ledger; each `plan*` section below adds its clocks, Decision Items and lines to the one plan, in this order.
import { clipLine } from '../lib/clip.mjs';
import { stallNotice } from '../kernel/progress-rca.mjs';
import { shortRev } from '../kernel/runtime-rev.mjs';
import { noticeOwes } from '../kernel/kernel-notice.mjs';
import { CRITICAL_SUFFIX } from './sla.mjs';
import { planSupervisorGates } from './gate-plan.mjs';
import { planBudgetOverruns } from './budget-plan.mjs';
import { planSupervisorOwed } from './owed-plan.mjs';
import { planDraftHeld } from './draft-plan.mjs';

const DI_SCHEMA = 'starci/decision-item@1';
const OPENED_BY = 'workflow-controller';
export const SUPERVISOR_LEDGER = 'supervisor';
/** starci kernel status stuck[] kind -> violation code (DESIGN Appendix A; a supervisor-gate is SUPERVISOR_GATE_OVERDUE). */
const STUCK_CODES = Object.freeze({
  'owner-gate': 'WAIT_OVERDUE', 'peer-wait': 'PEER_WAIT_OVERDUE', dependency: 'WAIT_OVERDUE', 'retry-cap': 'WAIT_OVERDUE',
  'deferred-settle': 'WAIT_OVERDUE', 'queued-ready': 'READY_UNDISPATCHED', throttled: 'WAIT_OVERDUE',
});
/** stall.mjs finding type -> DI kind. */
const FINDING_KINDS = Object.freeze({ 'STALE-GATE': 'stale-gate', 'STALE-WAIT': 'stale-wait', 'STALE-PEER-WAIT': 'stale-peer-wait', 'UNREAD-PEER': 'unread-peer' });

export const workflowEntity = (ledgerId, workflowId) => `workflow:${ledgerId}:${workflowId}`;
export const stuckPrefix = (ledgerId, workflowId) => `stuck:${ledgerId}:${workflowId}:`;
const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : null);
const firstUntried = (rca) => (rca?.actions ?? []).find((a) => !a.tried) ?? null;

/** One DI (DESIGN §10.3), the ledger's own; lane rc-decisions assigns the id. Pure. */
function decisionOf({ kind, subject, decider = 'kernel', ledgerId, workflowId, entity, summary, evidence = [], top = null, now, dueMs, escalatedFrom = null, ledger = null, options = null, allowedVerbs = null, refs = null }) {
  return {
    schema: DI_SCHEMA, idempotencyKey: `${kind}:${workflowId}:${subject}${escalatedFrom ? '@supervisor' : ''}`, kind, decider,
    ledger: ledger ?? (decider === 'supervisor' && escalatedFrom ? SUPERVISOR_LEDGER : ledgerId), productLedger: ledgerId, workflowId,
    entity: entity ?? { type: 'workflow', id: workflowId },
    summary: clipLine(summary, 300),
    evidence: evidence.filter(Boolean).map((line) => ({ ref: clipLine(line, 400) })),
    options: options ?? (top ? [{ key: top.key, verb: top.command, title: top.title, tier: top.tier, recommended: true }] : []),
    ...(allowedVerbs ? { allowedVerbs } : {}), ...(refs ? { refs } : {}),
    openedBy: OPENED_BY, openedAt: now, dueAt: now + dueMs,
    escalateTo: decider === 'kernel' ? 'supervisor' : 'owner', escalations: escalatedFrom ? 1 : 0,
    ...(escalatedFrom ? { escalatedFrom } : {}), status: 'open',
  };
}

/** The goal text (INV-W4). */
function planGoal(p) {
  if (!p.goal?.missing) return;
  p.clock(p.wfEntity, 'GOAL_TEXT_MISSING', p.s.goalMs, p.now);
  p.out.lines.push(`GOAL_TEXT_MISSING ${p.workflowId}: ${p.goal.why}`);
}

/** The stall: starci kernel status progress.stall and the STALLED finding are one episode. */
function planStall(p) {
  const { s, now, progress, stalledFinding, wfEntity, workflowId } = p;
  const progressStalled = progress?.stall?.stalled === true;
  const progressSince = progressStalled && progress.stall.since ? Date.parse(progress.stall.since) : Number.NaN;
  const episodeStarts = [progressSince, stalledFinding ? Number(stalledFinding.idleSince) : Number.NaN].filter(Number.isFinite);
  const planned = episodeStarts.length ? Math.min(...episodeStarts) : now;
  if (!progressStalled && !stalledFinding) return;
  p.out.stalled = true;
  p.clock(wfEntity, 'STALL_UNOWNED', s.graceMs, planned);
  p.clock(wfEntity, 'STALL_ESCALATED', s.supervisorGraceMs, planned);
  const episode = Math.min(p.openClock('STALL_UNOWNED')?.enteredAt ?? planned, planned);
  const ageMs = now - episode;
  const progressDue = progressStalled && Number.isFinite(progressSince) && now - progressSince > s.graceMs;
  const findingDue = Boolean(stalledFinding) && !p.orphaned;
  if (!progressDue && !findingDue) return;
  const { top } = p;
  const evidence = [
    stalledFinding?.line,
    progressStalled ? stallNotice({ workflowId, progress, rca: p.rca }) : null,
    p.topLine,
  ];
  const summary = `progress-stall ${Math.round(ageMs / 60_000)}m: ${progressStalled ? progress.stall.reasons.join('; ') : clipLine(stalledFinding.line, 200)}`;
  p.di({ kind: 'progress-stall', subject: 'stall', summary, evidence, top });
  if (ageMs >= s.supervisorGraceMs) {
    p.di({ kind: 'progress-stall', subject: 'stall', decider: 'supervisor', escalatedFrom: `progress-stall:${workflowId}:stall`,
      summary: `ESCALATED (${Math.round(ageMs / 60_000)}m >= supervisorGraceMs ${Math.round(s.supervisorGraceMs / 60_000)}m): ${summary}`, evidence, top });
  }
}

/** The orphaned frontier. */
function planOrphaned(p) {
  if (!p.orphaned) return;
  const { s, now, stalledFinding, frontier } = p;
  const since = p.openClock('ORPHANED_FRONTIER')?.enteredAt ?? (stalledFinding ? Number(stalledFinding.idleSince) : now);
  p.clock(p.wfEntity, 'ORPHANED_FRONTIER', s.orphanedFrontierMs, since);
  if (stalledFinding || now - since >= s.orphanedFrontierMs) {
    p.di({ kind: 'orphaned-frontier', subject: 'frontier', summary: `orphaned-frontier for ${Math.round((now - since) / 60_000)}m: nothing open and no next step; set the next leg or revise`,
      evidence: [stalledFinding?.line, frontier?.reason ? `frontier: ${clipLine(frontier.reason, 240)}` : null, p.topLine], top: p.top });
  }
}

/**
 * The runtime rev not acked. Every runtime land makes every running Kernel's rev stale: that is no decision. The
 * Kernel's next wake carries the new rev (scripts/kernel/kernel-notice.mjs revisionWakeLine), so the plan only asks for a
 * re-wake (out.rewake, one doorbell per rev); ONE rev-ack DI per workflow (subject 'runtime-rev', whatever the rev)
 * opens only once the ack is overdue past REV_ACK_OVERDUE (s.revAckMs), counted from the first stale read.
 */
function planRev(p) {
  const rev = p.status?.revisionNotice ?? null;
  if (!noticeOwes(rev)) return;
  const { s, now, workflowId } = p;
  const since = p.openClock('REV_ACK_OVERDUE')?.enteredAt ?? now;
  p.clock(p.wfEntity, 'REV_ACK_OVERDUE', s.revAckMs, since);
  const cur = shortRev(rev.to) ?? 'unknown';
  if (now - since < s.revAckMs) {
    p.out.rewake = cur;
    p.out.lines.push(`rev-ack pending ${workflowId}: rev ${cur} rides the Kernel's next wake; a decision only after ${Math.round(s.revAckMs / 60_000)}m`);
  } else p.di({ kind: 'rev-ack', subject: 'runtime-rev', summary: `runtime rev ${cur} not settled (settled ${shortRev(rev.from) ?? 'none'}); re-read ${(rev.files ?? []).slice(0, 6).join(', ')} then starci kernel kernel-ack-rev --workflow ${workflowId} --rev ${cur}`,
    evidence: [`revisionNotice settled ${rev.from ?? 'none'} current ${rev.to ?? '-'}: ${rev.line ?? ''}`] });
}

/**
 * starci kernel status unreadable: never a progress-stall (the pass holds the last readable status, or judges nothing);
 * statusUnreadablePasses consecutive misses are a runtime defect of the read itself, the Supervisor's, naming the error.
 * It lands in the SUPERVISOR ledger (like cap-starved / service-quarantined): a product-ledger DI with decider supervisor
 * never reaches `decisions.mjs supervisor --list`. productLedger/workflowId keep the refs.
 */
function planUnreadable(p) {
  const { unreadable, status, now, workflowId } = p;
  if (!unreadable) return;
  const held = unreadable.heldAt != null && status ? `holding the status read ${Math.round((now - unreadable.heldAt) / 60_000)}m ago` : 'no readable status held; stall not judged';
  p.out.lines.push(`STATUS-UNREADABLE ${workflowId}: ${unreadable.misses} consecutive pass(es) since ${iso(unreadable.since)}: ${unreadable.error}; ${held}`);
  // A busy read is the child running no code at all (its entry module read mid-swap during a land/reload): it clears
  // on its own on the next pass, so it defects only on a streak far past the read's own cadence.
  const passes = p.s.statusUnreadablePasses ?? 3;
  const streak = unreadable.failure?.cause === 'busy' ? passes * 4 : passes;
  if (unreadable.misses >= streak) openStatusDefect(p);
}

/** The Supervisor's runtime-defect DI of a status read that kept failing. */
function openStatusDefect(p) {
  const { unreadable, workflowId, ledgerId } = p;
  const f = unreadable.failure ?? null;
  p.di({ kind: 'runtime-defect', subject: 'status-unreadable', decider: 'supervisor', ledger: SUPERVISOR_LEDGER, entity: { type: 'workflow', id: workflowId },
    summary: `status-unreadable: starci kernel status --workflow ${workflowId} failed ${unreadable.misses} consecutive reconciler passes since ${iso(unreadable.since)} (${unreadable.error}); no stall is judged until it reads again`,
    evidence: [`last error: ${unreadable.error}`, f ? `cause ${f.cause ?? '?'}; exit ${f.code ?? '-'}; timedOut ${Boolean(f.timedOut)}${(f.refusal && '; refusal ' + f.refusal) || ''}` : null,
      f?.stderrHead ? `stderr: ${f.stderrHead}` : null, `ledger ${ledgerId} workflow ${workflowId}`, p.findings.find((x) => x.type === 'STATUS-UNREADABLE')?.line] });
}

/** The key a STALE-* / UNREAD-PEER finding is a decision about. */
function findingSubject(f) {
  if (f.type === 'STALE-WAIT') return f.jobId;
  if (f.type === 'UNREAD-PEER') return f.peerMessage;
  return f.incidentId;
}

/** The entity a finding names: its job, else its incident, else the workflow. */
const findingEntity = (f, workflowId) => (f.jobId && { type: 'job', id: f.jobId }) || (f.incidentId && { type: 'incident', id: f.incidentId }) || { type: 'workflow', id: workflowId };

/** The STALE-* / UNREAD-PEER findings (this replaces the [stall] wake of stall-alert.mjs). */
function planFindings(p) {
  for (const f of p.findings) {
    const kind = FINDING_KINDS[f.type];
    if (!kind) continue;
    const decider = f.type === 'STALE-GATE' && f.gateKind === 'supervisor-gate' ? 'supervisor' : 'kernel';
    p.di({ kind, subject: findingSubject(f) ?? f.key, decider, summary: f.line, evidence: [f.line, p.topLine], entity: findingEntity(f, p.workflowId), top: p.top });
  }
}

/** One clock per starci kernel status stuck[] wait (opTelemetry.stuckSla). */
function planStuckClocks(p) {
  const { s, ledgerId, workflowId } = p;
  for (const item of p.status?.stuck ?? []) {
    const id = String(item.key ?? '').split(':').slice(3).join(':') || item.incidentId || item.jobId;
    if (!id || !item.kind) continue;
    const entity = `${stuckPrefix(ledgerId, workflowId)}${item.kind}:${id}`;
    const since = Number(item.since);
    if (item.kind === 'owner-gate' && item.cause === 'supervisor-gate') { p.clock(entity, 'SUPERVISOR_GATE_OVERDUE', s.supervisorGateMs, since); continue; }
    const code = STUCK_CODES[item.kind] ?? 'WAIT_OVERDUE';
    const sla = s.stuckSla?.[item.kind];
    if (!sla) continue;
    p.clock(entity, code, sla.warnMs, since);
    p.clock(entity, `${code}${CRITICAL_SUFFIX}`, sla.criticalMs, since);
  }
}

/** The asks: re-park a dead / stale / unserved one; on-demand is healthy. */
function planAsks(p) {
  const { s, now, workflowId } = p;
  for (const a of p.asks) {
    if (!s.askRepark.liveness.has(a.liveness)) continue;
    if (a.lastServedAt && now - a.lastServedAt < s.askRepark.minIntervalMs) continue;
    p.out.reparks.push(a.dispatchId);
    p.out.lines.push(`ASK-REPARK ${workflowId} ${a.dispatchId} (${a.liveness})`);
  }
}

/** The finish: every job settled and the handover approved (starci kernel status frontier finish-ready). */
function planFinish(p) {
  const { frontier } = p;
  if ((p.status?.phase ?? 'running') !== 'running' || frontier?.state !== 'finish-ready') return;
  const hasOpenOperations = Number(frontier.openOperations) > 0;
  if (!hasOpenOperations) p.out.finish = true;
}

const SECTIONS = [planGoal, planStall, planOrphaned, planRev, planUnreadable, planFindings, planSupervisorGates, planBudgetOverruns, planSupervisorOwed, planDraftHeld, planStuckClocks, planAsks, planFinish];

/**
 * Everything one pass decides for one running workflow. Pure: no ledger, no clock, no spawn.
 *   status    the cached starci kernel status value (null when unreadable)
 *   findings  stallFindings of this workflow
 *   goal      {missing: bool, why}
 *   asks      [{dispatchId, liveness, lastServedAt}] (poll.mjs openAsks)
 *   gates     the open supervisor-gates read from the ledger (gateViewsFromLedger), given when the status is unreadable
 *   clocks    the workflow's open clocks [{entity, state, enteredAt}] (to read an episode's age)
 *   unreadable  {misses, since, error, heldAt} when this pass could not read starci kernel status (holdStatus), else null
 * Returns {clocks: [{entity, state, slaMs, enteredAt}], decisions: [DI], reparks: [dispatchId], finish, stalled, lines}.
 */
export function planWorkflow({ draft = null, ledgerId, workflowId, status = null, findings = [], goal = { missing: false }, asks = [], gates = [], clocks = [], unreadable = null, now, settings }) {
  const wfEntity = workflowEntity(ledgerId, workflowId);
  const out = { clocks: [], decisions: [], reparks: [], finish: false, stalled: false, lines: [] };
  const rca = status?.rca ?? null;
  const top = firstUntried(rca);
  const frontier = status?.frontier ?? null;
  const p = {
    draft, ledgerId, workflowId, status, findings, goal, asks, gates, unreadable, now, s: settings, wfEntity, out, rca, top, frontier,
    clock: (entity, state, slaMs, enteredAt) => { if (Number.isFinite(slaMs)) out.clocks.push({ entity, state, slaMs, enteredAt: Number.isFinite(enteredAt) ? enteredAt : now }); },
    openClock: (state) => clocks.find((c) => c.entity === wfEntity && c.state === state) ?? null,
    di: (args) => out.decisions.push(decisionOf({ ledgerId, workflowId, now, dueMs: settings.decisionDueMs, ...args })),
    progress: status?.progress ?? null,
    topLine: top ? `rca #${top.rank} [${top.tier}] ${top.title}: ${top.command}` : null,
    stalledFinding: findings.find((f) => f.type === 'STALLED' && f.alert) ?? null,
    orphaned: frontier?.state === 'orphaned-frontier',
  };
  for (const section of SECTIONS) section(p);
  for (const d of out.decisions) out.lines.push(`DI ${d.decider} ${d.idempotencyKey}: ${clipLine(d.summary, 160)}`);
  return out;
}
