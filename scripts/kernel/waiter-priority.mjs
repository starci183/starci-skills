// waiter-priority.mjs — which open jobs other work waits on, and how long it has waited.
//
// A job a peer workflow waits on used to be just another queued row of its own workflow: its Kernel
// dispatched it in created order, and nothing told it that N workflows sat behind it (nivo AUTH waited
// on WSPV's op-backend.implement-82b3110067 for hours under inc-9f2e1e7ff1f6). This read-only
// projection finds every waiter of every open job of the ledger:
//
//   until-job      an open incident's typed --until-job condition names the job
//   until-record   an open incident's typed --until-record path is a record the job owns (produces)
//   gate-names     an open owner-gate / peer-wait of ANOTHER workflow names the job id in its text
//   peer-request   a pending peer request to the job's workflow names the job id, its op, or a
//                  .starciwork record path it owns
//   dependency     a queued job declared it --after
//
// Each job's `weight` is the sum over its waiters of 1 + hours waited, so more waiters and older
// waiters both rank it higher. api status orders frontier.queued by it and projects
// frontier.blockingOthers; when a queued job has blocked another workflow past BLOCKING_HEADS_UP_MS
// its own Kernel gets one heads-up (api.mjs blockingHeadsUp). The supervisor prints one BLOCKING line
// per job (scripts/supervisor/poll.mjs) and the progress report names it.

import { lineageHeadById, typedIncidents } from './gate-conditions.mjs';
import { allocationMs } from '../../engine/config.mjs';
import { posixPath } from '../lib/path-key.mjs';
import { parseJson, parseJsonOr, withPayload } from '../lib/json.mjs';

/** How long a queued job may block another workflow before its own Kernel is told
 * (modules/models/runtimes.yaml allocation.waiterPriority.blockingHeadsUpMs). */
export const BLOCKING_HEADS_UP_MS = allocationMs('waiterPriority.blockingHeadsUpMs');
export const BLOCKING_HEADS_UP_AUTO = 'blocking-waiters';
const SETTLED = ['succeeded', 'failed', 'cancelled'];
const GATE_KINDS = ['owner-gate', 'owner-gate-pending', 'peer-wait'];
const PEER_MESSAGE = 'peer-message';
// Job ids are op-<op>-<10 hex> (api enqueue).
const JOB_ID = /\bop-[a-z][a-z0-9.-]*?-[0-9a-f]{10}\b/gi;

const norm = (p) => posixPath(p).replace(/\/+$/, '');
const ownedRecordPaths = (payload) => (payload?.owned_paths ?? [])
  .map((p) => norm(typeof p === 'string' ? p : p?.path)).filter((p) => p.startsWith('.starciwork/'));
const within = (p, root) => p === root || p.startsWith(`${root}/`);
const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Every open job some waiter waits on: Map jobId -> {jobId, workflowId, opId, status, waiters[],
 * waitingWorkflows[], since, weight}. Waiters of finished or archived workflows do not count.
 */
