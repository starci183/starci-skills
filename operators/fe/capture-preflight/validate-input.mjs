import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { capturePreflightInputSemantic, REQUIRED_PROBE_CATEGORIES, REQUIRED_PROBE_PHASES } from '../strict-ui-validation.mjs';
export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = capturePreflightInputSemantic(value);
  const expected = REQUIRED_PROBE_CATEGORIES.flatMap((category) =>
    REQUIRED_PROBE_PHASES[category].map((phase) => `probe-${category}-${phase}`));
  const actual = value.input.matrix.probeRefs;
  if (actual.length !== expected.length || actual.some((probeRef, index) => probeRef !== expected[index])) {
    errors.push('$.input.matrix.probeRefs: must contain the exact 22 canonical probes in category/phase order');
  }
  return errors;
});
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
