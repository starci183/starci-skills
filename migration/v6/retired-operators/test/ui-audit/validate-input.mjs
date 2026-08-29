import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const issues = [];
  if (value.context.knowledgeRefs.length === 0) issues.push('at least one exact default-search protocol reference is required');
  
  return issues;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');

