import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>value.result==='complete'&&value.receiptRefs.length===0?['$.receiptRefs: completion requires evidence']:[]);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
