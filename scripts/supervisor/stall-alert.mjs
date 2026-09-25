#!/usr/bin/env node
// stall-alert.mjs — the stall check with no chat: run headless, send every stall
// finding to whoever can fix it, the owning workflow's Kernel first.
//
// The supervisor chat's own cron ticks starve while it is busy with the owner,
// so a workflow that stops moving must be caught by something that does not
// depend on that chat (incident 2026-09-24: nivo Collab idle ~2 h behind an
// owner gate whose condition had landed). scripts/kernel/resume-all.mjs, which
// the StarCi-Resume-Every10m scheduled task runs, launches this detached every
// pass; it can also run by hand.
//
// Owner, 2026-09-24: "check tele sao toàn stale block? bản thân workflow không thể
// cứu nó hay sao?" - every STALE-* / STALLED finding went to the owner's Telegram,
// though almost all of them are the owning Kernel's to fix. Routing:
//
//   finding                                   route       delivery
//   STALE-GATE / STALE-WAIT / STALE-PEER-WAIT  kernel      a `[stall]` wake into that workflow's Kernel
//   UNREAD-PEER (pending past the grace)                   terminal (wake-delivery.mjs sendWakeWithProof,
//   STALLED, frontier actionable                           proven from the screen), naming the evidence and
//   STALLED on a stale gate/wait, or with no               the exact api action; a `stall-wake` event on the
//     gate, ask or peer-wait to explain it                 workflow. A busy Kernel (turn running, input
//                                                          pending) or a worker mid-turn is skipped and
//                                                          retried next pass; one wake per finding per
//                                                          --wake-minutes (20).
//   the same finding still there --escalate-minutes (20) after its first delivered wake, or its
//     Kernel unreachable that long (no seat, exited, gated, wake lost), or never woken in 60 min
//                                              supervisor  one STALL-ALERT message in the supervisor's
//   STALLED with an unreadable frontier                    channel inbox (<state>/supervisors/<id>.inbox.jsonl,
//   STALLED behind a justified gate the owner              default id 'main'): its Monitor on
//     cannot release (a record a peer owes)                `channel.mjs wait` wakes; at most once per
//                                                          finding per --rate-minutes (60)
//   GATE justified past its grace, waiting on  owner       ONE Telegram digest in config.yaml `language`,
//     an open owner ask or naming nothing                  at most every --digest-minutes (60): what waits
//     checkable                                            on the owner per workflow, since when, and /asks;
//   STALLED on frontier awaiting-owner                     an unchanged digest is repeated every 4 h;
//                                                          credential asks are one /creds count line and
//                                                          never make a digest due on their own
//   PEER-WAIT, young or peer-record GATE,      none        printed only
//   STALLED parked on justified peer-waits
//
// A STALE-*, UNREAD-PEER or actionable STALLED never reaches the owner's Telegram; what the
// supervisor forwards to the owner after an escalation is the supervisor's call.
//
// OWED items (scripts/supervisor/owed.mjs: open incidents and repeated failures that only the
// supervisor moves - runtime/Source defects, checker breakage, knowledge churn, cross-workflow
// effects, delegated decisions) are neither the Kernel's nor the owner's: once one is 15 min old and
// no commit citing it fixed it, it goes straight to the supervisor inbox as one OWED-ALERT message
// per pass, each item at most once per --rate-minutes (state `owed` in stall-alerts.json).
// Dedupe state: <state>/stall-alerts.json {schema: starci/stall-alerts@2, findings: {<key>:
// {firstAt, type, route, line, lastSeenAt, lastWake:{at, action}, lastWakeAt, wokenAt, wakes,
// supervisorAt}}, owner: {digestAt, keys}, owed: {<key>: {firstAt, alertedAt}}}; a finding that disappears is dropped, so its return
// starts over. One run at a time (claimManager 'stall-alert'); a summary line per run goes to
// <state>/stall-alert.log. The bot token is never printed; errors are scrubbed (telegram.mjs
// redact). STARCI_TELEGRAM_API_BASE replaces the Bot API host (specs).
//
//   node scripts/supervisor/stall-alert.mjs [--repo <path>]... [--supervisor <id>]
//       [--stall-minutes <n>] [--rate-minutes <n>] [--wake-minutes <n>] [--escalate-minutes <n>]
//       [--digest-minutes <n>] [--dry-run] [--json]
import '../lib/hide-child-windows.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inspectLedger, ledgerFileFor, openLedger } from '../../engine/ledger-db.mjs';
import { argsOf, claimManager, ownerConfig, readJson, stateFile, writeJson } from '../connectors/lib.mjs';
import { appendInbox } from '../connectors/telegram-bridge.mjs';
import { DEFAULT_API_BASE, redact, sendMessage, telegramSettings } from '../connectors/telegram.mjs';
import { resumeRepos } from '../kernel/resume-all.mjs';
import { wakeKernel } from '../kernel/wake-delivery.mjs';
import { apiFrontier, clock, GATE_GRACE_MS, stallFindings, stallMinutesOf, WORKING_LIVENESS } from './stall.mjs';
import { alertableOwed, OWED_ALERT_MS, owedFindings } from './owed.mjs';

