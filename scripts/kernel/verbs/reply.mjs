// starci kernel reply: split from cli.mjs.
import { getWorkflow } from './shared/rows.mjs';
import { setInboxStatusByKey } from '../../../engine/db/ledger.mjs';
import { OWNER_ROUTED_REPLY, WORKER_QUESTION, drainWorkflowMessages, workerQuestionsOf } from './shared/worker-messages.mjs';
import { reply as orcaReply } from '../../api/orca/reply.mjs';
import { VerbExit } from './shared/verb-exit.mjs';

export default {
  verb: 'reply',
  required: ['workflow', 'message'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, emit, internals }) {
    const db = ledger.db, workflowId = args.workflow, messageId = args.message;
    if (!getWorkflow(db, workflowId)) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const toOwner = Boolean(args['to-owner']);
    if (!toOwner && !(typeof args.body === 'string' && args.body.trim())) {
      throw Object.assign(new Error('reply needs --body <answer> or --to-owner'), { code: 'reply-body-missing' });
    }
    // A question Orca delivered since the last drain is bridged first: the ledger row is what starci kernel reply answers.
    drainWorkflowMessages(ledger, workflowId, { rebind: (runId) => internals.bindRunToKernel({ db, ledger, workflowId, runId, by: `reply:${messageId}` }) });
    const item = workerQuestionsOf(db, workflowId).questions.find((q) => q.messageId === messageId);
    if (!item) throw Object.assign(new Error(`no worker question or escalation ${messageId} in ${workflowId}'s Runs`), { code: 'question-unknown' });
    if (item.state !== 'pending') {
      throw Object.assign(new Error(`worker question ${messageId} is ${item.state}; nothing waits on this reply`), { code: `question-${item.state}` });
    }
    const kernelNote = args.body ? ` Kernel note: ${args.body}` : '';
    const body = toOwner ? `${OWNER_ROUTED_REPLY}${kernelNote}` : String(args.body);
    internals.bindRunToKernel({ db, ledger, workflowId, runId: item.runId, by: `reply:${messageId}` });
    const sent = orcaReply({ id: messageId, body, run: item.runId });
    if (!sent.ok) {
      const out = { ok: false, workflowId, messageId, jobId: item.jobId, reason: 'reply-failed', error: sent.error ?? sent.outcome };
      emit(out, `reply FAILED for ${messageId}: ${out.error}`, args.json);
      throw new VerbExit(1);
    }
    ledger.transaction(() => {
      const now = Date.now();
      const disposition = { reply: body, toOwner, at: now };
      setInboxStatusByKey(db, { workflowId, kind: WORKER_QUESTION, key: messageId, status: 'applied', disposition, at: now });
      ledger.appendEvent({ workflowId, entityType: 'job', entityId: item.jobId, kind: 'worker-question-answered',
        payload: { messageId, dispatchId: item.dispatchId, runId: item.runId, toOwner } });
    });
    const out = { ok: true, workflowId, messageId, jobId: item.jobId, toOwner, body };
    emit(out, `replied to ${messageId} (${item.jobId})${toOwner ? ': routed to the owner through outcome ask' : ''}`, args.json);
  },
};
