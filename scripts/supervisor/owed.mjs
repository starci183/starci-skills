#!/usr/bin/env node
// owed.mjs — what the running workflows wait on the SUPERVISOR for.
//
// Owner, 2026-09-24: "supervisor phải xử lý các conflict, chỉnh grammar, sửa lint, xác định vấn đề
// out of scope workflow ... để sửa hết không? ... chứ để workflows stale/block/kẹt chờ sai là lỗi của
// supervisor". That day the three ledgers' running workflows held ~90 open incidents addressed to the
// supervisor, the runtime monitor or Source ("For the supervisor", "cần supervisor", "runtime
// monitor", source-runtime-defect, knowledge churn, cross-workflow git effects, delegated rulings),
// many already fixed by later .claude commits and never resolved, others still blocking. Nothing
// surfaced them: poll printed a RUNTIME line only for a fixed list of kinds.
//
// Classification is by ELIMINATION, never by keyword: every open incident of a running, unarchived
// workflow is exactly one of
//   owner        an open owner ask it names or holds on, or an owner-gate whose condition only the
//                owner can meet (credentials the runtime cannot mint, push/publish approval,
//                handover, payment/legal)
//   peer         a typed wait the runtime re-checks (--until-*), a peer-wait whose peer is running
//                and moving, an owner-gate waiting on a record a named running peer still owes
//   kernel       what its own Kernel fixes with api verbs: a stale gate or peer-wait (the stall wake
//                carries it), a misfiled peer gate, a typed wait that can no longer be met, and the
//                Kernel's informational notes (plan/ruling records that hold nothing)
//   in-progress  raised inside the grace window, or a typed wait whose conditions already hold
//   supervisor   EVERYTHING ELSE: free-text incidents with no typed release that stay open, runtime
//                and Source defects, checker breakage, contract contradictions, knowledge churn,
//                cross-workflow effects, host/tool breakage, owner-gates with no owner ask, delegated
//                decisions. These are OWED.
// Keyword rules only ADD labels (and pull a note that addresses the supervisor back into OWED);
// they never take an item out of it. Beside the incidents, patterns with no incident at all are
// OWED too: the same check failing on 2+ attempts of one retry chain, 3+ failed attempts in a row
// since a chain's last success, 2+ workers of one provider dying without a report inside 6 h, 2+
// identical dispatch rejects inside 2 h, a queued job re-routed 4+ times, settled work re-staled by
// a law-input change.
//
// Each OWED incident is linked to the .claude commit that likely fixed it: a commit after the
// incident whose message cites its id (or an incident it cites), else one whose message shares its
// distinctive tokens (file names, identifiers, kind words). `fixed-by <sha>?` means the supervisor
// verifies the fix and tells the owning Kernel to resolve the incident; `open` means the supervisor
// fixes it now (modules/supervisor/supervise.yaml step owed).
//
//   node scripts/supervisor/owed.mjs [--repo <path>]... [--workflow <id>]... [--all] [--json]
//
// Read-only: ledgers are opened with inspectLedger, git is read with `git log`. poll.mjs prints the
// OWED lines every cycle; stall-alert.mjs sends OWED items older than 15 min to the supervisor inbox
// (OWED-ALERT).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../engine/config.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/ledger-db.mjs';
import { evaluateTypedIncidents } from '../kernel/gate-conditions.mjs';
import { staleInputs, staleOperationsOf } from '../kernel/input-digests.mjs';
import {
  GATE_GRACE_MS, DEFAULT_STALL_MINUTES, ownerGates, peerWaits, judgeGate, judgePeerWait,
  openAskDispatches, runningWorkflows, namedWorkflows,
} from './stall.mjs';

export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CLASSES = Object.freeze({ owner: 'owner', peer: 'peer', kernel: 'kernel', progress: 'in-progress', supervisor: 'supervisor' });
/** An OWED item older than this goes to the supervisor inbox (stall-alert.mjs OWED-ALERT). */
export const OWED_ALERT_MS = 15 * 60_000;
export const RETRY_LOOP_MIN = 4;
export const REROUTE_MIN = 4;
export const WORKER_DIED_WINDOW_MS = 6 * 60 * 60_000;
export const REJECT_WINDOW_MS = 2 * 60 * 60_000;
/** A failed retry chain older than this is history, not a pattern. */
export const CHAIN_WINDOW_MS = 24 * 60 * 60_000;
const OPEN_JOB = ['queued', 'leased', 'running', 'answering'];

const parse = (text, fallback = {}) => { try { return JSON.parse(text) ?? fallback; } catch { return fallback; } };
const clip = (text, n) => { const s = String(text ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
const minutes = (ms) => Math.max(0, Math.round(ms / 60_000));
const kindOf = (lastProgress) => /^\[([^\]]+)\]/.exec(lastProgress ?? '')?.[1] ?? null;
const bodyOf = (lastProgress) => String(lastProgress ?? '').replace(/^(?:\[[^\]]+\]\s*)+/, '');

/* ------------------------------------------------------------ declared types and labels */

