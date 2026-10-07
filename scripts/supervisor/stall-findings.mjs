// stall-findings.mjs - the findings of scripts/supervisor/stall.mjs stallFindings as data: one builder per finding type
// (STALE-PEER-WAIT / PEER-WAIT, UNREAD-PEER, STALE-GATE / GATE, STALE-WAIT, STATUS-UNREADABLE, SUPERVISOR-WAIT, STALLED). Each
// takes the judged verdicts of one workflow and the finding context `c` ({wf, repo, now}); none reads a ledger except
// the blocker lookup of STALE-WAIT.
import { clipLine } from '../lib/clip.mjs';
import { minutes } from '../lib/time.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';

/** The typed wait on a peer workflow (scripts/kernel/cli.mjs PEER_WAIT, openPeerWaits). */
export const PEER_WAIT_KIND = 'peer-wait';
export const clock = (ms) => new Date(ms).toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit' });

const gateLabel = (gate, held) => `${gate.incidentId} [${gate.kind}] holds ${held} queued job(s)`;
/** The label clause for settles a gate or wait defers: " (and) defers the settle of <jobs>". */
const settleLabel = (jobs, joined) => (jobs.length ? (joined && ' and' || '') + ' defers the settle of ' + jobs.map((j) => j.job_id).join(', ') : '');
const peerWaitLabel = ({ wait, held, heldSettle }) => `${wait.incidentId} [${PEER_WAIT_KIND}] on ${wait.peer ?? '?'}` + (held.length && ' holds ' + held.length + ' queued job(s)' || (!heldSettle.length && wait.holds.length && ' holds ' + wait.holds.join(', ')) || '') + settleLabel(heldSettle, held.length > 0);

/** Why a peer wait that is not stale is justified. */
const peerWaitWhy = ({ now }, { wait, verdict }) => {
  const waitsOn = verdict.until ? 'until ' + verdict.until.results.map((r) => r.condition + ' (' + (r.met ? 'met' : clipLine(r.evidence, 80)) + ')').join(', ') : clipLine(wait.text, 120);
  return (verdict.young && `raised ${minutes(now - wait.raisedAt)}m ago (inside the grace window)`)
    || (verdict.unknown && `peer ${wait.peer ?? '?'} is not in any ledger in view; waits on: ${clipLine(wait.text, 120)}`)
    || (verdict.peerBusy && `justified: peer ${wait.peer} is running and working (${verdict.peerBusy}; its ledger quiet ${minutes(verdict.peerIdleMs)}m); waits on: ${waitsOn}`)
    || `justified: peer ${wait.peer} is running and moved ${minutes(verdict.peerIdleMs)}m ago (${verdict.peerProgress.kind}); waits on: ${waitsOn}`;
};

/** The STALE-PEER-WAIT or PEER-WAIT finding of one judged peer wait. */
export const peerWaitFinding = (c, entry) => {
  const { wf, repo, now } = c;
  const { wait, verdict } = entry;
  const label = peerWaitLabel(entry);
  if (verdict.stale) {
    return { type: 'STALE-PEER-WAIT', key: `STALE-PEER-WAIT|${wf}|${wait.incidentId}`, workflowId: wf, repo, incidentId: wait.incidentId, peer: wait.peer, alert: true,
      reasons: verdict.reasons, line: `STALE-PEER-WAIT ${wf} ${label} for ${minutes(now - wait.raisedAt)}m: ${verdict.reasons.join('; ')}; tell its Kernel to re-check the prerequisite and resolve the wait (starci kernel incident --resolve), or the peer's Kernel to move` };
  }
  return { type: 'PEER-WAIT', key: `PEER-WAIT|${wf}|${wait.incidentId}`, workflowId: wf, repo, incidentId: wait.incidentId, peer: wait.peer, alert: false,
    line: `PEER-WAIT ${wf} ${label}: ${peerWaitWhy(c, entry)}` };
};

const addUnread = (unread, verdict, incidentId) => {
  for (const m of verdict.unread ?? []) unread.set(m.key, { m, by: [...(unread.get(m.key)?.by ?? []), incidentId] });
};

