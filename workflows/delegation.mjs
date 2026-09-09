import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalJSON,sha256,validateWorkspace} from '../core/index.mjs';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {validatePlan} from './plan.mjs';
import {verifyAutoEvidence,verifyAutoPredecessors} from './auto.mjs';
import {typed} from './typed.mjs';

const hash=x=>sha256(canonicalJSON(x));
const same=(a,b)=>hash(a)===hash(b);
const text=x=>typeof x==='string'&&x.trim().length>0;
const requireThat=(ok,message)=>{if(!ok)throw Error(message);};
const exact=(x,keys)=>x&&typeof x==='object'&&!Array.isArray(x)&&keys.every(k=>Object.hasOwn(x,k))&&Object.keys(x).every(k=>keys.includes(k));
const strings=x=>Array.isArray(x)&&x.every(text)&&new Set(x).size===x.length;
const inside=(root,file)=>{const relative=path.relative(root,file);return relative!=='..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative);};
const catalog=JSON.parse(fs.readFileSync(new URL('./catalog.json',import.meta.url)));
const runtimeRoot=fs.realpathSync(fileURLToPath(new URL('../',import.meta.url)));
const allowed=new Set(['analyze-request','prepare-work','define-business','design-architecture','design-interface','implement-backend','implement-frontend','verify-flows','review-code','produce-content']);

// This is honest contextual provenance, not identity authentication or a signature.
export function validateDelegationSource(source,actor) {
 requireThat(exact(source,['actor','threadId','messageId','messageIdAvailability','quote','assurance'])&&source.actor===actor&&text(source.threadId)&&text(source.quote)&&source.assurance==='conversation-context-not-authenticated','Record actual conversation provenance, not an authenticated receipt');
 requireThat(source.messageIdAvailability==='available'?text(source.messageId):source.messageIdAvailability==='not-exposed'&&source.messageId===null,'Native message ID must be actual or explicitly unavailable');
 return true;
}
function noLinks(root,file) {
 root=path.resolve(root);file=path.resolve(file); // I/O only; immutable binding strings remain untouched.
 requireThat(inside(root,file),'Delegation state escapes Work');
 let cursor=file;while(cursor!==root){requireThat(inside(root,cursor),'Delegation ancestor escaped Work');requireThat(!fs.existsSync(cursor)||!fs.lstatSync(cursor).isSymbolicLink(),'Delegation state cannot follow links');const parent=path.dirname(cursor);requireThat(parent!==cursor,'Delegation ancestor walk reached filesystem root');cursor=parent;}
 requireThat(fs.existsSync(root)&&!fs.lstatSync(root).isSymbolicLink(),'Real Work root required');
}
function stateFile(workRoot,id) {
 requireThat(text(workRoot)&&path.isAbsolute(workRoot)&&/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id),'Absolute Work root and safe delegation ID required');
 const file=path.join(workRoot,'_local','approvals',id+'.yaml');noLinks(workRoot,file);return file;
}
function bindings(workRoot,repositories) {
 requireThat(path.isAbsolute(workRoot)&&fs.existsSync(workRoot)&&repositories&&Object.values(repositories).every(p=>text(p)&&path.isAbsolute(p)&&fs.existsSync(p)),'Resolve actual Work and repository roots');
 return {workRoot,realWorkRoot:fs.realpathSync(workRoot),repositories:structuredClone(repositories),realRepositories:Object.fromEntries(Object.entries(repositories).map(([id,p])=>[id,fs.realpathSync(p)]))};
}
function validateMandate(plan,m) {
 requireThat(exact(m,['schema','id','source','coordinatorThreadId','taskThreadId','planDigest','binding','jobs','terminal','review'])&&m.schema==='starci/scoped-approver@1','Invalid scoped approver mandate');
 requireThat(plan?.schema==='starci/plan@2'&&(plan.mode??'manual')==='manual'&&validatePlan(plan,catalog).digest===m.planDigest,'Scoped approver requires the exact reviewed manual Plan');
 validateDelegationSource(m.source,'user');validateDelegationSource(m.review,'assistant');
 requireThat(text(m.coordinatorThreadId)&&text(m.taskThreadId)&&m.review.threadId===m.coordinatorThreadId&&m.terminal==='plan-terminal-criteria','Designated coordinator, task and terminal boundary required');
 requireThat(same(m.binding,bindings(m.binding.workRoot,m.binding.repositories)),'Delegated root binding changed');
 requireThat(Array.isArray(m.jobs)&&m.jobs.length===plan.workflows.length&&new Set(m.jobs.map(j=>j?.id)).size===m.jobs.length,'Mandate must review every exact Plan job');
 for(const job of plan.workflows) {
  const ceiling=m.jobs.find(j=>j.id===job.id);
  requireThat(allowed.has(job.workflow)&&exact(ceiling,['id','environment','business','resourceEffects'])&&['local','isolated-test'].includes(ceiling.environment)&&strings(ceiling.business)&&ceiling.business.length&&Array.isArray(ceiling.resourceEffects),'Reserved workflow or invalid technical ceiling');
  for(const effect of ceiling.resourceEffects){requireThat(exact(effect,['target','operation','postcondition','category'])&&job.resources.includes(effect.target)&&text(effect.operation)&&text(effect.postcondition)&&['work-record','isolated-test','local-artifact'].includes(effect.category),'Exact local resource effect and category required');requireThat(!effect.target.split(/[:\\/]/).some(x=>['.claude','.chatgpt','.workspaces','agents.md','claude.md'].includes(x.toLowerCase())),'Runtime/bootstrap resource effects require separate authority');if(path.isAbsolute(effect.target)){const owners=[m.binding.realWorkRoot,...Object.values(m.binding.realRepositories)];let ancestor=effect.target;while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);const real=path.resolve(fs.realpathSync(ancestor),path.relative(ancestor,effect.target));requireThat(owners.some(root=>inside(root,real))&&!inside(runtimeRoot,real),'Absolute delegated resource escapes local owners');}}
  for(const entry of job.paths){const colon=entry.indexOf(':'),repo=entry.slice(0,colon),relative=entry.slice(colon+1),base=m.binding.repositories[repo];requireThat(colon>0&&base&&text(relative)&&!path.isAbsolute(relative),'Resolve each delegated code path');const target=path.resolve(base,relative);requireThat(inside(fs.realpathSync(base),target),'Delegated path escapes repository');let ancestor=target;while(!fs.existsSync(ancestor))ancestor=path.dirname(ancestor);const real=path.resolve(fs.realpathSync(ancestor),path.relative(ancestor,target));requireThat(inside(fs.realpathSync(base),real)&&!inside(runtimeRoot,real)&&!relative.split(/[\\/]/).some(x=>['.claude','.chatgpt','.workspaces','agents.md','claude.md'].includes(x.toLowerCase())),'Runtime/bootstrap or escaping paths require separate authority');}
 }
 return m;
}

