import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>{
  const errors=[];
  if(!value.context.evidenceRefs.includes(value.input.compiledRequestRef)) errors.push('context evidenceRefs must include compiledRequestRef');
  if(!value.context.evidenceRefs.includes(value.input.grammarBinding.packageRef)||!value.context.evidenceRefs.includes(value.input.grammarBinding.manifestRef)) errors.push('context evidenceRefs must include compiled Grammar package and manifest identities');
  if(value.input.productFamilyEvidence.grammarBindingRef!==value.input.grammarBinding.bindingRef) errors.push('product-family evidence must bind the exact compiled Grammar binding');
  for(const ref of [value.input.grammarBinding.auditPlanRef,value.input.iconographyManifest.manifestRef,value.input.mediaManifest.manifestRef,...value.input.productFamilyEvidence.benchmarkRasterRefs]) if(!value.context.evidenceRefs.includes(ref)) errors.push(`context evidenceRefs must include ${ref}`);
  return errors;
});
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
