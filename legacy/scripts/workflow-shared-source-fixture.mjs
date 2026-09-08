// Actual A/B/C source lifecycle, built only through current original accept gates and the public
// consumer-owned incorporation command. Repository baseline material is disposable test input.
import assert from 'node:assert/strict';
import path from 'node:path';
import {createSourceFixture,acceptArchitecture,acceptBackend,acceptQuality,planCells,git,read,put} from './workflow-source-fixture.mjs';
import {createInterfaceFixture,acceptInterfaceRoute} from './workflow-interface-fixture.mjs';

export async function createSharedSourceFixture(t,{interfaceConsumer=false,initialFiles={},sharedFiles=null,beforeExecution=null,planningOnly=false}={}){
 const mission=code=>({discovery,root})=>{
  const scoped={...discovery,impacts:discovery.impacts.map(impact=>impact.role==='be'?{...impact,code,...(interfaceConsumer?{tags:['backend']}: {})}:impact)};
  if(interfaceConsumer){const tags=new Set(scoped.impacts.flatMap(impact=>impact.tags)),policy=read(path.join(root,'resources/delivery.json'));
   scoped.lanes=Object.fromEntries(Object.entries(scoped.lanes).map(([id,lane])=>[id,policy.lanes[id].when.some(tag=>tags.has(tag))?lane:{status:'not-applicable',reason:'Architecture is an accepted prerequisite; the original promised outcome is implemented and verified source.'}]));
   for(const lane of Object.values(scoped.lanes))if(lane.dependsOn)lane.dependsOn=lane.dependsOn.filter(id=>scoped.lanes[id].status==='planned');
  }return{discovery:scoped};};
 const a=await createSourceFixture(t,{sessionId:'consumer-a',mission:mission(['src/modules','package.json']),initialFiles,...(interfaceConsumer?{tags:['backend']}: {})});
 git(a.repository,'config','user.name','Fixture');git(a.repository,'config','user.email','fixture@example.invalid');
 const b=await (interfaceConsumer?createInterfaceFixture:createSourceFixture)(t,{existing:a,sessionId:'consumer-b',mission:context=>({...mission(['src/consumers/b'])(context),...(interfaceConsumer?{doneWhen:[
  {evidence:'The consumer worker source uses the shared implementation.',producedBy:'backend.generate'},
  {evidence:'The exact consumer backend passes its actual source regression.',producedBy:'quality.verify'},
  {evidence:'The existing form names its action Transform.',producedBy:'interface.generate'},
  {evidence:'The actual served form is audited.',producedBy:'interface.audit'},
  {evidence:'The exact frontend passes source quality and measured browser experience.',producedBy:'quality.verify'},
  {evidence:'The browser observes the actual combined backend result and state continuity.',producedBy:'uat.verify'},
  {evidence:'Actual HTTP cases verify the consumer and combined stateless worker.',producedBy:'api.verify'}
 ]}: {})})});
 const peers=[a,b];
 const coordinator=await createSourceFixture(t,{existing:a,sessionId:'coordinator',topology:{mode:'coordinated'},mission:({discovery,project,source})=>{
  if(interfaceConsumer){
   const original=b.state().mission.discovery.repositories.find(repo=>repo.role==='fe'),routeRef=`.workspaces/local/routes/${project}/fe/config.json`;
   discovery.repositories.push({...original,project,routeRef});
   put(path.join(source,routeRef),{project,role:'fe',source:{path:source},repository:{diskPath:b.feWorktree,gitRepository:b.feRepository}});
  }
  return{
  goal:'Verify both original consumer outcomes and their shared implementation.',doneWhen:[{evidence:'Both consumer outcomes include the accepted shared implementation and pass their combined runtime verification.',producedBy:'workflow.verify'}],
  discovery:{...discovery,destinations:structuredClone(b.state().mission.discovery.destinations),impacts:peers.flatMap(peer=>peer.state().mission.discovery.impacts.map(impact=>({...structuredClone(impact),id:peer.sessionId+'-'+impact.id,producer:{sessionId:peer.sessionId,impactId:impact.id,mission:peer.state().missionSnapshots[1]}}))),lanes:structuredClone(b.state().mission.discovery.lanes)}};}});
 const c=await createSourceFixture(t,{existing:a,sessionId:'producer-c',draft:true});
 const coordination=await a.load('scripts/workflow-coordination.mjs');
 const call=(name,peer,...args)=>coordination[name](a.root,peer.session,...args);
 for(const peer of peers)await call('enrolWorkflow',peer,coordinator.sessionId);
 const initial=await call('assignWorkflows',coordinator,{id:'owners',claims:[{sessionId:a.sessionId,role:'be',root:'src/modules'},{sessionId:a.sessionId,role:'be',root:'package.json'},{sessionId:b.sessionId,role:'be',root:'src/consumers/b'},...(interfaceConsumer?b.state().mission.discovery.impacts.find(impact=>impact.role==='fe').code.map(root=>({sessionId:b.sessionId,role:'fe',root})):[])]});
 const at=assignment=>({coordinatorSessionId:coordinator.sessionId,assignment});
 for(const peer of peers){
  if(beforeExecution)await beforeExecution(peer);
  peer.writerRef=peer===a?'src/modules/a/worker.mjs':'src/consumers/b/worker.mjs';
  const startStep=interfaceConsumer&&peer===b?2:1;peer.consumerStep=startStep+4;
  if(planningOnly){planCells(peer,[[peer.consumerStep,'backend.generate']]);continue;}
  if(startStep===2)peer.interfaceRoute=await acceptInterfaceRoute(peer,{step:1,goal:{prerequisite:'7/1'}});
  const architectureGoal=peer.state().mission.doneWhen.findIndex(line=>line.producedBy==='architecture.decide');
  peer.architecture=await acceptArchitecture(peer,{startStep,writerRef:peer.writerRef,coordination:at(initial),goal:architectureGoal<0?{prerequisite:`${startStep+3}/1`}:{doneWhen:architectureGoal}});
  planCells(peer,[[peer.consumerStep,'backend.generate']]);
 }
 const preparation=await call('prepareExtraction',coordinator,{id:'shared-worker',donorSessionId:a.sessionId,producerSessionId:c.sessionId,operatorId:'backend.generate',selections:[{impactId:'bounded',roots:['src/modules/fixture','package.json']}],dependencies:peers.map(peer=>({consumerSessionId:peer.sessionId,kind:'backend-source-application',cells:[`${peer.consumerStep}/1`]}))});
 await call('enrolWorkflow',c,coordinator.sessionId,{preparation});
 const extracted=await call('activateExtraction',coordinator,preparation);
 if(planningOnly){
  if(beforeExecution)await beforeExecution(c);
  return{a,b,c,coordinator,peers,root:a.root,source:a.source,initial,extracted,at,call,...coordination};
 }
 for(const peer of peers){
  peer.independent=await acceptBackend(peer,peer.architecture,{coordination:at(initial)});
  assert.equal(peer.state().attempts[`${peer.architecture.sourceStep}/1`].status,'matched','independent writer continues on its unchanged earlier assignment');
 }
 const architectureGoal=c.state().mission.doneWhen.findIndex(line=>line.producedBy==='architecture.decide');
 if(beforeExecution)await beforeExecution(c);
 c.architecture=await acceptArchitecture(c,{coordination:at(extracted),goal:architectureGoal<0?{prerequisite:'4/1'}:{doneWhen:architectureGoal}});
 c.deliverySource=await acceptBackend(c,c.architecture,{coordination:at(extracted),files:sharedFiles?await sharedFiles(c):null});
 const importer=await a.load('scripts/producer-import.mjs');
 for(const peer of peers){
  peer.dependencyId=`shared-worker:${peer.sessionId}:backend-source-application`;
  await call('resolveExtraction',coordinator,peer.dependencyId,{step:c.deliverySource.step,parallel:1});
  await importer.importProducer({root:a.root,hostRoot:a.source,sourceSessionId:c.sessionId,sourceStep:c.deliverySource.step,sourceParallel:1,targetSessionId:peer.sessionId,targetStep:100,targetParallel:1});
  peer.importRef='step-100/parallel-1/response/response.md';
 }
 const resolved=coordinator.state().coordination.active;
 return{a,b,c,coordinator,peers,root:a.root,source:a.source,initial,extracted,resolved,at,call,...coordination};
}

