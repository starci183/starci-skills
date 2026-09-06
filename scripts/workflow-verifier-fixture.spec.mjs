import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import path from 'node:path';
import {createSourceFixture,acceptArchitecture,acceptBackend,acceptQuality,put,git,planCells} from './workflow-source-fixture.mjs';
import {startFixtureApi,acceptRuntimeObservation,acceptApiVerification,acceptUatPlan,acceptBrowserVerification,transformWalksFor,judgeTransformExperience,API_SUITE_REF,API_SUITE_SOURCE} from './workflow-verifier-fixture.mjs';
import {createInterfaceFixture,startInterfaceRuntime,acceptInterfaceRoute,acceptInterface,acceptAudit,acceptInterfaceQuality} from './workflow-interface-fixture.mjs';

test('current accepted source and runtime bracket a real stateless API verifier, without injected acceptance',async t=>{
 const f=await createSourceFixture(t,{sessionId:'actual-api-fixture',doneWhen:[
  {producedBy:'backend.generate',evidence:'Implement the local stateless API worker and declared runner.'},
  {producedBy:'quality.verify',evidence:'Run the actual source unit gates.'},
  {producedBy:'runtime.serve',evidence:'Measure the healthy local runtime and exact served source.'},
  {producedBy:'api.verify',evidence:'Run actual client HTTP cases against the attested runtime.'},
  {producedBy:'uat.plan',evidence:'Freeze the anonymous browser journey and its actual outcome assertions.'}
 ]});
 const architecture=await acceptArchitecture(f),writer=architecture.operation.writerRef,testRef=writer.replace(/\.mjs$/,'.spec.mjs');
 const pkg=JSON.parse(readFileSync(path.join(f.worktree,'package.json')));pkg.scripts['test:e2e']=`node ${API_SUITE_REF}`;
 const source=await acceptBackend(f,architecture,{files:{
  'package.json':JSON.stringify(pkg,null,2)+'\n',
  [writer]:"export function runFixtureWorker(input) { if (typeof input !== 'string') throw new TypeError('input must be a string'); return input.toUpperCase(); }\n",
  [testRef]:"import test from 'node:test'; import assert from 'node:assert/strict'; import {runFixtureWorker} from './worker.mjs'; test('valid, repeated, empty, invalid and concurrent inputs',async()=>{assert.equal(runFixtureWorker('hello'),'HELLO');assert.equal(runFixtureWorker(''),'');for(const value of [undefined,null,4,{}])assert.throws(()=>runFixtureWorker(value),TypeError);assert.deepEqual(await Promise.all(['a','b','a'].map(async value=>runFixtureWorker(value))),['A','B','A']);});\n",
  [API_SUITE_REF]:API_SUITE_SOURCE
 },testRef});
 await acceptQuality(f,source);
 const runtime=await startFixtureApi(t,f),before=await acceptRuntimeObservation(f,runtime,{step:6});
 const api=await acceptApiVerification(f,runtime,before,{step:7});
 const after=await acceptRuntimeObservation(f,runtime,{step:8});
 const plan=await acceptUatPlan(f,{step:9,goal:{doneWhen:4}});
 assert.equal(plan.sheet.flows[0].access,'anonymous');assert.equal(plan.sheet.cases[0].fixture,null);
 assert.equal(api.cases.cases.length,3);assert.ok(runtime.observed.some(item=>item.value==='hello'));
 const state=f.state();for(const step of [4,5,6,7,8])assert.equal(state.attempts[`${step}/1`].status,'matched');
 assert.ok(Date.parse(state.attempts['6/1'].endedAt)<=Date.parse(state.attempts['7/1'].startedAt));
 assert.ok(Date.parse(state.attempts['7/1'].endedAt)<=Date.parse(state.attempts['8/1'].startedAt));
 assert.equal(before.delta.generation,after.delta.generation);assert.equal(before.entry.server.pid,after.entry.server.pid);
 assert.equal(before.head,api.head);assert.equal(api.head,after.head);
 assert.match(readFileSync(path.join(f.session,'step-7/parallel-1/response/artifacts/api-output.txt'),'utf8'),/valid value is uppercased/);
 const {acceptedProducerProof}=await f.load('scripts/producer-import.mjs');
 const casesFile=path.join(f.session,'step-7/parallel-1/response/data/cases.json'),casesBytes=readFileSync(casesFile);
 for(const change of [value=>{value.endpoint='http://foreign.invalid/api';},value=>{value.servedHead='f'.repeat(40);},value=>{value.startedAt='2020-01-01T00:00:00Z';}]){
  const altered=JSON.parse(casesBytes);change(altered);writeFileSync(casesFile,JSON.stringify(altered));
  try{await assert.rejects(acceptedProducerProof(f.root,f.state().id,7,1,'api-verification',{hostRoot:f.source}),/manifest|changed/);}
  finally{writeFileSync(casesFile,casesBytes);}
 }
 const stateFile=path.join(f.session,'state.json'),stateBytes=readFileSync(stateFile),oldState=JSON.parse(stateBytes);oldState.runtimeRevision-=1;writeFileSync(stateFile,JSON.stringify(oldState));
 try{await assert.rejects(acceptedProducerProof(f.root,oldState.id,7,1,'api-verification',{hostRoot:f.source}),/current runtime revision/);}
 finally{writeFileSync(stateFile,stateBytes);}
});

