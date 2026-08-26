import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(v)=>v.payload.decision==='revise'&&v.payload.artifact.counterProposal===null?['$.payload.artifact.counterProposal: revise requires an independent alternative']:[]);
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
