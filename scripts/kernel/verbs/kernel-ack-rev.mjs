// api kernel-ack-rev — the Kernel read the kernel files of runtime rev --rev (event
// runtime-rev-acked, source ack; scripts/kernel/runtime-rev.mjs). Split out of cli.mjs
// (lane slim-api); its help line stays in cli.mjs usage() (usageInCore).
//
//   kernel-ack-rev --workflow <id> --rev <sha> [--files <csv>]
import { getWorkflow } from './shared/rows.mjs';
import { kernelSeatOf } from './shared/kernel-seat.mjs';
import { KERNEL_REV_ACKED_EVENT, KERNEL_REV_UNKNOWN, kernelRevState, resolveRev, revRootOf, shortRev } from '../runtime-rev.mjs';

export default {
  verb: 'kernel-ack-rev',
  required: ['workflow', 'rev'],
  kernelOnly: true,
  usageInCore: true,
  usage: '  kernel-ack-rev --workflow <id> --rev <sha> [--files <csv>]   record the runtime rev (.claude HEAD) whose kernel files this Kernel has read (runtime-rev.mjs)',
  run({ ledger, args, emit }) {
    const db = ledger.db, workflowId = args.workflow, root = revRootOf();
    const wf = getWorkflow(db, workflowId);
    if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    const rev = resolveRev(root, String(args.rev));
    if (!rev) throw Object.assign(new Error(`${KERNEL_REV_UNKNOWN}: --rev ${args.rev} is not a commit of the runtime at ${root}; take it from the wake or api status kernelRev.current`), { code: KERNEL_REV_UNKNOWN });
    const files = typeof args.files === 'string' ? args.files.split(',').map((item) => item.trim()).filter(Boolean) : [];
    const attempt = kernelSeatOf(db, workflowId)?.attempt ?? null;
    ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, generation: wf.generation ?? 0, kind: KERNEL_REV_ACKED_EVENT,
      payload: { rev, files, source: 'ack', attempt }, createdAt: Date.now() }));
    const kernelRev = kernelRevState(db, workflowId, { root });
    const out = { ok: true, workflowId, rev, files, attempt, kernelRev };
    const tail = kernelRev.current === rev ? ' (current)'
      : kernelRev.stale ? ` - still behind ${shortRev(kernelRev.current)}: re-read ${kernelRev.full ? 'kernel-prompt.md and driver-loop.yaml in full' : kernelRev.files.join(', ')} and ack ${shortRev(kernelRev.current)}`
      : ` (current ${shortRev(kernelRev.current)}: nothing kernel-relevant changed since)`;
    emit(out, `kernel-ack-rev ${workflowId}: acked runtime rev ${shortRev(rev)}${tail}`, args.json);
  },
};
