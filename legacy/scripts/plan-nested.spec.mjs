import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {openSession,confirmSession,cleanupFixtureOwners} from './v23-test-fixture.mjs';
import {retainContext,retainInvocation,invocationState} from './mission-history.mjs';
import {scopeHash} from './mission-scope.mjs';
import {buildEvidenceManifest} from './evidence-manifest.mjs';
import {planAdmissionErrors} from './plan-history.mjs';
const root=path.resolve(import.meta.dirname,'..'),sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const put=async(file,value)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,typeof value==='string'?value:JSON.stringify(value));};

async function fixture(t){
 const owner=await mkdtemp(path.join(os.tmpdir(),'starci-nested-plan-'));
 t.after(async()=>{cleanupFixtureOwners(owner);await rm(owner,{recursive:true,force:true});});
 const opened=await openSession(path.join(owner,'.worktrees/sessions'),{project:'nested',hostBinding:{kind:'codex-task',hostId:path.basename(owner),worktree:owner,sourcePromptRef:'user:opening'},mission:{language:'en',goal:'Decide the system boundary.',target:'The declared boundary',includes:['Independent architecture review'],outputs:['Architecture decision'],doneWhen:[{producedBy:'architecture.decide',evidence:'The reviewed decision is available.'}],verification:'Review the typed decision.',sourceRef:'user:opening'}});
 await confirmSession(opened.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:approved'});
 const session=opened.session,state=JSON.parse(await readFile(path.join(session,'state.json'))),cell='2/1',branch=path.join(session,'step-2/parallel-1'),input='step-2/parallel-1/response/data/stack-model.json';
 const parent={contractVersion:'starci/v2.2',sessionId:state.id,operatorId:'architecture.decide',step:2,parallel:1,goal:{doneWhen:0},resume:{step:1,parallel:1,token:'accepted-reading'},requirements:{},attempt:{id:'2/1:a2',number:2,kind:'retry',previous:'1/1:a1'},expected:{version:1,goalVersion:state.mission.version},frozenInputs:[]};
 const response={contractVersion:'starci/v2.2',operatorId:parent.operatorId,step:2,parallel:1,status:'waiting',fields:{'stack-model':'response/data/stack-model.json'},awaiting:{exchange:'critique',kind:'independent-critique'},attempt:{id:parent.attempt.id,expectedVersion:1}};
 const request={contractVersion:'starci/v2.2',sessionId:state.id,operatorId:parent.operatorId,step:2,parallel:1,exchange:'critique',resume:null,requirements:{},inputs:{'stack-model':input},attempt:{id:'2/1/critique:a1',number:1,kind:'initial',previous:null},expected:{version:1,goalVersion:state.mission.version},frozenInputs:[]};
 await put(path.join(branch,'request/request.json'),parent);await put(path.join(branch,'response/response.json'),response);await put(path.join(branch,'response/data/stack-model.json'),{selected:'bounded'});
 const forecast={chain:[[cell]],steps:{[cell]:parent.operatorId},goals:{[cell]:parent.goal},resumes:{[cell]:'1/1'},units:{[cell]:{id:'parent-unit',input:'parent-units'}},handoffs:{[cell]:'1/1'}};
 state.chain=forecast.chain;state.steps=forecast.steps;state.planned={[cell]:{requirements:{}}};
 const address=await retainContext(session,'plans',{version:1,sessionId:state.id,previous:null,missionVersion:state.mission.version,scopeHash:scopeHash(state.mission),forecast,planned:state.planned,retained:{choices:{},attempts:{},requestHashes:{},steps:{},inventoryCells:[],files:{}}});
 state.planHistory={active:address,revisions:[address]};state.requestHashes={[cell]:sha(await readFile(path.join(branch,'request/request.json')))};
 state.attempts={[cell]:{id:parent.attempt.id,operatorId:parent.operatorId,status:'waiting',expectedVersion:1,expected:parent.expected,endedAt:new Date().toISOString(),requestRef:'step-2/parallel-1/request/request.json',responseRef:'step-2/parallel-1/response/response.json',evidenceManifest:await buildEvidenceManifest(branch)}};
 state.attempts[cell].context=await retainInvocation(session,state,parent,{root});
 return{session,state,request,parent,response,branch,input};
}

test('nested review inherits its sealed parent mapping without inheriting parent resume, unit or handoff fields',async t=>{
 const f=await fixture(t);
 assert.deepEqual(await planAdmissionErrors(root,f.session,f.state,f.request),[]);
 const errors=await planAdmissionErrors(root,f.session,f.state,{...f.parent,goal:{prerequisite:'99/1'},resume:null});
 assert.match(errors.join(),/PLAN_GOAL_UNBOUND/);assert.match(errors.join(),/PLAN_REENTRY_UNBOUND/);
});

test('nested admission refuses fabricated, cross-parent, stale or unsealed review relationships',async t=>{
 const f=await fixture(t);
 for(const change of [r=>{r.goal={doneWhen:0};},r=>{r.resume=f.parent.resume;},r=>{r.operatorId='business.decide';},r=>{r.parallel=2;},r=>{r.sessionId='foreign';},r=>{r.expected.goalVersion+=1;},r=>{r.exchange='../foreign';},r=>{r.exchange='other';},r=>{r.inputs={};},r=>{r.inputs['stack-model']='step-1/parallel-1/response/data/stack-model.json';}]){const request=structuredClone(f.request);change(request);assert.ok((await planAdmissionErrors(root,f.session,f.state,request)).length);}
 for(const change of [s=>{delete s.attempts['2/1'].context;},s=>{delete s.attempts['2/1'].evidenceManifest;},s=>{s.attempts['2/1'].status='running';},s=>{s.requestHashes['2/1']=sha('wrong');}]){const state=structuredClone(f.state);change(state);assert.ok((await planAdmissionErrors(root,f.session,state,f.request)).length);}
 const file=path.join(f.branch,'response/response.json'),bytes=await readFile(file);await put(file,{...f.response,awaiting:{exchange:'critique',kind:'foreign-kind'}});assert.ok((await planAdmissionErrors(root,f.session,f.state,f.request)).length);await writeFile(file,bytes);
 await put(path.join(f.branch,'response/data/stack-model.json'),{selected:'changed-after-acceptance'});assert.match((await planAdmissionErrors(root,f.session,f.state,f.request)).join(),/changed after|fingerprint/);
});

test('exact matched child remains verifiable after parent resume and completion without opening a replacement review',async t=>{
 const f=await fixture(t),child=path.join(f.branch,'critique'),key='2/1/critique';
 const comparison={expectedVersion:1,verdict:'matched',criteria:[],next:'advance'};
 const response={contractVersion:'starci/v2.2',operatorId:f.request.operatorId,step:2,parallel:1,exchange:'critique',status:'done',fields:{'independent-critique':'response/critique.md'},attempt:{id:f.request.attempt.id,expectedVersion:1},comparison};
 await put(path.join(child,'request/request.json'),f.request);await put(path.join(child,'response/response.json'),response);await put(path.join(child,'response/critique.md'),'# sealed independent critique\n');
 f.state.requestHashes[key]=sha(await readFile(path.join(child,'request/request.json')));
 f.state.attempts[key]={id:f.request.attempt.id,operatorId:f.request.operatorId,status:'matched',expectedVersion:1,endedAt:new Date().toISOString(),comparison,requestRef:'step-2/parallel-1/critique/request/request.json',responseRef:'step-2/parallel-1/critique/response/response.json',evidenceManifest:await buildEvidenceManifest(child)};
 f.state.attempts[key].context=await retainInvocation(f.session,f.state,f.request,{root});
 f.state.attempts['2/1'].status='running';const resumed={...f.response,status:'running',fields:{...f.response.fields,'architecture-decision':'response/decision.md'}};delete resumed.awaiting;await put(path.join(f.branch,'response/response.json'),resumed);
 assert.deepEqual(await planAdmissionErrors(root,f.session,f.state,f.request),[]);
 await put(path.join(f.branch,'response/decision.md'),'# completed parent\n');const completed={...resumed,status:'done',comparison};await put(path.join(f.branch,'response/response.json'),completed);
 Object.assign(f.state.attempts['2/1'],{status:'matched',comparison,evidenceManifest:await buildEvidenceManifest(f.branch)});
 assert.deepEqual(await planAdmissionErrors(root,f.session,f.state,f.request),[]);
 assert.ok((await planAdmissionErrors(root,f.session,f.state,{...f.request,attempt:{...f.request.attempt,id:'fabricated-new-review'}})).length);
 const corrected=structuredClone(f.state);corrected.mission.version+=1;
 assert.equal(invocationState(f.session,corrected,f.request).mission.version,f.request.expected.goalVersion,'accept-phase replay restores the actual retained mission instead of binding historical proof to a corrected mission');
 assert.ok((await planAdmissionErrors(root,f.session,corrected,f.request).catch(error=>[error.message])).length,'current dispatch does not reuse the historical child under a changed mission');
 await put(path.join(child,'response/critique.md'),'# altered review\n');assert.match((await planAdmissionErrors(root,f.session,f.state,f.request)).join(),/changed after|fingerprint/);
});
