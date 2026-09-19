import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {EVIDENCE_PACKET,evaluateAcceptance,kernelVerificationReceipt,requiredGatesFor,resolveEvidencePacket} from '../scripts/checks/acceptance.mjs';

const hash=value=>crypto.createHash('sha256').update(value).digest('hex');
const identity={workflowId:'wf',opId:'op',attempt:1,generation:3,jobId:'job'};
const candidate={candidateDigest:'c'.repeat(64),oracleDigest:'o'.repeat(64),environmentDigest:'env'};
const fixture=t=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-gate-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  fs.writeFileSync(path.join(root,'result.json'),'passed');return root;};
const packet=root=>({schema:EVIDENCE_PACKET,...identity,gateId:'independent-review',gateKind:'semantic-review',owner:'reviewer-job',independentFromAttempt:true,
  ownerAttemptId:'review-attempt-2',complete:true,startedAt:'2026-09-14T01:00:00.000Z',finishedAt:'2026-09-14T01:01:00.000Z',
  ...candidate,verdict:'pass',assertions:[{id:'A-1',sourceRef:'SRS-1#AC-1',outcome:'pass',evidenceRefs:['result']}],
  artifacts:[{id:'result',path:'result.json',sha256:hash(fs.readFileSync(path.join(root,'result.json')))}]});

test('only independently resolved passing required gates admit integration',t=>{
  const root=fixture(t),requirements=requiredGatesFor({kind:'backend.implement',policy:{'backend.implement':[{id:'independent-review',kind:'semantic-review',independent:true}]}});
  const result=evaluateAcceptance({requirements,evidence:[packet(root)],candidate,identity,evidenceRoots:{'independent-review':root}});
  assert.equal(result.verdict,'pass');assert.equal(result.admitIntegration,true);
});

test('missing, unavailable, malformed and stale required gates fail closed',t=>{
  const root=fixture(t),requirement={id:'independent-review',required:true,independent:true};
  assert.equal(evaluateAcceptance({requirements:[requirement],evidence:[],candidate,identity}).admitIntegration,false);
  for(const mutate of [p=>p.verdict='unavailable',p=>p.candidateDigest='x'.repeat(64),p=>delete p.assertions,p=>p.independentFromAttempt=false,p=>p.complete=false]){
    const value=packet(root);mutate(value);
    assert.equal(evaluateAcceptance({requirements:[requirement],evidence:[value],candidate,identity,evidenceRoots:{'independent-review':root}}).admitIntegration,false);
  }
});

test('artifact bytes are independently resolved and hash drift is inconclusive',t=>{
  const root=fixture(t),value=packet(root);
  assert.equal(resolveEvidencePacket(value,{evidenceRoot:root,requireIndependent:true}).ok,true);
  fs.writeFileSync(path.join(root,'result.json'),'changed');
  const result=evaluateAcceptance({requirements:[{id:'independent-review',required:true,independent:true}],evidence:[value],candidate,identity,
    evidenceRoots:{'independent-review':root}});
  assert.equal(result.verdict,'inconclusive');assert.match(result.blocking[0].reason,/hash mismatch/);
});

test('unresolved authored evidence cannot satisfy a required gate',t=>{
  const root=fixture(t),result=evaluateAcceptance({requirements:[{id:'independent-review',required:true}],evidence:[packet(root)],candidate,identity});
  assert.equal(result.admitIntegration,false);assert.match(result.blocking[0].reason,/not independently resolved/);
});

test('path traversal and symlink evidence cannot be resolved',t=>{
  const root=fixture(t),outside=fs.mkdtempSync(path.join(os.tmpdir(),'starci-gate-outside-'));t.after(()=>fs.rmSync(outside,{recursive:true,force:true}));
  fs.writeFileSync(path.join(outside,'secret'),'secret');
  const traversal=packet(root);traversal.artifacts=[{id:'result',path:'../secret',sha256:hash('secret')}];
  assert.equal(resolveEvidencePacket(traversal,{evidenceRoot:root}).ok,false);
  const link=path.join(root,'link');fs.symlinkSync(outside,link,process.platform==='win32'?'junction':'dir');
  const linked=packet(root);linked.artifacts=[{id:'result',path:'link/secret',sha256:hash('secret')}];
  assert.equal(resolveEvidencePacket(linked,{evidenceRoot:root}).ok,false);
});

test('owner verification receipts can only be adapted from kernel-resolved conclusive evidence',t=>{
  const root=fixture(t),resolved=resolveEvidencePacket(packet(root),{evidenceRoot:root,requireIndependent:true});assert.equal(resolved.ok,true);
  assert.deepEqual(kernelVerificationReceipt({id:'receipt-1',requestId:'request-1',evidence:resolved.packet,acceptance:{verdict:'pass'},at:'2026-09-14T01:02:00.000Z'}),
    {id:'receipt-1',requestId:'request-1',origin:'kernel-verification',status:'verified',at:'2026-09-14T01:02:00.000Z'});
  assert.throws(()=>kernelVerificationReceipt({id:'receipt-2',requestId:'request-1',evidence:packet(root),acceptance:{verdict:'pass'}}),/kernel-resolved/);
  assert.throws(()=>kernelVerificationReceipt({id:'receipt-3',requestId:'request-1',evidence:resolved.packet,acceptance:{verdict:'inconclusive'}}),/conclusive/);
});
