import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {sha256,validateWorkspace} from '../core/index.mjs';
import {stringifyYaml,parseYaml} from '../core/yaml.mjs';
import {validatePlan} from '../workflows/plan.mjs';
import {renderPlan,createBundle} from '../scripts/plan.mjs';
import {autoASAPWindow,autoASAPStatus} from '../workflows/auto.mjs';
import {presentAutoPlan,approveAutoPlan,assessAutoGoal,nextAutoJob,hasAutoAcceptance,assertAutoAuthority} from '../workflows/auto.mjs';
import {propose,presentGoal,authorizeAutoGoal,requestCell,acceptCell,acceptAutoDelivery,markWorkDone,saveRun,saveAutoCompletion,workflowDigest} from '../workflows/lifecycle.mjs';
import {validBackendRun} from '../workflows/select.mjs';
import {readWorkflow, readExample, readPublicJson} from './helpers/read-public.mjs';
const catalog=readWorkflow('catalog.json');
function fixture(t,{count=2,workflow='define-business'}={}) {
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-auto-'));
 t.after(()=>{assert.equal(path.dirname(dir),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(dir).startsWith('starci-auto-'));fs.rmSync(dir,{recursive:true,force:true});});
 const root=path.join(dir,'.starciwork'),put=(p,x)=>{fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,stringifyYaml(x));};
 put(path.join(root,'workspace.yaml'),{schema:'work/workspace@1',id:'synthetic-auto'});
 const criteria=workflow==='implement-backend'?['unit-tests-pass','backend-e2e-pass','api-contract-pass']:['outcome'];
 const plan={schema:'starci/plan@2',mode:'auto',auto:{maxMinutes:30,acceptance:'verified-criteria'},id:'synthetic-auto',requestId:'original-request',originalRequest:'Synthetic fixture: produce two local checked deliverables.',finalOutcome:'Both synthetic outputs are proved.',openQuestions:[],exclusions:['production'],completionCriteria:[{id:'terminal',outcome:'Both outputs verified',workflowIds:Array.from({length:count},(_,i)=>'job-'+i)}],workflows:[]};
 for(const area of ['business','architecture','implementation','backend','frontend','uat'])plan[area]={action:'not-applicable',outcome:'Synthetic runtime test only',targets:[],workflowIds:[],evidence:[],reason:'Not a real product delivery.'};
 for(let i=0;i<count;i++) {
  put(path.join(root,'piece-'+i,'index.yaml'),{schema:'work/node@2',id:'piece-'+i,kind:'operations',state:'todo',required:true,assertions:criteria,description:'Synthetic local result for auto lifecycle tests only.'});
  fs.writeFileSync(path.join(dir,'proof-'+i+'.log'),'Synthetic evidence '+i);
  plan.workflows.push({id:'job-'+i,workflow,selection:{requestQuote:plan.originalRequest,codeChange:workflow.startsWith('implement-'),verification:'unit-component',separateDeliverable:false},purpose:'Produce bounded synthetic output',input:'Original synthetic intent',output:'Verified synthetic output',criteria,workTargets:['piece-'+i],paths:[],resources:['work:piece-'+i],dependsOn:i?['job-'+(i-1)]:[],estimate:{minMinutes:1,maxMinutes:2,assumptions:'Synthetic fixture'},openQuestions:[],auto:{environment:'local',business:['synthetic'],resourceEffects:[{target:'work:piece-'+i,operation:'write-specification',postcondition:'Synthetic output recorded'}]}});
 }
 plan.business={action:'change',outcome:plan.finalOutcome,targets:plan.workflows.flatMap(j=>j.workTargets),workflowIds:plan.workflows.map(j=>j.id),evidence:[],reason:''};
 const assessment={risk:'low',environment:'local',reversible:true,reason:'Only disposable synthetic files; no external service.',evidence:['Synthetic isolated fixture inspected'],hazards:[]};
 const approval=(scope=plan,p=presentAutoPlan(scope,{messageId:'presented-auto',workRoot:root,repositories:{repo:dir}}))=>approveAutoPlan(scope,p,{actor:'user',phase:'plan-auto',approved:true,digest:p.digest,replyTo:p.messageId,messageId:'subsequent-user-auto',quote:'Synthetic user delegates this auto Plan and technical criteria acceptance.'});
 const goal=(i=0,scope=plan)=> {
  const j=scope.workflows[i],op=workflow==='implement-backend'?'backend.implement':'business.decide';
  return {schema:'starci/goal@1',id:'goal-'+i,workflow:j.workflow,requestId:scope.requestId,originalRequest:scope.originalRequest,finalOutcome:j.purpose,scope:{business:['synthetic'],paths:j.paths,resources:j.resources,exclusions:scope.exclusions},criteria:j.criteria,businessChanges:['Produce only the requested synthetic output'],impacts:[],resourceEffects:j.auto.resourceEffects,inputs:{request:'Synthetic input'},workTargets:j.workTargets,cells:[{id:j.workflow,op,purpose:j.purpose,finalOutput:j.output,criteria:j.criteria,inputs:{request:{from:'request',key:'request'}},outputSchema:{type:'object',properties:{apiContract:{type:'string'}},required:['apiContract'],additionalProperties:false}}]};
 };
 const shown=(i=0,scope=plan,g=goal(i,scope))=>presentGoal(propose(g,{workRoot:root,repositories:{repo:dir}}),{messageId:'goal-presentation-'+i,scope,jobId:scope.workflows[i].id});
 const pass=(run,i=0)=> {
  const issued=requestCell(run,run.goal.cells[0].id),r=issued.request;
  return acceptCell(issued.run,{cell:r.cell,op:r.op,operation:r.operation,goalDigest:r.goalDigest,scopeDigest:r.scopeDigest,requestDigest:workflowDigest(r),status:'pass',criteria:r.criteria.map(id=>({id,status:'pass',observation:'Synthetic observation',evidence:['log']})),outputs:{apiContract:'Synthetic API contract'},artifacts:[{id:'log',path:'proof-'+i+'.log',sha256:sha256(fs.readFileSync(path.join(dir,'proof-'+i+'.log')))}]},{evidenceRoot:dir});
 };
 const finish=(run,i=0)=> {
  run=acceptAutoDelivery(pass(run,i));
  const node=validateWorkspace(root).nodes.find(n=>n.id==='piece-'+i);
  put(path.join(root,'piece-'+i,'evidence/auto/manifest.yaml'),{schema:'work/evidence@1',id:'proof-'+i,nodeId:node.id,inputDigest:node.inputDigest,outcome:'pass',assertions:criteria.map(id=>({id,outcome:'pass',observation:'Synthetic evidence, not real acceptance'})),assets:[]});
  return markWorkDone(run,{[node.id]:{inputDigest:node.inputDigest,evidence:['proof-'+i]}});
 };
 return {dir,root,put,plan,assessment,approval,goal,shown,pass,finish};
}
test('ASAP cooks two proved jobs before a later question without truncating the Plan',t=>{
 const f=fixture(t,{count:3});f.plan.workflows[2].openQuestions=['Owner decides the later scope'];
 const window=autoASAPWindow(f.plan);
 assert.deepEqual(window.candidateJobIds,['job-0','job-1']);assert.deepEqual(window.laterJobIds,['job-2']);
 assert.deepEqual(window.estimate,{minMinutes:2,maxMinutes:4});assert.equal(window.authorityGranted,false);
 const rendered=renderPlan(f.plan);assert.match(rendered,/Auto ASAP/);assert.match(rendered,/job-0 → job-1/);assert.match(rendered,/Owner decides the later scope/);
 const authorization=f.approval(),runs={};
 for(let i=0;i<2;i++){
  assert.equal(autoASAPStatus(f.plan,{authorization,runs}).jobId,'job-'+i);
  runs['job-'+i]=f.finish(authorizeAutoGoal(f.shown(i),{authorization,assessment:f.assessment,priorRuns:runs}),i);
  saveRun(runs['job-'+i]);
 }
 const waiting=autoASAPStatus(f.plan,{authorization,runs});
 assert.equal(waiting.status,'needs-user');assert.deepEqual(waiting.candidateJobIds,[]);assert.deepEqual(waiting.laterJobIds,['job-2']);
 assert.equal(f.plan.workflows.length,3);
 const persisted=parseYaml(fs.readFileSync(path.join(f.dir,'.starciwork/_local/plans',f.plan.id,'run/index.yaml'),'utf8'));
 assert.notEqual(persisted.status,'done');assert.equal(persisted.jobs['job-2'].status,'planned');
 fs.writeFileSync(path.join(f.dir,'proof-0.log'),'stale');
 assert.throws(()=>autoASAPStatus(f.plan,{authorization,runs}),/evidence/);
});

