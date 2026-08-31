import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[]; const {outcome,result,gaps}=value.output;
  if(outcome==='insufficient-evidence' && (result!==null || gaps.length===0)) errors.push('insufficient baseline requires null result and exact gaps');
  if(outcome!=='insufficient-evidence' && (result===null || gaps.length)) errors.push('reviewed baseline requires a result and no gaps');
  if(outcome==='failed' && (result?.typedVerdict!=='FAIL' || result.auditScore>8 || result.findingRefs.length===0)) errors.push('failed baseline requires FAIL, score at most 8, and findings');
  if(outcome==='ready-for-closure' && (result?.typedVerdict!=='SUSPENSE' || result.auditScore!==9 || result.findingRefs.length)) errors.push('clean baseline remains SUSPENSE at score 9 and requires closure proof');
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <output.json>');
