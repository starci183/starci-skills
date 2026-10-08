// admission-refusal.mjs - what a refused launch admission tells the Kernel. The admission plan rejects each candidate with typed codes
// (scripts/lib/agent-admission.mjs); the dispatch-rejected record used to keep only "no-eligible-candidate", so a Kernel could not tell a
// pool that is merely full from an agent that cannot serve the job. A refusal whose every code is a capacity condition is a WAIT (a
// typed hold of modules/kernel/op-incident-policy.yaml, queuedBecause pool-full or circuit-open): it names the cause and the untried
// members of the job's route chain, and it never counts as the agent's fault (job-rejections.mjs). Any other code stays a candidate
// refusal and names the alternatives the route chain still holds.
import { list } from '../lib/list.mjs';

// Admission codes that say the candidate is busy or parked for a while, not that it cannot serve this job; the value is the
// queuedBecause hold of the policy table the wait reads as.
const WAIT_CODES = Object.freeze({ 'capacity-full': 'pool-full', 'incident-open': 'circuit-open', 'provider-blocked': 'circuit-open' });

/** The members of the job's route chain that are neither the refused pool nor rejected by the route: the agents the Kernel can still use. */
export function untriedRouteMembers(payload, refused) {
  const rejected = new Set(list(payload?.routeRejected).map((entry) => entry?.target));
  return list(payload?.routeChain).filter((member) => member !== refused && member !== payload?.model && !rejected.has(member));
}

const rowOf = (row) => ({ id: row.id ?? null, provider: row.provider ?? null, model: row.model ?? null, codes: list(row.codes) });
const isWait = (rows) => rows.length > 0 && rows.every((row) => row.codes.length > 0 && row.codes.every((code) => code in WAIT_CODES));
const alternativesLine = (alternatives) => (alternatives.length
  ? `admissible alternatives in the route chain: ${alternatives.join(', ')}`
  : 'the route chain holds no untried member');

/**
 * The record of one refused admission, or null when the launch result carries no admission plan:
 * {class: 'wait'|'candidate', queuedBecause, rejected: [{id, provider, model, codes}], alternatives, line}.
 */
export function admissionRefusalOf(launched, payload, model) {
  const rejected = list(launched?.decision?.rejected).map(rowOf);
  if (launched?.step !== 'admission' || rejected.length === 0) return null;
  const alternatives = untriedRouteMembers(payload, model?.target ?? null);
  const wait = isWait(rejected);
  const queuedBecause = wait ? WAIT_CODES[rejected[0].codes[0]] : null;
  const why = rejected.map((row) => `${row.id ?? row.model}: ${row.codes.join('+')}`).join('; ');
  const head = wait
    ? `a wait (${queuedBecause}), not the agent's fault; it clears when the holder settles or the circuit expires`
    : 'every candidate is refused by its own conditions';
  return { class: wait ? 'wait' : 'candidate', queuedBecause, rejected, alternatives, line: `${why} - ${head}; ${alternativesLine(alternatives)}` };
}

/** True for a stored dispatch-rejected payload whose admission refusal is a wait: it spends no pool strike. */
export const isAdmissionWait = (payload) => payload?.admission?.class === 'wait';
