// Orchestration messages of a workflow's Orca Runs, bridged into the ledger, and the worker questions read from it.
//
// Transport (orca-deep-map REPLACE #7): each Run's coordinator inbox is drained through Orca's consuming
// `orchestration check --run <run> --terminal <kernel>` (scripts/api/orca/check.mjs). A Delivery is up to 50
// messages of every type and replays until it is acknowledged, so the order is: check, write EVERY message of the
// Delivery into the ledger in one transaction, and only after that commit `--ack <delivery>` (the ack call returns the
// next Delivery). A crash between the commit and the ack replays the Delivery; every write is keyed by the Orca message
// id, so the replay writes nothing twice. Smoke E2 (2026-10-01, Orca 1.4.209) measured it from a process outside any
// Orca terminal: accepted, replayed until --ack, the ack idempotent, and consumer_fenced only when the terminal named is
// not the Run's current coordinator.
//
// Routes (nothing in a Delivery is skipped):
//   question, escalation  inbox row kind worker-question (the Kernel answers it with starci kernel reply)
//   heartbeat             counted on the Delivery's event only: Orca keeps dispatch.lastHeartbeatAt (worker-show), which
//                         is what lease renewal reads, and one product Run held 2616 of them
//   every other type      one event kind orchestration-message per message (worker_done included: the Orca-side echo, kept for
//                         audit; settlement reads the Dispatch state with worker-show, never these rows)
// The ledger rows are what survives Orca's inbox and what the Kernel reads through api (status, questions, messages).
import { JOB_STATUSES, postInbox, setInboxStatusByKey } from '../../../../engine/db/ledger.mjs';
import { parseJson } from '../../../lib/json.mjs';
import { canonicalJSON } from '../../../../engine/canonical-json.mjs';
import { shortHash } from '../../../lib/hash.mjs';
import { check as orcaCheck } from '../../../api/orca/check.mjs';
import { JOB_ROW, latestKernelJobOf } from '../../../machine/job-row.mjs';
import { jobRunIds } from '../../../machine/terminal-ledger.mjs';
import { contractDispatchIdOf, jobPayloadOf, operationTerminalHandleOf, verbWorkflow } from './rows.mjs';

