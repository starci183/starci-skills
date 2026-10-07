#!/usr/bin/env node
// starci supervisor owed — what the running workflows wait on the SUPERVISOR for.
//
// Owner, 2026-09-24: "the supervisor must handle the conflicts, fix grammar, fix lint, identify the
// out-of-scope workflow problems ... are they all to be fixed? ... because leaving workflows
// stale/blocked/stuck waiting wrongly is the supervisor's fault". That day the three ledgers' running
// workflows held ~90 open incidents addressed to the supervisor, the runtime monitor or Source
// ("For the supervisor", "needs supervisor", "runtime monitor", source-runtime-defect, knowledge churn, cross-workflow git effects, delegated rulings),
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
// a law-input change, a dispatch whose guard receipt records a layer that did not install.
//
// Each OWED incident is linked to the .claude commit that likely fixed it: a commit after the
// incident whose message cites its id (or an incident it cites), else one whose message shares its
// distinctive tokens (file names, identifiers, kind words). `fixed-by <sha>?` means the supervisor
// verifies the fix and tells the owning Kernel to resolve the incident; `open` means the supervisor
// fixes it now (modules/supervisor/supervise.yaml step owed).
//
//   starci supervisor owed [--repo <path>]... [--workflow <id>]... [--all] [--json]
//   starci supervisor owed ack --item <key> --commits <sha,...> --reason <text> [--force] [--json]
//   starci supervisor owed unack --item <key> [--json]
//   starci supervisor owed acks [--json]
//
// Read-only over the product ledgers: they are opened with inspectLedger, git is read with `git log`.
// poll.mjs prints the OWED lines every cycle; the Workers controller opens their Decision Items.
//
// A pattern item stays OWED until a success breaks its streak, so a lineage whose causes are already
// fixed would re-alert every hour. Two ways out:
//   ack      the supervisor's disposition (`ack --item <key> --commits <csv> --reason <t>`), kept in
//            machine.sqlite (a sup_owed row in state acked, an owed-acked sup_events row): the item is quiet in
//            the poll OWED lines until a failure NEWER than the ack lands on its lineage,
//            which re-opens it (ack-reopened);
//   waiting  a retry-loop/repeat-check lineage whose newest job is queued behind an open owner gate or
//            an open owner ask (on it or on a job its --after chain reaches) is the owner's, not OWED.
import path from 'node:path';
import { logSince } from '../api/git/log-since.mjs'; import { revParse } from '../api/git/rev-parse.mjs';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../../engine/config.mjs';
import { inspectLedger, ledgerFileFor } from '../../engine/db/ledger.mjs';
import { evaluateTypedIncidents } from '../kernel/gate-conditions.mjs';
import { staleInputs } from '../kernel/input-digests.mjs';
import {
  GATE_GRACE_MS, ownerGates, peerWaits, judgeGate, judgePeerWait,
  openAskDispatches, runningWorkflows, namedWorkflows, ledgerLookup, peerBusyProbe, verdictKey, stallMinutesOf, apiFrontier,
} from './stall.mjs';
import { readSupervisor, supervisorEvent, withSupervisor } from '../machine/home.mjs';
import { clipLine } from '../lib/clip.mjs';
import { parseJsonOr } from '../lib/json.mjs';
import { minutes } from '../lib/time.mjs'; import { isMain } from '../lib/is-main.mjs';
import { DECISION_TEXT, CONTRACT_CONFLICT_TEXT, NOTE_KIND, OWNER_ONLY, SUPERVISOR_ADDRESSED, WORKER_DIED_TEXT } from './owed-text.mjs';
import { retryChainFindings, workerDiedFindings, repeatRejectFindings, guardFailedFindings, rerouteLoopFindings, staleInputFindings } from './owed-patterns.mjs';
export { isLeaseOverlapRefusal } from './owed-patterns.mjs';
export const SKILL_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CLASSES = Object.freeze({ owner: 'owner', peer: 'peer', kernel: 'kernel', progress: 'in-progress', supervisor: 'supervisor' });

const parse = parseJsonOr;
const kindOf = (lastProgress) => /^\[([^\]]+)\]/.exec(lastProgress ?? '')?.[1] ?? null;
const bodyOf = (lastProgress) => String(lastProgress ?? '').replace(/^(?:\[[^\]]+\]\s*)+/, '');

/* ------------------------------------------------------------ declared types and labels */

