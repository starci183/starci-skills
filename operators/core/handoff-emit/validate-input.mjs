import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => value.context.nextCandidates
  .filter((candidate) => candidate.requiresMutationApproval && !candidate.approvalRef)
  .map((candidate) => `mutation candidate ${candidate.capability} requires approvalRef`));

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
