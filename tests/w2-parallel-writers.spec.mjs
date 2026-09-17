import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {DEFAULT_MAX_CONCURRENT_WRITERS,beginDetectionCandidate,candidateWriterResource,freezeDetectionCandidate,maxConcurrentWriters} from '../kernel/candidate-bridge.mjs';
import {prepareCandidateIntegration} from '../kernel/candidates.mjs';
import {createEngineRuntime} from '../kernel/engine.mjs';

const git=(command,args,options={})=>spawnSync(command,args,{encoding:'utf8',windowsHide:true,...options});
const run=(cwd,...args)=>{const result=git('git',args,{cwd,encoding:'utf8',windowsHide:true});assert.equal(result.status,0,String(result.stderr));return result.stdout.trim();};

// One committed template repo copied per test: a sibling write scope (`lib/**`), an own write scope (`src/**`)
// and a file no operation owns (`escape.txt` written during a run) all start from the same baseline.
let repoBase;
test.before(()=>{
  repoBase=fs.mkdtempSync(path.join(os.tmpdir(),'starci-w2-basetpl-'));
  run(repoBase,'init','--quiet','-b','main');run(repoBase,'config','user.email','w2@starci.local');run(repoBase,'config','user.name','W2');run(repoBase,'config','commit.gpgsign','false');
  fs.mkdirSync(path.join(repoBase,'src'));fs.writeFileSync(path.join(repoBase,'src','app.js'),'one\n');
  fs.mkdirSync(path.join(repoBase,'lib'));fs.writeFileSync(path.join(repoBase,'lib','sibling.js'),'lib\n');
  fs.writeFileSync(path.join(repoBase,'keep.txt'),'user baseline\n');
  run(repoBase,'add','-A');run(repoBase,'commit','--quiet','-m','base');
});
test.after(()=>{fs.rmSync(repoBase,{recursive:true,force:true});});
const cloneRepo=(t,prefix='starci-w2-repo-')=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),prefix));fs.cpSync(repoBase,root,{recursive:true});t.after(()=>{try{fs.rmSync(root,{recursive:true,force:true});}catch{}});return root;};

const candidate=(t,root,options={})=>{
  const parent=path.dirname(root),tag=path.basename(root);
  const bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:'job'},repoRoot:root,
    workerRoot:path.join(parent,`${tag}-worker`),controlRoot:path.join(parent,`${tag}-control`),
    allowlist:['src/**'],git,environmentDigest:'env',...options});
  t.after(()=>{try{fs.rmSync(bridge.snapshot.workerRoot,{recursive:true,force:true});fs.rmSync(bridge.snapshot.controlRoot,{recursive:true,force:true});}catch{}});
  return bridge;
};

const engineFixture=(t,{allocation={},root=null}={})=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-w2-engine-'));t.after(()=>{try{fs.rmSync(dir,{recursive:true,force:true});}catch{}});
  const worktree=root??path.join(dir,'repo');fs.mkdirSync(worktree,{recursive:true});
  const state={id:'wf-w2',worktree,head:'a'.repeat(40),createdAt:1,engine:{schema:'starci/engine@1',generation:1,ledgerFile:path.join(dir,'runtime.sqlite')},ops:[]};
  const store={dir:path.join(dir,'workflow'),appendEvent(){},saveState(){}};
  const runtime=createEngineRuntime({store,state,git,eligibility:()=>({eligible:true,mode:'qualified'}),
    spawnChild:()=>({pid:1,once(){},unref(){}}),runtimeProfile:{schema:'starci/runtimes@1',runtimes:{},allocation}});
  t.after(()=>runtime.close());
  return {dir,state,store,runtime,worktree};
};
const writerOp=(id,scope)=>({id,kind:'backend.implement',attempt:1,allowlist:[scope]});
const allocationFor={runtime:'codex-agent',target:'gpt-5.6-sol',role:'implement'};

