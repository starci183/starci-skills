// The I6 step of `starci kernel incident` for a supervisor-gate (modules/kernel/op-incident-policy.yaml `gateCauses`): the raise names its cause and
// the workaround it tried or why there is none. A cause the runtime can work around itself is recorded as a revisitable decision for the owner's
// handover list and opens no gate.
import { AUTOPILOT_BY, AUTOPILOT_RULING, SUPERVISOR_GATE } from '../../autopilot-budget.mjs';
import { AUTOPILOT_EVENTS } from '../../autopilot-state.mjs';
import { gateCauses, gateWorkaroundOf } from '../../gate-workaround.mjs';
import { parseCondition } from '../../gate-conditions.mjs';

const textOf = (value) => (typeof value === 'string' ? value : undefined);

/** The workaround record of a gate raise, or {redirected} after the runtime recorded the workaround itself. Throws the typed refusal. */
function gateRaiseOf(ledger, { workflowId, args, holds }) {
  const record = gateWorkaroundOf(ledger.db, { cause: textOf(args.cause), workaround: textOf(args.workaround), noWorkaround: textOf(args['no-workaround']),
    because: textOf(args.because), holds, mechanical: true });
  if (!record.mechanical) return { workaround: record };
  const decision = { by: AUTOPILOT_BY, ruling: AUTOPILOT_RULING, cause: record.cause, holds, reason: String(args.detail ?? ''), revisit: true, workaround: record.mechanical };
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: AUTOPILOT_EVENTS.decision, payload: decision }));
  return { redirected: record.mechanical, decision };
}

/** The typed condition the cause class attaches when the raise names none (policy gateCauses `condition`), pushed onto `until`. */
const attachCondition = (until, { cause, holds }) => {
  const type = gateCauses().find((entry) => entry.id === cause)?.condition;
  const jobId = holds.find((hold) => hold !== '*');
  if (until.length || !type || !jobId) return;
  until.push(parseCondition(type, jobId));
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
    attachCondition(until, { cause: gate.workaround.cause, holds: scope });
    return gate;
  }
  return { ...gate, out: { ok: true, workflowId, redirected: gate.redirected, decision: gate.decision },
    text: `no gate opened on ${workflowId}: the ${gate.decision.cause} workaround is a revisitable decision in the handover list` };
}
