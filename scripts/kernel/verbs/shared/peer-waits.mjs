// api-lib/peers.mjs — the peer-messaging machinery of the kernel api (split out of cli.mjs,
// lane slim-api). Several workflows of one product repo share its ledger and build in the
// same source repositories. With no channel between their Kernels a
// Collab Kernel that needed the Login workflow's phone verification asked the
// owner who should build it, two workflows edited overlapping areas, and a
// repo-wide migration was owned by no workflow. Peers now talk through the
// ledger inbox (kind peer-message): `starci kernel notify` writes one pending row per
// target, the target's status frontier is actionable until its Kernel reads
// `starci kernel inbox` and acks each row with a disposition the sender can read back,
// and `starci kernel enqueue` sends an automatic heads-up when a new job's owned_paths
// overlap an open job of a peer. These are Kernel verbs; an op never sends.
//
// PEER RULE: every other workflow of the same ledger that is phase running,
// not archived, and shares a source root with this one; a workflow with no
// recorded roots shares every root. define-goal records the ledger's own repo
// as each workflow's source_roots_json and a job's `repository` is rarely set,
// so in practice every running workflow of one ledger is a peer: the ledger
// is one product and its binding spans the product's repositories.
import path from 'node:path';
import { JOB_STATUSES, newToken, postInbox, resolveIncident } from '../../../../engine/db/ledger.mjs';
import { leaseCompareForm, ownedPathsIntersect } from '../../../../engine/admission.mjs';
import { parseJson } from '../../../lib/json.mjs';
import { leaseCanonicalizer } from '../../lease-canon.mjs';
import { autoResolveTypedIncidents } from '../../gate-conditions.mjs';
import { wakeKernelForTransition } from '../../wake-delivery.mjs';
import { BLOCKING_HEADS_UP_AUTO, blockingHeadsUpDue, blockingJobs } from '../../waiter-priority.mjs';
import { getWorkflow, jobPayloadOf, ownedPathsOf } from './rows.mjs';

export const PEER_MESSAGE = 'peer-message';
const PEER_OPEN_JOB_STATUSES = [...JOB_STATUSES.dispatchable, ...JOB_STATUSES.fenced];
const sourceRootKey = (root) => {
  const resolved = path.resolve(String(root)).replace(/[\\/]+$/, '');
  return process.platform === 'win32' ? resolved.toLowerCase() : resolved;
};
const sourceRootsOf = (wf) => {
  const roots = parseJson(wf?.source_roots_json ?? '', null);
  return Array.isArray(roots) ? roots.filter((root) => typeof root === 'string' && root.trim()).map(sourceRootKey) : [];
};
const sharesSourceRoot = (a, b) => {
  const left = sourceRootsOf(a), right = sourceRootsOf(b);
  return !left.length || !right.length || left.some((root) => right.includes(root));
};
export const peerWorkflowsOf = (db, self) => db.prepare("SELECT * FROM workflows WHERE workflow_id<>? AND phase='running' AND archived_at IS NULL ORDER BY created_at,workflow_id")
  .all(self.workflow_id).filter((wf) => sharesSourceRoot(self, wf));
/** Why `to` is not a running peer of `self`, or null when it is. */
export const peerRefusalOf = (db, self, to) => {
  if (to === self.workflow_id) return { code: 'peer-self', detail: `${to} is the sending workflow itself` };
  const wf = getWorkflow(db, to);
  if (!wf) return { code: 'peer-unknown', detail: `no workflow ${to} in this ledger` };
  if (wf.phase !== 'running' || wf.archived_at != null) {
    return { code: 'peer-not-running', detail: `${to} is ${wf.archived_at != null ? 'archived' : `phase ${wf.phase ?? 'unset'}`}; only a running workflow is a peer` };
  }
  if (!sharesSourceRoot(self, wf)) return { code: 'peer-not-shared-source', detail: `${to} shares no source root with ${self.workflow_id}` };
  return null;
};
export const peerOpenJobsOf = (db, workflowId) => db.prepare(`SELECT job_id,op_id,status,try_no AS attempt,payload_json,created_at,updated_at FROM jobs
    WHERE workflow_id=? AND kind<>'kernel' AND status IN (${PEER_OPEN_JOB_STATUSES.map(() => '?').join(',')}) ORDER BY created_at,job_id`)
  .all(workflowId, ...PEER_OPEN_JOB_STATUSES)
  .map((row) => ({ jobId: row.job_id, op: row.op_id ?? jobPayloadOf(row).opId ?? null, status: row.status, attempt: row.attempt,
    paths: ownedPathsOf(jobPayloadOf(row)), updatedAt: row.updated_at ?? row.created_at ?? 0 }));
