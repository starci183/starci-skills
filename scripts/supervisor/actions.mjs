#!/usr/bin/env node
// actions.mjs — the OWED ACTIONS list: every stuck item of every running workflow, classified, with the one action
// the [Supervisor] takes on it and an SLA clock (modules/supervisor/supervise.yaml mission; owner, 2026-09-28:
// "supervisor phải giám sát, quản lý, gửi thư tới, điều chỉnh" - autopilot, the owner is asked only for the final
// credentials step and the handover).
//
// It classifies nothing twice: OWED incidents and patterns come from owed.mjs through cluster.mjs, stalls/gates/waits
// from stall.mjs (the poll digest), frontiers from `api status` (tick-duties.mjs workflowFrontiers), dead kernels and
// pushes from the tick. This file maps each to a class and a concrete action, and keeps the SLA:
//   first seen   tick state owedSeen (supervisor ledger signal supervisor-tick), a key a tick no longer sees starts over
//   acted        a `supervisor-action` event naming the item (this CLI `record`, notify.mjs --item), or a
//                `supervisor-notice` to the item's workflow, after it was first seen
//   breach       first seen more than runtimes.yaml allocation.supervisorTick.actionSlaMs ago and no action since
// The tick records one `supervisor-owed-actions` event per run; `list` prints the newest.
//
//   node scripts/supervisor/actions.mjs list [--json] [--open]
//   node scripts/supervisor/actions.mjs record --item <key> --action <verb> --reason <text> [--workflow <id>] [--refs <csv>] [--until <iso> | --hold-ms <ms>]
//   node scripts/supervisor/actions.mjs digest [--send] [--force] [--json]     the owner's periodic digest (Telegram)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipLine } from '../lib/clip.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { hhmm, stampMinute } from '../lib/time.mjs';
import { OWNER_ONLY } from './owed.mjs';
import { actionRow, supLog } from './sup-log.mjs';
import { SUPERVISOR_WF, openSupervisorLedger, supervisorEvent, supervisorSettings, withSupervisorRead } from './home.mjs';

const selfFile = fileURLToPath(import.meta.url);
export const ACTION_KIND = 'supervisor-action';
export const OWED_ACTIONS_KIND = 'supervisor-owed-actions';
export const DIGEST_KIND = 'supervisor-owner-digest';
export const NOTICE_KIND = 'supervisor-notice';

