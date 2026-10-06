// starci kernel status: workflow projection, action frontier, and bounded host reads.
// The projection lives in scripts/kernel/status/render.mjs (status/<view>.mjs slot); this is the verb shell.
import { cmdStatus } from '../status/render.mjs';

export default {
  verb: 'status',
  required: ['workflow'],
  async run({ ledger, args, repo, emit, internals, ext }) {
    const prefetched = await internals.prefetchStatusOrcaReads(ledger.db, args.workflow).catch(() => new Map());
    return internals.withStatusSpawnMemo(() => cmdStatus(ledger, args, repo, { emit, internals, ext }), { prefetched });
  },
};
