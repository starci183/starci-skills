import { validatorFor, runValidatorCli } from '../../validation.mjs';
import crypto from 'node:crypto';
const fingerprint = (value) => `sha256:${crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex')}`;
export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), (value) => {
  const errors = [];
  const paths = value.input.authorityBoundary.map(({ path }) => path);
  if (new Set(paths).size !== paths.length) errors.push('$.input.authorityBoundary: paths must be unique');
  if (value.input.authorityBoundary.some(({ ownerRef }) => ownerRef !== value.input.authorityRef)) errors.push('$.input.authorityBoundary: every file must belong to the exact routed authorityRef');
  if (value.input.authorityBoundaryFingerprint !== fingerprint(value.input.authorityBoundary)) errors.push('$.input.authorityBoundaryFingerprint: must hash the exact ordered authorityBoundary');
  return errors;
});
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
