// gate-holds-ended.mjs - a supervisor-gate holds jobs; once every job it holds has been settled and none of its ops has work left, it holds nothing.
//
// The gate is the Supervisor's to answer (scripts/kernel/verbs/shared/gate-resolution.mjs). A gate raised for a runtime defect that the runtime
// later repaired, whose held job then settled (the settler judged it again under the repaired runtime), would stay open for ever: no Decision Item
// reaches the Supervisor for it and the Kernel may not resolve it. The settle that ends the last job a gate holds closes the gate as `fixed`
// (the incident row's resolved reason), and the incident carries a `gate-holds-settled` event naming the jobs, so the record says why.
//
// A runtime-defect gate is held by the settle path itself, so the settler judges its job whatever the gate says (it never waits on the gate), and a
// green judgment under a new runtime revision is the evidence that the defect is gone: the gate is resolved `fixed` by `runtime`, never as the
// Supervisor or the owner, with that revision as its proof. A red judgment leaves the gate open and records `gate-rejudged` on it (recordGateRejudged).
import { appendEvent, resolveIncident } from '../../engine/db/ledger.mjs';
import { SETTLED_JOB_LIST } from '../../engine/admission.mjs';
import { supervisorGatesOf } from './autopilot-budget.mjs';
import { currentRuntimeRev } from './runtime-rev.mjs';

/** The resolved reason an incident row takes, and the event that says the holds settled. */
export const HOLDS_SETTLED_REASON = 'fixed';
export const HOLDS_SETTLED_EVENT = 'gate-holds-settled';
export const GATE_REJUDGED_EVENT = 'gate-rejudged';

const marks = (list) => list.map(() => '?').join(',');

/** Whether `gate` names jobs (no wildcard) and every job or op it names that exists is settled. */
function holdsSettled(db, workflowId, gate) {
  const holds = gate.holds.filter((hold) => typeof hold === 'string' && hold);
  if (!holds.length || holds.includes('*')) return false;
  const rows = db.prepare(`SELECT status FROM jobs WHERE workflow_id=? AND kind='op' AND (job_id IN (${marks(holds)}) OR op_id IN (${marks(holds)}))`).all(workflowId, ...holds, ...holds);
  return rows.length > 0 && rows.every((row) => SETTLED_JOB_LIST.includes(row.status));
}

/** Closes the open supervisor-gates of `workflowId` whose held jobs are all settled; returns the closed incident ids. */
export function releaseEndedGates(db, workflowId, { at = Date.now(), runtimeRev = currentRuntimeRev() } = {}) {
  const closed = [];
  for (const gate of supervisorGatesOf(db, workflowId)) {
    if (!holdsSettled(db, workflowId, gate)) continue;
    appendEvent(db, { workflowId, entityType: 'incident', entityId: gate.incidentId, kind: HOLDS_SETTLED_EVENT, payload: { resolution: HOLDS_SETTLED_REASON, by: 'runtime', proof: { runtimeRev, settledJobs: gate.holds }, holds: gate.holds, detail: gate.detail }, createdAt: at });
    if (resolveIncident(db, { incidentId: gate.incidentId, reason: HOLDS_SETTLED_REASON, at })) closed.push(gate.incidentId);
  }
  return closed;
}

/**
 * A red judgment of a job an open supervisor-gate holds: the evidence goes on the gate (event `gate-rejudged`, once per revision and reason), where the
 * Supervisor's item reads it. Returns the gates noted.
 */
export function recordGateRejudged(db, workflowId, jobId, { reason, detail = [], at = Date.now(), runtimeRev = currentRuntimeRev() } = {}) {
  const noted = [];
  for (const gate of supervisorGatesOf(db, workflowId).filter((entry) => entry.holds.includes(jobId))) {
    const last = db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind=? ORDER BY seq DESC LIMIT 1").get(workflowId, gate.incidentId, GATE_REJUDGED_EVENT);
    const prior = last ? JSON.parse(last.payload_json) : null;
    if (prior?.runtimeRev === runtimeRev && prior?.reason === reason) continue;
    appendEvent(db, { workflowId, entityType: 'incident', entityId: gate.incidentId, kind: GATE_REJUDGED_EVENT, payload: { jobId, reason, detail, runtimeRev }, createdAt: at });
    noted.push(gate.incidentId);
  }
  return noted;
}
