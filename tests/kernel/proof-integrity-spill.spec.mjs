import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ledgerFileFor,openLedger,ensureWorkflow,appendEvent,storeBlob} from '../../engine/db/ledger.mjs';
import {putArtifact,stageBlob} from '../../scripts/kernel/evidence-store.mjs';
import {verifyProofs} from '../../scripts/kernel/proof-integrity.mjs';
// An event over EVENT_PAYLOAD_MAX keeps its payload whole in the blob store (events.payload_sha): the row holds a stub
// {spilled:true, sha256, bytes, count} in place of each spilled field (engine/db/ledger.mjs appendEvent, 22ed953c5), or
// no payload_json at all when the writer stored the blob itself. A report-filed / artifacts-indexed event of a draw
// loop's hundreds of files spills its artifact list, and verify-proofs read payload_json directly: every one of those
// artifacts counted 'unchained'. It now reads the whole payload, so each spilled artifact stays chained.
const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-proof-integrity-spill-'));
  const store=path.join(root,'artifacts');fs.mkdirSync(store,{recursive:true});
  const prevStore=process.env.STARCI_ARTIFACT_ROOT;process.env.STARCI_ARTIFACT_ROOT=store;
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  t.after(()=>{
    ledger.close();
    if(prevStore===undefined)delete process.env.STARCI_ARTIFACT_ROOT;else process.env.STARCI_ARTIFACT_ROOT=prevStore;
    fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25});
  });
  return ledger;
};
// A workflow with `count` filed artifacts; returns their chained {id, name, sha256} list.
const seedArtifacts=(db,wf,count)=>{
  ensureWorkflow(db,{workflowId:wf,phase:'queued',title:'spill',by:'test-fixture',reason:'seed',at:Date.now()});
  return Array.from({length:count},(_,i)=>{
    const name=`draw-loop/screen-${i}/critique.json`;
    const blob=stageBlob(JSON.stringify({screen:i,beauty:5}),{file:false,mediaType:'application/json'});
    const {artifactId}=putArtifact(db,{workflowId:wf,role:'critique',name,blob,origin:'kernel',jobId:'job-draw',opId:'interface.draw'});
    return {id:artifactId,name,sha256:blob.sha};
  });
};
const blobOf=(db,payload)=>storeBlob(db,{content:Buffer.from(JSON.stringify(payload),'utf8'),mediaType:'application/json',createdAt:Date.now()}).sha256;

test('a spilled report-filed artifact list (a stub naming the payload blob) is chained in verify-proofs',t=>{
  const ledger=fixture(t),wf='wf-proof-spill-stub';
  ledger.transaction(db=>{
    const artifacts=seedArtifacts(db,wf,6);
    const payload={outcome:'partial',reportId:'rep-1',artifacts};
    const sha=blobOf(db,payload);
    // The row appendEvent writes for an oversized payload: small fields inline, the artifact list a stub.
    const stub={spilled:true,sha256:sha,bytes:JSON.stringify(artifacts).length,count:artifacts.length};
    appendEvent(db,{workflowId:wf,entityType:'job',entityId:'job-draw',kind:'report-filed',payload:{outcome:'partial',reportId:'rep-1',artifacts:stub},payloadSha:sha});
    const out=verifyProofs(db,wf);
    assert.equal(out.files.checked,6);
    assert.equal(out.files.unchained,0,'every spilled artifact is chained');
    assert.deepEqual(out.files.tampered,[]);
    assert.equal(out.ok,true);
  });
});

test('an artifacts-indexed event whose writer stored the whole payload as a blob (no payload_json) is chained too',t=>{
  const ledger=fixture(t),wf='wf-proof-spill-blob';
  ledger.transaction(db=>{
    const artifacts=seedArtifacts(db,wf,3);
    const payload={jobId:'job-draw',indexed:artifacts.length,artifacts,filler:'x'.repeat(17000)};
    appendEvent(db,{workflowId:wf,entityType:'job',entityId:'job-draw',kind:'artifacts-indexed',payload,payloadSha:blobOf(db,payload)});
    assert.equal(db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='artifacts-indexed'").get(wf).payload_json,null);
    const out=verifyProofs(db,wf);
    assert.equal(out.files.unchained,0);
    assert.equal(out.ok,true);
  });
});

test('a spilled chain entry that differs from the ledger row is still caught as tampered',t=>{
  const ledger=fixture(t),wf='wf-proof-spill-differs';
  ledger.transaction(db=>{
    const artifacts=seedArtifacts(db,wf,2);
    const lied=artifacts.map((a,i)=>(i===0?{...a,sha256:'f'.repeat(64)}:a));
    const sha=blobOf(db,{outcome:'done',artifacts:lied});
    appendEvent(db,{workflowId:wf,entityType:'job',entityId:'job-draw',kind:'report-filed',payload:{outcome:'done',artifacts:{spilled:true,sha256:sha,bytes:1,count:2}},payloadSha:sha});
    const out=verifyProofs(db,wf);
    assert.equal(out.files.unchained,0);
    assert.deepEqual(out.files.tampered.map(x=>[x.artifactId,x.reason]),[[artifacts[0].id,'ledger-row-differs-from-chain']]);
    assert.equal(out.ok,false);
  });
});
