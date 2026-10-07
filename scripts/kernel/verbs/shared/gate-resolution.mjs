// The Supervisor's answer to a supervisor-gate (modules/kernel/op-incident-policy.yaml `gate`): `starci kernel incident --resolve <gate> --by supervisor`
// carries one of three typed resolutions. The answer is recorded on the gate (event gate-answered) before the gate resolves.
//   fixed --commit <sha>             a runtime fix: the gate resolves once the live runtime contains the commit (now, or when the land arrives)
//   workaround --route <pool>        a route that avoids the cause: the gate resolves and the Kernel dispatches the job with --model <pool>
//   not-runtime-fault --detail <why> the cause is not the runtime's: the gate resolves back to the Kernel, which must act; the same cause and scope
//                                    is not raised again without new evidence (scripts/kernel/verbs/shared/gate-raise.mjs)
import { refuse } from '../../../../engine/refuse.mjs';
import { CONDITIONS_ATTACHED_EVENT, evaluateCondition } from '../../gate-conditions.mjs';
import { GATE_CONDITION_PARSERS } from '../../gate-runtime-conditions.mjs';
import { gateCauseOf, gateResolutions } from '../../gate-ladder.mjs';
import { supervisorGatesOf } from '../../autopilot-budget.mjs';
import { wakeKernelForTransition } from '../../wake-delivery.mjs';

const MIN_REASON_CHARS = 12;
const text = (value) => (typeof value === 'string' ? value.trim() : '');

const required = (resolution, flag) => refuse(`--resolution ${resolution} needs ${flag}`, 'gate-resolution-incomplete', { resolution });

/** The typed fields of the answer, or the typed refusal: {resolution, commit?, route?, detail?}. */
function answerOf(args) {
  const resolution = text(args.resolution);
  const allowed = gateResolutions();
  if (!allowed.includes(resolution)) {
    throw refuse(`a supervisor-gate is answered with --resolution ${allowed.join('|')} (fixed --commit <sha>, workaround --route <pool>, not-runtime-fault --detail <why>)`, 'gate-resolution-required', { allowed });
  }
  if (resolution === 'fixed') {
    const commit = text(args.commit);
    if (!commit) throw required(resolution, '--commit <sha> of the runtime fix');
    return { resolution, commit: GATE_CONDITION_PARSERS.get('runtime-has')('runtime-has', commit).commit };
  }
  if (resolution === 'workaround') {
    const route = text(args.route);
    if (!route) throw required(resolution, '--route <pool> the Kernel dispatches the job with');
    return { resolution, route };
  }
  const detail = text(args.detail);
  if (detail.length < MIN_REASON_CHARS) throw required(resolution, '--detail <why the cause is not the runtime\'s, with the evidence>');
  return { resolution, detail };
}

const wakeLinesOf = (gate, answer) => {
  const tail = {
    fixed: `the runtime fix ${answer.commit.slice(0, 12)} is in the live runtime`,
    workaround: `dispatch the held job with --model ${answer.route}`,
    'not-runtime-fault': `the cause is not the runtime's (${answer.detail}) - act on it in the workflow: you must retry, re-plan or decide`,
  }[answer.resolution];
  return [`The Supervisor answered gate ${gate.incidentId} (${gateCauseOf(gate)}) with ${answer.resolution}: ${tail}.`, 'Re-read canonical starci kernel status now.'];
};

const wakeKernel = (ledger, { workflowId, gate, answer }) => {
  try { wakeKernelForTransition(ledger, { workflowId, transition: 'gate-answered', ids: { incidentId: gate.incidentId }, lines: wakeLinesOf(gate, answer) }); } catch { /* the wake is best effort */ }
};

/** `fixed` waits when the live runtime lacks the commit: the typed condition the status pass resolves the gate by. */
function waitForLand(ledger, { workflowId, gate, answer, repo }) {
  const until = [{ type: 'runtime-has', commit: answer.commit }];
  if (evaluateCondition(ledger.db, until[0], { repo, workflowId }).met) return false;
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'incident', entityId: gate.incidentId, kind: CONDITIONS_ATTACHED_EVENT, payload: { until, detail: `Supervisor fix ${answer.commit}` } }));
  return true;
}

/**
 * The Supervisor's typed answer to the gate `row` being resolved: null when `row` is no supervisor-gate or `by` is not the Supervisor;
 * else {answer, waiting, gate, wake} after recording the answer (gate-answered); `wake` tells the Kernel once the gate has resolved. `waiting` is true for a `fixed` whose commit is not in the live runtime yet:
 * the gate stays open and the runtime resolves it. Throws the typed refusal for a missing or incomplete resolution.
 */
export function answerGate(ledger, { workflowId, row, args, by, repo, isGate }) {
  if (!isGate || by !== 'supervisor' || row.status !== 'open') return null;
  const gate = supervisorGatesOf(ledger.db, workflowId).find((entry) => entry.incidentId === row.incident_id);
  if (!gate) return null;
  const answer = answerOf(args);
  const waiting = answer.resolution === 'fixed' && waitForLand(ledger, { workflowId, gate, answer, repo });
  ledger.transaction(() => ledger.appendEvent({ workflowId, entityType: 'incident', entityId: gate.incidentId, kind: 'gate-answered',
    payload: { ...answer, by, cause: gateCauseOf(gate), holds: gate.holds, evidence: gate.detail } }));
  return { answer, waiting, gate, wake: () => wakeKernel(ledger, { workflowId, gate, answer }) };
}
