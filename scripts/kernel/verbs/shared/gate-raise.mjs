// The I6 step of `starci kernel incident` for a supervisor-gate (modules/kernel/op-incident-policy.yaml `gateCauses`): the raise names its cause and
// the workaround it tried or why there is none. A cause the runtime can work around itself is recorded as a revisitable decision for the owner's
// handover list and opens no gate.
import { AUTOPILOT_BY, AUTOPILOT_RULING, SUPERVISOR_GATE } from '../../autopilot-budget.mjs';
import { AUTOPILOT_EVENTS } from '../../autopilot-state.mjs';
import { gateWorkaroundOf } from '../../gate-workaround.mjs';

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

/** The raise step of `starci kernel incident`: {} for any kind but a supervisor-gate, else {workaround} or {redirected, out, text}. */
export function gateStepOf(ledger, { workflowId, args, holds }) {
  if (args.kind !== SUPERVISOR_GATE) return {};
  const gate = gateRaiseOf(ledger, { workflowId, args, holds: holds.length ? holds : [args.op].filter(Boolean) });
  if (!gate.redirected) return gate;
  return { ...gate, out: { ok: true, workflowId, redirected: gate.redirected, decision: gate.decision },
    text: `no gate opened on ${workflowId}: the ${gate.decision.cause} workaround is a revisitable decision in the handover list` };
}