test('the per-repo writer bound defaults to 10 and reads a positive integer profile override',()=>{
  assert.equal(DEFAULT_MAX_CONCURRENT_WRITERS,10);
  assert.equal(maxConcurrentWriters(null),10);
  assert.equal(maxConcurrentWriters({}),10);
  assert.equal(maxConcurrentWriters({allocation:{}}),10);
  assert.equal(maxConcurrentWriters({allocation:{maxConcurrentWriters:3}}),3);
  assert.equal(maxConcurrentWriters({allocation:{maxConcurrentWriters:0}}),10,'a non-positive override falls back to the default bound');
  assert.equal(maxConcurrentWriters({allocation:{maxConcurrentWriters:2.5}}),10,'a non-integer override falls back to the default bound');
});

test('two disjoint writers hold reservations on one repository simultaneously at the default bound',t=>{
  const f=engineFixture(t),writerKey=candidateWriterResource(f.worktree).key;
  assert.equal(f.runtime.writerCapacity,DEFAULT_MAX_CONCURRENT_WRITERS);
  assert.equal(f.runtime.journal.db.prepare('SELECT capacity FROM resources WHERE resource_key=?').get(writerKey).capacity,DEFAULT_MAX_CONCURRENT_WRITERS);
  const first=f.runtime.reserveOperation(writerOp('op-a','src/**'),allocationFor);
  const second=f.runtime.reserveOperation(writerOp('op-b','lib/**'),allocationFor);
  assert.equal(first.ok,true,first.reasons?.join(';'));
  assert.equal(second.ok,true,second.reasons?.join(';'));
  assert.equal(f.runtime.journal.db.prepare('SELECT COUNT(*) AS n FROM leases WHERE resource_key=?').get(writerKey).n,2,
    'both disjoint writers hold the shared per-repo writer resource at once');
});

test('the profile override caps the writer pool and refuses the next reservation',t=>{
  const f=engineFixture(t,{allocation:{maxConcurrentWriters:2}}),writerKey=candidateWriterResource(f.worktree).key;
  assert.equal(f.runtime.writerCapacity,2);
  assert.equal(f.runtime.journal.db.prepare('SELECT capacity FROM resources WHERE resource_key=?').get(writerKey).capacity,2);
  assert.equal(f.runtime.reserveOperation(writerOp('op-1','a/**'),allocationFor).ok,true);
  assert.equal(f.runtime.reserveOperation(writerOp('op-2','b/**'),allocationFor).ok,true);
  const third=f.runtime.reserveOperation(writerOp('op-3','c/**'),allocationFor);
  assert.equal(third.ok,false);
  assert.match(third.reasons.join(';'),/capacity 2 has 2 used/);
});

test('the begun bridge writer hint reflects the configured bound',t=>{
  const f=engineFixture(t,{root:cloneRepo(t)});
  const op=writerOp('op-w','src/**');
  assert.equal(f.runtime.reserveOperation(op,allocationFor).ok,true);
  f.runtime.beginCandidate(op,{environmentDigest:'env'});
  assert.equal(f.runtime.candidateBridge(op).writer.maxWriters,DEFAULT_MAX_CONCURRENT_WRITERS);
  const g=engineFixture(t,{allocation:{maxConcurrentWriters:3},root:cloneRepo(t)});
  const other=writerOp('op-w3','src/**');
  assert.equal(g.runtime.reserveOperation(other,allocationFor).ok,true);
  g.runtime.beginCandidate(other,{environmentDigest:'env'});
  assert.equal(g.runtime.candidateBridge(other).writer.maxWriters,3);
});