export const ALERT_NAME = 'stall-alert';
export const ALERT_FILE = fileURLToPath(import.meta.url);
export const DEFAULT_SUPERVISOR_ID = 'main';
/** A finding is repeated to the supervisor at most once per this window. */
export const RATE_MS = 60 * 60_000;
/** One stall wake per finding per this window. */
export const WAKE_RATE_MS = 20 * 60_000;
/** A finding still there this long after its Kernel took the wake (or could not take it) is escalated. */
export const ESCALATE_MS = 20 * 60_000;
/** A finding whose Kernel never took a wake (busy, or a worker mid-turn all along) is escalated at this age. */
export const ESCALATE_CAP_MS = 60 * 60_000;
/** At most one owner digest per this window. */
export const DIGEST_MS = 60 * 60_000;
/** An owner digest that names nothing new is repeated this rarely. */
export const DIGEST_REMIND_MS = 4 * 60 * 60_000;
export const ROUTES = Object.freeze({ kernel: 'kernel', supervisor: 'supervisor', owner: 'owner', none: 'none' });
/** Finding types this pass routes somewhere (GATE and STALLED only in some cases: routeOf). */
export const ALERT_TYPES = ['STALLED', 'STALE-GATE', 'STALE-WAIT', 'STALE-PEER-WAIT', 'UNREAD-PEER', 'GATE'];
/** Wake outcomes that mean the Kernel cannot take a wake at all: the supervisor hears of it after ESCALATE_MS. */
export const UNREACHABLE = new Set(['kernel-signal-absent', 'kernel-unavailable', 'kernel-unreadable', 'kernel-exited', 'kernel-gated', 'kernel-wake-failed', 'kernel-wake-error']);
export const STALL_WAKE_TAG = '[stall]';
const STALE_TYPES = ['STALE-GATE', 'STALE-WAIT', 'STALE-PEER-WAIT'];
const MAX_TEXT = 3900;
const MAX_EVIDENCE = 320;
const MAX_WAKE_ITEM = 1200;
const LOG_CAP = 2 * 1024 * 1024;

export const alertStateFile = (env = process.env) => stateFile('stall-alerts.json', env);
export const alertLogFile = (env = process.env) => stateFile('stall-alert.log', env);