export function blockingJobs(db, { now = Date.now() } = {}) {
  const live = new Set(db.prepare("SELECT workflow_id FROM workflows WHERE phase<>'finished' AND archived_at IS NULL").all().map((row) => row.workflow_id));
  const open = db.prepare(`SELECT job_id,workflow_id,op_id,status,payload_json,created_at FROM jobs
      WHERE kind<>'kernel' AND status NOT IN (${SETTLED.map(() => '?').join(',')}) ORDER BY created_at,job_id`).all(...SETTLED)
    .filter((row) => live.has(row.workflow_id))
    .map((row) => withPayload(row));
  const byId = new Map(open.map((row) => [row.job_id, row]));
  const out = new Map();
  const add = (job, waiter) => {
    if (!job || !live.has(waiter.workflowId) || (waiter.jobId && waiter.jobId === job.job_id)) return;
    let entry = out.get(job.job_id);
    if (!entry) {
      entry = { jobId: job.job_id, workflowId: job.workflow_id, opId: job.op_id ?? job.payload.opId ?? null, status: job.status, waiters: [] };
      out.set(job.job_id, entry);
    }
    if (entry.waiters.some((w) => w.workflowId === waiter.workflowId && w.via === waiter.via && w.ref === waiter.ref)) return;
    entry.waiters.push({ workflowId: waiter.workflowId, via: waiter.via, ref: waiter.ref, since: Number(waiter.since) || now });
  };
  // A named job is waited on through its retry lineage: a failed job's open retry is what blocks.
  const openHeadOf = (jobId) => byId.get(jobId) ?? byId.get(lineageHeadById(db, jobId)?.row.job_id);
  const jobsNamed = (text) => [...new Set(String(text ?? '').match(JOB_ID) ?? [])].map((id) => byId.get(id)).filter(Boolean);

  // Typed conditions: the strongest signal, the wait is machine-checked.
  let typed = [];
  try { typed = typedIncidents(db); } catch { typed = []; }
  for (const incident of typed) {
    for (const cond of incident.until) {
      if (cond.type === 'job') add(openHeadOf(cond.jobId), { workflowId: incident.workflowId, via: 'until-job', ref: incident.incidentId, since: incident.since });
      if (cond.type === 'record') {
        const want = norm(cond.path);
        for (const job of open) {
          if (ownedRecordPaths(job.payload).some((owned) => within(want, owned) || within(owned, want))) {
            add(job, { workflowId: incident.workflowId, via: 'until-record', ref: incident.incidentId, since: incident.since });
          }
        }
      }
    }
  }

  // Free-text gates of another workflow naming the job.
  const gates = db.prepare("SELECT incident_id,workflow_id,last_progress,updated_at FROM incidents WHERE status='open' ORDER BY updated_at").all()
    .filter((row) => live.has(row.workflow_id) && GATE_KINDS.includes(/^\[([^\]]+)\]/.exec(row.last_progress ?? '')?.[1]));
  for (const gate of gates) {
    const raised = db.prepare("SELECT payload_json,created_at FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1")
      .get(gate.workflow_id, gate.incident_id);
    const payload = parseJson(raised?.payload_json, {}) ?? {};
    const text = [gate.last_progress, payload.detail, ...(Array.isArray(payload.refs) ? payload.refs : [])].join(' ');
    for (const job of jobsNamed(text)) {
      if (job.workflow_id === gate.workflow_id) continue; // a gate naming its own job holds it; it does not wait on it
      add(job, { workflowId: gate.workflow_id, via: 'gate-names', ref: gate.incident_id, since: raised?.created_at ?? gate.updated_at });
    }
  }

  // Pending peer requests to the job's workflow naming the job, its op, or a record it owns.
  const requests = db.prepare("SELECT workflow_id,key,payload_json,created_at FROM inbox WHERE kind=? AND status='pending' ORDER BY inbox_id").all(PEER_MESSAGE)
    .map((row) => withPayload(row))
    .filter((row) => row.payload.kind === 'request' && row.payload.from && live.has(row.workflow_id));
  for (const request of requests) {
    const text = [request.payload.subject, request.payload.body, ...(Array.isArray(request.payload.refs) ? request.payload.refs : [])].join(' ');
    const normText = text.replace(/\\/g, '/');
    const waiter = { workflowId: request.payload.from, via: 'peer-request', ref: request.key, since: request.payload.at ?? request.created_at };
    for (const job of jobsNamed(text)) if (job.workflow_id === request.workflow_id) add(job, waiter);
    for (const job of open.filter((row) => row.workflow_id === request.workflow_id)) {
      const op = job.op_id ?? job.payload.opId;
      const opNamed = op && new RegExp(`(^|[^A-Za-z0-9.-])${op.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9-]|$)`).test(text);
      const recordNamed = ownedRecordPaths(job.payload).some((owned) => normText.includes(owned));
      if (opNamed || recordNamed) add(job, waiter);
    }
  }

  // Declared --after dependants.
  for (const job of open.filter((row) => row.status === 'queued')) {
    for (const priorId of Array.isArray(job.payload.after) ? job.payload.after : []) {
      add(openHeadOf(priorId), { workflowId: job.workflow_id, jobId: job.job_id, via: 'dependency', ref: job.job_id, since: job.created_at });
    }
  }

  for (const entry of out.values()) {
    entry.since = Math.min(...entry.waiters.map((w) => w.since));
    entry.waitingWorkflows = [...new Set(entry.waiters.map((w) => w.workflowId).filter((wf) => wf !== entry.workflowId))];
    entry.weight = round2(entry.waiters.reduce((sum, w) => sum + 1 + Math.max(0, now - w.since) / 3_600_000, 0));
  }
  return out;
}

