import { validatorFor, runValidatorCli } from '../../validation.mjs';
const guards=[{"stage":"source.conversation.record","status":"ready","facts":[]}];
export const validateInput=validatorFor(new URL('./input.schema.json',import.meta.url),(value)=>{const guard=guards.find((item)=>item.stage===value.stage&&item.status===value.status);if(!guard)return ['$: undeclared input state'];return guard.facts.filter((fact)=>!value.facts.includes(fact)).map((fact)=>`$.facts: missing ${fact}`);});
if(process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput,'node validate-input.mjs <artifact.json>');
