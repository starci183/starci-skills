import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);
const routes = {
  "repaired": {
    "stage": "quality.repair.result",
    "status": "complete",
    "fact": "finding-repaired",
    "state": "completed",
    "code": "quality-finding-repair-repaired"
  },
  "boundary-drift": {
    "stage": "quality.blocked",
    "status": "blocked",
    "fact": "repair-boundary-drift",
    "state": "blocked",
    "code": "quality-finding-repair-boundary-drift"
  },
  "stale-finding": {
    "stage": "quality.inventory",
    "status": "ready",
    "fact": "finding-stale",
    "state": "replan",
    "code": "quality-finding-repair-stale-finding"
  },
  "external-blocker": {
    "stage": "quality.blocked",
    "status": "blocked",
    "fact": "repair-external-blocker",
    "state": "blocked",
    "code": "quality-finding-repair-external-blocker"
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
  const mutated = value.payload.decision === 'repaired';
  if (mutated && value.payload.produced.repairReceiptRef === null) errors.push('/payload/produced/repairReceiptRef: repaired output requires a session artifact');
  if (mutated && value.payload.produced.durableWrites.length === 0) errors.push('/payload/produced/durableWrites: successful repair must name approved durable writes');
  if (!mutated && value.payload.produced.durableWrites.length !== 0) errors.push('/payload/produced/durableWrites: non-repair decisions cannot claim writes');
  if (value.payload.cleanup.retention !== 'until-skill-terminal' || value.payload.cleanup.purgeAt !== 'skill-terminal') errors.push('/payload/cleanup: terminal purge is mandatory');
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
