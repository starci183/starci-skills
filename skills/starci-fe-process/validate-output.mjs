import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const sourceRoot=fileURLToPath(new URL('../../../',import.meta.url));

const requiresOwnerAudit=(value)=>value.outcome==='complete'||[
  'starci-quality-assure',
  'starci-uat-verify'
].includes(value.handoff?.skillId);

export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[];
  if(value.outcome==='handoff'&&value.handoff===null) errors.push('handoff outcome requires one typed handoff');
  if(value.outcome!=='handoff'&&value.handoff!==null) errors.push('only handoff outcome may carry handoff metadata');
  if(value.handoff!==null&&value.handoff?.resumeSkillId!=='starci-fe-process') errors.push('handoff must resume this frontend mission');
  if(value.handoff!==null&&value.handoff?.missionRef!==value.missionRef) errors.push('handoff missionRef must equal the active missionRef');
  if(value.outcome==='waiting-choice'){
    const htmlRefs=value.artifactRefs.filter((ref)=>/\.html$/.test(ref));
    if(htmlRefs.length!==1) errors.push('waiting-choice requires exactly one rendered HTML comparison artifact');
    else {
      const artifactPath=path.resolve(sourceRoot,htmlRefs[0]);
      const relative=path.relative(sourceRoot,artifactPath);
      if(relative.startsWith('..')||path.isAbsolute(relative)||!existsSync(artifactPath)) errors.push('waiting-choice comparison must be an existing workspace-contained HTML artifact');
    }
  }
  const exactResumeStates={
    'starci-business-process':new Set(['request-compile']),
    'starci-backend-process':new Set(['request-compile','apply','reapply','capture-preflight','recapture-preflight']),
    'starci-quality-assure':new Set(['quality-return']),
    'starci-uat-verify':new Set(['uat-return'])
  };
  if(value.handoff!==null&&!exactResumeStates[value.handoff.skillId]?.has(value.handoff.resumeState)) errors.push('handoff resumeState must identify the exact state owned by its target gate or domain');
  if(value.handoff?.skillId==='starci-quality-assure'&&value.handoff.debtPolicy!=='forbidden') errors.push('frontend Quality handoff requires debtPolicy forbidden');
  if(value.handoff?.skillId!=='starci-quality-assure'&&value.handoff?.debtPolicy!==undefined) errors.push('debtPolicy is only valid on the frontend Quality handoff');
  if(!requiresOwnerAudit(value)) return errors;
  if(!value.artifactRefs.some((ref)=>/(^|[\\/])audit\.md$/.test(ref))) {
    errors.push('artifactRefs must include adjacent lowercase audit.md before quality/UAT handoff or completion');
  }
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
