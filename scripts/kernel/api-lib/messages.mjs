// Worker questions and orchestration message joins shared by the kernel API.
import { JOB_STATUSES } from '../../../engine/ledger-db.mjs';
import { parseJson } from '../../lib/json.mjs';
import { orchInbox } from '../../api/orca/orch-inbox.mjs';
import { contractDispatchIdOf, jobPayloadOf, operationTerminalHandleOf } from './rows.mjs';

export const ORCHESTRATION_INBOX_LIMIT = 1000;
export const WORKER_QUESTION = 'worker-question';
export const OWNER_ROUTED_REPLY = [
  'This question needs the owner, and an Orca ask never reaches them.',
  'Do not wait for a reply here: write your report.json with outcome ask and question {text, options},',
  'file it with api report exactly as your contract says, and end your turn.',
  'The Kernel serves the question to the owner (serve-ask) and re-enqueues this operation with the answer bound.',
].join(' ');
export const workflowRunIdsOf = (db, workflowId) => {
  const ids = new Set();
  for (const row of db.prepare('SELECT payload_json FROM jobs WHERE workflow_id=?').all(workflowId)) {
    const payload = jobPayloadOf(row);
    for (const id of [payload.orca?.runId, payload.managed?.runId, payload.hierarchy?.runtime?.runId]) if (id) ids.add(String(id));
  }
  return ids;
};
export const jobDispatchIdsOf = (db, job) => {
  const payload = jobPayloadOf(job);
  return new Set([payload.managed?.dispatchId, payload.orca?.dispatchId, payload.hierarchy?.runtime?.dispatchId, contractDispatchIdOf(db, job)].filter(Boolean));
};
// A worker message that waits on the Kernel's answer: a blocking `question` (orca orchestration ask) or an
// `escalation` (a worker that stopped on a blocker it cannot resolve inside its contract). Both are answered
// with api reply; Orca threads the reply to the worker (inc-6e7b57326aa5).
const ANSWERABLE_MESSAGE_TYPES = new Set(['question', 'escalation']);
/**
 * The workflow's worker questions: Orca `question` and `escalation` rows of its Runs (read through the non-consuming
 * inbox wrapper) joined to the job that asked, plus the worker-question rows already bridged into the
 * ledger inbox. A question is pending while its job is open, no reply is threaded onto it in Orca and
 * its ledger row (if any) is still pending. Reads only; `api questions` is the writer.
 */
export const workerQuestionsOf = (db, workflowId) => {
  const rows = db.prepare('SELECT inbox_id,key,payload_json,status FROM inbox WHERE workflow_id=? AND kind=? ORDER BY inbox_id').all(workflowId, WORKER_QUESTION);
  const ledgerRow = new Map(rows.map((row) => [row.key, row]));
  const jobs = db.prepare("SELECT * FROM jobs WHERE workflow_id=? AND kind<>'kernel'").all(workflowId);
  const reportedDispatches = new Set(db.prepare('SELECT dispatch_id FROM reports WHERE workflow_id=?').all(workflowId).map((row) => row.dispatch_id));
  const runIds = workflowRunIdsOf(db, workflowId);
  const seen = new Map();
  let error = null;
  if (runIds.size) {
    let listed;
    try { listed = orchInbox({ limit: ORCHESTRATION_INBOX_LIMIT }); }
    catch (e) { listed = { ok: false, error: String(e?.message ?? e), messages: [] }; }
    if (!listed.ok) error = listed.error ?? 'orchestration inbox unreadable';
    const messages = listed.messages.filter((message) => runIds.has(String(message.run_id)));
    const repliedTo = new Set(messages.filter((message) => message.thread_id && message.thread_id !== message.id).map((message) => message.thread_id));
    for (const message of messages.filter((item) => ANSWERABLE_MESSAGE_TYPES.has(item.type))) {
      const body = parseJson(message.payload ?? '', {}) ?? {};
      const from = String(message.from_handle ?? '');
      const dispatchId = body.dispatchId ?? (from.startsWith('dispatch:') ? from.slice('dispatch:'.length) : null);
      const job = jobs.find((row) => (dispatchId && jobDispatchIdsOf(db, row).has(dispatchId))
        || (from && operationTerminalHandleOf(row) === from)) ?? null;
      seen.set(message.id, {
        messageId: message.id, type: message.type, runId: message.run_id ?? null, jobId: job?.job_id ?? null, opId: job?.op_id ?? null,
        attempt: job?.attempt ?? null, jobStatus: job?.status ?? null, dispatchId, taskId: body.taskId ?? null,
        question: String(body.question ?? message.body ?? ''), options: Array.isArray(body.options) ? body.options : [],
        subject: message.subject ?? null, askedAt: message.created_at ?? null, repliedInOrca: repliedTo.has(message.id),
      });
    }
  }
  // A bridged question the host inbox no longer lists (it scrolled past the
  // read limit) is still the ledger's to answer.
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    const stored = parseJson(row.payload_json, {}) ?? {};
    const job = stored.jobId ? jobs.find((item) => item.job_id === stored.jobId) : null;
    seen.set(row.key, { ...stored, jobStatus: job?.status ?? null, repliedInOrca: false });
  }
  const questions = [...seen.values()].map((item) => {
    const row = ledgerRow.get(item.messageId) ?? null;
    const open = Boolean(item.jobId) && !JOB_STATUSES.settled.includes(item.jobStatus);
    const job = item.jobId ? jobs.find((candidate) => candidate.job_id === item.jobId) : null;
    const reported = Boolean((item.dispatchId && reportedDispatches.has(item.dispatchId))
      || (job && [...jobDispatchIdsOf(db, job)].some((id) => reportedDispatches.has(id))));
    const state = row && row.status !== 'pending' ? 'answered'
      : item.repliedInOrca ? 'replied-elsewhere'
      : !item.jobId ? 'unmatched'
      : reported ? 'dispatch-inactive'
      : !open ? 'job-settled'
      : 'pending';
    return { ...item, bridged: Boolean(row), state };
  });
  return { questions, pending: questions.filter((item) => item.state === 'pending'), error };
};

