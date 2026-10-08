// The I6 step of `starci kernel incident` for a supervisor-gate (modules/kernel/op-incident-policy.yaml `gateCauses`): the raise names its cause and
// the workaround it tried or why there is none. A cause the runtime can work around itself is recorded as a revisitable decision for the owner's
// handover list and opens no gate.
import path from 'node:path';
import { AUTOPILOT_BY, AUTOPILOT_RULING, SUPERVISOR_GATE } from '../../autopilot-budget.mjs';
import { AUTOPILOT_EVENTS } from '../../autopilot-state.mjs';
import { gateCauses, gateWorkaroundOf } from '../../gate-workaround.mjs';
import { workClassedJobs } from '../../failure-class.mjs';
import { evaluateCondition, parseCondition } from '../../gate-conditions.mjs';
import { parseJson } from '../../../lib/json.mjs';
import { byCodeUnit } from '../../../lib/list.mjs';
import { refuse } from '../../../../engine/refuse.mjs';

const textOf = (value) => (typeof value === 'string' ? value : undefined);

const norm = (value) => String(value ?? '').trim().replaceAll(/\s+/g, ' ');

/** What the Supervisor answered not-runtime-fault for this cause and scope, with the evidence of that gate: [{incidentId, evidence}]. */
const refutedOf = (db, workflowId, { cause, holds }) => db.prepare("SELECT entity_id,payload_json FROM events WHERE workflow_id=? AND entity_type='incident' AND kind='gate-answered' ORDER BY seq").all(workflowId)
  .map((row) => ({ incidentId: row.entity_id, ...parseJson(row.payload_json, {}) }))
  .filter((answer) => answer.resolution === 'not-runtime-fault' && answer.cause === cause && [...(answer.holds ?? [])].sort(byCodeUnit).join('+') === [...holds].sort(byCodeUnit).join('+'));

/** A gate for a cause and scope the Supervisor already ruled not the runtime's needs --evidence the earlier gate did not carry. */
function refuseWithoutNewEvidence(db, { workflowId, args, cause, holds }) {
  const refuted = refutedOf(db, workflowId, { cause, holds });
  if (!refuted.length) return;
  const seen = new Set(refuted.map((answer) => norm(answer.evidence)));
  const evidence = norm(args.evidence);
  if (evidence && !seen.has(evidence)) return;
  throw refuse(`supervisor-gate (${cause}): the Supervisor answered not-runtime-fault for this cause and scope (${refuted.map((answer) => answer.incidentId).join(', ')}) - act on it as the Kernel, or raise it again with --evidence that differs from what that gate carried`,
    'gate-reraise-without-evidence', { cause, incidents: refuted.map((answer) => answer.incidentId) });
}

/**
 * The runtime-defect cause over jobs whose evidence the failure-code catalog classes as work (a failing check on the op's own product)
 * is a wrong class: it is the Kernel's error-work step (retry, switch agent, re-plan), so the raise is refused and names the jobs.
 */
function refuseWorkClass(db, { cause, holds }) {
  if (cause !== 'runtime-defect') return;
  const jobs = holds.filter((hold) => hold !== '*');
  const work = jobs.length ? workClassedJobs(db, jobs) : [];
  if (!work.length || work.length !== jobs.length) return;
  throw refuse(`supervisor-gate (runtime-defect): ${work.join(', ')} failed on evidence the failure-code catalog classes as work (a failing check on the op's own product), so it is the Kernel's step (starci kernel status menu: retry, switch agent, re-plan), not a runtime fault`,
    'gate-cause-class-work', { cause, jobs: work });
}

/** The workaround record of a gate raise, or {redirected} after the runtime recorded the workaround itself. Throws the typed refusal. */
function gateRaiseOf(ledger, { workflowId, args, holds }) {
  refuseWorkClass(ledger.db, { cause: textOf(args.cause), holds });
  const record = gateWorkaroundOf(ledger.db, { cause: textOf(args.cause), workaround: textOf(args.workaround), noWorkaround: textOf(args['no-workaround']),
    because: textOf(args.because), holds, mechanical: true });
  if (!record.mechanical) {
    refuseWithoutNewEvidence(ledger.db, { workflowId, args, cause: record.cause, holds });
    return { workaround: record };
  }
  const decision = { by: AUTOPILOT_BY, ruling: AUTOPILOT_RULING, cause: record.cause, holds, reason: String(args.detail ?? ''), revisit: true, workaround: record.mechanical };
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: AUTOPILOT_EVENTS.decision, payload: decision }));
  return { redirected: record.mechanical, decision };
}

/**
 * The typed condition the cause class attaches when the raise names none (policy gateCauses `condition`), pushed onto `until`.
 * A condition that already holds says nothing about the cause (the refusal is not what it watches), so it is not attached.
 */
const attachCondition = (until, { cause, holds, db, workflowId, repo }) => {
  const type = gateCauses().find((entry) => entry.id === cause)?.condition;
  const jobId = holds.find((hold) => hold !== '*');
  if (until.length || !type || !jobId) return;
  const condition = parseCondition(type, jobId);
  if (!evaluateCondition(db, condition, { repo, workflowId }).met) until.push(condition);
};

/**
 * The raise step of `starci kernel incident`: {} for any kind but a supervisor-gate, else {workaround} or {redirected, out, text}.
 * `until` (the raise's typed conditions) gains the cause class's own condition when it names none.
 */
export function gateStepOf(ledger, { workflowId, args, holds, until }) {
  if (args.kind !== SUPERVISOR_GATE) return {};
  const scope = holds.length ? holds : [args.op].filter(Boolean);
  const gate = gateRaiseOf(ledger, { workflowId, args, holds: scope });
  if (!gate.redirected) {
    attachCondition(until, { cause: gate.workaround.cause, holds: scope, db: ledger.db, workflowId, repo: path.resolve(args.repo ?? process.cwd()) });
    return gate;
  }
  return { ...gate, out: { ok: true, workflowId, redirected: gate.redirected, decision: gate.decision },
    text: `no gate opened on ${workflowId}: the ${gate.decision.cause} workaround is a revisitable decision in the handover list` };
}
