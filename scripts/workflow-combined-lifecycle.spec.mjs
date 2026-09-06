// Actual current A/B -> extracted C -> recorded source incorporation -> integrated runtime ->
// API/browser -> workflow.verify lifecycle. This is a runtime regression fixture, not product UAT.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import path from 'node:path';
import {createSharedSourceFixture,incorporateAndRegress} from './workflow-shared-source-fixture.mjs';
import {acceptQuality,read,put,git,sha,current,actual,planCells,open,accept} from './workflow-source-fixture.mjs';
import {startFixtureApi,acceptRuntimeObservation,acceptApiVerification,acceptUatPlan,acceptBrowserVerification,transformWalksFor,judgeTransformExperience,API_SUITE_REF,API_SUITE_SOURCE} from './workflow-verifier-fixture.mjs';
import {startInterfaceRuntime,acceptInterface,acceptAudit,acceptInterfaceQuality} from './workflow-interface-fixture.mjs';
import * as runtimeIntegration from './workflow-runtime-integration-fixture.mjs';
import {playwrightInstallStatus} from './browser-walk.mjs';
import {hostRootOf} from './validate-request.mjs';

const goal=(f,operator)=>({doneWhen:f.state().mission.doneWhen.findIndex(line=>line.producedBy===operator)});
const combinedCells = {
 'consumer-a':['workspace.bind','architecture.decide','architecture.decide','backend.generate','backend.generate','runtime.serve','quality.verify','api.verify'],
 'producer-c':['workspace.bind','architecture.decide','architecture.decide','backend.generate','runtime.serve','quality.verify','api.verify'],
 'consumer-b':['workspace.bind','workspace.bind','architecture.decide','architecture.decide','backend.generate','backend.generate','interface.generate','runtime.serve','runtime.serve','runtime.serve','interface.audit','quality.verify','api.verify','runtime.serve','uat.plan','uat.verify','quality.verify','api.verify','runtime.serve','runtime.serve','quality.verify']
};
async function freezeCompleteGraph(f){
 const cells=combinedCells[f.sessionId].map((id,index)=>[index+1,id]);
 planCells(f,cells);
 const {loadOperatorPackages}=await f.load('scripts/operator-md.mjs'),{loadOperatorGraph,validateChain}=await f.load('scripts/validate-chain.mjs');
 const packages=await loadOperatorPackages(f.root),graph=await loadOperatorGraph(f.root,packages),state=f.state(),planned={};
 for(const [step,id] of cells)if(id==='workspace.bind')planned[`${step}/1`]={requirements:{role:f.sessionId==='consumer-b'&&step===1?'fe':'be'}};
 for(const [step,id] of cells)if(id==='uat.verify')planned[`${step}/1`]={requirements:{access:'anonymous',fixtures:'none',sourceRoles:'full'}};
 assert.deepEqual(validateChain(f.root,packages,state.chain,state.steps,{}, {mission:state.mission,planned,graph}),[],`${f.sessionId}: complete frozen delivery graph before any operator execution`);
}
async function openCoordinatorProof(f,peers,assignment){
 const {a,b,c,coordinator}=f,state=coordinator.state(),coordination=f.at(assignment);
 const dependencies=read(path.join(coordinator.session,assignment.ref)).dependencies;
 state.brief.peers=Object.fromEntries(Object.entries(peers).map(([id,peer])=>[id,{owns:peer.owns,head:null,heads:peer.heads.map(({alias,head})=>({alias,head}))}]));
 put(path.join(coordinator.session,'state.json'),state);planCells(coordinator,[[1,'workflow.verify']]);
 const {WORKFLOW_PEERS}=await coordinator.load('scripts/workflow-verification.mjs');
 const contexts=[a,b,c,coordinator].map(peer=>({alias:`@worktrees/sessions/${peer.sessionId}`,head:null}));
 const request=current(coordinator,{operatorId:'workflow.verify',contexts,requirements:{peers:WORKFLOW_PEERS},inputs:{}},1,{goal:{doneWhen:0},workspace:false,coordination});
 const snapshot={version:2,peers,coordination:{assignment,consumers:[a,b].map(peer=>({dependencyId:dependencies.find(row=>row.consumerSessionId===peer.sessionId&&row.kind==='backend-source-application').id,incorporation:{step:peer.consumerStep,parallel:1,kind:'backend-source-application'},regression:{step:peer===a?7:21,parallel:1,kind:'quality-verification'}})),combined:{sessionId:b.sessionId,step:16,parallel:1,kind:'uat-flow-verification'}}};
 const dir=path.join(coordinator.session,'step-1/parallel-1');put(path.join(dir,WORKFLOW_PEERS),snapshot);
 request.frozenInputs=[{ref:WORKFLOW_PEERS,sha256:sha(readFileSync(path.join(dir,WORKFLOW_PEERS)))}];await open(coordinator,request);
 return{dir,request,snapshot};
}
function coordinatorResponse(request,reportRef){
 const response=actual(request,{fields:{'workflow-verification-report':reportRef},fallbacks:[],commits:[],next:[]},'done',[reportRef]);
 response.outcome={summary:'Every original peer outcome and the actually tested integrated tuple is recorded.',primary:{kind:'table',label:'Workflow verification',ref:reportRef}};
 return response;
}
async function terminal(f){
 const {goalLedger,validateSession}=await f.load('scripts/validate-session.mjs'),state=f.state();
 const ledger=await goalLedger(f.session,state);
 for(let i=0;i<state.mission.doneWhen.length;i++)assert.ok(ledger.some(row=>row.doneWhen===i&&row.achieved&&state.attempts[row.branch]?.status==='matched'),`original ${f.sessionId} doneWhen:${i} lacks accepted proof`);
 state.status='done';state.brief.blocked=[];state.brief.proven=state.mission.doneWhen.map((line,i)=>`doneWhen:${i} ${line.evidence}`);state.brief.next='Original accepted outcome available to its coordinator.';
 put(path.join(f.session,'state.json'),state);
 const checked=await validateSession(f.root,f.session,{uncheckedRoot:f.source});assert.deepEqual(checked.errors,[],f.sessionId+' full current session');
 return state;
}

