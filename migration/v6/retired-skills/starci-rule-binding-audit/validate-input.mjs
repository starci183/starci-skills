import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url));
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');