/** A workflow's current leg: its most recently moved in-flight job, else its latest queued one. */
export const currentLegOf = (jobs) => {
  const inFlight = jobs.filter((job) => job.status !== 'queued').sort((a, b) => b.updatedAt - a.updatedAt)[0] ?? null;
  const pick = inFlight ?? jobs.filter((job) => job.status === 'queued').at(-1) ?? null;
  return pick ? { jobId: pick.jobId, op: pick.op, status: pick.status, attempt: pick.attempt } : null;
};
export const peerMessageOf = (row) => {
  const payload = parseJson(row.payload_json, {}) ?? {};
  return {
    key: row.key, to: row.workflow_id, from: payload.from ?? null, fromTitle: payload.fromTitle ?? null, kind: payload.kind ?? null,
    subject: payload.subject ?? null, body: payload.body ?? null, replyTo: payload.replyTo ?? null,
    refs: Array.isArray(payload.refs) ? payload.refs : [], at: payload.at ?? row.created_at,
    status: row.status, disposition: parseJson(row.disposition_json ?? '', null), appliedAt: row.applied_at ?? null,
  };
};
// Every peer-message row, read by kind and filtered in JS: json_extract over
// the whole inbox would also parse the other kinds' payloads.
export const peerMessageRows = (db) => db.prepare('SELECT * FROM inbox WHERE kind=? ORDER BY inbox_id').all(PEER_MESSAGE);
export const pendingPeerMessagesOf = (db, workflowId) => db.prepare("SELECT * FROM inbox WHERE workflow_id=? AND kind=? AND status='pending' ORDER BY inbox_id")
  .all(workflowId, PEER_MESSAGE).map(peerMessageOf);
const pathsIntersectSafe = (a, b) => { try { return ownedPathsIntersect(a, b); } catch { return false; } };
/**
 * One pending peer-message row in `to`'s inbox plus the sender's 'peer-message-sent' event. The
 * caller holds the transaction and has already proven `to` a running peer.
 */
export const writePeerMessage = (ledger, { from, to, kind, subject, body, replyTo = null, refs = [], extra = {}, now = Date.now() }) => {
  const key = `pm-${newToken().slice(0, 12)}`;
  const payload = { from: from.workflow_id, fromTitle: from.title ?? null, kind, subject, body, replyTo, refs, at: now, ...extra };
  postInbox(ledger.db, { workflowId: to, kind: PEER_MESSAGE, key, fromRef: from.workflow_id, payload, createdAt: now });
  ledger.appendEvent({ workflowId: from.workflow_id, entityType: 'workflow', entityId: from.workflow_id, kind: 'peer-message-sent',
    payload: { to, key, kind, subject, replyTo, ...(extra.auto ? { auto: extra.auto } : {}) } });
  return { to, key, kind, subject };
};
/* A workflow's open peer-wait incidents (starci kernel incident --kind peer-wait). A wait whose peer is no
 * longer running can never be met by it, so it is the Kernel's move again (frontier.peerWaitsDead). */