const clip = (text, n) => { const s = String(text ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const since = (at, now) => {
  const mins = Math.max(0, Math.round((now - at) / 60_000));
  const age = mins >= 120 ? `${Math.round(mins / 60)}h` : `${mins}m`;
  const day = now - at > 20 * 60 * 60_000 ? `${new Date(at).toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' })} ` : '';
  return `${day}${clock(at)} (${age})`;
};

/* ------------------------------------------------------------ routing */

/**
 * A justified owner gate the owner can act on: past its grace and held by an open owner ask, or
 * naming nothing checkable (only the owner releases it). A gate justified only by a record a peer
 * has not written yet is not the owner's.
 */
export const ownerGateWait = (f) => f.type === 'GATE' && f.young !== true
  && ((f.asks?.length ?? 0) > 0 || (!(f.waits?.length) && !PEER_DEPENDENCY.test(f.text ?? '')));
/**
 * An owner gate its own text calls a peer dependency, with no owner ask open: the wait is typed
 * wrong (nivo Collab inc-28187662c4fe, "Peer dependency (not an owner step, but the only holding
 * mechanism)"), so the owner is told about something only a peer can release. Its Kernel re-records
 * it as a peer-wait, which the stall check can judge.
 */
export const PEER_DEPENDENCY = /\bpeer(?:[- ]dependen\w*| workflow)\b|\bnot an owner (?:step|decision|gate)\b/i;
export const misfiledPeerGate = (f) => f.type === 'GATE' && f.young !== true && !(f.asks?.length) && PEER_DEPENDENCY.test(f.text ?? '');

/** One finding's route (ROUTES), given the other findings of its pass. */
export function routeOf(f, { now = Date.now(), graceMs = GATE_GRACE_MS, ownerWfs = new Set(), staleWfs = new Set() } = {}) {
  switch (f.type) {
    case 'STALE-GATE': case 'STALE-WAIT': case 'STALE-PEER-WAIT': return ROUTES.kernel;
    // A message that just arrived is the Kernel's next read anyway (frontier peer-message).
    case 'UNREAD-PEER': return f.pendingSince != null && now - f.pendingSince < graceMs ? ROUTES.none : ROUTES.kernel;
    case 'GATE': return ownerGateWait(f) ? ROUTES.owner : misfiledPeerGate(f) ? ROUTES.kernel : ROUTES.none;
    case 'STALLED':
      // Parked on the owner (stall.mjs justifiedOwnerWait): not a stall, but the owner's digest lists it.
      if (f.justifiedOwnerWait && !staleWfs.has(f.workflowId)) return ROUTES.owner;
      if (f.alert === false) return ROUTES.none;
      if (f.frontierState == null) return ROUTES.supervisor;
      if (f.actionable) return ROUTES.kernel;
      // A stale or misfiled gate or wait makes the frontier read awaiting-owner / peer-wait: its Kernel's to clear.
      if (staleWfs.has(f.workflowId)) return ROUTES.kernel;
      if (f.frontierState === 'awaiting-owner' || ownerWfs.has(f.workflowId)) return ROUTES.owner;
      if (f.justifiedGate) return ROUTES.supervisor;
      return ROUTES.kernel;
    default: return ROUTES.none;
  }
}

/** Every finding with its `route`. */
export function routeFindings(findings, { now = Date.now(), graceMs = GATE_GRACE_MS } = {}) {
  const ownerWfs = new Set(findings.filter(ownerGateWait).map((f) => f.workflowId));
  const staleWfs = new Set(findings.filter((f) => STALE_TYPES.includes(f.type) || misfiledPeerGate(f)).map((f) => f.workflowId));
  return findings.map((f) => ({ ...f, route: routeOf(f, { now, graceMs, ownerWfs, staleWfs }) }));
}

/**
 * The pass plan, pure: routed findings, the next dedupe state, the Kernel wakes due (one per
 * workflow, carrying every Kernel finding of it), the supervisor findings due now (`inbox`), and
 * the owner digest (`telegram`: its items when one is due, else []).
 */
export function planStall(findings, state, {
  now = Date.now(), graceMs = GATE_GRACE_MS, rateMs = RATE_MS, wakeRateMs = WAKE_RATE_MS,
  digestMs = DIGEST_MS, remindMs = DIGEST_REMIND_MS,
} = {}) {
  const routed = routeFindings(findings, { now, graceMs }).filter((f) => f.route !== ROUTES.none);
  const prevEntries = state?.findings ?? {};
  const entries = {};
  for (const f of routed) {
    const prev = prevEntries[f.key] ?? {};
    const { inboxAt, telegramAt, ...kept } = prev; // starci/stall-alerts@1 fields
    entries[f.key] = { ...kept, firstAt: prev.firstAt ?? now, type: f.type, route: f.route, line: f.line, lastSeenAt: now,
      ...(kept.supervisorAt ?? inboxAt ? { supervisorAt: kept.supervisorAt ?? inboxAt } : {}) };
  }
  const due = (at, windowMs) => !(now - (at ?? -Infinity) < windowMs);

  const byWorkflow = new Map();
  for (const f of routed.filter((x) => x.route === ROUTES.kernel)) {
    const id = `${f.repo ?? ''}\u0000${f.workflowId}`;
    if (!byWorkflow.has(id)) byWorkflow.set(id, { repo: f.repo ?? null, workflowId: f.workflowId, findings: [] });
    byWorkflow.get(id).findings.push(f);
  }
  const wakes = [...byWorkflow.values()].filter((w) => w.findings.some((f) => due(entries[f.key].lastWakeAt, wakeRateMs)));

  const inbox = routed.filter((f) => f.route === ROUTES.supervisor && due(entries[f.key].supervisorAt, rateMs));

  const ownerItems = routed.filter((f) => f.route === ROUTES.owner);
  // A workflow parked on credential asks alone never makes a digest due: it rides as one count line.
  const pushed = ownerItems.filter((f) => !f.credentialOnly);
  const prevOwner = state?.owner ?? {};
  const told = new Set((prevOwner.keys ?? []).filter((k) => pushed.some((f) => f.key === k)));
  const digestDue = pushed.length > 0 && due(prevOwner.digestAt, digestMs)
    && (pushed.some((f) => !told.has(f.key)) || due(prevOwner.digestAt, remindMs));
  return {
    routed, wakes, inbox, telegram: digestDue ? ownerItems : [],
    state: { schema: 'starci/stall-alerts@2', findings: entries, owner: { digestAt: prevOwner.digestAt ?? null, keys: [...told] } },
  };
}
/** The pre-routing name (tests/peer-wait.spec.mjs): the same plan. */
export const planAlerts = planStall;

/**
 * Kernel findings whose self-heal failed, after this pass's wakes were recorded in `entries`: still
 * there `escalateMs` after the first delivered wake, or the Kernel unreachable that long, or never
 * woken at all by `capMs`; each at most once per `rateMs`.
 */
export function dueEscalations(routed, entries, { now = Date.now(), escalateMs = ESCALATE_MS, capMs = ESCALATE_CAP_MS, rateMs = RATE_MS } = {}) {
  return routed.filter((f) => {
    const e = entries[f.key];
    if (f.route !== ROUTES.kernel || !e) return false;
    if (now - (e.supervisorAt ?? -Infinity) < rateMs) return false;
    if (e.wokenAt != null) return now - e.wokenAt >= escalateMs;
    if (e.lastWake && UNREACHABLE.has(e.lastWake.action) && now - e.firstAt >= escalateMs) return true;
    return now - e.firstAt >= capMs;
  });
}

/* ------------------------------------------------------------ the Kernel wake */

const incidentAction = (wf, id, what) => `api incident --workflow ${wf} --resolve ${id} --detail "<${what}>"`;

/** What the Kernel does about one finding: the evidence and the exact api action. */
export function wakeItem(f, { alone = true } = {}) {
  const wf = f.workflowId;
  switch (f.type) {
    case 'STALE-GATE':
      return `STALE-GATE ${f.incidentId}: its reason is gone - ${clip((f.reasons ?? []).join('; ') || f.line, MAX_EVIDENCE)}. Check that evidence yourself; when it holds run ${incidentAction(wf, f.incidentId, 'the evidence')} and route/dispatch the jobs it held (check/settle a settle it deferred); when the gate still waits on something, resolve it and record a new one naming exactly that.`;
    case 'STALE-PEER-WAIT':
      return `STALE-PEER-WAIT ${f.incidentId} on ${f.peer ?? '?'}: ${clip((f.reasons ?? []).join('; ') || f.line, MAX_EVIDENCE)}. Re-check the prerequisite yourself: landed or no longer landable -> ${incidentAction(wf, f.incidentId, 'the proof')} and continue; still missing and the peer idle -> api notify --workflow ${wf} --to ${f.peer ?? '<peer>'} --kind request --subject <what you wait on> --body <exactly what must land>; else re-record the wait with what it waits on now.`;
    case 'STALE-WAIT':
      return `${f.line.replace(/; the Kernel retries.*$/, '')}. Its blocker settled: retry the blocker as a new attempt, re-point ${f.jobId ?? 'the job'} (api enqueue --after) or drop it, and record why.`;
    case 'GATE':
      return `GATE ${f.incidentId} is an [${f.gateKind ?? 'owner-gate'}] that its own text calls a peer dependency, and no owner ask is open: "${clip(f.text, 160)}". The owner cannot release it. Re-record it as the typed wait: api incident --workflow ${wf} --kind peer-wait --peer <the peer workflow id> --holds <the jobs it holds> --detail <exactly what must land>, then ${incidentAction(wf, f.incidentId, 're-recorded as peer-wait <new incident>')}. A gate that truly waits on the owner names the owner ask instead.`;
    case 'UNREAD-PEER':
      return `UNREAD-PEER ${f.peerMessage} from ${f.from ?? 'a peer'} is still pending. Run api inbox --workflow ${wf}, act on it (a request in your scope becomes work, a heads-up adjusts the plan, answer with api notify --kind reply --reply-to ${f.peerMessage}), then api inbox --workflow ${wf} --ack ${f.peerMessage} --disposition "<what you did>".`;
    case 'STALLED':
      // Beside other findings the stall is their effect: clearing them moves it.
      if (!alone) return `${clip(f.line, MAX_EVIDENCE)}. The other item(s) of this wake hold it; clear them, then run api status --workflow ${wf} and continue.`;
      return `${clip(f.line, MAX_EVIDENCE * 2)}. Run api status --workflow ${wf} and do what frontier.reason names now (route/dispatch, consume/check/settle, nudge, reconcile, serve an ask); if nothing is movable, record the exact wait (api incident --kind peer-wait --peer <wf> | --kind owner-gate) before yielding.`;
    default:
      return f.line;
  }
}

/** The one-line wake typed into a Kernel terminal: tag, rule, then one item per finding (wakeKernel appends the seat's wakeIdentity). */
export function stallWakeText(workflowId, findings) {
  return [
    `${STALL_WAKE_TAG} Stall self-heal wake for ${workflowId} (scripts/supervisor/stall-alert.mjs): the supervision pass found ${findings.length} thing(s) this workflow can fix itself.`,
    'This is work, not a notice: act on each now with the api action named, then re-read api status and continue the frontier. It grants no new scope, path or authority.',
    ...findings.map((f, i) => `(${i + 1}) ${clip(wakeItem(f, { alone: findings.length === 1 }), MAX_WAKE_ITEM)}`),
    'If a finding is wrong, say why in the incident detail; left as is, it goes to the supervisor.',
  ].join(' ');
}

// wakeKernel: the one Kernel wake path (scripts/kernel/wake-delivery.mjs). Pending input is 'kernel-busy'
// here: the Kernel watchdog owns that Enter.
export { wakeKernel };

/** Append the `stall-wake` event on the woken workflow (a write handle, opened and closed here). */
export function recordStallWake({ repo, workflowId, payload, now = Date.now() }) {
  const ledger = openLedger({ file: ledgerFileFor(repo) });
  try {
    ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'stall-wake', payload, createdAt: now }));
  } finally { ledger.close(); }
}

