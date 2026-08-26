import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(v)=>{
  const errors=[];
  const decision=v.payload.decision;
  const issues=v.payload.artifact.issues;
  const uxUiHard=issues.some((issue)=>issue.domain==='ux-ui'&&issue.severity==='hard');
  const nonUxUiHard=issues.some((issue)=>issue.domain!=='ux-ui'&&issue.severity==='hard');
  if(decision==='ux-ui-repair'&&!uxUiHard) errors.push('$.payload.artifact.issues: ux-ui-repair requires a hard UX/UI issue');
  if(decision==='repair'&&uxUiHard) errors.push('$.payload.decision: hard UX/UI issues must route to ux-ui-repair');
  if(decision==='passed'&&v.payload.artifact.resolutionRequestRefs.length>0&&!v.facts.includes('ux-ui-resolution-close-required')) errors.push('$.facts: passing a prior UX/UI resolution requires closure routing');
  if(decision!=='passed') return errors;
  const semanticKinds=new Set(v.payload.artifact.semanticChecks.map((check)=>check.kind));
  if(v.payload.artifact.outcomeStatus!=='proved'
    ||v.payload.artifact.journeyCoverage.some((step)=>step.status!=='passed')
    ||v.payload.artifact.semanticChecks.some((check)=>check.status!=='passed')
    ||!semanticKinds.has('grammar-object')
    ||!semanticKinds.has('semantic-content')
    ||!semanticKinds.has('interaction-container')
    ||uxUiHard||nonUxUiHard) errors.push('$.payload.artifact: passed requires proved outcome, complete journey, exact Grammar-object and semantic-content evidence, and no hard issue');
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
