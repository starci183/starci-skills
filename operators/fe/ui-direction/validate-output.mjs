import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(v)=>v.payload.decision==='directions-ready'&&v.payload.artifact.directions.every((d)=>d.id!==v.payload.artifact.recommendedId)&&!v.payload.artifact.directions.some((d)=>d.id===v.payload.artifact.recommendedId)?['$.payload.artifact.recommendedId: must identify one direction']:[]);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