/** Call only after observing a real user delegation and actually reviewing this Plan.
 * A caller can lie about a conversation; local validation is not authentication. */
export function registerScopedMandate(plan,{id,source,coordinatorThreadId,taskThreadId,workRoot,repositories,jobs,review}) {
 const mandate={schema:'starci/scoped-approver@1',id,source,coordinatorThreadId,taskThreadId,planDigest:validatePlan(plan,catalog).digest,binding:bindings(workRoot,repositories),jobs,terminal:'plan-terminal-criteria',review};
 validateMandate(plan,mandate);
 const file=stateFile(workRoot,id),digest=hash(mandate);
 requireThat(!fs.existsSync(file),'Delegation already exists; never replace or reactivate it');
 fs.mkdirSync(path.dirname(file),{recursive:true});noLinks(workRoot,file);
 fs.writeFileSync(file,stringifyYaml({schema:'starci/approver-state@1',mandate,digest,status:'active'}),{flag:'wx'});
 return {file,digest};
}
export function readScopedMandate(plan,reference,{active=true}={}) {
 requireThat(exact(reference,['file','digest'])&&text(reference.file)&&path.isAbsolute(reference.file),'Explicit delegation state reference required');
 const state=parseYaml(fs.readFileSync(reference.file,'utf8')),m=state?.mandate;
 requireThat(state?.schema==='starci/approver-state@1'&&same(state.digest,reference.digest)&&hash(m)===reference.digest&&reference.file===stateFile(m.binding.workRoot,m.id),'Delegation record changed or relocated');
 validateMandate(plan,m);
 requireThat(['active','revoked','completed'].includes(state.status),'Unknown delegation state');
 if(active)requireThat(state.status==='active','Delegation revoked or terminal; no new effects');
 return state;
}
export function revokeScopedMandate(plan,reference,{source}) {
 validateDelegationSource(source,'user');const state=readScopedMandate(plan,reference);
 fs.writeFileSync(reference.file,stringifyYaml({...state,status:'revoked',revocation:source}));
}

