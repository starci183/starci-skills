import { validatorFor, runValidatorCli } from '../../validation.mjs';

const outcomes = {
  recorded: { reason: 'appended', hasHead: true, writeApplied: true },
  idempotent: { reason: 'already-current', hasHead: true, writeApplied: false },
  conflict: { reason: 'identity-conflict', hasHead: false, writeApplied: false },
  blocked: { reason: 'authority-denied', hasHead: false, writeApplied: false }
};

const semantic = (value) => {
  const { outcome, reason, headRef, headSha256, writeApplied } = value.output;
  const expected = outcomes[outcome];
  const hasAllHeadFields = headRef !== null && headSha256 !== null;
  const hasAnyHeadField = headRef !== null || headSha256 !== null;
  return [
    ...(reason !== expected.reason ? [`/output/reason: ${reason} is invalid for ${outcome}`] : []),
    ...(writeApplied !== expected.writeApplied ? [`/output/writeApplied: invalid for ${outcome}`] : []),
    ...(expected.hasHead && !hasAllHeadFields ? [`/output: ${outcome} requires the durable head identity`] : []),
    ...(!expected.hasHead && hasAnyHeadField ? [`/output: ${outcome} cannot claim a published head`] : [])
  ];
};

export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url), semantic);

if (process.argv[1]?.endsWith('validate-output.mjs')) {
  await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
}
