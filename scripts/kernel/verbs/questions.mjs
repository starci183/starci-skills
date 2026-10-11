// starci kernel questions: drain the workflow's Runs into the ledger (api-lib/messages.mjs) and list the pending worker questions.
import { workflowVerb } from './shared/rows.mjs';
import { drainForVerb, workerQuestionsOf } from './shared/worker-messages.mjs';

export default workflowVerb('questions', ({ ledger, args, emit, internals }) => {
    const { db, workflowId, drained } = drainForVerb(ledger, { args, internals, by: 'questions' });
    const { pending } = workerQuestionsOf(db, workflowId);
    const out = { ok: true, workflowId, bridged: drained.questions, closed: drained.closed, deliveries: drained.deliveries, pending, ...(drained.error ? { error: drained.error } : {}) };
    const drainError = drained.error ? ` — orchestration check failed: ${drained.error}` : '';
    emit(out, [
      `questions ${workflowId}: ${pending.length} pending worker question(s) (bridged ${drained.questions}, closed ${drained.closed})${drainError}`,
      ...pending.map((q) => {
        const options = q.options.length ? ` [${q.options.join(' | ')}]` : '';
        return `  ${q.messageId} ${q.jobId} (${q.opId} a${q.attempt}): ${q.question}${options}`;
      }),
    ].join('\n'), args.json);
}, { reads: true, reacts: true });
