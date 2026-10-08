// starci kernel status: workflow projection, action frontier, and bounded host reads.
// The projection lives in scripts/kernel/verbs/shared/status-render.mjs; this is the verb shell.
import { cmdStatus } from './shared/status-render.mjs';
import { fieldEmit } from './shared/field-view.mjs';

export default {
  verb: 'status',
  required: ['workflow'],
  async run({ ledger, args, repo, emit, internals, ext }) {
    // Exit 0 must carry the status JSON: a run that ends having emitted nothing is a typed refusal, never silence.
    let emitted = false;
    const view = fieldEmit(emit, args);
    const once = (...a) => { emitted = true; return view(...a); };
    const prefetched = await internals.prefetchStatusOrcaReads(ledger.db, args.workflow).catch(() => new Map());
    const result = await internals.withStatusSpawnMemo(() => cmdStatus(ledger, args, repo, { emit: once, internals, ext }), { prefetched });
    if (!emitted) {
      console.error(JSON.stringify({ ok: false, error: `status ${args.workflow} ended without emitting`, code: 'status-render-empty' }));
      process.exitCode = 1;
    }
    return result;
  },
};
