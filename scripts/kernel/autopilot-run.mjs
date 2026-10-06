// autopilot.mjs — run every workflow to the finish without stopping for the owner (owner ruling 2026-09-28,
// modules/kernel/owner-rulings.yaml autopilot-run-to-finish; modules/models/runtimes.yaml allocation.autopilot).
//
// "Run to the finish in one go. Don't stop to ask the owner — not even UX/UI review. When everything is done, the
// owner reviews once; ugly UX/UI gets re-run and fixed in one batch instead of piecemeal." Under autopilot:
//
//   provisional         a draw-review (interface.draw) or brand-direction-review (brand.decide) ask whose machine
//                       gates pass is answered by the runtime: a starci/ask-answer@1 receipt with answeredBy `autopilot`, provisional:true and acceptance {provisional, by, receipt: <gate evidence>}.
//                       The retried op applies it (draw-review.mjs / brand-direction.mjs apply) as a PROVISIONAL
//                       acceptance: the node turns green-provisional (PROVISIONAL_LABEL), downstream proceeds, it is
//                       never promoted golden and never counts as an owner answer (owner-claim.mjs ownerAnswerProof
//                       and brand.mjs findOwnerReceipt read answeredBy owner only). Failing gates answer redraw or
//                       revise with the findings as the brief, at most redrawBudget times per record; past it the
//                       leg is deferred to the final review.
//   deferred-to-handover
//                       a credential, real-money, shared-external-system or owner-only ask is neither sent nor
//                       waited on: an `autopilot-deferred-to-handover` event names the sandbox/stub path the work
//                       proceeds on and the real proof owed at handover. Credential values are never invented or
//                       entered by an agent. The live-proof legs (integration/e2e/uat) that need the value wait
//                       (queuedBecause deferred-to-handover) until the ONE end-of-flow credential checklist
//                       (provision.ask, params.subject handover-credentials) is answered by the owner, then resume.
//   supervisor-gate     a retry cap, a needUser environment blocker or an owner-gate that is a runtime/process issue
//                       is a `supervisor-gate` incident with its evidence (scripts/supervisor/poll.mjs picks it up);
//                       the Supervisor fixes (lands to .claude) or decides the retry and resolves it --by supervisor.
//                       supervisorExtraBudget gates per node group, then the leg is `deferred`; a gate older than
//                       supervisorGateTimeoutMs defers what it holds. Deferred legs never block independent work.
//   budgets             per workflow (attempts, tokens, wall time): past one, a supervisor-gate holds new dispatch.
//   handover            handover.review stays the one owner gate: its ask carries the owner review ledger bundle
//                       (autopilotBundle) - every provisional acceptance with its images, every deferred leg, every
//                       deferred-to-handover proof, the autopilot decision log. An owner note on a provisional item
//                       re-opens only that item (starci kernel autopilot --reopen, the owner's words from the verified
//                       handover receipt) and the existing draw-feedback loop redraws it.
//
// Every runtime decision is an `autopilot-*` event `by: autopilot`; nothing here ever writes answeredBy owner.
import { commitAskAnswer } from '../machine/ask-receipts.mjs';
import { allocationSettings } from '../../engine/config.mjs';
import { ownerLanguage, translator } from '../lib/i18n.mjs';
import { parseJson, readJsonFile } from '../lib/json.mjs';
import { list } from '../lib/list.mjs';
import { HANDOVER_OP, OWNER, handoverAsks } from './handover.mjs';
import { CREDENTIAL_ASK_KINDS, askKindOf, recommendationOf } from '../machine/ask-recommendation.mjs';
import { foldText, ownerAnswerProof } from '../machine/owner-claim.mjs';
import { askClassOf, isLiveProofOp } from './ask-server.mjs';
import { DIRECTION_REVIEW_SCHEMA } from '../work/brand/brand.mjs';
import { readEnv } from '../lib/env.mjs';
import { positiveNumber } from '../lib/number.mjs';
import { workflowBudget, supervisorGatesOf, AUTOPILOT_BY, AUTOPILOT_RULING, SUPERVISOR_GATE } from './autopilot-budget.mjs';
import {
  AUTOPILOT_EVENTS, HANDOVER_CREDENTIALS_SUBJECT, PROVISIONAL_LABEL,
  DRAW_REVIEW_SCHEMA, DRAW_REVIEW_KIND, DIRECTION_REVIEW_KIND,
  latestEvent, eventsOf, jobOfAsk, reportOpOf, subjectOf, askClosed, deferralOf,
  pendingAsksOf, deferredToHandoverOf, deferredLegsOf, provisionalOf, credentialsOwed,
  drawGateEvidence, writeAnswer, planReview, planRecommended, planDeferred,
  rerouteOwnerGates, deferTimedOutGates, gateExceededBudget, supersedeSupplied,
} from './autopilot-state.mjs';
export { openSupervisorGate, AUTOPILOT_BY, AUTOPILOT_RULING, SUPERVISOR_GATE } from './autopilot-budget.mjs';
export {
  AUTOPILOT_EVENTS, HANDOVER_CREDENTIALS_SUBJECT, PROVISIONAL_LABEL,
  deferralOf, deferredToHandoverOf, deferredLegsOf, credentialsOwed, drawGateEvidence,
} from './autopilot-state.mjs';
/** The classes of an ask the owner alone can settle; under autopilot they wait for the end of the flow. */
const DEFERRED_CLASSES = Object.freeze(['credential', 'real-money', 'shared-system', 'owner-decision']);
const DAY = 86_400_000;
const num = (value, fallback) => positiveNumber(value, fallback, { orZero: true });