export const PEER_WAIT = 'peer-wait';
export const openPeerWaits = (db, workflowId) => db.prepare("SELECT incident_id,op_id,last_progress,updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId)
  .map((row) => {
    const kind = /^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1] ?? null;
    if (kind !== PEER_WAIT) return null;
    const raised = db.prepare("SELECT payload_json,created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, row.incident_id);
    const payload = parseJson(raised?.payload_json, {}) ?? {};
    const peer = typeof payload.peer === 'string' ? payload.peer : null;
    const peerRow = peer ? getWorkflow(db, peer) : null;
    return {
      incidentId: row.incident_id, opId: row.op_id ?? null, peer,
      holds: Array.isArray(payload.holds) && payload.holds.length ? payload.holds : [row.op_id].filter(Boolean),
      detail: payload.detail ?? String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, ''),
      untilMessage: payload.untilMessage === true, refs: Array.isArray(payload.refs) ? payload.refs : [],
      // A typed release condition: the wait is met when the named shared foundation lands (starci kernel foundation --land).
      untilFoundation: typeof payload.untilFoundation === 'string' ? payload.untilFoundation : null,
      // A typed release on the peer's product land (--until-landed <wf>@<repository>).
      untilLanded: typeof payload.untilLanded === 'string' ? payload.untilLanded : null,
      since: raised?.created_at ?? row.updated_at,
      peerPhase: peerRow ? (peerRow.archived_at != null ? 'archived' : peerRow.phase ?? null) : 'unknown',
      peerRunning: Boolean(peerRow && peerRow.phase === 'running' && peerRow.archived_at == null),
    };
  })
  .filter(Boolean);
/**
 * A peer message from `peer` just reached `waiter`. Each open peer-wait of `waiter` on `peer` marked
 * --until-message is resolved (incident-resolved {detail, peerMessage}), and the waiter's Kernel is
 * woken best-effort: a turn-idle Kernel gets the wake now instead of at the next watchdog tick (the
 * pending message already makes its frontier peer-message, actionable). Null when `waiter` waits on
 * nothing from `peer`; otherwise {waits, resolved, wake}.
 */
export const peerWaitMessageArrived = (ledger, { waiter, peer, key, kind, subject }) => {
  const db = ledger.db;
  const waits = openPeerWaits(db, waiter).filter((wait) => wait.peer === peer);
  if (!waits.length) return null;
  const resolved = waits.filter((wait) => wait.untilMessage).map((wait) => wait.incidentId);
  if (resolved.length) {
    ledger.transaction(() => {
      const now = Date.now();
      for (const incidentId of resolved) {
        resolveIncident(db, { incidentId, reason: 'answered', at: now });
        ledger.appendEvent({ workflowId: waiter, entityType: 'incident', entityId: incidentId, kind: 'incident-resolved',
          payload: { detail: `peer-wait met by peer message ${key} (${kind}) from ${peer}: ${subject}`, peerMessage: key, peer, by: 'peer-message' } });
      }
    });
  }
  const wake = wakeKernelForTransition(ledger, {
    workflowId: waiter, transition: 'peer-wait-message',
    lines: [
      `Peer ${peer} sent ${kind} ${key} (${subject}), which peer-wait ${waits.map((wait) => wait.incidentId).join(', ')} waits on${resolved.length ? `; ${resolved.join(', ')} resolved by it` : ''}.`,
      'Re-read canonical starci kernel status and starci kernel inbox now; verify the prerequisite the wait named actually holds before you enqueue the held work, ack the message, and resolve any wait still open once its proof holds (or record a new peer-wait when it does not).',
    ],
  });
  return { waits: waits.map((wait) => wait.incidentId), resolved, wake: wake.action };
};
/**
 * Typed wait conditions (scripts/kernel/gate-conditions.mjs): resolve every open incident (of
 * `workflowId`, else ledger-wide) whose --until-* conditions all hold, which releases the queued jobs
 * and settles it held. With `wake`, each resolved incident's Kernel other than `self` (the caller's
 * own, already awake) gets a transition wake. Never throws: the caller's verb must not fail on it.
 * Returns {resolved, open} (gate-conditions.mjs autoResolveTypedIncidents).
 */
