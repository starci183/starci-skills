import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {ledgerFileFor,openLedger,ensureWorkflow,appendEvent,storeBlob} from '../../engine/db/ledger.mjs';
import {putArtifact,stageBlob} from '../../scripts/machine/evidence-store.mjs';
import {verifyProofs,coverageOf,recordArtifactProofs,proofAcceptanceOf} from '../../scripts/kernel/proof-integrity.mjs';
import {withLedger,seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {fileReport,writeContract} from '../../engine/db/ledger.mjs';
import {recordCheck} from '../../scripts/machine/evidence-store.mjs';
import {spawnSync} from 'node:child_process';
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


const mustProofFixture=(t,{status='succeeded',outcome='done',verdict='pass',baseline=true,checks=true,unitFile='tests/unit.spec.mjs',unitDemand=null,additionalUnitFile=null}={})=>withLedger(t,({root,repoRoot,ledger})=>{
  const old=process.env.STARCI_ARTIFACT_ROOT;process.env.STARCI_ARTIFACT_ROOT=path.join(root,'private-blobs');
  t.after(()=>{if(old===undefined)delete process.env.STARCI_ARTIFACT_ROOT;else process.env.STARCI_ARTIFACT_ROOT=old;});
  const fr='.starciwork/features/proof/fr/required',id='fr.proof.required',wf='wf-required-kinds';
  fs.mkdirSync(path.join(repoRoot,fr),{recursive:true});fs.mkdirSync(path.join(repoRoot,'tests'));
  const commands={unit:unitDemand??'node --test tests/unit.spec.mjs',e2e:'node --test tests/e2e.spec.mjs'};
  const index=path.join(repoRoot,fr,'index.yaml');fs.writeFileSync(index,`id: ${id}\nrequiresProof:\n  unit: { required: true, command: '${commands.unit}' }\n  e2e: { required: true, command: '${commands.e2e}' }\n`);
  for(const kind of ['unit','e2e'])fs.writeFileSync(path.join(repoRoot,kind==='unit'?unitFile:`tests/${kind}.spec.mjs`),"import test from 'node:test';test('actual private boundary',()=>{});\n");
  if(additionalUnitFile)fs.copyFileSync(path.join(repoRoot,unitFile),path.join(repoRoot,additionalUnitFile));
  seedWorkflow(ledger,{id:wf,jobs:[{jobId:'job-proof',opId:'unit.verify',status,result:{verdict},payload:{records:[fr],owned_paths:['tests/']}}]});
  const db=ledger.db,attemptId=db.prepare("SELECT attempt_id FROM op_attempts WHERE job_id='job-proof'").get().attempt_id;
  const job=db.prepare("SELECT * FROM jobs WHERE job_id='job-proof'").get();
  const report={outcome,summary:'real private test proof',claims:[{frs:[id]}],checks:[{name:'unit',command:commands.unit,exitCode:0}]};
  fileReport(db,{attemptId,outcome,report});
  const observed=(kind,command=commands[kind],file=kind==='unit'?unitFile:`tests/${kind}.spec.mjs`)=>{const child=spawnSync(process.execPath,['--test',file],{cwd:repoRoot,encoding:'utf8',windowsHide:true,timeout:30000});
    assert.equal(child.status,0,child.stderr||child.stdout);return recordCheck(db,{attemptId,name:kind,phase:'verify',runner:'kernel',command,cwd:repoRoot,
      exitCode:child.status,stdout:stageBlob(child.stdout,{file:false}),stderr:child.stderr?stageBlob(child.stderr,{file:false}):null});};
  if(checks)observed('unit');
  const blob=stageBlob('filed private proof',{file:false});const {artifactId}=putArtifact(db,{workflowId:wf,attemptId,role:'check-stdout',name:'unit-output.txt',blob,origin:'op'});
  if(baseline)recordArtifactProofs(db,{repo:repoRoot,job,payload:JSON.parse(job.payload_json),envelope:report,
    artifacts:[{artifactId,name:'unit-output.txt',kind:'text',abs:blob.fileUri}]});
  appendEvent(db,{workflowId:wf,entityType:'job',entityId:job.job_id,kind:'artifacts-indexed',payload:{artifacts:[{id:artifactId,name:'unit-output.txt',sha256:blob.sha}]}});
  return {ledger,repoRoot,wf,attemptId,index,commands,artifactId,blob,observed,
    coverage:()=>coverageOf(db,wf,{repo:repoRoot,qualified:true})};
});

test('must-have coverage is a conjunction of exact independently observed proof kinds, not one FR claim',t=>{
  const f=mustProofFixture(t),db=f.ledger.db;
  assert.equal(coverageOf(db,f.wf,{repo:f.repoRoot}).mustOwed.length,0,'the old generic FR claim demonstrated the gap');
  let cov=f.coverage();assert.equal(cov.mustOwed.length,1);assert.deepEqual(cov.items[0].obligations.map(o=>[o.kind,o.status]),[['e2e','missing'],['unit','proven']]);
  f.observed('e2e');cov=f.coverage();assert.equal(cov.mustOwed.length,0);assert.equal(verifyProofs(db,f.wf).ok,true);
  fs.appendFileSync(path.join(f.repoRoot,'tests/unit.spec.mjs'),'// changed after proof\n');
  assert.equal(f.coverage().mustOwed[0].status,'stale','a changed dependency cannot reuse the preceding proof');
});

for(const variant of [{name:'self-declared only',checks:false},{name:'unbaselined',baseline:false},
  {name:'runtime-failed done',status:'failed',outcome:'done',verdict:'fail'}])test(`qualified coverage rejects ${variant.name}`,t=>{
  const f=mustProofFixture(t,variant);f.observed('e2e');assert.equal(f.coverage().mustOwed.length,1);
});

test('a settled partial failure retains only the genuinely green subset; a later observed red cannot hide behind an older green',t=>{
  const f=mustProofFixture(t,{status:'failed',outcome:'partial',verdict:'fail'});
  assert.deepEqual(f.coverage().items[0].obligations.map(o=>[o.kind,o.status]),[['e2e','missing'],['unit','proven']]);
  recordCheck(f.ledger.db,{attemptId:f.attemptId,name:'unit',phase:'verify',runner:'kernel',command:f.commands.unit,exitCode:1});
  assert.deepEqual(f.coverage().items[0].obligations.map(o=>[o.kind,o.status]),[['e2e','missing'],['unit','missing']]);
});

test('missing, malformed and unreadable scoped canonical FRs remain unresolved instead of shrinking must-have coverage',t=>{
  const f=mustProofFixture(t),bytes=fs.readFileSync(f.index);fs.unlinkSync(f.index);
  assert.throws(f.coverage,/ENOENT/);fs.writeFileSync(f.index,'id: [broken');assert.throws(f.coverage);
  fs.writeFileSync(f.index,bytes);const native=fs.readFileSync;
  fs.readFileSync=function(file,...args){if(path.resolve(String(file))===f.index)throw Object.assign(new Error('private read refusal'),{code:'EACCES'});return native.call(this,file,...args);};
  try{assert.throws(f.coverage,/private read refusal/);}finally{fs.readFileSync=native;}
});

test('qualified command matching preserves whitespace inside quoted argv',t=>{
  const demand='node --test "tests/a  b.spec.mjs"';
  const f=mustProofFixture(t,{checks:false,unitFile:'tests/a b.spec.mjs',unitDemand:demand,additionalUnitFile:'tests/a  b.spec.mjs'});
  const baseline=f.ledger.db.prepare('SELECT claims_json,deps_json FROM artifact_proofs WHERE artifact_id=?').get(f.artifactId);
  assert.deepEqual(JSON.parse(baseline.claims_json).specs,['tests/a  b.spec.mjs'],'quoted argv names the complete actual spec, never a trailing fragment');
  assert.ok(JSON.parse(baseline.deps_json).every(row=>/^[a-f0-9]{64}$/.test(row.digest)),'every dependency is a real current baseline');
  f.observed('unit','node --test "tests/a b.spec.mjs"','tests/a b.spec.mjs');
  assert.equal(f.coverage().items[0].obligations.find(row=>row.kind==='unit').status,'missing');
  f.observed('unit',demand,'tests/a  b.spec.mjs');
  assert.equal(f.coverage().items[0].obligations.find(row=>row.kind==='unit').status,'proven');
});

test('every admitted handover requires current integrity and kind-complete coverage; missing admission refuses', async t => {
  for (const admittedAt of [1, Date.now()]) {
    // Each immutable admission owns a separate attempt; sequential subtests close their private stores before the next.
    await t.test(admittedAt === 1 ? 'early admission' : 'current admission', t => {
      const f=mustProofFixture(t,{checks:false}),job=f.ledger.db.prepare("SELECT * FROM jobs WHERE job_id='job-proof'").get();
      writeContract(f.ledger.db,{attemptId:f.attemptId,markdown:'private captured handover',context:{contract:{schema:'starci/contract-version@1',admittedAt}}});
      assert.deepEqual(proofAcceptanceOf(f.ledger.db,job,f.repoRoot),{jobId:job.job_id,integrity:true,qualified:true});
      assert.equal(f.coverage().mustOwed.length,1,'an old admission never turns unobserved proof into coverage');
      assert.throws(()=>proofAcceptanceOf(f.ledger.db,{job_id:'absent'},f.repoRoot),/no admitted contract/);
    });
  }
});


for(const [name,requiresProof] of [
  ['empty table',{}],['empty demand',{unit:{}}],['unknown kind',{invented:{required:true,command:'node --test tests/unit.spec.mjs'}}],
  ['string required',{unit:{required:'true',command:'node --test tests/unit.spec.mjs'}}],
  ['false required',{unit:{required:false,command:'node --test tests/unit.spec.mjs'}}],
  ['false optional',{unit:{optional:false,note:'optional proof'}}],
  ['incompatible flags',{unit:{required:true,optional:true,command:'node --test tests/unit.spec.mjs'}}],
  ['numeric command',{unit:{required:true,command:0}}],['empty command',{unit:{required:true,command:''}}],
  ['numeric forEach',{unit:{required:true,forEach:3}}],['unknown demand field',{unit:{required:true,unexpected:'test'}}],
])test(`qualified coverage refuses canonical malformed proof demand: ${name}`,t=>{
  const f=mustProofFixture(t);
  fs.writeFileSync(f.index,JSON.stringify({id:'fr.proof.required',requiresProof}));
  assert.throws(f.coverage,/malformed proof demands/);
});

test('a required semantic note without an executable command cannot borrow an unrelated green run',t=>{
  const f=mustProofFixture(t);f.observed('e2e');
  fs.writeFileSync(f.index,JSON.stringify({id:'fr.proof.required',requiresProof:{unit:{required:true,note:'independent semantic review'}}}));
  assert.deepEqual(f.coverage().items[0].obligations.map(row=>[row.kind,row.status]),[['unit','missing']]);
});
