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
import {verifyProducerResult,verifyProducerCells} from '../workflows/producer-verification.mjs';
import {hasDirectProducerAcceptance} from '../workflows/producer-verification.mjs';

const catalog=JSON.parse(fs.readFileSync(new URL('../workflows/catalog.json',import.meta.url)));
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
function frontend(t,mode,{sibling=false,optional=false,optionalRef=false,uninvestigatedDraw=false,reverseCells=false}={}){
 const f=backend(t,mode,{done:true}),ids=['drawing','frontend','uat'],steps=['draw','implement','uat'];
 for(const id of ids)f.put(path.join(f.root,id,'index.yaml'),{schema:'work/node@2',id,kind:'operations',state:'todo',required:true,assertions:['check'],description:'Synthetic frontend '+id,dependsOn:['piece-0']});

 fs.mkdirSync(path.join(f.root,'implementation'),{recursive:true});
 fs.renameSync(path.join(f.root,'frontend'),path.join(f.root,'implementation/frontend'));
 f.put(path.join(f.root,'implementation/index.yaml'),{schema:'work/node@2',id:'implementation-aggregate',kind:'operations',required:true,description:'Aggregate with current backend and in-run frontend',dependsOn:['piece-0']});
 edit(f,'uat/index.yaml',v=>v.dependsOn=['implementation-aggregate']);
 if(sibling)f.put(path.join(f.root,'implementation/sibling/index.yaml'),{schema:'work/node@2',id:'other-required-sibling',kind:'operations',required:!optional,state:'todo',description:'Future scope not produced in this run',assertions:['check']});
 if(optionalRef)edit(f,'uat/index.yaml',v=>v.dependsOn.push('other-required-sibling'));
 if(uninvestigatedDraw)edit(f,'drawing/index.yaml',v=>v.state='uninvestigate');
 const plan=structuredClone(f.plan);plan.id='synthetic-frontend';plan.completionCriteria=[{id:'terminal',outcome:'Three synthetic frontend stages verified',workflowIds:['front']}];
 for(const area of ['business','architecture','implementation','backend','frontend','uat'])plan[area]={action:'not-applicable',outcome:'Synthetic transport only',targets:[],workflowIds:[],evidence:[],reason:'Not product delivery'};
 plan.frontend={action:'change',outcome:'Synthetic visual chain',targets:ids,workflowIds:['front'],evidence:[],reason:''};
 const effects=[{target:'test:front',operation:'run-tests',postcondition:'Synthetic frontend stages pass'}];
 plan.workflows=[{id:'front',workflow:'implement-frontend',selection:{requestQuote:plan.originalRequest,codeChange:true,verification:'browser-uat',separateDeliverable:false},purpose:'Synthetic dependent frontend',input:'Current backend producer',output:'Synthetic three-stage result',criteria:['check'],workTargets:ids,paths:[],resources:['test:front'],dependsOn:[],openQuestions:[],estimate:{minMinutes:1,maxMinutes:3,assumptions:'Synthetic'},...(mode==='auto'?{auto:{environment:'isolated-test',business:['synthetic'],resourceEffects:effects}}:{})}];
 const goal={...f.goal(),id:'front-goal',workflow:'implement-frontend',finalOutcome:'Synthetic frontend result',scope:{business:['synthetic'],paths:[],resources:['test:front'],exclusions:plan.exclusions},criteria:['check'],resourceEffects:effects,inputs:{request:'Synthetic FE',requiresBackend:true,acceptedBackendRun:f.run},workTargets:ids,cells:steps.map((id,i)=>({id,op:['interface.draw','interface.implement','uat.verify'][i],purpose:'Synthetic '+id,finalOutput:'Checked '+id,criteria:['check'],workTargets:[ids[i]],inputs:i?{prior:{from:'cell',cell:steps[i-1],key:'result'}}:{request:{from:'request',key:'request'}},outputSchema:{type:'object',properties:{result:{type:'string'}},required:['result'],additionalProperties:false}}))};
 if(reverseCells)goal.cells.reverse();
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
 const completions=()=>Object.fromEntries(ids.map(id=>{const n=validateWorkspace(f.root).nodes.find(n=>n.id===id),proof='front-'+id;f.put(path.join(f.root,path.dirname(n.path),'evidence/check/manifest.yaml'),{schema:'work/evidence@1',id:proof,nodeId:id,inputDigest:n.inputDigest,outcome:'pass',assertions:[{id:'check',outcome:'pass',observation:'Synthetic frontend proof'}],assets:[]});return [id,{inputDigest:n.inputDigest,evidence:[proof]}];}));
 const corrupt=()=>fs.appendFileSync(path.join(f.dir,'proof-0.log'),' Backend proof drift');
 return {...f,frontRun:run,frontPlan:plan,issue,response,advance,accept,completions,corrupt};
}

test('partial producer rejects foreign replacement, missing response and forged later-only row',t=>{
 const f=frontend(t,'manual');let run=f.frontRun;for(const id of ['draw','implement','uat'])run=f.advance(run,id);
 const replaced=structuredClone(run);replaced.responses.foreign=replaced.responses.draw;delete replaced.responses.draw;
 assert.throws(()=>verifyProducerCells(replaced),/Unknown producer cell response/);
 const missing=structuredClone(run);delete missing.responses.uat;
 assert.throws(()=>verifyProducerCells(missing),/Incomplete producer result/);
 const later={...run,goal:{...run.goal,cells:run.goal.cells.filter(c=>c.id==='uat')},responses:{uat:run.responses.uat}};
 assert.throws(()=>verifyProducerCells(later),/skipped a prior row/);
});

