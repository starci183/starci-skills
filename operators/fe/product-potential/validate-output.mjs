import { validatorFor, runValidatorCli } from '../../validation.mjs';
export const validateOutput=validatorFor(new URL('./output.schema.json',import.meta.url),(v)=>v.payload.nextCandidates.filter((c)=>['business-change','database-change'].includes(c.risk)&&!c.requiresApproval).map((c)=>`$.payload.nextCandidates: ${c.risk} requires approval`));
if(process.argv[1]?.endsWith('validate-output.mjs')) await runValidatorCli(validateOutput,'node validate-output.mjs <artifact.json>');