export const WORKER_QUESTION = 'worker-question';
const ORCHESTRATION_MESSAGE = 'orchestration-message';
export const ORCHESTRATION_DELIVERY = 'orchestration-delivery-bridged';
/** One drain acknowledges at most this many Deliveries (50 messages each); the next drain continues. */
const MAX_DELIVERIES_PER_DRAIN = 40;
const ANSWERABLE_MESSAGE_TYPES = new Set(['question', 'escalation']);
const COUNTED_ONLY_TYPES = new Set(['heartbeat']);
const BODY_MAX = 4000;
export const OWNER_ROUTED_REPLY = [
  'This question needs the owner, and an Orca ask never reaches them.',
  'Do not wait for a reply here: write your report.json with outcome ask and question {text, options},',
  'file it with starci kernel report exactly as your contract says, and end your turn.',
  'The Kernel serves the question to the owner (serve-ask) and re-enqueues this operation with the answer bound.',
].join(' ');
const workflowRunIdsOf = (db, workflowId) => {
  const ids = new Set();
  for (const row of db.prepare('SELECT payload_json FROM jobs WHERE workflow_id=?').all(workflowId)) {
    const payload = jobPayloadOf(row);
    for (const id of jobRunIds(payload)) ids.add(id);
  }
  return ids;
};
const jobDispatchIdsOf = (db, job) => {
  const payload = jobPayloadOf(job);
  return new Set([payload.managed?.dispatchId, payload.orca?.dispatchId, payload.hierarchy?.runtime?.dispatchId, contractDispatchIdOf(db, job)].filter(Boolean));
};
const operationJobsOf = (db, workflowId) => db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE workflow_id=? AND kind<>'kernel'`).all(workflowId);

/** The job a message came from: its dispatch (payload.dispatchId or from_handle dispatch:<id>) or its terminal handle. */
const senderOf = (db, jobs, message, body) => {
  const from = String(message.from_handle ?? '');
  const dispatchId = body.dispatchId ?? (from.startsWith('dispatch:') ? from.slice('dispatch:'.length) : null);
  const job = jobs.find((row) => (dispatchId && jobDispatchIdsOf(db, row).has(dispatchId))
    || (from && operationTerminalHandleOf(row) === from)) ?? null;
  return { from: from || null, dispatchId, job };
};

/** The ledger form of one Orca message, keyed by its id. */
function recordOf(db, jobs, message, deliveryId) {
  const body = parseJson(message.payload ?? '', {}) ?? {};
  const { from, dispatchId, job } = senderOf(db, jobs, message, body);
  return {
    messageId: String(message.id), type: String(message.type ?? 'message'), runId: message.run_id ?? null, deliveryId,
    from, to: message.to_handle ?? null, threadId: message.thread_id && message.thread_id !== message.id ? message.thread_id : null,
    jobId: job?.job_id ?? null, opId: job?.op_id ?? null, attempt: job?.attempt ?? null, dispatchId, taskId: body.taskId ?? null,
    subject: message.subject == null ? null : String(message.subject).slice(0, 300),
    body: String(body.question ?? message.body ?? '').slice(0, BODY_MAX),
    options: Array.isArray(body.options) ? body.options : [],
    outcome: body.outcome ?? null, reportPath: body.reportPath ?? body.report_path ?? null,
    createdAt: message.created_at ?? null,
  };
}

const questionPayloadOf = (r) => ({ messageId: r.messageId, type: r.type, runId: r.runId, jobId: r.jobId, opId: r.opId, attempt: r.attempt,
  dispatchId: r.dispatchId, taskId: r.taskId, question: r.body, options: r.options, subject: r.subject, askedAt: r.createdAt, from: r.from });

/**
 * Write every message of one Delivery into the ledger (call inside a transaction). Already written ids are skipped.
 * {questions, messages, heartbeats, types}.
 */
function bridgeDelivery(ledger, { workflowId, runId, deliveryId, messages }) {
  const db = ledger.db, jobs = operationJobsOf(db, workflowId), now = Date.now();
  const payloadDigest = shortHash(canonicalJSON(messages), { n: 64 });
  const known = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind=? AND json_extract(payload_json,'$.runId')=? AND json_extract(payload_json,'$.deliveryId')=? LIMIT 1")
    .get(workflowId, ORCHESTRATION_DELIVERY, runId, deliveryId);
  if (known) return replayDelivery({ runId, deliveryId, payloadDigest, known });
  const counts = { questions: 0, messages: 0, heartbeats: 0, types: {}, replayed: false };
  const questionKnown = db.prepare('SELECT 1 FROM inbox WHERE workflow_id=? AND kind=? AND key=?');
  const messageKnown = db.prepare('SELECT 1 FROM events WHERE workflow_id=? AND kind=? AND entity_id=?');
  for (const message of messages) {
    const type = String(message?.type ?? 'message');
    counts.types[type] = (counts.types[type] ?? 0) + 1;
    if (COUNTED_ONLY_TYPES.has(type)) { counts.heartbeats += 1; continue; }
    const record = recordOf(db, jobs, message, deliveryId);
    if (ANSWERABLE_MESSAGE_TYPES.has(type)) {
      if (questionKnown.get(workflowId, WORKER_QUESTION, record.messageId)) continue;
      postInbox(db, { workflowId, kind: WORKER_QUESTION, key: record.messageId, payload: questionPayloadOf(record), createdAt: now });
      ledger.appendEvent({ workflowId, entityType: record.jobId ? 'job' : 'workflow', entityId: record.jobId ?? workflowId, kind: 'worker-question-bridged',
        payload: { messageId: record.messageId, dispatchId: record.dispatchId, runId: record.runId, deliveryId } });
      counts.questions += 1;
      continue;
    }
    if (messageKnown.get(workflowId, ORCHESTRATION_MESSAGE, record.messageId)) continue;
    ledger.appendEvent({ workflowId, entityType: 'orca-message', entityId: record.messageId, kind: ORCHESTRATION_MESSAGE, payload: record });
    counts.messages += 1;
  }
  ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: ORCHESTRATION_DELIVERY,
    payload: { runId, deliveryId, payloadDigest, count: messages.length, types: counts.types, heartbeats: counts.heartbeats } });
  return counts;
}

/** A Delivery already bridged: its receipt re-verified, then the zero-counts replay result. */
function replayDelivery({ runId, deliveryId, payloadDigest, known }) {
  const prior = parseJson(known.payload_json, {}) ?? {};
  if (prior.payloadDigest !== payloadDigest) throw new Error(`Delivery ${runId}/${deliveryId} lacks a matching immutable payload receipt`);
  return { questions: 0, messages: 0, heartbeats: 0, types: {}, replayed: true };
}

/** Orchestration-message events of the workflow (every bridged type except questions and heartbeats), oldest first. */
export const orchestrationMessagesOf = (db, workflowId, { type = null } = {}) => db
  .prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, ORCHESTRATION_MESSAGE)
  .map((row) => parseJson(row.payload_json, {}) ?? {})
  .filter((m) => !type || m.type === type);

/**
 * The workflow's worker questions, from the ledger alone: every question and escalation bridged from its Runs. A
 * question is pending while its job is open, its dispatch has filed no report, no reply was threaded onto it in Orca
 * and its row is still pending. {questions, pending}.
 */
export const workerQuestionsOf = (db, workflowId) => {
  const rows = db.prepare('SELECT inbox_id,key,payload_json,status FROM inbox WHERE workflow_id=? AND kind=? ORDER BY inbox_id').all(workflowId, WORKER_QUESTION);
  const jobs = operationJobsOf(db, workflowId);
  const reportedDispatches = new Set(db.prepare('SELECT dispatch_id FROM reports WHERE workflow_id=?').all(workflowId).map((row) => row.dispatch_id));
  const repliedTo = new Set(orchestrationMessagesOf(db, workflowId).map((m) => m.threadId).filter(Boolean));
  const questions = rows.map((row) => questionForRow(row, { db, jobs, reportedDispatches, repliedTo }));
  return { questions, pending: questions.filter((item) => item.state === 'pending') };
};

const questionStateOf = ({ row, item, open, reported, repliedInOrca }) => {
  if (row.status !== 'pending') return 'answered';
  if (repliedInOrca) return 'replied-elsewhere';
  if (!item.jobId) return 'unmatched';
  if (reported) return 'dispatch-inactive';
  if (!open) return 'job-settled';
  return 'pending';
};

function questionForRow(row, { db, jobs, reportedDispatches, repliedTo }) {
  const item = parseJson(row.payload_json, {}) ?? {};
  const job = item.jobId ? jobs.find((candidate) => candidate.job_id === item.jobId) ?? null : null;
  const open = Boolean(job) && !JOB_STATUSES.settled.includes(job.status);
  const reported = Boolean((item.dispatchId && reportedDispatches.has(item.dispatchId))
    || (job && [...jobDispatchIdsOf(db, job)].some((id) => reportedDispatches.has(id))));
  const repliedInOrca = repliedTo.has(row.key);
  const state = questionStateOf({ row, item, open, reported, repliedInOrca });
  return { ...item, messageId: row.key, jobStatus: job?.status ?? null, repliedInOrca, state };
}

/** Close every pending question nobody waits on any more (its job settled or reported, a reply in Orca, no job). The count. */
const closeStaleQuestions = (db, workflowId, at = Date.now()) => {
  let closed = 0;
  for (const item of workerQuestionsOf(db, workflowId).questions.filter((q) => ['job-settled', 'replied-elsewhere', 'dispatch-inactive', 'unmatched'].includes(q.state))) {
    closed += setInboxStatusByKey(db, { workflowId, kind: WORKER_QUESTION, key: item.messageId, onlyStatus: 'pending', status: 'done', disposition: { reason: item.state }, at });
  }
  return closed;
};

/**
 * Drain every Run of the workflow into the ledger (see the header). `rebind(runId)` re-binds the Kernel's own Run to
 * the current Kernel terminal after a consumer_fenced answer (cli.mjs bindRunToKernel); a Run that is not the Kernel's
 * is never re-bound. `check` replaces the Orca wrapper (specs).
 * {ok, runs, deliveries, questions, messages, heartbeats, closed, errors[{runId, code, error}], error}.
 */
export function drainWorkflowMessages(ledger, workflowId, { check = orcaCheck, rebind = null, maxDeliveries = MAX_DELIVERIES_PER_DRAIN } = {}) {
  const db = ledger.db;
  const runIds = [...workflowRunIdsOf(db, workflowId)];
  const out = { ok: true, runs: runIds, deliveries: 0, questions: 0, messages: 0, heartbeats: 0, closed: 0, errors: [], error: null };
  const kernelJob = latestKernelJobOf(db, workflowId);
  const terminal = kernelJob?.worker_id ?? null;
  const kernelRunId = jobPayloadOf(kernelJob)?.orca?.runId ?? null;
  const fail = (entry) => out.errors.push(entry);
  if (runIds.length && !terminal) fail({ runId: null, code: 'orchestration-no-kernel-terminal', error: 'no Kernel terminal to name as the Runs\' consumer' });
  for (const runId of terminal ? runIds : []) {
    drainRun(ledger, { workflowId, runId, terminal, kernelRunId, rebind, check, maxDeliveries, out, fail });
  }
  out.closed = ledger.transaction(() => closeStaleQuestions(db, workflowId));
  out.ok = out.errors.length === 0;
  out.error = out.ok ? null : out.errors.map((e) => `${e.runId ?? '-'}: ${e.code}: ${e.error}`).join('; ');
  return out;
}

/** A refused check of one Run: a Run Orca lost (bindWorkflowRun replaces it) has nothing left to deliver and fails nothing. */
function failedCheck(r, runId, fail) {
  if (r.errorCode === 'run_not_found') return;
  fail(r.fenced ? { runId, code: 'orchestration-consumer-fenced', error: r.error }
    : { runId, code: 'orchestration-check-failed', error: r.error ?? r.errorCode });
}

/** One Run drained into the ledger (check → bridge every Delivery in a transaction → ack). */
function drainRun(ledger, { workflowId, runId, terminal, kernelRunId, rebind, check, maxDeliveries, out, fail }) {
  const call = (ack = null) => { try { return check({ run: runId, terminal, ...(ack ? { ack } : {}) }); } catch (e) { return { ok: false, error: String(e?.message ?? e) }; } };
  let r = call();
  if (r.fenced && rebind && runId === kernelRunId && rebind(runId)?.ok) r = call();
  for (let n = 0; ; n += 1) {
    if (!r.ok) { failedCheck(r, runId, fail); break; }
    if (!r.deliveryId || !r.messages.length || n >= maxDeliveries) break;
    const { deliveryId, messages } = r;
    let counts;
    try { counts = ledger.transaction(() => bridgeDelivery(ledger, { workflowId, runId, deliveryId, messages })); }
    catch (error) { fail({ runId, code: 'orchestration-check-failed', error: String(error?.message ?? error) }); break; }
    out.deliveries += counts.replayed ? 0 : 1; out.questions += counts.questions; out.messages += counts.messages; out.heartbeats += counts.heartbeats;
    r = call(deliveryId);
  }
}

/**
 * The workflow-check + drain prelude `starci kernel questions` and `starci kernel messages` share: the workflow must exist
 * (workflow-unknown via verbWorkflow), then every Run of it drains into the ledger with strayed Runs rebound to the
 * Kernel seat under the verb's `by`. Returns { db, workflowId, drained }.
 */
export function drainForVerb(ledger, { args, internals, by }) {
  const { db, workflowId } = verbWorkflow(ledger, args);
  const drained = ledger.readOnly ? { ok: true, error: null, runs: [], questions: 0, closed: 0, deliveries: 0, messages: 0, heartbeats: 0 } : drainWorkflowMessages(ledger, workflowId, { rebind: (runId) => internals.bindRunToKernel({ db, ledger, workflowId, runId, by }) });
  return { db, workflowId, drained };
}