export const releaseTypedWaits = (ledger, { repo, workflowId = null, wake = false, self = null }) => {
  let result = { resolved: [], open: [] };
  try { result = autoResolveTypedIncidents(ledger, { repo, workflowId }); } catch { return result; }
  if (!wake) return result;
  for (const waiter of [...new Set(result.resolved.map((r) => r.workflowId))].filter((wf) => wf !== self)) {
    const mine = result.resolved.filter((r) => r.workflowId === waiter);
    let action;
    try {
      action = wakeKernelForTransition(ledger, {
        workflowId: waiter, transition: 'incident-auto-resolved',
        lines: [
          `Every typed condition of ${mine.map((r) => `${r.incidentId} (${r.kind ?? '-'}${r.holds.length ? `, held ${r.holds.join(', ')}` : ''})`).join(', ')} holds: ${mine.flatMap((r) => r.evidence).join('; ').slice(0, 600)}.`,
          'The runtime resolved the wait and released what it held. Re-read canonical starci kernel status now: route and dispatch the released work, or check and settle a released settle, then continue the approved frontier.',
        ],
      }).action;
    } catch (error) { action = `kernel-wake-failed: ${String(error?.message ?? error).slice(0, 120)}`; }
    for (const r of mine) r.wake = action;
  }
  return result;
};
/**
 * One heads-up per queued job of `self` that has blocked another workflow past BLOCKING_HEADS_UP_MS
 * and per newly waiting workflow (waiter-priority.mjs blockingHeadsUpDue), sent into `self`'s inbox
 * from the longest-waiting workflow. Never throws: status must not fail on it.
 */
export const blockingHeadsUp = (ledger, { self, blocking, now = Date.now() }) => {
  const sent = [];
  try {
    for (const { entry, fresh } of blockingHeadsUpDue(ledger.db, blocking, self.workflow_id, { now })) {
      const oldest = entry.via.filter((v) => fresh.includes(v.workflowId)).sort((x, y) => x.since - y.since)[0]?.workflowId ?? fresh[0];
      const from = getWorkflow(ledger.db, oldest);
      if (!from) continue;
      const refs = [...new Set(entry.via.map((v) => v.ref))];
      const subject = `${entry.workflows.length} workflow(s) wait on ${entry.jobId} (${entry.opId ?? '-'})`;
      const body = `${entry.jobId} (${entry.opId ?? '-'}) is still queued in ${self.workflow_id} while ${entry.workflows.join(', ')} wait on it `
        + `(${entry.via.map((v) => `${v.workflowId} via ${v.via} ${v.ref}`).join('; ')}), the oldest for ${entry.waitedMinutes} minutes. `
        + 'Dispatch it before other queued work (starci kernel status frontier.blockingOthers; frontier.queued already ranks it first). If it cannot run yet, '
        + 'tell the waiting workflows why (starci kernel notify --kind heads-up), then ack this message with what you did.';
      ledger.transaction(() => { sent.push(writePeerMessage(ledger, { from, to: self.workflow_id, kind: 'heads-up', subject, body, refs: [entry.jobId, ...refs],
        extra: { auto: BLOCKING_HEADS_UP_AUTO, blockingJob: entry.jobId, waitingWorkflows: entry.workflows }, now })); });
    }
  } catch { /* the heads-up is best-effort */ }
  return sent;
};
/**
 * The waiter-priority view of one job for route: how many waiters it has across workflows and the
 * queued jobs of its workflow that outrank it (scripts/kernel/waiter-priority.mjs). Advisory: route
 * never refuses on it; the Kernel dispatches the heavier job first. Null when nothing is involved.
 */
export const blockingViewOf = (db, job) => {
  let blocking;
  try { blocking = blockingJobs(db); } catch { return null; }
  const own = blocking.get(job.job_id) ?? null;
  const weight = own?.weight ?? 0;
  const outrankedBy = [...blocking.values()]
    .filter((entry) => entry.workflowId === job.workflow_id && entry.jobId !== job.job_id && entry.status === 'queued' && entry.weight > weight)
    .sort((a, b) => b.weight - a.weight)
    .map((entry) => ({ jobId: entry.jobId, opId: entry.opId, weight: entry.weight, workflows: entry.waitingWorkflows }));
  if (!own && !outrankedBy.length) return null;
  return { waiters: own?.waiters.length ?? 0, workflows: own?.waitingWorkflows ?? [], weight, outrankedBy };
};
// The lease-canonical form a path takes for the overlap comparison (scripts/kernel/lease-canon.mjs);
// null when the canonicalizer cannot be built for this repo.
export const leaseCanonOf = (db, repo) => { try { return leaseCanonicalizer({ repo, db }); } catch { return null; } };
/**
 * The enqueue-time overlap heads-up. Every open job of a running peer holding an owned path equal to,
 * above or below one of the new job's paths is returned as {workflowId, jobId, path, ownPath}, and
 * each such peer gets ONE heads-up naming the overlapping job pairs. A job pair already announced
 * (either direction) is never announced again. Nothing is blocked: the capacity-1 path leases
 * dispatch takes already serialize the writes.
 */
