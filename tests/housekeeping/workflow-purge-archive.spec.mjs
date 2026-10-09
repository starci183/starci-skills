import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {eventsHead} from '../../engine/db/ledger.mjs';
import {purgeWorkflow} from '../../scripts/work/purge-workflow.mjs';
import {zipVisit} from '../../scripts/api/fs/zip-visit.mjs';
import {withLedger,seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {blobPath,getBlob} from '../../engine/db/blob.mjs';
import {parseRef,putContent} from '../../engine/db/ref-value.mjs';
test('the existing owner-approved workflow purge remains available with exact streamed archive proof',t=>withLedger(t,({root,repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:'wf-approved',state:{phase:'finished'}});ledger.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('repo_root',?)").run(repoRoot);
  const out=purgeWorkflow({repo:repoRoot,workflowId:'wf-approved',apply:true,approvedBy:'owner',approvalRef:'private fixture explicit purge approval',archiveRoot:path.join(root,'archive')});
  assert.equal(out.ok,true);assert.equal(out.purge.state,'purged');assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get('wf-approved').n,0);
  const checked=zipVisit(out.purge.archive_path,()=>{});assert.equal(checked.sha256,out.purge.archive_sha256);assert.equal(checked.entries.find(e=>e.name==='manifest.json').sha256,out.purge.manifest_sha256);assert.ok(checked.entries.every(e=>e.crcOk));
}));
test('unapproved purge keeps all workflow rows and publishes no archive',t=>withLedger(t,({root,repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:'wf-kept',state:{phase:'finished'}});ledger.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('repo_root',?)").run(repoRoot);const archiveRoot=path.join(root,'archive');
  assert.throws(()=>purgeWorkflow({repo:repoRoot,workflowId:'wf-kept',apply:true,archiveRoot}),e=>e.code==='purge-approval-missing');assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get('wf-kept').n,1);assert.equal(fs.existsSync(archiveRoot),false);
}));


function atPurgeState(run, hook) {
  const prepare=DatabaseSync.prototype.prepare;
  DatabaseSync.prototype.prepare=function(sql,...rest){
    const statement=prepare.call(this,sql,...rest);
    if(String(sql).startsWith('UPDATE workflow_purges SET state=')){
      const realRun=statement.run.bind(statement);
      statement.run=(...args)=>hook(args[0],()=>realRun(...args));
    }
    return statement;
  };
  try{return run();}finally{DatabaseSync.prototype.prepare=prepare;}
}

function interruptBeforeDelete(run) {
  assert.throws(()=>atPurgeState(run,(state,write)=>{
    if(state==='deleting')throw Error('private interruption before delete');
    return write();
  }),/private interruption before delete/);
}

for(const mutation of ['late-log','same-count-workflow-update'])test(`archive recovery refuses ${mutation} without losing unarchived rows`,t=>withLedger(t,({root,repoRoot,ledger})=>{
  const workflowId=`wf-${mutation}`;
  seedWorkflow(ledger,{id:workflowId,state:{phase:'finished'}});
  ledger.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('repo_root',?)").run(repoRoot);
  const options={repo:repoRoot,workflowId,apply:true,approvedBy:'owner',approvalRef:'private fixture explicit purge approval',archiveRoot:path.join(root,'archive')};
  interruptBeforeDelete(()=>purgeWorkflow(options));
  const before=ledger.db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get(workflowId);
  assert.equal(before.state,'archived');assert.ok(before.verified_at);
  const archive=fs.readFileSync(before.archive_path),head=eventsHead(ledger.db,workflowId);
  const workflow=ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
  if(mutation==='late-log')ledger.write.appendLog({workflowId,actor:'runtime',kind:'late-after-archive',msg:'not present in the verified archive'});
  else ledger.write.updateWorkflow({workflowId,title:'same count, different archived row',at:workflow.updated_at+1});
  assert.equal(eventsHead(ledger.db,workflowId),head,'events head alone cannot detect either mutation');
  const current=ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId);
  const logs=ledger.db.prepare('SELECT * FROM logs WHERE workflow_id=?').all(workflowId);
  assert.throws(()=>purgeWorkflow(options),error=>error.code==='archive-verify-failed'&&/changed after archive verification/.test(error.message));
  assert.deepEqual(ledger.db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(workflowId),current);
  assert.deepEqual(ledger.db.prepare('SELECT * FROM logs WHERE workflow_id=?').all(workflowId),logs);
  assert.deepEqual(ledger.db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get(workflowId),before);
  assert.deepEqual(fs.readFileSync(before.archive_path),archive);
  if(mutation==='late-log')assert.equal(logs.length,1);else assert.notEqual(current.title,workflow.title);
}));

