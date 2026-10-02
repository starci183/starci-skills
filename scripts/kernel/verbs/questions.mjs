// starci kernel questions: drain the workflow's Runs into the ledger (api-lib/messages.mjs) and list the pending worker questions.
import { getWorkflow } from './shared/rows.mjs';
import { drainWorkflowMessages, workerQuestionsOf } from './shared/worker-messages.mjs';

export default {
  verb: 'questions',
  required: ['workflow'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const db = ledger.db, workflowId = args.workflow;
    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const drained = drainWorkflowMessages(ledger, workflowId, { rebind: (runId) => internals.bindRunToKernel({ db, ledger, workflowId, runId, by: 'questions' }) });
    const { pending } = workerQuestionsOf(db, workflowId);
    const out = { ok: true, workflowId, bridged: drained.questions, closed: drained.closed, deliveries: drained.deliveries, pending, ...(drained.error ? { error: drained.error } : {}) };
    emit(out, [
      `questions ${workflowId}: ${pending.length} pending worker question(s) (bridged ${drained.questions}, closed ${drained.closed})${drained.error ? ` — orchestration check failed: ${drained.error}` : ''}`,
      ...pending.map((q) => `  ${q.messageId} ${q.jobId} (${q.opId} a${q.attempt}): ${q.question}${q.options.length ? ` [${q.options.join(' | ')}]` : ''}`),
    ].join('\n'), args.json);
  },
};
