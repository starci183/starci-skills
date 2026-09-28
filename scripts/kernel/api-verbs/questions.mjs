// api questions: split from api.mjs.
import { getWorkflow } from '../api-lib/rows.mjs';
import { WORKER_QUESTION, workerQuestionsOf } from '../api-lib/messages.mjs';

export default {
  verb: 'questions',
  required: ['workflow'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const db = ledger.db, workflowId = args.workflow;
    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const { questions, pending, error } = workerQuestionsOf(db, workflowId);
    let bridged = 0, closed = 0;
    ledger.transaction(() => {
      const now = Date.now();
      for (const item of pending.filter((q) => !q.bridged)) {
        const { state, bridged: _b, jobStatus, repliedInOrca, ...stored } = item;
        db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?, 'pending',?)")
          .run(workflowId, WORKER_QUESTION, item.messageId, JSON.stringify(stored), now);
        ledger.appendEvent({ workflowId, entityType: 'job', entityId: item.jobId, kind: 'worker-question-bridged',
          payload: { messageId: item.messageId, dispatchId: item.dispatchId, runId: item.runId } });
        bridged += 1;
      }
      // A bridged question whose worker is gone, or that someone answered in
      // Orca directly, no longer waits on the Kernel.
      for (const item of questions.filter((q) => q.bridged && ['job-settled', 'replied-elsewhere', 'dispatch-inactive'].includes(q.state))) {
        closed += db.prepare("UPDATE inbox SET status='done', disposition_json=?, applied_at=? WHERE workflow_id=? AND kind=? AND key=? AND status='pending'")
          .run(JSON.stringify({ reason: item.state }), now, workflowId, WORKER_QUESTION, item.messageId).changes;
      }
    });
    const out = { ok: true, workflowId, bridged, closed, pending: workerQuestionsOf(db, workflowId).pending, ...(error ? { error } : {}) };
    emit(out, [
      `questions ${workflowId}: ${out.pending.length} pending worker question(s) (bridged ${bridged}, closed ${closed})${error ? ` — host inbox unreadable: ${error}` : ''}`,
      ...out.pending.map((q) => `  ${q.messageId} ${q.jobId} (${q.opId} a${q.attempt}): ${q.question}${q.options.length ? ` [${q.options.join(' | ')}]` : ''}`),
    ].join('\n'), args.json);
  },
};
