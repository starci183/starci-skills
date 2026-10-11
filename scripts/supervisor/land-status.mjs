// land-status.mjs — the land gate's queue and its status for /status and the Host controller (machine.sqlite land_queue).
import { readMachine } from '../../engine/db/machine.mjs';

/** The open tickets of the land queue, oldest first ({ticketId, lane, commit, state, requestedBy, enqueuedAt}). */
export function landQueue({ env = process.env } = {}) {
  return readMachine((m) => m.landQueue().map((t) => ({ ticketId: t.ticket_id, lane: t.lane, commit: t.commit_sha, state: t.state, requestedBy: t.requested_by, enqueuedAt: t.enqueued_at })), [], { env });
}

/** The gate for /status: {busy, current, queued}. */
export function landStatus({ env = process.env } = {}) {
  const queue = landQueue({ env });
  const current = queue.find((t) => t.state === 'running') ?? null;
  return { busy: Boolean(current), current, queued: queue.filter((t) => t.state === 'queued').length };
}