test('complete frozen A/B/C graphs and coordinator admission validate before product execution',async t=>{
 const f=await createSharedSourceFixture(t,{interfaceConsumer:true,planningOnly:true,beforeExecution:freezeCompleteGraph});
 for(const peer of [f.a,f.b,f.c])assert.deepEqual(peer.state().attempts??{}, {}, 'planning never fabricates an operator acceptance');
 const peers=Object.fromEntries([f.a,f.b,f.c].map(peer=>[peer.state().hostBinding.hostId,{sessionId:peer.sessionId,goal:peer.state().mission.goal,owns:`The original ${peer.sessionId} outcome`,heads:[{alias:'@workspaces/be',head:git(peer.worktree,'rev-parse','HEAD'),deliveryDoneWhen:peer.state().mission.doneWhen.map((_,i)=>i)},...(peer.feWorktree?[{alias:'@workspaces/fe',head:git(peer.feWorktree,'rev-parse','HEAD'),deliveryDoneWhen:[2,3,4,5]}]:[])],doneWhen:[f.coordinator.state().mission.doneWhen[0].evidence]}]));
 const {request}=await openCoordinatorProof(f,peers,f.extracted);
 assert.equal(f.coordinator.state().attempts['1/1'].status,'running','admission freezes an invocation, never successful portfolio evidence');
 const {loadOperatorPackages}=await f.coordinator.load('scripts/operator-md.mjs'),{outcomeErrors}=await f.coordinator.load('scripts/validate-response.mjs');
 const {WORKFLOW_REPORT}=await f.coordinator.load('scripts/workflow-verification.mjs'),pkg=(await loadOperatorPackages(f.root)).find(pkg=>pkg.manifest.id==='workflow.verify');
 // Presentation-contract data is outside every session. It supplies no accepted peer result.
 const shapeDir=path.join(f.a.home,'coordinator-output-shape');put(path.join(shapeDir,WORKFLOW_REPORT),{fixture:'presentation contract only; not an accepted verification'});
 const response=coordinatorResponse(request,WORKFLOW_REPORT);
 assert.deepEqual(await outcomeErrors(f.root,shapeDir,response,pkg),[],'the actual final receipt helper must obey the declared workflow.verify table/data output');
 response.outcome.primary.kind='document';
 assert.match((await outcomeErrors(f.root,shapeDir,response,pkg)).join('\n'),/not an allowed primary kind|declared Output type/);
});