/** The classes, each with what the Supervisor does (supervise.yaml mission.classes). */
export const CLASSES = Object.freeze({
  'progress-stall': 'OUTCOME FIRST: the workflow does not progress past allocation.progress.supervisorGraceMs although its Kernel owns it. Read api status progress + rca, five-whys to the root cause, find the ONE systemic change that fixes the most (never re-dispatch the same failing shape): the Kernel lacks authority -> do it (lane) or rule it; a runtime cause -> runtime-defect; cross-workflow -> bridge/notify the peer; the Kernel ignores its rca.actions -> the tick already notified it, a second miss is a Kernel-loop defect (lane)',
  'kernel-proposal': 'a Kernel filed a tier-2 change for shared .claude (api kernel-proposal): AUTO tier -> land it through a lane (lessons.mjs land), IMPORTANT -> lessons.mjs propose to the owner; record the result and close it in the product ledger',
  'runtime-defect': 'fix it in an Opus lane or ONE [Worker] job per cluster, land it, then resolve each incident: api incident --resolve <inc> --by supervisor --detail "fixed by .claude <sha>" and notify the Kernel',
  'fixed-defect': 'verify the commit against the incident, then api incident --resolve <inc> --by supervisor --detail "fixed by .claude <sha>" and notify the Kernel (or ack the pattern: owed.mjs ack)',
  'retry-cap': 'never a blind retry: diagnose the root cause (a [Worker] diagnose job), then notify the Kernel with the disposition - re-route to the root-cause op, re-cut the leg, or drop it',
  'stale-gate': 'notify the owning Kernel with the evidence; still open past the SLA: resolve it yourself, api incident --resolve <inc> --by supervisor --detail "<evidence>"',
  'owner-gate-no-ask': 'autopilot: not an owner step - take the ruling, record it, resolve --by supervisor (or type it: --attach <inc> --until-*); only credentials/handover stay the owner\'s',
  'peer-wait': 'notify the waiting Kernel and the PEER Kernel (the thing it owes is its next move); a peer that is itself stuck is escalated as its own item',
  'owner-ask': 'autopilot (owner 2026-09-28): only credentials and the handover are the owner\'s. Never answer the ask: tell the Kernel to retire it (api retire-ask --dispatch <id> --reason ...) and take the decision itself or bring it to you as a delegated ruling you record; a credential/handover ask stays and is named in the owner digest',
  'unread-peer': 'notify the Kernel to read api inbox and act on the message',
  undispatched: 'ready work is not dispatched: wake the Kernel (notify.mjs, [supervisor] dispatch <job>); a repeat is a wake defect - open a lane fix',
  'dead-worker': 'notify the Kernel to reconcile (api reconcile --job <id> --dead-worker [--settle-failed]); its Kernel dead or gated: run that reconcile yourself',
  'dead-kernel': 'replace the Kernel: node scripts/kernel/resume-all.mjs (its watchdog replaces a dead Kernel), else start-workflow --goal',
  orphaned: 'wake the Kernel to name its next step; a plan that cannot continue: request a re-plan (define-goal --revise path) or archive --by supervisor',
  stalled: 'read api status; actionable -> wake the Kernel; held by a stale gate/wait -> that item; unexplained -> diagnose',
  'contract-stale': 'notify the Kernel to re-read the changed runtime files and api kernel-ack-rev --rev <sha>',
  'experiment-revert': 'a self-learning experiment measured no improvement or a regression: node scripts/supervisor/lessons.mjs revert --experiment <id> --apply (a revert lane through the land gate), which records "did not work"',
  'push-refused': 'classify (secret / lint / test / hook) from the refusal and route the fix to a lane; a secret is removed from history in a lane, never pushed',
});

const RETRY_PATTERNS = new Set(['retry-loop', 'repeat-check', 'reroute-loop', 'repeat-reject', 'worker-died']);
// A retry cap a Kernel recorded as an incident (route failed-retries-the-same-op, "fired 3 of 3", attempt caps).
const RETRY_CAP_TEXT = /failed-retries|retr(?:y|ies) cap|attempt cap|max(?:imum)? (?:retries|attempts)|fired \d+ of \d+ times/i;
const key = (...parts) => parts.filter((p) => p != null && p !== '').join('|');
const one = (s, n = 220) => clipLine(String(s ?? '').replace(/\s+/g, ' '), n);

/** Push refusal class from its text: secret | lint | test | hook | other. Pure. */
export function pushClass(p) {
  if (p?.scan?.findings?.length || /secret/i.test(String(p?.refused ?? ''))) return 'secret';
  const t = `${p?.refused ?? ''} ${p?.error ?? ''} ${p?.hooks ?? ''}`;
  if (/eslint|lint|prettier|sonar/i.test(t)) return 'lint';
  if (/\btests?\b|spec|node --test|jest|vitest|assert/i.test(t)) return 'test';
  if (/hook|pre-push/i.test(t)) return 'hook';
  return 'other';
}

/**
 * The owed actions of one tick. Pure over what the tick read: `clusters` (cluster.mjs), `stalls` (stall.mjs findings,
 * every ledger), `flows` (tick flows: workflows with their frontier, deadKernels, orphaned), `pushes` (push-mains).
 * Returns [{key, class, workflowId, repo, subject, evidence, do}]; one item per root cause (an incident a cluster
 * already carries is never listed again as a gate).
 */
