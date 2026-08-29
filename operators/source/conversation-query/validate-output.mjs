import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomes = {
  found: { reason: 'current-match', hasHead: true },
  empty: { reason: 'no-match', hasHead: false },
  forbidden: { reason: 'scope-denied', hasHead: false },
  stale: { reason: 'index-stale', hasHead: false },
  ambiguous: { reason: 'multiple-current-heads', hasHead: false }
};

const semantic = (value) => {
  const { outcome, reason, headRef, headSha256, snapshotSha256, artifactRefs } = value.output;
  const expected = outcomes[outcome];
  const hasAllHeadFields = headRef !== null && headSha256 !== null && snapshotSha256 !== null;
  const hasAnyHeadField = headRef !== null || headSha256 !== null || snapshotSha256 !== null;
  return [
    ...(reason !== expected.reason ? [`/output/reason: ${reason} is invalid for ${outcome}`] : []),
    ...(expected.hasHead && !hasAllHeadFields ? ['/output: found requires the complete current-head identity'] : []),
    ...(!expected.hasHead && hasAnyHeadField ? [`/output: ${outcome} cannot expose head identity`] : []),
    ...(!expected.hasHead && artifactRefs.length > 0 ? [`/output/artifactRefs: ${outcome} cannot expose artifacts`] : [])
  ];
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
