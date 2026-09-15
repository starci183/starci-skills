import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import {execFile,spawnSync} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import {parseYaml,stringifyYaml} from '../core/yaml.mjs';
import {identitySecretPresent} from '../core/identity.mjs';
import {createInputModel,inputBinding,readInputState,credentialFields,preparationProgress} from '../kernel/inputs-model.mjs';
import {startInputServer,inputFiles,privateJson,INPUT_BODY_LIMIT} from '../kernel/inputs-server.mjs';
import {reconcileWorkflowInputs,recoverWorkflowInputReferences} from '../kernel/inputs.mjs';
import {integrationReadiness,prepareCredentialAsk,preparationFingerprint,relatedIntegrations} from '../kernel/inputs-readiness.mjs';
import {settleFilledAsks,ownerFillLines,askFillLine} from '../kernel/fill.mjs';
import {ownerItems} from '../kernel/owner.mjs';
import {createWorkflowState,deferForIntegrationPreparation,refreshCredentialPreparation,applyOpReport} from '../kernel/kernel.mjs';
import {buildView} from '../kernel/view.mjs';
import {toOp} from '../kernel/common.mjs';
import {declaredIntegrations} from '../kernel/ledger.mjs';
import {createStore} from '../kernel/store.mjs';
import {createOrcaCalls,verifyLiveSchema} from '../hosts/orca/calls.mjs';
import {snapshotCredentialVersions,credentialReplacementFor,credentialVersionChanged} from '../kernel/inputs-replacement.mjs';
import {buildReport,validateReport} from '../kernel/reports.mjs';
import {protocolMain} from '../hosts/orca/protocol.mjs';
import {preparedEntry,inputAsk} from './helpers/input-fixture.mjs';

const host=fileURLToPath(new URL('..',import.meta.url));
const sentinel='SYNTHETIC_INPUT_SENTINEL_ONLY';
const now=()=>Date.parse('2026-09-14T12:00:00Z');
const execFileAsync=promisify(execFile);
const fixture=t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'si-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true}));
  const store=createStore({repoRoot:repo,id:'input-test'}),root=path.join(repo,'.starciwork');
  const state=createWorkflowState({job:'Verify the synthetic service connection',store,host,worktree:repo,branch:'test/input',
    inputs:['srs:features/demo/business/index.yaml','sds:features/demo/architecture/index.yaml'],ledgerRoot:root,scope:['demo']});
  state.approved=true;
  state.ops=[{id:'op-a',kind:'integration.verify',goal:'Check the service connection',status:'paused',waitingFor:'ask-a',attempt:1,dependsOn:[],references:[]},inputAsk('ask-a')];
  store.saveState(state);return {repo,root,store,state,binding:inputBinding(state,store.dir)};
};

test('unprepared credential requirements are workflow research, not actionable owner asks',t=>{
  const f=fixture(t),ask=f.state.ops[1];ask.inputMode='gui';ask.credential.ready=false;
  assert.deepEqual(ownerFillLines(f.state),[]);assert.deepEqual(ownerItems(f.state),[]);
  assert.match(askFillLine(ask),/workflow is researching/);assert.doesNotMatch(askFillLine(ask),/SERVICE_TOKEN|copy and run/);
  f.state.needUser.push({kind:'authority',detail:'Outside the approved project scope'});
  assert.equal(ownerItems(f.state).length,1,'a true authority boundary remains visible');
  ask.credential.ready=true;
  assert.equal(ownerFillLines(f.state).length,2);assert.equal(ownerItems(f.state).length,2);
  assert.match(ownerItems(f.state)[0].how,/Credentials page in Orca/);assert.doesNotMatch(ownerItems(f.state)[0].how,/reply.*set/);
});

test('duplicate credential asks share a researched field and partial input resumes only satisfied requesters',async t=>{
  const f=fixture(t),names=['SERVICE_TOKEN','SERVICE_SECRET'];
  f.state.ops=[{id:'op-a',kind:'integration.verify',status:'paused',waitingFor:'ask-a',attempt:0,dependsOn:[]},
    {id:'op-b',kind:'integration.verify',status:'paused',waitingFor:'ask-b',attempt:0,dependsOn:[]},
    inputAsk('ask-a',names),inputAsk('ask-b',['SERVICE_TOKEN'],{requesters:['op-b']})];
  const held=new Set(),writes=[];
  const present=({name})=>held.has(name);
  const model=createInputModel({binding:f.binding,read:()=>f.state,present,write:async({binding,field,value})=>{
    assert.equal(binding.workRoot,f.root);assert.equal(value,sentinel);writes.push(field.name);held.add(field.name);return {ok:true};}});
  let view=model.snapshot();assert.equal(view.fields.length,2);assert.deepEqual(view.fields[0].asks,['ask-a','ask-b']);
  const sent={entries:[{id:view.fields[0].id,value:sentinel},{id:view.fields[1].id,value:''}]};
  const answer=await model.submit(sent);assert.equal(answer.ok,false);assert.equal(answer.results[1].code,'empty');assert.deepEqual(writes,['SERVICE_TOKEN']);
  assert.equal(JSON.stringify(answer).includes(sentinel),false);assert.equal(sent.entries[0].value,'');
  const file=path.join(f.root,'_resources/identity/service/secrets.enc.yaml');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'synthetic-encrypted-marker');
  const settled=settleFilledAsks(f.store,f.state,{work:{at:{workRoot:f.root}},verifyPresence:({name})=>({ok:held.has(name)})});
  assert.deepEqual(settled,['ask-b']);assert.equal(f.state.ops[0].status,'paused');assert.equal(f.state.ops[1].status,'ready');
  view=model.snapshot();await model.submit({entries:[{id:view.fields.find(field=>field.name==='SERVICE_SECRET').id,value:sentinel}]});
  const time=new Date(Date.now()+2000);fs.utimesSync(file,time,time);
  assert.deepEqual(settleFilledAsks(f.store,f.state,{work:{at:{workRoot:f.root}},verifyPresence:({name})=>({ok:held.has(name)})}),['ask-a']);
  assert.equal(f.state.ops[0].status,'ready');assert.equal(JSON.stringify(f.state).includes(sentinel),false);
});

test('foreign names/roots and stale preparation are refused before any write; storage failures reveal no value',async t=>{
  const f=fixture(t);let writes=0;
  const model=createInputModel({binding:f.binding,read:()=>f.state,present:()=>false,write:async()=>{writes++;throw Error(sentinel);}});
  const id=model.snapshot().fields[0].id;
  for(const body of [{root:'/other',entries:[{id,value:sentinel}]},{entries:[{id,value:sentinel,name:'FOREIGN_TOKEN'}]},
    {entries:[{id,value:sentinel},{id:'foreign',value:sentinel}]}])assert.equal((await model.submit(body)).ok,false);
  assert.equal(writes,0);
  f.state.ops[1].credential.preparations[0].preparation.credential.meaning='A changed provider meaning';
  assert.notEqual(model.snapshot().fields[0].id,id);
  assert.equal((await model.submit({entries:[{id,value:sentinel}]})).code,'request-changed');assert.equal(writes,0);
  const failed=await model.submit({entries:[{id:model.snapshot().fields[0].id,value:sentinel}]});
  assert.equal(failed.results[0].code,'storage-unavailable');assert.equal(JSON.stringify(failed).includes(sentinel),false);
});