test('matrix ordering, not goal cell array or response insertion order, governs readiness',t=>{
 const f=frontend(t,'manual',{reverseCells:true});let run=f.frontRun;for(const id of ['draw','implement','uat'])run=f.advance(run,id);
 const reordered={...run,responses:Object.fromEntries(Object.entries(run.responses).reverse())};
 assert.equal(verifyProducerCells(reordered),true);
});
for(const defect of ['unknown','cycle'])test('aggregate readiness denies '+defect+' prerequisite topology',t=>{
 const f=frontend(t,'manual');let run=f.advance(f.frontRun,'draw');run=f.advance(run,'implement');
 edit(f,'implementation/index.yaml',v=>v.dependsOn.push(defect==='unknown'?'missing-node':'uat'));
 assert.throws(()=>f.issue(run,'uat'));
});

for(const mode of ['manual','auto','delegated']){
 test(mode+' accepted draw log alone does not investigate its Work',t=>{
  const f=frontend(t,mode,{uninvestigatedDraw:true}),run=f.advance(f.frontRun,'draw');
  assert.equal(validateWorkspace(f.root).nodes.find(n=>n.id==='drawing').effectiveState,'uninvestigate');
  assert.throws(()=>f.issue(run,'implement'),/Producer prerequisite/);
 });
 test(mode+' current accepted in-run FE satisfies required aggregate without early done',t=>{
  const f=frontend(t,mode);let run=f.advance(f.frontRun,'draw');run=f.advance(run,'implement');
  const before=validateWorkspace(f.root);assert.equal(before.nodes.find(n=>n.id==='implementation-aggregate').effectiveState,'todo');assert.equal(before.nodes.find(n=>n.id==='frontend').state,'todo');
  run=f.advance(run,'uat');assert.equal(verifyProducerResult(run),true);
  assert.equal(validateWorkspace(f.root).nodes.find(n=>n.id==='frontend').state,'todo');
  run=markWorkDone(f.accept(run),f.completions());assert.equal(run.status,'done');assert.equal(verifyProducerResult(run),true);
  assert.equal(validateWorkspace(f.root).nodes.find(n=>n.id==='implementation-aggregate').effectiveState,'done');
 });
 test(mode+' an unfinished additional required sibling still blocks aggregate',t=>{
  const f=frontend(t,mode,{sibling:true});let run=f.advance(f.frontRun,'draw');run=f.advance(run,'implement');
  assert.throws(()=>f.issue(run,'uat'),/investigated, unblocked/);
 });
 test(mode+' unconsumed optional sibling does not become mandatory',t=>{
  const f=frontend(t,mode,{sibling:true,optional:true});let run=f.frontRun;for(const id of ['draw','implement','uat'])run=f.advance(run,id);
  assert.equal(verifyProducerResult(f.accept(run)),true);
 });
 test(mode+' explicit dependency on optional sibling still blocks',t=>{
  const f=frontend(t,mode,{sibling:true,optional:true,optionalRef:true});let run=f.advance(f.frontRun,'draw');run=f.advance(run,'implement');assert.throws(()=>f.issue(run,'uat'),/investigated, unblocked/);
 });
 for(const stage of ['dispatch','cell-acceptance','result-acceptance'])for(const attack of ['frontend-artifact','backend-artifact'])test(mode+' aggregate refuses stale '+attack+' at '+stage,t=>{
  const f=frontend(t,mode);let run=f.advance(f.frontRun,'draw');run=f.advance(run,'implement');
  const issued=stage==='cell-acceptance'?f.issue(run,'uat'):null;
  if(stage==='result-acceptance')run=f.advance(run,'uat');
  if(attack==='backend-artifact')f.corrupt();else fs.appendFileSync(path.join(f.dir,'front-implement.log'),' drift');
  if(stage==='dispatch')assert.throws(()=>f.issue(run,'uat'),/evidence|backend producer/);
  else if(stage==='cell-acceptance')assert.throws(()=>acceptCell(issued.run,f.response(issued.request),{evidenceRoot:f.dir}),/evidence|backend producer/);
  else assert.throws(()=>f.accept(run),/evidence|backend producer/);
 });
 for(const state of ['uninvestigate','suspended','blocked'])test(mode+' reopened or blocked prior FE cannot unlock aggregate '+state,t=>{
  const f=frontend(t,mode);let run=f.advance(f.frontRun,'draw');run=f.advance(run,'implement');edit(f,'implementation/frontend/index.yaml',v=>v.state=state);
  assert.throws(()=>f.issue(run,'uat'));
 });
 test(mode+' unexpected new required sibling after accepted FE invalidates binding',t=>{
  const f=frontend(t,mode);let run=f.advance(f.frontRun,'draw');run=f.advance(run,'implement');
  f.put(path.join(f.root,'implementation/new/index.yaml'),{schema:'work/node@2',id:'new-required',kind:'operations',required:true,state:'todo',description:'Unapproved new required scope',assertions:['check']});
  assert.throws(()=>f.issue(run,'uat'),/Producer|investigated/);
 });
}
