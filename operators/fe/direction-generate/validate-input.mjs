import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>{
  const errors=[];
  if(!value.context.evidenceRefs.includes(value.input.compiledRequestRef)) errors.push('context evidenceRefs must include compiledRequestRef');
  if(!value.context.evidenceRefs.includes(value.input.grammarBinding.packageRef)||!value.context.evidenceRefs.includes(value.input.grammarBinding.manifestRef)) errors.push('context evidenceRefs must include compiled Grammar package and manifest identities');
  return errors;
});
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