test('writes serialize; a repeated submit does not overwrite stored keys',async t=>{
  const f=fixture(t),held=new Set();let active=0,maximum=0,writes=0;
  const model=createInputModel({binding:f.binding,read:()=>f.state,present:({name})=>held.has(name),write:async({field})=>{
    active++;maximum=Math.max(maximum,active);await new Promise(resolve=>setTimeout(resolve,15));held.add(field.name);writes++;active--;return {ok:true};}});
  const id=model.snapshot().fields[0].id;
  await Promise.all([model.submit({entries:[{id,value:sentinel}]}),model.submit({entries:[{id,value:sentinel}]})]);
  assert.equal(maximum,1);assert.equal(writes,1);
});

const custodyVersion=(letter,revision)=>({ciphertextDigest:letter.repeat(64),writeRevision:revision.repeat(8)+'-'+revision.repeat(4)+'-'+revision.repeat(4)+'-'+revision.repeat(4)+'-'+revision.repeat(12)});
test('replacement survives restart, requires an exact-name write, and never repeats an already saved overwrite',async t=>{
  const f=fixture(t),baseline=custodyVersion('a','1');let current=baseline,writes=0;
  const ask=f.state.ops[1];ask.credential.replacements=[{name:'SERVICE_TOKEN',reason:'expired',baseline}];
  f.state.ops.push({id:'unrelated',status:'paused',waitingFor:'another-ask'});
  const version=()=>current,present=()=>true;
  const secrets=path.join(f.root,'_resources/identity/service/secrets.enc.yaml');fs.mkdirSync(path.dirname(secrets),{recursive:true});fs.writeFileSync(secrets,'Synthetic ciphertext fixture; version verifier is injected');
  const ctx={work:{at:{workRoot:f.root}},verifyPresence:()=>({ok:true}),credentialVersion:version};
  assert.deepEqual(settleFilledAsks(f.store,f.state,ctx),[]);
  current={...baseline,ciphertextDigest:'b'.repeat(64)};
  assert.equal(credentialVersionChanged(baseline,current),false,'re-encrypting another name is insufficient');
  assert.deepEqual(settleFilledAsks(f.store,f.state,ctx),[]);
  const restarted=JSON.parse(JSON.stringify(f.state));
  const write=async()=>{writes++;current=custodyVersion('c','2');return {ok:true};};
  const model=createInputModel({binding:f.binding,read:()=>restarted,present,version,write});
  const field=model.snapshot().fields[0];assert.equal(field.status,'pending');assert.equal(field.replacementReason,'expired');
  assert.equal(Object.hasOwn(field,'replacement'),false,'internal baseline is not a form control');
  assert.equal((await model.submit({entries:[{id:field.id,value:''}]})).ok,false);assert.equal(writes,0);
  assert.equal((await model.submit({entries:[{id:field.id,value:sentinel}]})).ok,true);
  assert.equal(model.snapshot().fields[0].status,'saved');assert.equal(writes,1);
  assert.equal((await model.submit({entries:[{id:field.id,value:sentinel}]})).ok,true);assert.equal(writes,1);
  assert.deepEqual(settleFilledAsks(f.store,restarted,ctx),['ask-a']);
  assert.equal(restarted.ops[0].status,'ready');assert.equal(restarted.ops[2].status,'paused');
  assert.equal(JSON.stringify([restarted,f.store.readEvents()]).includes(sentinel),false);
  assert.doesNotThrow(()=>settleFilledAsks(f.store,{...restarted,ops:[{...ask,fill:true,status:'running',answer:null}]}),'default null context stays safe');
});

test('replacement report is explicit, bound to a failed declared check and the launched credential version',t=>{
  const f=fixture(t),entry=preparedEntry(),{ctx}=researchContext(f,entry),op=f.state.ops[0];
  op.references=[entry.declaredPath];op.checks=[{name:'live-service',command:'node synthetic-live-check.mjs'}];
  const baseline=custodyVersion('a','1');let current=baseline;ctx.credentialVersion=()=>current;
  op.credentialVersions=snapshotCredentialVersions(op,ctx);
  const input={outcome:'blocked',run:'run-test',task:'op-a',dispatch:'dispatch-test',from:'terminal-test',summary:'Synthetic provider explicitly rejected the token',
    blocker:{kind:'environment',detail:'SERVICE_TOKEN in identity:service expired'},
    checks:[{name:'live-service',command:'node synthetic-live-check.mjs',exitCode:1,evidence:'Synthetic provider response: token expired'}],
    credentialRequest:{reason:'expired',variables:['SERVICE_TOKEN'],check:'live-service'}};
  const report=buildReport(input),admitted=credentialReplacementFor(op,report,ctx);
  assert.equal(admitted.ok,true);assert.deepEqual(admitted.replacements,[{name:'SERVICE_TOKEN',reason:'expired',baseline}]);
  for(const request of [{...input.credentialRequest,custody:'identity:foreign'},{...input.credentialRequest,baseline},
    {...input.credentialRequest,reason:'401'}, {...input.credentialRequest,variables:['../bad']},null])
    assert.equal(validateReport({...report,credentialRequest:request}).ok,false);
  assert.equal(validateReport({...report,checks:[]}).ok,false);
  assert.equal(validateReport({...report,checks:{}}).ok,false);
  assert.equal(credentialReplacementFor({...op,kind:'backend.implement'},report,ctx).ok,false);
  assert.equal(credentialReplacementFor(op,{...report,credentialRequest:{...report.credentialRequest,variables:['FOREIGN_TOKEN']}},ctx).ok,false);
  assert.equal(credentialReplacementFor({...op,checks:[{name:'live-service',command:'different-command'}]},report,ctx).ok,false);
  current=custodyVersion('b','2');assert.equal(credentialReplacementFor(op,report,ctx).ok,false,'stale provider failure re-verifies current custody');
  current=baseline;assert.equal(credentialReplacementFor({...op,credentialVersions:[]},report,ctx).ok,false,'legacy verifier needs a fresh baseline');
  const requestFile=path.join(f.repo,'replacement.json'),checksFile=path.join(f.repo,'checks.json');
  fs.writeFileSync(requestFile,JSON.stringify(input.credentialRequest));fs.writeFileSync(checksFile,JSON.stringify(input.checks));
  const sent=[];const orca={invoke:(name,params)=>{sent.push({name,params});return {outcome:'ok',receipt:{result:{message:{id:'synthetic-message'}}}};}};
  const result=protocolMain('report',{run:input.run,from:input.from,task:input.task,dispatch:input.dispatch,outcome:'blocked',summary:input.summary,
    blocker:'environment:SERVICE_TOKEN in identity:service expired','checks-file':checksFile,'credential-request-file':requestFile,'reports-dir':path.join(f.repo,'reports')},{orca,cwd:f.repo});
  assert.equal(result.ok,true);assert.deepEqual(JSON.parse(fs.readFileSync(result.file,'utf8')).credentialRequest,input.credentialRequest);
  assert.equal(sent.length,1,'the public report route writes and sends once');
});