export async function incorporateAndRegress(f,peer,{quality=true}={}){
 const receipt=await f.call('incorporateExtraction',peer,peer.dependencyId,{input:peer.importRef,alias:'@workspaces/be',worktree:peer.worktree});
 const merged=read(path.join(peer.session,receipt.ref));
 assert.deepEqual(git(peer.worktree,'show','-s','--format=%P','HEAD').split(' '),[merged.oldHead,f.c.deliverySource.head]);
 assert.deepEqual(await f.call('incorporateExtraction',peer,peer.dependencyId,{input:peer.importRef,alias:'@workspaces/be',worktree:peer.worktree}),receipt,'exact retry reuses the recorded merge');
 const testRef=peer.writerRef.replace(/\.mjs$/,'.spec.mjs');
 const imported=path.posix.relative(path.posix.dirname(peer.writerRef),'src/modules/fixture/worker.mjs');
 const source=await acceptBackend(peer,peer.architecture,{step:peer.consumerStep,coordination:f.at(f.resolved),inputs:{'backend-source-application':peer.importRef},files:{
  [peer.writerRef]:`export { runFixtureWorker } from '${imported.startsWith('.')?imported:'./'+imported}';\n`,
  [testRef]:`import test from 'node:test';\nimport assert from 'node:assert/strict';\nimport {runFixtureWorker} from './worker.mjs';\ntest('consumer actually uses the shared worker',()=>{assert.equal(runFixtureWorker('hello'),'HELLO');assert.equal(runFixtureWorker(''),'');assert.throws(()=>runFixtureWorker(null),TypeError);});\n`
 }});
 const verified=quality?await acceptQuality(peer,source,{step:peer.consumerStep+1,coordination:f.at(f.resolved)}):null;
 return{receipt,merged,source,quality:verified};
}
