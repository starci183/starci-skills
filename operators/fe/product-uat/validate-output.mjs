import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(v)=>v.payload.decision==='passed'&&(v.payload.artifact.outcomeStatus!=='proved'||v.payload.artifact.journeyCoverage.some((s)=>s.status!=='passed')||v.payload.artifact.issues.some((i)=>i.severity==='hard'))?['$.payload.artifact: passed requires proved outcome, complete coverage, and no hard issue']:[]);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
