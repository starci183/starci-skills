import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const issues = [];
  if (value.input.operation === 'publish' && value.input.checkpointTag !== null) issues.push('publish requires a new checkpoint tag');
  if (value.input.operation === 'resume' && value.input.checkpointTag === null) issues.push('resume requires the exact checkpoint tag');
  if (value.input.durableArtifactRefs.some((ref) => ref.startsWith('session:'))) issues.push('portable continuation cannot contain session-only artifact refs');
  return issues;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
