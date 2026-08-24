import { validatorFor, runValidatorCli } from '../../validation.mjs';

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  if (value?.payload?.provided?.project !== value?.payload?.loads?.knowledgeIndex?.projectId) errors.push('$.payload.loads.knowledgeIndex.projectId: must equal provided project');
  const prefix = `.worktrees/${value?.payload?.provided?.project}/coding-context/frontend/`;
  if (!value?.payload?.loads?.codingContext?.currentManifestPath?.startsWith(prefix)) errors.push('$.payload.loads.codingContext.currentManifestPath: project mismatch');
  if (!value?.payload?.loads?.codingContext?.generationPathPattern?.startsWith(prefix)) errors.push('$.payload.loads.codingContext.generationPathPattern: project mismatch');
  return errors;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
