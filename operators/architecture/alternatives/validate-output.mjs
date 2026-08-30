import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const issues = [];
  if (value.output.visualPanelRefs.length !== value.output.directionCount) issues.push('directionCount must equal visualPanelRefs');
  if (!value.output.evidenceRefs.includes(value.output.resultRef)) issues.push('resultRef must be registered in evidenceRefs');
  if (!value.output.findings.includes('renderer:visualize')) issues.push('renderer:visualize finding is required');
  if (value.output.reason !== null) issues.push('ready architecture alternatives cannot retain a failure reason');
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
