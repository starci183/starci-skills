import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const output = value.output;
  const issues = [];
  if (output.outcome === 'ready') {
    if (!output.inventoryRef || !output.inventorySha256) issues.push('ready requires the inventory reference and hash');
    if (output.evidenceRefs.length === 0) issues.push('ready requires exact evidence');
    if (output.contradictions.some((item) => item.severity === 'critical')) issues.push('ready cannot hide a critical contradiction');
    if (output.reason !== null) issues.push('ready reason must be null');
  }
  if (output.outcome === 'blocked') {
    if (output.inventoryRef !== null || output.inventorySha256 !== null) issues.push('blocked cannot claim a complete inventory');
    if (!output.reason) issues.push('blocked requires a reason');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <artifact.json>');
