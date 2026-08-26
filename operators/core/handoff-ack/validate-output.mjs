import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>value.payload.decision==='accepted'&&value.payload.evidenceRefs.length===0?['successful protocol transition requires evidence']:[]);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');