test('a helper freezes the actual ledger binding and rejects a changed workflow tree',t=>{
  const f=fixture(t);assert.equal(readInputState(f.binding).ledgerRoot,f.root);
  f.state.ledgerRoot=path.join(f.repo,'foreign');f.store.saveState(f.state);assert.equal(readInputState(f.binding),null);
});

test('legacy raw fields fail closed; research and input readiness have different prerequisite boundaries',()=>{
  const entry=preparedEntry('SERVICE_TOKEN',{pendingMachine:true});
  assert.equal(integrationReadiness(entry,{now:now()}).ok,true);
  assert.deepEqual(integrationReadiness(entry,{now:now(),stage:'input'}).errors,['machine-preparation-pending']);
  const ask=inputAsk('ask');delete ask.credential.ready;delete ask.credential.preparationRequired;
  assert.equal(credentialFields({ops:[ask]}).fields.length,0);
  prepareCredentialAsk(ask,[entry],{now:now()});assert.equal(ask.credential.ready,false);
  entry.preparation.prerequisites.push({id:'consent',owner:'owner',action:'Grant consent',reason:'Account owner must approve',status:'pending',sourceRefs:['https://docs.example.test/auth']});
  entry.preparation.prerequisites[0].dependsOn=['consent'];
  assert.equal(integrationReadiness(entry,{now:now(),stage:'input'}).ok,true);
  prepareCredentialAsk(ask,[entry],{now:now()});assert.equal(credentialFields({ops:[ask]}).fields.length,1);
});

test('preparation validates arbitrary JSON without throwing and does not impose universal webhook or expiry rules',()=>{
  const entry=preparedEntry();entry.preparation.sources[0].readAt='2020-01-01';
  assert.equal(integrationReadiness(entry,{now:now()}).ok,true);
  const bad=[null,{},[],42,'bad',true,[null],{unexpected:true}];
  for(const value of bad)for(const key of ['sources','prerequisites','auth','credential','interfaces','verification']){
    const row=structuredClone(entry);row.preparation[key]=value;
    assert.doesNotThrow(()=>integrationReadiness(row,{now:now()}));
  }
  const raw={state:'done',extensions:{work3:{integrations:[entry]}}};const before=preparationFingerprint(raw);
  raw.extensions.work3.integrations[0].preparation.credential.label='A better label';assert.equal(preparationFingerprint(raw),before);
  raw.state='todo';assert.notEqual(preparationFingerprint(raw),before);
});

test('related integration selection uses exact integration dependencies and leaves unrelated providers alone',()=>{
  const a=preparedEntry('A_TOKEN',{slug:'a'}),b=preparedEntry('B_TOKEN',{slug:'b'});
  const nodes=[{id:'use-a',path:'features/demo/integration/a/index.yaml'}];
  assert.deepEqual(relatedIntegrations({nodeId:'use-a',references:[a.declaredPath]},[a,b],nodes).map(entry=>entry.id),['a']);
  assert.deepEqual(relatedIntegrations({references:['features/demo/other/index.yaml']},[a,b],nodes),[]);
});

function researchContext(f,entry){
  const node={id:entry.declaredBy,path:entry.declaredPath,kind:'architecture',state:'done'};
  const file=path.join(f.root,node.path);fs.mkdirSync(path.dirname(file),{recursive:true});
  const raw={id:node.id,kind:node.kind,state:'done',extensions:{work3:{integrations:[entry]}}};fs.writeFileSync(file,stringifyYaml(raw));
  const loaded={at:{repoRoot:f.repo,workRoot:f.root},list:[node],nodes:new Map([[node.id,node]])};
  const ctx={now,work:{at:loaded.at,loaded,repoRoot:f.repo,shared:false,node:id=>loaded.nodes.get(id),
    api:{readNode:()=>parseYaml(fs.readFileSync(file,'utf8'))}},guards:{protectedPaths:()=>[`.starciwork/${node.path}`]}};
  return {ctx,node,file,raw};
}

test('restart re-admits an old ask through its owning research operation under feature-slug scope',t=>{
  const f=fixture(t),entry=preparedEntry();delete entry.preparation;
  const {ctx,node,file,raw}=researchContext(f,entry);
  f.state.ops[0].references=[node.path];
  refreshCredentialPreparation(f.store,f.state,ctx);
  assert.equal(f.state.ops[1].credential.ready,false);
  assert.equal(credentialFields(f.state).fields.length,0);
  const author=f.state.ops.find(op=>op.integrationPreparation);
  assert.ok(author);assert.equal(author.kind,'work.author');assert.deepEqual(author.allowlist,[`.starciwork/${node.path}`]);
  assert.equal(f.state.ops[0].status,'pending');assert.equal(f.state.ops[0].waitingFor,null);assert.ok(f.state.ops[0].dependsOn.includes(author.id));
  const count=f.state.ops.length;refreshCredentialPreparation(f.store,f.state,ctx);assert.equal(f.state.ops.length,count);
  raw.extensions.work3.integrations=[preparedEntry()];fs.writeFileSync(file,stringifyYaml(raw));
  assert.equal(integrationReadiness(declaredIntegrations(ctx.work.loaded).list[0],{now:now()}).ok,true,'cached path list reads fresh declaration bytes');
  refreshCredentialPreparation(f.store,f.state,ctx);assert.equal(f.state.ops[1].credential.ready,true);
  assert.equal(deferForIntegrationPreparation(f.store,f.state,f.state.ops[0],ctx),false);
});

test('a record-author requester receives a fresh docs-first attempt without widening its write allowlist',t=>{
  const f=fixture(t),entry=preparedEntry();delete entry.preparation;const {ctx}=researchContext(f,entry);
  f.state.ops[0].kind='work.author';f.state.ops[0].allowlist=['only-this-record/index.yaml'];
  refreshCredentialPreparation(f.store,f.state,ctx);
  assert.equal(f.state.ops[0].status,'ready');assert.equal(f.state.ops[0].attempt,2);
  assert.deepEqual(f.state.ops[0].allowlist,['only-this-record/index.yaml']);assert.match(f.state.ops[0].findings.join(' '),/OFFICIAL documentation/);
});

