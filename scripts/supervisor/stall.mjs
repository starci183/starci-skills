// stall.mjs — progress, not liveness: which running workflow has stopped
// moving, and whether the gate holding it still has a reason to hold.
//
// Incident (2026-09-24): nivo Collab sat idle ~2 hours. Its three queued
// interface.implement jobs were held by owner-gate inc-48bc556d89a6 ("resolve
// when the shell record .starciwork/shell/index.yaml exists (peer heads-up)").
// The record was written done at ~02:20 and the peer's ask had closed, but no
// heads-up reached Collab. Kernel alive, watchdog alive (idle-waiting every
// tick), and the supervisor digest printed nothing: it checked liveness only.
//
// This module is a read-only projection over one or more ledgers (every read
// goes through the handle it is given; open it with inspectLedger). The
// frontier (actionable, queuedBecause, worker liveness) is `api status --json`,
// the same projection the watchdog reads each tick; it is asked for only when a
// workflow has been idle past the threshold or holds a queued job that old.
//
// Findings, one line each:
//   STALLED <wf> idle <min>m: <reason>             no progress for > stallMinutes and the frontier
//                                                  gives the Kernel nothing to do (or it is actionable
//                                                  and the Kernel still did not move)
//   STALE-GATE <wf> <incident> [<kind>] ...        an owner gate whose reason is gone: a path it waits
//                                                  for now exists in a landed state (a gate naming a
//                                                  path is released by nothing else); else no owner
//                                                  ask open here or in the peer it names, a peer
//                                                  message after a gate that waits on one, or the
//                                                  jobs it names settled
//   UNREAD-PEER <wf> <key> from <peer> ...         a peer message still pending on a gated or waiting
//                                                  workflow that releases nothing by itself: its
//                                                  Kernel reads api inbox (not alerted)
//   GATE <wf> <incident> [<kind>] ... justified    the gate still has its reason (not alerted)
//   STALE-WAIT <wf> <job> (<op>) <cause>: ...      a queued job waiting on a blocker that settled
//   PEER-WAIT <wf> <incident> on <peer> justified   a typed peer-wait (api incident --kind peer-wait) whose
//                                                  peer is running and still moving (not alerted); a
//                                                  workflow whose frontier is peer-wait on justified
//                                                  waits is not alerted STALLED either
//                                                  A gate or wait that names a job whose report was
//                                                  consumed but not settled holds that settle like a
//                                                  queued job ("defers the settle of <job>"; api status
//                                                  heldSettleJobs)
//   STALE-PEER-WAIT <wf> <incident> on <peer> ...  the peer finished or left running, its message or
//                                                  the job the wait names landed after it, or the peer
//                                                  has been idle past the threshold too
//
// modules/supervisor/supervise.yaml (step stall) is the contract for what the
// supervisor does with each; scripts/supervisor/stall-alert.mjs routes them with no chat
// (the owning Kernel first, the supervisor when that fails, the owner only for owner waits),
// reading the structured fields each finding carries beside its line.

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { allocationMs, loadConfig } from '../../engine/config.mjs';
import { terminalRead } from '../api/orca/terminal-read.mjs';
import { terminalShow } from '../api/orca/terminal-show.mjs';
import { classifyAgentScreen, staleAwareState } from '../kernel/terminal-liveness.mjs';
import { clipLine } from '../lib/clip.mjs';
import { parseJsonOr } from '../lib/json.mjs';

const skillRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const API_FILE = path.join(skillRoot, 'scripts', 'kernel', 'api.mjs');

export const DEFAULT_STALL_MINUTES = 30;
/** A gate younger than this is not judged: the Kernel may still be parking the ask that justifies it. */
export const GATE_GRACE_MS = 10 * 60_000;
/** Ledger events that are the workflow moving (not the Kernel or the watchdog merely looking at it). */
export const PROGRESS_KINDS = ['op-dispatched', 'report-filed', 'report-consumed', 'checks-recorded', 'op-settled', 'plan-derived',
  'job-enqueued', 'incident-resolved', 'ask-answered', 'dispatch-reconciled', 'phase-transition', 'run-created', 'goal-defined'];
/** Incident kinds that hold queued jobs (scripts/kernel/api.mjs OWNER_GATE_KINDS). */
export const OWNER_GATE_KINDS = ['owner-gate', 'owner-gate-pending'];
/** The typed wait on a peer workflow (scripts/kernel/api.mjs PEER_WAIT, openPeerWaits). */
export const PEER_WAIT_KIND = 'peer-wait';
/** Worker liveness that is a turn in progress: a workflow with one is working, not stalled. */
export const WORKING_LIVENESS = ['active', 'active-unclassified'];
const SETTLED = ['succeeded', 'failed', 'cancelled'];

/** The owner's threshold: config.yaml supervisor.stallMinutes, else DEFAULT_STALL_MINUTES. */
export function stallMinutesOf(config = undefined) {
  let cfg = config;
  if (cfg === undefined) { try { cfg = loadConfig(); } catch { cfg = null; } }
  const n = Number(cfg?.supervisor?.stallMinutes);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_STALL_MINUTES;
}