test('unchanged verified archive recovery reuses its exact bytes and completes the purge',t=>withLedger(t,({root,repoRoot,ledger})=>{
  const workflowId='wf-resume-current';seedWorkflow(ledger,{id:workflowId,state:{phase:'finished'}});
  ledger.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('repo_root',?)").run(repoRoot);
  const options={repo:repoRoot,workflowId,apply:true,approvedBy:'owner',approvalRef:'private fixture explicit purge approval',archiveRoot:path.join(root,'archive')};
  interruptBeforeDelete(()=>purgeWorkflow(options));
  const before=ledger.db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get(workflowId),archive=fs.readFileSync(before.archive_path);
  const out=purgeWorkflow(options);assert.equal(out.ok,true);assert.equal(out.purge.state,'purged');
  assert.equal(out.purge.archive_sha256,before.archive_sha256);assert.deepEqual(fs.readFileSync(before.archive_path),archive);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get(workflowId).n,0);
  assert.equal(fs.readdirSync(path.dirname(before.archive_path)).length,1,'recovery publishes no second archive');
}));

function evidenceWorld(ledger, repoRoot) {
  seedWorkflow(ledger,{id:'wf-evidence',state:{phase:'running'},jobs:[{jobId:'op-evidence',opId:'review.verify',status:'failed',payload:{opId:'review.verify'}}]});
  ledger.db.prepare("INSERT OR REPLACE INTO meta(key,value) VALUES('repo_root',?)").run(repoRoot);
  const bytes=Buffer.from(`private fixture stream ${path.basename(path.dirname(repoRoot))}\n`);
  const blob=ledger.write.storeBlob({content:bytes,mediaType:'text/plain'});
  const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('op-evidence').attempt_id;
  ledger.write.recordCheckRun({attemptId,name:'fixture-stream',phase:'verify',runner:'op',status:'fail',exitCode:1,outputSha:blob.sha256});
  ledger.write.changeWorkflowPhase({workflowId:'wf-evidence',to:'finished',by:'spec',reason:'fixture completed'});
  return {sha:blob.sha256,bytes,attemptId};
}

const evidenceOptions=(root,repoRoot)=>({repo:repoRoot,workflowId:'wf-evidence',apply:true,approvedBy:'owner',approvalRef:'private fixture purge approval',archiveRoot:path.join(root,'archive')});

for(const damage of ['missing','corrupt','missing-metadata'])test(`native archive refuses ${damage} declared bytes before changing purge or workflow rows`,t=>withLedger(t,({root,repoRoot,ledger})=>{
  const {sha}=evidenceWorld(ledger,repoRoot),file=blobPath(sha),options=evidenceOptions(root,repoRoot);
  if(damage==='corrupt')fs.writeFileSync(file,Buffer.alloc(fs.statSync(file).size));
  else fs.rmSync(damage==='missing'?file:`${file}.json`);
  assert.throws(()=>purgeWorkflow(options),/blob|ENOENT/);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get('wf-evidence').n,1);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflow_purges').get().n,0);
  assert.equal(fs.existsSync(options.archiveRoot),false);
}));

test('writer-locked archive recovery compares check-only blob closure and refuses a lost original despite the verified ZIP',t=>withLedger(t,({root,repoRoot,ledger})=>{
  const {sha}=evidenceWorld(ledger,repoRoot),options=evidenceOptions(root,repoRoot);
  interruptBeforeDelete(()=>purgeWorkflow(options));
  const before=ledger.db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get('wf-evidence');
  const archive=fs.readFileSync(before.archive_path);
  fs.rmSync(blobPath(sha));
  assert.throws(()=>purgeWorkflow(options),/blob not found/);
  assert.deepEqual(ledger.db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get('wf-evidence'),before);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get('wf-evidence').n,1);
  assert.deepEqual(fs.readFileSync(before.archive_path),archive);
}));

test('the schema catalog and foreign-key custody include a new reference owner without workflow_id; unknown ownership refuses',t=>withLedger(t,({root,repoRoot,ledger})=>{
  const {sha,bytes,attemptId}=evidenceWorld(ledger,repoRoot),options=evidenceOptions(root,repoRoot);
  ledger.db.exec('CREATE TABLE fixture_refs(ref_id INTEGER PRIMARY KEY, attempt_id INTEGER REFERENCES op_attempts(attempt_id) ON DELETE CASCADE, evidence_sha TEXT REFERENCES blobs(sha256));');
  ledger.db.prepare("INSERT INTO blob_ref_columns VALUES('fixture_refs','evidence_sha')").run();
  ledger.db.prepare('INSERT INTO fixture_refs(attempt_id,evidence_sha) VALUES(?,?)').run(attemptId,sha);
  const out=purgeWorkflow(options),entries=new Map();
  zipVisit(out.purge.archive_path,entry=>{entries.set(entry.name,entry.data);});
  assert.deepEqual(entries.get(`files/blobs/${sha}`),bytes);
  const refs=entries.get('ledger/fixture_refs.ndjson').toString('utf8').trim().split('\n').map(line=>JSON.parse(line));
  assert.deepEqual(refs.map(row=>row.evidence_sha),[sha]);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM fixture_refs').get().n,0);
  assert.deepEqual(getBlob(sha),bytes,'purge retains original blob bytes');
  seedWorkflow(ledger,{id:'wf-unowned',state:{phase:'finished'}});
  ledger.db.exec('CREATE TABLE fixture_unowned(ref_id INTEGER PRIMARY KEY,evidence_sha TEXT);');
  ledger.db.prepare("INSERT INTO blob_ref_columns VALUES('fixture_unowned','evidence_sha')").run();
  assert.throws(()=>purgeWorkflow({...options,workflowId:'wf-unowned'}),/incomplete workflow blob reference scope/);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get('wf-unowned').n,1);
}));

