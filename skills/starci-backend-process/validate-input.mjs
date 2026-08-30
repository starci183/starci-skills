import { runValidatorCli } from '../../operators/validation.mjs';
import { processInputValidator } from '../validate-process-input.mjs';

export const validateInput = processInputValidator(new URL('./input.schema.json', import.meta.url), {
  skillId: 'starci-backend-process',
  requiredByMode: {
    plan: ['business-head', 'architecture-realization', 'data-ownership-model'],
    challenge: ['backend-contract'],
    implement: ['approved-backend-contract', 'frozen-source-boundary', 'business-head', 'architecture-realization'],
    prove: ['implementation-receipt', 'conformance-receipt'],
  },
  mutationModes: ['implement'],
  scopeCheck: (value, { mutates }) => mutates && value.scope.writeRoots.some((root) => root.startsWith('.worktrees/'))
    ? ['backend source mutation cannot write authority worktrees']
    : [],
});
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