test('ASAP has no two-job cap and cannot skip checkpoints or manufacture authority',t=>{
 const f=fixture(t,{count:4});assert.equal(autoASAPWindow(f.plan).candidateJobIds.length,4);
 f.plan.workflows[1].auto.environment='manual';
 assert.deepEqual(autoASAPWindow(f.plan).candidateJobIds,['job-0']);
 assert.deepEqual(autoASAPWindow(f.plan).laterJobIds,['job-1','job-2','job-3']);
 assert.throws(()=>autoASAPStatus(f.plan,{runs:{}}));
 const authorization=f.approval();
 const run=authorizeAutoGoal(f.shown(),{authorization,assessment:f.assessment});
 const status=autoASAPStatus(f.plan,{authorization,runs:{'job-0':run}});
 assert.equal(status.status,'resume-or-report');assert.deepEqual(status.candidateJobIds,[]);
 const tampered=structuredClone(authorization);tampered.expiresAt+=60000;
 assert.throws(()=>autoASAPStatus(f.plan,{authorization:tampered}));
 f.plan.openQuestions=['Unresolved terminal outcome'];
 assert.deepEqual(autoASAPWindow(f.plan).candidateJobIds,[]);
 assert.equal(autoASAPWindow(f.plan).checkpoint.reason,'plan-questions');
});