const parse = parseJsonOr;
const minutes = (ms) => Math.max(0, Math.round(ms / 60_000));
export const clock = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

/* ------------------------------------------------------------ ledger projections */

export const runningWorkflows = (db) => db.prepare(
  "SELECT workflow_id, created_at, updated_at FROM workflows WHERE phase='running' AND archived_at IS NULL ORDER BY workflow_id").all();

/** The workflow's last progress: {at, kind}. Falls back to the workflow row when nothing moved yet. */
export function lastProgress(db, workflowId) {
  const marks = PROGRESS_KINDS.map(() => '?').join(',');
  const event = db.prepare(`SELECT kind, created_at FROM events WHERE workflow_id=? AND kind IN (${marks}) ORDER BY created_at DESC, seq DESC LIMIT 1`)
    .get(workflowId, ...PROGRESS_KINDS);
  const report = db.prepare('SELECT MAX(created_at) at FROM reports WHERE workflow_id=?').get(workflowId)?.at ?? null;
  const row = db.prepare('SELECT created_at FROM workflows WHERE workflow_id=?').get(workflowId);
  const candidates = [
    event ? { at: event.created_at, kind: event.kind } : null,
    report ? { at: report, kind: 'report' } : null,
    row ? { at: row.created_at, kind: 'workflow-created' } : null,
  ].filter(Boolean);
  return candidates.sort((a, b) => b.at - a.at)[0] ?? { at: 0, kind: 'none' };
}

/** Open owner-gate incidents with the jobs/ops they hold and when they were raised. */
export function ownerGates(db, workflowId) {
  return db.prepare("SELECT incident_id, op_id, last_progress, updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
    .map((row) => {
      const kind = /^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1] ?? null;
      if (!OWNER_GATE_KINDS.includes(kind)) return null;
      const raised = db.prepare("SELECT payload_json, created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1")
        .get(workflowId, row.incident_id);
      const payload = parse(raised?.payload_json);
      const holds = Array.isArray(payload.holds) && payload.holds.length ? payload.holds : [row.op_id].filter(Boolean);
      return { incidentId: row.incident_id, kind, text: String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, ''), raisedAt: raised?.created_at ?? row.updated_at, holds };
    })
    .filter(Boolean);
}

/**
 * Open peer-wait incidents: {incidentId, peer, holds, text, untilMessage, refs, raisedAt} - the
 * incident-raised payload `api incident --kind peer-wait --peer` writes.
 */
export function peerWaits(db, workflowId) {
  return db.prepare("SELECT incident_id, op_id, last_progress, updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
    .map((row) => {
      const kind = /^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1] ?? null;
      if (kind !== PEER_WAIT_KIND) return null;
      const raised = db.prepare("SELECT payload_json, created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1")
        .get(workflowId, row.incident_id);
      const payload = parse(raised?.payload_json);
      return { incidentId: row.incident_id, kind, peer: typeof payload.peer === 'string' ? payload.peer : null,
        holds: Array.isArray(payload.holds) && payload.holds.length ? payload.holds : [row.op_id].filter(Boolean),
        text: String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, ''), untilMessage: payload.untilMessage === true,
        refs: Array.isArray(payload.refs) ? payload.refs.map(String) : [], raisedAt: raised?.created_at ?? row.updated_at };
    })
    .filter(Boolean);
}

/** Queued jobs of one workflow. */
export const queuedJobs = (db, workflowId) => db.prepare(
  "SELECT job_id, op_id, status, payload_json, created_at, updated_at FROM jobs WHERE workflow_id=? AND kind<>'kernel' AND status='queued' ORDER BY created_at, job_id").all(workflowId);

/**
 * Jobs of one workflow whose report the Kernel consumed but never settled (api status
 * settleReadyJobs, before any wait holds them). An open gate or peer-wait naming one defers that
 * settle deliberately, and holds it the way it holds a queued job (api status heldSettleJobs).
 */
export const settleOwedJobs = (db, workflowId) => db.prepare(
  `SELECT j.job_id, j.op_id, j.status, j.payload_json, j.created_at, j.updated_at FROM jobs j
    WHERE j.workflow_id=? AND j.kind<>'kernel' AND j.status IN ('running','answering') AND EXISTS (
      SELECT 1 FROM reports r WHERE r.workflow_id=j.workflow_id AND r.consumed_at IS NOT NULL AND (
        r.dispatch_id=j.job_id OR r.dispatch_id=j.worker_id
        OR r.dispatch_id=json_extract(j.payload_json,'$.orca.dispatchId')
        OR r.dispatch_id=json_extract(j.payload_json,'$.managed.dispatchId')
        OR r.dispatch_id=json_extract(j.payload_json,'$.hierarchy.runtime.dispatchId')))
    ORDER BY j.created_at, j.job_id`).all(workflowId);

export const heldBy = (gate, job) => gate.holds.includes(job.job_id) || (job.op_id && gate.holds.includes(job.op_id));

