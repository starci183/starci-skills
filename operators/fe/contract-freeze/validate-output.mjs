import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { preservationContractSemantic } from '../strict-ui-validation.mjs';
export const validateOutput=validatorFor(
  new URL('./output.schema.json',import.meta.url),
  (value)=>value.output.outcome === 'frozen'
    ? preservationContractSemantic(value.output.result?.behaviorContract, '$.output.result.behaviorContract')
    : [],
);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
