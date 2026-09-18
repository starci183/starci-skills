import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {applyPreparedIntegration,assuranceFor,createCandidateSnapshot,prepareCandidateIntegration,sealCandidate,verifyCandidateIdentity} from '../kernel/candidates.mjs';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-candidate-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const repo=path.join(root,'repo'),worker=path.join(root,'worker'),control=path.join(root,'control');
  fs.mkdirSync(path.join(repo,'src'),{recursive:true});fs.mkdirSync(path.join(repo,'oracle'),{recursive:true});
  fs.writeFileSync(path.join(repo,'src','app.mjs'),'export const value=1;\n');
  fs.writeFileSync(path.join(repo,'oracle','behavior.spec.mjs'),'expected:value=2\n');
  const identity={workflowId:'wf-1',opId:'op-1',attempt:1,generation:2,jobId:'job-1'};
  const snapshot=createCandidateSnapshot({identity,repoRoot:repo,workerRoot:worker,controlRoot:control,
    sourcePaths:['src/app.mjs'],oraclePaths:['oracle/behavior.spec.mjs'],acceptedHead:'a'.repeat(40),environmentDigest:'env-1'});
  return {root,repo,worker,control,identity,snapshot};
};

test('snapshot separates protected control bytes and honestly labels detection-only assurance',t=>{
  const f=fixture(t);
  assert.equal(f.snapshot.assurance.mode,'detection-only');
  assert.equal(f.snapshot.assurance.preventsOutOfScopeWrites,false);
  assert.equal(fs.existsSync(path.join(f.worker,'oracle','behavior.spec.mjs')),false);
  assert.equal(fs.readFileSync(path.join(f.snapshot.oracleRoot,'oracle','behavior.spec.mjs'),'utf8'),'expected:value=2\n');
  assert.throws(()=>assuranceFor({requested:'hard-boundary'}),/attestation/);
  assert.equal(assuranceFor({requested:'hard-boundary',adapterAttestation:{verdict:'pass',enforcesWrites:true}}).preventsOutOfScopeWrites,true);
});

test('sealing inventories actual worker bytes and ignores a dishonest report file list',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.worker,'src','app.mjs'),'export const value=2;\n');
  const packet=sealCandidate(f.snapshot,{allowedWrites:['src/app.mjs'],reportedFiles:[]});
  assert.deepEqual(packet.changes.map(item=>item.path),['src/app.mjs']);
  assert.deepEqual(packet.reportedFiles,[]);
  assert.equal(verifyCandidateIdentity(f.snapshot,packet).verdict,'pass');
});

test('replaying a sealed freeze judges the packet it already sealed, not a recomputed allowlist',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.worker,'src','app.mjs'),'export const value=2;\n');
  const packet=sealCandidate(f.snapshot,{allowedWrites:['src/app.mjs']});
  // The canonical tree went back to clean after the seal, so the caller observes nothing to allow. The sealed
  // delta is still the attempt's own, and its replay returns the same immutable packet instead of refusing it.
  const replayed=sealCandidate(f.snapshot,{allowedWrites:[]});
  assert.deepEqual(replayed.changes.map(item=>item.path),['src/app.mjs']);
  assert.equal(replayed.candidateDigest,packet.candidateDigest);
  // Bytes that drifted from what was sealed are still refused - the packet allows its own paths, never new ones.
  fs.writeFileSync(path.join(f.worker,'src','app.mjs'),'export const value=3;\n');
  assert.throws(()=>sealCandidate(f.snapshot,{allowedWrites:[]}),/conflicts with current bytes or identity/);
  fs.writeFileSync(path.join(f.worker,'src','app.mjs'),'export const value=2;\n');
  fs.writeFileSync(path.join(f.worker,'src','extra.mjs'),'export const extra=1;\n');
  assert.throws(()=>sealCandidate(f.snapshot,{allowedWrites:[]}),/outside its allowed writes/);
});

test('hidden, out-of-scope and linked files are rejected from candidate provenance',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.worker,'hidden.txt'),'hidden');
  assert.throws(()=>sealCandidate(f.snapshot,{candidatePaths:['src/app.mjs'],allowedWrites:['src/app.mjs']}),/omitted files/);
  assert.throws(()=>sealCandidate(f.snapshot,{allowedWrites:['src/app.mjs']}),/outside its allowed writes/);
});

