const plain=x=>x!==null&&typeof x==='object'&&!Array.isArray(x);
import {canonicalJSON,sha256} from '../core/index.mjs';
import {hasAutoAcceptance,verifyAutoEvidence} from './auto.mjs';
import {hasDelegatedAcceptance} from './delegation.mjs';
const verifiedAutoBackend=run=>{try{if(!hasAutoAcceptance(run))return false;verifyAutoEvidence(run);return true;}catch{return false;}};
const exact=(x,keys,optional=[])=>plain(x)&&keys.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>[...keys,...optional].includes(k));
export function validateWorkflowCatalog(catalog,jobs,frontend) {
  const errors=[];
  if(!exact(catalog,['schema','skill','gates','fallback','readOnly','unknownExplicitWorkflow','limits','workflows'])||catalog.gates!=='gates.json'||catalog.schema!=='starci/workflow-catalog@1'||catalog.skill!=='../SKILL.md'||catalog.fallback!=='none'||catalog.readOnly!=='answer-or-inspect'||catalog.unknownExplicitWorkflow!=='error'||!Array.isArray(catalog.workflows))return {ok:false,errors:['Invalid workflow catalog']};
  if(!exact(catalog.limits,['rows','columns','secondaryDefinitions'])||Object.values(catalog.limits).some(n=>n!==3))errors.push('Invalid limits');
  const expected=new Set([frontend.id,...jobs.workflows.map(w=>w.id)]),ids=new Set(),intents=new Set();
  for(const row of catalog.workflows){
    if(!exact(row,['id','intent','when','definition','execution'])||Object.values(row).some(x=>typeof x!=='string'||!x.trim())){errors.push('Invalid workflow entry');continue;}
    if(ids.has(row.id)||intents.has(row.intent)||!expected.has(row.id))errors.push('Duplicate or unknown workflow');
    ids.add(row.id);intents.add(row.intent);
    const isFrontend=row.id===frontend.id;if(row.definition!==(isFrontend?'frontend.json':'jobs.json')||row.execution!==(isFrontend?'frontend-gate':row.id==='analyze-request'?'read-only-analysis':'explicit-coordinator'))errors.push('Wrong workflow source or execution claim');
  }
  if(ids.size!==expected.size||[...expected].some(id=>!ids.has(id)))errors.push('Incomplete workflow discovery');
  return {ok:errors.length===0,errors};
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
export function validBackendRun(run){if(run?.delegated&&!hasDelegatedAcceptance(run))return false;if(!plain(run)||!['accepted','done'].includes(run.status)||run.goal?.workflow!=='implement-backend'||typeof run.goalDigest!=='string'||!plain(run.responses))return false;const resultDigest=sha256(canonicalJSON({goalDigest:run.goalDigest,responses:run.responses}));if(run.resultDigest!==resultDigest||!Array.isArray(run.approvals)||(!run.approvals.some(a=>a?.actor==='user'&&a.phase==='acceptance'&&a.approved===true&&a.digest===resultDigest&&typeof a.messageId==='string'&&a.messageId.trim())&&!verifiedAutoBackend(run)&&!hasDelegatedAcceptance(run)))return false;const responses=Object.values(run.responses),criteria=responses.flatMap(r=>Array.isArray(r?.criteria)?r.criteria:[]);if(!['unit-tests-pass','backend-e2e-pass'].every(id=>criteria.some(c=>c?.id===id&&c.status==='pass'&&typeof c.observation==='string'&&c.observation.trim())))return false;return responses.some(r=>typeof r?.outputs?.apiContract==='string'&&r.outputs.apiContract.trim());}
