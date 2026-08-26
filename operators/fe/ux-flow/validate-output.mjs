import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(v)=>{if(v.payload.decision!=='flow-ready')return[];const events=new Set(v.payload.artifact.transitions.map((t)=>t.event));return ['next','previous'].filter((e)=>!events.has(e)).map((e)=>`$.payload.artifact.transitions: interactive multi-item work requires ${e}`)});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
