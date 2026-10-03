// starci kernel messages: drain the workflow's Runs into the ledger (api-lib/messages.mjs) and list every bridged message.
import { parseJson } from '../../lib/json.mjs';
import { workflowVerb } from './shared/rows.mjs';
import { drainForVerb, orchestrationMessagesOf, workerQuestionsOf } from './shared/worker-messages.mjs';
const MESSAGE_ROUTES = {
  question: 'answer with starci kernel reply --message <id> (starci kernel questions lists it)',
  worker_done: 'information: the op files starci kernel report; settle from the ledger',
  escalation: 'answer with starci kernel reply --message <id> (starci kernel questions lists it)',
  status: 'information: progress or a reply thread; nothing to answer',
};

export default workflowVerb('messages', ({ ledger, args, emit, internals }) => {
    const { db, workflowId, drained } = drainForVerb(ledger, { args, internals, by: 'messages' });
    const jobs = new Map(db.prepare("SELECT job_id,status FROM jobs WHERE workflow_id=? AND kind<>'kernel'").all(workflowId).map((row) => [row.job_id, row.status]));
    const read = new Set(db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='orchestration-messages-read'").all(workflowId)
      .flatMap((row) => parseJson(row.payload_json, {})?.ids ?? []));
    const bridged = [
      ...workerQuestionsOf(db, workflowId).questions.map((q) => ({ ...q, body: q.question, createdAt: q.askedAt })),
      ...orchestrationMessagesOf(db, workflowId),
    ].sort((a, b) => String(a.createdAt ?? '').localeCompare(String(b.createdAt ?? '')));
    const messages = bridged.map((m) => ({ id: m.messageId, type: m.type, subject: m.subject ?? null, body: String(m.body ?? '').slice(0, 600),
      from: m.from ?? null, to: m.to ?? null, runId: m.runId ?? null, threadId: m.threadId ?? null, createdAt: m.createdAt ?? null,
      jobId: m.jobId ?? null, opId: m.opId ?? null, attempt: m.attempt ?? null, jobStatus: m.jobId ? jobs.get(m.jobId) ?? null : null,
      new: !read.has(m.messageId), handle: MESSAGE_ROUTES[m.type] ?? 'information: read it; act only through api verbs' }));
    const fresh = messages.filter((m) => m.new).map((m) => m.id);
    if (fresh.length) ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: 'orchestration-messages-read', payload: { ids: fresh } }));
    const out = { ok: drained.ok, workflowId, runs: drained.runs, count: messages.length, new: fresh.length, heartbeats: drained.heartbeats, messages, ...(drained.error ? { error: drained.error } : {}) };
    emit(out, [
      `messages ${workflowId}: ${messages.length} orchestration message(s) on ${drained.runs.length} Run(s), ${fresh.length} new${drained.error ? ` — orchestration check failed: ${drained.error}` : ''}`,
      ...messages.slice(-40).map((m) => `  ${m.new ? '*' : ' '} ${m.id} [${m.type}] ${m.jobId ?? m.from ?? '-'}${m.opId ? ` (${m.opId} a${m.attempt})` : ''}: ${m.subject ?? ''} ${m.body ? `— ${m.body.replace(/\s+/g, ' ').slice(0, 160)}` : ''}\n      -> ${m.handle}`),
    ].join('\n'), args.json);
});
