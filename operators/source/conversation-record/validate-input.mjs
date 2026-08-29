import { validatorFor, runValidatorCli } from '../../validation.mjs';

const sameIdentity = (left, right) => ['provider', 'conversationId', 'project', 'role']
  .every((key) => left[key] === right[key]);

const semantic = (value) => {
  const errors = [];
  const { policy, writeAuthority, currentHead } = value.context;
  const { identity, snapshot, redactionReceipt } = value.input;
  if (writeAuthority.project !== identity.project || writeAuthority.role !== identity.role) {
    errors.push('/context/writeAuthority: must bind the input identity project and role');
  }
  if (currentHead && !sameIdentity(currentHead.identity, identity)) {
    errors.push('/context/currentHead/identity: must match the input identity');
  }
  if (redactionReceipt.policyVersion !== policy.policyVersion) {
    errors.push('/input/redactionReceipt/policyVersion: must match the active policy');
  }
  if (redactionReceipt.scannerVersion !== policy.scannerVersion) {
    errors.push('/input/redactionReceipt/scannerVersion: must match the active scanner');
  }
  if (redactionReceipt.outputSha256 !== snapshot.sha256) {
    errors.push('/input/redactionReceipt/outputSha256: must bind the redacted snapshot hash');
  }
  return errors;
};

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);

if (process.argv[1]?.endsWith('validate-input.mjs')) {
  await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
}
