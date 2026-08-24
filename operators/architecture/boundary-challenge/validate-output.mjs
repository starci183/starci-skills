import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);
const routes = {
  "clean": {
    "stage": "architecture.boundary.review",
    "status": "pending",
    "fact": "backend-boundary-challenged",
    "state": "completed",
    "code": "architecture-boundary-challenge-clean"
  },
  "revise": {
    "stage": "architecture.boundary",
    "status": "ready",
    "fact": "backend-boundary-feedback",
    "state": "replan",
    "code": "architecture-boundary-challenge-revise"
  },
  "blocked": {
    "stage": "architecture.blocked",
    "status": "blocked",
    "fact": "backend-boundary-blocked",
    "state": "blocked",
    "code": "architecture-boundary-challenge-blocked"
  }
};

function semantic(value) {
  const errors = [];
  const route = routes[value.payload.decision];
  if (!route) return ['/payload/decision: undeclared decision'];
  if (value.stage !== route.stage || value.status !== route.status) errors.push('/stage: decision does not match emitted route');
  if (value.payload.state.status !== route.state || value.payload.state.code !== route.code) errors.push('/payload/state: status or code does not match decision');
  if (value.payload.state.emits.stage !== value.stage || value.payload.state.emits.status !== value.status) errors.push('/payload/state/emits: must match root route');
  if (!value.facts.includes(route.fact) || !value.payload.state.emits.factsAdd.includes(route.fact)) errors.push(`/facts: missing emitted fact ${route.fact}`);
  const blocked = value.payload.state.status === 'blocked';
  if (!blocked && value.payload.produced.boundaryChallengeRef === null) errors.push('/payload/produced/boundaryChallengeRef: successful output requires a session artifact');
  if (value.payload.produced.durableWrites.length !== 0) errors.push('/payload/produced/durableWrites: read-only operator cannot report durable writes');
  if (value.payload.cleanup.retention !== 'until-skill-terminal' || value.payload.cleanup.purgeAt !== 'skill-terminal') errors.push('/payload/cleanup: terminal purge is mandatory');
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