test('a change inside another live op scope reports concurrent-writer-drift, never outside-allowlist',t=>{
  const root=cloneRepo(t),bridge=candidate(t,root);
  fs.writeFileSync(path.join(root,'src','app.js'),'own write\n');
  fs.writeFileSync(path.join(root,'lib','sibling.js'),'sibling in-flight write\n');
  const frozen=freezeDetectionCandidate(bridge,{git,reportedFiles:['src/app.js'],foreignAllowlists:['lib/**']});
  assert.equal(frozen.status,'quarantine');
  assert.ok(frozen.reasons.includes('concurrent-writer-drift:lib/sibling.js'),frozen.reasons.join(';'));
  assert.ok(!frozen.reasons.some(reason=>reason.startsWith('outside-allowlist:')),frozen.reasons.join(';'));
  assert.deepEqual(frozen.concurrentWriterDrift,['lib/sibling.js']);
  assert.ok(frozen.observedFiles.includes('lib/sibling.js'),'foreign drift is reported as evidence, never silently ignored');
});

test('a foreign-scope path already dirty at begin reports concurrent-writer-drift, not baseline modification',t=>{
  const root=cloneRepo(t);
  fs.writeFileSync(path.join(root,'lib','inflight.js'),'sibling write predating this candidate\n');
  const bridge=candidate(t,root);
  fs.writeFileSync(path.join(root,'lib','inflight.js'),'sibling kept writing while this op ran\n');
  const frozen=freezeDetectionCandidate(bridge,{git,reportedFiles:[],foreignAllowlists:['lib/**']});
  assert.equal(frozen.status,'quarantine');
  assert.ok(frozen.reasons.includes('concurrent-writer-drift:lib/inflight.js'),frozen.reasons.join(';'));
  assert.ok(!frozen.reasons.some(reason=>reason.startsWith('pre-existing-user-work-modified:')),frozen.reasons.join(';'));
});

test('a change outside every live scope still fails closed exactly as before',t=>{
  const root=cloneRepo(t),bridge=candidate(t,root);
  fs.writeFileSync(path.join(root,'src','app.js'),'own write\n');
  fs.writeFileSync(path.join(root,'lib','sibling.js'),'sibling in-flight write\n');
  fs.writeFileSync(path.join(root,'escape.txt'),'no live scope owns this\n');
  const frozen=freezeDetectionCandidate(bridge,{git,reportedFiles:['src/app.js'],foreignAllowlists:['lib/**']});
  assert.equal(frozen.status,'quarantine');
  assert.ok(frozen.reasons.includes('concurrent-writer-drift:lib/sibling.js'),frozen.reasons.join(';'));
  assert.ok(frozen.reasons.includes('outside-allowlist:escape.txt'),frozen.reasons.join(';'));
});

test('without declared foreign scopes the identical change still quarantines as outside-allowlist',t=>{
  const root=cloneRepo(t),bridge=candidate(t,root);
  fs.writeFileSync(path.join(root,'lib','sibling.js'),'foreign write\n');
  const frozen=freezeDetectionCandidate(bridge,{git,reportedFiles:[]});
  assert.equal(frozen.status,'quarantine');
  assert.ok(frozen.reasons.includes('outside-allowlist:lib/sibling.js'),frozen.reasons.join(';'));
  assert.ok(!frozen.reasons.some(reason=>reason.startsWith('concurrent-writer-drift:')));
});

test('the concurrentScopes spelling is an accepted alias',t=>{
  const root=cloneRepo(t),bridge=candidate(t,root);
  fs.writeFileSync(path.join(root,'lib','sibling.js'),'foreign write\n');
  const frozen=freezeDetectionCandidate(bridge,{git,reportedFiles:[],concurrentScopes:['lib/**']});
  assert.equal(frozen.status,'quarantine');
  assert.ok(frozen.reasons.includes('concurrent-writer-drift:lib/sibling.js'),frozen.reasons.join(';'));
});

