import { validatorFor,runValidatorCli } from '../../validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>{
  const errors=[];
  const ceiling=value.input.layoutOwnerCeiling;
  const mutableOwners=[ceiling.targetOwnerRef,...ceiling.directInteractionOwnerRefs,...ceiling.mutableNestedLayoutRefs,...ceiling.mutableAncestorLayoutRefs];
  const allOwners=[...mutableOwners,...ceiling.immutableAncestorLayoutRefs];
  if(new Set(allOwners).size!==allOwners.length) errors.push('$.input.layoutOwnerCeiling: owner sets must be disjoint');
  if(value.input.layoutOwnerCeilingMode==='surface-only'&&(ceiling.mutableNestedLayoutRefs.length>0||ceiling.mutableAncestorLayoutRefs.length>0)) errors.push('$.input.layoutOwnerCeiling: surface-only forbids mutable layout owners');
  if(value.input.layoutOwnerCeilingMode==='surface-and-nested-layouts'&&ceiling.mutableAncestorLayoutRefs.length>0) errors.push('$.input.layoutOwnerCeiling: surface-and-nested-layouts forbids mutable ancestor layouts');
  for(const file of value.input.files) {
    if(!mutableOwners.includes(file.ownerRef)) errors.push(`$.input.files: ${file.path} is owned above the mutable layout ceiling`);
  }
  return errors;
});if(process.argv[1]?.endsWith('validate-input.mjs'))await runValidatorCli(validateInput,'node validate-input.mjs <input.json>');
