import path from 'node:path';
import {readFileSync} from 'node:fs';
import {validateStep} from '../../scripts/validate-step.mjs';
import {artResponseErrors} from '../../scripts/art-direction.mjs';
import {uiKnowledgeGateErrors} from '../../scripts/ui-knowledge-gate.mjs';
export async function validateArtDirectStep(branch,root=path.resolve(import.meta.dirname,'../..')){
 const checked=await validateStep(root,branch),errors=[...checked.errors];
 let request,response;try{request=JSON.parse(readFileSync(path.join(branch,'request/request.json')));response=JSON.parse(readFileSync(path.join(branch,'response/response.json')));}catch{return checked;}
 errors.push(...await artResponseErrors(root,branch,request,response));
 if(response.status==='done'){
  const {uiKnowledgeBindingsFor}=await import('../../scripts/validate-request.mjs');
  errors.push(...uiKnowledgeGateErrors({root,branchDir:branch,bindings:uiKnowledgeBindingsFor(request),request,status:response.status}));
 }
 return{...checked,errors};
}