test('current accepted browser UAT reaches the independent backend and retains state across reload',async t=>{
 const f=await createInterfaceFixture(t,{sessionId:'actual-browser-fixture'});
 assert.notEqual(git(f.worktree,'rev-parse','--git-common-dir'),git(f.feWorktree,'rev-parse','--git-common-dir'));
 const architecture=await acceptArchitecture(f),source=await acceptBackend(f,architecture);await acceptQuality(f,source);
 const backend=await startFixtureApi(t,f),frontend=await startInterfaceRuntime(t,f,{apiEndpoint:backend.endpoint});
 const route=await acceptInterfaceRoute(f),interfaceSource=await acceptInterface(f,frontend,route);
 const audit=await acceptAudit(f,frontend,interfaceSource,route),quality=await acceptInterfaceQuality(f,interfaceSource,audit);
 planCells(f,[[18,'uat.verify']]);const plan=await acceptUatPlan(f,{step:14,goal:{prerequisite:'18/1'}});
 const beforeBE=await acceptRuntimeObservation(f,backend,{step:15,goal:{doneWhen:7}});
 const beforeFE=await acceptRuntimeObservation(f,frontend,{step:16,goal:{doneWhen:7},role:'fe',worktree:f.feWorktree});
 const uat=await acceptBrowserVerification(f,{plan,audit,quality,route,runtime:frontend,feWorktree:f.feWorktree,beHead:source.head},{step:18,goal:{doneWhen:5},browserHostRoot:process.env.STARCI_WALK_HOST_ROOT??f.source,walksFor:transformWalksFor,judgeExperience:judgeTransformExperience});
 const afterFE=await acceptRuntimeObservation(f,frontend,{step:19,goal:{doneWhen:7},role:'fe',worktree:f.feWorktree});
 await acceptInterfaceQuality(f,interfaceSource,audit,{step:20,uat});
 assert.equal(uat.proof.operatorId,'uat.verify');assert.equal(uat.snapshot.provenance.fe,interfaceSource.head);assert.equal(uat.snapshot.provenance.be,source.head);
 assert.notEqual(uat.snapshot.provenance.fe,uat.snapshot.provenance.be);
 assert.ok(backend.observed.some(item=>item.value==='wrong'));assert.ok(backend.observed.filter(item=>item.value==='hello').length>=2);
 assert.equal(beforeFE.head,afterFE.head);assert.equal(beforeBE.head,source.head);
 const state=f.state();assert.ok(Date.parse(state.attempts['16/1'].endedAt)<=Date.parse(state.attempts['18/1'].startedAt));assert.ok(Date.parse(state.attempts['18/1'].endedAt)<=Date.parse(state.attempts['19/1'].startedAt));
 const {acceptedProducerProof}=await f.load('scripts/producer-import.mjs');
 const snapshotFile=path.join(f.session,'step-18/parallel-1/response/data/snapshot.json'),bytes=readFileSync(snapshotFile),changed=JSON.parse(bytes);changed.provenance.be=interfaceSource.head;writeFileSync(snapshotFile,JSON.stringify(changed));
 try{await assert.rejects(acceptedProducerProof(f.root,f.sessionId,18,1,'uat-flow-verification',{hostRoot:f.source}),/manifest|changed/);}finally{writeFileSync(snapshotFile,bytes);}
});
