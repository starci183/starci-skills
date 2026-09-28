// api messages: split from api.mjs.
import { parseJson } from '../../lib/json.mjs';
import { orchInbox } from '../../api/orca/orch-inbox.mjs';
import { getWorkflow, operationTerminalHandleOf } from '../api-lib/rows.mjs';
import { ORCHESTRATION_INBOX_LIMIT, jobDispatchIdsOf, workflowRunIdsOf } from '../api-lib/messages.mjs';
const MESSAGE_ROUTES = {
  question: 'answer with api reply --message <id> (api questions lists it)',
  worker_done: 'information: the op files api report; settle from the ledger',
  escalation: 'answer with api reply --message <id> (api questions lists it)',
  status: 'information: progress or a reply thread; nothing to answer',
};

export default {
  verb: 'messages',
  required: ['workflow'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const db = ledger.db, workflowId = args.workflow;
    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const runIds = workflowRunIdsOf(db, workflowId);
    let listed = { ok: true, messages: [], error: null };
    if (runIds.size) {
      try { listed = orchInbox({ limit: ORCHESTRATION_INBOX_LIMIT, all: Boolean(args.all) }); }
      catch (e) { listed = { ok: false, messages: [], error: String(e?.message ?? e) }; }
    }
    const jobs = db.prepare("SELECT job_id,workflow_id,op_id,attempt,status,payload_json,worker_id FROM jobs WHERE workflow_id=? AND kind<>'kernel'").all(workflowId);
    const read = new Set(db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='orchestration-messages-read'").all(workflowId)
      .flatMap((row) => parseJson(row.payload_json, {})?.ids ?? []));
    const messages = (listed.messages ?? []).filter((m) => runIds.has(String(m.run_id))).map((m) => {
      const body = parseJson(m.payload ?? '', {}) ?? {};
      const from = String(m.from_handle ?? '');
      const dispatchId = body.dispatchId ?? (from.startsWith('dispatch:') ? from.slice('dispatch:'.length) : null);
      const job = jobs.find((row) => (dispatchId && jobDispatchIdsOf(db, row).has(dispatchId)) || (from && operationTerminalHandleOf(row) === from)) ?? null;
      const type = String(m.type ?? 'message');
      return { id: m.id, type, subject: m.subject ?? null, body: String(body.question ?? m.body ?? '').slice(0, 600), from: from || null, to: m.to_handle ?? null,
        runId: m.run_id ?? null, threadId: m.thread_id ?? null, createdAt: m.created_at ?? null,
        jobId: job?.job_id ?? null, opId: job?.op_id ?? null, attempt: job?.attempt ?? null, jobStatus: job?.status ?? null,
        new: !read.has(m.id), handle: MESSAGE_ROUTES[type] ?? 'information: read it; act only through api verbs' };
    });
    const fresh = messages.filter((m) => m.new).map((m) => m.id);
    if (fresh.length) ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'orchestration-messages-read', payload: { ids: fresh } }));
    const out = { ok: listed.ok !== false, workflowId, runs: [...runIds], count: messages.length, new: fresh.length, messages, ...(listed.error ? { error: listed.error } : {}) };
    emit(out, [
      `messages ${workflowId}: ${messages.length} orchestration message(s) on ${runIds.size} Run(s), ${fresh.length} new${listed.error ? ` — host inbox unreadable: ${listed.error}` : ''}`,
      ...messages.slice(0, 40).map((m) => `  ${m.new ? '*' : ' '} ${m.id} [${m.type}] ${m.jobId ?? m.from ?? '-'}${m.opId ? ` (${m.opId} a${m.attempt})` : ''}: ${m.subject ?? ''} ${m.body ? `— ${m.body.replace(/\s+/g, ' ').slice(0, 160)}` : ''}\n      -> ${m.handle}`),
    ].join('\n'), args.json);
  },
};
