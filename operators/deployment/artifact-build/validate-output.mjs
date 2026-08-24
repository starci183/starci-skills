import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);

function semantic(value) {
  const errors = [];
  if (value.payload.decision !== 'ready') errors.push('/payload/decision: expected ready');
  if (value.stage !== 'deployment.artifact.publish' || value.status !== 'ready') errors.push('/stage: expected deployment.artifact.publish / ready');
  if (value.payload.state.status !== 'completed' || value.payload.state.code !== 'deployment-artifact-build-ready') {
    errors.push('/payload/state: expected completed artifact-build state');
  }
  if (value.payload.state.emits.stage !== value.stage || value.payload.state.emits.status !== value.status) {
    errors.push('/payload/state/emits: must match root route');
  }
  if (!value.facts.includes('deployment-artifacts-built') || !value.payload.state.emits.factsAdd.includes('deployment-artifacts-built')) {
    errors.push('/facts: missing deployment-artifacts-built');
  }
  if (value.payload.produced.durableWrites.length === 0) errors.push('/payload/produced/durableWrites: immutable artifacts required');
  if (value.payload.cleanup.retention !== 'until-skill-terminal' || value.payload.cleanup.purgeAt !== 'skill-terminal') {
    errors.push('/payload/cleanup: terminal purge is mandatory');
  }
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