/* ------------------------------------------------------------ the messages */

const TEXT = {
  en: {
    head: (n) => `🕒 StarCi: ${n} workflow(s) wait on you`,
    since: 'since',
    stalled: 'waits on the owner',
    creds: (n) => `🔑 ${n} credential ask(s) wait for values (they hold only live proof): /creds`,
    tail: 'Open questions and their answer links: /asks. Stale gates, waits and stalls go to each workflow\'s own Kernel, then to the supervisor; you only hear what needs you.',
  },
  vi: {
    head: (n) => `🕒 StarCi: ${n} workflow đang chờ thầy`,
    since: 'từ',
    stalled: 'đang chờ thầy',
    creds: (n) => `🔑 ${n} yêu cầu credential đang chờ (chỉ phần chạy thử thật chờ): /creds`,
    tail: 'Câu hỏi đang mở và link trả lời: /asks. Cổng chờ cũ, việc chờ và workflow đứng yên được giao cho Kernel của chính workflow đó tự xử lý, rồi tới supervisor; thầy chỉ nhận những việc cần thầy.',
  },
};
export const alertText = (language) => TEXT[language] ?? TEXT.en;

/**
 * The owner's one digest: per workflow, what waits on the owner and since when; one count line for
 * the credential asks (never listed); then /asks.
 */
