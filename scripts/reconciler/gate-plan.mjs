// scripts/reconciler/gate-plan.mjs — a supervisor-gate on the ONE Supervisor ladder (modules/kernel/op-incident-policy.yaml `gate`): the Workflow
// controller opens one Decision Item for the Supervisor per open gate (starci kernel status autopilot.supervisorGates, else the ledger's open gates), whose options are the three
// typed resolutions. The ladder (scripts/kernel/supervisor-di-ladder.mjs) climbs it from there to the owner, who is told once with what was tried.
import { clipLine } from '../lib/clip.mjs';

const RESOLVE = 'starci kernel incident --repo <repo> --workflow';

/** The three typed resolutions as commands the Supervisor runs (the DI's options). */
const gateOptions = (workflowId, incidentId) => {
  const base = `${RESOLVE} ${workflowId} --resolve ${incidentId} --by supervisor`;
  return [
    { key: 'fixed', verb: `${base} --resolution fixed --commit <sha> --detail <what landed>`, title: 'fixed: a runtime fix; the gate resolves once the live runtime contains the commit', tier: 'supervisor', recommended: false },
    { key: 'workaround', verb: `${base} --resolution workaround --route <pool> --detail <why this route avoids the cause>`, title: 'workaround: a route for the Kernel to dispatch the held job with', tier: 'supervisor', recommended: false },
    { key: 'not-runtime-fault', verb: `${base} --resolution not-runtime-fault --detail <why, with the evidence>`, title: 'not-runtime-fault: back to the Kernel, which must act', tier: 'supervisor', recommended: false },
  ];
};

const triedOf = (gate) => {
  const tried = gate.workaround?.attempt ?? (gate.workaround?.none ? `no workaround: ${gate.workaround.none} (${gate.workaround.because ?? ''})` : 'no workaround recorded');
  return `tried: ${clipLine(tried, 200)}`;
};

const watchedOf = (gate) => {
  const watched = (gate.condition ?? []).map((entry) => `${entry.condition}${entry.met ? ' (met)' : ''}`).join(' AND ');
  return `watching: ${watched || gate.conditionNote || 'nothing'}`;
};

/** The Supervisor's item is offered again under every new runtime revision (a new subject, so a new item and a ring), with the commits that may have fixed the cause. */
const revisionOf = (gate) => (gate.runtimeRev ? `@${shortRev(gate.runtimeRev)}` : '');
const candidatesOf = (gate) => {
  if (!gate.runtimeRev) return [];
  const listed = (gate.fixCandidates ?? []).map((c) => `${c.sha} ${clipLine(c.subject, 70)}`).join(' | ') || 'none found';
  return [`the live runtime is ${shortRev(gate.runtimeRev)}; commits since the gate was raised that touch its cause: ${listed}; answer fixed --text <commit> when one is the fix`];
};

const shortRev = (rev) => String(rev ?? '?').slice(0, 12);
const rejudgedOf = (gate) => {
  if (!gate.rejudged) return [];
  const why = gate.rejudged.detail?.length ? ` (${clipLine(gate.rejudged.detail.join('; '), 160)})` : '';
  return [`re-judged under runtime ${shortRev(gate.rejudged.runtimeRev)}, still red: ${gate.rejudged.reason}${why}`];
};

/** The Supervisor Decision Item of each open gate; nothing for a workflow whose status carries no gates. Pure. */
export function planSupervisorGates(p) {
  const { workflowId, ledgerId } = p;
  for (const gate of p.gates?.length ? p.gates : p.status?.autopilot?.supervisorGates ?? []) {
    if (!gate.incidentId || !gate.subject) continue;
    const held = gate.holds.join(', ');
    p.di({ kind: 'runtime-defect', subject: `${gate.subject}${revisionOf(gate)}`, decider: 'supervisor', ledger: 'supervisor', entity: { type: 'workflow', id: workflowId },
      summary: `supervisor-gate ${gate.incidentId} (${gate.cause}) holds ${held}: answer fixed, workaround or not-runtime-fault`,
      evidence: [triedOf(gate), watchedOf(gate), ...rejudgedOf(gate), ...candidatesOf(gate), `${gate.handler} step ${gate.step} of ${gate.steps}`, `ledger ${ledgerId} workflow ${workflowId} incident ${gate.incidentId}`],
      options: gateOptions(workflowId, gate.incidentId), allowedVerbs: ['starci kernel incident'], refs: { gateIncident: gate.incidentId, ledgerId, cause: gate.cause } });
  }
}