test('candidate, oracle and canonical drift quarantine without modifying any bytes',t=>{
  const f=fixture(t);
  fs.writeFileSync(path.join(f.worker,'src','app.mjs'),'export const value=2;\n');
  const packet=sealCandidate(f.snapshot,{allowedWrites:['src/app.mjs']});
  fs.writeFileSync(path.join(f.worker,'src','app.mjs'),'late worker write\n');
  fs.writeFileSync(path.join(f.snapshot.oracleRoot,'oracle','behavior.spec.mjs'),'tampered\n');
  const before=fs.readFileSync(path.join(f.repo,'src','app.mjs'),'utf8');
  const verdict=verifyCandidateIdentity(f.snapshot,packet,{canonicalRoot:f.repo,expectedCanonicalEntries:f.snapshot.source.entries});
  assert.equal(verdict.verdict,'quarantine');
  assert.ok(verdict.mismatches.includes('candidate-drift'));
  assert.ok(verdict.mismatches.includes('oracle-drift'));
  assert.equal(fs.readFileSync(path.join(f.repo,'src','app.mjs'),'utf8'),before,'drift detection never autoreverts canonical bytes');
});

test('metadata cannot be placed inside the worker writable root',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-candidate-layout-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.mkdirSync(path.join(root,'repo'),{recursive:true});
  assert.throws(()=>createCandidateSnapshot({identity:{workflowId:'w',opId:'o',attempt:1,generation:1,jobId:'j'},repoRoot:path.join(root,'repo'),
    workerRoot:path.join(root,'candidate'),controlRoot:path.join(root,'candidate','control'),acceptedHead:'a'}),/outside the worker-writable root/);
});

test('integration uses expected-head and canonical-byte CAS, then promotes only sealed changes',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.worker,'src','app.mjs'),'export const value=2;\n');
  const packet=sealCandidate(f.snapshot,{allowedWrites:['src/app.mjs']});
  const git=(command,args)=>({status:0,stdout:`${f.snapshot.acceptedHead}\n`});
  const prepared=prepareCandidateIntegration(f.snapshot,packet,{canonicalRoot:f.repo,git});assert.equal(prepared.status,'ready');
  const applied=applyPreparedIntegration(f.snapshot,packet,prepared,{canonicalRoot:f.repo,git});assert.equal(applied.outcome,'applied');
  assert.equal(fs.readFileSync(path.join(f.repo,'src','app.mjs'),'utf8'),'export const value=2;\n');
});

test('detection integration CAS requires canonical bytes to equal the complete frozen post-op manifest',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.snapshot.workerRoot,'src','app.mjs'),'two\n');
  const packet=sealCandidate(f.snapshot,{allowedWrites:['src/app.mjs']}),git=()=>({status:0,stdout:`${f.snapshot.acceptedHead}\n`});
  assert.equal(prepareCandidateIntegration(f.snapshot,packet,{canonicalRoot:f.repo,git,mode:'detection-canonical'}).status,'quarantine');
  fs.writeFileSync(path.join(f.repo,'src','app.mjs'),'two\n');
  assert.equal(prepareCandidateIntegration(f.snapshot,packet,{canonicalRoot:f.repo,git,mode:'detection-canonical'}).status,'ready');
});

test('integration quarantines expected-head or user-byte drift and never overwrites it',t=>{
  const f=fixture(t);fs.writeFileSync(path.join(f.worker,'src','app.mjs'),'export const value=2;\n');
  const packet=sealCandidate(f.snapshot,{allowedWrites:['src/app.mjs']});
  const moved=prepareCandidateIntegration(f.snapshot,packet,{canonicalRoot:f.repo,git:()=>({status:0,stdout:`${'b'.repeat(40)}\n`})});
  assert.equal(moved.status,'quarantine');
  fs.writeFileSync(path.join(f.repo,'src','app.mjs'),'user edit\n');
  const drift=prepareCandidateIntegration(f.snapshot,packet,{canonicalRoot:f.repo,git:()=>({status:0,stdout:`${f.snapshot.acceptedHead}\n`})});
  assert.equal(drift.status,'quarantine');assert.ok(drift.reasons.includes('canonical-drift'));
  assert.equal(fs.readFileSync(path.join(f.repo,'src','app.mjs'),'utf8'),'user edit\n');
});
