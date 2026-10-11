// revision-seat.mjs — the Supervisor seat's side of a runtime revision change (modules/kernel/revision-scope.yaml), called by the watchdog pass:
// the runtime's own settle of a change that concerns the seat nothing, the one wake of a revision, and the replacement a changed contract owes.
import { withMachine } from '../../engine/db/machine.mjs';
import { supervisorEvent } from '../machine/home.mjs';
import { recordReplaced, recordWoken, runtimePass } from '../machine/revision-ack.mjs';
import { contractReplacement } from '../machine/revision-replace.mjs';
import { supervisorSeat } from '../machine/revision-seats.mjs';
import { revRootOf } from '../kernel/runtime-rev.mjs';
import { inFlightOf, rotationHandover } from './supervisor-rotation.mjs';

const seatOf = (m) => supervisorSeat({ m, root: revRootOf() });

/** The notice of the seat after the runtime's own pass: a change that concerns it nothing is settled, a first sight adopts the baseline. */
export const revisionNoticeOf = (m) => runtimePass(seatOf(m), { repair: true, adopt: true }).notice;

/** The one wake of a revision was delivered (plan.revisionNotice): no second wake for the same owed files. */
export const noteRevisionWoken = (m, plan, woke) => { if (woke.delivered === true && plan.revisionNotice) recordWoken(seatOf(m), plan.revisionNotice); };

/** A fresh seat read the tree at birth: the revision change it replaced is settled. */
export const noteRevisionReplaced = (env, label) => withMachine((fresh) => recordReplaced(seatOf(fresh), label), { env });

/**
 * The replacement a changed contract owes, or null: only at the seat's next yield (`idle`: a turn-idle frame with no subagent running) and only
 * with nothing in flight (no claimed Decision Item, running worker job or land). Records `supervisor-rotated` and returns {reason, handover}.
 */
export function contractReplacementOf({ m, now, notice, idle }) {
  const contract = contractReplacement(notice);
  if (!contract || !idle || Object.values(inFlightOf(m.db, now())).some((ids) => ids.length)) return null;
  const handover = rotationHandover(m.db, { reason: contract.reason, now: now() });
  m.transaction(() => supervisorEvent(m, { kind: 'supervisor-rotated', now: now(), payload: { reason: contract.reason } }));
  return { reason: contract.reason, handover };
}
