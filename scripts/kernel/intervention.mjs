// intervention.mjs — the event that marks a ledger write made by a person. A write admitted for an owner with no seat behind it
// and no runtime marker (the reconciler, the Supervisor and the settler export STARCI_ACTOR, STARCI_API_CHILD or STARCI_CALLER
// into the children they spawn) is a person at a shell. The first write of the call appends one `ledger-written-outside-seat`
// event to the workflow it targets, so `starci debug digest` counts the interventions of a run.
import { readEnv } from '../lib/env.mjs';

export const INTERVENTION_EVENT = 'ledger-written-outside-seat';
const RUNTIME_MARKERS = Object.freeze(['STARCI_ACTOR', 'STARCI_API_CHILD', 'STARCI_CALLER']);

/** {actor: 'person', via} for an admitted identity that is a person, or null for a seat and for a runtime child. */
export function personActor(identity, env) {
  if (identity.role !== 'owner' || identity.via !== 'unbound') return null;
  if (RUNTIME_MARKERS.some((name) => readEnv(name, env))) return null;
  return { actor: 'person', via: identity.via };
}

/** Append the intervention event for the workflow `targets` names first; no target workflow, no event. Returns whether one was appended. */
export function recordIntervention(ledger, { targets, verb, actor }) {
  const workflowId = [...targets][0];
  if (!workflowId) return false;
  ledger.appendEvent({ workflowId, entityType: 'workflow', entityId: workflowId, kind: INTERVENTION_EVENT, payload: { actor: actor.actor, via: actor.via, verb: verb ?? null } });
  return true;
}
