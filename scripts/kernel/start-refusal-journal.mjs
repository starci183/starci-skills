// start-refusal-journal.mjs - which refusals a Kernel start prints are failed launches the ledger must count.
//
// The start-hold rule (start-hold.mjs) turns a launch that fails again for one cause into one held seat and one Decision Item, but it counts only the
// `kernel-start-failed` events of the ledger. A refusal the start prints without recording one (the sender terminal is missing, a launch of unknown outcome is
// not reconciled, a terminal cannot be verified) was answered to the watchdog and forgotten: the same refusal came back every pass, nothing counted it, no hold
// opened and no role was told. The watchdog therefore journals every refusal the start did not record itself, except the answers that are not failed launches.
import { runtimeRevNow } from './start-hold.mjs';

/**
 * The steps a start prints that are not a failed launch: Orca not answering (waited out by the host-outage clock), a Kernel whose Dispatch is alive (nothing to
 * start), the hold itself (already counted) and a stale terminal that could not be closed (the start records its own event and incident).
 */
export const NOT_A_FAILED_LAUNCH = Object.freeze(['host-unavailable', 'kernel-worker-alive', 'kernel-start-held', 'kernel-stale-terminal-unclosed']);

const MESSAGE_LIMIT = 600;

/** The sequence number of the newest `kernel-start-failed` event of the workflow, 0 when none. */
export const lastStartFailedSeq = (ledger, workflowId) => Number(ledger.db.prepare("SELECT MAX(seq) AS seq FROM events WHERE workflow_id=? AND kind='kernel-start-failed'").get(workflowId)?.seq ?? 0);

/** The failed-launch payload of a printed refusal: its step, its message and the runtime revision it failed under. Pure. */
export function refusalPayload(value, rev) {
  const step = String(value.step ?? 'start-workflow');
  const red = value.host?.items?.find?.((item) => item.status === 'red' && item.required)?.detail;
  const error = String(value.error ?? value.host?.error ?? red ?? value.recovery?.reason ?? step).slice(0, MESSAGE_LIMIT);
  return { step, reason: step, error, runtimeRev: rev };
}

/** Whether a printed answer is a refusal that counts as a failed launch. Pure. */
export const countsAsFailedLaunch = (value) => value?.ok === false && !NOT_A_FAILED_LAUNCH.includes(value.step);

/**
 * Journal the refusal of a start as a failed launch, unless the start recorded one itself during this run (`before` is the newest sequence number read
 * before it ran). Returns the payload that was recorded, or null.
 */
export function journalRefusedStart(ledger, { workflowId, value, before, rev = runtimeRevNow() }) {
  if (!countsAsFailedLaunch(value) || lastStartFailedSeq(ledger, workflowId) !== before) return null;
  const payload = refusalPayload(value, rev);
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'kernel', entityId: workflowId, kind: 'kernel-start-failed', payload }));
  return payload;
}
