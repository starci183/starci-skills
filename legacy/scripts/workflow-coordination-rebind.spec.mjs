import {observeCheckoutFixture,prepareFixtureSource,fixtureSourceCritique} from './architecture-source-fixture.mjs';
// Mapping and admission regression using genuine current mismatch acceptance and an official
// retry/rebind forecast. It does not claim the full resolved-source incorporation lifecycle.
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { readFileSync, cpSync, rmdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { workspaceCheckoutFixture, fixtureGit as git } from './workspace-checkout-fixture.mjs';
import { openSession, confirmSession } from './session-open.mjs';
import { discoveryFor, answerFor } from './v23-test-fixture.mjs';
import { retainContext } from './mission-history.mjs';
import { scopeHash } from './mission-scope.mjs';
import { resolveWorkspaceCheckout, installedTreeOf } from './workspace-checkout.mjs';
import { baseline, confirmed } from '../operators/architecture-decide/self-test.mjs';
const sha = x => 'sha256:' + createHash('sha256').update(x).digest('hex');
const table = (title, columns, rows=[]) => `\n## ${title}\n\n| ${columns.join(' | ')} |\n| ${columns.map(()=>'---').join(' | ')} |\n${rows.map(row=>`| ${row.join(' | ')} |`).join('\n')}\n`;
async function fixture(t,{backend=false}={}) {
 const f=workspaceCheckoutFixture({attachRuntime:true});t.after(()=>f.dispose());
 cpSync(import.meta.dirname,path.join(f.runtime,'scripts'),{recursive:true});
 // Module identity carries the admission phase. Copy executable operators too; a junction back
 // to this test runtime would create two independent AsyncLocalStorage phase owners.
 rmdirSync(path.join(f.runtime,'operators'));cpSync(path.resolve(import.meta.dirname,'../operators'),path.join(f.runtime,'operators'),{recursive:true});
 const gate=await import(pathToFileURL(path.join(f.runtime,'scripts/attempt-gate.mjs')).href);
 f.plans=await import(pathToFileURL(path.join(f.runtime,'scripts/plan-history.mjs')).href);
 f.validation=await import(pathToFileURL(path.join(f.runtime,'scripts/validate-step.mjs')).href);
 f.write(path.join(f.source,'.workspaces/projects/fixture/workflow.json'),{version:1,project:f.project,ownerRole:f.role});
 const discovery=discoveryFor(f.project,{head:f.baseHead,tags:['backend','architecture']});discovery.repositories[0].repository=f.origin;discovery.impacts[0].code=['src','extra'];
 const opened=await openSession(path.join(f.canonical,'.worktrees/sessions'),{sessionId:f.sessionId,project:f.project,hostBinding:{kind:'codex-task',hostId:'reentry-'+path.basename(f.temporary),worktree:f.selected,sourcePromptRef:'user:fixture'},mission:{language:'en',goal:'Verify the bounded fixture result.',target:'The declared fixture boundary',includes:['Fixture implementation and verification'],excludes:[],outputs:['Fixture result'],doneWhen:[{producedBy:backend?'backend.generate':'data.plan',evidence:'The bounded fixture result is verified.'}],verification:'Validate the complete typed result.',sourceRef:'user:fixture',discovery}}, {sourceRoot:f.source});
 f.session=opened.session;f.stateFile=path.join(f.session,'state.json');f.state=()=>JSON.parse(readFileSync(f.stateFile));f.save=s=>f.write(f.stateFile,s);f.branch=cell=>path.join(f.session,`step-${cell.split('/')[0]}/parallel-${cell.split('/')[1]}`);
 await confirmSession(f.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:approved-fixture',authority:answerFor(f.state().mission,'user:approved-fixture')},{root:f.runtime});
 f.request=(cell,operatorId,requirements,contexts=[],goal={doneWhen:0})=>{const [step,parallel]=cell.split('/').map(Number);return{contractVersion:'starci/v2.2',schemaVersion:9,sessionId:f.sessionId,operatorId,step,parallel,contexts,requirements,inputs:{},resume:null,goal,attempt:{id:cell+':a1',number:1,kind:'initial',previous:null},expected:{version:1,goalVersion:1,sourceRef:`state.json#mission:v1/${goal.prerequisite?'prerequisite:'+goal.prerequisite:'doneWhen:'+goal.doneWhen}`,criteria:[{id:'bounded',required:true,expected:'The bounded fixture result is proved.',verification:'Read the typed fixture evidence.'}]},environment:{isolationId:cell+':a1',mode:operatorId==='workspace.bind'?'inline':'isolated',workspace:null,reads:contexts.map(c=>c.alias),writes:[],exclusive:[],outputRoot:'response'},frozenInputs:[]};};
 f.response=(r,status,fields)=>{const evidence=Object.values(fields),matched=status==='done',verdict=matched?'matched':status==='mismatch'?'mismatched':'inconclusive';return{contractVersion:'starci/v2.2',schemaVersion:9,operatorId:r.operatorId,step:r.step,parallel:r.parallel,status,fields,fallbacks:[],commits:[],next:[],boundProfile:r.operatorId==='workspace.bind'?'sol-fresh':'sol-reviewer',ranProfile:r.operatorId==='workspace.bind'?'sol-fresh':'sol-reviewer',attempt:{id:r.attempt.id,number:r.attempt.number,expectedVersion:r.expected.version},actual:{expectedVersion:r.expected.version,observedAt:new Date().toISOString(),observations:[{criterionId:'bounded',observed:matched?'The bounded fixture result is recorded.':'The fixture result remains unproved.',evidence}]},comparison:{expectedVersion:r.expected.version,verdict,criteria:[{criterionId:'bounded',verdict,evidence,note:'Actual test fixture acceptance, not product proof.'}],next:matched?'advance':status==='blocked'?'blocked':'repair'},...(matched?{goalCheck:{achieved:true,evidence},outcome:{summary:'The bounded fixture result is recorded.',primary:{kind:'document',label:'Fixture result',ref:evidence[0]}}}:{})};};
 f.open=async r=>{f.write(path.join(f.branch(`${r.step}/${r.parallel}`),'request/request.json'),r);return gate.openAttempt(f.branch(`${r.step}/${r.parallel}`));};
 f.accept=async(r,response)=>{f.write(path.join(f.branch(`${r.step}/${r.parallel}`),'response/response.json'),response);return gate.acceptAttempt(f.branch(`${r.step}/${r.parallel}`));};
 const bind=f.request('1/1','workspace.bind',{project:f.project,role:f.role,checkout:'session',declaredWriteRoots:['src'],sharedInstall:false,gitPolicy:{mutationBranch:'main',worktreeBranches:'session-only'}},[{alias:`@workspaces/projects/${f.project}/be`,head:null},{alias:`@workspaces/local/routes/${f.project}/be`,head:null},{alias:'@workspaces/device-state',head:null}],{prerequisite:'2/1'});
 let state=f.state();state.chain=[['1/1'],['2/1']];state.steps={'1/1':'workspace.bind','2/1':'data.plan'};state.current='1/1';f.save(state);
 await f.open(bind);await acceptBind(f,bind);f.bind=bind;
 f.load=file=>import(pathToFileURL(path.join(f.runtime,file)).href);
 return f;
}

async function architecture(f) {
 const {restatementDecisionId,recordRestatementChoice}=await f.load('scripts/restatement-choice.mjs'),{acquireWorkerSlot}=await f.load('scripts/worker-slots.mjs');
 const [files]=confirmed(baseline()),template=structuredClone(files['request/request.json']);delete template.decisionId;delete template.selectedOption;template.requirements.resume=null;template.contexts[0].head=f.sessionHead;
 const operation={operationId:'fixture-worker',name:'runFixtureWorker',transport:'worker',writerRef:'src/worker.mjs',storeRefs:[],transactionBoundary:'read-only',idempotencyKind:'none',migrationRefs:[],authorityDimensionIds:['deterministic-value']};
 files['response/data/stack-model.json'].operations=[operation];observeCheckoutFixture(files,f.sessionHead);
 files['response/response.md']=files['response/response.md'].replace(/## Operations[\s\S]*?(?=## Handoff)/,table('Operations',['Operation','Transport','Writer','Stores','Transaction','Idempotency','Dimensions'],[[operation.operationId,'worker',operation.writerRef,'—','read-only','none','deterministic-value']])+'\n');
 let state=f.state();state.chain=[['1/1'],['2/1'],['3/1'],['4/1']];state.steps={'1/1':'workspace.bind','2/1':'architecture.decide','3/1':'architecture.decide','4/1':'backend.generate'};state.current='2/1';f.save(state);
 const reading={...template,...f.request('2/1','architecture.decide',template.requirements,template.contexts,{prerequisite:'4/1'})};
 await f.open(reading);const text=files['response/restatement.md'],id=restatementDecisionId(reading,template.requirements.decisionId,text);
 f.write(path.join(f.branch('2/1'),'response/restatement.md'),text);
 const refusal=f.response(reading,'blocked',{restatement:'response/restatement.md'});refusal.stop='RESTATEMENT_UNCONFIRMED';refusal.interaction={kind:'restatement-confirm',decisionId:id,options:[{id:'as-stated',label:'As stated',tradeoff:'Use this reading'},{id:'corrected',label:'Corrected',tradeoff:'Correct this reading'}]};
 await f.accept(reading,refusal);await recordRestatementChoice(f.branch('2/1'),{selected:'as-stated',selectedBy:'user',sourceRef:'user:fixture-reading'});
 const parent={...structuredClone(reading),step:3,decisionId:id,selectedOption:'as-stated',requirements:{...reading.requirements,resume:id},resume:{step:2,parallel:1,token:id},attempt:{id:'3/1:a2',number:2,kind:'repair',previous:reading.attempt.id}};parent.environment.isolationId=parent.attempt.id;
 state=f.state();state.resumes={'3/1':{resumes:'2/1',stop:'RESTATEMENT_UNCONFIRMED'}};f.save(state);await f.open(parent);
 for(const ref of ['response/restatement.md','response/data/current-state.json','response/data/stack-model.json'])f.write(path.join(f.branch('3/1'),ref),files[ref]);
 const waiting=f.response(parent,'waiting',{restatement:'response/restatement.md','current-state':'response/data/current-state.json','stack-model':'response/data/stack-model.json'});waiting.awaiting={exchange:'critique',kind:'independent-critique'};waiting.comparison.next='retry';await f.accept(parent,waiting);
 const child={...f.request('3/1','architecture.decide',{},files['critique/request/request.json'].contexts),exchange:'critique',inputs:{'stack-model':'step-3/parallel-1/response/data/stack-model.json'}};delete child.goal;child.attempt={id:'3/1/critique:a1',number:1,kind:'initial',previous:null};child.expected.sourceRef='step-3/parallel-1/response/data/stack-model.json';child.environment.isolationId=child.attempt.id;
 const childDir=path.join(f.branch('3/1'),'critique'),gate=await f.load('scripts/attempt-gate.mjs');f.write(path.join(childDir,'request/request.json'),child);await prepareFixtureSource(f.runtime,childDir,child);await gate.openAttempt(childDir);f.write(path.join(childDir,'response/critique.md'),fixtureSourceCritique(childDir,files['critique/response/critique.md']));
 const reviewed=f.response(child,'done',{'independent-critique':'response/critique.md'});reviewed.exchange='critique';delete reviewed.goalCheck;f.write(path.join(childDir,'response/response.json'),reviewed);await gate.acceptAttempt(childDir);
 await acquireWorkerSlot(f.branch('3/1'),'fixture-author',{resume:true,ranProfile:'sol-reviewer'});
 f.write(path.join(f.branch('3/1'),'response/response.md'),files['response/response.md']);
 const done=f.response(parent,'done',{...files['response/response.json'].fields,restatement:'response/restatement.md'});delete done.goalCheck;await f.accept(parent,done);
 return{reading,parent,files};
}

async function freezeForecast(f) {
 const state=f.state(),forecast={chain:state.chain,steps:state.steps,goals:{},presets:{},nodes:{},dependencies:{},evidenceDependencies:{},reasons:{},imports:{},fanout:{},handoffs:{},resumes:{}};
 for(const cell of state.chain.flat()) {const r=JSON.parse(readFileSync(path.join(f.branch(cell),'request/request.json')));forecast.goals[cell]=r.goal;forecast.presets[cell]=r.requirements;forecast.nodes[cell]=cell;forecast.dependencies[cell]=cell==='1/1'?[]:['1/1'];forecast.evidenceDependencies[cell]=[];if(r.resume)forecast.resumes[cell]=`${r.resume.step}/${r.resume.parallel}`;}
 // Preserve the backend impact's real outstanding verification lanes in the forecast. These
 // future operators are planned only; this mapping test never claims their runtime or results.
 for(const [cell,operator,goal,dependency]of [['5/1','runtime.serve',{prerequisite:'7/1'},'4/1'],['6/1','quality.verify',{doneWhen:state.mission.doneWhen.findIndex(line=>line.producedBy==='quality.verify')},'4/1'],['7/1','api.verify',{doneWhen:state.mission.doneWhen.findIndex(line=>line.producedBy==='api.verify')},'5/1']]) {
  forecast.chain.push([cell]);forecast.steps[cell]=operator;forecast.goals[cell]=goal;forecast.presets[cell]={};forecast.nodes[cell]=`pending:${operator}`;forecast.dependencies[cell]=[dependency];forecast.evidenceDependencies[cell]=[dependency];
 }
 state.planned=Object.fromEntries(Object.entries(forecast.presets).map(([cell,requirements])=>[cell,{requirements}]));
 const address=await retainContext(f.session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:1,scopeHash:scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});state.planHistory={active:address,revisions:[address]};f.save(state);
}

async function acceptBind(f,request) {
 const route={...resolveWorkspaceCheckout({source:f.source,project:f.project,role:f.role,sessionId:f.sessionId,checkout:'session',declaredWriteRoots:request.requirements.declaredWriteRoots}),identityFingerprint:sha('fixture-roster'),authorityRoots:{businesses:null},runtime:null,provenanceHeadRef:null};
 const c=route.checkout,dir=f.branch(`${request.step}/${request.parallel}`);
 const md=`# workspace-route-binding — ${f.project}/be\n`+table('Binding',['Field','Value'],[['Project',f.project],['Role','be'],['Portable route',route.portableRouteRef],['Hydrated route',route.hydratedRouteRef],['Source head',route.sourceHead]])+table('Checkout',['Field','Value'],[['Disk path',c.diskPath],['Git root',c.gitRoot],['Git repository',c.gitRepository],['Branch',c.branch],['Repository kind',c.repositoryKind],['Directory',c.directory??'—'],['Source head',c.sourceHead],['Mutation readiness',route.mutationReadiness],['Businesses root','—'],['Installed tree',installedTreeOf(c.diskPath).label]])+table('Policy',['Field','Value'],[['Worktree branches','session-only'],['Mutation branch','main']])+table('Write roots',['Path','Why'],route.writeRoots.map(r=>[r,'Exact fixture ownership']))+table('Runtime',['Field','Value'])+table('Findings',['Code','Subject','Statement'],[['`ROUTE_HYDRATED_FROM_PORTABLE`',route.hydratedRouteRef,'Measured fixture route'],['`IDENTITY_ROSTER_SEALED`','roster','Named fixture roster'],['`WORKTREE_BRANCH_SESSION_ONLY`','main','Registered session branch']]);
 f.write(path.join(dir,'response/data/route.json'),route);f.write(path.join(dir,'response/response.md'),md);
 const response=f.response(request,'done',{'workspace-route-binding':'response/response.md',route:'response/data/route.json'});delete response.goalCheck;
 assert.equal((await f.accept(request,response)).state,'matched');return route;
}

async function coordinationPeers(f) {
 const { openSession: open, confirmSession: confirm, discoveryFor: discover } = await f.load('scripts/v23-test-fixture.mjs');
 const peers = {};
 for (const [id, mode, draft] of [['rebind-coordinator','coordinated',false],['shared-donor','solo',false],['shared-producer','solo',true]]) {
  const worktree=path.join(f.temporary,id);git(f.canonical,'worktree','add','--quiet','-b',`session/${id}`,worktree,f.baseHead);
  const sessions=path.join(worktree,'.worktrees/sessions'),project=`${id}-${sha(sessions).slice(7,15)}`;
  const discovery=discover(project,{head:f.baseHead,tags:['backend','architecture']});discovery.repositories[0].repository=f.origin;discovery.impacts[0].code=['src/shared'];
  f.write(path.join(f.source,`.workspaces/projects/${project}/workflow.json`),{version:1,project,ownerRole:'be'});
  f.write(path.join(f.source,`.workspaces/local/routes/${project}/be/config.json`),{project,role:'be',source:{path:f.source},repository:{diskPath:worktree,gitRepository:f.origin}});
  const opened=await open(sessions,{sessionId:id,project:id,topology:{mode},hostBinding:{kind:'codex-task',hostId:`task-${id}`,worktree,sourcePromptRef:'user:rebind-fixture'},mission:{language:'en',goal:mode==='coordinated'?'Coordinate the bounded worker and shared implementation.':'Implement the bounded shared worker.',target:'Disposable shared source',includes:['Declared stateless source'],excludes:['Product source and services'],outputs:['Accepted source evidence'],doneWhen:[{producedBy:mode==='coordinated'?'workflow.verify':'backend.generate',evidence:'The declared source outcome is proved.'}],verification:'Validate source evidence and repository ownership.',sourceRef:'user:rebind-fixture',discovery}});
  if(!draft)await confirm(opened.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:rebind-peer-confirmed'});
  peers[id]={...opened,worktree};
 }
 return{coordinator:peers['rebind-coordinator'],donor:peers['shared-donor'],producer:peers['shared-producer']};
}

// Deliberately malformed mapping candidates are sealed in new disposable context files and
// passed as local state values only. They never replace the real ledger or accepted attempts.
async function mappingVariant(f, change) {
 const original=f.state(),record=JSON.parse(readFileSync(path.join(f.session,original.planHistory.active.ref))),forecast=structuredClone(record.forecast);
 change(forecast);
 const planned=Object.fromEntries(Object.keys(forecast.steps).map(cell=>[cell,{requirements:forecast.presets[cell]??{}}]));
 const address=await retainContext(f.session,'plans',{...record,previous:original.planHistory.active,forecast,planned});
 return{...original,chain:forecast.chain,steps:{...original.steps,...forecast.steps},planned:{...original.planned,...planned},planHistory:{active:address,revisions:[...original.planHistory.revisions,address]}};
}

test('a genuine retry rebind keeps its own inputs while the selected source and fake suffixes remain dependent', {timeout:180000}, async t=>{
 const f=await fixture(t,{backend:true});await architecture(f);
 const r=f.request('4/1','backend.generate',{featureId:'fixture',outcome:'Implement the bounded fixture contract.',mutableFileRefs:['src/**','extra/**'],protectedRefs:['foreign/**'],mode:'apply',scope:'full',resume:null},[{alias:'@workspaces/be',head:f.sessionHead},{alias:'@knowledge/patterns/be',head:null}]);
 r.inputs={'architecture-decision':'step-3/parallel-1/response/response.md'};r.environment.workspace={alias:'@workspaces/be',worktree:f.selected,revision:f.sessionHead};r.environment.writes=['@workspaces/be/branch/session/src','@workspaces/be/branch/session/extra','response'];r.environment.exclusive=[f.selected];
 await f.open(r);f.write(path.join(f.selected,'extra/prepared.txt'),'The declared source request owns this prepared file; its earlier checkout binding lacks the root.\n');
 const changes='# changes — backend.generate step-4/parallel-1\n'+table('Binding',['Field','Value'],[['Operator','backend.generate'],['Step','4/1'],['Checkout','@workspaces/be'],['Predecessor',r.inputs['architecture-decision']]])+table('Files',['Path','Change','Why','Claims'],[['extra/prepared.txt','created','The original request owns the root but the accepted checkout binding does not.','bounded']])+'\n## What the next step must know\n\nRebind the exact request-owned root before continuing the prepared implementation.\n';
 f.write(path.join(f.branch('4/1'),'response/changes.md'),changes);
 const failed=f.response(r,'mismatch',{changes:'response/changes.md'});failed.boundProfile=failed.ranProfile='sol-fresh';failed.fallbacks=['OWNER_WIDENED'];
 assert.equal((await f.accept(r,failed)).state,'mismatched');await freezeForecast(f);
 const flags={edit:{kind:'retry',cell:'4/1',rebind:{source:'1/1',writeRoots:['src','extra']}}},preview=await f.plans.previewRevision(f.runtime,f.session,flags);
 const committed=await f.plans.commitRevision(f.runtime,f.session,{flags,previewHash:preview.previewHash,reason:'Rebind the exact previously authorized prepared source root, retaining the failed source evidence.'});
 assert.deepEqual(f.plans.planHistoryErrors(f.session,f.state()),[]);
 const forecast=committed.forecast,originalDependency={cells:['4/1'],nodes:[forecast.nodes['4/1']],kind:'backend-source-application'};
 assert.equal(forecast.steps['5/1'],'workspace.bind');assert.equal(forecast.steps['6/1'],'backend.generate');
 assert.deepEqual(forecast.rebinds['5/1'],{source:'1/1',retry:'6/1'});
 assert.equal(forecast.retries['6/1'].rebind,'5/1');assert.equal(forecast.goals['5/1'].prerequisite,'6/1');
 const {dependencyContainsCell,coordinationAdmissionErrors,enrolWorkflow,assignWorkflows,prepareExtraction,activateExtraction}=await f.load('scripts/workflow-coordination.mjs');

 await t.test('retained original-node semantics exempt only the sealed auxiliary binding relationship',async()=>{
  // This original dependency is a mapping input, not a fabricated resolved assignment or proof.
  // Public assignment coverage below selects the still-unopened retry in the real ledger.
  assert.equal(await dependencyContainsCell(f.session,f.state(),originalDependency,'5/1'),false);
  assert.equal(await dependencyContainsCell(f.session,f.state(),originalDependency,'6/1'),true);
  for(const [label,change,cell]of [
   ['source node named rebind',p=>{p.nodes['6/1']=`${p.nodes['4/1']}:rebind`;},'6/1'],
   ['suffix without relationship',p=>{delete p.rebinds['5/1'];},'5/1'],
   ['wrong auxiliary operator',p=>{p.steps['5/1']='backend.generate';},'5/1'],
   ['missing reciprocal retry',p=>{delete p.retries['6/1'].rebind;},'5/1'],
   ['wrong prerequisite',p=>{p.goals['5/1']={prerequisite:'4/1'};},'5/1'],
   ['wrong original binding owner',p=>{p.rebinds['5/1'].source='4/1';},'5/1']
  ]) assert.equal(await dependencyContainsCell(f.session,await mappingVariant(f,change),originalDependency,cell),true,label);
  const historicalBind=await mappingVariant(f,p=>{p.chain=p.chain.filter(step=>!step.includes('1/1'));for(const field of ['steps','goals','presets','nodes','dependencies','evidenceDependencies','requestRefs'])delete p[field]?.['1/1'];});
  assert.equal(historicalBind.steps['1/1'],'workspace.bind');
  assert.equal(await dependencyContainsCell(f.session,historicalBind,originalDependency,'5/1'),false,'the exact accepted binding can be retained outside the active forecast');
 });

 const {coordinator,donor,producer}=await coordinationPeers(f);
 for(const peer of [{session:f.session},donor])await enrolWorkflow(f.runtime,peer.session,coordinator.sessionId);
 await assignWorkflows(f.runtime,coordinator.session,{id:'rebind-owners',claims:[{sessionId:f.sessionId,role:'be',root:'extra'},{sessionId:donor.sessionId,role:'be',root:'src/shared'}]});
 const prepared=await prepareExtraction(f.runtime,coordinator.session,{id:'shared-for-retry',donorSessionId:donor.sessionId,producerSessionId:producer.sessionId,operatorId:'backend.generate',selections:[{impactId:'bounded',roots:['src/shared']}],dependencies:[{consumerSessionId:f.sessionId,kind:'backend-source-application',cells:['6/1']}]});
 await enrolWorkflow(f.runtime,producer.session,coordinator.sessionId,{preparation:prepared});
 const assignment=await activateExtraction(f.runtime,coordinator.session,prepared),coordination={coordinatorSessionId:coordinator.sessionId,assignment};
 const retry={...structuredClone(r),step:6,coordination,attempt:{id:'6/1:a2',number:2,kind:'retry',previous:r.attempt.id}};retry.environment.isolationId=retry.attempt.id;
 const method='Reverify the prepared implementation through its newly accepted exact checkout binding.';f.write(path.join(f.branch('6/1'),'request/artifacts/rebind-method.md'),method);retry.frozenInputs=[{ref:'request/artifacts/rebind-method.md',sha256:sha(method)}];
 const bind={...structuredClone(f.bind),step:5,coordination,goal:{prerequisite:'6/1'},requirements:forecast.presets['5/1'],attempt:{id:'5/1:a1',number:1,kind:'initial',previous:null}};bind.expected.sourceRef='state.json#mission:v1/prerequisite:6/1';bind.environment.isolationId=bind.attempt.id;

 await t.test('public dependency parks source while its exact bind opens with route contexts and no producer Input',async()=>{
  assert.deepEqual(bind.inputs,{});assert.ok(bind.contexts.some(context=>context.alias===`@workspaces/local/routes/${f.project}/be`));
  assert.deepEqual(await coordinationAdmissionErrors(f.runtime,f.session,f.state(),bind),[]);
  assert.equal((await f.open(bind)).state,'opened');await acceptBind(f,bind);
  assert.match((await coordinationAdmissionErrors(f.runtime,f.session,f.state(),retry)).join('\n'),/COORDINATION_WAIT/);
  const before=readFileSync(f.stateFile);
  await assert.rejects(f.open(retry),/COORDINATION_WAIT/);
  assert.deepEqual(readFileSync(f.stateFile),before,'refused source cannot acquire an attempt or worker reservation');
  assert.equal(f.state().attempts['6/1'],undefined);
  assert.equal(f.state().attempts['5/1'].status,'matched');
 });
 assert.deepEqual(f.plans.planHistoryErrors(f.session,f.state()),[]);
 assert.equal(readFileSync(path.join(f.branch('4/1'),'response/changes.md'),'utf8'),changes);
 assert.equal(readFileSync(path.join(f.selected,'extra/prepared.txt'),'utf8'),'The declared source request owns this prepared file; its earlier checkout binding lacks the root.\n');
});