test('three current workflows extract one writer and prove both consumers in one actual FE/BE runtime',async t=>{
 const fixtureRoot=path.resolve(import.meta.dirname,'..'),browserHostRoot=process.env.STARCI_WALK_HOST_ROOT??hostRootOf(fixtureRoot);
 assert.ok(playwrightInstallStatus(browserHostRoot,fixtureRoot).present,'install the existing host Playwright dependency or set STARCI_WALK_HOST_ROOT before the full lifecycle');
 const pkg={private:true,type:'module',engines:{node:process.version},scripts:{build:'node --test src/modules/fixture/worker.spec.mjs',dev:'node '+runtimeIntegration.INTEGRATION_SERVER_REF}};
 const f=await createSharedSourceFixture(t,{interfaceConsumer:true,beforeExecution:freezeCompleteGraph,initialFiles:{'package.json':JSON.stringify(pkg,null,2)+'\n',[runtimeIntegration.INTEGRATION_SERVER_REF]:runtimeIntegration.INTEGRATION_SERVER_SOURCE},sharedFiles:c=>{
  const declaration=read(path.join(c.worktree,'package.json'));declaration.scripts['test:e2e']='node '+API_SUITE_REF;
  return{'package.json':JSON.stringify(declaration,null,2)+'\n','src/modules/fixture/worker.mjs':"export function runFixtureWorker(value){if(typeof value!=='string')throw new TypeError('string required');return value.toUpperCase();}\n",'src/modules/fixture/worker.spec.mjs':"import test from 'node:test';import assert from 'node:assert/strict';import {runFixtureWorker} from './worker.mjs';test('shared valid repeated empty invalid and concurrent values',async()=>{assert.equal(runFixtureWorker('hello'),'HELLO');assert.equal(runFixtureWorker(''),'');assert.throws(()=>runFixtureWorker(null),TypeError);assert.deepEqual(await Promise.all(['a','b','a'].map(async v=>runFixtureWorker(v))),['A','B','A']);});\n",[API_SUITE_REF]:API_SUITE_SOURCE};
 }});
 const {a,b,c,coordinator}=f,coordination=f.at(f.resolved);
 // This authored fixture explicitly authorizes a finite five-observation runtime sequence before
 // executing it; it neither raises live user budgets nor fabricates any accepted result.
 const budget=b.state();budget.choices['budget:combined-fixture']={selected:'continue',selectedBy:'user',sourceRef:'user:fixture-authorized-bounded-combined-runtime-sequence'};budget.budget.extensions=[{decisionId:'budget:combined-fixture',maxSteps:24,maxSameOperator:6}];put(path.join(b.session,'state.json'),budget);
 const aDelivery=await incorporateAndRegress(f,a,{quality:false}),bDelivery=await incorporateAndRegress(f,b,{quality:false});
 t.diagnostic('A/B independent source and exact C import/incorporation accepted; consumer source tests executed.');
 planCells(a,[[6,'runtime.serve'],[7,'quality.verify'],[8,'api.verify']]);
 const aRuntime=await startFixtureApi(t,a,{writerRef:a.writerRef}),aBefore=await acceptRuntimeObservation(a,aRuntime,{step:6,goal:{prerequisite:'8/1'},coordination});
 aDelivery.quality=await acceptQuality(a,aDelivery.source,{step:7,goal:goal(a,'quality.verify'),coordination});
 await acceptApiVerification(a,aRuntime,aBefore,{step:8,goal:goal(a,'api.verify'),coordination});
 await terminal(a);
 planCells(c,[[5,'runtime.serve'],[6,'quality.verify'],[7,'api.verify']]);
 const cRuntime=await startFixtureApi(t,c),cBefore=await acceptRuntimeObservation(c,cRuntime,{step:5,goal:{prerequisite:'7/1'},coordination});
 await acceptQuality(c,c.deliverySource,{step:6,goal:goal(c,'quality.verify'),coordination});
 await acceptApiVerification(c,cRuntime,cBefore,{step:7,goal:goal(c,'api.verify'),coordination});
 await terminal(c);
 t.diagnostic('A and C complete original source/API/quality missions pass full session validation.');
 // FE source is observed before its candidate is served by the new BE integration. Its audit and
 // scored browser journey run later against the actual proxy to that integration.
 const frontend=await startInterfaceRuntime(t,b,{apiEndpoint:aRuntime.endpoint});
 const feSource=await acceptInterface(b,frontend,b.interfaceRoute,{step:7,coordination,browserHostRoot});
 const integrated=await runtimeIntegration.acceptRuntimeIntegration(b,{targetHead:aDelivery.source.head,baseHead:bDelivery.source.head,worktree:path.join(b.home,'integrated-be')},{step:8,goal:{prerequisite:'9/1'},coordination,t,changes:bDelivery.source.changesRef});
 try{
  assert.deepEqual(git(integrated.entry.server.worktree,'show','-s','--format=%P','HEAD').split(' '),[bDelivery.source.head,aDelivery.source.head]);
  assert.equal(git(b.worktree,'rev-parse','HEAD'),bDelivery.source.head,'runtime integration does not advance the consumer source checkout');
  const served=await (await fetch(integrated.endpoint+'?value=hello')).json();assert.deepEqual(served,{value:'HELLO',consumers:['consumer-a','consumer-b']});
  // A separate real FE server now proxies only the integrated endpoint; no in-process worker can
  // satisfy the browser assertions. The first server was used only by source captures.
  const servingFE=await startInterfaceRuntime(t,b,{apiEndpoint:integrated.endpoint});
  const beforeBE=await acceptRuntimeObservation(b,integrated,{step:9,goal:{prerequisite:'13/1'},coordination,worktree:integrated.entry.server.worktree,wantedCommit:bDelivery.source.head});
  await acceptRuntimeObservation(b,servingFE,{step:10,goal:{prerequisite:'11/1'},coordination,role:'fe',worktree:b.feWorktree});
  const audit=await acceptAudit(b,servingFE,feSource,b.interfaceRoute,{step:11,coordination,browserHostRoot});
  const quality=await acceptInterfaceQuality(b,feSource,audit,{step:12,coordination});
  const repository=f.canonicalRepository(b.repository),feRepository=f.canonicalRepository(b.feRepository);
  const repositories=[{repository,head:integrated.head,contributions:[{sessionId:a.sessionId,head:aDelivery.source.head},{sessionId:b.sessionId,head:bDelivery.source.head},{sessionId:c.sessionId,head:c.deliverySource.head}]},{repository:feRepository,head:feSource.head,contributions:[{sessionId:b.sessionId,head:feSource.head}]}];
  const selector=step=>({sessionId:b.sessionId,step,parallel:1});
  const integration={criterionId:'combined',repositories,runtime:[{alias:'@workspaces/be',routeKey:`${b.state().project}/be`,before:selector(9),after:selector(19),verification:{...selector(18),kind:'api-verification'}},{alias:'@workspaces/fe',routeKey:`${b.state().project}/fe`,before:selector(14),after:selector(20),verification:{...selector(16),kind:'uat-flow-verification'}}]};
  const combined={...coordination,integration},criteria=[{id:'combined',required:true,expected:'Both delivered consumers and their shared producer work in the same served FE/BE tuple.',verification:'Run actual HTTP requests and browser actions against the bracketed immutable runtime tuple containing every contribution.'}];
  await acceptApiVerification(b,integrated,beforeBE,{step:13,goal:goal(b,'api.verify'),pinnedHead:bDelivery.source.head,coordination});
  await acceptRuntimeObservation(b,servingFE,{step:14,goal:{prerequisite:'16/1'},coordination,role:'fe',worktree:b.feWorktree});
  const plan=await acceptUatPlan(b,{step:15,goal:{prerequisite:'16/1'},coordination});
  const uat=await acceptBrowserVerification(b,{plan,audit,quality,route:b.interfaceRoute,runtime:servingFE,feWorktree:b.feWorktree,beHead:bDelivery.source.head},{step:16,goal:goal(b,'uat.verify'),coordination:combined,criteria,browserHostRoot,walksFor:transformWalksFor,judgeExperience:judgeTransformExperience});
  await acceptInterfaceQuality(b,feSource,audit,{step:17,coordination,uat});
  await acceptApiVerification(b,integrated,beforeBE,{step:18,goal:goal(b,'api.verify'),pinnedHead:bDelivery.source.head,coordination:combined,criteria});
  await acceptRuntimeObservation(b,integrated,{step:19,goal:{prerequisite:'21/1'},coordination,worktree:integrated.entry.server.worktree,wantedCommit:bDelivery.source.head});
  await acceptRuntimeObservation(b,servingFE,{step:20,goal:{prerequisite:'21/1'},coordination,role:'fe',worktree:b.feWorktree});
  await acceptQuality(b,bDelivery.source,{step:21,goal:goal(b,'quality.verify'),coordination});
  await terminal(b);t.diagnostic('B complete source/API/wide+narrow audit/browser UAT/quality mission passes full session validation.');
  const {buildWorkflowVerification,WORKFLOW_PEERS,WORKFLOW_REPORT}=await b.load('scripts/workflow-verification.mjs');
  const peers={};
  for(const peer of [a,b,c]){
   const state=peer.state(),heads=peer===b?[{alias:'@workspaces/be',head:bDelivery.source.head,deliveryDoneWhen:[0,1,5,6]},{alias:'@workspaces/fe',head:feSource.head,deliveryDoneWhen:[2,3,4,5]}]:[{alias:'@workspaces/be',head:git(peer.worktree,'rev-parse','HEAD'),deliveryDoneWhen:state.mission.doneWhen.map((_,i)=>i)}];
   peers[state.hostBinding.hostId]={sessionId:state.id,goal:state.mission.goal,owns:peer===c?'The extracted shared worker':`The original ${state.id} outcome`,heads,doneWhen:[coordinator.state().mission.doneWhen[0].evidence]};
  }
  const {dir,request}=await openCoordinatorProof(f,peers,f.resolved);
  const built=await buildWorkflowVerification(f.root,dir,request,coordinator.state(),{hostRoot:f.source});assert.deepEqual(built.errors,[]);
  put(path.join(dir,WORKFLOW_REPORT),built.report);await accept(coordinator,request,coordinatorResponse(request,WORKFLOW_REPORT));
  await terminal(coordinator);assert.equal(built.report.coordination.edges.length,2);assert.equal(built.report.coordination.combined.runtime.length,2);
  assert.ok(built.report.coordination.edges.every(edge=>edge.incorporation.sourceReceipts.length===1));
  t.diagnostic('Coordinator workflow.verify accepted exact shared imports, recorded merge receipts, both regressions and one actually tested integrated FE/BE tuple.');
 }finally{await integrated.stop();}
});