export const peerOverlapHeadsUp = (ledger, { self, jobId, op, ownedPaths, now = Date.now(), repo = null, payload = {} }) => {
  const db = ledger.db, overlap = [], messages = [];
  const peers = peerWorkflowsOf(db, self);
  if (!peers.length) return { overlap, messages };
  // Compared in the lease form (scripts/kernel/lease-canon.mjs): a bare and a repository-prefixed
  // spelling of one file are one path here too (inc-52a4a5ee5b12).
  const canon = repo ? leaseCanonOf(db, repo) : null;
  const formOf = (owned, context) => { try { return leaseCompareForm(canon ? canon.canonical(owned, context) : owned); } catch { return null; } };
  const ownForms = ownedPaths.map((own) => ({ own, form: formOf(own, { op, payload }) }));
  const pairKey = (other) => [jobId, other].sort().join('|');
  const announced = new Set(peerMessageRows(db).flatMap((row) => {
    const pairs = parseJson(row.payload_json, {})?.overlapPairs;
    return Array.isArray(pairs) ? pairs : [];
  }));
  for (const peer of peers) {
    const hits = [];
    for (const job of peerOpenJobsOf(db, peer.workflow_id)) {
      const peerPayload = canon ? jobPayloadOf(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(job.jobId) ?? {}) : {};
      for (const peerPath of job.paths) {
        const peerForm = formOf(peerPath, { op: job.op, payload: peerPayload });
        const ownPath = ownForms.find(({ own, form }) => (form && peerForm ? pathsIntersectSafe(form, peerForm) : pathsIntersectSafe(own, peerPath)))?.own;
        if (ownPath) hits.push({ workflowId: peer.workflow_id, jobId: job.jobId, op: job.op, path: peerPath, ownPath });
      }
    }
    if (!hits.length) continue;
    overlap.push(...hits.map(({ workflowId, jobId: peerJob, path: peerPath, ownPath }) => ({ workflowId, jobId: peerJob, path: peerPath, ownPath })));
    const fresh = hits.filter((hit) => !announced.has(pairKey(hit.jobId)));
    if (!fresh.length) continue;
    const pairs = [...new Set(fresh.map((hit) => pairKey(hit.jobId)))];
    for (const pair of pairs) announced.add(pair);
    const peerJobs = [...new Set(fresh.map((hit) => hit.jobId))];
    const subject = `overlap: ${op} (${jobId}) owns paths your open job${peerJobs.length > 1 ? 's' : ''} ${peerJobs.join(', ')} own${peerJobs.length > 1 ? '' : 's'}`;
    const body = `${self.title ?? self.workflow_id} (${self.workflow_id}) enqueued ${op} as ${jobId} owning ${ownedPaths.join(', ')}. `
      + `It overlaps ${fresh.map((hit) => `${hit.jobId} (${hit.op ?? '-'}) ${hit.path}`).join('; ')}. `
      + 'The path lease serializes the writes and nothing is blocked. If the two changes conflict in intent or in a shared contract, '
      + `agree the order or the owner of the change with ${self.workflow_id} (starci kernel notify --kind reply --reply-to <this key>), then ack this message with what you decided.`;
    messages.push(writePeerMessage(ledger, { from: self, to: peer.workflow_id, kind: 'heads-up', subject, body,
      refs: [jobId, ...peerJobs], extra: { auto: 'enqueue-overlap', overlapPairs: pairs }, now }));
  }
  return { overlap, messages };
};