test('aggregate freeze routes each foreign scope to its own root before classifying drift',t=>{
  const rootA=cloneRepo(t),rootB=cloneRepo(t,'starci-w2-other-');
  const parent=path.dirname(rootA),tag=`${path.basename(rootA)}-agg`;
  const bridge=beginDetectionCandidate({identity:{workflowId:'wf',opId:'op',attempt:1,generation:1,jobId:'job'},
    repoRoot:rootA,workerRoot:path.join(parent,`${tag}-worker`),controlRoot:path.join(parent,`${tag}-control`),
    roots:[{id:'source',role:'source',repoRoot:rootA,primary:true,workerWritable:true,allowlist:['src/**']},
      {id:'sibling-root',role:'work',repoRoot:rootB,workerWritable:true,allowlist:['docs/**']}],
    maxWriters:4,environmentDigest:'env',git});
  t.after(()=>{try{fs.rmSync(path.join(parent,`${tag}-worker`),{recursive:true,force:true});fs.rmSync(path.join(parent,`${tag}-control`),{recursive:true,force:true});}catch{}});
  assert.equal(bridge.writer.maxWriters,8,'the aggregate hint is the per-root bound times the writable roots');
  fs.writeFileSync(path.join(rootA,'src','app.js'),'own write\n');
  fs.writeFileSync(path.join(rootB,'lib','sibling.js'),'foreign write in the other root\n');
  const frozen=freezeDetectionCandidate(bridge,{git,reportedFiles:['src/app.js'],foreignAllowlists:[path.join(rootB,'lib/**')]});
  assert.equal(frozen.status,'quarantine');
  assert.ok(frozen.reasons.includes('sibling-root:concurrent-writer-drift:lib/sibling.js'),frozen.reasons.join(';'));
  assert.ok(!frozen.reasons.some(reason=>/outside-allowlist/.test(reason)),frozen.reasons.join(';'));
  assert.deepEqual(frozen.concurrentWriterDrift,[path.join(rootB,'lib','sibling.js').replaceAll('\\','/')]);
});

test('the engine freezeCandidate surface threads foreignAllowlists into the classification',t=>{
  const root=cloneRepo(t),f=engineFixture(t,{root});
  const op=writerOp('op-f','src/**');
  assert.equal(f.runtime.reserveOperation(op,allocationFor).ok,true);
  f.runtime.beginCandidate(op,{environmentDigest:'env'});
  fs.writeFileSync(path.join(root,'src','app.js'),'own write\n');
  fs.writeFileSync(path.join(root,'lib','sibling.js'),'sibling in-flight write\n');
  const frozen=f.runtime.freezeCandidate(op,{reportedFiles:['src/app.js'],foreignAllowlists:['lib/**']});
  assert.equal(frozen.status,'quarantine');
  assert.ok(frozen.reasons.includes('concurrent-writer-drift:lib/sibling.js'),frozen.reasons?.join(';'));
  assert.ok(!frozen.reasons.some(reason=>reason.startsWith('outside-allowlist:')),frozen.reasons?.join(';'));
  assert.deepEqual(frozen.concurrentWriterDrift,['lib/sibling.js']);
});

test('detection-canonical integration quarantines with canonical-advanced-during-run when a sibling committed',t=>{
  const root=cloneRepo(t),bridge=candidate(t,root);
  fs.writeFileSync(path.join(root,'src','app.js'),'own write\n');
  const frozen=freezeDetectionCandidate(bridge,{git,reportedFiles:['src/app.js']});
  assert.equal(frozen.status,'sealed');
  // A disjoint sibling committed between this candidate's seal and its integration: the CAS refuses to promote
  // over the moved head and names the retryable cause distinctly.
  fs.writeFileSync(path.join(root,'lib','sibling.js'),'sibling committed write\n');
  run(root,'add','-A');run(root,'commit','--quiet','-m','sibling');
  const prepared=prepareCandidateIntegration(frozen.snapshot,frozen.packet,{canonicalRoot:root,git,mode:'detection-canonical'});
  assert.equal(prepared.status,'quarantine');
  assert.ok(prepared.reasons.includes('canonical-advanced-during-run'),prepared.reasons.join(';'));
  const isolated=prepareCandidateIntegration(frozen.snapshot,frozen.packet,{canonicalRoot:root,git,mode:'hard-isolation'});
  assert.equal(isolated.status,'quarantine');
  assert.ok(!isolated.reasons.includes('canonical-advanced-during-run'),'hard-isolation keeps its historical reason set');
});