// A peer message still pending on a gated or waiting workflow releases nothing by itself; its
// Kernel has not read it. One UNREAD-PEER finding per message, naming what it may concern.
export const unreadPeerFindings = ({ wf, repo, now }, gates, waits) => {
  const unread = new Map();
  for (const { gate, verdict } of gates) addUnread(unread, verdict, gate.incidentId);
  for (const { wait, verdict } of waits) addUnread(unread, verdict, wait.incidentId);
  return [...unread.values()].map(({ m, by }) => ({ type: 'UNREAD-PEER', key: `UNREAD-PEER|${wf}|${m.key}`, workflowId: wf, repo, peerMessage: m.key, from: m.from ?? null, pendingSince: m.at, alert: false,
    line: `UNREAD-PEER ${wf} ${m.key} from ${m.from} [${m.kind ?? 'message'}] ${clipLine(m.subject, 60)}: pending since ${clock(m.at)} (${minutes(now - m.at)}m); ${by.join(', ')} may concern it and still holds; tell its Kernel to read starci kernel inbox and act on it` }));
};

/** The STALE-GATE or GATE finding of one judged owner gate. */
export const gateFinding = ({ wf, repo, now }, { gate, held, heldSettle, verdict }) => {
  const label = `${gateLabel(gate, held.length)}${settleLabel(heldSettle, true)}`;
  if (verdict.stale) {
    return { type: 'STALE-GATE', key: `STALE-GATE|${wf}|${gate.incidentId}`, workflowId: wf, repo, incidentId: gate.incidentId, gateKind: gate.kind, raisedAt: gate.raisedAt, alert: true,
      reasons: verdict.reasons, line: `STALE-GATE ${wf} ${label} for ${minutes(now - gate.raisedAt)}m: ${verdict.reasons.join('; ')}; ${gate.kind === 'supervisor-gate' ? 'the Supervisor resolves it --by supervisor' : 'tell its Kernel to resolve it (starci kernel incident --resolve) with this evidence'}` };
  }
  const details = [...verdict.asks.map((a) => 'ask ' + a.dispatchId + ' open in ' + a.workflowId), ...verdict.waits.map((w) => 'waits: ' + w)].join(', ');
  const why = (verdict.young && `raised ${minutes(now - gate.raisedAt)}m ago (inside the grace window)`)
    || 'justified: ' + (details || 'no checkable condition, waits on: ' + clipLine(gate.text, 120));
  return { type: 'GATE', key: `GATE|${wf}|${gate.incidentId}`, workflowId: wf, repo, incidentId: gate.incidentId, alert: false,
    gateKind: gate.kind, raisedAt: gate.raisedAt, young: verdict.young, asks: verdict.asks, waits: verdict.waits, text: clipLine(gate.text, 200),
    line: `GATE ${wf} ${label}: ${why}` };
};

/** The STALE-WAIT finding of one frontier-queued item whose blocker settled long enough ago, or null. */
const staleWaitOf = ({ wf, repo, now }, db, oldQueued, graceMs, item) => {
  const job = oldQueued.find((j) => j.job_id === item.jobId);
  if (!job || !['dependency-failed', 'dependency'].includes(item.queuedBecause) || !item.blockedBy?.job) return null;
  const blocker = db.prepare('SELECT job_id, status, updated_at FROM jobs WHERE job_id=?').get(item.blockedBy.job);
  if (!blocker || !SETTLED_JOB_LIST.includes(blocker.status)) return null;
  // The Kernel needs a turn to react to a blocker that just settled (a product's Modules re-enqueued
  // the failed blocker 9 s after it settled, yet the alert fired at "0m ago"): same grace as gates.
  if (now - blocker.updated_at < graceMs) return null;
  return { type: 'STALE-WAIT', key: `STALE-WAIT|${wf}|${job.job_id}`, workflowId: wf, repo, jobId: job.job_id, alert: true,
    line: `STALE-WAIT ${wf} ${job.job_id} (${job.op_id ?? '-'}) ${item.queuedBecause} for ${minutes(now - (job.updated_at ?? job.created_at))}m: blocker ${blocker.job_id} settled ${blocker.status} ${minutes(now - blocker.updated_at)}m ago; the Kernel retries the blocker, re-points or drops this job` };
};

export const staleWaitFindings = (c, db, frontier, oldQueued, graceMs) => (frontier.queued ?? []).map((item) => staleWaitOf(c, db, oldQueued, graceMs, item)).filter(Boolean);

/** Without a frontier the stall is unjudged: one STATUS-UNREADABLE finding naming the error, never alerted. */
export const statusUnreadableFinding = ({ wf, repo }, { status, running, idleMs, progress }) => ({ type: 'STATUS-UNREADABLE', key: `STATUS-UNREADABLE|${wf}`, workflowId: wf, repo, idleMinutes: minutes(idleMs), idleSince: progress.at,
  error: status?.error ?? 'no status', runningJobs: running.map((j) => j.job_id), alert: false,
  line: `STATUS-UNREADABLE ${wf} idle ${minutes(idleMs)}m: starci kernel status unreadable (${status?.error ?? 'no status'}); stall not judged${running.length ? '; running ' + running.map((j) => j.job_id + ' (' + (j.op_id ?? '-') + ')').join(', ') : ''}; last progress ${progress.kind} ${clock(progress.at)}` });

