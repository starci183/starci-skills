// host-event.mjs — a worker death inside a host-wide terminal disconnect is the environment's, not the op's.
//
// 2026-09-27 13:20-13:30Z every Kernel terminal of the nivo and starci-next ledgers was cleared
// 'terminal disconnected' within ten minutes (Orca's terminal daemon dropped them), and the five op
// workers alive then - nivo app-auth uat.verify a3, collab backend.implement a9, modules-agentos
// interface.draw a3; starci-next learn-content and foundation backend.implement a2 - settled
// failed-no-report as the ops' own deaths: a business attempt spent each, their pools demoted, the
// dead-worker pattern fed. The host samples around it (13:02Z 23.7% free RAM, 13:36Z 16.6%) show
// pressure but no OOM floor; the signature is the simultaneous disconnect. api.mjs hostTerminalWipeOf
// already recognised a wipe proven by the worker's OWN Kernel terminal being gone; a disconnect seen
// through other workflows' Kernels was missed.
//
// hostWideDisconnectOf(db, now) -> [workflowId] | null: the workflows of this ledger whose Kernel seat
// was cleared for a gone or disconnected terminal in the HOST_EVENT_WINDOW_MS before `now`, when at
// least HOST_EVENT_MIN_WORKFLOWS of them were - one Kernel dying alone is that Kernel's business.
import { parseJsonOr } from '../lib/json.mjs';

export const HOST_EVENT_WINDOW_MS = 20 * 60_000;
export const HOST_EVENT_MIN_WORKFLOWS = 3;
export const HOST_DEAD_REASON = /^(?:terminal_handle_stale|terminal (?:disconnected|not in the Orca listing|listed disconnected)\b)/;

export function hostWideDisconnectOf(db, now = Date.now()) {
  const rows = db.prepare("SELECT workflow_id, payload_json FROM events WHERE kind='kernel-stale-cleared' AND created_at>=? AND created_at<=?")
    .all(now - HOST_EVENT_WINDOW_MS, now);
  const workflows = [...new Set(rows.filter((row) => HOST_DEAD_REASON.test(String(parseJsonOr(row.payload_json).reason ?? ''))).map((row) => row.workflow_id))];
  return workflows.length >= HOST_EVENT_MIN_WORKFLOWS ? workflows : null;
}
