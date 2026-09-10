import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {sha256,validateWorkspace} from '../core/index.mjs';
import {stringifyYaml,parseYaml} from '../core/yaml.mjs';
import {registerScopedMandate,readScopedMandate,revokeScopedMandate,delegatedContext,hasDelegatedAcceptance} from '../workflows/delegation.mjs';
import {propose,presentGoal,approveGoal,presentDelegatedGoal,authorizeDelegatedGoal,requestCell,acceptCell,acceptDelivery,acceptDelegatedDelivery,markWorkDone,authorizeAutoGoal,acceptAutoDelivery,saveRun,loadPlanRuns,saveDelegatedCompletion,workflowDigest} from '../workflows/lifecycle.mjs';
import {validBackendRun,selectJobPlan} from '../workflows/select.mjs';

const source=(actor,threadId,quote)=>({actor,threadId,messageId:null,messageIdAvailability:'not-exposed',quote,assurance:'conversation-context-not-authenticated'});
function fixture(t,{count=2,workflow='implement-backend',omitApi=false}={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-delegation-'));
 t.after(()=>{assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-delegation-'));fs.rmSync(dir,{recursive:true,force:true});});
 const root=path.join(dir,'.starciwork'),put=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,stringifyYaml(x));};
 put(path.join(root,'workspace.yaml'),{schema:'work/workspace@1',id:'synthetic-delegation'});
 const criteria=['unit-tests-pass','backend-e2e-pass',...omitApi?[]:['api-contract-pass']];
 const plan={schema:'starci/plan@2',mode:'manual',id:'synthetic-delegation',requestId:'original-request',originalRequest:'Synthetic request delegates technical review and delivery; no real product authority.',finalOutcome:'Synthetic outputs verified',openQuestions:[],exclusions:['production'],completionCriteria:[{id:'terminal',outcome:'All synthetic checks pass',workflowIds:Array.from({length:count},(_,i)=>'job-'+i)}],workflows:[]};
 for(const area of ['business','architecture','implementation','backend','frontend','uat'])plan[area]={action:'not-applicable',outcome:'Synthetic fixture only',targets:[],workflowIds:[],evidence:[],reason:'No real delivery'};
 const ceilings=[];
 for(let i=0;i<count;i++) {
  put(path.join(root,'piece-'+i,'index.yaml'),{schema:'work/node@2',id:'piece-'+i,kind:'operations',state:'todo',required:true,assertions:criteria,description:'Synthetic scoped approver fixture'});
  fs.writeFileSync(path.join(dir,'proof-'+i+'.log'),'Synthetic proof '+i);
  plan.workflows.push({id:'job-'+i,workflow,selection:{requestQuote:plan.originalRequest,codeChange:true,verification:'unit-component',separateDeliverable:false},purpose:'Check synthetic output',input:'Synthetic request',output:'Verified synthetic API',criteria,workTargets:['piece-'+i],paths:[],resources:['test:'+i],dependsOn:i?['job-'+(i-1)]:[],estimate:{minMinutes:1,maxMinutes:2,assumptions:'Synthetic'},openQuestions:[]});
  ceilings.push({id:'job-'+i,environment:'isolated-test',business:['synthetic'],resourceEffects:[{target:'test:'+i,operation:'run-tests',postcondition:'Synthetic checks pass',category:'isolated-test'}]});
 }
 plan.backend={action:'change',outcome:plan.finalOutcome,targets:plan.workflows.flatMap(j=>j.workTargets),workflowIds:plan.workflows.map(j=>j.id),evidence:[],reason:''};
 const review=source('assistant','coordinator','Synthetic coordinator actually reviewed this exact Plan');
 const options={id:'synthetic-grant',source:source('user','coordinator','Synthetic explicit user delegates these tasks through their terminal technical criteria.'),coordinatorThreadId:'coordinator',taskThreadId:'worker',workRoot:root,repositories:{repo:dir},jobs:ceilings,review};
 const register=()=>registerScopedMandate(plan,options);
 const goal=(i=0)=>{const j=plan.workflows[i];return {schema:'starci/goal@1',id:'goal-'+i,workflow:j.workflow,requestId:plan.requestId,originalRequest:plan.originalRequest,finalOutcome:j.purpose,scope:{business:['synthetic'],paths:j.paths,resources:j.resources,exclusions:plan.exclusions},criteria:j.criteria,businessChanges:['Only synthetic checks'],impacts:[],resourceEffects:ceilings[i].resourceEffects.map(({category,...effect})=>effect),inputs:{request:'Synthetic input'},workTargets:j.workTargets,cells:[{id:j.workflow,op:'backend.implement',purpose:j.purpose,finalOutput:j.output,criteria:j.criteria,inputs:{request:{from:'request',key:'request'}},outputSchema:{type:'object',properties:{apiContract:{type:'string'}},required:['apiContract'],additionalProperties:false}}]};};
 const assessment=(run,stage)=>({stage,contextDigest:delegatedContext(run),risk:'low',environment:'isolated-test',reversible:true,reason:'Disposable synthetic fixture inspected',observations:['Only scoped local fixture effects'],hazards:[]});
 const shown=(reference,i=0,g=goal(i))=>presentDelegatedGoal(propose(g,{workRoot:root,repositories:{repo:dir}}),{scope:plan,jobId:'job-'+i,reference,provenance:source('assistant','worker','Synthetic on-screen bounded goal brief '+i)});
 const approve=(reference,i=0,priorRuns={})=>{const run=shown(reference,i);return authorizeDelegatedGoal(run,{reference,assessment:assessment(run,'goal'),source:review,priorRuns});};
 const issue=(run,priorRuns={})=>requestCell(run,run.goal.cells[0].id,{coordinatorThreadId:'coordinator',taskThreadId:'worker',assessment:assessment(run,run.goal.cells[0].id),priorRuns});
 const pass=(run,i=0,priorRuns={})=>{const issued=issue(run,priorRuns),r=issued.request;return acceptCell(issued.run,{cell:r.cell,op:r.op,operation:r.operation,goalDigest:r.goalDigest,scopeDigest:r.scopeDigest,requestDigest:workflowDigest(r),status:'pass',criteria:r.criteria.map(id=>({id,status:'pass',observation:'Synthetic observed passing check',evidence:['log']})),outputs:{apiContract:'Synthetic API contract'},artifacts:[{id:'log',path:'proof-'+i+'.log',sha256:sha256(fs.readFileSync(path.join(dir,'proof-'+i+'.log')))}]},{evidenceRoot:dir});};
 const accept=(run,priorRuns={})=>acceptDelegatedDelivery(run,{source:review,assessment:assessment(run,'acceptance'),priorRuns});
 const finish=(run,i=0,priorRuns={})=>{run=accept(pass(run,i,priorRuns),priorRuns);const node=validateWorkspace(root).nodes.find(n=>n.id==='piece-'+i);put(path.join(root,'piece-'+i,'evidence/synthetic/manifest.yaml'),{schema:'work/evidence@1',id:'proof-'+i,nodeId:node.id,inputDigest:node.inputDigest,outcome:'pass',assertions:criteria.map(id=>({id,outcome:'pass',observation:'Synthetic proof, not product acceptance'})),assets:[]});return markWorkDone(run,{[node.id]:{inputDigest:node.inputDigest,evidence:['proof-'+i]}});};
 return {dir,root,put,plan,options,review,register,goal,assessment,shown,approve,issue,pass,accept,finish};
}

import {presentAutoPlan,approveAutoPlan,hasAutoAcceptance} from '../workflows/auto.mjs';
import {verifyProducerResult} from '../workflows/producer-verification.mjs';
import {hasDirectProducerAcceptance} from '../workflows/producer-verification.mjs';

import {readWorkflow, readExample, readPublicJson} from './helpers/read-public.mjs';
const catalog=readWorkflow('catalog.json');
const consumer=run=>selectJobPlan(catalog,{actions:[{action:'implement-frontend',effectful:true,requiresBackend:true}],acceptedBackendRun:run});
const reseal=run=>{for(const [id,r]of Object.entries(run.responses))r.requestDigest=workflowDigest(run.requests[id]);run.resultDigest=workflowDigest({goalDigest:run.goalDigest,responses:run.responses});for(const a of run.approvals)if(a.phase.includes('acceptance'))a.digest=run.resultDigest;};
function backend(t,mode,{done=false,upstream=false,referenceInput=false,omitApi=false,beforeApprove}={}){
 const f=fixture(t,{count:1,omitApi});
 // Deliberately synthetic operations nodes: tests prove lifecycle transport,
 // not actual product implementation quality or real human authority.
 if(upstream){
  f.put(path.join(f.root,'upstream/index.yaml'),{schema:'work/node@2',id:'upstream',kind:'operations',state:'done',required:true,assertions:['upstream-check'],description:'Reviewed upstream input'});
  let node=validateWorkspace(f.root).nodes.find(n=>n.id==='upstream');
  f.put(path.join(f.root,'upstream/evidence/check/manifest.yaml'),{schema:'work/evidence@1',id:'upstream-proof',nodeId:node.id,inputDigest:node.inputDigest,outcome:'pass',assertions:[{id:'upstream-check',outcome:'pass',observation:'Synthetic upstream check'}],assets:[]});
  const file=path.join(f.root,'upstream/index.yaml'),value=parseYaml(fs.readFileSync(file,'utf8'));value.completion={inputDigest:node.inputDigest,evidence:['upstream-proof']};f.put(file,value);
  const target=path.join(f.root,'piece-0/index.yaml'),v=parseYaml(fs.readFileSync(target,'utf8'));v[referenceInput?'refs':'dependsOn']=['upstream'];f.put(target,v);
 }
 beforeApprove?.(f);
 let run,reference;
 if(mode==='delegated'){reference=f.register();run=f.approve(reference);}
 else {
  if(mode==='auto'){
   f.plan.mode='auto';f.plan.auto={maxMinutes:30,acceptance:'verified-criteria'};
   f.plan.workflows[0].auto={environment:'isolated-test',business:['synthetic'],resourceEffects:f.goal().resourceEffects};
  }
  run=presentGoal(propose(f.goal(),{workRoot:f.root,repositories:{repo:f.dir}}),{messageId:'synthetic-goal-presentation',scope:f.plan,jobId:'job-0'});
  if(mode==='manual')run=approveGoal(run,{actor:'user',phase:'goal',approved:true,digest:run.goalDigest,messageId:'synthetic-user-goal',replyTo:run.presentation.messageId,quote:'Synthetic approval of this exact bounded goal'});
  else{
   const presentation=presentAutoPlan(f.plan,{messageId:'synthetic-auto-presentation',workRoot:f.root,repositories:{repo:f.dir}});
   const authorization=approveAutoPlan(f.plan,presentation,{actor:'user',phase:'plan-auto',approved:true,digest:presentation.digest,messageId:'synthetic-user-auto',replyTo:presentation.messageId,quote:'Synthetic auto delegation with explicit budget'});
   run=authorizeAutoGoal(run,{authorization,assessment:{risk:'low',environment:'isolated-test',reversible:true,reason:'Disposable fixture only',evidence:['Synthetic inspected fixture'],hazards:[]}});
  }
 }
 const pending=f.pass(run);
 run=mode==='delegated'?f.accept(pending):mode==='auto'?acceptAutoDelivery(pending):acceptDelivery(pending,{actor:'user',phase:'acceptance',approved:true,digest:pending.resultDigest,messageId:'synthetic-user-result',quote:'Synthetic acceptance after checking actual fixture result'});
 if(done){
  const node=validateWorkspace(f.root).nodes.find(n=>n.id==='piece-0');
  f.put(path.join(f.root,'piece-0/evidence/synthetic/manifest.yaml'),{schema:'work/evidence@1',id:'proof-0',nodeId:node.id,inputDigest:node.inputDigest,outcome:'pass',assertions:run.goal.criteria.map(id=>({id,outcome:'pass',observation:'Synthetic completion check'})),assets:[]});
  run=markWorkDone(run,{[node.id]:{inputDigest:node.inputDigest,evidence:['proof-0']}});
 }
 return {...f,run,pending,reference};
}
function edit(f,rel,fn){const file=path.join(f.root,rel),v=parseYaml(fs.readFileSync(file,'utf8'));fn(v);f.put(file,v);}
const attacks=[
 ['artifact bytes',f=>fs.appendFileSync(path.join(f.dir,'proof-0.log'),' drift')],
 ['target semantic input',f=>edit(f,'piece-0/index.yaml',v=>v.description+=' changed')],
 ['frozen goal',f=>f.run.goal.finalOutcome+=' changed'],
 ['presented Plan',f=>f.run.presentation.scope.finalOutcome+=' changed'],
 ['presentation job',f=>f.run.presentation.jobId='other'],
 ['scope digest',f=>f.run.scopeDigest='0'.repeat(64)],
 ['Work root',f=>f.run.workRoot=f.dir],
 ['repository binding',f=>f.run.repositories.repo=f.root],
 ['missing request',f=>delete f.run.requests['implement-backend']],
 ['missing request Work binding despite rebound digest',f=>{delete f.run.requests['implement-backend'].workBindings;reseal(f.run);}],
 ['typed output despite rebound local digest',f=>{f.run.responses['implement-backend'].outputs.apiContract=7;reseal(f.run);}],
 ['missing criterion despite rebound local digest',f=>{f.run.responses['implement-backend'].criteria.pop();reseal(f.run);}],
 ['duplicate criterion despite rebound local digest',f=>{const c=f.run.responses['implement-backend'].criteria;c[1]=structuredClone(c[0]);reseal(f.run);}],
 ['changed consumed input despite rebound local digest',f=>{f.run.requests['implement-backend'].inputs.request='other';reseal(f.run);}],
 ['artifact escapes root despite rebound local digest',f=>{f.run.responses['implement-backend'].artifacts[0].path='../outside.log';reseal(f.run);}],
 ['missing goal decision',f=>f.run.approvals=f.run.approvals.filter(a=>!a.phase.includes('goal'))],
 ['missing result decision',f=>f.run.approvals=f.run.approvals.filter(a=>!a.phase.includes('acceptance'))],
 ['mixed authority',f=>{f.run.automatic??={};f.run.delegated??={};}],
];
for(const mode of ['manual','auto','delegated']){
 test(mode+' backend without separately verified API criterion cannot hand off',t=>{
  const f=backend(t,mode,{omitApi:true});assert.equal(f.run.status,'accepted');assert.equal(validBackendRun(f.run),false);assert.throws(()=>consumer(f.run));
 });
 test(mode+' accepted backend explicitly reopened as uninvestigate cannot hand off',t=>{
  const f=backend(t,mode);assert.equal(validBackendRun(f.run),true);edit(f,'piece-0/index.yaml',v=>v.state='uninvestigate');assert.equal(validBackendRun(f.run),false);assert.throws(()=>consumer(f.run));
 });
 for(const done of [false,true])test(mode+' current '+(done?'done':'accepted-before-completion')+' producer qualifies for frontend',t=>{
  const f=backend(t,mode,{done});assert.equal(validBackendRun(f.run),true);assert.deepEqual(consumer(f.run).jobs.map(j=>j.id),['implement-frontend']);
 });
 for(const [name,change]of attacks)test(mode+' backend handoff rejects '+name,t=>{
  const f=backend(t,mode);change(f);assert.equal(validBackendRun(f.run),false);assert.throws(()=>consumer(f.run));
 });
 for(const [name,change]of [
  ['stale completion manifest',f=>edit(f,'piece-0/evidence/synthetic/manifest.yaml',v=>v.inputDigest='0'.repeat(64))],
  ['removed completion and reopened leaf',f=>edit(f,'piece-0/index.yaml',v=>{delete v.completion;v.state='todo';})],
  ['missing completion manifest',f=>fs.unlinkSync(path.join(f.root,'piece-0/evidence/synthetic/manifest.yaml'))],
 ])test(mode+' done backend rejects '+name,t=>{
  const f=backend(t,mode,{done:true});change(f);assert.equal(validBackendRun(f.run),false);assert.throws(()=>consumer(f.run));
 });
 for(const done of [false,true])test(mode+' rejects stale prerequisite with unchanged producer semantics '+done,t=>{
  const f=backend(t,mode,{done,upstream:true});assert.equal(validBackendRun(f.run),true);
  edit(f,'upstream/evidence/check/manifest.yaml',v=>v.inputDigest='0'.repeat(64));
  assert.equal(validBackendRun(f.run),false);assert.throws(()=>consumer(f.run));
 });
 test(mode+' current done producer tolerates unrelated recoverable stale completion',t=>{
  const f=backend(t,mode,{done:true});
  f.put(path.join(f.root,'unrelated/index.yaml'),{schema:'work/node@2',id:'unrelated',kind:'operations',state:'done',required:true,assertions:['unrelated-check'],description:'Unrelated repair',completion:{inputDigest:'0'.repeat(64),evidence:['missing']}});
  f.put(path.join(f.root,'unrelated/evidence/check/manifest.yaml'),{schema:'work/evidence@1',id:'missing',nodeId:'unrelated',inputDigest:'0'.repeat(64),outcome:'pass',assertions:[{id:'unrelated-check',outcome:'pass',observation:'Historical stale synthetic review'}],assets:[]});
  assert.equal(validateWorkspace(f.root).ok,false);assert.equal(validBackendRun(f.run),true);assert.doesNotThrow(()=>consumer(f.run));
 });
 test(mode+' stale saved history remains inspectable but cannot qualify for frontend',t=>{
  const f=backend(t,mode);saveRun(f.run);fs.appendFileSync(path.join(f.dir,'proof-0.log'),' drift');
  const loaded=loadPlanRuns(f.plan,f.root)['job-0'];assert.equal(loaded.resultDigest,f.run.resultDigest);assert.equal(validBackendRun(loaded),false);assert.throws(()=>consumer(loaded));
 });
 test(mode+' reopened referenced design cannot qualify despite unchanged semantic hashes',t=>{
  const f=backend(t,mode,{upstream:true,referenceInput:true});assert.equal(validBackendRun(f.run),true);
  edit(f,'upstream/index.yaml',v=>{v.state='todo';delete v.completion;});
  assert.equal(validBackendRun(f.run),false);assert.throws(()=>consumer(f.run));
 });
}

function aggregateInput(f,{explicitOptional=false,requiredDone=true}={}){
 f.put(path.join(f.root,'design/index.yaml'),{schema:'work/node@2',id:'design',kind:'operations',required:true,description:'Synthetic aggregate design'});
 f.put(path.join(f.root,'design/required/index.yaml'),{schema:'work/node@2',id:'required-design',kind:'operations',required:true,state:requiredDone?'done':'todo',assertions:['check'],description:'Required reviewed design'});
 f.put(path.join(f.root,'design/optional/index.yaml'),{schema:'work/node@2',id:'optional-design',kind:'operations',required:false,state:'todo',assertions:['check'],description:'Optional future design'});
 edit(f,'piece-0/index.yaml',v=>{v.dependsOn=['design'];if(explicitOptional)v.refs=['optional-design'];});
 if(requiredDone){
  const n=validateWorkspace(f.root).nodes.find(n=>n.id==='required-design');
  f.put(path.join(f.root,'design/required/evidence/check/manifest.yaml'),{schema:'work/evidence@1',id:'required-proof',nodeId:n.id,inputDigest:n.inputDigest,outcome:'pass',assertions:[{id:'check',outcome:'pass',observation:'Synthetic required design reviewed'}],assets:[]});
  edit(f,'design/required/index.yaml',v=>v.completion={inputDigest:n.inputDigest,evidence:['required-proof']});
 }
}
for(const mode of ['manual','auto','delegated']){
 test(mode+' complete required aggregate does not force optional future design done',t=>{
  const f=backend(t,mode,{beforeApprove:aggregateInput});assert.equal(validBackendRun(f.run),true);assert.doesNotThrow(()=>consumer(f.run));
  edit(f,'design/optional/index.yaml',v=>v.description+=' semantic revision');assert.equal(validBackendRun(f.run),false);
 });
 test(mode+' completed backend tolerates recoverable optional aggregate review without hiding it',t=>{
  const f=backend(t,mode,{done:true,beforeApprove:f=>{
   aggregateInput(f);
   edit(f,'design/optional/index.yaml',v=>{v.state='done';v.completion={inputDigest:'0'.repeat(64),evidence:['optional-old']};});
   f.put(path.join(f.root,'design/optional/evidence/check/manifest.yaml'),{schema:'work/evidence@1',id:'optional-old',nodeId:'optional-design',inputDigest:'0'.repeat(64),outcome:'pass',assertions:[{id:'check',outcome:'pass',observation:'Stale optional check'}],assets:[]});
  }});
  assert.equal(validateWorkspace(f.root).ok,false);assert.equal(validBackendRun(f.run),true);assert.doesNotThrow(()=>consumer(f.run));
 });
 test(mode+' explicitly consumed optional design must be current',t=>{
  assert.throws(()=>backend(t,mode,{beforeApprove:f=>aggregateInput(f,{explicitOptional:true})}),/Backend producer|eligible/);
 });
 test(mode+' unfinished required aggregate child still blocks backend',t=>{
  assert.throws(()=>backend(t,mode,{beforeApprove:f=>aggregateInput(f,{requiredDone:false})}),/Backend producer|eligible/);
 });
}
test('producer verification loads in different entry orders and a relocated runtime',t=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-handoff-import-'));
 t.after(()=>{assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-handoff-import-'));fs.rmSync(dir,{recursive:true,force:true});});
 const sourceRoot=new URL('../',import.meta.url);
 for(const name of ['workflows','profiles','scripts','core','schemas','specifications','contracts','.dist','SKILL.md'])fs.cpSync(new URL(name,sourceRoot),path.join(dir,name),{recursive:true});
 for(const order of [['producer-verification','select','lifecycle'],['lifecycle','auto','delegation','select'],['select','delegation','producer-verification']]){
  const script=order.map(name=>'await import('+JSON.stringify(new URL('./workflows/'+name+'.mjs','file:///'+dir.replaceAll('\\','/')+'/').href)+');').join('');
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8',timeout:15000});assert.equal(result.status,0,result.stderr||result.error?.message);
 }
});
test('manual result receipt cannot substitute original request or goal approval',t=>{
 const f=backend(t,'manual');
 for(const messageId of [f.run.goal.requestId,f.run.presentation.messageId,'synthetic-user-goal']){
  const run=structuredClone(f.run);run.approvals.at(-1).messageId=messageId;assert.equal(validBackendRun(run),false);
 }
});
test('automatic producer cannot fall back to direct-shaped receipt',t=>{
 const f=backend(t,'auto');f.run.automatic.authorization.receipt.approved=false;
 f.run.approvals.push({actor:'user',phase:'acceptance',approved:true,digest:f.run.resultDigest,messageId:'synthetic-fallback',quote:'Synthetic'});
 assert.equal(validBackendRun(f.run),false);assert.equal(hasAutoAcceptance(f.run),false);
});
test('malformed delegated authority cannot fall back to direct-shaped receipt',t=>{
 const f=backend(t,'delegated');
 f.run.delegated.reference.digest='0'.repeat(64);
 f.run.approvals.push({actor:'user',phase:'acceptance',approved:true,digest:f.run.resultDigest,messageId:'synthetic-fallback',quote:'Synthetic'});
 assert.equal(validBackendRun(f.run),false);assert.equal(hasDelegatedAcceptance(f.run),false);
});
test('revocation preserves a current historical result but blocks a new delegated dispatch',t=>{
 const f=backend(t,'delegated');
 revokeScopedMandate(f.plan,f.reference,{source:source('user','coordinator','Synthetic revocation')});
 assert.equal(validBackendRun(f.run),true);assert.doesNotThrow(()=>consumer(f.run));
 assert.throws(()=>f.approve(f.reference),/revoked/);
});
test('direct result acceptance and completion preflight recheck actual current artifact bytes',t=>{
 const f=backend(t,'manual');fs.appendFileSync(path.join(f.dir,'proof-0.log'),' drift');
 assert.throws(()=>acceptDelivery(f.pending,{actor:'user',phase:'acceptance',approved:true,digest:f.pending.resultDigest,messageId:'synthetic-later-result',quote:'Synthetic check'}),/evidence/);
 assert.throws(()=>markWorkDone(f.run,{}),/evidence/);
});

function frontend(t,mode){
 const f=backend(t,mode,{done:true}),ids=['drawing','frontend','uat'],steps=['draw','implement','uat'];
 for(const id of ids)f.put(path.join(f.root,id,'index.yaml'),{schema:'work/node@2',id,kind:'operations',state:'todo',required:true,assertions:['check'],description:'Synthetic frontend '+id,dependsOn:['piece-0']});
 const plan=structuredClone(f.plan);plan.id='synthetic-frontend';plan.completionCriteria=[{id:'terminal',outcome:'Three synthetic frontend stages verified',workflowIds:['front']}];
 for(const area of ['business','architecture','implementation','backend','frontend','uat'])plan[area]={action:'not-applicable',outcome:'Synthetic transport only',targets:[],workflowIds:[],evidence:[],reason:'Not product delivery'};
 plan.frontend={action:'change',outcome:'Synthetic visual chain',targets:ids,workflowIds:['front'],evidence:[],reason:''};
 const effects=[{target:'test:front',operation:'run-tests',postcondition:'Synthetic frontend stages pass'}];
 plan.workflows=[{id:'front',workflow:'implement-frontend',selection:{requestQuote:plan.originalRequest,codeChange:true,verification:'browser-uat',separateDeliverable:false},purpose:'Synthetic dependent frontend',input:'Current backend producer',output:'Synthetic three-stage result',criteria:['check'],workTargets:ids,paths:[],resources:['test:front'],dependsOn:[],openQuestions:[],estimate:{minMinutes:1,maxMinutes:3,assumptions:'Synthetic'},...(mode==='auto'?{auto:{environment:'isolated-test',business:['synthetic'],resourceEffects:effects}}:{})}];
 const goal={...f.goal(),id:'front-goal',workflow:'implement-frontend',finalOutcome:'Synthetic frontend result',scope:{business:['synthetic'],paths:[],resources:['test:front'],exclusions:plan.exclusions},criteria:['check'],resourceEffects:effects,inputs:{request:'Synthetic FE',requiresBackend:true,acceptedBackendRun:f.run},workTargets:ids,cells:steps.map((id,i)=>({id,op:['interface.draw','interface.implement','uat.verify'][i],purpose:'Synthetic '+id,finalOutput:'Checked '+id,criteria:['check'],workTargets:[ids[i]],inputs:i?{prior:{from:'cell',cell:steps[i-1],key:'result'}}:{request:{from:'request',key:'request'}},outputSchema:{type:'object',properties:{result:{type:'string'}},required:['result'],additionalProperties:false}}))};
 let run=propose(goal,{workRoot:f.root,repositories:{repo:f.dir}});
 if(mode==='delegated'){
  const reference=registerScopedMandate(plan,{...f.options,id:'front-grant',jobs:[{id:'front',environment:'isolated-test',business:['synthetic'],resourceEffects:effects.map(e=>({...e,category:'isolated-test'}))}]});
  run=presentDelegatedGoal(run,{scope:plan,jobId:'front',reference,provenance:source('assistant','worker','Synthetic frontend brief')});
  run=authorizeDelegatedGoal(run,{reference,assessment:f.assessment(run,'goal'),source:f.review});
 }else{
  run=presentGoal(run,{messageId:'synthetic-front-presentation',scope:plan,jobId:'front'});
  if(mode==='manual')run=approveGoal(run,{actor:'user',phase:'goal',approved:true,digest:run.goalDigest,messageId:'synthetic-front-goal',replyTo:run.presentation.messageId,quote:'Synthetic frontend goal approval'});
  else{
   const p=presentAutoPlan(plan,{messageId:'synthetic-front-auto-presentation',workRoot:f.root,repositories:{repo:f.dir}});
   const authorization=approveAutoPlan(plan,p,{actor:'user',phase:'plan-auto',approved:true,digest:p.digest,messageId:'synthetic-front-auto',replyTo:p.messageId,quote:'Synthetic frontend auto approval'});
   run=authorizeAutoGoal(run,{authorization,assessment:{risk:'low',environment:'isolated-test',reversible:true,reason:'Disposable frontend fixture',evidence:['Synthetic inspection'],hazards:[]}});
  }
 }
 const issue=(run,id)=>requestCell(run,id,mode==='delegated'?{coordinatorThreadId:'coordinator',taskThreadId:'worker',assessment:f.assessment(run,id)}:undefined);
 const response=request=>{const file='front-'+request.cell+'.log';fs.writeFileSync(path.join(f.dir,file),'Synthetic frontend '+request.cell);return {cell:request.cell,op:request.op,operation:request.operation,goalDigest:request.goalDigest,scopeDigest:request.scopeDigest,requestDigest:workflowDigest(request),status:'pass',criteria:[{id:'check',status:'pass',observation:'Synthetic '+request.cell+' checked',evidence:['log']}],outputs:{result:request.cell},artifacts:[{id:'log',path:file,sha256:sha256(fs.readFileSync(path.join(f.dir,file)))}]};};
 const advance=(run,id)=>{const issued=issue(run,id);return acceptCell(issued.run,response(issued.request),{evidenceRoot:f.dir});};
 const accept=run=>mode==='manual'?acceptDelivery(run,{actor:'user',phase:'acceptance',approved:true,digest:run.resultDigest,messageId:'synthetic-front-result',quote:'Synthetic frontend result approval'}):mode==='auto'?acceptAutoDelivery(run):acceptDelegatedDelivery(run,{source:f.review,assessment:f.assessment(run,'acceptance')});
 const completions=()=>Object.fromEntries(ids.map(id=>{const n=validateWorkspace(f.root).nodes.find(n=>n.id===id),proof='front-'+id;f.put(path.join(f.root,id,'evidence/check/manifest.yaml'),{schema:'work/evidence@1',id:proof,nodeId:id,inputDigest:n.inputDigest,outcome:'pass',assertions:[{id:'check',outcome:'pass',observation:'Synthetic frontend proof'}],assets:[]});return [id,{inputDigest:n.inputDigest,evidence:[proof]}];}));
 const corrupt=()=>fs.appendFileSync(path.join(f.dir,'proof-0.log'),' Backend proof drift');
 return {...f,frontRun:run,frontPlan:plan,issue,response,advance,accept,completions,corrupt};
}
for(const mode of ['manual','auto','delegated']){
 test(mode+' unchanged embedded backend supports full frontend lifecycle',t=>{
  const f=frontend(t,mode);let run=f.frontRun;for(const id of ['draw','implement','uat'])run=f.advance(run,id);
  run=f.accept(run);run=markWorkDone(run,f.completions());assert.equal(run.status,'done');assert.equal(verifyProducerResult(run),true);
 });
 for(const [stage,completed]of [['after draw',['draw']],['after implement',['draw','implement']]])test(mode+' rechecks embedded backend before next frontend effect '+stage,t=>{
  const f=frontend(t,mode);let run=f.frontRun;for(const id of completed)run=f.advance(run,id);f.corrupt();
  assert.equal(validBackendRun(run.goal.inputs.acceptedBackendRun),false);assert.throws(()=>f.issue(run,completed.length===1?'implement':'uat'),/backend producer/);
 });
 test(mode+' rechecks embedded backend when accepting an issued frontend cell',t=>{
  const f=frontend(t,mode),run=f.advance(f.frontRun,'draw'),issued=f.issue(run,'implement'),response=f.response(issued.request);f.corrupt();
  assert.throws(()=>acceptCell(issued.run,response,{evidenceRoot:f.dir}),/backend producer/);
 });
 test(mode+' rechecks embedded backend at frontend result acceptance',t=>{
  const f=frontend(t,mode);let run=f.frontRun;for(const id of ['draw','implement','uat'])run=f.advance(run,id);f.corrupt();assert.throws(()=>f.accept(run),/backend producer/);
 });
 test(mode+' rechecks embedded backend at frontend completion and downstream consumption',t=>{
  const f=frontend(t,mode);let run=f.frontRun;for(const id of ['draw','implement','uat'])run=f.advance(run,id);run=f.accept(run);const completions=f.completions();f.corrupt();
  assert.throws(()=>markWorkDone(run,completions),/backend producer/);
  assert.throws(()=>verifyProducerResult(run),/backend producer/);
  assert.equal(mode==='manual'?hasDirectProducerAcceptance(run):mode==='auto'?hasAutoAcceptance(run):hasDelegatedAcceptance(run),false);
 });
 test(mode+' completed frontend rechecks embedded backend but stale history remains loadable',t=>{
  const f=frontend(t,mode);let run=f.frontRun;for(const id of ['draw','implement','uat'])run=f.advance(run,id);run=markWorkDone(f.accept(run),f.completions());saveRun(run);f.corrupt();
  const loaded=loadPlanRuns(f.frontPlan,f.root).front;assert.equal(loaded.resultDigest,run.resultDigest);assert.throws(()=>verifyProducerResult(loaded),/backend producer/);
 });
}
