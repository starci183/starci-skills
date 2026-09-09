import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {sha256,validateWorkspace} from '../core/index.mjs';
import {stringifyYaml,parseYaml} from '../core/yaml.mjs';
import {registerScopedMandate,readScopedMandate,revokeScopedMandate,delegatedContext,hasDelegatedAcceptance} from '../workflows/delegation.mjs';
import {propose,presentGoal,approveGoal,presentDelegatedGoal,authorizeDelegatedGoal,requestCell,acceptCell,acceptDelivery,acceptDelegatedDelivery,markWorkDone,saveRun,loadPlanRuns,saveDelegatedCompletion,workflowDigest} from '../workflows/lifecycle.mjs';
import {validBackendRun} from '../workflows/select.mjs';

const source=(actor,threadId,quote)=>({actor,threadId,messageId:null,messageIdAvailability:'not-exposed',quote,assurance:'conversation-context-not-authenticated'});
function fixture(t,{count=2,workflow='implement-backend'}={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-delegation-'));
 t.after(()=>{assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-delegation-'));fs.rmSync(dir,{recursive:true,force:true});});
 const root=path.join(dir,'.starciwork'),put=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,stringifyYaml(x));};
 put(path.join(root,'workspace.yaml'),{schema:'work/workspace@1',id:'synthetic-delegation'});
 const criteria=['unit-tests-pass','backend-e2e-pass','api-contract-pass'];
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

test('manual scoped approval completes sequentially with honest absent native IDs, persists and closes only after terminal review',t=>{
 const f=fixture(t),reference=f.register(),runs={};
 for(let i=0;i<2;i++){runs['job-'+i]=f.finish(f.approve(reference,i,runs),i,runs);saveRun(runs['job-'+i]);assert.equal(runs['job-'+i].approvals.some(a=>a.actor==='user'),false);assert.equal(runs['job-'+i].automatic,undefined);}
 const recovered=loadPlanRuns(f.plan,f.root);assert.deepEqual(recovered['job-0'].presentation,runs['job-0'].presentation);assert.equal(hasDelegatedAcceptance(recovered['job-0']),true);
 const file=path.join(f.root,'_local/plans',f.plan.id,'run/index.yaml');assert.equal(parseYaml(fs.readFileSync(file,'utf8')).status,'awaiting-terminal-review');
 assert.throws(()=>saveDelegatedCompletion(f.plan,{reference,criteria:[],source:f.review}),/terminal/);
 const criteria=[{id:'terminal',status:'pass',observation:'All synthetic producers inspected',evidence:[0,1].map(i=>({jobId:'job-'+i,cellId:'implement-backend',criterionId:'backend-e2e-pass'}))}];
 const completion=saveDelegatedCompletion(f.plan,{reference,criteria,source:f.review});assert.equal(completion.status,'done');assert.equal(parseYaml(fs.readFileSync(file,'utf8')).status,'done');assert.equal(readScopedMandate(f.plan,reference,{active:false}).status,'completed');assert.throws(()=>f.approve(reference),/terminal/);assert.equal(validBackendRun(recovered['job-0']),true);
});

test('ordinary manual goal requires actual user reply; observer and fabricated unavailable IDs cannot grant approval',t=>{
 const f=fixture(t,{count:1}),r=propose(f.goal(),{workRoot:f.root,repositories:{repo:f.dir}});
 assert.throws(()=>presentGoal(r,{messageId:null,scope:f.plan,jobId:'job-0'}),/actual/);
 const shown=presentGoal(r,{messageId:'actual-synthetic-presentation',scope:f.plan,jobId:'job-0'});
 assert.throws(()=>approveGoal(shown,{actor:'assistant',phase:'goal',approved:true,digest:shown.goalDigest,messageId:'synthetic-reply',replyTo:shown.presentation.messageId,quote:'Approved'}),/actual/);
 f.options.source.messageId='invented-local-record-id';assert.throws(()=>f.register(),/Native/);f.options.source.messageId=null;
 f.options.review.threadId='observer';assert.throws(()=>f.register(),/coordinator/);f.options.review.threadId='coordinator';
 const reference=f.register(),run=f.shown(reference);assert.throws(()=>authorizeDelegatedGoal(run,{reference,assessment:f.assessment(run,'goal'),source:source('assistant','observer','I approve')}),/Observer/);
});

test('delegation is exact manual scope, cannot select auto, reserve effects or rewrite runtime/bootstrap',t=>{
 const f=fixture(t,{count:1});f.plan.mode='auto';assert.throws(()=>f.register());f.plan.mode='manual';
 f.plan.workflows[0].workflow='update-knowledge';assert.throws(()=>f.register());f.plan.workflows[0].workflow='implement-backend';
 f.options.jobs[0].environment='production';assert.throws(()=>f.register(),/ceiling/);f.options.jobs[0].environment='isolated-test';
 f.options.jobs[0].resourceEffects[0].category='external-payment';assert.throws(()=>f.register(),/category/);f.options.jobs[0].resourceEffects[0].category='isolated-test';
 f.plan.workflows[0].paths=['repo:AGENTS.md'];assert.throws(()=>f.register(),/bootstrap/);f.plan.workflows[0].paths=[];
 const reference=f.register();assert.throws(()=>f.register(),/already/);const run=f.shown(reference);run.goal.scope.business.push('foreign');assert.throws(()=>authorizeDelegatedGoal(run,{reference,assessment:f.assessment(run,'goal'),source:f.review}));
 f.plan.finalOutcome='Changed Plan';assert.throws(()=>readScopedMandate(f.plan,reference),/exact/);
});

test('each new stage requires designated caller, current known risk and live unrevoked authority',t=>{
 const f=fixture(t,{count:1}),reference=f.register(),run=f.approve(reference);
 assert.throws(()=>requestCell(run,'implement-backend'),/identity/);
 const check={coordinatorThreadId:'coordinator',taskThreadId:'worker',assessment:f.assessment(run,'implement-backend')};
 assert.throws(()=>requestCell(run,'implement-backend',{...check,taskThreadId:'other'}),/Wrong/);
 for(const change of [a=>a.risk='unknown',a=>a.risk='high',a=>a.reversible=false,a=>a.hazards=['unresolved'],a=>a.stage='other',a=>a.contextDigest='0'.repeat(64)]){const assessment=structuredClone(check.assessment);change(assessment);assert.throws(()=>requestCell(run,'implement-backend',{...check,assessment}),/risk/);}
 revokeScopedMandate(f.plan,reference,{source:source('user','coordinator','Synthetic revocation')});assert.throws(()=>f.issue(run),/revoked/);assert.throws(()=>f.approve(reference),/revoked/);
});

test('current questions, source anchors, Work graph and producer artifact drift stay blocking',t=>{
 const f=fixture(t),reference=f.register();assert.throws(()=>f.approve(reference,1),/Previous/);
 let run=f.approve(reference);const pending=f.pass(run);fs.writeFileSync(path.join(f.dir,'proof-0.log'),'Changed');assert.throws(()=>f.accept(pending),/evidence/);
 fs.writeFileSync(path.join(f.dir,'proof-0.log'),'Synthetic proof 0');const done=f.finish(run),runs={'job-0':done};
 assert.equal(validBackendRun(done),true);fs.writeFileSync(path.join(f.dir,'proof-0.log'),'Stale');assert.equal(validBackendRun(done),false);assert.throws(()=>f.approve(reference,1,runs),/acceptance|evidence/);
 const node=path.join(f.root,'piece-0/index.yaml'),value=parseYaml(fs.readFileSync(node,'utf8'));value.description='Changed owning Work';f.put(node,value);assert.throws(()=>f.issue(run));
});

test('delegated backend acceptance rejects altered typed payload and incomplete E2E rather than trusting digest alone',t=>{
 const f=fixture(t,{count:1}),reference=f.register(),accepted=f.accept(f.pass(f.approve(reference)));
 assert.equal(validBackendRun(accepted),true);
 for(const mutate of [r=>r.responses['implement-backend'].outputs.apiContract=7,r=>r.responses['implement-backend'].criteria.pop(),r=>r.requests['implement-backend'].inputs.request='Different producer']){
  const changed=structuredClone(accepted);mutate(changed);const response=changed.responses['implement-backend'];response.requestDigest=workflowDigest(changed.requests['implement-backend']);changed.resultDigest=workflowDigest({goalDigest:changed.goalDigest,responses:changed.responses});changed.approvals.at(-1).digest=changed.resultDigest;assert.equal(validBackendRun(changed),false);
 }
 const automatic=structuredClone(accepted);automatic.automatic={};assert.equal(validBackendRun(automatic),false);
});

test('existing source anchors are revalidated at first delegated dispatch',t=>{
 const f=fixture(t,{count:1}),file=path.join(f.dir,'owned.txt');fs.writeFileSync(file,'actual anchor\n');f.plan.workflows[0].paths=['repo:owned.txt'];
 const reference=f.register(),goal=f.goal();goal.impacts=[{repository:'repo',service:'synthetic',path:'owned.txt',status:'existing',startLine:1,endLine:1,sourceHash:sha256(fs.readFileSync(file)),anchor:'actual anchor',change:'Synthetic local change',businessReason:'Synthetic test'}];
 const shown=f.shown(reference,0,goal),run=authorizeDelegatedGoal(shown,{reference,assessment:f.assessment(shown,'goal'),source:f.review});fs.writeFileSync(file,'different anchor\n');assert.throws(()=>f.issue(run),/hash or line anchor/);
});

test('Plan questions and current workflow questions cannot become coordinator answers',t=>{
 const f=fixture(t,{count:1});f.plan.workflows[0].openQuestions=['Synthetic owner product choice'];const reference=f.register(),run=f.shown(reference);run.goal.inputs.planQuestionAnswers=[{question:'Synthetic owner product choice',answer:'Agent guessed'}];assert.throws(()=>authorizeDelegatedGoal(run,{reference,assessment:f.assessment(run,'goal'),source:f.review}));
});

test('multi-stage frontend chain cannot reuse stale risk or stale draw proof for the next stage',t=>{
 const f=fixture(t,{count:1});f.plan.workflows[0].workflow='implement-frontend';f.plan.workflows[0].selection.verification='browser-uat';
 const reference=f.register(),goal=f.goal();goal.inputs.requiresBackend=false;
 const matrix=JSON.parse(fs.readFileSync(new URL('../workflows/matrix.json',import.meta.url))).rows.flat();
 goal.cells=matrix.map((cell,i)=>({...cell,purpose:'Synthetic '+cell.id,finalOutput:'Synthetic typed stage result',criteria:goal.criteria,workTargets:goal.workTargets,inputs:{request:i?{from:'cell',cell:matrix[i-1].id,key:'apiContract'}:{from:'request',key:'request'}},outputSchema:{type:'object',properties:{apiContract:{type:'string'}},required:['apiContract'],additionalProperties:false}}));
 let run=f.shown(reference,0,goal);run=authorizeDelegatedGoal(run,{reference,assessment:f.assessment(run,'goal'),source:f.review});
 const next=cellId=>requestCell(run,cellId,{coordinatorThreadId:'coordinator',taskThreadId:'worker',assessment:f.assessment(run,cellId)});
 assert.throws(()=>next('implement'),/Previous sequential/);
 for(const cell of matrix){const stale=f.assessment(run,cell.id),issued=next(cell.id),r=issued.request;run=acceptCell(issued.run,{cell:r.cell,op:r.op,operation:r.operation,goalDigest:r.goalDigest,scopeDigest:r.scopeDigest,requestDigest:workflowDigest(r),status:'pass',criteria:r.criteria.map(id=>({id,status:'pass',observation:'Synthetic stage check',evidence:['log']})),outputs:{apiContract:'Synthetic '+cell.id},artifacts:[{id:'log',path:'proof-0.log',sha256:sha256(fs.readFileSync(path.join(f.dir,'proof-0.log')))}]},{evidenceRoot:f.dir});if(cell.id==='draw'){assert.throws(()=>requestCell(run,'implement',{coordinatorThreadId:'coordinator',taskThreadId:'worker',assessment:{...stale,stage:'implement'}}),/risk/);fs.writeFileSync(path.join(f.dir,'proof-0.log'),'stale draw');assert.throws(()=>next('implement'),/evidence/);fs.writeFileSync(path.join(f.dir,'proof-0.log'),'Synthetic proof 0');}}
 assert.equal(f.accept(run).status,'accepted');
});

test('user-shaped fallback cannot hide invalid scoped acceptance, and revocation blocks result/Work advancement',t=>{
 const f=fixture(t,{count:1}),reference=f.register(),pending=f.pass(f.approve(reference)),accepted=f.accept(pending);
 const changed=structuredClone(accepted);changed.approvals.at(-1).assessment.risk='high';changed.approvals.at(-1).assessmentDigest=workflowDigest(changed.approvals.at(-1).assessment);changed.approvals.push({actor:'user',phase:'acceptance',approved:true,digest:changed.resultDigest,messageId:'synthetic-user-shaped-fallback'});assert.equal(validBackendRun(changed),false);
 revokeScopedMandate(f.plan,reference,{source:source('user','coordinator','Synthetic stop now')});assert.throws(()=>f.accept(pending),/revoked/);assert.throws(()=>markWorkDone(accepted,{}),/revoked/);
});

test('accepted and done backend handoffs invalidate on semantic target, ancestor or dependency drift',t=>{
 for(const completed of [false,true])for(const changedPart of ['target','ancestor','dependency']){
  const f=fixture(t,{count:1});const target=path.join(f.root,'piece-0/index.yaml');
  if(changedPart==='ancestor')f.put(path.join(f.root,'index.yaml'),{schema:'work/node@2',id:'synthetic-parent',kind:'scope',required:true,description:'Synthetic ancestor',assertions:[]});
  if(changedPart==='dependency'){
   f.put(path.join(f.root,'input/index.yaml'),{schema:'work/node@2',id:'input',kind:'operations',state:'todo',required:true,description:'Synthetic upstream design',assertions:['input-valid']});
   let work=validateWorkspace(f.root),input=work.nodes.find(n=>n.id==='input');f.put(path.join(f.root,'input/evidence/input/manifest.yaml'),{schema:'work/evidence@1',id:'input-proof',nodeId:'input',inputDigest:input.inputDigest,outcome:'pass',assertions:[{id:'input-valid',outcome:'pass',observation:'Synthetic input checked'}],assets:[]});
   const file=path.join(f.root,'input/index.yaml'),node=parseYaml(fs.readFileSync(file,'utf8'));f.put(file,{...node,state:'done',completion:{inputDigest:input.inputDigest,evidence:['input-proof']}});const own=parseYaml(fs.readFileSync(target,'utf8'));f.put(target,{...own,dependsOn:['input']});
  }
  assert.equal(validateWorkspace(f.root).ok,true,JSON.stringify(validateWorkspace(f.root).errors));
  const reference=f.register(),run=completed?f.finish(f.approve(reference)):f.accept(f.pass(f.approve(reference)));assert.equal(validBackendRun(run),true);
  const changed=changedPart==='target'?target:changedPart==='ancestor'?path.join(f.root,'index.yaml'):path.join(f.root,'input/index.yaml'),node=parseYaml(fs.readFileSync(changed,'utf8'));f.put(changed,{...node,description:'Changed semantic '+changedPart});assert.equal(validBackendRun(run),false,`${completed?'done':'accepted'} ${changedPart} must invalidate`);
 }
});

test('mid-Plan adoption preserves valid direct-user predecessors without rewriting their receipts',t=>{
 const f=fixture(t);let first=presentGoal(propose(f.goal(),{workRoot:f.root,repositories:{repo:f.dir}}),{messageId:'synthetic-native-presentation',scope:f.plan,jobId:'job-0'});
 first=approveGoal(first,{actor:'user',phase:'goal',approved:true,digest:first.goalDigest,messageId:'synthetic-native-goal-reply',replyTo:first.presentation.messageId,quote:'Synthetic direct user approves this goal'});
 first=f.pass(first);first=acceptDelivery(first,{actor:'user',phase:'acceptance',approved:true,digest:first.resultDigest,messageId:'synthetic-native-result-reply',quote:'Synthetic direct user accepts actual result'});
 const node=validateWorkspace(f.root).nodes.find(n=>n.id==='piece-0');f.put(path.join(f.root,'piece-0/evidence/direct/manifest.yaml'),{schema:'work/evidence@1',id:'direct-proof',nodeId:node.id,inputDigest:node.inputDigest,outcome:'pass',assertions:first.goal.criteria.map(id=>({id,outcome:'pass',observation:'Synthetic direct result'})),assets:[]});first=markWorkDone(first,{[node.id]:{inputDigest:node.inputDigest,evidence:['direct-proof']}});saveRun(first);
 const receipts=structuredClone(first.approvals),reference=f.register(),runs={'job-0':first};runs['job-1']=f.finish(f.approve(reference,1,runs),1,runs);saveRun(runs['job-1']);
 const criteria=[{id:'terminal',status:'pass',observation:'Existing direct and new delegated producers checked',evidence:[0,1].map(i=>({jobId:'job-'+i,cellId:'implement-backend',criterionId:'backend-e2e-pass'}))}];
 assert.equal(saveDelegatedCompletion(f.plan,{reference,criteria,source:f.review}).status,'done');assert.deepEqual(loadPlanRuns(f.plan,f.root)['job-0'].approvals,receipts);
});

test('mandate tampering, root changes, escaping paths/resources and corrupted resume fail closed',t=>{
 const f=fixture(t,{count:1});f.plan.workflows[0].paths=['repo:../outside.txt'];assert.throws(()=>f.register(),/escapes/);f.plan.workflows[0].paths=[];
 f.plan.workflows[0].resources.push('work:.claude/SKILL.md');f.options.jobs[0].resourceEffects.push({target:'work:.claude/SKILL.md',operation:'write-work',postcondition:'Changed runtime',category:'work-record'});assert.throws(()=>f.register(),/Runtime/);f.options.jobs[0].resourceEffects.pop();f.plan.workflows[0].resources.pop();
 const reference=f.register(),run=f.approve(reference);saveRun(run);
 const state=parseYaml(fs.readFileSync(reference.file,'utf8'));f.put(reference.file,{...state,mandate:{...state.mandate,coordinatorThreadId:'foreign'}});assert.throws(()=>f.issue(run),/changed/);f.put(reference.file,state);
 const other=structuredClone(run);other.repositories.repo=path.dirname(f.dir);assert.throws(()=>f.issue(other));
 const file=path.join(f.root,'_local/plans',f.plan.id,'approval/index.yaml'),approval=parseYaml(fs.readFileSync(file,'utf8'));approval.jobs['job-0'].presentation.provenance.quote='Changed brief';f.put(file,approval);assert.throws(()=>loadPlanRuns(f.plan,f.root),/decision/);
});

test('done producer rejects corrupt completion proof while unrelated stale Work remains isolated',t=>{
 const f=fixture(t,{count:1}),reference=f.register(),done=f.finish(f.approve(reference));assert.equal(validBackendRun(done),true);
 f.put(path.join(f.root,'unrelated/index.yaml'),{schema:'work/node@2',id:'unrelated',kind:'operations',state:'done',required:true,description:'Unrelated stale synthetic result',assertions:['other'],completion:{inputDigest:'0'.repeat(64),evidence:['other-proof']}});
 f.put(path.join(f.root,'unrelated/evidence/other/manifest.yaml'),{schema:'work/evidence@1',id:'other-proof',nodeId:'unrelated',inputDigest:'0'.repeat(64),outcome:'pass',assertions:[{id:'other',outcome:'pass',observation:'Old unrelated synthetic result'}],assets:[]});assert.equal(validBackendRun(done),true);
 const file=path.join(f.root,'piece-0/evidence/synthetic/manifest.yaml'),proof=parseYaml(fs.readFileSync(file,'utf8'));f.put(file,{...proof,inputDigest:'0'.repeat(64)});assert.equal(validBackendRun(done),false);
});

test('accepted producer rejects prerequisite completion regression even when semantic bindings do not change',t=>{
 const f=fixture(t,{count:1});f.put(path.join(f.root,'upstream/index.yaml'),{schema:'work/node@2',id:'upstream',kind:'operations',state:'todo',required:true,description:'Synthetic prerequisite',assertions:['ready']});
 const input=validateWorkspace(f.root).nodes.find(n=>n.id==='upstream'),file=path.join(f.root,'upstream/index.yaml'),meta=parseYaml(fs.readFileSync(file,'utf8')),proofFile=path.join(f.root,'upstream/evidence/proof/manifest.yaml');
 f.put(proofFile,{schema:'work/evidence@1',id:'upstream-proof',nodeId:input.id,inputDigest:input.inputDigest,outcome:'pass',assertions:[{id:'ready',outcome:'pass',observation:'Synthetic prerequisite reviewed'}],assets:[]});f.put(file,{...meta,state:'done',completion:{inputDigest:input.inputDigest,evidence:['upstream-proof']}});
 const target=path.join(f.root,'piece-0/index.yaml'),node=parseYaml(fs.readFileSync(target,'utf8'));f.put(target,{...node,dependsOn:['upstream']});const reference=f.register(),accepted=f.accept(f.pass(f.approve(reference)));assert.equal(validBackendRun(accepted),true);
 const before=validateWorkspace(f.root).nodes.find(n=>n.id==='piece-0').inputDigest,proof=parseYaml(fs.readFileSync(proofFile,'utf8'));f.put(proofFile,{...proof,inputDigest:'0'.repeat(64)});assert.equal(validateWorkspace(f.root).nodes.find(n=>n.id==='piece-0').inputDigest,before);assert.equal(validBackendRun(accepted),false);
});

test('forward-slash Windows bindings keep exact identity and cannot hang ancestor validation',t=>{
 const f=fixture(t,{count:1});f.options.workRoot=f.root.replaceAll('\\','/');f.options.repositories.repo=f.dir.replaceAll('\\','/');
 const code=`import {registerScopedMandate} from ${JSON.stringify(new URL('../workflows/delegation.mjs',import.meta.url).href)};console.log(JSON.stringify(registerScopedMandate(${JSON.stringify(f.plan)},${JSON.stringify(f.options)})));`;
 const result=spawnSync(process.execPath,['--input-type=module','-e',code],{encoding:'utf8',timeout:5000});assert.equal(result.error,undefined,result.error?.message);assert.equal(result.status,0,result.stderr);
 const reference=JSON.parse(result.stdout);assert.equal(readScopedMandate(f.plan,reference).mandate.binding.workRoot,f.options.workRoot);
});

test('unconfirmed imported backend scope cannot dispatch, while an already-ready backend needs no preparation job',t=>{
 const f=fixture(t,{count:1}),file=path.join(f.root,'piece-0/index.yaml'),node=parseYaml(fs.readFileSync(file,'utf8'));
 f.put(file,{...node,kind:'implementation',state:'uninvestigate',description:'Synthetic imported implementation observation; target is not confirmed'});
 const reference=f.register(),run=f.approve(reference);assert.throws(()=>f.issue(run),/investigated/);assert.equal(Object.keys(run.requests).length,0);
 const ready=fixture(t,{count:1}),readyFile=path.join(ready.root,'piece-0/index.yaml');ready.put(readyFile,{...parseYaml(fs.readFileSync(readyFile,'utf8')),kind:'implementation'});const ref=ready.register(),issued=ready.issue(ready.approve(ref));assert.equal(issued.run.status,'running');assert.equal(ready.plan.workflows.length,1);assert.equal(fs.existsSync(path.join(ready.root,'scope/setup/index.yaml')),false);
});

test('bounded prepare confirms child scope todo but completes only setup before backend dispatch',t=>{
 const f=fixture(t),setupFile=path.join(f.root,'scope/setup/index.yaml'),backendFile=path.join(f.root,'piece-1/index.yaml');
 f.put(setupFile,{schema:'work/node@2',id:'setup',kind:'business',required:true,state:'todo',description:'Synthetic bounded review of imported backend scope only',assertions:['scope-reviewed']});
 const imported=parseYaml(fs.readFileSync(backendFile,'utf8'));f.put(backendFile,{...imported,kind:'implementation',state:'uninvestigate',description:'Synthetic unconfirmed legacy implementation mapping'});
 const job=f.plan.workflows[0];job.workflow='prepare-work';job.selection.codeChange=false;job.workTargets=['setup'];job.criteria=['scope-reviewed'];job.paths=['repo:.starciwork/scope/setup/index.yaml','repo:.starciwork/piece-1/index.yaml'];job.purpose='Confirm only the selected imported backend scope';job.output='Reviewed setup and incomplete confirmed backend target';
 f.options.jobs[0].resourceEffects=[{target:'test:0',operation:'revise-selected-incomplete-scope',postcondition:'Setup review is separate; backend is confirmed todo without completion',category:'work-record'}];
 f.plan.backend.targets=['piece-1'];f.plan.backend.workflowIds=['job-1'];
 const reference=f.register(),goal=f.goal();goal.cells[0].op='workspace.manage';goal.cells[0].operation='prepare';goal.cells[0].outputSchema={type:'object',properties:{workRef:{type:'string'}},required:['workRef'],additionalProperties:false};goal.inputs.scopeRevision={completionTarget:'setup',incompleteWriteTarget:'piece-1',acceptedPurpose:'Synthetic module-local backend outcome, not the imported legacy assumption'};goal.cells[0].inputs.scopeRevision={from:'request',key:'scopeRevision'};
 goal.impacts=[setupFile,backendFile].map(file=>({repository:'repo',service:'Synthetic scope review',path:path.relative(f.dir,file).replaceAll('\\','/'),status:'existing',startLine:1,endLine:1,sourceHash:sha256(fs.readFileSync(file)),anchor:'schema: work/node@2',change:'Only declared scope-review or incomplete-target metadata',businessReason:'Confirm current requested scope without claiming implementation'}));
 let preparation=f.shown(reference,0,goal);preparation=authorizeDelegatedGoal(preparation,{reference,assessment:f.assessment(preparation,'goal'),source:f.review});
 const issued=requestCell(preparation,'prepare-work',{coordinatorThreadId:'coordinator',taskThreadId:'worker',assessment:f.assessment(preparation,'prepare-work')});assert.deepEqual(issued.request.workBindings,[]);
 f.put(backendFile,{...imported,kind:'implementation',state:'todo',description:goal.inputs.scopeRevision.acceptedPurpose});
 const r=issued.request;preparation=acceptCell(issued.run,{cell:r.cell,op:r.op,operation:r.operation,goalDigest:r.goalDigest,scopeDigest:r.scopeDigest,requestDigest:workflowDigest(r),status:'pass',criteria:[{id:'scope-reviewed',status:'pass',observation:'Synthetic expected scope and unchanged ownership reviewed; backend remains incomplete',evidence:['log']}],outputs:{workRef:'scope/setup/index.yaml'},artifacts:[{id:'log',path:'proof-0.log',sha256:sha256(fs.readFileSync(path.join(f.dir,'proof-0.log')))}]},{evidenceRoot:f.dir});preparation=f.accept(preparation);
 const setup=validateWorkspace(f.root).nodes.find(n=>n.id==='setup');f.put(path.join(f.root,'scope/setup/evidence/review/manifest.yaml'),{schema:'work/evidence@1',id:'setup-proof',nodeId:'setup',inputDigest:setup.inputDigest,outcome:'pass',assertions:[{id:'scope-reviewed',outcome:'pass',observation:'Synthetic scope review only; no code or E2E acceptance'}],assets:[]});
 const completion={inputDigest:setup.inputDigest,evidence:['setup-proof']};assert.throws(()=>markWorkDone(preparation,{setup:completion,'piece-1':completion}),/other Work nodes/);preparation=markWorkDone(preparation,{setup:completion});
 const checked=validateWorkspace(f.root),backend=checked.nodes.find(n=>n.id==='piece-1');assert.equal(checked.ok,true);assert.equal(checked.nodes.find(n=>n.id==='setup').effectiveState,'done');assert.equal(backend.state,'todo');assert.equal(backend.effectiveState,'todo');assert.equal(backend.completion,null);assert.equal(backend.eligible,true);
 const priorRuns={'job-0':preparation},backendRun=f.approve(reference,1,priorRuns);assert.equal(f.issue(backendRun,priorRuns).run.status,'running');assert.equal(validateWorkspace(f.root).nodes.find(n=>n.id==='piece-1').effectiveState,'todo');
});