test('research re-admission settles only the old requester terminal and retains ownership on unknown effects',t=>{
  const f=fixture(t),entry=preparedEntry();delete entry.preparation;const {ctx}=researchContext(f,entry);
  const requester=f.state.ops[0];requester.dispatch='old-dispatch';requester.terminal='owned-old-terminal';
  let closed=false;const calls=[];
  ctx.orca={invoke:(name,params)=>{calls.push({name,params});return {outcome:name==='terminal-close'&&!closed?'unknown':'ok',effectState:'none',receipt:{result:{}}};}};
  refreshCredentialPreparation(f.store,f.state,ctx);
  assert.equal(requester.status,'paused');assert.equal(requester.terminal,'owned-old-terminal');assert.equal(requester.attempt,1);
  closed=true;refreshCredentialPreparation(f.store,f.state,ctx);
  assert.equal(requester.terminal,null);assert.equal(requester.dispatch,null);assert.equal(requester.attempt,2);
  assert.ok(calls.filter(call=>call.name==='terminal-close').every(call=>call.params.terminal==='owned-old-terminal'));
  assert.ok(f.store.readEvents().some(event=>event.event==='credential-research-terminal-settled'));
});

test('kernel accepts a typed replacement report through the owning ask path without accepting old presence',t=>{
  const f=fixture(t),entry=preparedEntry(),{ctx}=researchContext(f,entry);
  const check={name:'live-service',command:'node synthetic-live-check.mjs'},baseline=custodyVersion('a','1');
  const op=toOp({id:'verify-service',kind:'integration.verify',references:[entry.declaredPath],checks:[check],allowlist:[],goal:'Verify synthetic sandbox'},0);
  op.status='running';op.dispatch='synthetic-dispatch';op.credentialVersions=[{name:'SERVICE_TOKEN',custody:'identity:service',version:baseline}];
  f.state.ops=[op];ctx.credentialVersion=()=>baseline;ctx.git=()=>({status:0,stdout:'',stderr:''});
  ctx.guards={protectedPaths:()=>[],revertProtected:()=>({reverted:[],removed:[]}),gitQueue:fn=>fn()};
  const report=buildReport({outcome:'blocked',run:'synthetic-run',task:'synthetic-task',dispatch:op.dispatch,from:'synthetic-terminal',summary:'Synthetic token expired',
    blocker:{kind:'environment',detail:'SERVICE_TOKEN expired'},checks:[{...check,exitCode:1,evidence:'Synthetic provider returned token expired'}],
    credentialRequest:{reason:'expired',variables:['SERVICE_TOKEN'],check:check.name}});
  assert.equal(applyOpReport(null,f.store,f.state,op,report,ctx),'owner-ask');
  const ask=f.state.ops.find(item=>item.id===op.waitingFor);
  assert.equal(op.status,'paused');assert.deepEqual(ask.credential.replacements,[{name:'SERVICE_TOKEN',reason:'expired',baseline}]);
  assert.equal(ask.credential.custody,'identity:service');assert.equal(ask.question.inputRevision,JSON.stringify(ask.credential.replacements));
  const bad=toOp({id:'invalid-request',kind:'integration.verify',goal:'Verify synthetic rejection handling',allowlist:[],checks:[check],references:[entry.declaredPath]},1);
  f.state.ops.push(bad);
  applyOpReport(null,f.store,f.state,bad,{...report,credentialRequest:{...report.credentialRequest,value:sentinel}},ctx);
  assert.equal(Object.hasOwn(bad.reports.at(-1),'credentialRequest'),false);
  assert.equal(JSON.stringify([f.state,f.store.readEvents()]).includes(sentinel),false,'a rejected request never persists its forbidden payload');
});

function browserFixture(){
  const tabs=[],calls=[];let counter=0;
  const orca={host:{name:'orca'},verify:()=>({ok:true}),invoke:(name,params)=>{
    calls.push({name,params});
    if(name==='tab-list')return {outcome:'ok',receipt:{result:{tabs}}};
    if(name==='tab-create'){const browserPageId=`page-${++counter}`;tabs.push({browserPageId,url:params.url,title:'Credentials · input-test'});return {outcome:'ok',effectState:'committed',receipt:{result:{browserPageId}}};}
    if(name==='tab-goto'){tabs.find(tab=>tab.browserPageId===params.page).url=params.url;return {outcome:'ok',effectState:'committed',receipt:{result:{}}};}
    throw Error(`Unexpected ${name}`);
  }};return {orca,tabs,calls};
}

test('collided GUI state recovers only the exact approved refs and preserves newer owner status and unrelated state',t=>{
  for(const empty of [false,true]){
    const f=fixture(t),refs=empty?[]:structuredClone(f.state.inputs);
    const goal={schema:'starci/workflow-goal@1',id:f.state.id,job:f.state.job,inputs:refs};
    fs.writeFileSync(f.store.paths.goalJson,JSON.stringify(goal));
    f.state.inputs={...refs,phase:'ready',page:'previous-page',session:'a'.repeat(32),priorSession:null,lastCheckedAt:100,reason:null,createUncertain:false};
    f.state.ownerInputs={phase:'starting',page:'current-page'};
    const before=structuredClone(f.state);
    assert.deepEqual(recoverWorkflowInputReferences(f.store,f.state),{ok:true,recovered:true});
    assert.deepEqual(f.state.inputs,refs);assert.deepEqual(f.store.loadState().inputs,refs);
    assert.deepEqual(f.state.ownerInputs,{phase:'starting',page:'current-page',session:'a'.repeat(32),priorSession:null,lastCheckedAt:100,reason:null,createUncertain:false});
    const {inputs,ownerInputs,...rest}=f.state,{inputs:oldInputs,ownerInputs:oldSurface,...oldRest}=before;
    assert.deepEqual(rest,oldRest);assert.deepEqual(JSON.parse(fs.readFileSync(f.store.paths.goalJson,'utf8')),goal);
    assert.deepEqual(recoverWorkflowInputReferences(f.store,f.state),{ok:true,recovered:false});
    assert.deepEqual(f.store.readEvents().map(({event,count,source})=>({event,count,source})),[
      {event:'input-references-recovered',count:refs.length,source:'approved-goal'}]);
    assert.equal(JSON.stringify(f.store.readEvents()).includes('features/demo'),false,'migration logs contain no input contents');
  }
});