test('artifact-linked citations and proofs are archived through schema custody; a citation prevents destructive cascade',t=>withLedger(t,({root,repoRoot,ledger})=>{
  const {sha}=evidenceWorld(ledger,repoRoot),options=evidenceOptions(root,repoRoot);
  const artifact=ledger.write.recordArtifact({workflowId:'wf-evidence',name:'fixture-evidence',sha256:sha,role:'other',kind:'file',origin:'kernel'});
  ledger.write.recordArtifactProof({artifactId:artifact.artifact_id,claims:{},deps:[]});
  const citation=ledger.write.storeBlob({content:Buffer.from('private citation-only bytes'),mediaType:'text/plain'});
  ledger.write.citeBlob({recordId:'owned.record',recordPath:'owned/index.yaml',field:'asset',artifactId:artifact.artifact_id,sha256:citation.sha256});
  assert.throws(()=>purgeWorkflow(options),/FOREIGN KEY constraint failed/);
  const row=ledger.db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get('wf-evidence'),entries=new Map();
  assert.equal(row.state,'archived');
  zipVisit(row.archive_path,entry=>{entries.set(entry.name,entry.data);});
  assert.equal(JSON.parse(entries.get('ledger/work_citations.ndjson').toString('utf8').trim()).sha256,citation.sha256);
  assert.deepEqual(entries.get(`files/blobs/${citation.sha256}`),getBlob(citation.sha256),'citation-only bytes are retained, even when the artifact names a different blob');
  assert.equal(JSON.parse(entries.get('ledger/artifact_proofs.ndjson').toString('utf8').trim()).artifact_id,artifact.artifact_id);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get('wf-evidence').n,1);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM work_citations').get().n,1);
}));

test('native archive keeps exact stored content references and the original bytes behind them',t=>withLedger(t,({root,repoRoot,ledger})=>{
  evidenceWorld(ledger,repoRoot);
  const text=JSON.stringify({privateFixture:'multi-byte 漢字\n'.repeat(2000)}),ref=putContent(text,{bound:1024});
  ledger.write.appendLog({workflowId:'wf-evidence',actor:'runtime',kind:'fixture-reference',msg:'stored reference fixture',data:JSON.parse(ref)});
  assert.equal(ledger.db.prepare("SELECT data_json FROM logs WHERE kind='fixture-reference'").get().data_json,text,'the normal reader hydrates stored references');
  const out=purgeWorkflow(evidenceOptions(root,repoRoot)),entries=new Map();
  zipVisit(out.purge.archive_path,entry=>{entries.set(entry.name,entry.data);});
  const log=JSON.parse(entries.get('ledger/logs.ndjson').toString('utf8').trim());
  assert.equal(log.data_json,ref,'archive projection preserves the actual stored cell');
  assert.deepEqual(entries.get(`files/blobs/${parseRef(ref).sha}`),Buffer.from(text));
}));

test('a check-only blob disappearing after ZIP verification is caught by the final writer-locked closure comparison',t=>withLedger(t,({root,repoRoot,ledger})=>{
  const {sha}=evidenceWorld(ledger,repoRoot),file=blobPath(sha),options=evidenceOptions(root,repoRoot);
  let removed=false;
  assert.throws(()=>atPurgeState(()=>purgeWorkflow(options),(state,write)=>{
    const result=write();
    if(state==='archived'){fs.rmSync(file);removed=true;}
    return result;
  }),/blob not found/);
  assert.equal(removed,true,'the original disappears only after the archive was read back and verified');
  const row=ledger.db.prepare('SELECT * FROM workflow_purges WHERE workflow_id=?').get('wf-evidence');
  assert.equal(row.state,'archived');
  assert.ok(row.verified_at);
  assert.equal(ledger.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get('wf-evidence').n,1);
  const entries=new Map();
  zipVisit(row.archive_path,entry=>{entries.set(entry.name,entry.data);});
  assert.ok(entries.has(`files/blobs/${sha}`),'verified recovery evidence is retained with the current ledger');
}));
