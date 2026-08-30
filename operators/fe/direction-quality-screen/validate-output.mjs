import { validatorFor, runValidatorCli } from '../../validation.mjs';

const expectedBand = (score) => score <= 6 ? 'rejected' : score <= 8 ? 'promising' : score === 9 ? 'production' : 'exceptional';
const digest = (ref) => ref?.match(/[0-9a-f]{64}$/)?.[0];

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), (value) => {
  const issues = [];
  const { outcome, result, handoff, gaps } = value.output;
  if (outcome === 'blocked') {
    if (result !== null) issues.push('blocked cannot claim a direction-quality result');
    if (handoff !== null) issues.push('blocked cannot claim a handoff');
    if (!gaps.length) issues.push('blocked requires an exact gap');
    return issues;
  }
  if (result === null) return ['non-blocked direction screen requires a result'];
  if (digest(result.representativeRasterRef) !== digest(result.representativeRasterArtifactRef)) issues.push('representative raster content and durable artifact receipts must bind the same digest');
  for (const ref of [result.representativeRasterRef, result.representativeRasterArtifactRef, result.reviewerExecutionRef, ...result.benchmarkRasterRefs]) {
    if (!result.artifactRefs.includes(ref) && !value.output.evidenceRefs.includes(ref)) issues.push(`result evidence must bind ${ref}`);
  }
  const dimensions = result.scoreDimensions.map(({ dimension }) => dimension);
  if (new Set(dimensions).size !== 6) issues.push('every score dimension must appear exactly once');
  const calculated = Math.floor(result.scoreDimensions.reduce((sum, item) => sum + item.score, 0) / 6);
  if (result.overallScore !== calculated) issues.push('overallScore must be the rounded-down arithmetic mean');
  if (result.scaleBand !== expectedBand(result.overallScore)) issues.push('scaleBand does not match overallScore');

  if (result.overallScore >= result.minimumScore) {
    if (outcome !== 'continue') issues.push('a 9+ score must continue');
    if (result.observedStateKind !== result.requiredStateKind || !result.businessOutcomeMatch) issues.push('a continuing score must prove the requested ready-state business outcome');
    if (result.ownerClass !== 'none') issues.push('a continuing score cannot claim a defect owner');
    if (handoff !== null) issues.push('a continuing score cannot hand off');
  } else {
    if (outcome === 'continue') issues.push('a sub-9 score cannot continue');
    if (result.attempt === 3 && outcome === 'rebrainstorm') issues.push('the third sub-9 attempt must supplement Business or Backend authority');
    if (outcome === 'rebrainstorm' && !['direction', 'implementation'].includes(result.ownerClass)) issues.push('rebrainstorm requires direction or implementation ownership');
    if (outcome === 'business-required') {
      if (result.ownerClass !== 'business') issues.push('business-required requires business ownership');
      if (handoff?.skillId !== 'starci-business-process' || handoff?.resumeState !== 'business-bind') issues.push('business-required requires the exact Business handoff');
    }
    if (outcome === 'backend-required') {
      if (result.ownerClass !== 'backend') issues.push('backend-required requires backend ownership');
      if (handoff?.skillId !== 'starci-backend-process' || handoff?.resumeState !== 'observe') issues.push('backend-required requires the exact Backend handoff');
    }
    if (outcome === 'rebrainstorm' && handoff !== null) issues.push('rebrainstorm cannot claim a peer handoff');
  }
  if (outcome === 'continue' && !result.artifactRefs.includes(result.representativeRasterArtifactRef)) issues.push('continue requires the durable representative raster in artifactRefs');
  return issues;
});

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
