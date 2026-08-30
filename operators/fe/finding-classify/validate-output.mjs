import { validatorFor, runValidatorCli } from '../../validation.mjs';
const semantic = (value) => {
  const errors = [];
  const { outcome, result } = value.output;
  const owners = result?.ownerAssessments?.map(({ owner }) => owner) ?? [];
  if (outcome === 'repair' && !owners.includes('implementation')) {
    errors.push('$.output.result.ownerAssessments: repair requires an implementation-owned finding');
  }
  if (outcome === 'authority-repair' && !owners.some((owner) => owner === 'grammar' || owner === 'ui-knowledge')) {
    errors.push('$.output.result.ownerAssessments: authority-repair requires a Grammar or UI-knowledge owner');
  }
  if (outcome === 'business-required' && !owners.some((owner) => owner === 'business' || owner === 'product-authority')) {
    errors.push('$.output.result.ownerAssessments: business-required requires business or product authority ownership');
  }
  if (outcome === 'backend-required' && !owners.includes('backend')) {
    errors.push('$.output.result.ownerAssessments: backend-required requires backend ownership');
  }
  const refs = result?.ownerAssessments?.map(({ findingRef }) => findingRef) ?? [];
  if (new Set(refs).size !== refs.length) {
    errors.push('$.output.result.ownerAssessments: duplicate finding ownership is forbidden');
  }
  return errors;
};
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url), semantic);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