export function owedActions({ clusters = [], stalls = [], flows = {}, pushes = [], stuck = [], revertDue = [], progress = [] } = {}) {
  const out = [];
  const add = (item) => { if (!out.some((x) => x.key === item.key)) out.push({ ...item, do: item.do ?? CLASSES[item.class] }); };
  // Outcome first (scripts/supervisor/progress-watch.mjs): stalls past the Kernel's grace, runtime RCA clusters, kernel proposals.
  for (const item of progress) add(item);
  const inCluster = new Set(clusters.flatMap((c) => c.incidents ?? []));
  for (const c of clusters) {
    const retry = ((c.items ?? []).length > 0 && c.items.every((i) => RETRY_PATTERNS.has(i.pattern))) || RETRY_CAP_TEXT.test(`${c.id} ${c.summary ?? ''}`);
    add({ key: key('owed', c.id), class: c.fixedBy ? 'fixed-defect' : retry ? 'retry-cap' : 'runtime-defect', workflowId: c.workflows?.join(',') ?? null,
      repo: c.items?.[0]?.repo ?? null, subject: c.id, incidents: c.incidents ?? [], fixedBy: c.fixedBy ?? null, size: c.size ?? (c.items ?? []).length,
      lastAt: Math.max(0, ...(c.items ?? []).map((i) => Number(i.lastFailureAt ?? i.updatedAt ?? i.raisedAt ?? 0))) || null,
      evidence: one(`${c.size} item(s), oldest ${c.oldestMin}m${c.fixedBy ? `, fixed-by ${c.fixedBy.slice(0, 9)}?` : ''}: ${c.summary}`) });
  }
  const frontierOf = new Map((flows.workflows ?? []).map((w) => [w.workflowId, w]));
  for (const f of stalls) {
    const wf = f.workflowId;
    if (f.incidentId && inCluster.has(f.incidentId)) continue;
    if (f.type === 'STALE-GATE' || f.type === 'STALE-WAIT') add({ key: key('gate', wf, f.incidentId ?? f.jobId), class: 'stale-gate', workflowId: wf, repo: f.repo, subject: f.incidentId ?? f.jobId, evidence: one(f.line) });
    else if (f.type === 'STALE-PEER-WAIT') add({ key: key('peer', wf, f.incidentId), class: 'peer-wait', workflowId: wf, repo: f.repo, subject: f.incidentId, peer: f.peer ?? null, evidence: one(f.line) });
    else if (f.type === 'UNREAD-PEER') add({ key: key('unread', wf, f.peerMessage), class: 'unread-peer', workflowId: wf, repo: f.repo, subject: f.peerMessage, evidence: one(f.line) });
    else if (f.type === 'GATE' && !f.young && !(f.asks?.length) && !(f.waits?.length) && !OWNER_ONLY.test(f.text ?? ''))
      add({ key: key('gate', wf, f.incidentId), class: 'owner-gate-no-ask', workflowId: wf, repo: f.repo, subject: f.incidentId, evidence: one(f.line) });
    else if (f.type === 'STALLED' && f.alert !== false) {
      const fr = frontierOf.get(wf);
      const ready = fr?.ready > 0 || f.actionable === true;
      add({ key: key(ready ? 'dispatch' : 'stalled', wf), class: ready ? 'undispatched' : 'stalled', workflowId: wf, repo: f.repo, subject: wf, evidence: one(f.line) });
    }
  }
  for (const w of flows.workflows ?? []) {
    if (w.error) continue;
    for (const j of [...(w.deadWorkerJobs ?? []), ...(w.wedgedJobs ?? [])])
      add({ key: key('worker', w.workflowId, j), class: 'dead-worker', workflowId: w.workflowId, repo: w.repo, subject: j, evidence: `api status lists ${j} dead or wedged` });
    if (w.ownerAsks?.length) add({ key: key('ask', w.workflowId), class: 'owner-ask', workflowId: w.workflowId, repo: w.repo, subject: w.ownerAsks.join(','),
      evidence: `${w.ownerAsks.length} pending non-credential owner ask(s): ${w.ownerAsks.slice(0, 4).join(', ')}` });
    if (w.kernelRevStale) add({ key: key('rev', w.workflowId), class: 'contract-stale', workflowId: w.workflowId, repo: w.repo, subject: w.kernelRevStale.current ?? null,
      evidence: one(`kernel read rev ${String(w.kernelRevStale.acked ?? '?').slice(0, 9)}, runtime is ${String(w.kernelRevStale.current ?? '?').slice(0, 9)} (${w.kernelRevStale.fileCount ?? 0} changed file(s))`) });
  }
  for (const k of flows.deadKernels ?? []) add({ key: key('kernel', k.workflowId), class: 'dead-kernel', workflowId: k.workflowId, repo: k.repo, subject: k.workflowId, evidence: `watchdog read ${k.action} x${k.count}` });
  for (const o of flows.orphaned ?? []) add({ key: key('orphaned', o.workflowId), class: 'orphaned', workflowId: o.workflowId, repo: o.repo, subject: o.workflowId, evidence: one(o.reason) });
  // op-metrics stuck waits past their SLA (api status stuck[], lane op-telemetry): only what no finding above names.
  const STUCK_CLASS = { 'owner-gate': 'owner-gate-no-ask', 'peer-wait': 'peer-wait', dependency: 'peer-wait', 'retry-cap': 'retry-cap', 'deferred-settle': 'stalled', 'queued-ready': 'undispatched', throttled: 'stalled' };
  for (const s of stuck) {
    const cls = STUCK_CLASS[s.kind];
    if (!cls || s.owner === 'owner' || (s.incidentId && (inCluster.has(s.incidentId) || out.some((x) => x.subject === s.incidentId)))) continue;
    if (cls === 'undispatched' && out.some((x) => x.key === key('dispatch', s.workflowId))) continue;
    add({ key: key('stuck', s.workflowId, s.kind, s.incidentId ?? s.jobId), class: cls, workflowId: s.workflowId, repo: s.repo ?? null, subject: s.incidentId ?? s.jobId ?? s.workflowId,
      evidence: one(`${s.severity ?? ''} ${s.kind}${s.cause && s.cause !== s.kind ? `/${s.cause}` : ''} for ${Math.round(Number(s.ageMs ?? 0) / 60_000)}m${s.detail ? `: ${s.detail}` : ''}`) });
  }
  for (const e of revertDue) add({ key: key('experiment', e.id), class: 'experiment-revert', workflowId: null, repo: null, subject: e.id,
    evidence: one(`${e.signature}: ${(e.commits ?? []).map((c) => c.slice(0, 9)).join(',')} - ${e.result?.reason ?? 'measured no improvement'}`) });
  for (const p of pushes) {
    if (p.pushed || p.skipped || p.deferred || p.wouldPush || (!p.refused && !p.error && p.hooks !== 'red' && p.hooks !== 'failed')) continue;
    const cls = pushClass(p);
    add({ key: key('push', path.basename(p.repo ?? ''), cls), class: 'push-refused', workflowId: null, repo: p.repo, subject: cls,
      evidence: one(`${cls}: ${p.refused ?? p.error ?? p.hooks}${(p.scan?.findings ?? []).map((f) => ` [${f.file}:${f.line ?? '-'} ${f.pattern}]`).join('')}`) });
  }
  return out;
}

