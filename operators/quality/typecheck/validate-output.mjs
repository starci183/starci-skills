import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);
const routes = {
  "pass": {
    "stage": "quality.build",
    "status": "ready",
    "fact": "quality-typecheck-pass",
    "state": "completed",
    "code": "quality-typecheck-pass"
  },
  "in-boundary": {
    "stage": "be.repair",
    "status": "ready",
    "fact": "in-boundary-repair",
    "state": "replan",
    "code": "quality-typecheck-in-boundary"
  },
  "boundary-drift": {
    "stage": "architecture.boundary",
    "status": "ready",
    "fact": "backend-boundary-feedback",
    "state": "replan",
    "code": "quality-typecheck-boundary-drift"
  },
  "external-blocker": {
    "stage": "quality.blocked",
    "status": "blocked",
    "fact": "quality-external-blocker",
    "state": "blocked",
    "code": "quality-typecheck-external-blocker"
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
  if (!blocked && value.payload.produced.typecheckReceiptRef === null) errors.push('/payload/produced/typecheckReceiptRef: non-blocked output requires a session artifact');
  if (value.payload.produced.durableWrites.length !== 0) errors.push('/payload/produced/durableWrites: quality evidence is session-only');
  if (value.payload.cleanup.retention !== 'until-skill-terminal' || value.payload.cleanup.purgeAt !== 'skill-terminal') errors.push('/payload/cleanup: terminal purge is mandatory');
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