test('input collision recovery refuses malformed, mismatched and ungrounded state without inventing refs',t=>{
  const cases=[
    {change:f=>{f.state.inputs=null;}},
    {change:f=>{f.state.inputs={phase:'ready',1:f.state.inputs[1]};}},
    {change:f=>{f.state.inputs.extra=sentinel;}},
    {change:f=>{f.state.inputs.phase='unknown';}},
    {change:f=>{f.state.inputs.createUncertain='yes';}},
    {change:f=>{f.state.inputs[0]={kind:'sds',ref:'foreign'};}},
    {change:(_f,goal)=>{goal.inputs.reverse();}},
    {change:(_f,goal)=>{goal.id='another-workflow';}},
    {change:(_f,goal)=>{goal.job='Another approved job';}},
    {change:(_f,goal)=>{goal.schema='foreign-goal';}},
    {change:(_f,goal)=>{goal.inputs=null;}},
    {change:f=>{f.state.approved=false;}},
    {missing:true},{invalid:true}
  ];
  for(const sample of cases){
    const f=fixture(t),goal={schema:'starci/workflow-goal@1',id:f.state.id,job:f.state.job,inputs:structuredClone(f.state.inputs)};
    f.state.inputs={...f.state.inputs,phase:'ready',page:'synthetic-page'};
    sample.change?.(f,goal);
    if(!sample.missing)fs.writeFileSync(f.store.paths.goalJson,sample.invalid?'invalid json':JSON.stringify(goal));
    const before=structuredClone(f.state),result=recoverWorkflowInputReferences(f.store,f.state);
    assert.equal(result.ok,false);assert.match(result.reason,/^input-reference-(shape-invalid|goal-unavailable|goal-mismatch)$/);
    assert.deepEqual(f.state,before);assert.deepEqual(f.store.readEvents(),[]);
    assert.equal(JSON.stringify(result).includes(sentinel),false);
  }
});

test('approved input references without credential waits do not start an owner input surface',t=>{
  const f=fixture(t),b=browserFixture(),inputs=f.state.inputs;f.state.ops=[];
  const result=reconcileWorkflowInputs(b.orca,f.store,f.state,{spawnProcess:()=>{throw Error('No helper is needed');}});
  assert.deepEqual(result,{phase:'idle'});assert.equal(f.state.ownerInputs,undefined);
  assert.equal(f.state.inputs,inputs);assert.equal(b.calls.length,0);
});

test('the owner input helper of an enrolled workflow launches from the runtime pin while preserving the original workflow binding',t=>{
  const f=fixture(t),b=browserFixture(),pinned=path.join(f.repo,'sealed-runtime');
  f.state.engine={schema:'starci/engine@1',runtimePin:{root:pinned,digest:'a'.repeat(64)}};
  let launch=null;
  const child=new EventEmitter();child.pid=101;child.unref=()=>{};
  const result=reconcileWorkflowInputs(b.orca,f.store,f.state,{now:()=>100000,alive:()=>false,
    spawnProcess:(executable,args,options)=>{launch={executable,args,options};return child;}});
  assert.equal(result.phase,'starting');
  assert.equal(launch.args[0],path.join(pinned,'bin','starci.mjs'));
  const session=JSON.parse(fs.readFileSync(inputFiles(f.store.dir).session,'utf8'));
  assert.equal(path.resolve(session.binding.host),path.resolve(f.state.host));
  assert.equal(session.binding.host,f.binding.host);
  assert.equal(session.binding.host.includes('sealed-runtime'),false);
});

test('kernel input reconciliation preserves approved input refs across page, helper, replacement and workflow restarts',t=>{
  const f=fixture(t),b=browserFixture(),files=inputFiles(f.store.dir);let time=100000,launches=0;
  const approvedInputs=structuredClone(f.state.inputs);
  const alive=new Set([101]);const spawnProcess=()=>{launches++;const child=new EventEmitter();child.pid=101;child.unref=()=>{};return child;};
  const opts={now:()=>time,alive:pid=>alive.has(pid),spawnProcess};
  const reconcile=state=>{
    const inputs=state.inputs,result=reconcileWorkflowInputs(b.orca,f.store,state,opts);
    assert.equal(state.inputs,inputs,'GUI reconciliation must not replace approved inputs');
    assert.deepEqual(state.inputs,approvedInputs);
    assert.deepEqual(state.inputs.map(item=>item.ref),approvedInputs.map(item=>item.ref),'goal material extraction remains usable');
    assert.deepEqual(state.inputs.filter(item=>item.kind==='sds').map(item=>item.ref),['features/demo/architecture/index.yaml'],'owning design repair retains its input');
    f.store.saveState(state);
    const view=buildView({repoRoot:f.repo,id:state.id,now:time});
    assert.deepEqual(view.ownerInputs,state.ownerInputs,'status exposes the separate owner surface');
    return result;
  };
  assert.equal(reconcile(f.state).phase,'starting');
  const session=JSON.parse(fs.readFileSync(files.session,'utf8'));
  privateJson(files.lock,{pid:101,session:session.id});privateJson(files.server,{pid:101,session:session.id,port:32123});
  time+=31000;assert.equal(reconcile(f.state).phase,'opening');
  assert.equal(b.tabs.length,1);time+=31000;assert.equal(reconcile(f.state).phase,'ready');
  const saved=f.store.loadState();time+=31000;reconcile(saved);assert.equal(launches,1);assert.equal(b.tabs.length,1);
  alive.clear();time+=31000;reconcile(saved);assert.equal(launches,2);
  const next=JSON.parse(fs.readFileSync(files.session,'utf8'));alive.add(101);privateJson(files.lock,{pid:101,session:next.id});privateJson(files.server,{pid:101,session:next.id,port:32124});
  time+=31000;reconcile(saved);assert.equal(b.tabs.length,1);assert.equal(b.calls.at(-1).name,'tab-goto');
  b.tabs.length=0;time+=31000;reconcile(saved);assert.equal(b.tabs.length,1);
  saved.ops[1].credential.replacements=[{name:'SERVICE_TOKEN',reason:'expired',baseline:custodyVersion('a','1')}];
  time+=31000;reconcile(saved);assert.equal(b.tabs.length,1);
  saved.ops[1].status='done';saved.ops[1].answer={via:'fill'};saved.finished={outcome:'done'};
  time+=31000;reconcile(saved);assert.deepEqual(f.store.loadState().inputs,approvedInputs);
  assert.equal(b.calls.some(call=>/switch|focus|terminal/.test(call.name)),false);
  assert.equal(JSON.stringify(f.state).includes(session.token),false);
});

test('unknown tab creation is reconciled by read before replacement and does not allocate another helper',t=>{
  const f=fixture(t),b=browserFixture(),files=inputFiles(f.store.dir);let time=100000,count=0;
  const child=new EventEmitter();child.pid=101;child.unref=()=>{};
  const opts={now:()=>time,alive:pid=>pid===101,spawnProcess:()=>child};reconcileWorkflowInputs(b.orca,f.store,f.state,opts);
  const session=JSON.parse(fs.readFileSync(files.session,'utf8'));privateJson(files.lock,{pid:101,session:session.id});privateJson(files.server,{pid:101,session:session.id,port:32123});
  const invoke=b.orca.invoke;b.orca.invoke=(name,params)=>{if(name==='tab-create'){count++;return {outcome:'unknown',effectState:'unknown',receipt:null};}return invoke(name,params);};
  time+=31000;reconcileWorkflowInputs(b.orca,f.store,f.state,opts);time+=31000;reconcileWorkflowInputs(b.orca,f.store,f.state,opts);assert.equal(count,1);
});