/* ------------------------------------------------------------------ settings */

/** modules/models/runtimes.yaml allocation.autopilot with its defaults. */
export function autopilotSettings(source = null) {
  let raw = {};
  try { raw = (source ?? allocationSettings())?.autopilot ?? {}; } catch { raw = {}; }
  const budgets = raw.budgets ?? {};
  // STARCI_AUTOPILOT=on|off overrides the runtimes.yaml default for this process (a spec exercising the owner flow).
  const env = String(readEnv('STARCI_AUTOPILOT') ?? '').trim().toLowerCase();
  return {
    enabled: env === 'on' || (env !== 'off' && raw.enabled !== false),
    workflows: raw.workflows && typeof raw.workflows === 'object' ? raw.workflows : {},
    redrawBudget: num(raw.redrawBudget, 2),
    supervisorExtraBudget: num(raw.supervisorExtraBudget, 2),
    supervisorGateTimeoutMs: num(raw.supervisorGateTimeoutMs, 6 * 3_600_000),
    budgets: { attempts: num(budgets.attempts, 600), tokens: num(budgets.tokens, 400_000_000), wallMs: num(budgets.wallMs, 14 * DAY) },
  };
}

/** Whether autopilot drives this workflow: {on, source}. A ledger override (starci kernel autopilot --set) wins, then runtimes.yaml workflows.<id>, then enabled. */
export function autopilotOf(db, workflowId, settings = autopilotSettings()) {
  const override = latestEvent(db, workflowId, AUTOPILOT_EVENTS.configured);
  if (override) {
    const payload = parseJson(override.payload_json, {}) ?? {};
    if (typeof payload.on === 'boolean') return { on: payload.on, source: 'ledger', at: override.created_at };
  }
  const own = settings.workflows?.[workflowId];
  if (own && typeof own.enabled === 'boolean') return { on: own.enabled, source: `runtimes.yaml allocation.autopilot.workflows.${workflowId}` };
  return { on: settings.enabled, source: 'runtimes.yaml allocation.autopilot.enabled' };
}
export const autopilotOn = (db, workflowId, settings) => { try { return autopilotOf(db, workflowId, settings).on; } catch { return false; } };

/* ------------------------------------------------------------------ ask classes */

const MONEY = /\b(?:real (?:money|payment|transfer|charge|transaction)|live (?:payment|transaction|charge)|production payment|giao dich that|chuyen khoan that|khoan chi that|thanh toan that)\b/;
const SHARED = /\b(?:shared (?:webhook|channel|account|system|merchant)|dung chung|cua academy)\b/;
const NOT_BEFORE = /\b(?:chua|khong|no|not|without|never)\s*$/;
const hits = (re, text) => {
  const m = re.exec(text);
  return Boolean(m) && !NOT_BEFORE.test(text.slice(Math.max(0, m.index - 12), m.index));
};
const askTextOf = (question) => foldText(`${question?.text ?? ''} ${list(question?.options).map((o) => (typeof o === 'string' ? o : o?.label ?? '')).join(' ')}`);

/**
 * What autopilot does with one ask: owner-handover (the handover itself, or the end-of-flow credential checklist -
 * the owner's), draw-review / direction-review (provisional when the gates pass), credential / real-money /
 * shared-system / owner-decision (deferred-to-handover), recommended (a business choice carrying its recommendation,
 * taken provisionally). `classes` lists every owner-only class the text touches.
 */
