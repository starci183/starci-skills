import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {joinRuntimeEvidence, verifiedIntegrationBindings} from './workflow-runtime-proof.mjs';
import {producerImportFixture} from './producer-import-fixture.mjs';

const head='a'.repeat(40),other='b'.repeat(40);
const at=second=>`2026-09-06T10:00:${String(second).padStart(2,'0')}.000Z`;

// These are deliberately unit records, not accepted operator receipts. Acceptance, byte seals,
// and original current contract checks remain mandatory in verifiedIntegrationBindings.
function records(role='be'){
 const coordination={coordinatorSessionId:'portfolio',assignment:{ref:'runtime/history/assignments/current.json',hash:'sha256:'+'8'.repeat(64)}};
 const routeKey=`sample/${role}`,endpoint=role==='be'?'http://127.0.0.1:3068/graphql':'http://127.0.0.1:3067/';
 const entry={status:'ready',lease:null,head,contains:[head],generation:10,
  server:{worktree:path.resolve(`fixture-${role}`),pid:42,listenerPid:42,port:role==='be'?3068:3067},
  endpoints:{[role==='be'?'api':'frontend']:endpoint}};
 const record=(start,end,fingerprint)=>({routeKey,env:'dev',wantedCommit:head,coordination:structuredClone(coordination),entry:structuredClone(entry),
  source:{worktree:entry.server.worktree,head,wantedCommit:head,ancestor:true},startedAt:at(start),finishedAt:at(end),fingerprint});
 return {alias:`@workspaces/${role}`,routeKey,env:'dev',project:'sample',pinned:head,coordination,
  before:record(0,5,'sha256:'+'1'.repeat(64)),after:record(25,30,'sha256:'+'2'.repeat(64)),
  verification:{role,commit:head,servedHead:head,urls:[role==='be'?endpoint+'?query=%7B__typename%7D':endpoint+'modules/one/settings'],startedAt:at(10),finishedAt:at(20),fingerprint:'sha256:'+'3'.repeat(64)}};
}

test('unit join independently binds both runtime roles to their measured API or browser endpoint',()=>{
 const be=joinRuntimeEvidence(records('be')),fe=joinRuntimeEvidence(records('fe'));
 assert.equal(be.alias,'@workspaces/be');assert.equal(fe.alias,'@workspaces/fe');
 assert.equal(be.revision,head);assert.equal(fe.revision,head);
 assert.equal(be.endpoint,'http://127.0.0.1:3068/graphql');assert.equal(fe.endpoint,'http://127.0.0.1:3067/');
 assert.notEqual(be.worktree,fe.worktree);assert.notEqual(be.runtimeFingerprint,fe.runtimeFingerprint);
 assert.equal(be.repositoryHash,undefined,'Git repository identity is added only by the accepted proof reader');
 const servedAncestor=records();servedAncestor.before.entry.head=servedAncestor.after.entry.head=other;
 servedAncestor.before.source.head=servedAncestor.after.source.head=other;servedAncestor.verification.servedHead=other;
 assert.equal(joinRuntimeEvidence(servedAncestor).revision,other,'measured served HEAD may contain the pinned source ancestor');
});

test('unit join rejects wrong role, source, endpoint and unmeasured registry siblings',()=>{
 const changes=[
  x=>{x.alias='@workspaces/landing';},x=>{x.routeKey='foreign/be';},x=>{x.after.routeKey='sample/fe';},
  x=>{x.after.env='prod';},x=>{x.after.wantedCommit=other;},x=>{x.pinned='context-only';},
  x=>{x.after.entry.status='starting';},x=>{x.after.entry.lease={sessionId:'foreign'};},x=>{x.after.entry.contains=[];},
  x=>{x.after.source.ancestor=false;},x=>{x.after.source.worktree=path.resolve('foreign');},
  x=>{x.verification.role='fe';},x=>{x.verification.commit=other;},x=>{x.verification.servedHead=other;},
  x=>{x.verification.urls=['http://127.0.0.1:9999/graphql'];},x=>{x.verification.urls=['http://127.0.0.1:3068/another'];},
  x=>{x.verification.urls=['http://secret:password@127.0.0.1:3068/graphql'];},x=>{x.verification.urls=[];},
  x=>{x.before.entry.endpoints.frontend='http://127.0.0.1:3067/';x.after.entry.endpoints.frontend='http://127.0.0.1:3067/';x.verification.urls=['http://127.0.0.1:3067/'];}
 ];
 for(const change of changes){const input=records();change(input);assert.throws(()=>joinRuntimeEvidence(input),/COORDINATION_RUNTIME/);}
 const browser=records('fe');browser.verification.urls.push('https://foreign.example/redirect');
 assert.throws(()=>joinRuntimeEvidence(browser),/foreign runtime origin/);
});

test('unit join rejects runtime changes and stale or invalid invocation intervals',()=>{
 for(const change of [
  x=>{x.after.entry.generation++;},x=>{x.after.entry.server.pid++;},x=>{x.after.entry.server.listenerPid++;},
  x=>{x.after.entry.endpoints.api='http://127.0.0.1:3068/replaced';},
  x=>{x.after.entry.head=other;x.after.source.head=other;},
  x=>{x.before.finishedAt=at(11);},x=>{x.after.startedAt=at(19);},
  x=>{x.verification.startedAt=at(21);},x=>{x.before.startedAt=at(6);},
  x=>{delete x.verification.startedAt;},x=>{x.verification.finishedAt='invalid';},
  x=>{delete x.before.finishedAt;},x=>{x.after.startedAt='invalid';}
 ]){const input=records();change(input);assert.throws(()=>joinRuntimeEvidence(input),/COORDINATION_RUNTIME/);}
 const changedEvidence=records();changedEvidence.verification.fingerprint='sha256:'+'4'.repeat(64);
 assert.notEqual(joinRuntimeEvidence(changedEvidence).runtimeFingerprint,joinRuntimeEvidence(records()).runtimeFingerprint);
});

test('unit join refuses intact runtime observations from another coordinator or retained assignment',()=>{
 for(const change of [
  x=>{delete x.coordination;},x=>{delete x.before.coordination;},x=>{delete x.after.coordination;},
  x=>{x.before.coordination.coordinatorSessionId='another-portfolio';},
  x=>{x.after.coordination.assignment.hash='sha256:'+'9'.repeat(64);},
  x=>{for(const record of [x.before,x.after])record.coordination.assignment.ref='runtime/history/assignments/older.json';}
 ]){const input=records();change(input);assert.throws(()=>joinRuntimeEvidence(input),/coordinator|assignment/);}
});

test('public integration reader rejects invented producer identities before accepting caller-supplied records',async()=>{
 const root=path.resolve(import.meta.dirname,'..');
 await assert.rejects(verifiedIntegrationBindings(root,{sessionId:'../invented',step:1,parallel:1,operatorId:'api.verify'},
  {contexts:[{alias:'@workspaces/be',head}]},{runtime:[records()]},{hostRoot:path.dirname(root)}),/producer proof identity/);
});

test('public integration reader refuses unmarked historical receipt fixtures as current integration proof',async()=>{
 const fixture=producerImportFixture();
 try{
  await assert.rejects(verifiedIntegrationBindings(path.resolve(import.meta.dirname,'..'),
   {sessionId:'original',step:1,parallel:1,operatorId:'api.verify'},
   {},{runtime:[records()]},{hostRoot:fixture.host}),/current runtime revision/);
 }finally{fixture.cleanup();}
});
