import { validatorFor, runValidatorCli } from '../../validation.mjs';

const digest = (ref) => ref?.match(/[0-9a-f]{64}$/)?.[0];

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const issues = [];
  const { context, input } = value;
  if (digest(input.representativeRasterRef) !== digest(input.representativeRasterArtifactRef)) {
    issues.push('representative raster content and durable artifact receipts must bind the same digest');
  }
  const requiredEvidence = [
    input.representativeRasterRef,
    input.representativeRasterArtifactRef,
    ...input.benchmarkRasterRefs,
    context.reviewerExecutionRef,
  ];
  for (const ref of requiredEvidence) {
    if (!context.evidenceRefs.includes(ref)) issues.push(`context.evidenceRefs must bind ${ref}`);
  }
  if (!context.authorityRefs.includes(input.acceptanceRef)) {
    issues.push('context.authorityRefs must bind the frozen acceptanceRef');
  }
  return issues;
});

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
