import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { browserExecutionLeaseBindingErrors } from '../../../runtime/contracts/browser-execution-lease.mjs';

export function createUatCaseFreezeInputValidator({ sourceRoot, now } = {}) {
  return validatorFor(new URL('./input.schema.json', import.meta.url), (value) => browserExecutionLeaseBindingErrors(
    value.input.sessionLease,
    {
      runtimeOwner: value.context.runtimeOwner ?? null,
      sourceRoot,
      expectedMissionRef: value.context.missionRef,
      expectedAccountRef: value.input.accountRef,
      now,
    },
  ));
}

export const validateInput = createUatCaseFreezeInputValidator();

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
