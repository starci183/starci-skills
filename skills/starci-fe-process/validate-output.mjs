import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';

const requiresOwnerAudit=(value)=>value.outcome==='complete'||[
  'starci-quality-assure',
  'starci-uat-verify'
].includes(value.handoff?.skillId);

export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  if(!requiresOwnerAudit(value)) return [];
  if(!value.artifactRefs.some((ref)=>/(^|[\\/])audit\.md$/.test(ref))) {
    return ['artifactRefs must include adjacent lowercase audit.md before quality/UAT handoff or completion'];
  }
  return [];
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