export function ownerDigest(items, language, { now = Date.now() } = {}) {
  const t = alertText(language);
  const creds = new Set(items.flatMap((f) => f.credentialAsks ?? []));
  const groups = new Map();
  for (const f of items.filter((x) => !x.credentialOnly)) {
    if (!groups.has(f.workflowId)) groups.set(f.workflowId, []);
    groups.get(f.workflowId).push(f);
  }
  const lines = [];
  for (const [wf, list] of groups) {
    const gates = list.filter((f) => f.type === 'GATE');
    const shown = gates.length ? gates : list;
    const what = shown.map((f) => (f.type === 'GATE'
      ? `${f.incidentId}: ${clip(f.text, 160)}${f.asks?.length ? ` (ask ${f.asks.map((a) => a.dispatchId).join(', ')})` : ''}`
      : `${t.stalled}: ${clip(f.frontierReason ?? f.line, 200)}`)).join('; ');
    const at = Math.min(...shown.map((f) => f.raisedAt ?? f.idleSince ?? now));
    lines.push(`• ${wf}: ${what} — ${t.since} ${since(at, now)}`);
  }
  const text = [t.head(groups.size), ...lines, ...(creds.size ? [t.creds(creds.size)] : []), t.tail].join('\n\n');
  return text.length > MAX_TEXT ? `${text.slice(0, MAX_TEXT - 1)}…` : text;
}

/** Why a finding reached the supervisor, from its dedupe entry. */
export function escalationWhy(f, e, now = Date.now()) {
  if (f.route === ROUTES.supervisor) {
    return f.frontierState == null ? 'runtime: the frontier is unreadable' : 'held by a justified gate only a peer or the supervisor can move';
  }
  const last = e?.lastWake ? `last wake ${e.lastWake.action} ${clock(e.lastWake.at)}` : 'never woken';
  if (e?.wokenAt != null) return `self-heal failed: ${e.wakes ?? 1} stall wake(s) since ${clock(e.wokenAt)}, the finding persists; ${last}`;
  if (e?.lastWake && UNREACHABLE.has(e.lastWake.action)) return `self-heal impossible: the Kernel cannot take a wake (${e.lastWake.action}) since ${clock(e.firstAt)}`;
  return `self-heal never ran: the Kernel stayed busy since ${clock(e?.firstAt ?? now)}; ${last}`;
}

/** The supervisor's inbox message; its first line is what `channel.mjs wait` prints. */
export const inboxAlert = (items) => `STALL-ALERT ${items.length} finding(s) the workflows could not fix themselves: ${items.map(({ f, why }) => `${f.line} [${why}]`).join('\n')}`;

const OWED_LINES = 40;
/**
 * The OWED items due to the supervisor now, and the next `owed` dedupe state ({<key>: {firstAt,
 * alertedAt}}): alertable (owed.mjs alertableOwed) and not told inside `rateMs`. An item that is gone
 * is dropped, so its return starts over.
 */
export function planOwed(owed, prev = {}, { now = Date.now(), rateMs = RATE_MS, minAgeMs = OWED_ALERT_MS } = {}) {
  const state = {};
  for (const i of owed) state[i.key] = { firstAt: prev[i.key]?.firstAt ?? now, ...(prev[i.key]?.alertedAt ? { alertedAt: prev[i.key].alertedAt } : {}) };
  const due = alertableOwed(owed, { now, minAgeMs }).filter((i) => !(now - (state[i.key].alertedAt ?? -Infinity) < rateMs));
  return { due, state };
}
/** The OWED-ALERT inbox message: the supervisor's own work, not a Kernel's and not the owner's. */
export const owedAlert = (items) => [
  `OWED-ALERT ${items.length} item(s) wait on the supervisor, not on a Kernel or the owner: fix each now (.claude/runtime, custody, shared tooling, conflict, delegated ruling) or tell its Kernel which commit fixed it (modules/supervisor/supervise.yaml step owed)`,
  ...items.slice(0, OWED_LINES).map((i) => `${i.line} -> ${clip(i.action, 220)}`),
  ...(items.length > OWED_LINES ? [`... and ${items.length - OWED_LINES} more: node scripts/supervisor/owed.mjs`] : []),
].join('\n');

