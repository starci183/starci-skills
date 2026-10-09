// scripts/reconciler/gate-close.mjs — the Supervisor Decision Item of a supervisor-gate (scripts/reconciler/gate-plan.mjs) closes with its gate: once the
// incident is no longer open in a ledger the pass could read, the item leaves the ladder, so the owner is never told about a gate that is gone.
// The Workflow controller runs it for its own workflow (closeGateItems), so the close does not wait on the notifier pass.
import { supervisorDecisions } from '../machine/decisions.mjs';
import { withSupervisor } from '../machine/home.mjs';

/** The keys `<ledgerId>:<incidentId>` of the open incidents and the ids of the ledgers read: what a pass saw. */
export const gateSightOf = (readers) => ({
  readLedgers: new Set(readers.map((reader) => reader.ledgerId)),
  openGates: new Set(readers.flatMap((reader) => reader.db.prepare("SELECT incident_id FROM incidents WHERE status='open'").all().map((row) => `${reader.ledgerId}:${row.incident_id}`))),
});

/** Resolve on the machine writer `m` every live gate item whose incident closed; returns the ids closed. */
export function closeResolvedGateDis(m, dis, { readLedgers, openGates }) {
  const gone = dis.filter((di) => ['open', 'claimed', 'escalated'].includes(di.status) && di.refs?.gateIncident && readLedgers.has(di.refs.ledgerId)
    && !openGates.has(`${di.refs.ledgerId}:${di.refs.gateIncident}`));
  for (const di of gone) m.setSupDecision(di.id, { status: 'resolved', by: 'reconciler/gate', verb: 'gate-resolved', rationale: `incident ${di.refs.gateIncident} is no longer open` });
  return gone.map((di) => di.id);
}

/**
 * Resolve on the machine writer `m` the older items of a gate that has a newer one (the runtime re-offers an open runtime-defect gate under each new
 * revision): the Supervisor answers one item per gate, never the same gate twice. Returns the ids closed.
 */
export function closeSupersededGateDis(m, dis) {
  const live = dis.filter((di) => ['open', 'claimed', 'escalated'].includes(di.status) && di.refs?.gateIncident);
  const newest = new Map();
  for (const di of live) {
    const key = `${di.refs.ledgerId}:${di.refs.gateIncident}`;
    if (!newest.has(key) || Number(di.openedAt ?? 0) > Number(newest.get(key).openedAt ?? 0)) newest.set(key, di);
  }
  const old = live.filter((di) => newest.get(`${di.refs.ledgerId}:${di.refs.gateIncident}`) !== di);
  for (const di of old) m.setSupDecision(di.id, { status: 'resolved', by: 'reconciler/gate', verb: 'gate-reoffered', rationale: `incident ${di.refs.gateIncident} was offered again under a newer runtime revision` });
  return old.map((di) => di.id);
}

/** The close of one Workflow controller pass: the items of resolved gates, then the older items of re-offered gates; the ids closed. */
export function closeGateItems(sight, { env = process.env, now = Date.now() } = {}) {
  return withSupervisor((m) => {
    const all = supervisorDecisions(m, { now });
    const gone = new Set(closeResolvedGateDis(m, all, sight));
    return [...gone, ...closeSupersededGateDis(m, all.filter((di) => !gone.has(di.id)))];
  }, { env }) ?? [];
}
