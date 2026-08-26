import { validatorFor, runValidatorCli } from '../../validation.mjs';
const successful=new Set(["published"]);
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(value)=>successful.has(value.payload.decision)&&value.payload.evidenceRefs.length===0?['successful decision requires evidence']:[]);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');