/** The Supervisor's pending repair: a supervisor-gate holds the remaining work. */
export const supervisorWaitFinding = ({ wf, repo }, gates) => {
  const incidents = gates.filter(({ gate }) => gate.kind === 'supervisor-gate').map(({ gate }) => gate.incidentId);
  return { type: 'SUPERVISOR-WAIT', key: `SUPERVISOR-WAIT|${wf}`, workflowId: wf, repo, incidentIds: incidents, alert: false,
    line: `SUPERVISOR-WAIT ${wf}: supervisor-gate ${incidents.join(', ')} holds the remaining work; the Supervisor resolves it --by supervisor` };
};

const stalledReason = (frontier, progress, gates, queued) => {
  const gateBits = gates.filter((g) => g.held.length || g.heldSettle.length || !queued.length)
    .map(({ gate, held, heldSettle, verdict }) => `${gate.incidentId} ${verdict.stale && 'STALE' || verdict.young && 'new' || 'justified'}${held.length ? ' holds ' + held.length : ''}${heldSettle.length ? ' defers settle of ' + heldSettle.map((j) => j.job_id).join(', ') : ''}`);
  const causes = Object.entries(frontier.queuedCauses ?? {}).map(([cause, n]) => `${cause} ${n}`).join(', ');
  return [
    `frontier ${frontier.state ?? '?'}${frontier.actionable ? ' ACTIONABLE but the Kernel has not moved' : ''}`,
    causes ? `queued: ${causes}` : null,
    gateBits.length ? `gates: ${gateBits.join(', ')}` : null,
    `last progress ${progress.kind} ${clock(progress.at)}`,
    frontier.reason ? clipLine(frontier.reason, 140) : null,
  ].filter(Boolean).join('; ');
};

/** The STALLED finding of a workflow idle past the threshold on a readable frontier. */
export const stalledFinding = ({ wf, repo }, { status, frontier, gates, waits, queued, progress, idleMs }) => {
  const reason = stalledReason(frontier, progress, gates, queued);
  // A frontier parked on peer waits that all still hold is the peer's to move, not a stall: the
  // PEER-WAIT lines explain it and a STALE-PEER-WAIT alerts the moment one stops holding.
  const peerParked = frontier?.state === PEER_WAIT_KIND && !frontier.actionable && waits.length > 0 && waits.every((w) => !w.verdict.stale);
  // The same for a frontier parked on the owner (an open ask, or owner gates that all still hold,
  // settles they defer included - starci kernel status heldSettleJobs): the owner's to move, not a stall.
  const ownerParked = frontier?.state === 'awaiting-owner' && !frontier.actionable && gates.every((g) => !g.verdict.stale);
  // Parked on credential asks alone (starci kernel status frontier.credentialAskDispatches): they wait under the
  // owner's Telegram /creds and are never pushed; the owner digest only counts them.
  const credentialAsks = frontier?.credentialAskDispatches ?? [];
  const pendingAsks = (status?.awaitingOwner ?? []).filter((item) => item.answer === 'pending').map((item) => item.dispatchId);
  const credentialOnly = ownerParked && !gates.length && pendingAsks.length > 0 && pendingAsks.every((d) => credentialAsks.includes(d));
  return { type: 'STALLED', key: `STALLED|${wf}`, workflowId: wf, repo, idleMinutes: minutes(idleMs), actionable: frontier?.actionable ?? null,
    frontierState: frontier?.state ?? null, frontierReason: frontier ? clipLine(frontier.reason, 240) || null : null, idleSince: progress.at,
    justifiedGate: gates.some((g) => !g.verdict.stale && !g.verdict.young), justifiedPeerWait: peerParked, justifiedOwnerWait: ownerParked, alert: !peerParked && !ownerParked,
    ...(credentialAsks.length ? { credentialAsks } : {}), ...(credentialOnly ? { credentialOnly } : {}),
    line: `STALLED ${wf} idle ${minutes(idleMs)}m: ${reason}${(peerParked && ' (justified: every peer-wait still holds)') || (ownerParked && ' (justified: it waits on the owner)') || ''}` };
};