/** The jobs of one workflow that OTHER workflows wait on, heaviest first (status frontier.blockingOthers). */
export function blockingOthersOf(blocking, workflowId, { now = Date.now() } = {}) {
  return [...blocking.values()]
    .filter((entry) => entry.workflowId === workflowId && entry.waitingWorkflows.length > 0)
    .map((entry) => {
      const cross = entry.waiters.filter((w) => w.workflowId !== workflowId);
      const since = Math.min(...cross.map((w) => w.since));
      return {
        jobId: entry.jobId, opId: entry.opId, status: entry.status, waiters: cross.length, workflows: entry.waitingWorkflows,
        since, waitedMinutes: Math.floor(Math.max(0, now - since) / 60_000), weight: entry.weight,
        via: cross.map((w) => ({ workflowId: w.workflowId, via: w.via, ref: w.ref, since: w.since })),
      };
    })
    .sort((a, b) => b.weight - a.weight || a.since - b.since);
}

/**
 * Order a workflow's queued projection by blocking weight, heaviest first, stable otherwise (foundation
 * legs still lead), and tag each blocking row with {waiters, workflows, weight, since}. Mutates and
 * returns `queued`.
 */
export function orderQueuedByBlocking(queued, blocking) {
  const weightOf = (item) => blocking.get(item.jobId)?.weight ?? 0;
  for (const item of queued) {
    const entry = blocking.get(item.jobId);
    if (entry) item.blocking = { waiters: entry.waiters.length, workflows: entry.waitingWorkflows, weight: entry.weight, since: entry.since };
  }
  const indexed = queued.map((item, index) => ({ item, index }));
  // Foundation legs (api enqueue --foundation) keep leading the list; blocking weight orders within.
  const foundationOf = (item) => Number(Boolean(item.foundation));
  indexed.sort((a, b) => foundationOf(b.item) - foundationOf(a.item) || weightOf(b.item) - weightOf(a.item) || a.index - b.index);
  queued.splice(0, queued.length, ...indexed.map(({ item }) => item));
  return queued;
}

/**
 * The queued jobs of `workflowId` that have blocked another workflow past `thresholdMs` and whose
 * heads-up has not yet named every workflow now waiting: [{entry, fresh[]}] (fresh = the waiting
 * workflows no earlier heads-up named).
 */
export function blockingHeadsUpDue(db, blocking, workflowId, { now = Date.now(), thresholdMs = BLOCKING_HEADS_UP_MS } = {}) {
  const due = [];
  for (const entry of blockingOthersOf(blocking, workflowId, { now })) {
    if (entry.status !== 'queued' || now - entry.since < thresholdMs) continue;
    const told = new Set(db.prepare('SELECT payload_json FROM inbox WHERE workflow_id=? AND kind=? ORDER BY inbox_id').all(workflowId, PEER_MESSAGE)
      .map((row) => parseJsonOr(row.payload_json))
      .filter((payload) => payload.auto === BLOCKING_HEADS_UP_AUTO && payload.blockingJob === entry.jobId)
      .flatMap((payload) => (Array.isArray(payload.waitingWorkflows) ? payload.waitingWorkflows : [])));
    const fresh = entry.workflows.filter((wf) => !told.has(wf));
    if (fresh.length) due.push({ entry, fresh });
  }
  return due;
}

const shortWf = (wf) => String(wf).replace(/^wf-/, '').replace(/-[a-z0-9]{8}$/i, '');

/** One supervisor line per job another workflow waits on (scripts/supervisor/poll.mjs BLOCKING). */
export function blockingLines(db, { now = Date.now(), wanted = new Set() } = {}) {
  const blocking = blockingJobs(db, { now });
  const owners = [...new Set([...blocking.values()].map((entry) => entry.workflowId))];
  return owners.flatMap((wf) => blockingOthersOf(blocking, wf, { now })
    .filter((entry) => !wanted.size || wanted.has(wf) || entry.workflows.some((w) => wanted.has(w)))
    .map((entry) => `BLOCKING ${shortWf(wf)} ${entry.jobId} (${entry.opId ?? '-'}, ${entry.status}) blocks ${entry.workflows.length} workflow(s) [${entry.workflows.map(shortWf).join(', ')}] for ${entry.waitedMinutes}m via ${[...new Set(entry.via.map((v) => `${v.via} ${v.ref}`))].join(', ')}${entry.status === 'queued' ? '; not dispatched yet — its Kernel should dispatch it first' : ''}`));
}
