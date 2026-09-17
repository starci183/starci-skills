import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {RETENTION,SETTLED_JOB_STATUSES,compactSnapshots,inspectJournal,journalWorkflows,liveRows,openJournal,pruneRetiredGenerations,retireWorkflow} from '../kernel/journal.mjs';
import {createAdmission} from '../kernel/admission.mjs';
import {pruneJournal,retireJournal,statesUnderRoots} from '../kernel/journal-maintenance.mjs';
import {WORKFLOW_STATE,createStore} from '../kernel/store.mjs';

/**
 * The retention policy of the admission journal, exercised through the journal's own API: what a workflow
 * needs to continue stays, what it has settled goes, and nothing live is ever touched.
 */
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-journal-retention-'));
const snapshot=(journal,{workflowId='wf',generation,checkpoint,body='{"x":1}'})=>journal.db.prepare('INSERT INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,created_at) VALUES(?,?,?,?,?,?)').run(checkpoint,workflowId,generation,'goal',body,1);
const job=(journal,{jobId,workflowId='wf',generation,status='succeeded',kind='model'})=>{journal.enqueueJob({jobId,workflowId,opId:'op',attempt:1,generation,kind,payload:{}});journal.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(status,jobId);journal.appendEvent({eventId:`${jobId}:event`,workflowId,entityType:'job',entityId:jobId,generation,kind:'job-succeeded'});};

test('the policy is one record: one body for the bound generation, no rows for a retired one',()=>{
  assert.deepEqual(RETENTION,{snapshotBodiesKept:1,retiredGenerationRows:0});
  assert.deepEqual(SETTLED_JOB_STATUSES,['succeeded','failed','cancelled']);
});

test('bound compaction keeps the transition checkpoints and the latest save of the bound generation, and drops the generations before it',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const journal=openJournal({file:path.join(dir,'journal.sqlite')});
  for(let n=1;n<=3;n+=1)snapshot(journal,{generation:1,checkpoint:`save:wf:1:${n}`});
  snapshot(journal,{generation:2,checkpoint:'bind:wf:2:seed'});
  snapshot(journal,{generation:2,checkpoint:'transition:wf:2:t-1'});
  for(let n=1;n<=3;n+=1)snapshot(journal,{generation:2,checkpoint:`save:wf:2:${n}`});
  snapshot(journal,{generation:2,checkpoint:'transition:wf:2:t-2'});
  snapshot(journal,{generation:2,checkpoint:'save:wf:2:latest'});
  const changed=compactSnapshots(journal.db,{workflowId:'wf',generation:2,goalIdentity:'goal'});
  const rows=journal.db.prepare('SELECT checkpoint_id,generation,length(state_json) body FROM state_snapshots ORDER BY snapshot_id').all();
  assert.deepEqual(rows.map(row=>[row.checkpoint_id,row.body>0]),[['bind:wf:2:seed',false],['transition:wf:2:t-1',false],['transition:wf:2:t-2',false],['save:wf:2:latest',true]]);
  assert.equal(journal.db.prepare('SELECT count(*) n FROM state_snapshots WHERE generation=1').get().n,0,'a retired generation keeps nothing');
  assert.ok(changed>0);assert.equal(compactSnapshots(journal.db,{workflowId:'wf',generation:2,goalIdentity:'goal'}),0,'idempotent');
  journal.close();
});

test('unbound compaction takes each workflow\'s newest generation as bound and leaves other workflows\' live shape intact',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const journal=openJournal({file:path.join(dir,'journal.sqlite')});
  snapshot(journal,{workflowId:'a',generation:1,checkpoint:'save:a:1:1'});snapshot(journal,{workflowId:'a',generation:2,checkpoint:'save:a:2:1'});snapshot(journal,{workflowId:'a',generation:2,checkpoint:'save:a:2:2'});
  snapshot(journal,{workflowId:'b',generation:5,checkpoint:'transition:b:5:x'});snapshot(journal,{workflowId:'b',generation:5,checkpoint:'save:b:5:1'});
  compactSnapshots(journal.db);
  const rows=journal.db.prepare('SELECT workflow_id,checkpoint_id,length(state_json) body FROM state_snapshots ORDER BY snapshot_id').all();
  assert.deepEqual(rows.map(row=>[row.workflow_id,row.checkpoint_id,row.body>0]),[['a','save:a:2:2',true],['b','transition:b:5:x',false],['b','save:b:5:1',true]]);
  journal.close();
});