/** Peer-dependency wording on an owner gate (the retired stall-alert.mjs PEER_DEPENDENCY): a misfiled peer-wait. */
const PEER_DEPENDENCY = /\bpeer(?:[- ]dependen\w*| workflow)\b|\bnot an owner (?:step|decision|gate)\b/i;

/** Labels only ever add information: [label, test(kind, text)]. */
const LABEL_RULES = [
  ['addressed-to-supervisor', (k, t) => SUPERVISOR_ADDRESSED.test(t)],
  ['runtime', (k, t) => /runtime|source|liveness|nudge|op-boundary|provider|launch|environment|api-/.test(k) || /\b(?:scripts|engine|modules|knowledge|bin)\/[\w./-]+|\.claude\b|\bSource\b/.test(t)],
  ['liveness', (k, t) => /liveness|nudge|idle/.test(k) || /\bturn-idle\b|\bnudge-ready\b|\bliveness\b/i.test(t)],
  ['worker-died', (k, t) => /died|exited|no-report|missing-report|without-report|turn-cap/.test(k) || WORKER_DIED_TEXT.test(t)],
  ['checker', (k, t) => /checker|lint|quality-gate/.test(k) || /status[= ]unavailable|gate.mjs|code-patterns-check|\bsonar\b/i.test(t)],
  ['knowledge-churn', (k, t) => /stale|churn|baseline|rollout/.test(k) || /staleOperations|staleInput|knowledge\/[\w.-]+\.ya?ml/i.test(t)],
  ['contract-conflict', (k, t) => /contradict|conflict|divergence|read-race/.test(k) || CONTRACT_CONFLICT_TEXT.test(t)],
  ['cross-workflow', (k, t) => /cross|foreign|shared|history|unowned|env-/.test(k) || /git reset|\brebase\b|\bamend\b|reflog/i.test(t)],
  ['host-tooling', (k, t) => /inbox|orchestration|host|unbridged|release|reap/.test(k) || /\bENOBUFS\b|orca(?:\.exe)? |managedWorker/i.test(t)],
  ['decision', (k, t) => /decision|delegat|ruling|scope-gap|design-gap|srs-gap|account-gap|owner-gate/.test(k) || DECISION_TEXT.test(t)],
  ['grammar', (k, t) => /grammar/.test(k) || /@starci\/grammar/.test(t)],
];
export const labelsOf = (kind, text) => LABEL_RULES.filter(([, test]) => test(String(kind ?? ''), String(text ?? ''))).map(([name]) => name);