/** The newest action time per item key and per workflow notice (since `since`): {byKey, byWorkflow}. */
export function actedOf(db, { since = 0 } = {}) {
  const byKey = {}, byWorkflow = {};
  const rows = db.prepare('SELECT kind, entity_id, payload_json, created_at FROM events WHERE workflow_id=? AND kind IN (?,?) AND created_at>=? ORDER BY seq')
    .all(SUPERVISOR_WF, ACTION_KIND, NOTICE_KIND, since);
  for (const r of rows) {
    const p = parseJsonOr(r.payload_json, {}) ?? {};
    if (r.kind === ACTION_KIND && p.item) byKey[p.item] = { at: r.created_at, action: p.action ?? null, reason: p.reason ?? null, ...(Number.isFinite(p.until) ? { until: p.until } : {}) };
    if (r.kind === NOTICE_KIND && p.delivered) { byWorkflow[p.workflowId ?? r.entity_id] = r.created_at; if (p.item) byKey[p.item] = { at: r.created_at, action: 'notify', reason: null }; }
  }
  return { byKey, byWorkflow };
}

/**
 * The SLA over `items`: {items: [{...item, firstSeenAt, ageMin, actedAt, breach}], seen}. `seen` keeps only the keys
 * seen now (a cleared item starts over). An item counts as acted when an action names it, or a delivered notice went
 * to its workflow, after it was first seen. An action recorded with `until` (a standing ruling that holds the item,
 * e.g. an owner-ordered hold) keeps it out of SLA-BREACH until then; it is still listed, as held. Pure.
 */
