const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
import {hasAutoAcceptance,verifyAutoEvidence} from './auto.mjs';
import {hasDelegatedAcceptance} from './delegation.mjs';
import {verifyProducerResult,hasDirectProducerAcceptance} from './producer-verification.mjs';
export { validateWorkflowCatalog } from './catalog-validate.mjs';
const verifiedAutoBackend=run=>{try{if(!hasAutoAcceptance(run))return false;verifyAutoEvidence(run);return true;}catch{return false;}};
const exact=(x,keys,optional=[])=>plain(x)&&keys.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>[...keys,...optional].includes(k));
/** Choose ceremony from scope, not line count. No route grants execution authority. */
export function selectExecutionRoute(catalog,{readOnly=false,scope,actions=[],existingPlan=false,flashSelection}={}) {
  if(readOnly)return {kind:'answer-or-inspect'};
  if(!['small','bounded','large','unclear'].includes(scope)||typeof existingPlan!=='boolean'||!Array.isArray(actions))throw Error('Explicit scope classification is required');
  if(existingPlan)return {kind:'resume-plan',reason:'Continue the current Plan; do not replan each prompt'};
  if(scope==='large'||scope==='unclear'||actions.length>1)return {kind:'plan',reason:'Resolve or coordinate the full multi-workflow outcome'};
  if(scope==='small'&&flashSelection?.kind==='flash')return flashSelection;
  if(actions.length!==1)throw Error('Classify the one bounded workflow before execution');
  return selectWorkflow(catalog,{classification:actions[0],readOnly:actions[0].action==='analyze-request'||actions[0].action==='review-code'&&!actions[0].effectful});
}
/** Read-only policy selection, never a dispatcher or an authorization grant. */
export function selectWorkflow(catalog,{workflowId,classification,readOnly=false}={}) {
  if(readOnly&&workflowId&&!catalog.workflows.some(w=>w.id===workflowId))throw Error('Unknown explicitly selected workflow');
  if(readOnly&&!classification)return {kind:'answer-or-inspect'};
  if(!exact(classification,['action','effectful'],['requiresBackend'])||typeof classification.effectful!=='boolean'||classification.action==='implement-frontend'&&typeof classification.requiresBackend!=='boolean')throw Error('A frozen semantic classification is required');
  if(['analyze-request','review-code'].includes(classification.action)&&!classification.effectful){if(!readOnly)throw Error('Read-only actions require readOnly selection');}
  else if(classification.action==='analyze-request'){throw Error('analyze-request is read-only');}
  else if(readOnly||!classification.effectful)throw Error('Effectful actions require an effectful classification');
  if(workflowId!==undefined){
    const entry=catalog.workflows.find(w=>w.id===workflowId);
    if(!entry)throw Error('Unknown explicitly selected workflow');
    if(entry.id!==classification.action)throw Error('Explicit workflow is incompatible with the classified request intent');
    return {kind:'workflow',...structuredClone(entry),reason:'explicit-selection'};
  }
  const matched=catalog.workflows.find(w=>w.id===classification.action);
  if(!matched)throw Error('Request intent is unresolved; inspect and classify it before selecting an effectful workflow');
  return {kind:'workflow',...structuredClone(matched),reason:'matched-intent'};
}
export function selectJobPlan(catalog,{actions,acceptedBackendRun}={}){
  if(!Array.isArray(actions)||!actions.length)throw Error('An explicit ordered action list is required');
  const jobs=actions.map(classification=>selectWorkflow(catalog,{classification,readOnly:classification?.action==='analyze-request'||classification?.action==='review-code'&&!classification.effectful}));
  const ids=jobs.map(j=>j.id),backend=ids.indexOf('implement-backend'),frontend=ids.indexOf('implement-frontend');
  if(frontend>=0&&backend>frontend)throw Error('implement-backend must precede implement-frontend when both changes are selected');
  if(frontend>=0&&actions[frontend].requiresBackend&&backend<0&&!validBackendRun(acceptedBackendRun))throw Error('API-dependent frontend work requires an accepted backend lifecycle run with unit, E2E and API evidence');
  return {jobs,ordered:true,inferredSuccessors:0};
}
export function validBackendRun(run){
 try{
  if(!plain(run)||!['accepted','done'].includes(run.status)||run.goal?.workflow!=='implement-backend'||run.delegated&&run.automatic)return false;
  verifyProducerResult(run);
  const accepted=run.delegated?hasDelegatedAcceptance(run):run.automatic?verifiedAutoBackend(run):hasDirectProducerAcceptance(run);
  if(!accepted)return false;
  const responses=Object.values(run.responses),criteria=responses.flatMap(r=>r.criteria);
  return ['unit-tests-pass','backend-e2e-pass','api-contract-pass'].every(id=>criteria.some(c=>c.id===id&&c.status==='pass'))&&responses.some(r=>typeof r.outputs.apiContract==='string'&&r.outputs.apiContract.trim());
 }catch{return false;}
}