/** What the supervisor does about one OWED item, by what it is (the owner's grant: fix it, never ask). */
export function actionOf(item) {
  const wf = item.workflowId, id = item.incidentId;
  if (item.fixedBy) return `verify ${item.fixedBy.sha.slice(0, 9)} fixed it, then tell ${wf}'s Kernel: starci kernel incident --workflow ${wf} --resolve ${id} --by supervisor --detail "fixed by .claude ${item.fixedBy.sha.slice(0, 9)}: <what changed>" (else fix it now)`;
  const l = new Set(item.labels ?? []);
  if (item.pattern) {
    switch (item.pattern) {
      case 'stale-input': return l.has('knowledge-churn')
        ? 'Source knowledge/schema bytes differ from the filed inputs: read the actual current Source obligations, diagnose the concrete mismatch and file new native checks before settling; preserve the captured attempt and its evidence'
        : 'settled work owes a redo or follow-up for a changed product record (a breaking change its owner declared, or an unattributed edit of a record its own workflow owns; peer rewrites are advisory peerDrift and never land here): confirm the follow-up is real and tell the Kernel, or settle the churn at its source';
      case 'worker-died': return 'provider/launcher defect: fix the launch or liveness path in .claude, or route that provider off the op, then tell the Kernel how to retry';
      case 'repeat-reject': return 'the same dispatch step keeps refusing: fix the launcher/host step in .claude, then tell the Kernel to re-dispatch';
      case 'reroute-loop': return 'routing loops on one job: fix the route inputs or pools in .claude, or give the Kernel an exact route disposition';
      case 'guard-failed': return 'workers launched without their full guard (scripts/guards/hook-install.mjs): fix the failing layer in .claude; an unguarded worker still running needs its owned paths checked at settle';
      default: return 'a repeated failure is systemic: find what the contract, checker or grant gets wrong and fix it in .claude (or give the Kernel the exact redo), never another blind retry';
    }
  }
  if (id && item.class === CLASSES.supervisor && (item.kind === 'owner-gate' || item.kind === 'owner-gate-pending')) return `an owner gate with no owner ask: decide it under the owner's delegated authority (or have ${wf}'s Kernel park a real owner ask when it is a product decision the owner kept), then tell the Kernel to resolve ${id}`;
  if (l.has('cross-workflow')) return `resolve the cross-workflow effect (custody, history, shared env) between the workflows involved, notify both Kernels, then have ${wf}'s Kernel resolve ${id}`;
  if (l.has('knowledge-churn')) return `resolve the concrete current knowledge/contract mismatch and file the required READ/CHECK evidence, then tell ${wf}'s Kernel to resolve ${id}`;
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

// A source path an incident names (`dir/sub/file.ext`), built from its named parts.
const PATH_CHAR = String.raw`[\w@.[\]-]`;
const SOURCE_PATH = new RegExp([`${PATH_CHAR}*`, String.raw`\/`, `(?:${PATH_CHAR}+`, String.raw`\/)*`, `${PATH_CHAR}+`, String.raw`\.`, '(?:mjs|js|ts|tsx|yaml|yml|json|md)', String.raw`\b`].join(''), 'g');

/** Distinctive tokens of an incident: [{token, weight}] (file names and identifiers 2, kind words and plain compounds 1). */
export function fixTokens(kind, text) {
  const out = new Map();
  const add = (token, weight) => {
    const t = String(token).toLowerCase();
    if (t.length < 4 || TOKEN_STOP.has(t)) return;
    out.set(t, Math.max(out.get(t) ?? 0, weight));
  };
  const body = String(text ?? '');
  for (const m of body.matchAll(SOURCE_PATH)) {
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
  const pick = (c, how, extra = {}) => ({ sha: c.sha, at: c.at, subject: clipLine(c.subject, 120), how, ...extra });
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
function gitCommits({ root = SKILL_ROOT, since = 0, log = logSince, memoMs = 60_000, now = Date.now() } = {}) {
  if (gitMemo && gitMemo.root === root && gitMemo.since <= since && now - gitMemo.at < memoMs && log === logSince) return gitMemo.commits.filter((c) => c.at >= since);
  const r = log(root, new Date(Math.max(0, since - 60_000)).toISOString(), '%H%x1f%ct%x1f%s%x1f%b%x1e');
  if (!r.ok) return [];
  const commits = String(r.stdout ?? '').split('\x1e').map((rec) => rec.replace(/^\s+/, '')).filter(Boolean).map((rec) => {
    const [sha, ct, subject = '', body = ''] = rec.split('\x1f');
    const message = `${subject}\n${body}`;
    return { sha, at: Number(ct) * 1000, subject, message, lower: message.toLowerCase() };
  }).filter((c) => /^[0-9a-f]{7,40}$/.test(c.sha));
  if (log === logSince) gitMemo = { root, since, at: now, commits };
  return commits;
}

/* ------------------------------------------------------------ the incident classification */

const raisedOf = (db, workflowId, incidentId) => db.prepare(
  "SELECT payload_json, created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, incidentId);
const typedIncidentsOf = (db, repo, wf) => { try { return evaluateTypedIncidents(db, { repo, workflowId: wf }); } catch { return []; } };
const openAskIds = (d, wf) => {
  if (!d) return [];
  try { return openAskDispatches(d, wf).map((a) => a.dispatch_id); } catch { return []; }
};
const hasRunningPeer = (dbOf, p) => {
  const r = dbOf(p)?.prepare('SELECT phase, archived_at FROM workflows WHERE workflow_id=?').get(p);
  return r?.phase === 'running' && r.archived_at == null;
};

/** The class and reason of an incident that is a typed wait (--until-*): [class, reason]. */
const typedClass = (t) => {
  if (t.met) return [CLASSES.progress, 'every typed condition holds: the runtime releases it on the next status'];
  if (t.unmeetable?.length) return [CLASSES.kernel, `typed wait can no longer be met (${clipLine(t.unmeetable.join('; '), 120)}): its Kernel re-points or resolves it`];
  return [CLASSES.peer, `typed wait the runtime re-checks: ${clipLine(t.results.filter((r) => !r.met).map((r) => r.condition).join(' AND '), 140)}`];
};

/** An open owner ask the incident text names (in its workflow or a peer it names) is the owner's: [class, reason] or null. */
const ownerAskClass = (cx, text) => {
  const peers = namedWorkflows(text).filter((id) => id !== cx.wf);
  const named = new Set(String(text).match(/\bctx_[0-9a-f]{12}\b/g) ?? []);
  const openNamed = [...cx.ownAsks, ...peers.flatMap((id) => cx.asksOf(id))].filter((d) => named.has(d));
  return openNamed.length ? [CLASSES.owner, `names open owner ask ${openNamed.join(', ')}`] : null;
};

/** The class and reason of an incident that is an owner gate: [class, reason]. */
const gateClass = (cx, row, gate) => {
  const { db, wf, repo, dbOf, now, graceMs } = cx;
  const v = cx.verdictOf(wf, row.incident_id, () => judgeGate({ db, workflowId: wf, gate, repo, dbOf, now, graceMs }));
  if (v.stale) return [CLASSES.kernel, `stale owner gate (stall wake): ${clipLine(v.reasons.join('; '), 140)}`];
  if (v.asks.length) return [CLASSES.owner, `owner ask ${v.asks.map((a) => a.dispatchId).join(', ')} open`];
  if (PEER_DEPENDENCY.test(gate.text)) return [CLASSES.kernel, 'an owner gate its own text calls a peer dependency: its Kernel re-records it as a peer-wait (stall wake)'];
  if (OWNER_ONLY.test(gate.text)) return [CLASSES.owner, 'an owner-only condition (credentials, push/publish, handover, payment/legal)'];
  if (v.waits.length && v.peers.some((p) => hasRunningPeer(dbOf, p))) return [CLASSES.peer, `waits on a record a running peer owes: ${clipLine(v.waits.join(', '), 140)}`];
  return [CLASSES.supervisor, v.waits.length ? `owner gate waits on ${clipLine(v.waits.join(', '), 120)} and no running peer it names owes it` : 'owner gate with no owner ask and no owner-only condition'];
};

/** The class and reason of an incident that is a peer-wait: [class, reason]. */
const waitClass = (cx, row, wait) => {
  const { db, wf, dbOf, now, graceMs, stallMinutes, busyOf } = cx;
  const v = cx.verdictOf(wf, row.incident_id, () => judgePeerWait({ db, workflowId: wf, wait, dbOf, now, thresholdMs: stallMinutes * 60_000, graceMs, busyOf }));
  if (v.unknown) return [CLASSES.supervisor, `peer-wait on ${wait.peer ?? '?'}, which is in no ledger in view`];
  if (v.stale) return [CLASSES.kernel, `stale peer-wait (stall wake): ${clipLine(v.reasons.join('; '), 140)}`];
  return [CLASSES.peer, `peer ${wait.peer} is running and moving`];
};

/** The class and reason of one open incident, by elimination: [class, reason]. */
const classifyIncident = (cx, row, kind, text, raisedAt) => {
  const { now, graceMs } = cx;
  if (now - raisedAt < graceMs) return [CLASSES.progress, `raised ${minutes(now - raisedAt)}m ago, inside the grace window`];
  const t = cx.typedOf.get(row.incident_id);
  if (t) return typedClass(t);
  const ownerAsk = ownerAskClass(cx, text);
  if (ownerAsk) return ownerAsk;
  const gate = cx.gatesOf.get(row.incident_id);
  if (gate) return gateClass(cx, row, gate);
  const wait = cx.waitsOf.get(row.incident_id);
  if (wait) return waitClass(cx, row, wait);
  if (kind && NOTE_KIND.test(kind) && !SUPERVISOR_ADDRESSED.test(text)) return [CLASSES.kernel, 'informational note (holds nothing): its Kernel resolves it when done'];
  return [CLASSES.supervisor, SUPERVISOR_ADDRESSED.test(text) ? 'addressed to the supervisor/runtime/Source, no typed release' : 'no typed release, no owner ask, no peer: nobody but the supervisor moves it'];
};

/** Every open incident of one running workflow, classified. */
const classifyWorkflow = (env, wf) => {
  const { db, repo, now } = env;
  const typed = typedIncidentsOf(db, repo, wf);
  const cx = { ...env, wf, typedOf: new Map(typed.map((t) => [t.incidentId, t])), gatesOf: new Map(ownerGates(db, wf).map((g) => [g.incidentId, g])),
    waitsOf: new Map(peerWaits(db, wf).map((p) => [p.incidentId, p])), ownAsks: env.asksOf(wf) };
  const rows = db.prepare("SELECT incident_id, op_id, last_progress, updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at, incident_id").all(wf);
  return rows.map((row) => {
    const kind = kindOf(row.last_progress);
    const text = bodyOf(row.last_progress);
    const raised = raisedOf(db, wf, row.incident_id);
    const raisedAt = raised?.created_at ?? row.updated_at;
    const base = { workflowId: wf, repo, incidentId: row.incident_id, opId: row.op_id ?? null, kind, labels: labelsOf(kind, text), raisedAt, updatedAt: row.updated_at,
      ageMin: minutes(now - raisedAt), text, summary: clipLine(text, 200) };
    const [cls, reason] = classifyIncident(cx, row, kind, text, raisedAt);
    return { class: cls, reason, ...base };
  });
};

/**
 * Every open incident of every running, unarchived workflow of one ledger, classified (CLASSES).
 * `ledgers` ([{repo, db}]) lets a gate or wait see a peer in another ledger. A gate or wait verdict
 * stallFindings already put in `verdicts` (verdictKey) is reused; any other is judged here the same way,
 * busy peers included (peerBusyProbe over `frontierOf`). Returns
 * [{class, reason, workflowId, repo, incidentId, kind, labels, raisedAt, ageMin, text, summary}].
 */
export function classifyIncidents(db, { repo = null, ledgers = [], now = Date.now(), wanted = new Set(), graceMs = GATE_GRACE_MS, stallMinutes = stallMinutesOf(),
  verdicts = null, frontierOf = apiFrontier } = {}) {
  const find = ledgerLookup({ repo, db, ledgers });
  const dbOf = (wf) => find(wf)?.db ?? null;
  const env = { db, repo, now, graceMs, stallMinutes, dbOf, busyOf: peerBusyProbe({ repo, db, ledgers, frontierOf }),
    verdictOf: (wf, incidentId, judge) => verdicts?.get(verdictKey(wf, incidentId)) ?? judge(), asksOf: (wf) => openAskIds(dbOf(wf), wf) };
  const out = [];
  for (const w of runningWorkflows(db)) {
    if (wanted.size && !wanted.has(w.workflow_id)) continue;
    out.push(...classifyWorkflow(env, w.workflow_id));
  }
  return out;
}

/* ------------------------------------------------------------ patterns with no incident */

const PATTERN_PROBES = [retryChainFindings, workerDiedFindings, repeatRejectFindings, guardFailedFindings, rerouteLoopFindings, staleInputFindings];

/**
 * Systemic failures no incident names: [{class:'supervisor', pattern, key, workflowId, ...}].
 * `root` is the runtime root law inputs are digested from (stale-input).
 */
export function patternFindings(db, { repo = null, now = Date.now(), wanted = new Set(), root = SKILL_ROOT, staleOf = staleInputs } = {}) {
  const out = [];
  const put = (workflowId, pattern, id, since, summary, extra = {}) => out.push({
    class: CLASSES.supervisor, reason: 'repeated failure with no incident', workflowId, repo, incidentId: null, pattern, key: `pattern:${pattern}:${id}`,
    kind: `pattern:${pattern}`, labels: [(pattern === 'stale-input' && 'knowledge-churn') || (pattern === 'repeat-check' && 'checker') || 'runtime'],
    raisedAt: since, ageMin: minutes(now - since), summary: clipLine(summary, 220), ...extra });
  for (const w of runningWorkflows(db)) {
    const wf = w.workflow_id;
    if (wanted.size && !wanted.has(wf)) continue;
    const cx = { db, wf, now, root, repo, staleOf, put, ownerClass: CLASSES.owner };
    for (const probe of PATTERN_PROBES) {
      try { probe(cx); } catch { /* a probe whose chains, events or contracts are absent or malformed finds nothing */ }
    }
  }
  return out;
}

/* ------------------------------------------------------------ the whole projection */

const owedLine = (i) => 'OWED ' + i.workflowId + ' ' + (i.incidentId ?? i.key) + ' [' + (i.kind ?? '-') + '] age=' + i.ageMin + 'm ' + (i.fixedBy ? 'fixed-by ' + i.fixedBy.sha.slice(0, 9) + '?' : 'open') + (i.ackReopened ? ' ack-reopened (acked ' + new Date(i.ackReopened.at).toISOString() + ')' : '') + ': ' + i.summary;
const fixedByTextOf = (fixedBy) => {
  if (!fixedBy) return '';
  const prefix = ' <- ' + fixedBy.how;
  const tokens = fixedBy.tokens ? ' (' + fixedBy.tokens.join(', ') + ')' : '';
  return prefix + tokens + ' "' + fixedBy.subject + '"';
};

/* ------------------------------------------------------------ the supervisor's disposition: ack */

/**
 * When an item last got worse: a pattern's newest failure on its lineage (lastFailureAt), an incident's
 * last update, else when it was raised. A value newer than an ack re-opens the item.
 */
const lastWorseAt = (item) => item.lastFailureAt ?? item.updatedAt ?? item.raisedAt ?? 0;
/** True while ack still holds item quiet: nothing on its lineage got worse after the ack. */
export const ackHolds = (item, ack) => Boolean(ack) && lastWorseAt(item) <= ack.at;

/** The sup_owed kind of an item key: 'incident' | 'pattern:<name>' | the key's first part. Pure. */
const owedKindOf = (key, item) => item?.kind ?? (String(key).startsWith('pattern:') ? String(key).split(':').slice(0, 2).join(':') : String(key).split(':')[0] || 'owed');

/**
 * Every stored ack (machine.sqlite sup_owed rows in state acked; detail_json is the ack):
 * Map<key, {key, commits, reason, at, by, workflowId, summary}> (empty when machine.sqlite does not exist yet).
 */
export function readOwedAcks({ env = process.env } = {}) {
  return readSupervisor((m) => new Map(m.db.prepare("SELECT owed_id, detail_json, acked_at FROM sup_owed WHERE state='acked' ORDER BY acked_at").all()
    .map((r) => { const v = parse(r.detail_json) ?? {}; return [r.owed_id, { ...v, key: r.owed_id, at: Number(v.at ?? r.acked_at) }]; })), new Map(), { env });
}

/** Store (or replace) the ack of key as its sup_owed row (state acked), with its owed-acked audit event. Returns the ack. */
export function ackOwed({ key, commits, reason, item = null, by = 'cli', now = Date.now(), env = process.env }) {
  const ack = { key, commits, reason, at: now, by, workflowId: item?.workflowId ?? null, summary: item?.summary ?? null };
  withSupervisor((m) => m.transaction(() => {
    const opened = m.db.prepare('SELECT opened_at FROM sup_owed WHERE owed_id=?').get(key)?.opened_at ?? item?.raisedAt ?? now;
    m.upsert('sup_owed', { owed_id: key, kind: owedKindOf(key, item), subject: item?.workflowId ?? key, cluster: null, state: 'acked', opened_at: opened,
      acked_at: now, acked_by: by, closed_at: null, detail_json: ack }, ['owed_id']);
    supervisorEvent(m, { entityType: 'owed-item', entityId: key, kind: 'owed-acked', payload: ack, now });
  }), { env });
  return ack;
}

/** Drop the ack of `key` (its sup_owed row closes), with an owed-unacked audit event; true when there was one. */
export function unackOwed({ key, now = Date.now(), env = process.env }) {
  return withSupervisor((m) => m.transaction(() => {
    const had = m.db.prepare("UPDATE sup_owed SET state='closed', closed_at=? WHERE owed_id=? AND state='acked'").run(now, key).changes > 0;
    if (had) supervisorEvent(m, { entityType: 'owed-item', entityId: key, kind: 'owed-unacked', payload: { key }, now });
    return had;
  }), { env });
}

/**
 * Every classified item of one ledger plus the OWED ones linked to their likely fix:
 * {items, owed}. Each OWED item carries {key, status: 'open'|'fixed-by', fixedBy, action, line}; an item the
 * supervisor acked (readOwedAcks) and nothing newer failed on is status 'acked' and left out of `owed`.
 * `commitsOf(since)` replaces `git log` (specs); `acks` (a Map) replaces the stored ones (machine.sqlite sup_owed).
 */
function decorateOwedItem(item, commits, ackBook) {
  if (item.class !== CLASSES.supervisor) return;
  item.fixedBy = item.incidentId ? linkFix(item, commits) : null; item.status = item.fixedBy ? 'fixed-by' : 'open';
  item.action = actionOf(item); const ack = ackBook.get(item.key);
  if (ack && ackHolds(item, ack)) { item.acked = ack; item.status = 'acked'; }
  else if (ack) item.ackReopened = { at: ack.at, commits: ack.commits };
  item.line = owedLine(item);
}

export function owedFindings(db, { repo = null, ledgers = [], now = Date.now(), wanted = new Set(), graceMs = GATE_GRACE_MS, root = SKILL_ROOT,
  commitsOf = (since) => gitCommits({ root, since, now }), staleOf = staleInputs, patterns = true, acks = undefined,
  stallMinutes = undefined, verdicts = null, frontierOf = undefined } = {}) {
  const incidents = classifyIncidents(db, { repo, ledgers, now, wanted, graceMs, stallMinutes, verdicts, frontierOf });
  const found = patterns ? patternFindings(db, { repo, now, wanted, root, staleOf }) : [];
  const owedIncidents = incidents.filter((i) => i.class === CLASSES.supervisor);
  const since = Math.min(now, ...owedIncidents.map((i) => i.raisedAt));
  let commits = [];
  try { commits = owedIncidents.length ? commitsOf(since) : []; } catch { commits = []; }
  const items = [...incidents.map((i) => ({ ...i, key: i.key ?? `incident:${i.workflowId}:${i.incidentId}` })), ...found];
  let ackBook = acks instanceof Map ? acks : null;
  if (!ackBook) { try { ackBook = readOwedAcks(); } catch { ackBook = new Map(); } }
  for (const i of items) decorateOwedItem(i, commits, ackBook);
  return { items, owed: items.filter((i) => i.class === CLASSES.supervisor && !i.acked) };
}

/* ------------------------------------------------------------ CLI */

const USAGE = [
  'use: starci supervisor owed [--repo <path>]... [--workflow <id>]... [--all] [--json]',
  '     starci supervisor owed ack --item <key> --commits <sha,...> --reason <text> [--repo <path>]... [--force] [--json]',
  '     starci supervisor owed unack --item <key> [--json]',
  '     starci supervisor owed acks [--json]',
].join('\n');

/** Every classified item across `repos` (read-only handles): {repos, items}. */
function collect(repos, { wanted = new Set(), now = Date.now(), acks = undefined } = {}) {
  const opened = [];
  for (const repo of repos) {
    try { opened.push({ repo: path.resolve(repo), handle: inspectLedger({ file: ledgerFileFor(path.resolve(repo)) }) }); }
    catch (e) { console.error(`owed: ${repo}: ${String(e?.message ?? e).slice(0, 160)}`); }
  }
  const ledgers = opened.map((l) => ({ repo: l.repo, db: l.handle.db }));
  const items = [];
  try {
    for (const l of ledgers) items.push(...owedFindings(l.db, { repo: l.repo, ledgers, now, wanted, acks }).items);
  } finally { for (const l of opened) { try { l.handle.close(); } catch { /* closed */ } } }
  return { repos: ledgers.map((l) => l.repo), items };
}

/** Full shas of `list` in the runtime's git, or {bad} naming one that is no commit. */
function resolveCommits(list, { root = SKILL_ROOT, resolve = revParse } = {}) {
  const out = [];
  for (const sha of list) {
    const full = String(resolve(root, sha) ?? '');
    if (!/^[0-9a-f]{40}$/.test(full)) return { bad: sha };
    out.push(full);
  }
  return { commits: out };
}

const cliArgsOf = (argv) => {
  const values = (name) => { const out = []; for (let i = 0; i < argv.length; i++) { if (argv[i] === `--${name}`) out.push(argv[++i]); } return out; };
  return { values, value: (name) => values(name)[0] ?? null, has: (name) => argv.includes(`--${name}`) };
};
const reposOf = (values) => {
  const repos = values('repo');
  if (repos.length) return repos;
  try { return loadConfig()?.supervisor?.repos ?? []; } catch { return []; }
};
const say = (cli, out, text) => { console.log(cli.has('json') ? JSON.stringify(out) : text); if (!out.ok) process.exitCode = 1; };

function ackVerb(cli) {
  const { value, has, repos, now } = cli;
  const key = value('item'), reason = value('reason');
  const list = String(value('commits') ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  if (!key || !reason || !list.length) return say(cli, { ok: false, error: 'ack needs --item <key>, --commits <sha,...> and --reason <text>' }, `owed ack REFUSED: needs --item, --commits and --reason\n${USAGE}`);
  const resolved = resolveCommits(list);
  if (resolved.bad) return say(cli, { ok: false, error: `not a commit of ${SKILL_ROOT}: ${resolved.bad}` }, `owed ack REFUSED: '${resolved.bad}' is not a commit of ${SKILL_ROOT}`);
  const item = collect(repos, { now, acks: new Map() }).items.find((i) => i.key === key && i.class === CLASSES.supervisor) ?? null;
  if (!item && !has('force')) return say(cli, { ok: false, error: `no OWED item ${key}` }, `owed ack REFUSED: no OWED item '${key}' in ${repos.length} ledger(s) (--force stores it anyway)`);
  const ack = ackOwed({ key, commits: resolved.commits, reason, item, now });
  return say(cli, { ok: true, ack, item: item ? { key: item.key, workflowId: item.workflowId, summary: item.summary, lastFailureAt: lastWorseAt(item) } : null },
    `owed ack ${key}: quiet until a failure newer than ${new Date(now).toISOString()} lands on its lineage (commits ${resolved.commits.map((c) => c.slice(0, 9)).join(', ')})`);
}

function unackVerb(cli) {
  const key = cli.value('item');
  if (!key) return say(cli, { ok: false, error: 'unack needs --item <key>' }, 'owed unack REFUSED: needs --item <key>');
  const had = unackOwed({ key, now: cli.now });
  return say(cli, { ok: true, key, removed: had }, had ? `owed unack ${key}: OWED again` : `owed unack ${key}: there was no ack`);
}

function acksVerb(cli) {
  const acks = [...readOwedAcks().values()];
  return say(cli, { ok: true, acks }, acks.length ? acks.map((a) => `  ACK ${a.key} at ${new Date(a.at).toISOString()} commits ${(a.commits ?? []).map((c) => String(c).slice(0, 9)).join(', ')}: ${a.reason}`).join('\n') : '  no acks');
}

/** The `--all` lines: acked items, then every item that is not the supervisor's. */
function printNotOwed(items) {
  for (const i of items.filter((x) => x.acked)) console.log(`  ACKED ${i.workflowId} ${i.key} at ${new Date(i.acked.at).toISOString()} (${(i.acked.commits ?? []).map((c) => String(c).slice(0, 9)).join(', ')}): ${i.acked.reason}`);
  for (const i of items.filter((x) => x.class !== CLASSES.supervisor)) console.log(`  ${i.class.toUpperCase()} ${i.workflowId} ${i.incidentId ?? i.key} [${i.kind ?? '-'}] age=${i.ageMin}m: ${i.reason}`);
}

function reportOwed(cli) {
  const { values, has, repos, now } = cli;
  const wanted = new Set(values('workflow'));
  const { repos: seen, items } = collect(repos, { wanted, now });
  const result = { ok: true, at: now, repos: seen, items };
  const owed = result.items.filter((i) => i.class === CLASSES.supervisor && !i.acked);
  result.counts = Object.fromEntries(Object.values(CLASSES).map((c) => [c, result.items.filter((i) => i.class === c && !i.acked).length]));
  result.counts.fixedBy = owed.filter((i) => i.status === 'fixed-by').length;
  result.counts.acked = result.items.filter((i) => i.acked).length;
  if (has('json')) { console.log(JSON.stringify(has('all') ? result : { ...result, items: owed })); return; }
  console.log(`[owed] ${result.repos.length} ledger(s): ${owed.length} owed (${result.counts.fixedBy} likely fixed), ${Object.entries(result.counts).filter(([k]) => k !== CLASSES.supervisor && k !== 'fixedBy').map(([k, n]) => k + ' ' + n).join(', ')}`);
  for (const i of owed) console.log('  ' + i.line + fixedByTextOf(i.fixedBy));
  if (has('all')) printNotOwed(result.items);
}

function main() {
  const argv = process.argv.slice(2);
  const args = cliArgsOf(argv);
  const verb = argv[0] && !argv[0].startsWith('--') ? argv[0] : null;
  if (args.has('help')) { console.log(USAGE); return; }
  const cli = { ...args, repos: reposOf(args.values), now: Date.now() };
  if (verb === 'ack') return ackVerb(cli);
  if (verb === 'unack') return unackVerb(cli);
  if (verb === 'acks') return acksVerb(cli);
  if (verb) return say(cli, { ok: false, error: `unknown verb ${verb}` }, USAGE);
  return reportOwed(cli);
}

if (isMain(import.meta.url)) main();
