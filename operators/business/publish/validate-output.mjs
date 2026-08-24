import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);
const routes = {
  "architecture-required": {
    "stage": "architecture.decision.frame",
    "status": "ready",
    "fact": "business-head-ready",
    "state": "completed",
    "code": "business-publish-architecture-required"
  },
  "direct-plan": {
    "stage": "architecture.source",
    "status": "ready",
    "fact": "business-head-ready",
    "state": "completed",
    "code": "business-publish-direct-plan"
  },
  "blocked": {
    "stage": "business.blocked",
    "status": "blocked",
    "fact": "business-publication-blocked",
    "state": "blocked",
    "code": "business-publish-blocked"
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
  if (!blocked && value.payload.produced.businessHeadRef === null) errors.push('/payload/produced/businessHeadRef: successful output requires a session artifact');
  if (!blocked && value.payload.produced.durableWrites.length === 0) errors.push('/payload/produced/durableWrites: successful durable operator must name its approved effect');
  if (!blocked && value.payload.produced.durableWrites.some((target) => !/^\.worktrees\/[a-z0-9][a-z0-9-]*\/businesses(?:\/|$)/.test(target))) errors.push('/payload/produced/durableWrites: business publication may write only project business authority');
  if (blocked && (value.payload.produced.businessHeadRef !== null || value.payload.produced.durableWrites.length)) errors.push('/payload/produced: blocked output cannot claim publication effects');
  if (value.payload.cleanup.retention !== 'until-skill-terminal' || value.payload.cleanup.purgeAt !== 'skill-terminal') errors.push('/payload/cleanup: terminal purge is mandatory');
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
