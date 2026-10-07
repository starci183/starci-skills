// scripts/reconciler/gate-close.mjs — the Supervisor Decision Item of a supervisor-gate (scripts/reconciler/gate-plan.mjs) closes with its gate: once the
// incident is no longer open in a ledger the pass could read, the item leaves the ladder, so the owner is never told about a gate that is gone.

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