export function withSla(items, { seen = {}, acted = { byKey: {}, byWorkflow: {} }, now = Date.now(), slaMs }) {
  const next = {};
  const out = items.map((i) => {
    const firstSeenAt = seen[i.key] ?? now;
    next[i.key] = firstSeenAt;
    const byKey = acted.byKey[i.key]?.at ?? null;
    const byWf = String(i.workflowId ?? '').split(',').map((wf) => acted.byWorkflow[wf] ?? null).filter(Boolean);
    const actedAt = [byKey, ...byWf].filter((t) => t != null && t >= firstSeenAt).sort((a, b) => b - a)[0] ?? null;
    const lastTouch = actedAt ?? firstSeenAt;
    const until = actedAt != null && acted.byKey[i.key]?.at === actedAt ? acted.byKey[i.key]?.until ?? null : null;
    const heldUntil = until != null && until > now ? until : null;
    return { ...i, firstSeenAt, ageMin: Math.round((now - firstSeenAt) / 60_000), actedAt, ...(heldUntil ? { heldUntil } : {}),
      breach: heldUntil == null && now - lastTouch > slaMs };
  });
  return { items: out, seen: next };
}

export const actionLine = (i) => `OWED-ACTION ${i.breach ? 'SLA-BREACH ' : ''}[${i.class}] ${i.key} age=${i.ageMin}m ${i.actedAt ? `acted ${hhmm(i.actedAt)}${i.heldUntil ? ` held until ${hhmm(i.heldUntil)}` : ''}` : 'no action yet'}: ${i.evidence}\n    do: ${i.do}${(i.lessons ?? []).map((l) => `\n    lesson: ${l}`).join('')}`;

/** The longest an action may hold its item out of SLA-BREACH: a hold is re-affirmed at least this often. */
export const MAX_HOLD_MS = 12 * 3_600_000;

/**
 * Record one supervisor action (the audit trail every action leaves). `until` (epoch ms) marks a standing ruling that
 * holds the item - it stays out of SLA-BREACH until then, at most MAX_HOLD_MS from now.
 */
export function recordAction({ item, action, reason, workflowId = null, refs = [], until = null, by = 'supervisor', env = process.env, now = Date.now() }) {
  if (!item || !action || !String(reason ?? '').trim()) throw Object.assign(new Error('record needs --item, --action and --reason'), { code: 'action-incomplete' });
  if (until != null && !(Number.isFinite(until) && until > now)) throw Object.assign(new Error('--until/--hold-ms must name a time after now'), { code: 'action-until-invalid' });
  const heldUntil = until == null ? null : Math.min(until, now + MAX_HOLD_MS);
  const ledger = openSupervisorLedger({ env });
  try {
    ledger.transaction(() => supervisorEvent(ledger, { entityType: 'action', entityId: item, kind: ACTION_KIND, now,
      payload: { item, action, reason: one(reason, 600), workflowId, refs, by, ...(heldUntil ? { until: heldUntil } : {}) } }));
  } finally { ledger.close(); }
  supLog(actionRow({ item, action, reason: one(reason, 600), workflowId, refs, at: now }), { env });
  return { ok: true, item, action, at: now, ...(heldUntil ? { until: heldUntil } : {}) };
}