test('retired generations lose their settled jobs and events; a leased or unsettled job keeps its rows whatever its generation',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const journal=openJournal({file:path.join(dir,'journal.sqlite')}),admission=createAdmission({journal});
  job(journal,{jobId:'old-done',generation:1});job(journal,{jobId:'old-failed',generation:1,status:'failed'});job(journal,{jobId:'old-running',generation:1,status:'running'});
  job(journal,{jobId:'old-leased',generation:1,status:'queued'});admission.setCapacity('ai/global',10);
  const reserved=admission.reserve({jobId:'old-leased',workflowId:'wf',opId:'op',attempt:1,generation:1,resources:[{key:'ai/global',units:1}],ttlMs:60000});assert.equal(reserved.ok,true);
  journal.db.prepare("UPDATE jobs SET status='succeeded' WHERE job_id='old-leased'").run();
  job(journal,{jobId:'current-done',generation:2});job(journal,{jobId:'other-old',workflowId:'other',generation:1});
  journal.appendEvent({eventId:'wf:workflow:1',workflowId:'wf',entityType:'workflow',entityId:'wf',generation:1,kind:'state-transition'});
  const pruned=journal.retireGenerations({workflowId:'wf',generation:2});
  assert.deepEqual(pruned,{jobs:2,events:3},'two settled jobs of generation 1 and their events, plus the workflow event of generation 1');
  assert.deepEqual(journal.listJobs().map(item=>item.job_id).sort(),['current-done','old-leased','old-running','other-old']);
  assert.deepEqual(journal.events({workflowId:'wf'}).map(event=>event.entity_id).sort(),['current-done','old-leased','old-running']);
  assert.deepEqual(liveRows(journal.db,'wf'),{leases:[{jobId:'old-leased',resource:'ai/global'}],jobs:[{jobId:'old-running',status:'running',generation:1}]});
  assert.equal(pruneRetiredGenerations(journal.db,{workflowId:'wf',generation:2}).jobs,0,'idempotent');
  journal.close();
});

test('a workflow is retired whole only when nothing of it is live; a finished workflow with a live lease is refused on the record',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const journal=openJournal({file:path.join(dir,'journal.sqlite')}),admission=createAdmission({journal});
  snapshot(journal,{generation:1,checkpoint:'save:wf:1:1'});job(journal,{jobId:'j1',generation:1});job(journal,{jobId:'j2',generation:1,status:'queued'});
  admission.setCapacity('ai/global',10);assert.equal(admission.reserve({jobId:'j2',workflowId:'wf',opId:'op',attempt:1,generation:1,resources:[{key:'ai/global',units:1}],ttlMs:60000}).ok,true);
  const refused=journal.retireWorkflow('wf');
  assert.equal(refused.ok,false);assert.equal(refused.live.leases.length,1);assert.equal(journal.db.prepare('SELECT count(*) n FROM jobs').get().n,2,'nothing removed');
  assert.equal(admission.release({jobId:'j2',generation:1,leaseToken:journal.getJob('j2').lease_token}).ok,true);journal.db.prepare("UPDATE jobs SET status='cancelled' WHERE job_id='j2'").run();
  const retired=journal.retireWorkflow('wf');
  assert.deepEqual(retired,{ok:true,workflowId:'wf',removed:{snapshots:1,jobs:2,events:2,incidents:0}});
  assert.deepEqual(journalWorkflows(journal.db),[]);
  assert.equal(retireWorkflow(journal.db,'wf').ok,true,'retiring an absent workflow removes nothing and is not an error');
  journal.close();
});

test('finished shared-store custody keeps one final state and only the latest exact receipt per runtime file',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const journal=openJournal({file:path.join(dir,'journal.sqlite')});
  snapshot(journal,{generation:2,checkpoint:'save:wf:2:old',body:'{"phase":"run"}'});snapshot(journal,{generation:2,checkpoint:'save:wf:2:final',body:'{"phase":"done"}'});
  job(journal,{jobId:'settled',generation:2});journal.appendEvent({eventId:'workflow-history',workflowId:'wf',entityType:'workflow',entityId:'wf',generation:2,kind:'finished'});
  for(const [eventId,entityId,sha256] of [['state-old','state.json','old'],['state-final','state.json','final'],['events-final','events.jsonl','events']])journal.appendEvent({eventId,workflowId:'wf',entityType:'runtime-file',entityId,generation:2,kind:'runtime-file-written',payload:{relative:entityId,sha256}});
  const retired=journal.retireWorkflow('wf',{preserveRuntimeCustody:true});
  assert.equal(retired.ok,true);assert.deepEqual(retired.retained,{snapshots:1,runtimeFileReceipts:2,generation:2});
  assert.equal(journal.listJobs().length,0);assert.deepEqual(journal.events({workflowId:'wf'}).map(event=>event.event_id).sort(),['events-final','state-final']);
  assert.deepEqual(journal.db.prepare('SELECT state_json FROM state_snapshots WHERE workflow_id=?').all('wf').map(row=>row.state_json),['{"phase":"done"}']);
  journal.close();
});