test('typed Orca browser calls match the observed public registry',()=>{
  const contract=parseYaml(fs.readFileSync(new URL('../providers/orca/calls.yaml',import.meta.url),'utf8'));
  const registry=JSON.parse(fs.readFileSync(new URL('./fixtures/orca/live-1.4.188/agent-context.json',import.meta.url),'utf8'));
  assert.equal(verifyLiveSchema(contract,registry).ok,true);
  const orca=createOrcaCalls({calls:contract,spawn:()=>({status:0,stdout:JSON.stringify({ok:true,result:{browserPageId:'page'}})})});
  assert.equal(orca.invoke('tab-create',{worktree:'path:/test',url:'http://127.0.0.1:32123/inputs/test#cap'}).outcome,'ok');
});

test('HTTP rejects foreign origins, bad capabilities and oversized bodies; status exceptions stay safe',async t=>{
  let fail=false;const f=fixture(t),token='a'.repeat(43);
  const model=createInputModel({binding:f.binding,read:()=>f.state,present:()=>false,write:async()=>({ok:false})});
  const app=await startInputServer({token,model:{...model,snapshot:()=>{if(fail)throw Error(sentinel);return model.snapshot();}},sessionId:'test'});
  t.after(()=>app.close());
  const request=(method,url,headers={},body='')=>new Promise((resolve,reject)=>{
    const req=http.request(app.origin+url,{method,headers},res=>{let text='';res.on('data',chunk=>text+=chunk);res.on('end',()=>resolve({status:res.statusCode,text,headers:res.headers}));});req.on('error',reject);req.end(body);
  });
  const auth={Authorization:`Bearer ${token}`,'Content-Type':'application/json',Origin:app.origin};
  assert.equal((await request('GET','/status',{Authorization:'Bearer '+'é'.repeat(43)})).status,403);
  assert.equal((await request('GET','/status',{...auth,Origin:'https://evil.test'})).status,403);
  assert.equal((await request('GET','/status',{...auth,Host:'localhost'})).status,403);
  const {Origin,...withoutOrigin}=auth;
  assert.equal((await request('POST','/credentials',withoutOrigin,'{}')).status,403);
  assert.equal((await request('POST','/credentials',auth,'x'.repeat(INPUT_BODY_LIMIT+1))).status,413);
  assert.equal((await request('POST','/credentials',auth,sentinel)).status,400);
  fail=true;const failed=await request('GET','/status',auth);assert.equal(failed.status,503);assert.equal(failed.text.includes(sentinel),false);
  fail=false;assert.equal((await request('GET','/status',auth)).status,200);
  const page=await request('GET','/inputs/test');assert.equal(page.status,200);assert.match(page.headers['content-security-policy'],/frame-ancestors 'none'/);
});

test('the same Orca input page queues noncredential owner actions with a server-created receipt',async t=>{
  const f=fixture(t),queued=[];f.state.ops=[{id:'ask-policy',kind:'decision.prepare',status:'running',attempt:1,
    question:{kind:'business-decision',subject:'Choose the retention policy',text:'Choose one policy',options:[{id:'short',label:'30 days'},{id:'long',label:'1 year'}]}}];
  const model=createInputModel({binding:f.binding,read:()=>f.state,enqueue:payload=>{queued.push(payload);return {ok:true,code:'queued'};}});
  assert.equal(model.snapshot().ownerRequests.length,1);const request=model.snapshot().ownerRequests[0];
  const result=model.submitOwnerAction({requestId:request.id,revision:request.revision,type:'choose',value:'short'});
  assert.equal(result.ok,true);assert.equal(queued[0].action.actor.type,'owner');assert.equal(queued[0].action.actor.channel,'orca-input');assert.ok(queued[0].action.actor.receiptId.length>=32);
  assert.deepEqual([queued[0].action.workflowId,queued[0].action.opId,queued[0].action.attempt,queued[0].action.generation],[f.state.id,'ask-policy',1,Number(f.state.generation??0)]);
  assert.equal(model.submitOwnerAction({requestId:request.id,revision:0,type:'choose',value:'short',actor:{type:'model'}}).code,'invalid-request');
});