export function autopilotAskClass({ opId = null, question = null, subject = null } = {}) {
  if (opId === HANDOVER_OP) return { class: 'owner-handover', classes: [] };
  if (subject === HANDOVER_CREDENTIALS_SUBJECT || question?.checklist === HANDOVER_CREDENTIALS_SUBJECT) return { class: 'owner-handover', classes: ['credential'] };
  const kind = askKindOf(question);
  if (kind === DRAW_REVIEW_KIND || question?.review?.schema === DRAW_REVIEW_SCHEMA) return { class: 'draw-review', classes: [] };
  if (kind === DIRECTION_REVIEW_KIND || question?.review?.schema === DIRECTION_REVIEW_SCHEMA) return { class: 'direction-review', classes: [] };
  const text = askTextOf(question);
  const classes = [];
  if (CREDENTIAL_ASK_KINDS.includes(kind) || askClassOf({ opId, question }) === 'credential') classes.push('credential');
  if (!CREDENTIAL_ASK_KINDS.includes(kind)) {
    if (hits(MONEY, text)) classes.push('real-money');
    if (hits(SHARED, text)) classes.push('shared-system');
  }
  if (kind === 'irreversible-confirmation' && !classes.some((c) => c !== 'credential')) classes.push('owner-decision');
  if (['authority', 'identity', 'intent'].includes(kind)) classes.push('owner-decision');
  const primary = ['real-money', 'shared-system', 'credential', 'owner-decision'].find((c) => classes.includes(c));
  if (primary) return { class: primary, classes: [...new Set(classes)] };
  if (recommendationOf(question)) return { class: 'recommended', classes: [] };
  return { class: 'owner-decision', classes: ['owner-decision'] };
}

/* ------------------------------------------------------------------ answering one ask */

/**
 * Answer (or defer) one filed, unanswered ask under autopilot. Returns {handled:false, why} when autopilot is off or
 * the ask is the owner's (handover, the end-of-flow checklist), else {handled:true, action, dispatchId, ...}.
 * `wake` (injectable) wakes the Kernel after an answer.
 */
export function autopilotAnswerAsk({ ledger, repo, workflowId, report, settings = autopilotSettings(), wake = null, now = Date.now() }) {
  const db = ledger.db;
  if (!autopilotOn(db, workflowId, settings)) return { handled: false, why: 'autopilot-off' };
  if (askClosed(db, workflowId, report.dispatch_id)) return { handled: false, why: 'already-closed' };
  if (deferralOf(db, workflowId, report.dispatch_id)) return { handled: false, why: 'already-deferred' };
  const rj = parseJson(report.report_json, {}) ?? {};
  const question = rj.question ?? { text: rj.summary ?? '', options: [] };
  const job = jobOfAsk(db, workflowId, report);
  const opId = reportOpOf(db, report);
  const cls = autopilotAskClass({ opId, question, subject: subjectOf(job) });
  const base = { dispatchId: report.dispatch_id, opId, jobId: job?.job_id ?? null, class: cls.class };
  if (cls.class === 'owner-handover') return { handled: false, why: 'owner-handover', ...base };
  let out, prepared = null;
  const plannedEvents = [];
  const planAnswer = params => { prepared = writeAnswer(ledger, params); return prepared.receiptPath; };
  const planEvent = event => plannedEvents.push(event);
  const ctx = { db, repo, workflowId, report, question, cls, base, settings, job, planAnswer, planEvent, now };
  if (cls.class === 'draw-review' || cls.class === 'direction-review') out = planReview(ctx);
  else if (cls.class === 'recommended') out = planRecommended(ctx);
  else out = planDeferred(ctx);
  if (prepared) {
    const committed = commitAskAnswer(ledger, { workflowId, dispatchId: report.dispatch_id, receipt: prepared.receipt,
      blob: prepared.blob, at: now, events: plannedEvents,
      payload: { option: prepared.receipt.option, note: prepared.receipt.note, ...(prepared.receipt.provisional ? { provisional: true } : {}) } });
    if (!committed.accepted) return { handled: false, why: committed.why, ...base };
    out.receiptPath = committed.receiptPath;
  } else {
    ledger.transaction(() => {
      if (askClosed(db, workflowId, report.dispatch_id) || deferralOf(db, workflowId, report.dispatch_id)) {
        out = { handled: false, why: 'already-closed', ...base }; return;
      }
      for (const event of plannedEvents) ledger.appendEvent(event);
    });
  }

  if (out?.receiptPath && typeof wake === 'function') {
    try { out.wake = wake(ledger, { workflowId, dispatchId: report.dispatch_id, receiptPath: out.receiptPath, answeredBy: AUTOPILOT_BY })?.action ?? null; } catch { out.wake = null; }
  }
  return out;
}

