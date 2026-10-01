// Every op is an orchestration worker-start worker, and a just-dispatched worker carries the launch grace
// (runtimes.yaml allocation.liveness.launchGraceMs; scripts/kernel/api.mjs launchGraceOf): until its grace runs out or
// a nudge follows the dispatch, liveness reads it `starting` and nudge answers `worker-starting`. A spec that exercises
// the nudge/liveness of a live worker ends the grace the only way the ledger allows - one seeded op-worker-nudged event
// (events are append-only) - and reads events without it.
import { openLedger } from '../../engine/db/ledger.mjs';

export const GRACE_SEED = 'launch-grace-over';

/** Append the seed nudge that ends `jobId`'s launch grace in the ledger at `file`. */
export function endLaunchGrace(file, { workflowId, jobId }) {
  const ledger = openLedger({ file });
  try { ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'job', entityId: jobId, kind: 'op-worker-nudged', payload: { seed: GRACE_SEED } })); }
  finally { ledger.close(); }
}

/** True for any event payload other than the seed. */
export const notGraceSeed = (payload) => payload?.seed !== GRACE_SEED;
