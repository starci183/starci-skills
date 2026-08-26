import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(v)=>{const a=v.payload.artifact,failed=a.checks.some((c)=>c.status!=='passed');if(v.payload.decision==='passed'&&(failed||a.failures.length||a.approvedStructureHash!==a.observedStructureHash))return['$.payload.artifact: passed requires matching structure and all checks passed'];return[]});
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