export function delegatedContext(run) {
 const work=validateWorkspace(run.workRoot),targets=run.goal.workTargets.map(id=>{const n=work.nodes.find(n=>n.id===id);return n?{id,inputDigest:n.inputDigest,contextDigest:n.contextDigest,effectiveState:n.effectiveState}: {id,missing:true};});
 return hash({goalDigest:run.goalDigest,targets,responses:run.responses});
}
function riskShape(assessment,stage,environment) {
 return exact(assessment,['stage','contextDigest','risk','environment','reversible','reason','observations','hazards'])&&assessment.stage===stage&&/^[a-f0-9]{64}$/.test(assessment.contextDigest)&&['low','medium'].includes(assessment.risk)&&assessment.environment===environment&&assessment.reversible===true&&text(assessment.reason)&&strings(assessment.observations)&&assessment.observations.length&&Array.isArray(assessment.hazards)&&assessment.hazards.length===0;
}
export function assertDelegatedAssessment(run,assessment,stage) {
 const state=readScopedMandate(run.presentation.scope,run.delegated.reference),ceiling=state.mandate.jobs.find(j=>j.id===run.presentation.jobId);
 requireThat(riskShape(assessment,stage,ceiling.environment)&&assessment.contextDigest===delegatedContext(run),'Current stage risk is unknown, changed, high, irreversible or unresolved');
 return true;
}
export function assertDelegatedGoal(run,{active=true,coordinatorThreadId,taskThreadId}={}) {
 requireThat(!run.automatic&&run.delegated,'Delegated manual and auto authority cannot be mixed');
 const plan=run.presentation?.scope,state=readScopedMandate(plan,run.delegated.reference,{active}),m=state.mandate,job=plan.workflows.find(j=>j.id===run.presentation.jobId),ceiling=m.jobs.find(j=>j.id===job?.id);
 requireThat(run.goalDigest===hash({goal:run.goal,workRoot:run.workRoot,repositories:run.repositories})&&run.scopeDigest===hash({requestId:run.goal.requestId,originalRequest:run.goal.originalRequest,scope:run.goal.scope})&&run.presentation.goalDigest===run.goalDigest&&run.presentation.scopeDigest===m.planDigest,'Delegated goal or Plan changed');
 requireThat(same(m.binding,bindings(run.workRoot,run.repositories))&&run.goal.requestId===plan.requestId&&run.goal.originalRequest===plan.originalRequest&&job?.workflow===run.goal.workflow,'Delegation root/request/workflow mismatch');
 requireThat(!plan.openQuestions.length&&!job.openQuestions.length,'Unresolved user choices cannot be answered by delegation');
 requireThat(job.criteria.every(c=>run.goal.criteria.includes(c))&&same([...job.workTargets].sort(),[...run.goal.workTargets].sort())&&run.goal.scope.paths.every(p=>job.paths.includes(p))&&run.goal.scope.resources.every(p=>job.resources.includes(p))&&run.goal.scope.business.every(b=>ceiling.business.includes(b))&&plan.exclusions.every(e=>run.goal.scope.exclusions.includes(e)),'Goal changes delegated scope, targets or criteria');
 requireThat(run.goal.resourceEffects.every(e=>ceiling.resourceEffects.some(({category,...allowedEffect})=>same(e,allowedEffect))),'Resource effect exceeds delegated operation/postcondition');
 requireThat(run.goal.workflow!=='prepare-work'||run.goal.cells.every(c=>c.operation==='prepare'),'Delegation cannot import or migrate');
 const a=run.delegated.assessment;
 requireThat(riskShape(a,'goal',ceiling.environment),'Invalid original coordinator risk decision');
 validateDelegationSource(run.presentation.provenance,'assistant');
 requireThat(run.presentation.provenance.threadId===m.taskThreadId&&run.presentation.messageId===run.presentation.provenance.messageId,'Actual target-task goal brief required');
 const receipt=run.approvals.find(a=>a?.actor==='assistant'&&a.phase==='scoped-goal'&&a.approved===true&&a.digest===run.goalDigest&&a.mandateDigest===run.delegated.reference.digest&&a.presentationDigest===hash(run.presentation)&&a.assessmentDigest===hash(run.delegated.assessment));
 requireThat(receipt,'Missing explicit coordinator goal decision');validateDelegationSource(receipt.source,'assistant');
 requireThat(receipt.source.threadId===m.coordinatorThreadId,'Observer is not the designated approver');
 if(coordinatorThreadId!==undefined||taskThreadId!==undefined)requireThat(coordinatorThreadId===m.coordinatorThreadId&&taskThreadId===m.taskThreadId,'Wrong coordinator or executing task');
 return state;
}
export function assertDelegatedDispatch(run,{coordinatorThreadId,taskThreadId,assessment,priorRuns={}}={},stage) {
 requireThat(text(coordinatorThreadId)&&text(taskThreadId),'Explicit coordinator and executing task identity required');
 assertDelegatedGoal(run,{coordinatorThreadId,taskThreadId});assertDelegatedAssessment(run,assessment,stage);
 verifyAutoPredecessors(run,priorRuns);
 if(Object.keys(run.responses).length)verifyPartialResults(run);
}
function verifyPartialResults(run) {
 const work=validateWorkspace(run.workRoot);
 requireThat(work.errors.every(e=>['STALE_COMPLETION','STALE_EVIDENCE','DEPENDENCY_NOT_DONE'].includes(e.code)),'Current producer Work graph is invalid');
 const completedInRun=new Set(Object.keys(run.responses).flatMap(id=>run.goal.cells.find(c=>c.id===id)?.workTargets??[]));
 for(const [id,response]of Object.entries(run.responses)) {
  const cell=run.goal.cells.find(c=>c.id===id),request=run.requests[id];
  requireThat(cell&&request&&request.cell===id&&request.goalDigest===run.goalDigest&&request.scopeDigest===run.scopeDigest&&request.op===cell.op&&request.operation===(cell.operation??null)&&same(request.criteria,cell.criteria)&&same(request.outputSchema,cell.outputSchema),'Accepted producer no longer matches the goal cell');
  const current=run.goal.workflow==='prepare-work'?[]:(cell.workTargets??run.goal.workTargets).map(id=>{const n=work.nodes.find(n=>n.id===id);requireThat(n,'Producer Work target is missing');requireThat(n.blockedBy.every(id=>run.status!=='done'&&completedInRun.has(id)),'Producer prerequisite is no longer effectively done');if(run.status==='done')requireThat(n.effectiveState==='done','Completed producer Work proof is no longer valid');return {id:n.id,inputDigest:n.inputDigest,contextDigest:n.contextDigest};});
  requireThat(same(current,request.workBindings??[]),'Producer Work inputs changed; investigate before consuming this result');
  const inputs={};for(const [key,binding]of Object.entries(cell.inputs)){const producer=binding.from==='request'?run.goal.inputs:run.responses[binding.cell]?.outputs;requireThat(producer&&Object.hasOwn(producer,binding.key),'Accepted producer input is missing');inputs[key]=producer[binding.key];}
  requireThat(same(inputs,request.inputs)&&typed(response.outputs,cell.outputSchema)&&Array.isArray(response.criteria)&&response.criteria.length===cell.criteria.length&&new Set(response.criteria.map(c=>c.id)).size===cell.criteria.length,'Typed result, exact criteria or producer inputs changed');
  verifyAutoEvidence({...run,goal:{...run.goal,cells:[cell]},responses:{[id]:response}});
 }
}
export function verifyDelegatedResult(run) {
 requireThat(Object.keys(run.responses).length===run.goal.cells.length&&run.resultDigest===hash({goalDigest:run.goalDigest,responses:run.responses}),'Incomplete or changed delegated result');
 verifyPartialResults(run);
}
export function hasDelegatedAcceptance(run) {
 try{const {mandate}=assertDelegatedGoal(run,{active:false});verifyDelegatedResult(run);return run.approvals.some(a=>{if(a?.actor!=='assistant'||a.phase!=='scoped-acceptance'||a.approved!==true||a.digest!==run.resultDigest||a.mandateDigest!==run.delegated.reference.digest)return false;validateDelegationSource(a.source,'assistant');return a.source.threadId===mandate.coordinatorThreadId&&riskShape(a.assessment,'acceptance',mandate.jobs.find(j=>j.id===run.presentation.jobId).environment)&&a.assessmentDigest===hash(a.assessment);});}catch{return false;}
}
function hasDirectAcceptance(run) {
 try {
  if(run.automatic||run.delegated||run.presentation?.provenance||!text(run.presentation?.messageId))return false;
  verifyDelegatedResult(run);
  return run.approvals.some(a=>a?.actor==='user'&&a.phase==='goal'&&a.approved===true&&a.digest===run.goalDigest&&text(a.messageId)&&text(a.quote)&&a.messageId!==run.goal.requestId&&a.messageId!==run.presentation.messageId&&a.quote!==run.goal.originalRequest&&a.replyTo===run.presentation.messageId)&&run.approvals.some(a=>a?.actor==='user'&&a.phase==='acceptance'&&a.approved===true&&a.digest===run.resultDigest&&text(a.messageId)&&text(a.quote));
 }catch{return false;}
}
export function completeDelegatedPlan(plan,{reference,runs,criteria,source}) {
 const state=readScopedMandate(plan,reference);validateDelegationSource(source,'assistant');requireThat(source.threadId===state.mandate.coordinatorThreadId,'Only the designated coordinator reviews terminal completion');
 const binding=state.mandate.binding;
 verifyAutoPredecessors({presentation:{scope:plan,scopeDigest:state.mandate.planDigest},workRoot:binding.workRoot,repositories:binding.repositories},runs,{throughEnd:true});
 requireThat(plan.workflows.every(j=>{const r=runs[j.id];return r?.delegated?r.delegated.reference.digest===reference.digest&&hasDelegatedAcceptance(r):r&&hasDirectAcceptance(r); }),'Every workflow needs this mandate or unchanged direct-user acceptance; foreign delegation is not inherited');
 requireThat(Array.isArray(criteria)&&criteria.length===plan.completionCriteria.length&&new Set(criteria.map(c=>c?.id)).size===criteria.length,'Review every terminal criterion once');
 for(const expected of plan.completionCriteria){const actual=criteria.find(c=>c.id===expected.id);requireThat(actual?.status==='pass'&&text(actual.observation)&&Array.isArray(actual.evidence)&&expected.workflowIds.every(id=>actual.evidence.some(e=>e.jobId===id)),'Terminal criterion lacks producer proof');for(const ref of actual.evidence){const proof=runs[ref.jobId]?.responses[ref.cellId]?.criteria.find(c=>c.id===ref.criterionId);requireThat(expected.workflowIds.includes(ref.jobId)&&proof?.status==='pass'&&proof.evidence.length,'Invalid terminal producer');}}
 return {schema:'starci/scoped-completion@1',actor:'assistant',status:'done',planDigest:state.mandate.planDigest,mandateDigest:reference.digest,resultDigests:Object.fromEntries(plan.workflows.map(j=>[j.id,runs[j.id].resultDigest])),criteria:structuredClone(criteria),source};
}
export function closeScopedMandate(plan,reference,completion) {
 const state=readScopedMandate(plan,reference);requireThat(completion?.schema==='starci/scoped-completion@1'&&completion.mandateDigest===reference.digest&&completion.planDigest===state.mandate.planDigest,'Bound terminal completion required');
 // Called only after lifecycle persisted the validated terminal result.
 fs.writeFileSync(reference.file,stringifyYaml({...state,status:'completed',completionDigest:hash(completion)}));
}
