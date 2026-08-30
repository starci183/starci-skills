import { validatorFor, runValidatorCli } from '../../validation.mjs';
const validateSchema=validatorFor(new URL('./input.schema.json',import.meta.url));
export const validateInput=(value)=>{
 const result=validateSchema(value);
 if(!result.valid)return result;
 if(value.context.implementerExecutionRef===value.context.reviewerExecutionRef)return {valid:false,errors:['reviewerExecutionRef must differ from implementerExecutionRef']};
 if(value.context.implementerPrincipalFingerprint===value.context.reviewerPrincipalFingerprint)return {valid:false,errors:['reviewerPrincipalFingerprint must differ from implementerPrincipalFingerprint']};
 return result;
};
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
