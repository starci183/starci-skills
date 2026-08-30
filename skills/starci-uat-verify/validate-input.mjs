import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>value.returnReceipt===null?[]:['UAT input cannot consume returnReceipt until its machine declares a canonical resume route']);
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
