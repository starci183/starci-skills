import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);
const routes = {
  published: { status: 'complete', state: 'completed', code: 'workspace-device-checkpoint-published', fact: 'device-checkpoint-published' },
  blocked: { status: 'blocked', state: 'blocked', code: 'workspace-device-checkpoint-blocked', fact: 'device-checkpoint-blocked' }
};

function semantic(value) {
  const errors = [];
  const route = routes[value.payload.decision];
  if (!route) return ['/payload/decision: undeclared decision'];
  if (value.status !== route.status || value.payload.state.status !== route.state || value.payload.state.code !== route.code) errors.push('/payload/state: decision route mismatch');
  if (value.payload.state.emits.stage !== value.stage || value.payload.state.emits.status !== value.status) errors.push('/payload/state/emits: must match root route');
  if (!value.facts.includes(route.fact) || !value.payload.state.emits.factsAdd.includes(route.fact)) errors.push(`/facts: missing ${route.fact}`);
  if (value.payload.decision === 'published') {
    if (value.payload.produced.checkpointReceiptRef === null) errors.push('/payload/produced/checkpointReceiptRef: published requires receipt');
    if (value.payload.produced.releaseRef === null) errors.push('/payload/produced/releaseRef: published requires remote release');
    if (value.payload.produced.sourcePushRefs.length === 0) errors.push('/payload/produced/sourcePushRefs: published requires source parity proof');
    if (value.payload.produced.durableWrites.length === 0) errors.push('/payload/produced/durableWrites: published requires durable effects');
  }
  if (value.payload.cleanup.retention !== 'until-skill-terminal' || value.payload.cleanup.purgeAt !== 'skill-terminal') errors.push('/payload/cleanup: terminal purge is mandatory');
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
