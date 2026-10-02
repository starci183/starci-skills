// starci kernel run-deferred-tests: split from cli.mjs.
import { getWorkflow } from './shared/rows.mjs';
import { DEFERRAL_KINDS, deferredTestsOf, ownerSpecs, requeueDeferredTests } from '../../route/spec-deferral.mjs';

export default {
  verb: 'run-deferred-tests',
  required: ['workflow'],
  kernelOnly: true,
  usageInCore: true,
    run({ ledger, args, emit, internals }) {
    const db = ledger.db, workflowId = args.workflow;
    const wf = getWorkflow(db, workflowId);
    if (!wf) throw Object.assign(new Error(`unknown workflow ${workflowId}`), { code: 'workflow-unknown' });
    if (args.kind != null && !DEFERRAL_KINDS.includes(args.kind)) throw Object.assign(new Error(`--kind must be ${DEFERRAL_KINDS.join('|')}, got '${args.kind}'`), { code: 'deferred-tests-bad-kind' });
    if (wf.phase === 'finished' || wf.archived_at) throw Object.assign(new Error(`workflow ${workflowId} is ${wf.archived_at ? 'archived' : 'finished'}; its deferred tests run in a new workflow`), { code: 'workflow-finished' });
    const kind = args.kind ?? null;
    const pending = deferredTestsOf(db, workflowId, { kind });
    const requeued = args['dry-run'] ? [] : requeueDeferredTests(ledger, { workflowId, kind, by: args.by ?? 'owner' });
    const out = { ok: true, workflowId, kind, dryRun: Boolean(args['dry-run']), deferred: pending, requeued, specs: ownerSpecs(internals.skillRoot) };
    emit(out, [
      `run-deferred-tests ${workflowId}${kind ? ` --kind ${kind}` : ''}: ${args['dry-run'] ? `would re-queue ${pending.length}` : `re-queued ${requeued.length}`} deferred test leg(s)`,
      ...(args['dry-run'] ? pending : requeued).map((item) => `  ${item.jobId} ${item.op} a${item.attempt} (${item.reason})`),
      ...(requeued.length ? ['  next: starci kernel status, then route and dispatch each (they run even while the switch is still off)'] : []),
    ].join('\n'), args.json);
    },
};