/**
 * Kernel note kinds: records of a plan, a cut, a ruling or a decision already taken. They hold
 * nothing (only owner-gate and peer-wait kinds hold jobs), so they are their Kernel's to resolve
 * when done - unless the note addresses the supervisor (SUPERVISOR_ADDRESSED), which makes it OWED.
 */
export const NOTE_KIND = /^(?:plan|plan-note|replan-note|scope-decision|owner-ruling|owner-directed-leg|grammar-bump-planned|stall-explanation|cut-decomposition|spec-consistency-followup|kernel-gate|experiment-note)$|-note$|-decomposition$|-refinement$/;
/** Text that addresses or waits on the supervisor, the runtime monitor, Source or the file owner. */
export const SUPERVISOR_ADDRESSED = /\b(?:for|to|ask(?:s|ing)?|needs?|awaiting|awaits?|waits? (?:on|for))\s+(?:the\s+)?(?:supervisor|runtime monitor|source|file owner)\b|\b(?:cho|cần|chờ|đợi|phản hồi(?: của)?|hỏi)\s+supervisor\b|\bsupervisor\s*(?:\/|hoặc|or)\s*(?:chủ sở hữu|owner)|(?:chủ sở hữu|owner)\s*(?:hoặc|or|\/)\s*supervisor\b|\bruntime monitor\b|\boutside (?:my |the kernel'?s |kernel |its )?authority\b|ngoài thẩm quyền/i;
/** An owner-gate condition only the owner can meet (owner, 2026-09-24: everything else is the supervisor's). */
export const OWNER_ONLY = /\bcredentials?\b|\bcreds\b|\bsecrets?\b|\bpasswords?\b|\bapi[- ]?keys?\b|\boauth\b|\bconsent\b|\bpayments?\b|\bbilling\b|\blegal\b|\bpush(?:ing)? to (?:a |the )?remote\b|\bpublish(?:ing)?\b|\bhandover\b|bàn giao|mật khẩu|thanh toán/i;
/** Peer-dependency wording on an owner gate (stall-alert.mjs PEER_DEPENDENCY): a misfiled peer-wait. */
const PEER_DEPENDENCY = /\bpeer(?:[- ]dependen\w*| workflow)\b|\bnot an owner (?:step|decision|gate)\b/i;

/** Labels only ever add information: [label, test(kind, text)]. */
const LABEL_RULES = [
  ['addressed-to-supervisor', (k, t) => SUPERVISOR_ADDRESSED.test(t)],
  ['runtime', (k, t) => /runtime|source|liveness|nudge|op-boundary|provider|launch|environment|api-/.test(k) || /\b(?:scripts|engine|modules|knowledge|bin)\/[\w./-]+|\.claude\b|\bSource\b/.test(t)],
  ['liveness', (k, t) => /liveness|nudge|idle/.test(k) || /\bturn-idle\b|\bnudge-ready\b|\bliveness\b/i.test(t)],
  ['worker-died', (k, t) => /died|exited|no-report|missing-report|without-report|turn-cap/.test(k) || /without (?:filing )?(?:a |an )?(?:api )?report|bare PowerShell prompt|không nộp report/i.test(t)],
  ['checker', (k, t) => /checker|lint|quality-gate/.test(k) || /status[= ]unavailable|check-scoped-lint|code-patterns-check|\bsonar\b/i.test(t)],
  ['knowledge-churn', (k, t) => /stale|churn|baseline|rollout/.test(k) || /staleOperations|staleInput|knowledge\/[\w.-]+\.ya?ml/i.test(t)],
  ['contract-conflict', (k, t) => /contradict|conflict|divergence|read-race/.test(k) || /mâu thuẫn|contradict/i.test(t)],
  ['cross-workflow', (k, t) => /cross|foreign|shared|history|unowned|env-/.test(k) || /git reset|\brebase\b|\bamend\b|reflog/i.test(t)],
  ['host-tooling', (k, t) => /inbox|orchestration|host|unbridged|release|reap/.test(k) || /\bENOBUFS\b|orca(?:\.exe)? |managedWorker/i.test(t)],
  ['decision', (k, t) => /decision|delegat|ruling|scope-gap|design-gap|srs-gap|account-gap|owner-gate/.test(k) || /ủy quyền|uỷ quyền|\bdelegat|quyết\b/i.test(t)],
  ['grammar', (k, t) => /grammar/.test(k) || /@starci\/grammar/.test(t)],
];
export const labelsOf = (kind, text) => LABEL_RULES.filter(([, test]) => test(String(kind ?? ''), String(text ?? ''))).map(([name]) => name);

/** What the supervisor does about one OWED item, by what it is (the owner's grant: fix it, never ask). */
export function actionOf(item) {
  const wf = item.workflowId, id = item.incidentId;
  if (item.fixedBy) return `verify ${item.fixedBy.sha.slice(0, 9)} fixed it, then tell ${wf}'s Kernel: api incident --workflow ${wf} --resolve ${id} --detail "fixed by .claude ${item.fixedBy.sha.slice(0, 9)}: <what changed>" (else fix it now)`;
  const l = new Set(item.labels ?? []);
  if (item.pattern) {
    switch (item.pattern) {
      case 'stale-input': return l.has('knowledge-churn')
        ? 'Source knowledge/schema churn re-staled settled work: register the edit in modules/kernel/contract-changes.yaml (reach new-legs; follow-up only when in-flight work must catch up) or revert it; settled legs keep the law they were admitted under (guardrail source-knowledge-edits)'
        : 'product records another leg or workflow rewrote re-staled settled work: confirm the redo is real and tell the Kernel, or settle the cross-workflow churn at its source';
      case 'worker-died': return 'provider/launcher defect: fix the launch or liveness path in .claude, or route that provider off the op, then tell the Kernel how to retry';
      case 'repeat-reject': return 'the same dispatch step keeps refusing: fix the launcher/host step in .claude, then tell the Kernel to re-dispatch';
      case 'reroute-loop': return 'routing loops on one job: fix the route inputs or pools in .claude, or give the Kernel an exact route disposition';
      default: return 'a repeated failure is systemic: find what the contract, checker or grant gets wrong and fix it in .claude (or give the Kernel the exact redo), never another blind retry';
    }
  }
  if (id && item.class === CLASSES.supervisor && (item.kind === 'owner-gate' || item.kind === 'owner-gate-pending')) return `an owner gate with no owner ask: decide it under the owner's delegated authority (or have ${wf}'s Kernel park a real owner ask when it is a product decision the owner kept), then tell the Kernel to resolve ${id}`;
  if (l.has('cross-workflow')) return `resolve the cross-workflow effect (custody, history, shared env) between the workflows involved, notify both Kernels, then have ${wf}'s Kernel resolve ${id}`;
  if (l.has('knowledge-churn')) return `settle the knowledge/contract change (contract-changes.yaml reach, or revert) so settled work is not re-staled, then tell ${wf}'s Kernel to resolve ${id}`;
  if (l.has('contract-conflict')) return `make the conflicting contracts/schemas agree in .claude, commit, then tell ${wf}'s Kernel to resolve ${id}`;
  if (l.has('decision')) return `take the delegated decision (owner's grant), record it, and tell ${wf}'s Kernel to resolve ${id} with the ruling`;
  if (l.has('checker') || l.has('grammar')) return `fix the shared checker/tooling/grammar in .claude, commit, then tell ${wf}'s Kernel to resolve ${id}`;
  if (l.has('runtime') || l.has('liveness') || l.has('worker-died') || l.has('host-tooling')) return `fix the runtime defect in .claude, commit, then tell ${wf}'s Kernel to resolve ${id}`;
  return `diagnose it now: fix .claude or give ${wf}'s Kernel an exact disposition, then have it resolve ${id} (never forward to the owner)`;
}

/* ------------------------------------------------------------ fixed-by linking */

const TOKEN_STOP = new Set(['runtime', 'source', 'defect', 'contract', 'worker', 'workers', 'kernel', 'issue', 'note', 'plan', 'gap', 'for', 'the', 'and',
  'with', 'from', 'into', 'this', 'that', 'owner', 'supervisor', 'workflow', 'status', 'report', 'escalation', 'recurrence', 'second', 'third', 'fourth',
  'read-only', 'follow-up', 'self-heal', 'index', 'index.yaml', 'readme']);

/** Distinctive tokens of an incident: [{token, weight}] (file names and identifiers 2, kind words and plain compounds 1). */
export function fixTokens(kind, text) {
  const out = new Map();
  const add = (token, weight) => {
    const t = String(token).toLowerCase();
    if (t.length < 4 || TOKEN_STOP.has(t)) return;
    out.set(t, Math.max(out.get(t) ?? 0, weight));
  };
  const body = String(text ?? '');
  for (const m of body.matchAll(/[\w@.[\]-]*(?:\/[\w@.[\]-]+)+\.(?:mjs|js|ts|tsx|yaml|yml|json|md)\b/g)) {
    const base = m[0].split('/').pop();
    add(base, 2); add(base.replace(/\.[a-z]+$/i, ''), 2);
  }
  for (const m of body.matchAll(/(?<![\w./-])[\w-]+\.(?:mjs|yaml|yml)\b/g)) { add(m[0], 2); add(m[0].replace(/\.[a-z]+$/i, ''), 2); }
  for (const m of body.matchAll(/\b[A-Z][A-Z0-9]*_[A-Z0-9_]+\b|\bE[A-Z]{4,}\b/g)) add(m[0], 2);
  for (const m of body.matchAll(/\b[a-z]+[A-Z][A-Za-z]{3,}\b/g)) if (m[0].length >= 8) add(m[0], 2);
  for (const m of body.matchAll(/\b[a-z][a-z0-9]*(?:-[a-z0-9]+)+\b/g)) {
    if (/^(?:op|ctx|term|inc|wf|pm|task|run)-/.test(m[0])) continue;
    add(m[0], (m[0].match(/-/g) ?? []).length >= 2 ? 2 : 1);
  }
  for (const word of String(kind ?? '').split('-')) add(word, 1);
  return [...out].map(([token, weight]) => ({ token, weight }));
}

const dfMemo = new WeakMap();
/** How many of `commits` mention a token (memoized per commit list). */
const documentFrequency = (commits) => {
  if (!dfMemo.has(commits)) dfMemo.set(commits, new Map());
  const memo = dfMemo.get(commits);
  return (token) => {
    if (!memo.has(token)) memo.set(token, commits.reduce((n, c) => n + ((c.lower ?? c.message.toLowerCase()).includes(token) ? 1 : 0), 0));
    return memo.get(token);
  };
};

/** Incident ids an incident's text cites (escalations, recurrences, addenda). */
export const citedIncidents = (text, own = null) => [...new Set(String(text ?? '').match(/\binc-[0-9a-f]{12}\b/g) ?? [])].filter((id) => id !== own);

/**
 * The .claude commit that likely fixed one incident: {sha, at, subject, how, tokens?} or null.
 * `how`: 'id' (the message cites the incident), 'cited-id' (it cites an incident this one escalates
 * or repeats), 'keywords' (two or more rare file-name/identifier tokens, score >= 4;
 * a token in more than 2% of the commits counts for nothing).
 */
export function linkFix({ incidentId, kind, text, raisedAt }, commits) {
  const after = commits.filter((c) => c.at > raisedAt);
  const newest = (list) => list.sort((a, b) => b.at - a.at)[0] ?? null;
  const pick = (c, how, extra = {}) => ({ sha: c.sha, at: c.at, subject: clip(c.subject, 120), how, ...extra });
  const byId = newest(after.filter((c) => c.message.includes(incidentId)));
  if (byId) return pick(byId, 'id');
  const cited = citedIncidents(text, incidentId);
  const byCited = newest(after.filter((c) => cited.some((id) => c.message.includes(id))));
  if (byCited) return pick(byCited, 'cited-id');
  // A token most commits share (index.yaml, record, work, brand) links nothing: only rare ones count.
  const df = documentFrequency(commits);
  const rareMax = Math.max(3, Math.ceil(commits.length * 0.02));
  const tokens = fixTokens(kind, text).filter((t) => (df(t.token) ?? 0) <= rareMax);
  let best = null;
  for (const c of after) {
    const lower = c.lower ?? c.message.toLowerCase();
    const found = tokens.filter((t) => lower.includes(t.token));
    // admission.mjs and admission are one piece of evidence, not two.
    const hit = found.filter((t) => !found.some((o) => o !== t && o.token.includes(t.token)));
    const score = hit.reduce((s, t) => s + t.weight, 0);
    if (score < 4 || hit.filter((t) => t.weight >= 2).length < 2) continue;
    if (!best || score > best.score || (score === best.score && c.at > best.c.at)) best = { c, score, hit };
  }
  return best ? pick(best.c, 'keywords', { tokens: best.hit.map((t) => t.token) }) : null;
}

let gitMemo = null;
/**
 * The .claude commits since `since` (ms): [{sha, at, subject, message, lower}], newest first. One
 * `git log` per minute per root; an unreadable repository is [].
 */
export function gitCommits({ root = SKILL_ROOT, since = 0, run = spawnSync, memoMs = 60_000, now = Date.now() } = {}) {
  if (gitMemo && gitMemo.root === root && gitMemo.since <= since && now - gitMemo.at < memoMs && run === spawnSync) return gitMemo.commits.filter((c) => c.at >= since);
  const r = run('git', ['-C', root, 'log', `--since=${new Date(Math.max(0, since - 60_000)).toISOString()}`, '--format=%H%x1f%ct%x1f%s%x1f%b%x1e'],
    { encoding: 'utf8', windowsHide: true, timeout: 30_000, maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) return [];
  const commits = String(r.stdout ?? '').split('\x1e').map((rec) => rec.replace(/^\s+/, '')).filter(Boolean).map((rec) => {
    const [sha, ct, subject = '', body = ''] = rec.split('\x1f');
    const message = `${subject}\n${body}`;
    return { sha, at: Number(ct) * 1000, subject, message, lower: message.toLowerCase() };
  }).filter((c) => /^[0-9a-f]{7,40}$/.test(c.sha));
  if (run === spawnSync) gitMemo = { root, since, at: now, commits };
  return commits;
}

/* ------------------------------------------------------------ the incident classification */

const raisedOf = (db, workflowId, incidentId) => db.prepare(
  "SELECT payload_json, created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq LIMIT 1").get(workflowId, incidentId);

/**
 * Every open incident of every running, unarchived workflow of one ledger, classified (CLASSES).
 * `ledgers` ([{repo, db}]) lets a gate or wait see a peer in another ledger. Returns
 * [{class, reason, workflowId, repo, incidentId, kind, labels, raisedAt, ageMin, text, summary}].
 */
export function classifyIncidents(db, { repo = null, ledgers = [], now = Date.now(), wanted = new Set(), graceMs = GATE_GRACE_MS, stallMinutes = DEFAULT_STALL_MINUTES } = {}) {
  const dbOf = (wf) => {
    for (const l of [{ repo, db }, ...ledgers]) {
      try { if (l.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(wf)) return l.db; } catch { /* closed */ }
    }
    return null;
  };
  const asksOf = (wf) => { const d = dbOf(wf); if (!d) return []; try { return openAskDispatches(d, wf).map((a) => a.dispatch_id); } catch { return []; } };
  const out = [];
  for (const w of runningWorkflows(db)) {
    const wf = w.workflow_id;
    if (wanted.size && !wanted.has(wf)) continue;
    let typed = [];
    try { typed = evaluateTypedIncidents(db, { repo, workflowId: wf }); } catch { typed = []; }
    const typedOf = new Map(typed.map((t) => [t.incidentId, t]));
    const gatesOf = new Map(ownerGates(db, wf).map((g) => [g.incidentId, g]));
    const waitsOf = new Map(peerWaits(db, wf).map((p) => [p.incidentId, p]));
    const ownAsks = asksOf(wf);
    const rows = db.prepare("SELECT incident_id, op_id, last_progress, updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at, incident_id").all(wf);
    for (const row of rows) {
      const kind = kindOf(row.last_progress);
      const text = bodyOf(row.last_progress);
      const raised = raisedOf(db, wf, row.incident_id);
      const raisedAt = raised?.created_at ?? row.updated_at;
      const base = { workflowId: wf, repo, incidentId: row.incident_id, opId: row.op_id ?? null, kind, labels: labelsOf(kind, text), raisedAt,
        ageMin: minutes(now - raisedAt), text, summary: clip(text, 200) };
      const put = (cls, reason) => out.push({ class: cls, reason, ...base });
      if (now - raisedAt < graceMs) { put(CLASSES.progress, `raised ${minutes(now - raisedAt)}m ago, inside the grace window`); continue; }
      const t = typedOf.get(row.incident_id);
      if (t) {
        if (t.met) put(CLASSES.progress, 'every typed condition holds: the runtime releases it on the next status');
        else if (t.unmeetable?.length) put(CLASSES.kernel, `typed wait can no longer be met (${clip(t.unmeetable.join('; '), 120)}): its Kernel re-points or resolves it`);
        else put(CLASSES.peer, `typed wait the runtime re-checks: ${clip(t.results.filter((r) => !r.met).map((r) => r.condition).join(' AND '), 140)}`);
        continue;
      }
      // An open owner ask this incident names (in its workflow or a peer it names) is the owner's.
      const peers = namedWorkflows(text).filter((id) => id !== wf);
      const named = new Set(String(text).match(/\bctx_[0-9a-f]{12}\b/g) ?? []);
      const openNamed = [...ownAsks, ...peers.flatMap(asksOf)].filter((d) => named.has(d));
      if (openNamed.length) { put(CLASSES.owner, `names open owner ask ${openNamed.join(', ')}`); continue; }
      const gate = gatesOf.get(row.incident_id);
      if (gate) {
        const v = judgeGate({ db, workflowId: wf, gate, repo, dbOf, now, graceMs });
        if (v.stale) put(CLASSES.kernel, `stale owner gate (stall wake): ${clip(v.reasons.join('; '), 140)}`);
        else if (v.asks.length) put(CLASSES.owner, `owner ask ${v.asks.map((a) => a.dispatchId).join(', ')} open`);
        else if (PEER_DEPENDENCY.test(gate.text)) put(CLASSES.kernel, 'an owner gate its own text calls a peer dependency: its Kernel re-records it as a peer-wait (stall wake)');
        else if (OWNER_ONLY.test(gate.text)) put(CLASSES.owner, 'an owner-only condition (credentials, push/publish, handover, payment/legal)');
        else if (v.waits.length && v.peers.some((p) => { const d = dbOf(p); const r = d?.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(p); return r && r.phase === 'running' && r.archived_at == null; })) {
          put(CLASSES.peer, `waits on a record a running peer owes: ${clip(v.waits.join(', '), 140)}`);
        } else put(CLASSES.supervisor, v.waits.length ? `owner gate waits on ${clip(v.waits.join(', '), 120)} and no running peer it names owes it` : 'owner gate with no owner ask and no owner-only condition');
        continue;
      }
      const wait = waitsOf.get(row.incident_id);
      if (wait) {
        const v = judgePeerWait({ db, workflowId: wf, wait, dbOf, now, thresholdMs: stallMinutes * 60_000, graceMs });
        if (v.unknown) put(CLASSES.supervisor, `peer-wait on ${wait.peer ?? '?'}, which is in no ledger in view`);
        else if (v.stale) put(CLASSES.kernel, `stale peer-wait (stall wake): ${clip(v.reasons.join('; '), 140)}`);
        else put(CLASSES.peer, `peer ${wait.peer} is running and moving`);
        continue;
      }
      if (kind && NOTE_KIND.test(kind) && !SUPERVISOR_ADDRESSED.test(text)) { put(CLASSES.kernel, 'informational note (holds nothing): its Kernel resolves it when done'); continue; }
      put(CLASSES.supervisor, SUPERVISOR_ADDRESSED.test(text) ? 'addressed to the supervisor/runtime/Source, no typed release' : 'no typed release, no owner ask, no peer: nobody but the supervisor moves it');
    }
  }
  return out;
}

/* ------------------------------------------------------------ patterns with no incident */

const hash = (s) => crypto.createHash('sha1').update(String(s)).digest('hex').slice(0, 8);
const pathsKey = (payload) => JSON.stringify([...(Array.isArray(payload?.owned_paths) ? payload.owned_paths : [])].map(String).sort());

/**
 * Systemic failures no incident names: [{class:'supervisor', pattern, key, workflowId, ...}].
 * `root` is the runtime root law inputs are digested from (stale-input).
 */
export function patternFindings(db, { repo = null, now = Date.now(), wanted = new Set(), root = SKILL_ROOT, staleOf = staleInputs } = {}) {
  const out = [];
  const put = (workflowId, pattern, id, since, summary, extra = {}) => out.push({
    class: CLASSES.supervisor, reason: 'repeated failure with no incident', workflowId, repo, incidentId: null, pattern, key: `pattern:${pattern}:${id}`,
    kind: `pattern:${pattern}`, labels: [pattern === 'stale-input' ? 'knowledge-churn' : pattern === 'repeat-check' ? 'checker' : 'runtime'],
    raisedAt: since, ageMin: minutes(now - since), summary: clip(summary, 220), ...extra });
  for (const w of runningWorkflows(db)) {
    const wf = w.workflow_id;
    if (wanted.size && !wanted.has(wf)) continue;
    // Retry chains (payload.retry.retryOf): a chain whose tail is still unfinished work.
    try {
      const jobs = db.prepare("SELECT job_id, op_id, attempt, status, payload_json, created_at, updated_at FROM jobs WHERE workflow_id=? AND kind<>'kernel' ORDER BY created_at, job_id").all(wf)
        .map((j) => ({ ...j, payload: parse(j.payload_json) }));
      const byId = new Map(jobs.map((j) => [j.job_id, j]));
      const retried = new Set(jobs.map((j) => j.payload?.retry?.retryOf).filter(Boolean));
      const checks = new Map(db.prepare('SELECT op_id, attempt, checks_json FROM checks WHERE workflow_id=?').all(wf).map((c) => [`${c.op_id}\0${c.attempt}`, parse(c.checks_json)]));
      // Chains branch (one job retried by several successors) and pass through successes (a redo of
      // settled work): what counts is the failure streak since the chain's last success, reported
      // once per streak however many tails share it.
      const loops = new Map(), repeats = new Map();
      for (const tail of jobs.filter((j) => !retried.has(j.job_id))) {
        if (tail.status === 'succeeded' || tail.status === 'cancelled') continue;
        if (!OPEN_JOB.includes(tail.status)) {
          if (now - tail.updated_at > CHAIN_WINDOW_MS) continue;
          // A later job of the same op over the same paths took the work over: this chain is history.
          if (jobs.some((j) => j.op_id === tail.op_id && j.created_at > tail.created_at && pathsKey(j.payload) === pathsKey(tail.payload))) continue;
        }
        const streak = [];
        for (let j = tail, guard = 0; j && j.status !== 'succeeded' && guard < 200; j = byId.get(j.payload?.retry?.retryOf), guard++) {
          if (j.status !== 'cancelled') streak.unshift(j);
        }
        const failed = streak.filter((j) => j.status === 'failed');
        if (failed.length >= RETRY_LOOP_MIN - 1 && streak.length >= RETRY_LOOP_MIN) {
          const id = streak[0].job_id;
          const loop = loops.get(id) ?? { streak, tails: [] };
          loop.tails.push(tail);
          if (streak.length > loop.streak.length) loop.streak = streak;
          loops.set(id, loop);
        }
        for (const j of failed) {
          for (const c of checks.get(`${j.op_id}\0${j.attempt}`)?.checks ?? []) {
            const code = c?.exitCode;
            if (code === 0 || code === null || code === undefined || !c?.name) continue;
            const id = `${streak[0].job_id}:${c.name}`;
            const r = repeats.get(id) ?? { name: c.name, op: tail.op_id, jobs: new Map(), tails: new Set() };
            r.jobs.set(j.job_id, j); r.tails.add(`${tail.job_id} ${tail.status}`);
            repeats.set(id, r);
          }
        }
      }
      for (const [id, { streak, tails }] of loops) {
        put(wf, 'retry-loop', id, streak[0].created_at, `${streak[0].op_id}: ${streak.filter((j) => j.status === 'failed').length} failed attempt(s) in a row since the last success (${streak.map((j) => `a${j.attempt} ${j.status}`).join(', ')}); now ${tails.map((t) => `${t.job_id} ${t.status}`).join(', ')}`, { jobs: streak.map((j) => j.job_id) });
      }
      for (const [id, r] of repeats) {
        const list = [...r.jobs.values()].sort((a, b) => a.attempt - b.attempt);
        if (list.length < 2) continue;
        put(wf, 'repeat-check', id, list[0].updated_at, `check ${r.name} failed on ${list.length} attempts of ${r.op} (${list.map((j) => `a${j.attempt}`).join(', ')}); now ${[...r.tails].join(', ')}`, { jobs: list.map((j) => j.job_id) });
      }
    } catch { /* a malformed chain is not a finding */ }
    // Workers that died without a report, per provider, inside the window.
    try {
      const died = db.prepare(`SELECT entity_id job, created_at FROM events WHERE workflow_id=? AND created_at>? AND (
          kind='dead-worker-fenced' OR (kind='op-settled' AND json_extract(payload_json,'$.reportFiled')=0))`).all(wf, now - WORKER_DIED_WINDOW_MS);
      const byModel = new Map();
      for (const d of died) {
        const disp = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='op-dispatched' AND entity_id=? ORDER BY seq DESC LIMIT 1").get(wf, d.job);
        const model = parse(disp?.payload_json).model ?? 'unknown';
        if (!byModel.has(model)) byModel.set(model, new Map());
        const m = byModel.get(model);
        if (!m.has(d.job)) m.set(d.job, d.created_at);
      }
      for (const [model, m] of byModel) {
        if (m.size < 2) continue;
        put(wf, 'worker-died', `${wf}:${model}`, Math.min(...m.values()), `${m.size} ${model} worker(s) ended without a report in the last ${WORKER_DIED_WINDOW_MS / 3_600_000} h: ${[...m.keys()].join(', ')}`, { jobs: [...m.keys()] });
      }
    } catch { /* no events */ }
    // Identical dispatch rejects inside the window.
    try {
      const rejects = db.prepare("SELECT entity_id job, payload_json, created_at FROM events WHERE workflow_id=? AND kind='dispatch-rejected' AND created_at>? ORDER BY seq").all(wf, now - REJECT_WINDOW_MS);
      const groups = new Map();
      for (const r of rejects) {
        const p = parse(r.payload_json);
        const sig = `${p.step ?? '?'}\0${clip(p.error || p.signal || '', 80)}`;
        if (!groups.has(sig)) groups.set(sig, { step: p.step ?? '?', error: clip(p.error || p.signal || '', 80), at: r.created_at, jobs: [], providers: new Set() });
        const g = groups.get(sig); g.jobs.push(r.job); g.providers.add(p.provider ?? p.model ?? '?');
      }
      for (const [sig, g] of groups) {
        if (g.jobs.length < 2) continue;
        put(wf, 'repeat-reject', `${wf}:${hash(sig)}`, g.at, `${g.jobs.length} dispatch rejects at step ${g.step} (${[...g.providers].join(', ')})${g.error ? `: ${g.error}` : ''}`, { jobs: [...new Set(g.jobs)] });
      }
    } catch { /* no events */ }
    // A queued job routed again and again without dispatch.
    try {
      for (const r of db.prepare(`SELECT e.entity_id job, COUNT(*) n, MIN(e.created_at) since FROM events e JOIN jobs j ON j.job_id=e.entity_id
          WHERE e.workflow_id=? AND e.kind='route-decided' AND j.status='queued' GROUP BY e.entity_id HAVING n>=?`).all(wf, REROUTE_MIN)) {
        put(wf, 'reroute-loop', r.job, r.since, `queued job ${r.job} routed ${r.n} times without a dispatch`, { jobs: [r.job] });
      }
    } catch { /* no events */ }
    // Settled work a law-input change re-staled (api status staleOperations).
    try {
      const ops = staleOperationsOf(staleOf(db, wf, { root, repo }));
      if (ops.length) {
        const paths = [...new Set(ops.flatMap((o) => o.paths))];
        const since = Math.min(...paths.map((p) => { try { return fs.statSync(path.isAbsolute(p) ? p : p.startsWith('.starciwork/') && repo ? path.join(repo, p) : path.join(root, p)).mtimeMs; } catch { return now; } }));
        const source = paths.some((p) => !p.startsWith('.starciwork/'));
        put(wf, 'stale-input', wf, since, `${ops.length} settled job(s) re-staled by input change(s) ${clip(paths.join(', '), 120)} (e.g. ${ops.slice(0, 3).map((o) => o.jobId).join(', ')})`,
          { jobs: ops.map((o) => o.jobId), paths, labels: [source ? 'knowledge-churn' : 'cross-workflow'] });
      }
    } catch { /* no contracts */ }
  }
  return out;
}

/* ------------------------------------------------------------ the whole projection */

export const owedLine = (i) => `OWED ${i.workflowId} ${i.incidentId ?? i.key} [${i.kind ?? '-'}] age=${i.ageMin}m ${i.fixedBy ? `fixed-by ${i.fixedBy.sha.slice(0, 9)}?` : 'open'}: ${i.summary}`;

/**
 * Every classified item of one ledger plus the OWED ones linked to their likely fix:
 * {items, owed}. Each OWED item carries {key, status: 'open'|'fixed-by', fixedBy, action, line}.
 * `commitsOf(since)` replaces `git log` (specs).
 */
export function owedFindings(db, { repo = null, ledgers = [], now = Date.now(), wanted = new Set(), graceMs = GATE_GRACE_MS, root = SKILL_ROOT,
  commitsOf = (since) => gitCommits({ root, since, now }), staleOf = staleInputs, patterns = true } = {}) {
  const incidents = classifyIncidents(db, { repo, ledgers, now, wanted, graceMs });
  const found = patterns ? patternFindings(db, { repo, now, wanted, root, staleOf }) : [];
  const owedIncidents = incidents.filter((i) => i.class === CLASSES.supervisor);
  const since = Math.min(now, ...owedIncidents.map((i) => i.raisedAt));
  let commits = [];
  try { commits = owedIncidents.length ? commitsOf(since) : []; } catch { commits = []; }
  const items = [...incidents.map((i) => ({ ...i, key: i.key ?? `incident:${i.workflowId}:${i.incidentId}` })), ...found];
  for (const i of items) {
    if (i.class !== CLASSES.supervisor) continue;
    i.fixedBy = i.incidentId ? linkFix(i, commits) : null;
    i.status = i.fixedBy ? 'fixed-by' : 'open';
    i.action = actionOf(i);
    i.line = owedLine(i);
  }
  return { items, owed: items.filter((i) => i.class === CLASSES.supervisor) };
}

/**
 * OWED items the supervisor inbox hears about: older than OWED_ALERT_MS and not already fixed by a
 * commit that cites the incident (or one it cites). A keyword-only guess never silences the alert.
 */
export const alertableOwed = (owed, { now = Date.now(), minAgeMs = OWED_ALERT_MS } = {}) => owed.filter((i) => now - i.raisedAt >= minAgeMs
  && !(i.fixedBy && (i.fixedBy.how === 'id' || i.fixedBy.how === 'cited-id')));

/* ------------------------------------------------------------ CLI */

function main() {
  const argv = process.argv.slice(2);
  const values = (name) => { const out = []; for (let i = 0; i < argv.length; i++) if (argv[i] === `--${name}`) out.push(argv[++i]); return out; };
  const has = (name) => argv.includes(`--${name}`);
  if (has('help')) { console.log('use: node scripts/supervisor/owed.mjs [--repo <path>]... [--workflow <id>]... [--all] [--json]'); return; }
  let repos = values('repo');
  if (!repos.length) {
    try { repos = loadConfig()?.supervisor?.repos ?? []; } catch { repos = []; }
  }
  const wanted = new Set(values('workflow'));
  const now = Date.now();
  const opened = [];
  for (const repo of repos) {
    try { opened.push({ repo: path.resolve(repo), handle: inspectLedger({ file: ledgerFileFor(path.resolve(repo)) }) }); }
    catch (e) { console.error(`owed: ${repo}: ${String(e?.message ?? e).slice(0, 160)}`); }
  }
  const ledgers = opened.map((l) => ({ repo: l.repo, db: l.handle.db }));
  const result = { ok: true, at: now, repos: ledgers.map((l) => l.repo), items: [] };
  try {
    for (const l of ledgers) result.items.push(...owedFindings(l.db, { repo: l.repo, ledgers, now, wanted }).items);
  } finally { for (const l of opened) { try { l.handle.close(); } catch { /* closed */ } } }
  const owed = result.items.filter((i) => i.class === CLASSES.supervisor);
  result.counts = Object.fromEntries(Object.values(CLASSES).map((c) => [c, result.items.filter((i) => i.class === c).length]));
  result.counts.fixedBy = owed.filter((i) => i.status === 'fixed-by').length;
  if (has('json')) { console.log(JSON.stringify(has('all') ? result : { ...result, items: owed })); return; }
  console.log(`[owed] ${result.repos.length} ledger(s): ${owed.length} owed (${result.counts.fixedBy} likely fixed), ${Object.entries(result.counts).filter(([k]) => k !== CLASSES.supervisor && k !== 'fixedBy').map(([k, n]) => `${k} ${n}`).join(', ')}`);
  for (const i of owed) console.log(`  ${i.line}${i.fixedBy ? ` <- ${i.fixedBy.how}${i.fixedBy.tokens ? ` (${i.fixedBy.tokens.join(', ')})` : ''} "${i.fixedBy.subject}"` : ''}`);
  if (has('all')) for (const i of result.items.filter((x) => x.class !== CLASSES.supervisor)) console.log(`  ${i.class.toUpperCase()} ${i.workflowId} ${i.incidentId ?? i.key} [${i.kind ?? '-'}] age=${i.ageMin}m: ${i.reason}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
