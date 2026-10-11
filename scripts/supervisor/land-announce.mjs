// land-announce.mjs - the event a land leaves for the reconciler: `land-passed` in the Supervisor ledger (machine.sqlite sup_events), written once
// the local main moved. The Workflow controller routes it to every running workflow (controllers/workflow.mjs REV_WAKE_KEY), so a Kernel the
// new revision made stale is woken at once. Best effort: the land stands whether or not the event is written; the resync finds the revision anyway.
import { withMachine } from '../../engine/db/machine.mjs';

const LAND_PASSED_EVENT = 'land-passed';

/** Write the land-passed event of `landed` (the tip main moved to); true when it was written. */
export function announceLand({ landed, lane = null, kernelNote = null, env = process.env }) {
  try {
    withMachine((m) => m.supEvent({ entityType: 'land', entityId: lane ?? landed, kind: LAND_PASSED_EVENT, payload: { landed, lane, kernelNote } }), { env });
    return true;
  } catch { return false; }
}