/* ------------------------------------------------------------------ deferral, gates, budgets */

/** Why a queued job is deferred under autopilot, or null: {queuedBecause, blockedBy, detail}. */
export function deferredQueueCause(db, job, { settings = autopilotSettings() } = {}) {
  const workflowId = job.workflow_id ?? db.prepare('SELECT workflow_id FROM jobs WHERE job_id=?').get(job.job_id)?.workflow_id ?? null;
  if (!workflowId || !autopilotOn(db, workflowId, settings)) return null;
  const opId = job.op_id ?? null;
  const leg = deferredLegsOf(db, workflowId).find((item) => item.jobId === job.job_id);
  if (leg) return { queuedBecause: 'deferred', blockedBy: { deferred: leg.jobId }, detail: `autopilot deferred it (${leg.reason ?? 'supervisor budget spent'}); it is listed for the final review and blocks nothing else` };
  if (isLiveProofOp(opId)) {
    const owed = credentialsOwed(db, workflowId);
    if (owed.length) {
      const names = owed.map((item) => `${item.opId ?? '-'} ${item.deferClass}`).join(', ');
      return { queuedBecause: 'deferred-to-handover', blockedBy: { deferredToHandover: owed.map((item) => item.dispatchId ?? item.key) },
        detail: `the live proof waits for the handover credential checklist (${names}); every other leg proceeds on the sandbox/stub path` };
    }
  }
  return null;
}

/** Route-cap step under autopilot (cli.mjs enqueueNextStep): 'supervisor-gate' within the extra budget, else 'deferred'. */
export function routeCapUnderAutopilot(db, job, { lineage, routeId, settings = autopilotSettings() }) {
  if (!autopilotOn(db, job.workflow_id, settings)) return null;
  let gates = 0;
  for (const row of lineage) {
    const step = parseJson(row.result_json, {})?.nextStep;
    if (step?.route === routeId && step.kind === SUPERVISOR_GATE) gates += 1;
  }
  return gates >= settings.supervisorExtraBudget ? { kind: 'deferred', gates, budget: settings.supervisorExtraBudget } : { kind: SUPERVISOR_GATE, gates, budget: settings.supervisorExtraBudget };
}

/** Budget use of one workflow against allocation.autopilot.budgets: {used, caps, exceeded[]}. */
export function budgetOf(db, workflowId, settings = autopilotSettings(), { now = Date.now() } = {}) {
  return workflowBudget(db, workflowId, { settings, extensionKind: AUTOPILOT_EVENTS.budgetExtended, now });
}

/**
 * One autopilot pass over a workflow (starci kernel status runs it on every read, so every watchdog tick; starci kernel autopilot
 * --sweep runs it on demand). Idempotent. Returns {on, answered[], deferred[], rerouted[], timedOut[], budget, supplied[]}.
 *   1. every pending ask is answered or deferred (autopilotAnswerAsk);
 *   2. every open owner-gate - under autopilot nothing but the handover waits on the owner - is re-routed to the
 *      Supervisor as a supervisor-gate (its text and holds kept);
 *   3. a supervisor-gate older than supervisorGateTimeoutMs defers the jobs it holds (the gate stays open for the
 *      Supervisor; the rest of the graph no longer waits on it);
 *   4. a spent budget opens one supervisor-gate holding new dispatch;
 *   5. an owner-answered handover credential checklist supersedes the deferred credential asks it supplied.
 */