/**
 * Owner asks still open in one workflow: an `ask` report nobody answered, and not retired (a
 * supersede closes it unless the ask was served or notified again afterwards) — the same rule
 * poll.mjs openAsks applies, without the URL probe.
 */
export const openAskDispatches = (db, workflowId) => db.prepare(
  `SELECT r.dispatch_id, r.created_at FROM reports r
    WHERE r.workflow_id=? AND r.outcome='ask' AND NOT EXISTS (
      SELECT 1 FROM events e WHERE e.workflow_id=r.workflow_id AND e.kind='ask-answered'
        AND json_extract(e.payload_json,'$.dispatchId')=r.dispatch_id)
    AND NOT EXISTS (
      SELECT 1 FROM events s WHERE s.workflow_id=r.workflow_id AND s.kind='ask-superseded'
        AND json_extract(s.payload_json,'$.dispatchId')=r.dispatch_id
        AND NOT EXISTS (SELECT 1 FROM events v WHERE v.workflow_id=r.workflow_id AND v.kind IN ('ask-serving','ask-notified')
          AND json_extract(v.payload_json,'$.dispatchId')=r.dispatch_id AND v.seq > s.seq))
    ORDER BY r.report_id`).all(workflowId);

/* ------------------------------------------------------------ what a gate's text names */

/** `.starciwork/...` paths an incident names, trailing punctuation dropped. */
export const namedPaths = (text) => [...new Set((String(text ?? '').match(/\.starciwork\/[A-Za-z0-9._@\-/]+/g) ?? [])
  .map((p) => p.replace(/[./-]+$/, '')).filter((p) => p.length > '.starciwork/'.length))];