test('new Plan bundles refuse legacy destinations or a parallel canonical tree',t=>{
 const f=fixture(t);
 for(const name of ['.work','.starci','.starcitemp']){
  assert.throws(()=>createBundle(f.plan,path.join(f.dir,name,'plans','new')),/migration-required/);
  assert.equal(fs.existsSync(path.join(f.dir,name)),false);
 }
 fs.mkdirSync(path.join(f.dir,'.starci'));
 assert.throws(()=>createBundle(f.plan,path.join(f.dir,'.starciwork/_local/plans/new')),/conflict/);
 assert.throws(()=>saveRun(f.shown()),/conflict/);
 assert.equal(fs.existsSync(path.join(f.dir,'.starciwork/_local')),false);
});

test('manual remains default; auto needs explicit bounded delegation policy',t=>{
 const f=fixture(t);assert.equal(validatePlan(f.plan,catalog).ok,true);
 const manual=structuredClone(f.plan);delete manual.mode;delete manual.auto;manual.workflows.forEach(j=>delete j.auto);
 assert.equal(validatePlan(manual,catalog).ok,true);assert.throws(()=>presentAutoPlan(manual,{messageId:'show',workRoot:f.root}),/Explicit auto/);
 for(const modify of [p=>p.mode='autonomous',p=>delete p.auto,p=>p.auto.maxMinutes=0,p=>p.auto.maxMinutes=481,p=>p.auto.acceptance='user',p=>delete p.workflows[0].auto,p=>p.workflows[0].auto.resourceEffects[0].target='elsewhere']) {
  const p=structuredClone(f.plan);modify(p);assert.throws(()=>validatePlan(p,catalog));
 }
 assert.match(renderPlan(f.plan),/Mode: auto/);assert.match(renderPlan(f.plan),/30 minutes/);
});
test('original task, stale Plan and fabricated receipt roles do not delegate auto',t=>{
 const f=fixture(t),p=presentAutoPlan(f.plan,{messageId:'shown',workRoot:f.root,repositories:{repo:f.dir}});
 const receipt={actor:'user',phase:'plan-auto',approved:true,digest:p.digest,replyTo:p.messageId,messageId:'reply',quote:'Synthetic delegation'};
 for(const edit of [{actor:'assistant'},{messageId:f.plan.requestId},{replyTo:'elsewhere'},{digest:'stale'},{quote:f.plan.originalRequest}])assert.throws(()=>approveAutoPlan(f.plan,p,{...receipt,...edit}));
 const changed=structuredClone(f.plan);changed.finalOutcome='New scope';assert.throws(()=>approveAutoPlan(changed,p,receipt));
 const open=structuredClone(f.plan);open.openQuestions=['Unresolved business scope'];assert.throws(()=>f.approval(open),/questions/);
});
test('risk assessment stops high unknown irreversible external and unresolved user choices',t=>{
 const f=fixture(t),run=f.shown();
 assert.equal(assessAutoGoal(run,f.assessment).allowed,true);
 for(const edit of [{risk:'high'},{risk:'unknown'},{environment:'production'},{reversible:false},{evidence:[]},{hazards:['Real payment']},{reason:''}])assert.equal(assessAutoGoal(run,{...f.assessment,...edit}).allowed,false);
 const plan=structuredClone(f.plan);plan.workflows[0].openQuestions=['User must choose one of three designs'];
 const g=f.goal(0,plan);g.inputs.planQuestionAnswers=[{question:plan.workflows[0].openQuestions[0],answer:'Agent picks first'}];
 assert.throws(()=>authorizeAutoGoal(f.shown(0,plan,g),{authorization:f.approval(plan),assessment:f.assessment}),/Unresolved user checkpoint/);
});
test('publication deployment runtime correction retirement and self-update never inherit auto authority',t=>{
 const f=fixture(t);
 for(const workflow of ['publish-code','deploy-release','operate-runtime','correct-data','retire-scope','update-knowledge']) {
  const r=f.shown();r.goal.workflow=workflow;
  assert.equal(assessAutoGoal(r,f.assessment).allowed,false);
 }
 const r=f.shown();r.goal.workflow='prepare-work';r.goal.cells[0].operation='import';assert.equal(assessAutoGoal(r,f.assessment).allowed,false);
});
test('auto rejects drift in resource effects criteria business exclusions and repository bindings',t=>{
 const f=fixture(t),auth=f.approval();
 for(const edit of [g=>g.resourceEffects[0].operation='delete',g=>g.scope.business=['different'],g=>g.scope.exclusions=[],g=>{g.criteria=['weaker'];g.cells[0].criteria=['weaker'];}]) {
  const g=structuredClone(f.goal());edit(g);assert.throws(()=>authorizeAutoGoal(f.shown(0,f.plan,g),{authorization:auth,assessment:f.assessment}));
 }
 const run=f.shown();run.repositories={other:f.dir};assert.throws(()=>authorizeAutoGoal(run,{authorization:auth,assessment:f.assessment}));
});
test('auto completes all ordered workflows without fake per-job user receipts and persists one bundle',t=>{
 const f=fixture(t),authorization=f.approval(),runs={};
 assert.deepEqual(nextAutoJob(f.plan,{authorization,runs}),{status:'needs-risk-assessment',jobId:'job-0'});
 assert.throws(()=>authorizeAutoGoal(f.shown(1),{authorization,assessment:f.assessment,priorRuns:runs}),/Previous Plan workflow/);
 for(let i=0;i<2;i++) {
  let run=authorizeAutoGoal(f.shown(i),{authorization,assessment:f.assessment,priorRuns:runs});
  run=f.finish(run,i);runs['job-'+i]=run;
  assert.equal(hasAutoAcceptance(run),true);assert.equal(run.approvals.some(a=>a.actor==='user'),false);
  saveRun(run);
 }
 assert.equal(nextAutoJob(f.plan,{authorization,runs}).status,'awaiting-terminal-review');
 const bundle=path.join(f.dir,'.starciwork/_local/plans',f.plan.id),read=p=>parseYaml(fs.readFileSync(path.join(bundle,p),'utf8'));
 assert.deepEqual(read('goal/index.yaml').plan,f.plan);assert.equal(Object.keys(read('run/index.yaml').jobs).length,2);
 assert.equal(read('run/index.yaml').jobs['job-1'].automatic.authorization.receipt.messageId,'subsequent-user-auto');
 assert.equal(read('approval/index.yaml').jobs['job-0'].receipts.at(-1).actor,'assistant');
 assert.equal(read('run/index.yaml').status,'awaiting-terminal-review');
 assert.throws(()=>saveAutoCompletion(f.plan,{authorization,criteria:[]}),/terminal criterion/);
 const criteria=[{id:'terminal',status:'pass',observation:'Both synthetic outputs have current proof.',evidence:[0,1].map(i=>({jobId:'job-'+i,cellId:'define-business',criterionId:'outcome'}))}];
 assert.equal(saveAutoCompletion(f.plan,{authorization,criteria}).actor,'assistant');
 assert.equal(read('run/index.yaml').status,'done');
 saveRun(runs['job-1']);assert.equal(read('run/index.yaml').status,'done');
});
test('auto cannot accept failed missing or stale evidence or mark Work done early',t=>{
 const f=fixture(t),authorization=f.approval();let run=authorizeAutoGoal(f.shown(),{authorization,assessment:f.assessment});
 assert.throws(()=>acceptAutoDelivery(run),/complete unchanged/);assert.throws(()=>markWorkDone(run,{}));
 run=f.pass(run);fs.writeFileSync(path.join(f.dir,'proof-0.log'),'changed');
 assert.throws(()=>acceptAutoDelivery(run),/evidence/);
});
test('auto handoff revalidates prior Work and artifacts rather than trusting done flags',t=>{
 const f=fixture(t),authorization=f.approval(),run=f.finish(authorizeAutoGoal(f.shown(),{authorization,assessment:f.assessment}));
 const priorRuns={'job-0':run};assert.equal(nextAutoJob(f.plan,{authorization,runs:priorRuns}).jobId,'job-1');
 fs.writeFileSync(path.join(f.dir,'proof-0.log'),'corrupt');
 assert.throws(()=>authorizeAutoGoal(f.shown(1),{authorization,assessment:f.assessment,priorRuns}),/evidence/);
});
test('time budget is part of the actual user-bound presentation and cannot be extended',t=>{
 const f=fixture(t),authorization=f.approval();
 for(const edit of [a=>a.expiresAt+=60000,a=>{a.startedAt+=60000;a.expiresAt+=60000;},a=>{a.presentation.issuedAt+=60000;a.presentation.expiresAt+=60000;}]) {
  const a=structuredClone(authorization);edit(a);assert.throws(()=>assertAutoAuthority(f.plan,a));
 }
 const expired=presentAutoPlan(f.plan,{messageId:'expired',workRoot:f.root,repositories:{repo:f.dir},issuedAt:Date.now()-3600000});
 assert.throws(()=>f.approval(f.plan,expired),/expired/);
});
test('backend auto acceptance is usable by FE only with actual unit E2E API and current proof',t=>{
 const f=fixture(t,{count:1,workflow:'implement-backend'}),authorization=f.approval();
 const run=f.finish(authorizeAutoGoal(f.shown(),{authorization,assessment:f.assessment}));
 assert.equal(validBackendRun(run),true);
 const bad=structuredClone(run);bad.responses['implement-backend'].criteria.pop();assert.equal(validBackendRun(bad),false);
 fs.writeFileSync(path.join(f.dir,'proof-0.log'),'stale');assert.equal(validBackendRun(run),false);
});
test('a locally labelled product job cannot self-edit its bootstrap',t=>{
 const f=fixture(t),run=f.shown();
 run.goal.impacts=[{repository:'repo',path:'AGENTS.md'}];
 assert.equal(assessAutoGoal(run,f.assessment).allowed,false);
});
test('expiry blocks the next cell even after goal authorization and cannot be hidden by a user-shaped receipt',t=>{
 const f=fixture(t),authorization=f.approval();
 const run=authorizeAutoGoal(f.shown(),{authorization,assessment:f.assessment});
 run.approvals.push({actor:'user',phase:'goal',approved:true,digest:run.goalDigest,messageId:'unrelated-manual-receipt',replyTo:run.presentation.messageId});
 t.mock.method(Date,'now',()=>authorization.expiresAt+1);
 assert.throws(()=>requestCell(run,run.goal.cells[0].id),/expired/);
});
test('invalid Work still stops auto dispatch after delegation',t=>{
 const f=fixture(t),authorization=f.approval();
 const run=authorizeAutoGoal(f.shown(),{authorization,assessment:f.assessment});
 f.put(path.join(f.root,'piece-0/index.yaml'),{schema:'work/node@2',id:'piece-0',kind:'operations',state:'todo',required:true,description:'Synthetic blocked node',assertions:['outcome'],blockers:['Unresolved current data owner']});
 // Business investigation can inspect incomplete nodes, but malformed graph cannot pass.
 f.put(path.join(f.root,'piece-1/index.yaml'),{schema:'work/node@2',id:'piece-0',kind:'operations',state:'todo',required:true,description:'Synthetic duplicate ID',assertions:['outcome']});
 assert.throws(()=>requestCell(run,run.goal.cells[0].id),/Work graph is invalid/);
});
