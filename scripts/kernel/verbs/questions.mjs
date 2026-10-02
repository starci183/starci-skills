// api questions: drain the workflow's Runs into the ledger (api-lib/messages.mjs) and list the pending worker questions.
import { workflowVerb } from './shared/rows.mjs';
import { drainForVerb, workerQuestionsOf } from './shared/worker-messages.mjs';

export default workflowVerb('questions', ({ ledger, args, emit, internals }) => {
    const { db, workflowId, drained } = drainForVerb(ledger, { args, internals, by: 'questions' });
    const { pending } = workerQuestionsOf(db, workflowId);
    const out = { ok: true, workflowId, bridged: drained.questions, closed: drained.closed, deliveries: drained.deliveries, pending, ...(drained.error ? { error: drained.error } : {}) };
    emit(out, [
      `questions ${workflowId}: ${pending.length} pending worker question(s) (bridged ${drained.questions}, closed ${drained.closed})${drained.error ? ` — orchestration check failed: ${drained.error}` : ''}`,
      ...pending.map((q) => `  ${q.messageId} ${q.jobId} (${q.opId} a${q.attempt}): ${q.question}${q.options.length ? ` [${q.options.join(' | ')}]` : ''}`),
    ].join('\n'), args.json);
});