export function autopilotSweep({ ledger, repo, workflowId, settings = autopilotSettings(), wake = null, now = Date.now() }) {
  const db = ledger.db;
  const state = autopilotOf(db, workflowId, settings);
  const out = { on: state.on, answered: [], deferred: [], rerouted: [], timedOut: [], supplied: [], budget: null, errors: [] };
  if (!state.on) return out;
  const wf = db.prepare('SELECT phase,archived_at FROM workflows WHERE workflow_id=?').get(workflowId);
  if (!wf || wf.phase === 'finished' || wf.archived_at != null) return out;
  for (const report of pendingAsksOf(db, workflowId)) {
    try {
      const r = autopilotAnswerAsk({ ledger, repo, workflowId, report, settings, wake, now });
      if (r.handled) (r.action === 'deferred-to-handover' ? out.deferred : out.answered).push({ dispatchId: r.dispatchId, action: r.action, class: r.class });
    } catch (error) { out.errors.push({ dispatchId: report.dispatch_id, error: String(error?.message ?? error).slice(0, 300) }); }
  }
  ledger.transaction(() => {
    rerouteOwnerGates({ ledger, db, workflowId, out, now });
    deferTimedOutGates({ ledger, db, workflowId, settings, out, now });
    const budget = budgetOf(db, workflowId, settings, { now });
    out.budget = budget;
    gateExceededBudget({ ledger, db, workflowId, budget });
    // 5. The owner's checklist answer supplies credentials; each deferred credential ask it covers is superseded.
    supersedeSupplied({ ledger, db, workflowId, repo, out });
  });
  return out;
}

/** The ONE end-of-flow owner step: the credential checklist question provision.ask files verbatim (subject handover-credentials). */
export function credentialChecklist(db, workflowId, { lang = ownerLanguage() } = {}) {
  const items = deferredToHandoverOf(db, workflowId).filter((item) => DEFERRED_CLASSES.includes(item.deferClass));
  const creds = items.filter((item) => item.deferClass === 'credential');
  const approvals = items.filter((item) => item.deferClass !== 'credential');
  const files = [...new Set(creds.flatMap((item) => list(item.fields?.files)))];
  const vars = [...new Set(creds.flatMap((item) => list(item.fields?.vars)))];
  const tr = translator(lang);
  const lines = [
    tr('Supply credentials - the one owner step before the deferred live proofs (UAT/e2e) resume automatically:'),
    ...creds.map((item, i) => `${i + 1}. ${item.opId ?? 'provision.ask'} (${item.dispatchId ?? '-'}): ${[...list(item.fields?.files), ...list(item.fields?.vars)].join(', ')} — ${String(item.question ?? '').split('\n')[0].slice(0, 200)}`),
    ...(approvals.length ? [tr('Also waiting on the owner (re-opened at the same time, one question each):'),
      ...approvals.map((item) => `- ${item.deferClass}: ${item.opId ?? '-'} (${item.dispatchId ?? '-'}) — ${String(item.question ?? item.reason ?? '').split('\n')[0].slice(0, 200)}`)] : []),
    tr('Values go into this form only and are sealed into custody; they never appear in chat, logs or documents.'),
    ...files.map((f) => `- ${f}`), ...vars.map((v) => `- ${v}`),
  ];
  return { items: items.length, credentials: creds.length, approvals: approvals.map((item) => item.dispatchId).filter(Boolean),
    question: { kind: 'credential', checklist: HANDOVER_CREDENTIALS_SUBJECT, text: lines.join('\n'), options: [], refs: creds.map((item) => item.dispatchId).filter(Boolean) },
    fields: { files, vars } };
}

/** The final review bundle (the owner review ledger) the handover ask carries. */
export function autopilotBundle(db, workflowId) {
  const decisions = [AUTOPILOT_EVENTS.provisional, AUTOPILOT_EVENTS.recommended, AUTOPILOT_EVENTS.redraw, AUTOPILOT_EVENTS.deferred, AUTOPILOT_EVENTS.deferredToHandover, AUTOPILOT_EVENTS.rerouted, AUTOPILOT_EVENTS.supplied, AUTOPILOT_EVENTS.budget, AUTOPILOT_EVENTS.decision]
    .flatMap((kind) => eventsOf(db, workflowId, kind).map((e) => ({ kind, seq: e.seq, at: new Date(Number(e.at)).toISOString(), by: e.by ?? AUTOPILOT_BY,
      subject: e.record ?? e.dispatchId ?? e.incidentId ?? e.entityId ?? null, detail: e.reason ?? e.option ?? e.deferClass ?? null })))
    .sort((a, b) => a.seq - b.seq);
  const provisional = provisionalOf(db, workflowId);
  const deferred = deferredLegsOf(db, workflowId);
  const deferredToHandover = deferredToHandoverOf(db, workflowId);
  return { schema: 'starci/autopilot-bundle@1', title: translator(ownerLanguage())('the owner review ledger'), workflowId, ruling: AUTOPILOT_RULING,
    provisional, deferred, deferredToHandover, decisions, counts: { provisional: provisional.length, deferred: deferred.length, deferredToHandover: deferredToHandover.length, decisions: decisions.length } };
}

