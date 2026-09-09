import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {validateWorkspace,sha256} from '../core/index.mjs';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {documentSDS} from '../fixtures/sds.mjs';
import {propose,presentGoal,approveGoal,presentDelegatedGoal,authorizeDelegatedGoal,authorizeAutoGoal,requestCell,acceptCell,acceptDelivery,acceptAutoDelivery,acceptDelegatedDelivery,preflightCompletion,markWorkDone,workflowDigest,saveRun,loadPlanRuns} from '../workflows/lifecycle.mjs';
import {registerScopedMandate,delegatedContext,hasDelegatedAcceptance} from '../workflows/delegation.mjs';
import {presentAutoPlan,approveAutoPlan,verifyAutoEvidence,verifyAutoPredecessors} from '../workflows/auto.mjs';
import {verifyRunWork} from '../workflows/work-binding.mjs';

// All authority/proof below is an isolated synthetic fixture, never product acceptance.
function fixture(t,{mode='manual',legacy=false,ui=false}={}){
 const workflow=ui?'design-interface':'design-architecture',op=ui?'interface.draw':'architecture.decide';
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-authored-')),root=path.join(dir,'.starciwork');
 fs.cpSync(new URL('../examples/nested-business/',import.meta.url),root,{recursive:true});
 t.after(()=>{assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-authored-'));fs.rmSync(dir,{recursive:true,force:true});});
 const read=p=>parseYaml(fs.readFileSync(path.join(root,p),'utf8')),put=(p,x)=>{const f=path.join(root,p);fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,stringifyYaml(x));};
 const review=()=>({schema:'starci/design-review@1',reviewer:'Synthetic reviewer',authority:'Synthetic fixture authority only',reviewedAt:'2026-09-09T00:00:00Z',observations:[{id:'scope-reviewed',outcome:'pass',observation:'Synthetic substantive review fixture, no real design accepted'}],limitations:['Fixture only']});
 const completion=p=>({inputDigest:validateWorkspace(root).nodes.find(n=>n.id===read(p).id).inputDigest,review:review()});
 const complete=p=>put(p,{...read(p),state:'done',completion:completion(p)});
 const overview='knowledge/business/overview/index.yaml',srs='knowledge/business/srs/documents/update/index.yaml';
 for(const p of [overview,srs]){const n=read(p);n.state='todo';n.assertions=['scope-reviewed'];if(n.extensions?.work3?.specification){const s=n.extensions.work3.specification;s.status='pass';for(const r of s.requirements)r.authority='accepted';for(const source of s.sources)source.kind='accepted-intent';for(const d of s.decisions){d.status='accepted';d.blocking=false;}}put(p,n);complete(p);}
 put('knowledge/architecture/index.yaml',{schema:'work/node@2',id:'example.architecture',kind:'architecture',required:true,description:'Synthetic owner',dependsOn:['example.business.srs']});
 put('knowledge/architecture/overview/index.yaml',{schema:'work/node@2',id:'example.architecture.overview',kind:'architecture',required:true,state:'todo',description:'Synthetic readable design'});
 if(!ui)put('knowledge/architecture/sds/index.yaml',{schema:'work/node@2',id:'example.sds',kind:'architecture',required:true,description:'Synthetic design collection'});
 const files=ui?['knowledge/ui/desktop/index.yaml','knowledge/ui/mobile/index.yaml']:['knowledge/architecture/sds/contracts/index.yaml','knowledge/architecture/sds/runtime/index.yaml'],ids=['example.contracts','example.runtime'];
 for(const [i,p]of files.entries()){const spec=documentSDS();spec.status='pass';for(const d of spec.decisions){d.status='accepted';d.blocking=false;}put(p,{schema:'work/node@2',id:ids[i],kind:ui?'ui':'architecture',required:true,state:'todo',description:'Synthetic initial design',assertions:['scope-reviewed'],refs:i?[ids[0]]:[],...(!ui?{extensions:{work3:{specification:spec}}}:{})});}
 fs.writeFileSync(path.join(dir,'review.log'),'Synthetic review artifact');
 const effects=files.map(p=>({target:path.join(root,p),operation:'revise-owned-design',postcondition:'Only selected design leaves reviewed'}));
 const plan={schema:'starci/plan@2',mode:mode==='auto'?'auto':'manual',id:'authored',requestId:'synthetic-original',originalRequest:'Synthetic request to revise two bounded design leaves',finalOutcome:'Current reviewed designs',openQuestions:[],exclusions:['production'],completionCriteria:[{id:'terminal',outcome:'Both designs current',workflowIds:['design']}],workflows:[{id:'design',workflow,selection:{requestQuote:'Synthetic request to revise two bounded design leaves',codeChange:false,verification:'unit-component',separateDeliverable:false},purpose:'Revise two selected designs',input:'Accepted synthetic intent',output:'Reviewed canonical designs',criteria:['scope-reviewed'],workTargets:ids,paths:[],resources:effects.map(e=>e.target),dependsOn:[],openQuestions:[],estimate:{minMinutes:1,maxMinutes:3,assumptions:'Synthetic'}}]};
 for(const area of ['business','architecture','implementation','backend','frontend','uat'])plan[area]={action:'not-applicable',outcome:'Synthetic test only',targets:[],workflowIds:[],evidence:[],reason:'No product delivery'};
 plan.architecture={action:'change',outcome:plan.finalOutcome,targets:ids,workflowIds:['design'],evidence:[],reason:''};
 if(mode==='auto'){plan.auto={maxMinutes:30,acceptance:'verified-criteria'};plan.workflows[0].auto={environment:'local',business:['synthetic'],resourceEffects:effects};}
 const goal={schema:'starci/goal@1',id:'design',workflow,requestId:plan.requestId,originalRequest:plan.originalRequest,finalOutcome:plan.finalOutcome,scope:{business:['synthetic'],paths:[],resources:effects.map(e=>e.target),exclusions:plan.exclusions},criteria:['scope-reviewed'],businessChanges:['No policy change'],impacts:[],resourceEffects:effects,inputs:{request:'Synthetic accepted intent'},workTargets:ids,cells:[{id:workflow,op,purpose:'Author selected designs',finalOutput:'Reviewed SDS',criteria:['scope-reviewed'],inputs:{request:{from:'request',key:'request'}},outputSchema:{type:'object',properties:{architectureSpec:{type:'array',items:{type:'string'}}},required:['architectureSpec'],additionalProperties:false},...(!legacy?{workPolicy:{schema:'starci/authored-work@1',targets:ids}}:{})}]};
 const source=actor=>({actor,threadId:'coordinator',messageId:null,messageIdAvailability:'not-exposed',quote:'Synthetic actual-context fixture',assurance:'conversation-context-not-authenticated'});
 const risk=(run,stage)=>({stage,contextDigest:delegatedContext(run),risk:'low',environment:'local',reversible:true,reason:'Disposable synthetic fixture',observations:['Exact fixture inspected'],hazards:[]});
 const approve=()=>{let run=propose(goal,{workRoot:root,repositories:{repo:dir}});if(mode==='delegated'){const ref=registerScopedMandate(plan,{id:'synthetic',source:source('user'),coordinatorThreadId:'coordinator',taskThreadId:'coordinator',workRoot:root,repositories:{repo:dir},jobs:[{id:'design',environment:'local',business:['synthetic'],resourceEffects:effects.map(e=>({...e,category:'work-record'}))}],review:source('assistant')});run=presentDelegatedGoal(run,{scope:plan,jobId:'design',reference:ref,provenance:source('assistant')});return authorizeDelegatedGoal(run,{reference:ref,assessment:risk(run,'goal'),source:source('assistant')});}run=presentGoal(run,{messageId:'actual-synthetic-presentation',scope:plan,jobId:'design'});if(mode==='auto'){const p=presentAutoPlan(plan,{messageId:'synthetic-auto-presentation',workRoot:root,repositories:{repo:dir}}),authorization=approveAutoPlan(plan,p,{actor:'user',phase:'plan-auto',approved:true,digest:p.digest,replyTo:p.messageId,messageId:'synthetic-auto-answer',quote:'Synthetic explicit auto delegation'});return authorizeAutoGoal(run,{authorization,assessment:{risk:'low',environment:'local',reversible:true,reason:'Synthetic local scope',evidence:['Fixture'],hazards:[]}});}return approveGoal(run,{actor:'user',phase:'goal',approved:true,digest:run.goalDigest,replyTo:run.presentation.messageId,messageId:'synthetic-goal-answer',quote:'Synthetic explicit goal approval'});};
 const issue=run=>requestCell(run,workflow,mode==='delegated'?{coordinatorThreadId:'coordinator',taskThreadId:'coordinator',assessment:risk(run,workflow)}:undefined);
 const response=issued=>{const r=issued.request;return {cell:r.cell,op:r.op,operation:r.operation,requestDigest:workflowDigest(r),goalDigest:r.goalDigest,scopeDigest:r.scopeDigest,status:'pass',outputs:{architectureSpec:files},criteria:[{id:'scope-reviewed',status:'pass',observation:'Actual synthetic review performed',evidence:['review']}],artifacts:[{id:'review',path:'review.log',sha256:sha256(fs.readFileSync(path.join(dir,'review.log')))}]};};
 const result=issued=>acceptCell(issued.run,response(issued),{evidenceRoot:dir});
 const accept=run=>mode==='delegated'?acceptDelegatedDelivery(run,{source:source('assistant'),assessment:risk(run,'acceptance')}):mode==='auto'?acceptAutoDelivery(run):acceptDelivery(run,{actor:'user',phase:'acceptance',digest:run.resultDigest,approved:true,messageId:'synthetic-accept-answer',quote:'Synthetic actual review accepts result'});
 const completions=()=>Object.fromEntries(files.map((p,i)=>[ids[i],completion(p)]));
 const edit=(p=files[0])=>put(p,{...read(p),description:read(p).description+' Reviewed bounded elaboration.'});
 assert.equal(validateWorkspace(root).ok,true,JSON.stringify(validateWorkspace(root).errors));
 return {dir,root,workflow,read,put,overview,srs,files,ids,plan,goal,complete,completion,approve,issue,response,result,accept,completions,edit};
}

for(const mode of ['manual','auto','delegated'])test(`${mode}: author two exact SDS leaves, seal output, complete and preserve request through save/load`,t=>{
 const f=fixture(t,{mode}),issued=f.issue(f.approve()),before=structuredClone(issued.request);f.edit();f.edit(f.files[1]);const result=f.result(issued);
 assert.deepEqual(result.requests['design-architecture'],before);assert.equal(before.schema,'starci/cell-request@2');assert.notDeepEqual(result.responses['design-architecture'].workResult.bindings,before.workBindings);
 assert.equal(preflightCompletion(result,f.completions()).ok,true);const done=markWorkDone(f.accept(result),f.completions());assert.equal(done.status,'done');verifyAutoEvidence(done);
 saveRun(done);const loaded=loadPlanRuns(f.plan,f.root).design;assert.deepEqual(loaded.responses,done.responses);assert.deepEqual(loaded.requests,done.requests);verifyRunWork(loaded);
 f.edit();const stale=loadPlanRuns(f.plan,f.root).design;assert.throws(()=>verifyRunWork(stale),/changed/);if(mode==='delegated')assert.equal(hasDelegatedAcceptance(stale),false);
});

test('legacy requests remain strict and cannot receive retroactive authored fields',t=>{
 const f=fixture(t,{legacy:true}),issued=f.issue(f.approve());f.edit();assert.throws(()=>f.result(issued),/changed after dispatch/);
 const g=fixture(t),i=g.issue(g.approve()),r=g.response(i);r.workResult={schema:'starci/authored-result@1'};assert.throws(()=>acceptCell(i.run,r,{evidenceRoot:g.dir}),/Only the runtime/);
});

test('immutable upstream, ancestor and unselected reference edits reject output even when still schema-valid',t=>{
 for(const scenario of ['srs','ancestor','reference']){const f=fixture(t);if(scenario==='reference'){const p='knowledge/architecture/sds/foundation/index.yaml';f.put(p,{...f.read(f.files[0]),id:'example.foundation'});f.complete(p);f.put(f.files[0],{...f.read(f.files[0]),refs:['example.foundation']});}
 const issued=f.issue(f.approve());f.edit();if(scenario==='srs')f.edit(f.srs);else if(scenario==='ancestor')f.edit('knowledge/architecture/index.yaml');else f.edit('knowledge/architecture/sds/foundation/index.yaml');assert.throws(()=>f.result(issued),/immutable/);}
});

test('target graph, assertions, kind and identity cannot drift under authored permission',t=>{
 for(const change of [n=>n.refs=['example.business.overview'],n=>n.dependsOn=['example.business.overview'],n=>n.assertions=[],n=>n.required=false,n=>n.id='changed',n=>n.kind='business']){const f=fixture(t),issued=f.issue(f.approve()),n=f.read(f.files[0]);change(n);f.put(f.files[0],n);assert.throws(()=>f.result(issued));}
});

test('authored permissions require exact leaf ceilings and supported operators before dispatch',t=>{
 const f=fixture(t);f.goal.resourceEffects=f.goal.resourceEffects.slice(1);assert.throws(()=>f.issue(f.approve()),/exact approved write ceiling/);
 const g=fixture(t);g.goal.cells[0].workPolicy.targets=[...g.ids,'example.business.overview'];assert.throws(()=>g.approve());
});

test('post-result and post-acceptance edits invalidate all advancement, not just output artifacts',t=>{
 for(const afterAcceptance of [false,true]){const f=fixture(t),issued=f.issue(f.approve());f.edit();let run=f.result(issued);if(afterAcceptance)run=f.accept(run);f.edit();assert.throws(()=>preflightCompletion(run,f.completions()),/changed/);assert.throws(()=>afterAcceptance?markWorkDone(run,f.completions()):f.accept(run),/changed/);assert.throws(()=>verifyAutoEvidence(run),/changed/);}
});

test('downstream stale completion remains visible but cannot prevent exact upstream repair',t=>{
 const f=fixture(t);f.files.forEach(f.complete);const p='knowledge/architecture/sds/consumer/index.yaml';f.put(p,{...f.read(f.files[0]),id:'example.consumer',refs:[f.ids[0]],state:'todo'});const n=f.read(p);delete n.completion;f.put(p,n);f.complete(p);
 const issued=f.issue(f.approve());for(const p of f.files){const n=f.read(p);delete n.completion;n.state='todo';f.put(p,n);f.edit(p);}const result=f.result(issued),preview=preflightCompletion(result,f.completions());assert.equal(preview.ok,true);assert.equal(preview.globalOk,false);assert.ok(preview.remainingErrors.length);
 const before=fs.readFileSync(path.join(f.root,p),'utf8'),done=markWorkDone(f.accept(result),f.completions());assert.equal(done.status,'done');assert.equal(validateWorkspace(f.root).ok,false);assert.equal(fs.readFileSync(path.join(f.root,p),'utf8'),before);
 verifyAutoPredecessors({presentation:{scope:f.plan,scopeDigest:done.presentation.scopeDigest},workRoot:f.root,repositories:done.repositories},{design:done},{throughEnd:true});
});

test('unselected stale intermediary cannot be hidden by target masking or fresh todo eligibility',t=>{
 const f=fixture(t);f.complete(f.files[0]);const p='knowledge/architecture/sds/intermediary/index.yaml',n={...f.read(f.files[0]),id:'example.intermediary',refs:[f.ids[0]],state:'todo'};delete n.completion;f.put(p,n);f.complete(p);f.put(f.files[1],{...f.read(f.files[1]),refs:['example.intermediary']});
 const issued=f.issue(f.approve());const target=f.read(f.files[0]);delete target.completion;target.state='todo';f.put(f.files[0],target);f.edit();assert.equal(validateWorkspace(f.root).nodes.find(n=>n.id==='example.intermediary').effectiveState,'uninvestigate');assert.throws(()=>f.result(issued),/prerequisite/);
});

test('missing review assertions and structural unrelated faults cannot become completion',t=>{
 const f=fixture(t),result=f.result(f.issue(f.approve())),proof=f.completions();proof[f.ids[0]].review.observations=[];assert.equal(preflightCompletion(result,proof).ok,false);assert.throws(()=>markWorkDone(f.accept(result),proof),/preflight/);
 const g=fixture(t),i=g.issue(g.approve());g.put('invalid/index.yaml',{schema:'work/node@2',id:'invalid',kind:'operations',state:'todo',required:true,unexpected:'bad'});assert.throws(()=>g.result(i),/invalid/);
});

test('missing or tampered seals cannot be accepted, while operational activity does not alter semantic output',t=>{
 const f=fixture(t),result=f.result(f.issue(f.approve()));f.put(f.files[0],{...f.read(f.files[0]),activity:'verifying'});verifyRunWork(result);
 const tampered=structuredClone(result);delete tampered.responses['design-architecture'].workResult;tampered.resultDigest=workflowDigest({goalDigest:tampered.goalDigest,responses:tampered.responses});assert.throws(()=>f.accept(tampered),/sealed/);
});

test('interface.draw creates exact predeclared new assets and seals actual image bytes without fake UI completion',t=>{
 const f=fixture(t,{ui:true}),asset='assets/desktop.png',absolute=path.join(f.root,path.dirname(f.files[0]),asset);
 f.goal.cells[0].workPolicy.assetWrites=[{nodeId:f.ids[0],path:asset}];const effect={target:absolute,operation:'create-selected-drawing',postcondition:'Actual reviewed synthetic drawing'};f.goal.resourceEffects.push(effect);f.goal.scope.resources.push(absolute);f.plan.workflows[0].resources=f.goal.scope.resources;
 assert.equal(fs.existsSync(absolute),false);const issued=f.issue(f.approve());fs.mkdirSync(path.dirname(absolute),{recursive:true});fs.writeFileSync(absolute,Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+j6X8AAAAASUVORK5CYII=','base64'));f.put(f.files[0],{...f.read(f.files[0]),assets:[{path:asset}]});
 const result=f.result(issued);assert.ok(result.responses[f.workflow].workResult);verifyRunWork(f.accept(result));assert.equal(preflightCompletion(result,f.completions()).ok,false,'SDS review cannot stand in for actual UI completion proof');
 fs.appendFileSync(absolute,'changed');assert.throws(()=>verifyRunWork(result),/changed/);
});

test('undeclared asset creation and changed non-writable asset bytes reject authoring',t=>{
 for(const existed of [false,true]){const f=fixture(t),asset='assets/reference.txt',absolute=path.join(f.root,path.dirname(f.files[0]),asset);fs.mkdirSync(path.dirname(absolute),{recursive:true});if(existed){fs.writeFileSync(absolute,'synthetic original');f.put(f.files[0],{...f.read(f.files[0]),assets:[{path:asset}]});}const issued=f.issue(f.approve());fs.writeFileSync(absolute,'synthetic changed');f.put(f.files[0],{...f.read(f.files[0]),assets:[{path:asset}]});assert.throws(()=>f.result(issued),/immutable/);}
});

for(const mode of ['manual','auto'])test(`${mode}: frontend successor rechecks both sealed draw content and artifacts before new effects`,t=>{
 for(const drift of ['none','work','artifact']){
  const f=fixture(t,{mode,ui:true}),draw=f.goal.cells[0];draw.id='draw';draw.workTargets=[...f.ids];draw.workPolicy.targets=[...f.ids];draw.outputSchema={type:'object',properties:{draws:{type:'array',items:{type:'string'}}},required:['draws'],additionalProperties:false};
  f.put('fe/index.yaml',{schema:'work/node@2',id:'fe',kind:'implementation',required:true,state:'todo',description:'Synthetic frontend scope',dependsOn:[...f.ids]});f.put('uat/index.yaml',{schema:'work/node@2',id:'uat',kind:'uat',required:true,state:'todo',description:'Synthetic browser scope',dependsOn:['fe']});
  const cell=(id,op,prior,key)=>({id,op,workTargets:[id==='implement'?'fe':'uat'],purpose:'Bounded synthetic next stage',finalOutput:'Synthetic next result',criteria:[id+'-pass'],inputs:{prior:{from:'cell',cell:prior,key}},outputSchema:{type:'object',properties:{result:{type:'string'}},required:['result'],additionalProperties:false}});
  f.goal.cells.push(cell('implement','interface.implement','draw','draws'),cell('uat','uat.verify','implement','result'));f.goal.workflow='implement-frontend';f.goal.workTargets=[...f.ids,'fe','uat'];f.goal.criteria=['scope-reviewed','implement-pass','uat-pass'];f.goal.inputs.requiresBackend=false;
  const job=f.plan.workflows[0];job.workflow=f.goal.workflow;job.workTargets=f.goal.workTargets;job.criteria=f.goal.criteria;job.selection.codeChange=true;job.selection.verification='browser-uat';f.plan.frontend={action:'change',outcome:'Synthetic visual chain',targets:['fe'],workflowIds:['design'],evidence:[],reason:''};
  const issued=requestCell(f.approve(),'draw');f.edit();const response=f.response(issued);response.outputs={draws:f.files};const result=acceptCell(issued.run,response,{evidenceRoot:f.dir});
  if(drift==='work')f.edit();if(drift==='artifact')fs.appendFileSync(path.join(f.dir,'review.log'),'changed');
  if(drift==='none'){const next=requestCell(result,'implement');assert.equal(next.run.status,'running');assert.deepEqual(next.request.inputs.prior,f.files);}else assert.throws(()=>requestCell(result,'implement'),/changed|stale/);
 }
});
