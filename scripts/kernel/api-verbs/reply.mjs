// api reply: split from api.mjs.
import { getWorkflow } from '../api-lib/rows.mjs';
import { OWNER_ROUTED_REPLY, WORKER_QUESTION, workerQuestionsOf } from '../api-lib/messages.mjs';
import { orchReply } from '../../api/orca/orch-reply.mjs';

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
    const item = workerQuestionsOf(db, workflowId).questions.find((q) => q.messageId === messageId);
    if (!item) throw Object.assign(new Error(`no worker question or escalation ${messageId} in ${workflowId}'s Runs`), { code: 'question-unknown' });
    if (item.state !== 'pending') {
      throw Object.assign(new Error(`worker question ${messageId} is ${item.state}; nothing waits on this reply`), { code: `question-${item.state}` });
    }
    const body = toOwner ? `${OWNER_ROUTED_REPLY}${args.body ? ` Kernel note: ${args.body}` : ''}` : String(args.body);
    internals.bindRunToKernel({ db, ledger, workflowId, runId: item.runId, by: `reply:${messageId}` });
    const sent = orchReply({ id: messageId, body, run: item.runId });
    if (!sent.ok) {
      const out = { ok: false, workflowId, messageId, jobId: item.jobId, reason: 'reply-failed', error: sent.error ?? sent.outcome };
      emit(out, `reply FAILED for ${messageId}: ${out.error}`, args.json);
      process.exit(1);
    }
    ledger.transaction(() => {
      const now = Date.now();
      const disposition = JSON.stringify({ reply: body, toOwner, at: now });
      const { state, bridged, jobStatus, repliedInOrca, ...stored } = item;
      if (bridged) {
        db.prepare('UPDATE inbox SET status=\'applied\', disposition_json=?, applied_at=? WHERE workflow_id=? AND kind=? AND key=?')
          .run(disposition, now, workflowId, WORKER_QUESTION, messageId);
      } else {
        db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,disposition_json,created_at,applied_at) VALUES(?,?,?,?, 'applied',?,?,?)")
          .run(workflowId, WORKER_QUESTION, messageId, JSON.stringify(stored), disposition, now, now);
      }
      ledger.appendEvent({ workflowId, entityType: 'job', entityId: item.jobId, kind: 'worker-question-answered',
        payload: { messageId, dispatchId: item.dispatchId, runId: item.runId, toOwner } });
    });
    const out = { ok: true, workflowId, messageId, jobId: item.jobId, toOwner, body };
    emit(out, `replied to ${messageId} (${item.jobId})${toOwner ? ': routed to the owner through outcome ask' : ''}`, args.json);
  },
};