test('the rendered owner page includes the choice control while credentials are still preparing',async t=>{
  const chrome=[process.env.CHROME_PATH,process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':null,
    process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':'/usr/bin/google-chrome',
    '/usr/bin/chromium','/usr/bin/chromium-browser'].find(file=>file&&fs.existsSync(file));
  if(!chrome)return t.skip('a Chromium browser is unavailable');
  const token='s'.repeat(43),profile=fs.mkdtempSync(path.join(os.tmpdir(),'si-render-'));
  t.after(()=>fs.rmSync(profile,{recursive:true,force:true}));
  const snapshot={workflow:'synthetic-owner-ui',phase:'preparing',fields:[],unresolved:[],preparation:[],ownerRequests:[{id:'request-1',opId:'ask-policy',revision:0,
    kind:'business-decision',subject:'Choose policy',status:'waiting-owner',options:[{id:'a',label:'Policy A preserves records for the complete approved audit period while keeping every binding condition visible to the owner before selection.',recommended:true},{id:'b',label:'Policy B removes records after the shorter approved period and requires the owner to accept the documented reporting limitation.'}],
    presentation:{language:'vi',text:'Chọn chính sách lưu trữ nào?',options:[{id:'1',label:'Chính sách A giữ hồ sơ trọn kỳ kiểm toán đã duyệt.'},{id:'2',label:'Chính sách B xóa hồ sơ sau kỳ ngắn hơn đã duyệt.'}]},guidance:{what:'Which retention policy?'}}]};
  const app=await startInputServer({token,sessionId:'render',model:{snapshot:()=>snapshot,submit:async()=>({ok:false}),submitOwnerAction:()=>({ok:false})}});
  t.after(()=>app.close());
  const {stdout}=await execFileAsync(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check',`--user-data-dir=${profile}`,'--virtual-time-budget=1000','--dump-dom',`${app.origin}/inputs/render#${token}`],{timeout:10000,maxBuffer:1024*1024});
  assert.match(stdout,/<fieldset class="choices">[\s\S]*<input type="radio" name="choice-request-1" value="a">[\s\S]*Chính sách A giữ hồ sơ trọn kỳ kiểm toán đã duyệt\.[\s\S]*<input type="radio" name="choice-request-1" value="b">[\s\S]*Chính sách B xóa hồ sơ sau kỳ ngắn hơn đã duyệt\.[\s\S]*<\/fieldset>/,'every option is a choice card with its full text in the page language, never a truncating native popup; the value stays the record id');
  assert.doesNotMatch(stdout,/<select/,'a decision with options is a choice, not a dropdown');
  assert.match(stdout,/Chọn chính sách lưu trữ nào\?[\s\S]*Chính sách A giữ hồ sơ trọn kỳ kiểm toán đã duyệt\.[\s\S]*Khuyến nghị[\s\S]*Chính sách B xóa hồ sơ/,'the page speaks the presentation and badges the recommendation');
  assert.match(stdout,/Bản ghi gốc \(tiếng Anh\)[\s\S]*Which retention policy\?[\s\S]*1\. Policy A preserves records/,'the English record stays one fold away');
  assert.match(stdout,/<fieldset class="choices">[\s\S]*<\/fieldset>[\s\S]*<button[^>]*>Gửi câu trả lời<\/button>/);
  assert.doesNotMatch(stdout,/type="password"/,'preparing credentials still expose no secret input');
});

test('owner controls survive unchanged polling and reset when their bound request revision changes',async t=>{
  const chrome=[process.env.CHROME_PATH,process.platform==='win32'?'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe':null,
    process.platform==='win32'?'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe':'/usr/bin/google-chrome','/usr/bin/chromium'].find(file=>file&&fs.existsSync(file));
  if(!chrome)return t.skip('a Chromium browser is unavailable');
  const token='p'.repeat(43),profile=fs.mkdtempSync(path.join(os.tmpdir(),'si-owner-poll-'));
  const requests=[{id:'choice',opId:'ask-choice',revision:1,optionsDigest:'a'.repeat(64),kind:'business-decision',subject:'Choose',status:'waiting-owner',options:[{id:'a',label:'A'},{id:'b',label:'B'},{id:'c',label:'C'}],guidance:{}},
    {id:'answer',opId:'ask-answer',revision:1,kind:'question',subject:'Explain',status:'waiting-owner',options:[],guidance:{}},
    {id:'preparing',opId:'ask-preparing',revision:1,kind:'question',subject:'Preparing',status:'preparing',options:[],guidance:{}},
    {id:'answered',opId:'ask-answered',revision:1,kind:'question',subject:'Answered',status:'answered',options:[],guidance:{}},
    {id:'status',opId:'ask-status',revision:1,kind:'question',subject:'Status transition',status:'waiting-owner',options:[],guidance:{}}];let submissions=0,polls=0;
  const app=await startInputServer({token,sessionId:'poll',model:{snapshot:()=>{polls++;return {workflow:'poll',phase:'waiting',fields:[],unresolved:[],preparation:[],ownerRequests:structuredClone(requests).map(request=>({...request,updatedAt:Date.now()}))};},submit:async()=>({ok:false}),submitOwnerAction:()=>{submissions++;return {ok:false};}}});
  const child=execFile(chrome,['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--remote-debugging-port=0',`--user-data-dir=${profile}`,`${app.origin}/inputs/poll#${token}`]);let socket;
  t.after(async()=>{try{socket?.close();}catch{}if(child.exitCode===null){if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});else child.kill('SIGKILL');}await app.close();fs.rmSync(profile,{recursive:true,force:true});});
  const portFile=path.join(profile,'DevToolsActivePort');for(let i=0;i<100&&!fs.existsSync(portFile);i++)await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(fs.existsSync(portFile),true);const port=fs.readFileSync(portFile,'utf8').split(/\r?\n/)[0];
  let page;for(let i=0;i<100&&!page;i++){const pages=await fetch(`http://127.0.0.1:${port}/json/list`).then(response=>response.json());page=pages.find(item=>item.url.includes('/inputs/poll'));if(!page)await new Promise(resolve=>setTimeout(resolve,50));}
  assert.ok(page);socket=new WebSocket(page.webSocketDebuggerUrl);await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('CDP connection timed out')),5000);socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('CDP connection failed'));},{once:true});});let seq=0;
  const evaluate=expression=>new Promise((resolve,reject)=>{const id=++seq,timer=setTimeout(()=>{socket.removeEventListener('message',listener);reject(Error('CDP evaluate timed out'));},3000),listener=event=>{const message=JSON.parse(String(event.data));if(message.id!==id)return;clearTimeout(timer);socket.removeEventListener('message',listener);message.error?reject(Error(message.error.message)):resolve(message.result.result.value);};socket.addEventListener('message',listener);socket.send(JSON.stringify({id,method:'Runtime.evaluate',params:{expression,returnByValue:true}}));});
  // The page polls /status every 2500ms; overriding the client's setTimeout shortens the delay its own recursive
  // `setTimeout(poll,2500)` call schedules, so once it lands, poll cycles arrive every ~40ms instead of every 2500ms.
  // The very first navigation occasionally still finalises after this early evaluate (observed once as a reset global),
  // so the override is verified and retried rather than assumed; nextPoll() below waits for a REAL server-observed
  // poll either way (never a race on the DOM), bounded at 3200ms so a stalled poll still fails exactly as the
  // original fixed 3000ms wait would have.
  const patch="(()=>{const original=window.setTimeout;window.setTimeout=(fn,delay,...rest)=>original(fn,delay>=1000?40:delay,...rest);return true})()";
  for(let i=0;i<40&&!(await evaluate(patch)&&await evaluate("window.setTimeout.toString().includes('original')"));i++)await new Promise(resolve=>setTimeout(resolve,50));
  const nextPoll=async()=>{const target=polls+1,deadline=Date.now()+3200;while(polls<target&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,20));await new Promise(resolve=>setTimeout(resolve,80));};
  for(let i=0;i<100&&!(await evaluate("document.querySelectorAll('#owner form').length===5"));i++)await new Promise(resolve=>setTimeout(resolve,50));
  // A preparing request shows no control at all; an answered one keeps its control and button, disabled.
  assert.deepEqual(await evaluate("(()=>{const fs=[...document.querySelectorAll('#owner form')];return [[fs[2].querySelector('textarea')===null,fs[2].querySelector('button')===null,fs[2].textContent.includes('chuẩn bị')],[fs[3].querySelector('textarea').disabled,fs[3].querySelector('button').disabled]]})()"),[[true,true,true],[true,true]]);
  await evaluate("(()=>{for(const f of [...document.querySelectorAll('#owner form')].slice(2,4))f.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));return true})()");assert.equal(submissions,0);
  // The first form is the choice: its own "other answer" textarea is hidden and comes first in the textarea list.
  await evaluate("(()=>{document.querySelector('#owner input[type=radio][value=c]').checked=true;const ts=[...document.querySelectorAll('#owner form')].slice(1).map(f=>f.querySelector('textarea')),t=ts[0];t.value='typed answer';ts[3].value='status draft';t.focus();t.setSelectionRange(2,6);return true})()");
  await nextPoll();
  const picked="((document.querySelector('#owner input[type=radio]:checked')||{}).value||'')",answerBox="document.querySelectorAll('#owner form')[1].querySelector('textarea')";
  const preserved=await evaluate("(()=>{const t="+answerBox+";return ["+picked+",t.value,document.activeElement===t,t.selectionStart,t.selectionEnd]})()");
  requests[1].guidance={why:'Fresh presentation guidance'};await nextPoll();
  const guidance=await evaluate("(()=>{const f=document.querySelectorAll('#owner form')[1],t=f.querySelector('textarea');return [f.textContent.includes('Fresh presentation guidance'),t.value,document.activeElement===t,t.selectionStart,t.selectionEnd]})()");
  requests[0].options[2].label='Changed without digest';await nextPoll();
  const malformedChange=await evaluate("(()=>["+picked+","+answerBox+".value])()");
  requests[0].optionsDigest='b'.repeat(64);requests[4].status='answered';await nextPoll();
  const bindingChanges=await evaluate("(()=>{const f=document.querySelectorAll('#owner form')[4];return ["+picked+","+answerBox+".value,f.querySelector('textarea').value,f.querySelector('textarea').disabled,f.querySelector('button').disabled]})()");
  requests[1].revision=2;await nextPoll();
  const reset=await evaluate("(()=>["+picked+","+answerBox+".value])()");
  socket.send(JSON.stringify({id:++seq,method:'Browser.close'}));await new Promise(resolve=>child.once('exit',resolve));
  assert.deepEqual(preserved,['c','typed answer',true,2,6]);assert.deepEqual(guidance,[true,'typed answer',true,2,6]);assert.deepEqual(malformedChange,['','typed answer'],'a changed option shape rebuilds the choice with nothing picked');assert.deepEqual(bindingChanges,['','typed answer','',true,true]);assert.deepEqual(reset,['','']);
});