/** starci kernel status `autopilot` block. */
export function autopilotProjection(db, workflowId, { settings = autopilotSettings(), sweep = null } = {}) {
  const state = autopilotOf(db, workflowId, settings);
  if (!state.on) return { on: false, source: state.source, provisional: [], deferred: [], deferredToHandover: [] };
  const deferredToHandover = deferredToHandoverOf(db, workflowId);
  const budget = budgetOf(db, workflowId, settings);
  return {
    on: true, source: state.source, ruling: AUTOPILOT_RULING,
    provisional: provisionalOf(db, workflowId).map(({ dispatchId, opId, jobId, class: cls, record, receiptPath, label, at }) => ({ dispatchId, opId, jobId, class: cls, record, receiptPath, label, at })),
    deferred: deferredLegsOf(db, workflowId),
    deferredToHandover: deferredToHandover.map(({ key, dispatchId, jobId, opId, deferClass, classes, fields, stubPath, owed, record, reason }) => ({ key, dispatchId, jobId, opId, deferClass, classes, fields, stubPath, owed, record, reason })),
    supervisorGates: supervisorGatesOf(db, workflowId).map(({ incidentId, opId, holds, since }) => ({ incidentId, opId, holds, since })),
    budget,
    ...(sweep && (sweep.answered.length || sweep.deferred.length || sweep.rerouted.length || sweep.timedOut.length || sweep.supplied.length || sweep.errors.length) ? { sweep } : {}),
  };
}

/** The ops whose latest succeeded job rests on a provisional acceptance: the leg reads green-provisional. */
export function provisionalOps(db, workflowId) {
  return new Set(provisionalOf(db, workflowId).map((item) => item.opId).filter(Boolean));
}

/**
 * Re-open one provisional acceptance from the owner's handover answer (starci kernel autopilot --reopen): the handover ask
 * must be answered BY THE OWNER (owner-claim.mjs ownerAnswerProof - a fake owner claim is refused), and the owner's
 * note is copied from that verified receipt, never from the caller. Returns the event payload.
 */
export function reopenProvisional(ledger, { workflowId, dispatchId, handoverDispatchId, note = null }) {
  const db = ledger.db;
  const item = provisionalOf(db, workflowId).find((p) => p.dispatchId === dispatchId);
  if (!item) throw Object.assign(new Error(`${dispatchId} is no open provisional acceptance of ${workflowId}`), { code: 'provisional-unknown' });
  const proof = ownerAnswerProof(db, handoverDispatchId);
  if (!proof.ok) throw Object.assign(new Error(`the handover answer ${handoverDispatchId} is not a verified owner answer: ${proof.reason}`), { code: 'owner-claim-unproven' });
  const handover = handoverAsks(db, workflowId).some((ask) => ask.dispatchId === handoverDispatchId);
  if (!handover) throw Object.assign(new Error(`${handoverDispatchId} is no handover ask of ${workflowId}`), { code: 'handover-unknown' });
  const receipt = readJsonFile(proof.receiptPath) ?? {};
  const ownerNote = typeof receipt.note === 'string' && receipt.note.trim() ? receipt.note.trim() : null;
  const payload = { dispatchId, opId: item.opId, jobId: item.jobId, record: item.record, handoverDispatchId, receiptPath: proof.receiptPath,
    ownerNote, focus: typeof note === 'string' && note.trim() ? note.trim().slice(0, 400) : null, answeredBy: OWNER };
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'report', entityId: dispatchId, kind: AUTOPILOT_EVENTS.reopened, payload }));
  return payload;
}

/** Re-opened provisional items the owner's handover feedback owes a re-run of: nextActions reads them. */
export function reopenedOwed(db, workflowId) {
  return eventsOf(db, workflowId, AUTOPILOT_EVENTS.reopened).filter((e) => {
    const job = e.jobId ? db.prepare('SELECT op_id,created_at FROM jobs WHERE job_id=?').get(e.jobId) : null;
    if (!job) return true;
    return !db.prepare("SELECT 1 FROM jobs WHERE workflow_id=? AND op_id=? AND created_at>? LIMIT 1").get(workflowId, job.op_id, Number(e.at));
  });
}

/** True when an enqueue of provision.ask is a mid-flow owner ask autopilot refuses (only the end-of-flow checklist is planned). */
export function provisionAskMidFlow(db, workflowId, { params = {}, settings = autopilotSettings() } = {}) {
  if (!autopilotOn(db, workflowId, settings)) return false;
  return params?.subject !== HANDOVER_CREDENTIALS_SUBJECT;
}
