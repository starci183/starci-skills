import { validatorFor, runValidatorCli } from '../../validation.mjs';
import { validateGrammarDecision } from '../../../runtime/contracts/grammar-decision.mjs';
export const validateOutput = validatorFor(new URL('./output.schema.json', import.meta.url),(value)=>{
  const errors=[]; const {outcome,result,gaps}=value.output;
  if(outcome==='converged'){
    if(result===null) errors.push('converged Grammar requires a result');
    else errors.push(...validateGrammarDecision(result.grammarDecisionManifest).errors.map((error)=>`grammarDecisionManifest ${error}`));
    if(gaps.length!==0) errors.push('converged Grammar cannot retain gaps');
  }
  if((outcome==='grammar-gap'||outcome==='blocked')&&(result!==null||gaps.length===0)) errors.push(`${outcome} requires null result and exact gaps`);
  return errors;
});
if (process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput, 'node validate-output.mjs <output.json>');
