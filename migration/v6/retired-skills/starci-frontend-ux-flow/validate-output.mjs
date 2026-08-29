import { validatorFor, runValidatorCli } from '../../operators/validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{
  const errors=[];
  if(value.result==='handoff'&&!value.handoffRef) errors.push('$.handoffRef: handoff requires a typed session artifact');
  if(value.result!=='handoff'&&value.handoffRef!==null) errors.push('$.handoffRef: only handoff may expose a handoff artifact');
  return errors;
});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