/* ------------------------------------------------------------ the pass */

const openLedgers = (repos) => {
  const ledgers = [], errors = [];
  for (const repo of repos) {
    try { ledgers.push({ repo, handle: inspectLedger({ file: ledgerFileFor(repo) }) }); }
    catch (error) { errors.push({ repo, error: String(error?.message ?? error).slice(0, 200) }); }
  }
  return { ledgers: ledgers.map((l) => ({ repo: l.repo, db: l.handle.db, close: () => l.handle.close() })), errors };
};

/**
 * One pass over `repos`. Every seam is injectable: `detect` (stall.mjs stallFindings), `frontierOf`
 * (api status, also the worker-mid-turn probe), `wake` (wakeKernel), `record` (recordStallWake), the
 * Telegram `settings`, `apiBase`/`fetchImpl`. Never throws; returns {ok, findings, woken, skipped,
 * alerted:{inbox, telegram}, inbox, telegram, errors}.
 */
export async function runStallAlert({
  repos = [], env = process.env, now = Date.now(), stallMinutes = stallMinutesOf(), rateMs = RATE_MS,
  wakeRateMs = WAKE_RATE_MS, escalateMs = ESCALATE_MS, capMs = ESCALATE_CAP_MS, digestMs = DIGEST_MS, remindMs = DIGEST_REMIND_MS,
  graceMs = GATE_GRACE_MS, supervisorId = DEFAULT_SUPERVISOR_ID, detect = stallFindings, frontierOf = undefined,
  wake = wakeKernel, record = recordStallWake, settings = null, owedOf = (db, opts) => owedFindings(db, opts).owed, owedMinAgeMs = OWED_ALERT_MS,
  apiBase = env.STARCI_TELEGRAM_API_BASE || DEFAULT_API_BASE, fetchImpl = fetch, sleepImpl = undefined, dryRun = false,
} = {}) {
  const result = { ok: true, dryRun, repos, findings: [], woken: [], skipped: [], owed: [], alerted: { inbox: [], telegram: [], owed: [] }, inbox: null, owedInbox: null, telegram: null, errors: [] };
  // api status is asked once per workflow per pass: by the stall classification, then by the worker probe.
  const frontiers = new Map();
  const frontierFn = frontierOf ?? apiFrontier;
  const cachedFrontier = (repo, wf) => {
    const id = `${repo}\u0000${wf}`;
    if (!frontiers.has(id)) frontiers.set(id, frontierFn(repo, wf));
    return frontiers.get(id);
  };
  const { ledgers, errors } = openLedgers(repos);
  result.errors.push(...errors);
  const stateFileName = alertStateFile(env);
  let plan, owedPlan;
  const wakeResults = [];
  try {
    const findings = [];
    // Every gate and peer-wait verdict of this pass, judged once by detect and reused by owedOf.
    const verdicts = new Map();
    for (const l of ledgers) {
      try { findings.push(...detect(l.db, { repo: l.repo, ledgers, now, stallMinutes, graceMs, frontierOf: cachedFrontier, verdicts })); }
      catch (error) { result.errors.push({ repo: l.repo, error: String(error?.message ?? error).slice(0, 200) }); }
    }
    const prevState = readJson(stateFileName, {});
    plan = planStall(findings, prevState, { now, graceMs, rateMs, wakeRateMs, digestMs, remindMs });
    // What only the supervisor moves (owed.mjs), from every ledger in view.
    const owed = [];
    for (const l of ledgers) {
      try { owed.push(...owedOf(l.db, { repo: l.repo, ledgers, now, graceMs, stallMinutes, verdicts, frontierOf: cachedFrontier })); }
      catch (error) { result.errors.push({ repo: l.repo, error: `owed: ${String(error?.message ?? error).slice(0, 180)}` }); }
    }
    owedPlan = planOwed(owed, prevState?.owed ?? {}, { now, rateMs, minAgeMs: owedMinAgeMs });
    plan.state.owed = owedPlan.state;
    result.owed = owed.map((i) => ({ key: i.key, status: i.status, line: i.line }));
    const routeOfKey = new Map(plan.routed.map((f) => [f.key, f.route]));
    result.findings = findings.map((f) => ({ type: f.type, key: f.key, route: routeOfKey.get(f.key) ?? ROUTES.none, line: f.line }));
    if (dryRun) {
      result.woken = plan.wakes.map((w) => ({ workflowId: w.workflowId, keys: w.findings.map((f) => f.key), action: 'would-wake' }));
      result.alerted = { inbox: plan.inbox.map((f) => f.key), telegram: plan.telegram.map((f) => f.key), owed: owedPlan.due.map((i) => i.key) };
      return result;
    }

    // Self-heal first: one wake per workflow, into its own Kernel.
    const testRefusal = env.NODE_TEST_CONTEXT && wake === wakeKernel ? 'test context: refusing a real terminal wake' : null;
    for (const w of plan.wakes) {
      const keys = w.findings.map((f) => f.key);
      const status = cachedFrontierOrNull(cachedFrontier, w.repo, w.workflowId);
      const busyWorkers = (status?.workers ?? []).filter((wk) => WORKING_LIVENESS.includes(wk.liveness)).map((wk) => wk.jobId);
      let r;
      if (testRefusal) r = { action: 'skipped', delivered: false, reason: testRefusal };
      else if (busyWorkers.length) r = { action: 'worker-mid-turn', delivered: false, workers: busyWorkers };
      else {
        const db = ledgers.find((l) => l.repo === w.repo)?.db;
        r = db ? wake({ db, repo: w.repo, workflowId: w.workflowId, text: stallWakeText(w.workflowId, w.findings), findings: w.findings })
          : { action: 'kernel-unreadable', delivered: false, error: 'ledger not open' };
      }
      wakeResults.push({ w, keys, r });
    }
  } finally { for (const l of ledgers) { try { l.close(); } catch { /* closed */ } } }
  if (result.errors.length) result.ok = false;

  const entries = plan.state.findings;
  for (const { w, keys, r } of wakeResults) {
    for (const key of keys) {
      const e = entries[key];
      e.lastWake = { at: now, action: r.action };
      if (r.delivered) { e.lastWakeAt = now; e.wokenAt ??= now; e.wakes = (e.wakes ?? 0) + 1; }
    }
    if (r.delivered) {
      result.woken.push({ workflowId: w.workflowId, keys, action: r.action, terminal: r.terminal ?? null, delivery: r.delivery ?? null });
      try {
        record({ repo: w.repo, workflowId: w.workflowId, now, payload: {
          findings: w.findings.map((f) => ({ key: f.key, type: f.type, line: clip(f.line, 300) })), terminal: r.terminal ?? null,
          priorState: r.state ?? null, ...(r.delivery ? { delivery: r.delivery, evidence: r.evidence ?? null } : {}) } });
      } catch (error) { result.errors.push({ repo: w.repo, error: `stall-wake event: ${String(error?.message ?? error).slice(0, 160)}` }); }
    } else result.skipped.push({ workflowId: w.workflowId, keys, action: r.action, ...(r.state ? { state: r.state } : {}), ...(r.reason ? { reason: r.reason } : {}), ...(r.error ? { error: clip(r.error, 160) } : {}) });
  }

  // Escalate only when self-heal failed, plus what no Kernel can fix.
  const escalations = dueEscalations(plan.routed, entries, { now, escalateMs, capMs, rateMs });
  const toSupervisor = [...plan.inbox, ...escalations].map((f) => ({ f, why: escalationWhy(f, entries[f.key], now) }));
  if (toSupervisor.length) {
    try {
      const item = appendInbox(supervisorId, { chatId: null, messageId: null, from: 'stall-alert', text: inboxAlert(toSupervisor) }, { env });
      for (const { f } of toSupervisor) entries[f.key].supervisorAt = now;
      result.alerted.inbox = toSupervisor.map(({ f }) => f.key);
      result.inbox = { ok: true, supervisor: supervisorId, id: item.id };
    } catch (error) { result.ok = false; result.inbox = { ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
  }

  // What only the supervisor moves goes to the supervisor, never to a Kernel or the owner.
  if (owedPlan?.due.length) {
    try {
      const item = appendInbox(supervisorId, { chatId: null, messageId: null, from: 'stall-alert', text: owedAlert(owedPlan.due) }, { env });
      for (const i of owedPlan.due) plan.state.owed[i.key].alertedAt = now;
      result.alerted.owed = owedPlan.due.map((i) => i.key);
      result.owedInbox = { ok: true, supervisor: supervisorId, id: item.id };
    } catch (error) { result.ok = false; result.owedInbox = { ok: false, error: String(error?.message ?? error).slice(0, 200) }; }
  }

  // The owner hears only what waits on the owner, as one digest.
  if (plan.telegram.length) {
    const s = settings ?? telegramSettings({ env });
    const skipped = env.STARCI_CONNECTORS_OFF === '1' ? 'STARCI_CONNECTORS_OFF'
      : env.NODE_TEST_CONTEXT && apiBase === DEFAULT_API_BASE && fetchImpl === globalThis.fetch ? 'test context: refusing the real Bot API'
      : !s?.ready ? (s?.warning ?? 'telegram is off (connectors.telegram)') : null;
    if (skipped) result.telegram = { ok: true, skipped };
    else {
      try {
        const r = await sendMessage({ token: s.token, chatId: s.chatId, text: ownerDigest(plan.telegram, s.language, { now }), apiBase, fetchImpl, ...(sleepImpl ? { sleepImpl } : {}) });
        if (r.ok) {
          plan.state.owner = { digestAt: now, keys: plan.telegram.map((f) => f.key) };
          result.alerted.telegram = plan.telegram.map((f) => f.key);
          result.telegram = { ok: true, messageId: r.messageId ?? null };
        } else { result.ok = false; result.telegram = { ok: false, status: r.status ?? null, error: redact(r.error, s.token) }; }
      } catch (error) { result.ok = false; result.telegram = { ok: false, error: redact(error?.message ?? error, s.token) }; }
    }
  }
  try { writeJson(stateFileName, plan.state); } catch (error) { result.ok = false; result.errors.push({ state: stateFileName, error: String(error?.message ?? error) }); }
  return result;
}

function cachedFrontierOrNull(cached, repo, wf) {
  try { const s = cached(repo, wf); return s?.ok ? s : null; } catch { return null; }
}

const appendLog = (env, line) => {
  try {
    const file = alertLogFile(env);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    if (fs.existsSync(file) && fs.statSync(file).size > LOG_CAP) fs.renameSync(file, `${file}.1`);
    fs.appendFileSync(file, `[${new Date().toISOString()}] ${line}\n`);
  } catch { /* the log is a courtesy */ }
};

export const describe = (r) => [
  `[stall-alert] ${r.ok ? 'ok' : 'NOT OK'}${r.dryRun ? ' (dry run)' : ''}: ${r.repos.length} ledger(s), ${r.findings.length} finding(s),`
    + ` kernel wakes ${r.woken.length} (skipped ${r.skipped.length}), supervisor ${r.alerted.inbox.length}, owed ${r.owed?.length ?? 0} (alerted ${r.alerted.owed?.length ?? 0}), owner digest ${r.alerted.telegram.length}`
    + `${r.telegram?.skipped ? ` (telegram skipped: ${r.telegram.skipped})` : r.telegram?.ok === false ? ` (telegram FAILED: ${r.telegram.error})` : ''}`
    + `${r.inbox?.ok === false ? ` (inbox FAILED: ${r.inbox.error})` : ''}${r.owedInbox?.ok === false ? ` (owed inbox FAILED: ${r.owedInbox.error})` : ''}`,
  ...r.findings.map((f) => `  [${f.route}] ${f.line}`),
  ...r.woken.map((w) => `  woke ${w.workflowId} (${w.action}${w.delivery ? ` ${w.delivery}` : ''}): ${w.keys.join(', ')}`),
  ...r.skipped.map((w) => `  wake skipped ${w.workflowId}: ${w.action}${w.state ? ` ${w.state}` : ''}${w.reason ? ` (${w.reason})` : ''}`),
  ...r.errors.map((e) => `  error ${e.repo ?? e.state}: ${e.error}`),
].join('\n');

async function main() {
  const args = argsOf(process.argv.slice(2));
  const list = (v) => (v === undefined ? [] : [].concat(v)).filter((x) => typeof x === 'string');
  const minutesArg = (name, fallbackMs) => (Number(args[name]) || fallbackMs / 60_000) * 60_000;
  if (args.help || args.h) {
    console.log('use: node scripts/supervisor/stall-alert.mjs [--repo <path>]... [--supervisor <id>] [--stall-minutes <n>] [--rate-minutes <n>] [--wake-minutes <n>] [--escalate-minutes <n>] [--digest-minutes <n>] [--dry-run] [--json]');
    return;
  }
  const env = process.env;
  const claim = claimManager(ALERT_NAME, { env });
  if (!claim.ok) {
    const out = { ok: true, skipped: 'another stall-alert run holds the lock', holder: claim.holder?.pid ?? null };
    console.log(args.json ? JSON.stringify(out) : `[stall-alert] skipped: ${out.skipped}`);
    return;
  }
  try {
    const { repos } = resumeRepos({ config: ownerConfig(), env, extra: list(args.repo) });
    const result = await runStallAlert({
      repos, env,
      supervisorId: typeof args.supervisor === 'string' ? args.supervisor : DEFAULT_SUPERVISOR_ID,
      stallMinutes: Number(args['stall-minutes']) || stallMinutesOf(),
      rateMs: minutesArg('rate-minutes', RATE_MS),
      wakeRateMs: minutesArg('wake-minutes', WAKE_RATE_MS),
      escalateMs: minutesArg('escalate-minutes', ESCALATE_MS),
      digestMs: minutesArg('digest-minutes', DIGEST_MS),
      dryRun: args['dry-run'] === true,
    });
    const acted = [...result.woken.map((w) => `wake ${w.workflowId}`), ...result.alerted.inbox.map((k) => `supervisor ${k}`), ...result.alerted.owed.map((k) => `owed ${k}`), ...result.alerted.telegram.map((k) => `owner ${k}`)];
    appendLog(env, describe(result).split('\n')[0] + (acted.length ? ` :: ${acted.join(', ')}` : ''));
    console.log(args.json ? JSON.stringify(result) : describe(result));
    if (!result.ok) process.exitCode = 1;
  } finally { claim.release(); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === ALERT_FILE) main();
