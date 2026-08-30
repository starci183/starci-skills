import { runValidatorCli } from '../../operators/validation.mjs';
import { processInputValidator } from '../validate-process-input.mjs';

export const validateInput = processInputValidator(new URL('./input.schema.json', import.meta.url), {
  skillId: 'starci-workflow-diagnose',
  requiredByMode: { diagnose: ['frozen-workflow-evidence', 'expected-binding'] },
  scopeCheck: (value) => value.scope.externalMutation || value.scope.writeRoots.length || value.scope.approvalRef !== null
    ? ['workflow diagnosis is strictly read-only']
    : [],
});
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
