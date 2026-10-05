import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {eventsHead} from '../../engine/db/ledger.mjs';
import {purgeWorkflow} from '../../scripts/work/purge-workflow.mjs';
import {zipVisit} from '../../scripts/api/fs/zip-visit.mjs';
import {withLedger,seedWorkflow} from '../helpers/ledger-fixture.mjs';
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


function interruptBeforeDelete(run) {
  const prepare=DatabaseSync.prototype.prepare;
  DatabaseSync.prototype.prepare=function(sql,...rest){
    const statement=prepare.call(this,sql,...rest);
    if(String(sql).startsWith('UPDATE workflow_purges SET state=')){
      const realRun=statement.run.bind(statement);
      statement.run=(...args)=>{if(args[0]==='deleting')throw Error('private interruption before delete');return realRun(...args);};
    }
    return statement;
  };
  try{assert.throws(run,/private interruption before delete/);}finally{DatabaseSync.prototype.prepare=prepare;}
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
