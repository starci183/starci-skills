import { randomBytes } from 'node:crypto';
import { parseJson } from '../lib/json.mjs';
import { positiveNumber } from '../lib/number.mjs';
import { list } from '../lib/list.mjs';
import { openIncident } from '../../engine/db/ledger.mjs';
import { usageOfWorkflow } from './usage-report.mjs';

export const AUTOPILOT_BY = 'autopilot';
export const AUTOPILOT_RULING = 'autopilot-run-to-finish';
export const SUPERVISOR_GATE = 'supervisor-gate';
export const openIncidents = (db, workflowId) => db.prepare("SELECT incident_id,op_id,last_progress,updated_at FROM incidents WHERE workflow_id=? AND status='open' ORDER BY updated_at").all(workflowId);
export const kindOf = (lastProgress) => /^\[([^\]]+)\]/.exec(String(lastProgress ?? ''))?.[1] ?? null;

/** Open supervisor-gate incidents: [{incidentId, opId, holds[], detail, since}]. */
export function supervisorGatesOf(db, workflowId) {
  return openIncidents(db, workflowId).filter((row) => kindOf(row.last_progress) === SUPERVISOR_GATE).map((row) => {
    const raised = db.prepare("SELECT created_at,payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind='incident-raised' ORDER BY seq DESC LIMIT 1").get(workflowId, row.incident_id);
    const payload = parseJson(raised?.payload_json, {}) ?? {};
    return { incidentId: row.incident_id, opId: row.op_id ?? null, holds: list(payload.holds).length ? payload.holds : [row.op_id].filter(Boolean),
      detail: String(row.last_progress ?? '').replace(/^\[[^\]]+\]\s*/, ''), since: raised?.created_at ?? row.updated_at };
  });
}

const newIncidentId = () => `inc-${randomBytes(3).toString('hex')}${Date.now().toString(16).slice(-6)}`;
/** Open one supervisor-gate incident (inside the caller's transaction). */
export function openSupervisorGate(ledger, { workflowId, opId = null, holds = [], detail, evidence = null, route = null, auto = true }) {
  const incidentId = newIncidentId();
  openIncident(ledger.db, { incidentId, workflowId, kind: SUPERVISOR_GATE, opId, lastProgress: `[${SUPERVISOR_GATE}] ${detail}`, detail });
  ledger.appendEvent({ workflowId, entityType: 'incident', entityId: incidentId, kind: 'incident-raised',
    payload: { kind: SUPERVISOR_GATE, detail, opId, holds, auto, by: AUTOPILOT_BY, ruling: AUTOPILOT_RULING, ...(route ? { route } : {}), ...(evidence ? { evidence } : {}) } });
  return incidentId;
}


/** Settled attempts of the workflow with no usage yet that ended after `since`: the usage sweep has not had its turn for them. */
const meteringOf = (db, workflowId, since) => Number(db.prepare(`SELECT count(*) n FROM op_attempts a WHERE a.workflow_id=? AND a.usage_source IS NULL
  AND (a.settled_at IS NOT NULL OR a.end_state IS NOT NULL) AND COALESCE(a.settled_at,a.released_at,a.reported_at,a.started_at,0)>?
  AND NOT EXISTS(SELECT 1 FROM llm_usage u WHERE u.subject_type='attempt' AND u.attempt_id=a.attempt_id)`).get(workflowId, since).n);

/**
 * Compare real dispatch attempts and recorded workflow usage against the existing autopilot caps.
 * Missing usage on completed attempts leaves tokens unknown; measured tokens remain a lower bound.
 * Open attempts are reported separately because their usage has not finished yet, and so are attempts that ended less than
 * `meteringWindowMs` ago (the usage sweep's interval): their usage is still being metered, not unknown.
 */
export function workflowBudget(db, workflowId, { settings, extensionKind, now = Date.now(), meteringWindowMs = 0 }) {
  const extended = db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND kind=? ORDER BY seq').all(workflowId, extensionKind)
    .reduce((total, row) => {
      const value = parseJson(row.payload_json, {}) ?? {};
      for (const key of ['attempts', 'tokens', 'wallMs']) total[key] += positiveNumber(value[key], 0, { orZero: true });
      return total;
    }, { attempts: 0, tokens: 0, wallMs: 0 });
  const caps = Object.fromEntries(Object.keys(extended).map(key => [key, settings.budgets[key] + extended[key]]));
  const usage = usageOfWorkflow(db, workflowId);
  const metering = meteringOf(db, workflowId, now - meteringWindowMs);
  const unmetered = usage.coverage.unavailable + usage.coverage.pending;
  const unknown = unmetered - metering;
  const started = db.prepare('SELECT MIN(created_at) at FROM events WHERE workflow_id=?').get(workflowId)?.at ?? now;
  const measured = { tokens: usage.total.tokens };
  const used = { attempts: usage.coverage.attempts, tokens: unmetered ? null : measured.tokens, wallMs: Math.max(0, now - Number(started)) };
  const exceeded = Object.keys(caps).filter(key => caps[key] > 0 && (key === 'tokens' ? measured.tokens : used[key]) > caps[key]);
  const unverified = unknown && caps.tokens > 0 ? ['tokens'] : [];
  return { used, caps, exceeded, unverified, measured, coverage: { ...usage.coverage, metering, unknown, complete: unmetered === 0 && usage.coverage.open === 0 } };
}