test('a journal created by this build gives freed pages back on its own',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'journal.sqlite'),journal=openJournal({file});
  assert.equal(journal.autoVacuum,2,'incremental auto-vacuum is set before the first table');
  for(let n=0;n<40;n+=1)snapshot(journal,{generation:1,checkpoint:`save:wf:1:${n}`,body:'x'.repeat(64*1024)});
  const grown=fs.statSync(file).size;
  journal.retireWorkflow('wf');
  assert.ok(fs.statSync(file).size<grown/2,`the file shrank from ${grown} to ${fs.statSync(file).size}`);
  journal.close();
});

// `createStore` holds its ledger handle open (§8: a store is a session, closed by its caller); every call here
// is fire-and-forget, so it closes immediately - an open WAL handle on `repo/.starciwork/runtime.sqlite`
// otherwise survives the test and blocks the temp directory's own removal on Windows (EPERM, not ENOENT).
const stateAt=(repoRoot,id,extra)=>{const store=createStore({repoRoot,id});store.saveState({schema:WORKFLOW_STATE,id,ops:[],...extra});store.close();};

test('journal-prune retires what the store roots prove settled, keeps the unfinished and the live, and reports the unknown',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'journal.sqlite'),repo=path.join(dir,'repo');fs.mkdirSync(repo,{recursive:true});
  const journal=openJournal({file});
  for(const id of ['finished','moved','unfinished','unknown','named','live'])job(journal,{jobId:`${id}-job`,workflowId:id,generation:1});
  const admission=createAdmission({journal});admission.setCapacity('ai/global',10);journal.db.prepare("UPDATE jobs SET status='queued' WHERE job_id='live-job'").run();
  assert.equal(admission.reserve({jobId:'live-job',workflowId:'live',opId:'op',attempt:1,generation:1,resources:[{key:'ai/global',units:1}],ttlMs:60000}).ok,true);
  journal.close();
  stateAt(repo,'finished',{finished:{outcome:'done'},engine:{journalFile:file}});
  stateAt(repo,'moved',{engine:{journalFile:path.join(dir,'elsewhere.sqlite')}});
  stateAt(repo,'unfinished',{approved:true,engine:{journalFile:file}});
  stateAt(repo,'live',{approved:true,engine:{journalFile:file}});
  const dry=pruneJournal({journalFile:file,storeRoots:[repo],retire:['named'],dryRun:true});
  assert.deepEqual(Object.fromEntries(dry.decisions.map(item=>[item.workflowId,item.decision])),{finished:'retire',moved:'retire',unfinished:'kept',unknown:'unknown',named:'retire',live:'kept'});
  const untouched=inspectJournal({file});assert.equal(untouched.workflows().length,6,'a dry run removes nothing');assert.throws(()=>untouched.db.exec('DELETE FROM jobs'),/readonly|attempt to write/i,'inspection cannot write');untouched.close();
  const pruned=pruneJournal({journalFile:file,storeRoots:[repo],retire:['named'],vacuum:true});
  assert.deepEqual(pruned.decisions.filter(item=>item.removed).map(item=>item.workflowId).sort(),['finished','moved','named']);
  const left=openJournal({file});assert.deepEqual(left.workflows().map(item=>item.workflowId).sort(),['live','unfinished','unknown']);left.close();
  assert.equal(statesUnderRoots([repo],file).get('finished').references,true);
});

test('journal-retire deletes a journal only when no state names it and nothing wrote to it recently, and only when asked to',t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const file=path.join(dir,'journal.sqlite'),repo=path.join(dir,'repo');fs.mkdirSync(repo,{recursive:true});
  const journal=openJournal({file});job(journal,{jobId:'j',workflowId:'wf',generation:1});journal.close();
  stateAt(repo,'wf',{approved:true,engine:{journalFile:file}});
  const bound=retireJournal({journalFile:file,storeRoots:[repo],remove:true,now:()=>Date.now()+3600000});
  assert.equal(bound.ok,false);assert.equal(bound.referencing.length,1);assert.equal(fs.existsSync(file),true,'a bound journal is never deleted');
  stateAt(repo,'wf',{approved:true,engine:{journalFile:path.join(dir,'new.sqlite')}});
  const recent=retireJournal({journalFile:file,storeRoots:[repo],remove:true});
  assert.equal(recent.ok,false);assert.match(recent.reason,/quiet window/);assert.equal(fs.existsSync(file),true,'a journal written a moment ago may still be held');
  const report=retireJournal({journalFile:file,storeRoots:[repo],now:()=>Date.now()+3600000});
  assert.equal(report.ok,true);assert.deepEqual(report.deleted,[]);assert.match(report.next,/--delete true/);assert.equal(fs.existsSync(file),true);
  assert.deepEqual(report.orphanedLiveRows,[],'a settled row is not orphaned');
  const deleted=retireJournal({journalFile:file,storeRoots:[repo],remove:true,now:()=>Date.now()+3600000});
  assert.equal(deleted.ok,true);assert.deepEqual(deleted.deleted,[file]);assert.equal(fs.existsSync(file),false);
  assert.throws(()=>retireJournal({journalFile:file,storeRoots:[],remove:true}),/existing --journal-file/);
});