/** The newest owed-actions record the tick left: {at, items} or null. */
export const latestOwedActions = ({ env = process.env } = {}) => withSupervisorRead((db) => {
  const r = db.prepare('SELECT created_at, payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(SUPERVISOR_WF, OWED_ACTIONS_KIND);
  return r ? { at: r.created_at, ...(parseJsonOr(r.payload_json, {}) ?? {}) } : null;
}, null, { env });

/* ------------------------------------------------------------ the owner's digest */

const T = {
  en: { head: 'StarCi supervisor digest', fixed: 'Handled', open: 'Still being handled', none: 'nothing new', wf: 'Workflows', owner: 'Waiting on you (credentials / handover only)' },
  vi: { head: 'StarCi supervisor - báo cáo định kỳ', fixed: 'Đã xử lý', open: 'Đang xử lý', none: 'không có gì mới', wf: 'Workflows', owner: 'Chờ bạn (chỉ credentials / bàn giao)' },
};

/** The digest text from the ledger (actions since `since`, the newest owed actions). Pure over its inputs. */
export function digestText({ actions = [], owed = null, learning = [], trend = null, gc = null, progress = [], language = 'en', now = Date.now() }) {
  const t = T[language] ?? T.en;
  const lines = [`${t.head} ${stampMinute(now)}`];
  // Outcome first: progress per workflow, priority first, and why it is slow (progress-watch.mjs).
  if (progress?.length) lines.push(...progress);
  // The op-health trend line (op-metrics.mjs trendLine, from the tick's supervisor-op-metrics snapshots).
  if (trend) lines.push(trend);
  // The garbage collection since the last digest, one line (gc.mjs gcLine; owner 2026-09-28).
  if (gc) lines.push(gc);
  lines.push(`${t.fixed} (${actions.length}):${actions.length ? '' : ` ${t.none}`}`);
  for (const a of actions.slice(-12)) lines.push(`- ${a.action} ${a.item}: ${one(a.reason, 140)}`);
  const items = owed?.items ?? [];
  const open = items.filter((i) => !i.actedAt);
  lines.push(`${t.open}: ${items.length} (${open.length} ${language === 'vi' ? 'chưa có hành động' : 'not yet acted on'})`);
  const byClass = {};
  for (const i of items) byClass[i.class] = (byClass[i.class] ?? 0) + 1;
  if (items.length) lines.push(`  ${Object.entries(byClass).map(([c, n]) => `${c} ${n}`).join(', ')}`);
  if (owed?.workflows?.length) {
    lines.push(`${t.wf}:`);
    for (const w of owed.workflows) lines.push(`- ${w.workflowId}: ${w.state ?? w.error ?? '?'}${w.ready ? `, ${w.ready} ready` : ''}`);
  }
  if (learning?.length) lines.push(...learning);
  if (owed?.ownerWaits?.length) { lines.push(`${t.owner}:`); for (const o of owed.ownerWaits) lines.push(`- ${o}`); }
  return lines.join('\n');
}

/**
 * Build and (with send) push the owner's digest - at most once per allocation.supervisorTick.ownerDigestMs unless
 * `force`. {ok, sent, skipped?, text}. `push` is stall-alert.mjs ownerPush (Telegram); the text is also recorded.
 */
export async function ownerDigest({ send = false, force = false, env = process.env, now = Date.now(), everyMs, push = null, language = null }) {
  const read = withSupervisorRead((db) => {
    const last = db.prepare('SELECT created_at FROM events WHERE workflow_id=? AND kind=? ORDER BY seq DESC LIMIT 1').get(SUPERVISOR_WF, DIGEST_KIND)?.created_at ?? 0;
    const actions = db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? AND created_at>? ORDER BY seq').all(SUPERVISOR_WF, ACTION_KIND, last)
      .map((r) => parseJsonOr(r.payload_json, {}) ?? {});
    // What the tick GC collected since the last digest (supervisor-gc events, tick.mjs).
    const gcRuns = db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? AND created_at>? ORDER BY seq').all(SUPERVISOR_WF, 'supervisor-gc', last)
      .map((r) => parseJsonOr(r.payload_json, {}) ?? {});
    return { last, actions, gcRuns };
  }, { last: 0, actions: [], gcRuns: [] }, { env });
  let learning = [];
  try { const l = await import('./lessons.mjs'); learning = l.learningDigest(l.readLearning({ env }), { since: read.last }); } catch { /* the digest goes without it */ }
  const lang = language ?? supervisorSettings().language;
  let trend = null;
  try { trend = await (await import('./op-metrics.mjs')).currentTrend({ env, language: lang }); } catch { /* the digest goes without it */ }
  let progress = [];
  try { progress = (await import('./progress-watch.mjs')).progressDigestLines({ env, language: lang }); } catch { /* the digest goes without it */ }
  let gc = null;
  if (read.gcRuns?.length) {
    const sum = (k) => read.gcRuns.reduce((n, r) => n + (Number(r[k]) || 0), 0);
    try { gc = (await import('./gc.mjs')).gcLine({ agents: sum('agents'), terminals: sum('terminals'), worktrees: sum('worktrees'), freedBytes: sum('freedBytes'), ramFreedBytes: sum('ramFreedBytes') }, { language: lang }); } catch { gc = null; }
  }
  const text = digestText({ actions: read.actions, owed: latestOwedActions({ env }), learning, trend, gc, progress, language: lang, now });
  if (!send) return { ok: true, sent: false, text };
  if (!force && read.last && now - read.last < everyMs) return { ok: true, sent: false, skipped: `last digest ${Math.round((now - read.last) / 60_000)}m ago`, text };
  const pushFn = push ?? (await import('./stall-alert.mjs')).ownerPush;
  const r = await pushFn(text, { env });
  const ledger = openSupervisorLedger({ env });
  try { ledger.transaction(() => supervisorEvent(ledger, { entityType: 'digest', kind: DIGEST_KIND, now, payload: { actions: read.actions.length, telegram: r } })); }
  finally { ledger.close(); }
  supLog({ kind: 'narration', at: now, level: r.ok === false ? 'warn' : 'info', msg: `owner digest ${r.ok === false ? 'FAILED' : r.skipped ? `not sent (${r.skipped})` : 'sent'}: ${read.actions.length} action(s)`, data: { markdown: text } }, { env });
  return { ok: r.ok !== false, sent: r.ok !== false && !r.skipped, telegram: r, text };
}

if (process.argv[1] && path.resolve(process.argv[1]) === selfFile) {
  const argv = process.argv.slice(2);
  const verb = argv[0];
  const value = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] ?? null : null; };
  const asJson = argv.includes('--json');
  try {
    if (verb === 'list') {
      const r = latestOwedActions() ?? { at: null, items: [] };
      const items = argv.includes('--open') ? (r.items ?? []).filter((i) => !i.actedAt || i.breach) : (r.items ?? []);
      if (asJson) console.log(JSON.stringify({ ...r, items }));
      else {
        console.log(`owed actions of the tick at ${r.at ? new Date(r.at).toISOString() : '(no tick yet)'}: ${items.length} item(s), ${items.filter((i) => i.breach).length} past the SLA`);
        for (const i of items) console.log(actionLine(i));
      }
    } else if (verb === 'record') {
      const until = value('until') ? Date.parse(value('until')) : value('hold-ms') ? Date.now() + Number(value('hold-ms')) : null;
      const r = recordAction({ item: value('item'), action: value('action'), reason: value('reason'), workflowId: value('workflow'), refs: (value('refs') ?? '').split(',').filter(Boolean), until });
      console.log(asJson ? JSON.stringify(r) : `recorded ${r.action} on ${r.item}${r.until ? ` (held until ${new Date(r.until).toISOString()})` : ''}`);
    } else if (verb === 'digest') {
      const { tickSettings } = await import('./tick-duties.mjs');
      const r = await ownerDigest({ send: argv.includes('--send'), force: argv.includes('--force'), everyMs: tickSettings().ownerDigestMs });
      console.log(asJson ? JSON.stringify(r) : `${r.text}\n-- ${r.sent ? 'sent' : r.skipped ? `not sent: ${r.skipped}` : 'not sent (preview; --send pushes it)'}`);
      if (r.ok === false) process.exitCode = 1;
    } else {
      console.error('use: actions.mjs list [--json] [--open] | record --item <key> --action <verb> --reason <text> [--workflow <id>] [--refs <csv>] [--until <iso> | --hold-ms <ms>] | digest [--send] [--force] [--json]');
      process.exitCode = 2;
    }
  } catch (error) {
    console.error(`actions: ${error?.message ?? error}`);
    process.exitCode = error?.code === 'action-incomplete' ? 2 : 1;
  }
}
