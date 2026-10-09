// gate-ladder.mjs — a supervisor-gate on the ONE Supervisor ladder (modules/kernel/op-incident-policy.yaml `gate` and `ladder`; invariants I2, I4, I7, I8).
// Each open gate has one Decision Item for the Supervisor (opened by the Workflow controller, scripts/reconciler/gate-plan.mjs). The Supervisor
// answers it with one of three typed resolutions (`fixed`, `workaround`, `not-runtime-fault`: scripts/kernel/verbs/shared/gate-resolution.mjs);
// unanswered, the DI climbs one level per step (scripts/kernel/supervisor-di-ladder.mjs) until the owner level, where the owner is told once.
// This module is the shared reading of that chain: the DI key, the gate's current handler / step / deadline / watched condition, and whether the owner was told.
import { readMachine } from '../../engine/db/machine.mjs';
import { parseJson } from '../lib/json.mjs';
import { byCodeUnit, list } from '../lib/list.mjs';
import { boundValue, incidentPolicy } from './op-incident-policy.mjs';
import { ladderOf } from './supervisor-di-ladder.mjs';
import { supervisorGatesOf } from './autopilot-budget.mjs';
import { GATE_REJUDGED_EVENT } from './gate-holds-ended.mjs';

const ANSWERED_EVENT = 'gate-answered';
const UNCLASSIFIED = 'unclassified';

/** The table's gate block, numbers resolved: {ackMs, resolutions[], deferAfter}. */
export const gatePolicyOf = () => {
  const { gate } = incidentPolicy();
  return { ackMs: boundValue(gate.ackMs), resolutions: list(gate.resolutions), deferAfter: gate.deferAfter };
};

/** The typed resolutions of a Supervisor answer. */
export const gateResolutions = () => gatePolicyOf().resolutions;

/** The cause class a gate named at its raise, else `unclassified` (a gate raised before the policy). */
export const gateCauseOf = (gate) => gate.workaround?.cause ?? UNCLASSIFIED;

/** The scope of a gate: its holds, in a stable order. */
const gateScopeOf = (gate) => [...gate.holds].sort(byCodeUnit).join('+');

/** Gates raised earlier in the workflow with the same cause and scope: the episode number of this one. */
const episodeOf = (db, workflowId, gate) => db.prepare("SELECT entity_id,payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND kind='incident-raised' ORDER BY seq").all(workflowId)
  .map((row) => ({ id: row.entity_id, ...parseJson(row.payload_json, {}) }))
  .filter((raised) => raised.kind === 'supervisor-gate' && (raised.workaround?.cause ?? UNCLASSIFIED) === gateCauseOf(gate) && [...list(raised.holds)].sort(byCodeUnit).join('+') === gateScopeOf(gate))
  .findIndex((raised) => raised.id === gate.incidentId);

/** The subject part of the gate's Decision Item key: one per (cause, scope) episode, so the owner is told once per cause. */
export const gateSubjectOf = (db, workflowId, gate) => `gate-${gateCauseOf(gate)}-${gateScopeOf(gate)}-${Math.max(0, episodeOf(db, workflowId, gate))}`;

/** The newest event of `kind` recorded on the gate ({at, ...payload}), or null: the Supervisor's answer, the settler's red re-judgment. */
const gateEventOf = (db, workflowId, incidentId, kind) => {
  const row = db.prepare("SELECT created_at,payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND entity_id=? AND kind=? ORDER BY seq DESC LIMIT 1").get(workflowId, incidentId, kind);
  return row ? { at: row.created_at, ...parseJson(row.payload_json, {}) } : null;
};

/** The ladder level the gate has reached by age alone: 0 awaiting the Supervisor's acknowledgement, then one per step, at most the owner level. */
const levelOf = (age, { ackMs, stepMs, ownerAfter }) => (age < ackMs ? 0 : Math.min(ownerAfter, Math.floor((age - ackMs) / stepMs) + 1));

const conditionOf = (gate, typed, cause) => {
  const open = typed.find((incident) => incident.incidentId === gate.incidentId);
  if (open) return { condition: open.results.map(({ condition, met, evidence }) => ({ condition, met, evidence })), conditionNote: null };
  const why = list(incidentPolicy().gateCauses).find((entry) => entry.id === cause)?.conditionWhy;
  const reason = why ? `: ${why}` : '';
  return { condition: null, conditionNote: `none${reason}; the ladder carries it` };
};

/**
 * The status view of one open gate: {incidentId, opId, holds, since, cause, workaround, handler, step, steps, deadlineAt, condition, conditionNote, answered?}.
 * `handler` is who acts now (supervisor, then owner once the ladder reached it; runtime-auto while a `fixed` answer waits for its commit to land),
 * `step` of `steps` the ladder position, `deadlineAt` when the next hand-over happens, `condition` the watched release condition or null.
 */
export function gateViewOf(db, workflowId, gate, { now, typed = [], timeoutMs }) {
  const ladder = { ...ladderOf(), ackMs: gatePolicyOf().ackMs };
  const cause = gateCauseOf(gate);
  const level = levelOf(Math.max(0, now - Number(gate.since)), ladder);
  const answer = gateEventOf(db, workflowId, gate.incidentId, ANSWERED_EVENT);
  const rejudged = gateEventOf(db, workflowId, gate.incidentId, GATE_REJUDGED_EVENT);
  const atOwner = level >= ladder.ownerAfter;
  const waitingForLand = answer?.resolution === 'fixed' && !atOwner;
  let handler = 'supervisor';
  if (atOwner) handler = 'owner';
  if (waitingForLand) handler = 'runtime-auto';
  return { incidentId: gate.incidentId, opId: gate.opId, holds: gate.holds, since: gate.since, detail: gate.detail ?? null, cause, workaround: gate.workaround ?? null, handler, step: level + 1, steps: ladder.ownerAfter + 1,
    deadlineAt: atOwner ? Number(gate.since) + timeoutMs : Number(gate.since) + ladder.ackMs + level * ladder.stepMs,
    ...conditionOf(gate, typed, cause), ...(answer ? { answered: { resolution: answer.resolution, at: answer.at } } : {}),
    ...(rejudged ? { rejudged: { runtimeRev: rejudged.runtimeRev ?? null, reason: rejudged.reason ?? null, detail: rejudged.detail ?? [], at: rejudged.at } } : {}) };
}

/** Whether the gate's Supervisor Decision Item reached the owner level, so the owner was told (the table's `deferAfter: owner-told`). */
export function gateOwnerTold(workflowId, gate, { env = process.env } = {}) {
  const { ownerAfter } = ladderOf();
  const needle = `:${workflowId}:gate-${gateCauseOf(gate)}-${gateScopeOf(gate)}-`;
  return readMachine((m) => m.listSupDecisions({ open: false }), [], { env })
    .some((di) => di.idempotency_key.includes(needle) && di.status !== 'superseded' && Number(di.escalations) >= ownerAfter);
}

/**
 * The open gates of a workflow read from its ledger alone, each as the status view plus its Decision Item subject: what the Workflow controller opens the
 * Supervisor's item from when the status cannot be read, so an open gate never lacks its item for a failed read.
 */
export const gateViewsFromLedger = (db, workflowId, { now, timeoutMs }) => supervisorGatesOf(db, workflowId)
  .map((gate) => ({ ...gateViewOf(db, workflowId, gate, { now, typed: [], timeoutMs }), subject: gateSubjectOf(db, workflowId, gate) }));
