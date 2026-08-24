import { validatorFor, runValidatorCli } from '../../validation.mjs';
const transitions={"ready":["architecture.decision.current","ready"]};
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>{const expected=transitions[value.payload.decision];const errors=[];if(!expected||value.stage!==expected[0]||value.status!==expected[1])errors.push('$: decision does not match emitted state');if(value.status==='ready'&&value.payload.evidenceRefs.length===0)errors.push('$.payload.evidenceRefs: ready output requires evidence');return errors;});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