test('preparing credentials expose safe per-request progress while an independent owner decision stays answerable',t=>{
  const f=fixture(t),ask=f.state.ops[1],evidence=`${sentinel}-must-not-render`;
  ask.credential.ready=false;ask.credential.preparations=[{name:'SERVICE_TOKEN',ok:false,errors:['machine-preparation-pending'],provider:'synthetic-service',
    preparation:{schema:'starci/integration-preparation@1',credential:{name:'SERVICE_TOKEN',label:'Service access token'},
      sources:[{url:'https://docs.example.test/auth',title:'Authentication',official:true,readAt:'2026-09-14',observation:'The current authentication flow was read.'}],
      prerequisites:[{id:'docs',owner:'workflow',status:'ready',action:'Read authentication docs',reason:'Bind the current API',evidence},
        {id:'account',owner:'owner',status:'pending',action:'Choose the service account',reason:'Only the account owner can choose',evidence:''}],
      verification:{steps:['connect','reject-foreign']}}}];
  f.state.ops.push({id:'ask-policy',kind:'decision.prepare',status:'running',attempt:1,question:{kind:'business-decision',subject:'Choose policy',text:'Choose one',options:[{id:'a',label:'Policy A'}]}});
  const progress=preparationProgress(f.state);assert.equal(progress.length,1);assert.deepEqual(progress[0],{ask:'ask-a',name:'SERVICE_TOKEN',label:'Service access token',provider:'synthetic-service',tasks:[{id:'op-a',label:'Check the service connection'}],errors:['machine-preparation-pending'],docs:[{title:'Authentication',url:'https://docs.example.test/auth'}],prerequisites:[{id:'docs',owner:'workflow',status:'ready',action:'Read authentication docs',reason:'Bind the current API',proofPresent:true},{id:'account',owner:'owner',status:'pending',action:'Choose the service account',reason:'Only the account owner can choose',proofPresent:false}],verificationSteps:2});
  assert.equal(JSON.stringify(progress).includes(sentinel),false,'evidence contents never reach the owner page');
  const snapshot=createInputModel({binding:f.binding,read:()=>f.state,present:()=>false}).snapshot();
  assert.equal(snapshot.phase,'preparing');assert.equal(snapshot.fields.length,0);assert.equal(snapshot.preparation.length,1);
  assert.deepEqual(snapshot.ownerRequests.map(request=>request.opId),['ask-policy'],'credential preparation never hides an answerable owner decision');
});

test('preparation progress ignores malformed arrays, unread claims and capability-bearing URLs without hiding owner questions',t=>{
  const f=fixture(t),ask=f.state.ops[1];ask.credential.ready=false;ask.credential.preparations=[null,{name:'SERVICE_TOKEN',errors:null,preparation:{schema:'starci/integration-preparation@1',credential:{label:'Service token'},
    sources:[null,{official:true,title:'Unread',url:'https://docs.example.test/unread'},{official:true,title:'Secret query',readAt:'2026-09-14',observation:'read',url:'https://docs.example.test/auth?token=secret#capability'},
      {official:true,title:'Safe docs',readAt:'2026-09-14',observation:'read',url:'https://docs.example.test/auth'}],prerequisites:{bad:true},verification:{steps:null}}},
    {name:null,preparation:null}];
  f.state.ops.push({id:'ask-policy',kind:'decision.prepare',status:'running',attempt:1,question:{kind:'business-decision',subject:'Choose policy',text:'Choose one',options:[{id:'a',label:'Policy A'}]}});
  assert.doesNotThrow(()=>preparationProgress(f.state));const progress=preparationProgress(f.state);
  assert.deepEqual(progress[0].docs,[{title:'Safe docs',url:'https://docs.example.test/auth'}]);assert.deepEqual(progress[0].prerequisites,[]);assert.equal(progress[0].verificationSteps,0);
  assert.equal(JSON.stringify(progress).includes('token=secret'),false);assert.equal(JSON.stringify(progress).includes('#capability'),false);
  const snapshot=createInputModel({binding:f.binding,read:()=>f.state,present:()=>false}).snapshot();assert.deepEqual(snapshot.ownerRequests.map(request=>request.opId),['ask-policy']);
});

test('presence probe removes ambient secrets and quotes for the actual SOPS shell',t=>{
  const f=fixture(t),bin=path.join(f.repo,'bin');fs.mkdirSync(bin);fs.writeFileSync(path.join(bin,process.platform==='win32'?'sops.exe':'sops'),'fake');
  const file=path.join(f.root,'_resources/identity/service/secrets.enc.yaml');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'encrypted');
  let observed;
  const run=(exe,args,options)=>{observed={args,options};return {status:1,stdout:'',stderr:''};};
  assert.equal(identitySecretPresent({workRoot:f.root,slug:'service',name:'SERVICE_TOKEN',platform:'win32',env:{PATH:bin,service_token:sentinel},run}).ok,false);
  assert.equal(observed.options.env.service_token,undefined);assert.equal(observed.args.at(-1),'node -e process.exit(process.env.SERVICE_TOKEN?0:1)');
  identitySecretPresent({workRoot:f.root,slug:'service',name:'SERVICE_TOKEN',platform:'linux',env:{PATH:bin,SERVICE_TOKEN:sentinel},run});
  assert.equal(observed.options.env.SERVICE_TOKEN,undefined);assert.match(observed.args.at(-1),/node -e "/);
});