/** A gate that waits on an owner ask or decision (only such a gate is released by the ask closing). */
export const ASK_GATE = /\bask\b|\bowner(?:'s)? (?:decision|answer|choice|approval|ruling)\b|\bdecision pending\b/i;
/** Workflow ids an incident names. */
export const namedWorkflows = (text) => [...new Set(String(text ?? '').match(/\bwf-[a-z0-9][a-z0-9-]*[a-z0-9]\b/gi) ?? [])];
/** Job ids an incident names (op-<op>-<10 hex>). */
export const namedJobs = (text) => [...new Set(String(text ?? '').match(/\bop-[a-z0-9.-]+-[0-9a-f]{10}\b/gi) ?? [])];

/** Record states that mean the thing a gate waited for has landed. */
export const LANDED_STATES = ['done', 'settled', 'decided', 'approved', 'accepted', 'final', 'complete', 'completed', 'passed', 'ready'];

/**
 * What a path an incident names looks like now, against the time the gate was raised:
 * {path, exists, landed, waiting, at, created, state}. `landed`: it exists, was created or written
 * after the gate, and its record state (a yaml `state:`/`status:` line, when it has one) is a
 * landed state - the condition the gate waited for may be met. `waiting`: it is absent, or its
 * record state is not landed yet - the gate still has something to wait for. A path that already
 * existed unchanged is neither.
 */
export function pathEvidence(repo, rel, raisedAt) {
  const none = { path: rel, exists: false, landed: false, waiting: true, at: null, born: null, written: null, created: false, state: null };
  if (!repo) return { ...none, waiting: false };
  let file = path.join(repo, rel);
  let st;
  try { st = fs.statSync(file); } catch { return none; }
  if (st.isDirectory()) {
    const index = path.join(file, 'index.yaml');
    try { st = fs.statSync(index); file = index; } catch { /* a bare directory */ }
  }
  let state = null;
  if (st.isFile() && /\.ya?ml$/i.test(file) && st.size < 2_000_000) {
    try { state = /^(?:state|status):\s*['"]?([A-Za-z0-9_-]+)/m.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? null; } catch { /* unreadable */ }
  }
  const born = Number.isFinite(st.birthtimeMs) && st.birthtimeMs > 0 ? st.birthtimeMs : st.mtimeMs;
  const at = Math.max(born, st.mtimeMs);
  const settledState = !state || LANDED_STATES.includes(state.toLowerCase());
  return { path: rel, exists: true, landed: at > raisedAt && settledState, waiting: !settledState, at, born, written: st.mtimeMs, created: born > raisedAt, state };
}

/** Peer messages delivered to `workflowId` after `since`, from one of `peers` (ledger inbox rows). */
export const peerDeliveries = (db, workflowId, peers, since) => (peers.length ? db.prepare(
  "SELECT key, payload_json, status, created_at, applied_at FROM inbox WHERE workflow_id=? AND kind='peer-message' AND created_at>? ORDER BY inbox_id").all(workflowId, since)
  .map((row) => ({ key: row.key, status: row.status, at: row.created_at, appliedAt: row.applied_at, ...(({ from, kind, subject }) => ({ from, kind, subject }))(parse(row.payload_json)) }))
  .filter((m) => peers.includes(m.from)) : []);

/** A gate whose release is a peer's message itself (a heads-up, a reply, a notice), not a record. */
export const MESSAGE_GATE = /\bheads?-?up\b|\bmessage\b|\bnotif(?:y|ies|ied|ication)\b|\breply\b|\bnotice\b/i;

/**
 * Is one owner gate still justified? {stale, young, reasons, asks, waits, peers, unread}. Past the
 * grace window a gate is stale when
 *   (b) its condition shows up: a path it names landed after it (pathEvidence), or every job it names
 *       (outside what it holds) settled after it (a job that settled before the gate is its cause,
 *       not its release); and/or
 *   (a) it waits on an owner ask (its text names an ask or an owner decision) and no owner ask is
 *       open in its workflow or any peer workflow it names, while no path it names is still
 *       absent or unsettled (a gate that waits for a record nobody wrote yet is waiting on that
 *       record, not on an ask). A peer dependency or a supervisor hold names no ask, so a closed
 *       ask is no evidence against it.
 * A gate that names a path is released by that path landing and by nothing else. A named peer's
 * message after the gate releases only a gate that names no checkable path and waits on a message
 * (MESSAGE_GATE): mia-mia base-repos inc-55060d946270 waited for .starciwork/brand/index.yaml to
 * settle, and the peer's "brand job admitted" heads-up (pm-a34aec2c6891) read as its release while the
 * record did not exist yet. A still-pending peer message that releases nothing is returned in
 * `unread` (stallFindings reports UNREAD-PEER: the Kernel reads its inbox), never as staleness.
 */
export function judgeGate({ db, workflowId, gate, repo, dbOf = () => null, now = Date.now(), graceMs = GATE_GRACE_MS }) {
  const peers = namedWorkflows(gate.text).filter((id) => id !== workflowId);
  const asks = [];
  for (const wf of [workflowId, ...peers]) {
    const peerDb = wf === workflowId ? db : dbOf(wf);
    if (!peerDb) continue;
    try { for (const a of openAskDispatches(peerDb, wf)) asks.push({ workflowId: wf, dispatchId: a.dispatch_id }); } catch { /* not in that ledger */ }
  }
  const reasons = [], waits = [], unread = [];
  const paths = namedPaths(gate.text);
  for (const rel of paths) {
    const ev = pathEvidence(repo, rel, gate.raisedAt);
    if (ev.landed) reasons.push(`${ev.path} exists${ev.state ? ` (${ev.state})` : ''}, ${ev.created ? `created ${clock(ev.born)}${ev.written - ev.born > 60_000 ? `, written ${clock(ev.written)}` : ''}` : `written ${clock(ev.written)}`} after the gate (${clock(gate.raisedAt)})`);
    else if (ev.waiting) waits.push(`${ev.path} ${ev.exists ? `is ${ev.state}` : 'is absent'}`);
  }
  const messageReleases = !paths.length && MESSAGE_GATE.test(gate.text);
  for (const m of peerDeliveries(db, workflowId, peers, gate.raisedAt)) {
    if (messageReleases) reasons.push(`peer ${m.kind ?? 'message'} ${m.key} from ${m.from} arrived ${clock(m.at)}${m.status === 'applied' ? ' and was acked' : ' (pending)'}: ${clipLine(m.subject, 60)}`);
    else if (m.status === 'pending') unread.push(m);
  }
  if (paths.length) {
    const young = now - gate.raisedAt < graceMs;
    return { stale: !young && reasons.length > 0, young, reasons, asks, waits, peers, unread };
  }
  const jobs = namedJobs(gate.text).filter((id) => !gate.holds.includes(id))
    .map((id) => { for (const wf of [workflowId, ...peers]) { const j = (wf === workflowId ? db : dbOf(wf))?.prepare('SELECT job_id, status, updated_at FROM jobs WHERE job_id=?').get(id); if (j) return j; } return null; })
    .filter(Boolean);
  if (jobs.length && jobs.every((j) => SETTLED.includes(j.status) && j.updated_at > gate.raisedAt)) {
    reasons.push(`named job(s) settled after the gate: ${jobs.map((j) => `${j.job_id} ${j.status} ${clock(j.updated_at)}`).join(', ')}`);
  }
  if (ASK_GATE.test(gate.text) && !asks.length && (reasons.length || !waits.length)) reasons.unshift(`no owner ask open in ${[workflowId, ...peers].join(', ')}`);
  const young = now - gate.raisedAt < graceMs;
  return { stale: !young && reasons.length > 0, young, reasons, asks, waits, peers, unread };
}

/**
 * Is one peer-wait still justified? {stale, young, unknown, reasons, unread, peerIdleMs, peerProgress}.
 * A peer wait holds while the awaited peer is running and still moving. Past the grace window it is
 * stale when the peer finished, was archived or left running; when every job the wait names (its text
 * and refs) settled after it; or when the peer itself made no progress for the stall threshold - both
 * workflows then wait and nobody moves. A message from the peer is not staleness (the same rule as
 * judgeGate): one the Kernel acked while keeping the wait open was read and judged not enough, and a
 * pending one is returned in `unread` (UNREAD-PEER: the Kernel reads its inbox). A peer outside every
 * ledger in view cannot be judged (`unknown`, never alerted).
 */
export function judgePeerWait({ db, workflowId, wait, dbOf = () => null, now = Date.now(), thresholdMs = DEFAULT_STALL_MINUTES * 60_000, graceMs = GATE_GRACE_MS, busyOf = () => null }) {
  const young = now - wait.raisedAt < graceMs;
  const peerDb = wait.peer && wait.peer !== workflowId ? dbOf(wait.peer) : null;
  const peerRow = peerDb?.prepare('SELECT workflow_id, phase, archived_at FROM workflows WHERE workflow_id=?').get(wait.peer) ?? null;
  if (!peerRow) return { stale: false, young, unknown: true, reasons: [], unread: [], peerIdleMs: null, peerProgress: null };
  const reasons = [];
  const running = peerRow.archived_at == null && peerRow.phase === 'running';
  if (!running) reasons.push(`peer ${wait.peer} is ${peerRow.archived_at != null ? 'archived' : `phase ${peerRow.phase ?? 'unset'}`}, so it will land nothing more`);
  const unread = peerDeliveries(db, workflowId, [wait.peer], wait.raisedAt).filter((m) => m.status === 'pending');
  const jobOf = (id) => peerDb.prepare('SELECT job_id, status, updated_at FROM jobs WHERE job_id=?').get(id) ?? db.prepare('SELECT job_id, status, updated_at FROM jobs WHERE job_id=?').get(id);
  const jobs = [...new Set([...namedJobs(wait.text), ...wait.refs.filter((ref) => /^op-/.test(ref))])].filter((id) => !wait.holds.includes(id))
    .map(jobOf).filter(Boolean);
  if (jobs.length && jobs.every((j) => SETTLED.includes(j.status) && j.updated_at > wait.raisedAt)) {
    reasons.push(`named job(s) settled after the wait: ${jobs.map((j) => `${j.job_id} ${j.status} ${clock(j.updated_at)}`).join(', ')}`);
  }
  const peerProgress = lastProgress(peerDb, wait.peer);
  const peerIdleMs = now - peerProgress.at;
  // A quiet ledger is not an idle peer while a turn of it is running: nivo AUTH inc-9f2e1e7ff1f6 read
  // STALE-PEER-WAIT while its peer's op-backend.implement-82b3110067 worker (Devin) was mid-turn.
  // busyOf is asked only once the ledger says idle (it reads api status and the Kernel frame).
  let peerBusy = null;
  if (running && peerIdleMs > thresholdMs) {
    peerBusy = busyOf(wait.peer) ?? null;
    if (!peerBusy) reasons.push(`peer ${wait.peer} is idle too: no progress for ${minutes(peerIdleMs)}m (last ${peerProgress.kind} ${clock(peerProgress.at)})`);
  }
  return { stale: !young && reasons.length > 0, young, unknown: false, reasons, unread, peerIdleMs, peerProgress, peerBusy };
}

/* ------------------------------------------------------------ the frontier */

const jsonFrom = (stdout) => {
  const text = String(stdout ?? '').trim();
  if (!text) return null;
  try { return JSON.parse(text); } catch { /* fall through */ }
  const first = text.indexOf('{'), last = text.lastIndexOf('}');
  if (first >= 0 && last > first) { try { return JSON.parse(text.slice(first, last + 1)); } catch { /* not json */ } }
  return null;
};

/**
 * `api status --json` for one workflow — the frontier the watchdog reads every tick (a read
 * projection: it writes nothing). {ok, frontier, workers} or {ok:false, error}.
 */
export function apiFrontier(repo, workflowId, { timeoutMs = 120_000 } = {}) {
  const env = { ...process.env };
  delete env.ORCA_TERMINAL_HANDLE; delete env.STARCI_ROLE; delete env.STARCI_OP_JOB;
  const r = spawnSync(process.execPath, [API_FILE, 'status', '--repo', repo, '--workflow', workflowId, '--json'],
    { cwd: skillRoot, encoding: 'utf8', windowsHide: true, timeout: timeoutMs, env });
  const value = jsonFrom(r.stdout);
  if (r.status !== 0 || !value?.ok) return { ok: false, error: clipLine(value?.error ?? r.stderr ?? r.error?.message ?? `exit ${r.status}`, 160) };
  return { ok: true, frontier: value.frontier ?? {}, workers: value.workers ?? [], phase: value.phase ?? null };
}

/* ------------------------------------------------------------ the classification */

const gateLabel = (gate, held) => `${gate.incidentId} [${gate.kind}] holds ${held} queued job(s)`;
/**
 * The state of a workflow's Kernel turn from its attested terminal ('active', 'turn-idle', ...), or
 * null when there is no seat or the frame is unreadable. Read only (terminal show/read); a spec run
 * never reaches a real Orca (NODE_TEST_CONTEXT).
 */
export function kernelTurnState(db, workflowId, { show = terminalShow, read = terminalRead, env = process.env } = {}) {
  if (env.NODE_TEST_CONTEXT && show === terminalShow) return null;
  try {
    const terminal = parse(db?.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId)?.value_json, null)?.terminal;
    if (!terminal) return null;
    const shown = show({ terminal });
    if (!shown?.ok || shown.connected !== true) return null;
    const frame = read({ terminal, screen: true });
    if (!frame?.ok) return null;
    const lastOutputAt = Number(shown.terminal?.lastOutputAt);
    const outputAgeMs = Number.isFinite(lastOutputAt) && lastOutputAt > 0 ? Math.max(0, Date.now() - lastOutputAt) : null;
    let activeStaleMs = null;
    try { activeStaleMs = allocationMs('liveness.activeStaleMs'); } catch { /* trust the frame */ }
    return staleAwareState(classifyAgentScreen(frame.screen).state, outputAgeMs, activeStaleMs).state;
  } catch { return null; }
}

/** The label clause for settles a gate or wait defers: " (and) defers the settle of <jobs>". */
const settleLabel = (jobs, joined) => (jobs.length ? `${joined ? ' and' : ''} defers the settle of ${jobs.map((j) => j.job_id).join(', ')}` : '');

/** The ledger ({repo, db}) holding workflow `wf` among this one and every ledger in view, or null. */
export const ledgerLookup = ({ repo = null, db, ledgers = [] }) => (wf) => {
  for (const l of [{ repo, db }, ...ledgers]) {
    try { if (l.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(wf)) return { repo: l.repo ?? repo, db: l.db }; } catch { /* closed */ }
  }
  return null;
};

/**
 * Why a peer whose ledger is quiet is still working, memoized per workflow: a worker mid-turn (api status)
 * or its Kernel's turn; null when neither. judgePeerWait's `busyOf`.
 */
export function peerBusyProbe({ repo = null, db, ledgers = [], frontierOf = apiFrontier, kernelTurnOf = kernelTurnState }) {
  const find = ledgerLookup({ repo, db, ledgers });
  const memo = new Map();
  return (wf) => {
    if (!memo.has(wf)) {
      let why = null;
      try {
        const l = find(wf);
        const status = frontierOf(l?.repo ?? null, wf);
        const working = (status?.workers ?? []).filter((wk) => WORKING_LIVENESS.includes(wk.liveness));
        if (working.length) why = `worker ${working.map((wk) => wk.jobId).join(', ')} mid-turn`;
        else if (WORKING_LIVENESS.includes(kernelTurnOf(l?.db ?? null, wf))) why = 'its Kernel is mid-turn';
      } catch { /* unknown is not busy */ }
      memo.set(wf, why);
    }
    return memo.get(wf);
  };
}

/** The key of one gate or wait verdict in a pass's shared `verdicts` map (stallFindings fills it, owed.mjs reads it). */
export const verdictKey = (workflowId, incidentId) => `${workflowId}|${incidentId}`;

/**
 * Every stall finding of one ledger. `ledgers` is every ledger in view ([{repo, db}], this one
 * included) so a gate that names a peer in another ledger can see that peer's asks. `frontierOf`
 * is injectable (specs); it is called only for a workflow idle past the threshold or holding a
 * queued job that old. A `verdicts` Map receives every gate and peer-wait verdict (verdictKey), so
 * owed.mjs classifies the same pass without judging them again. Returns [{type, key, workflowId, repo, line, alert, ...}].
 */
export function stallFindings(db, {
  repo = null, ledgers = [], now = Date.now(), stallMinutes = stallMinutesOf(), frontierOf = apiFrontier,
  wanted = new Set(), graceMs = GATE_GRACE_MS, kernelTurnOf = kernelTurnState, verdicts = null,
} = {}) {
  const thresholdMs = stallMinutes * 60_000;
  const find = ledgerLookup({ repo, db, ledgers });
  const dbOf = (wf) => find(wf)?.db ?? null;
  const busyOf = peerBusyProbe({ repo, db, ledgers, frontierOf, kernelTurnOf });
  const out = [];
  for (const w of runningWorkflows(db)) {
    const wf = w.workflow_id;
    if (wanted.size && !wanted.has(wf)) continue;
    const progress = lastProgress(db, wf);
    const idleMs = now - progress.at;
    const queued = queuedJobs(db, wf);
    // A consumed-but-unsettled job a gate or wait names is held like a queued one: the Kernel
    // deferred its settle behind the recorded wait (api status heldSettleJobs).
    const settleOwed = settleOwedJobs(db, wf);
    const gates = ownerGates(db, wf).map((gate) => ({ gate, held: queued.filter((j) => heldBy(gate, j)), heldSettle: settleOwed.filter((j) => heldBy(gate, j)), verdict: judgeGate({ db, workflowId: wf, gate, repo, dbOf, now, graceMs }) }));

    const waits = peerWaits(db, wf).map((wait) => ({ wait, held: queued.filter((j) => heldBy(wait, j)), heldSettle: settleOwed.filter((j) => heldBy(wait, j)), verdict: judgePeerWait({ db, workflowId: wf, wait, dbOf, now, thresholdMs, graceMs, busyOf }) }));
    if (verdicts) for (const { gate, verdict } of gates) verdicts.set(verdictKey(wf, gate.incidentId), verdict);
    if (verdicts) for (const { wait, verdict } of waits) verdicts.set(verdictKey(wf, wait.incidentId), verdict);
    for (const { wait, held, heldSettle, verdict } of waits) {
      const label = `${wait.incidentId} [${PEER_WAIT_KIND}] on ${wait.peer ?? '?'}${held.length ? ` holds ${held.length} queued job(s)` : heldSettle.length ? '' : wait.holds.length ? ` holds ${wait.holds.join(', ')}` : ''}${settleLabel(heldSettle, held.length > 0)}`;
      if (verdict.stale) {
        out.push({ type: 'STALE-PEER-WAIT', key: `STALE-PEER-WAIT|${wf}|${wait.incidentId}`, workflowId: wf, repo, incidentId: wait.incidentId, peer: wait.peer, alert: true,
          reasons: verdict.reasons, line: `STALE-PEER-WAIT ${wf} ${label} for ${minutes(now - wait.raisedAt)}m: ${verdict.reasons.join('; ')}; tell its Kernel to re-check the prerequisite and resolve the wait (api incident --resolve), or the peer's Kernel to move` });
      } else {
        const why = verdict.young ? `raised ${minutes(now - wait.raisedAt)}m ago (inside the grace window)`
          : verdict.unknown ? `peer ${wait.peer ?? '?'} is not in any ledger in view; waits on: ${clipLine(wait.text, 120)}`
          : verdict.peerBusy ? `justified: peer ${wait.peer} is running and working (${verdict.peerBusy}; its ledger quiet ${minutes(verdict.peerIdleMs)}m); waits on: ${clipLine(wait.text, 120)}`
          : `justified: peer ${wait.peer} is running and moved ${minutes(verdict.peerIdleMs)}m ago (${verdict.peerProgress.kind}); waits on: ${clipLine(wait.text, 120)}`;
        out.push({ type: 'PEER-WAIT', key: `PEER-WAIT|${wf}|${wait.incidentId}`, workflowId: wf, repo, incidentId: wait.incidentId, peer: wait.peer, alert: false,
          line: `PEER-WAIT ${wf} ${label}: ${why}` });
      }
    }

    // A peer message still pending on a gated or waiting workflow releases nothing by itself; its
    // Kernel has not read it. One UNREAD-PEER line per message, naming what it may concern.
    const unread = new Map();
    for (const { gate, verdict } of gates) for (const m of verdict.unread ?? []) unread.set(m.key, { m, by: [...(unread.get(m.key)?.by ?? []), gate.incidentId] });
    for (const { wait, verdict } of waits) for (const m of verdict.unread ?? []) unread.set(m.key, { m, by: [...(unread.get(m.key)?.by ?? []), wait.incidentId] });
    for (const { m, by } of unread.values()) {
      out.push({ type: 'UNREAD-PEER', key: `UNREAD-PEER|${wf}|${m.key}`, workflowId: wf, repo, peerMessage: m.key, from: m.from ?? null, pendingSince: m.at, alert: false,
        line: `UNREAD-PEER ${wf} ${m.key} from ${m.from} [${m.kind ?? 'message'}] ${clipLine(m.subject, 60)}: pending since ${clock(m.at)} (${minutes(now - m.at)}m); ${by.join(', ')} may concern it and still holds; tell its Kernel to read api inbox and act on it` });
    }

    for (const { gate, held, heldSettle, verdict } of gates) {
      const label = `${gateLabel(gate, held.length)}${settleLabel(heldSettle, true)}`;
      if (verdict.stale) {
        out.push({ type: 'STALE-GATE', key: `STALE-GATE|${wf}|${gate.incidentId}`, workflowId: wf, repo, incidentId: gate.incidentId, raisedAt: gate.raisedAt, alert: true,
          reasons: verdict.reasons, line: `STALE-GATE ${wf} ${label} for ${minutes(now - gate.raisedAt)}m: ${verdict.reasons.join('; ')}; tell its Kernel to resolve it (api incident --resolve) with this evidence` });
      } else {
        const why = verdict.young ? `raised ${minutes(now - gate.raisedAt)}m ago (inside the grace window)`
          : `justified: ${[...verdict.asks.map((a) => `ask ${a.dispatchId} open in ${a.workflowId}`), ...verdict.waits.map((w) => `waits: ${w}`)].join(', ')
            || `no checkable condition, waits on: ${clipLine(gate.text, 120)}`}`;
        out.push({ type: 'GATE', key: `GATE|${wf}|${gate.incidentId}`, workflowId: wf, repo, incidentId: gate.incidentId, alert: false,
          gateKind: gate.kind, raisedAt: gate.raisedAt, young: verdict.young, asks: verdict.asks, waits: verdict.waits, text: clipLine(gate.text, 200),
          line: `GATE ${wf} ${label}: ${why}` });
      }
    }

    const oldQueued = queued.filter((j) => now - (j.updated_at ?? j.created_at) > thresholdMs);
    if (idleMs <= thresholdMs && !oldQueued.length) continue;
    const status = frontierOf(repo, wf);
    const frontier = status?.ok ? status.frontier ?? {} : null;

    if (frontier) {
      for (const item of frontier.queued ?? []) {
        const job = oldQueued.find((j) => j.job_id === item.jobId);
        if (!job || !['dependency-failed', 'dependency'].includes(item.queuedBecause) || !item.blockedBy?.job) continue;
        const blocker = db.prepare('SELECT job_id, status, updated_at FROM jobs WHERE job_id=?').get(item.blockedBy.job);
        if (!blocker || !SETTLED.includes(blocker.status)) continue;
        // The Kernel needs a turn to react to a blocker that just settled (nivo Modules re-enqueued
        // the failed blocker 9 s after it settled, yet the alert fired at "0m ago"): same grace as gates.
        if (now - blocker.updated_at < graceMs) continue;
        out.push({ type: 'STALE-WAIT', key: `STALE-WAIT|${wf}|${job.job_id}`, workflowId: wf, repo, jobId: job.job_id, alert: true,
          line: `STALE-WAIT ${wf} ${job.job_id} (${job.op_id ?? '-'}) ${item.queuedBecause} for ${minutes(now - (job.updated_at ?? job.created_at))}m: blocker ${blocker.job_id} settled ${blocker.status} ${minutes(now - blocker.updated_at)}m ago; the Kernel retries the blocker, re-points or drops this job` });
      }
    }

    if (idleMs <= thresholdMs) continue;
    const working = (status?.workers ?? []).filter((wk) => WORKING_LIVENESS.includes(wk.liveness));
    if (working.length) continue;
    const since = `idle ${minutes(idleMs)}m`;
    const gateBits = gates.filter((g) => g.held.length || g.heldSettle.length || !queued.length)
      .map(({ gate, held, heldSettle, verdict }) => `${gate.incidentId} ${verdict.stale ? 'STALE' : verdict.young ? 'new' : 'justified'}${held.length ? ` holds ${held.length}` : ''}${heldSettle.length ? ` defers settle of ${heldSettle.map((j) => j.job_id).join(', ')}` : ''}`);
    let reason;
    if (!frontier) reason = `frontier unreadable (${status?.error ?? 'no status'}); last progress ${progress.kind} ${clock(progress.at)}`;
    else {
      const causes = Object.entries(frontier.queuedCauses ?? {}).map(([c, n]) => `${c} ${n}`).join(', ');
      reason = [
        `frontier ${frontier.state ?? '?'}${frontier.actionable ? ' ACTIONABLE but the Kernel has not moved' : ''}`,
        causes ? `queued: ${causes}` : null,
        gateBits.length ? `gates: ${gateBits.join(', ')}` : null,
        `last progress ${progress.kind} ${clock(progress.at)}`,
        frontier.reason ? clipLine(frontier.reason, 140) : null,
      ].filter(Boolean).join('; ');
    }
    // A frontier parked on peer waits that all still hold is the peer's to move, not a stall: the
    // PEER-WAIT lines explain it and a STALE-PEER-WAIT alerts the moment one stops holding.
    const peerParked = frontier?.state === PEER_WAIT_KIND && !frontier.actionable && waits.length > 0 && waits.every((w) => !w.verdict.stale);
    // The same for a frontier parked on the owner (an open ask, or owner gates that all still hold,
    // settles they defer included - api status heldSettleJobs): the owner's to move, not a stall.
    const ownerParked = frontier?.state === 'awaiting-owner' && !frontier.actionable && gates.every((g) => !g.verdict.stale);
    // Parked on credential asks alone (api status frontier.credentialAskDispatches): they wait under the
    // owner's Telegram /creds and are never pushed; the owner digest only counts them.
    const credentialAsks = frontier?.credentialAskDispatches ?? [];
    const pendingAsks = (status?.awaitingOwner ?? []).filter((item) => item.answer === 'pending').map((item) => item.dispatchId);
    const credentialOnly = ownerParked && !gates.length && pendingAsks.length > 0 && pendingAsks.every((d) => credentialAsks.includes(d));
    out.push({ type: 'STALLED', key: `STALLED|${wf}`, workflowId: wf, repo, idleMinutes: minutes(idleMs), actionable: frontier?.actionable ?? null,
      frontierState: frontier?.state ?? null, frontierReason: frontier ? clipLine(frontier.reason, 240) || null : null, idleSince: progress.at,
      justifiedGate: gates.some((g) => !g.verdict.stale && !g.verdict.young), justifiedPeerWait: peerParked, justifiedOwnerWait: ownerParked, alert: !peerParked && !ownerParked,
      ...(credentialAsks.length ? { credentialAsks } : {}), ...(credentialOnly ? { credentialOnly } : {}),
      line: `STALLED ${wf} ${since}: ${reason}${peerParked ? ' (justified: every peer-wait still holds)' : ownerParked ? ' (justified: it waits on the owner)' : ''}` });
  }
  // Stalls first, then the gates and waits that explain them.
  const order = { STALLED: 0, 'STALE-GATE': 1, 'STALE-PEER-WAIT': 1, 'STALE-WAIT': 2, 'UNREAD-PEER': 3, GATE: 4, 'PEER-WAIT': 4 };
  return out.sort((a, b) => order[a.type] - order[b.type] || a.key.localeCompare(b.key));
}
