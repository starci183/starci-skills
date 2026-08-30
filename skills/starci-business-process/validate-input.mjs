import { runValidatorCli } from '../../operators/validation.mjs';
import { processInputValidator } from '../validate-process-input.mjs';

export const validateInput = processInputValidator(new URL('./input.schema.json', import.meta.url), {
  skillId: 'starci-business-process',
  requiredByMode: {
    model: ['normalized-evidence'],
    publish: ['approved-business-model'],
    reconcile: ['immutable-delivery-proof'],
  },
  mutationModes: ['publish'],
  scopeCheck: (value, { mutates }) => mutates && !value.scope.writeRoots.every((root) => /^\.worktrees[\\/]businesses(?:[\\/]|$)/.test(root))
    ? ['business writes must stay under flat .worktrees/businesses']
    : [],
});
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
