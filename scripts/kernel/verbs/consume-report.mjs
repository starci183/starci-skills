// api consume-report: split from cli.mjs.
import { markReportConsumed } from '../../../engine/db/ledger.mjs';

export default {
  verb: 'consume-report',
  required: ['job'],
  kernelOnly: true,
  usageInCore: true,
  run({ ledger, args, repo, emit, need, internals }) {
    const db = ledger.db, job = internals.resolveJob(db, args.job);
    const dispatchId = internals.reportDispatchIdOf(db, job);
    let consumed = false;
    ledger.transaction(() => {
      const now = Date.now();
      consumed = markReportConsumed(db, { workflowId: job.workflow_id, dispatchId, at: now });
      if (consumed) {
        ledger.appendEvent({
          workflowId: job.workflow_id, entityType: 'job', entityId: job.job_id,
          kind: 'report-consumed', payload: { dispatchId },
        });
      }
    });
    const out = { ok: true, jobId: job.job_id, workflowId: job.workflow_id, dispatchId, consumed };
    emit(out, `consume-report ${job.job_id} (dispatch ${dispatchId}): ${consumed ? 'report consumed' : 'no unconsumed report row'}`, args.json);
  },
};
