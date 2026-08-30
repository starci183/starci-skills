import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(v)=>{const e=[];if(v.input.mode==='none'&&(v.input.imageTargetRef!==null||v.input.promptTargetRef!==null))e.push('disabled image must use null targets');if(v.input.mode!=='none'&&(!v.input.imageTargetRef||!v.input.promptTargetRef))e.push('enabled image needs image and prompt targets');return e;});
if(process.argv[1]?.endsWith('validate-input.mjs'))await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');
