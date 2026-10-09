// gate-holds-ended.mjs - a supervisor-gate holds jobs; once every job it holds has been settled and none of its ops has work left, it holds nothing.
//
// The gate is the Supervisor's to answer (scripts/kernel/verbs/shared/gate-resolution.mjs). A gate raised for a runtime defect that the runtime
// later repaired, whose held job then settled (the settler judged it again under the repaired runtime), would stay open for ever: no Decision Item
// reaches the Supervisor for it and the Kernel may not resolve it. The settle that ends the last job a gate holds closes the gate as `fixed`
// (the incident row's resolved reason), and the incident carries a `gate-holds-settled` event naming the jobs, so the record says why.
import { appendEvent, resolveIncident } from '../../engine/db/ledger.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';
import { supervisorGatesOf } from './autopilot-budget.mjs';

/** The resolved reason an incident row takes, and the event that says the holds settled. */
export const HOLDS_SETTLED_REASON = 'fixed';
export const HOLDS_SETTLED_EVENT = 'gate-holds-settled';

const marks = (list) => list.map(() => '?').join(',');

/** Whether `gate` names jobs (no wildcard) and every job or op it names that exists is settled. */
function holdsSettled(db, workflowId, gate) {
  const holds = gate.holds.filter((hold) => typeof hold === 'string' && hold);
  if (!holds.length || holds.includes('*')) return false;
  const rows = db.prepare(`SELECT status FROM jobs WHERE workflow_id=? AND kind='op' AND (job_id IN (${marks(holds)}) OR op_id IN (${marks(holds)}))`).all(workflowId, ...holds, ...holds);
  return rows.length > 0 && rows.every((row) => SETTLED_JOB_LIST.includes(row.status));
}

/** Closes the open supervisor-gates of `workflowId` whose held jobs are all settled; returns the closed incident ids. */
export function releaseEndedGates(db, workflowId, { at = Date.now() } = {}) {
  const closed = [];
  for (const gate of supervisorGatesOf(db, workflowId)) {
    if (!holdsSettled(db, workflowId, gate)) continue;
    appendEvent(db, { workflowId, entityType: 'incident', entityId: gate.incidentId, kind: HOLDS_SETTLED_EVENT, payload: { holds: gate.holds, detail: gate.detail }, createdAt: at });
    if (resolveIncident(db, { incidentId: gate.incidentId, reason: HOLDS_SETTLED_REASON, at })) closed.push(gate.incidentId);
  }
  return closed;
}
