import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,symlinkSync} from 'node:fs';
import path from 'node:path';
import {createSourceFixture,read,put} from './workflow-source-fixture.mjs';

test('the embedded state discovery is the exact structural projection of its canonical kind schema',()=>{
 const root=path.resolve(import.meta.dirname,'..'),canonical=read(path.join(root,'templates/kinds/goal-discovery.schema.json'));
 delete canonical.$id;
 assert.deepEqual(read(path.join(root,'templates/step/state.schema.json')).properties.mission.properties.discovery,canonical);
});

async function fixture(t,{draft=false}={}){
 const peer=await createSourceFixture(t,{sessionId:'peer-source'});
 const original=peer.state(),selector={sessionId:peer.sessionId,impactId:original.mission.discovery.impacts[0].id,mission:original.missionSnapshots[1]};
 const coordinator=await createSourceFixture(t,{existing:peer,sessionId:'portfolio',topology:{mode:'coordinated'},draft,
  mission:({discovery})=>({goal:'Verify the complete original peer product scope.',doneWhen:[{evidence:'The original product outcomes and verification are accepted at their delivered heads.',producedBy:'workflow.verify'}],
   discovery:{...discovery,impacts:[{...structuredClone(original.mission.discovery.impacts[0]),id:'peer-product',producer:selector}],lanes:structuredClone(original.mission.discovery.lanes)}})});
 return{peer,coordinator,original,selector,...await peer.load('scripts/mission-scope.mjs')};
}

test('a coordinator retains true API/backend impact while proof ownership derives workflow.verify and no product write authority',async t=>{
 const f=await fixture(t),state=f.coordinator.state();
 assert.deepEqual(state.mission.discovery.impacts[0].tags,['backend','architecture']);
 assert.deepEqual(f.deliveryTargets(state.mission,f.coordinator.root),['workflow.verify']);
 assert.deepEqual(f.peerScopeErrors(state,{root:f.coordinator.root}),[]);
 assert.deepEqual(state.mission.doneWhen.map(line=>line.producedBy),['workflow.verify']);
 const errors=f.scopeBindingErrors(state,{operatorId:'backend.generate',requirements:{mode:'apply'}},f.coordinator.root);
 assert.ok(errors.some(error=>error.includes('peer-owned be')),'same repository does not grant coordinator source writes');
 assert.equal(f.peer.state().mission.confirmation.scopeHash,f.original.mission.confirmation.scopeHash);
 const {renderScope}=await f.peer.load('scripts/scope-presentation.mjs');
 assert.match(renderScope(state.mission),/executed by peer-source/);
 const {workflowPeerSnapshotErrors}=await f.peer.load('scripts/workflow-verification.mjs');
 // Snapshot omission is checked before any alleged product outcome is consumed.
 const branch=path.join(f.coordinator.session,'step-1/parallel-1');
 put(path.join(branch,'request/peers.json'),{version:2,peers:{other:{sessionId:'other',owns:'elsewhere',goal:'different outcome',heads:[{alias:'@workspaces/be',head:f.peer.base,deliveryDoneWhen:[0]}],doneWhen:[state.mission.doneWhen[0].evidence]}}});
 const failures=workflowPeerSnapshotErrors(f.coordinator.root,branch,{operatorId:'workflow.verify',requirements:{peers:'request/peers.json'},contexts:[],frozenInputs:[]},state);
 assert.ok(failures.some(error=>error.includes('omits the original owner')),JSON.stringify(failures));
});

test('normal peer scope correction invalidates new coordinator authority without changing its original selected proof',async t=>{
 const f=await fixture(t,{draft:true}),before=readFileSync(path.join(f.peer.session,f.selector.mission.ref));
 const {confirmSession}=await f.peer.load('scripts/v23-test-fixture.mjs');
 const changed=structuredClone(f.peer.state().mission);delete changed.confirmation;delete changed.scope;changed.goal+=' Corrected authorized behavior.';
 await confirmSession(f.peer.session,{selected:'corrected',selectedBy:'user',sourceRef:'user:corrected-peer',mission:changed});
 await confirmSession(f.peer.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:confirmed-peer-correction'});
 assert.match(f.peerScopeErrors(f.coordinator.state(),{root:f.coordinator.root}).join('\n'),/changed or was revoked/);
 await assert.rejects(confirmSession(f.coordinator.session,{selected:'as-stated',selectedBy:'user',sourceRef:'user:portfolio'}),/GOAL_PEER_SCOPE.*changed or was revoked/);
 assert.deepEqual(readFileSync(path.join(f.peer.session,f.selector.mission.ref)),before);
 assert.deepEqual(f.peerScopeErrors(f.coordinator.state(),{root:f.coordinator.root,current:false}),[],'historical selector still identifies intact original authority');
});

test('wrong peer identity, altered impact, wrong seal and solo delegation refuse exact scope validation',async t=>{
 const f=await fixture(t);
 const cases=[
  ['self',state=>{state.mission.discovery.impacts[0].producer.sessionId=state.id;}],
  ['wrong seal',state=>{state.mission.discovery.impacts[0].producer.mission.hash='sha256:'+'0'.repeat(64);}],
  ['wrong impact',state=>{state.mission.discovery.impacts[0].producer.impactId='absent';}],
  ['widened code',state=>{state.mission.discovery.impacts[0].code=['src'];}],
  ['hidden API classification',state=>{state.mission.discovery.impacts[0].tags=['documentation'];}],
  ['changed behavior',state=>{state.mission.discovery.impacts[0].behavior+=' another product';}],
  ['solo',state=>{state.topology.mode='solo';}]
 ];
 for(const[name,change]of cases){const state=structuredClone(f.coordinator.state());change(state);assert.ok(f.peerScopeErrors(state,{root:f.coordinator.root}).length,name);}
 const mixed=structuredClone(f.coordinator.state());mixed.mission.discovery.impacts.push({...mixed.mission.discovery.impacts[0],id:'local-notes',producer:undefined,code:['docs'],tags:['documentation']});
 const wanted=root=>({operatorId:'backend.generate',requirements:{mode:'apply'},environment:{workspace:{alias:'@workspaces/be',worktree:f.coordinator.worktree},writes:[`@workspaces/be/${root}`]}});
 assert.deepEqual(f.scopeBindingErrors(mixed,wanted('docs/notes.md'),f.coordinator.root),[]);
 assert.match(f.scopeBindingErrors(mixed,wanted('src/modules/fixture/worker.mjs'),f.coordinator.root).join('\n'),/overlap or exceed/);
 assert.match(f.scopeBindingErrors(mixed,wanted('.'),f.coordinator.root).join('\n'),/overlap or exceed/);
 const absolute=wanted('docs/notes.md');absolute.environment.writes=[path.join(f.coordinator.worktree,'src/modules/fixture/worker.mjs')];
 assert.match(f.scopeBindingErrors(mixed,absolute,f.coordinator.root).join('\n'),/overlap or exceed/,'absolute product roots cannot hide as local coordination notes');
 const delegated=path.join(f.coordinator.worktree,'src/modules/fixture');mkdirSync(delegated,{recursive:true});
 mkdirSync(path.join(f.coordinator.worktree,'docs'),{recursive:true});
 symlinkSync(delegated,path.join(f.coordinator.worktree,'docs/product-link'),process.platform==='win32'?'junction':'dir');
 assert.match(f.scopeBindingErrors(mixed,wanted('docs/product-link/worker.mjs'),f.coordinator.root).join('\n'),/overlap or exceed/,'a filesystem alias under local notes retains its real delegated product ownership');
});
