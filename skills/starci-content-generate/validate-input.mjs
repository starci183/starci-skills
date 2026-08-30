import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const issues = [];
  if (value.options.intentMode === 'resume' && value.options.resumeTarget === null) issues.push('resume requires resumeTarget');
  if (value.options.intentMode !== 'resume' && value.options.resumeTarget !== null) issues.push('non-resume intent cannot set resumeTarget');
  if (value.options.codeMode === 'required' && value.options.implementationLanguages.length === 0) issues.push('required code needs at least one implementation language');
  if (value.options.e2eMode === 'required' && value.options.codeMode === 'none') issues.push('required E2E cannot disable code');
  return issues;
});
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
