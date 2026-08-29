import { validatorFor, runValidatorCli } from '../../validation.mjs';

const identities = (items) => items.map((item) => `${item.ref}\u0000${item.sha256}`).sort();
export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const issues = [];
  if (value.input.objectiveId !== value.context.objectiveId) issues.push('consumer objective must equal handoff objective');
  if (JSON.stringify(identities(value.input.acceptedArtifacts)) !== JSON.stringify(identities(value.context.artifacts))) issues.push('accepted artifact identities must exactly equal the handoff set');
  return issues;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
