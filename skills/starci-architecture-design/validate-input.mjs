import { runValidatorCli } from '../../operators/validation.mjs';
import { processInputValidator } from '../validate-process-input.mjs';

export const validateInput = processInputValidator(new URL('./input.schema.json', import.meta.url), {
  skillId: 'starci-architecture-design',
  requiredByMode: {
    discover: ['verified-source-route'],
    design: ['observed-source-inventory', 'approved-tech-stack', 'data-ownership-model'],
    challenge: ['architecture-candidate'],
    realize: ['approved-architecture'],
  },
});
if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <artifact.json>');
