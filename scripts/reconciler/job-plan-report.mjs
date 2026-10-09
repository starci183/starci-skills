// job-plan-report.mjs - the clock and step of a live job whose report is filed (the Job controller's planner, scripts/reconciler/controllers/job.mjs).
import { KERNEL_ONLY_OPS } from '../machine/reported-jobs.mjs';

/** The code of a settle refused because a prepared decision of the attempt was never applied. */
export const RECOVERY_CONFLICT = 'workflow-checkpoint-recovery-conflict';

/** A done report the settler handed to the Kernel under another runtime revision than the live one (a handover recorded before revisions were named counts as older). */
const judgedByOlderRuntime = (f) => f.report.outcome === 'done' && !KERNEL_ONLY_OPS.includes(f.op) && Boolean(f.runtimeRev) && f.handover.runtimeRev !== f.runtimeRev;

/** The clock and step of a live job with a report. Consume is part of settle (settle-runtime-service): SETTLE_OVERDUE / DECISION_OVERDUE time the report, no separate CONSUME_OVERDUE clock. */
export function planReport(f, clock, set) {
  if (f.handover && (judgedByOlderRuntime(f) || f.preparedOpen)) {
    // The runtime that handed the report over was an older one: the verdict is a function of the code, so the settler judges it again once per revision. A report refused only
    // because a prepared decision of its attempt was never applied is the settler's too: it withdraws a void receipt (prepared-recovery.mjs) and judges afresh.
    clock('SETTLE_OVERDUE', f.handover.at);
    set({ kind: 'settle', concern: 'job.settle', rejudge: true });
  } else if (f.handover) {
    clock('DECISION_OVERDUE', f.handover.at);
    set({ kind: 'settle-nongreen', concern: 'job.consume-check', reason: f.handover.reason });
  } else if (KERNEL_ONLY_OPS.includes(f.op)) {
    // The owner's act is the Kernel's item; every other outcome (done, blocked, ask, failed, partial) the settler settles itself (job-settle.mjs mechanicalSettleOf).
    clock('DECISION_OVERDUE', f.report.filedAt);
    set({ kind: 'settle-nongreen', concern: 'job.consume-check', reason: 'owner-act' });
  } else {
    clock('SETTLE_OVERDUE', f.report.filedAt);
    set({ kind: 'settle', concern: 'job.settle' });
  }
}
