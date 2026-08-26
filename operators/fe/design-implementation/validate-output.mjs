import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(v)=>v.payload.decision==='implemented'&&(v.payload.artifact.approvedStructureHash!==v.payload.artifact.observedStructureHash||v.payload.artifact.deviations.some((d)=>d.status==='conflict'))?['$.payload.artifact: implemented requires matching structure hash and no conflicting deviation']:[]);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
