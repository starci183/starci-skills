import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {migrateLedger} from '../scripts/ledger/ledger-migrate.mjs';
import {verifyChain,inspectLedger} from '../kernel/ledger-db.mjs';
import {openJournal} from '../kernel/journal.mjs';
import {WORKFLOW_STATE,workflowsRoot} from '../kernel/store.mjs';

const require=createRequire(import.meta.url);
const temporary=()=>fs.mkdtempSync(path.join(os.tmpdir(),'starci-ledger-migrate-'));

const ID='20260912-104251-demo';
/** A realistic `_local/workflows/<id>` per the brief: goal files, state, one retired segment + live log, and one of each sibling artifact. */
function makeWorkflow(repo,id=ID,{generation=2,journalFile=null}={}){
  const dir=path.join(workflowsRoot(repo),id);
  for(const sub of ['reports','contracts','checks','inbox'])fs.mkdirSync(path.join(dir,sub),{recursive:true});
  fs.writeFileSync(path.join(dir,'goal.md'),'# Ship the board\n\nBuild the weekly league board.\n');
  fs.writeFileSync(path.join(dir,'goal.json'),JSON.stringify({schema:'starci/goal-record@1',id,rev:1,job:{title:'Ship the board'},inputs:{},ledgerMode:'work'})+'\n');
  const engine={schema:'starci/engine@1',version:1,generation,journalFile,enrolledAt:1};
  fs.writeFileSync(path.join(dir,'state.json'),JSON.stringify({schema:WORKFLOW_STATE,id,phase:'run',createdAt:1000,ledgerMode:'work',goalDigest:'goal-identity-1',worktree:repo,job:{title:'Ship the board'},inputs:{},engine})+'\n');
  fs.writeFileSync(path.join(dir,'events.g1.jsonl'),[1,2].map(seq=>JSON.stringify({at:1000+seq,seq,event:'op-created',op:'op-1'})).join('\n')+'\n');
  fs.writeFileSync(path.join(dir,'events.jsonl'),[3,4,5].map(seq=>JSON.stringify({at:1000+seq,seq,event:seq===5?'op-report':'op-dispatch',op:'op-1'})).join('\n')+'\n');
  fs.writeFileSync(path.join(dir,'reports','d-1.json'),JSON.stringify({schema:'starci/op-report@1',dispatch:'d-1',task:'op-1',outcome:'done',from:'term-1',reportedAt:2000,summary:'done it'}));
  fs.writeFileSync(path.join(dir,'reports','d-2.json'),JSON.stringify({schema:'starci/op-report@1',dispatch:'d-2',task:'op-1',outcome:'failed',from:'term-1',reportedAt:3000,summary:'nope'}));
  fs.writeFileSync(path.join(dir,'contracts','op-1.md'),'## op-1\n\nDo the thing.\n');
  fs.writeFileSync(path.join(dir,'checks','op-1.json'),JSON.stringify({op:'op-1',attempt:1,checks:[{name:'t',command:'npm test',exitCode:0}]}));
  fs.writeFileSync(path.join(dir,'inbox','1700000000000-a1b2.json'),JSON.stringify({kind:'answer',op:'op-1',choice:'yes',at:'2026-09-12T10:43:00.000Z'}));
  return dir;
}

/** Old-schema journal rows for the workflow: a settled job, a repo-fenced leased job, one ai/* lease, snapshots. */
function makeJournal(file,id=ID,{generation=2}={}){
  const journal=openJournal({file});
  journal.enqueueJob({jobId:`${id}:op-1:1`,workflowId:id,opId:'op-1',attempt:1,generation:1,kind:'operation',payload:{op:'op-1'},createdAt:1100});
  journal.db.prepare("UPDATE jobs SET status='succeeded',result_json=? WHERE job_id=?").run(JSON.stringify({ok:true}),`${id}:op-1:1`);
  journal.enqueueJob({jobId:`${id}:op-2:1`,workflowId:id,opId:'op-2',attempt:1,generation,kind:'operation',payload:{op:'op-2'},createdAt:1200});
  journal.db.prepare("UPDATE jobs SET status='leased',lease_token=? WHERE job_id=?").run('token-op2',`${id}:op-2:1`);
  const lease=(jobId,resource,token,gen)=>journal.db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(resource,jobId,id,'op-2',1,gen,token,1,1200,999999);
  lease(`${id}:op-2:1`,'canonical-writer:src','token-op2',generation);
  lease(`${id}:op-2:1`,'ai/openai','token-op2',generation);
  journal.db.prepare('INSERT INTO state_snapshots(checkpoint_id,workflow_id,generation,goal_identity,state_json,created_at) VALUES(?,?,?,?,?,?)').run(`save:${id}:1:old`,id,1,'goal-identity-1','{"phase":"run","old":true}',1150);
  journal.appendEvent({eventId:`${id}:op-1:1:done`,workflowId:id,entityType:'job',entityId:`${id}:op-1:1`,generation:1,kind:'job-succeeded',createdAt:1300});
  journal.close();
  return file;
}

const ledgerDb=repo=>{const {DatabaseSync}=require('node:sqlite');return new DatabaseSync(path.join(repo,'.starciwork','runtime.sqlite'),{readOnly:true});};

test('a `_local` workflow plus its journal rows import whole into the ledger, atomically per workflow',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(summary.ok,true);
  assert.deepEqual(summary.refused,[]);assert.deepEqual(summary.skipped,[]);
  assert.deepEqual(summary.workflows,[{id:ID,imported:{events:6,snapshots:2,jobs:2,leases:2,reports:2,contracts:1,checks:1,inbox:1,goals:1,inputs:0}}]);
  const db=ledgerDb(repo);
  try{
    const workflow=db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(ID);
    assert.equal(workflow.generation,2);assert.equal(workflow.ledger_mode,'work');assert.equal(workflow.phase,'run');assert.equal(workflow.title,'Ship the board');
    assert.equal(db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=? AND revision=1').get(ID).n,1);
    const snapshots=db.prepare('SELECT * FROM state_snapshots WHERE workflow_id=? ORDER BY snapshot_id').all(ID);
    assert.equal(snapshots.at(-1).checkpoint_id,`import:${ID}:2`,'the file state lands as the newest checkpoint');
    const imported=JSON.parse(snapshots.at(-1).state_json);
    assert.equal(imported.engine.ledgerFile,path.join(repo,'.starciwork','runtime.sqlite'),'journalFile is rewritten to the ledger file');
    assert.equal(imported.engine.machineFile,machineFile);assert.equal(imported.engine.journalFile,undefined);
    assert.ok(snapshots.at(-1).events_head,'the import checkpoint seals the event head');
    const events=db.prepare('SELECT * FROM events WHERE workflow_id=? ORDER BY seq').all(ID);
    assert.deepEqual(events.slice(0,5).map(row=>row.kind),['op-created','op-created','op-dispatch','op-dispatch','op-report']);
    assert.equal(events.at(-1).kind,'job-succeeded','journal custody events follow the file audit');
    assert.equal(JSON.parse(events[0].payload_json)._seq,1,'the original jsonl seq is kept');
    assert.equal(events[0].generation,1);assert.equal(events[4].generation,2,'generations stay on the column, not the filename');
    assert.equal(verifyChain(db,{workflowId:ID}).ok,true,'the hash chain verifies after import');
    const lease=db.prepare("SELECT * FROM leases WHERE resource_key='ai/openai'").get();
    assert.equal(lease.machine_ref,'token-op2','the ai/* lease is mirrored ledger-side with its machine token');
    const machine=new (require('node:sqlite').DatabaseSync)(machineFile,{readOnly:true});
    try{assert.equal(machine.prepare("SELECT count(*) n FROM leases WHERE resource_key='ai/openai' AND job_id=?").get(`${ID}:op-2:1`).n,1,'the machine DB owns the ai/* lease');}finally{machine.close();}
    const report=db.prepare('SELECT * FROM reports WHERE workflow_id=? AND dispatch_id=?').get(ID,'d-1');
    assert.equal(report.outcome,'done');assert.equal(report.op_id,'op-1');
    assert.equal(db.prepare('SELECT count(*) n FROM contracts WHERE workflow_id=?').get(ID).n,1);
    assert.equal(db.prepare('SELECT count(*) n FROM checks WHERE workflow_id=?').get(ID).n,1);
    assert.equal(db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status='pending'").get(ID).n,1);
    assert.ok(fs.existsSync(path.join(workflowsRoot(repo),ID)),'nothing is deleted without --archive');
  }finally{db.close();}
});

test('a second run is a no-op: recorded sources are skipped and nothing double-imports',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  await migrateLedger({repoRoot:repo,journalFile,machineFile});
  const again=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(again.ok,true);
  assert.deepEqual(again.workflows,[]);
  assert.deepEqual(again.skipped,[{id:ID,reason:'already-migrated'}]);
  const inspection=inspectLedger({file:path.join(repo,'.starciwork','runtime.sqlite')});
  try{
    assert.equal(inspection.db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(ID).n,6,'no duplicated events');
    assert.equal(inspection.db.prepare('SELECT count(*) n FROM jobs WHERE workflow_id=?').get(ID).n,2);
    assert.equal(inspection.verifyChain({workflowId:ID}).ok,true);
  }finally{inspection.close();}
});

test('a live kernel lock refuses the workflow and writes nothing',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  const wdir=makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  fs.writeFileSync(path.join(wdir,'kernel.lock'),JSON.stringify({pid:process.pid,at:Date.now()}));
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(summary.ok,false);
  assert.deepEqual(summary.workflows,[]);
  assert.deepEqual(summary.refused,[{id:ID,reason:'kernel-lock-held'}]);
  const inspection=inspectLedger({file:path.join(repo,'.starciwork','runtime.sqlite')});
  try{assert.equal(inspection.db.prepare('SELECT count(*) n FROM workflows').get().n,0,'a refused workflow writes nothing');}finally{inspection.close();}
});

test('an unsettled journal job behind the file state generation refuses as kernel work, not migrator work',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{generation:3,journalFile});
  const journal=openJournal({file:journalFile});
  journal.enqueueJob({jobId:`${ID}:stale:1`,workflowId:ID,opId:'op-1',attempt:1,generation:2,kind:'operation',createdAt:1100});
  journal.close();
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(summary.ok,false);
  assert.deepEqual(summary.refused,[{id:ID,reason:'kernel-reconcile-required'}]);
  const inspection=inspectLedger({file:path.join(repo,'.starciwork','runtime.sqlite')});
  try{assert.equal(inspection.db.prepare('SELECT count(*) n FROM workflows').get().n,0);}finally{inspection.close();}
});

test('a dead kernel lock does not refuse; --dry-run writes nothing at all',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  const wdir=makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  fs.writeFileSync(path.join(wdir,'kernel.lock'),JSON.stringify({pid:999999,at:Date.now()-86400000}));
  const dry=await migrateLedger({repoRoot:repo,journalFile,machineFile,dryRun:true,pidAliveFn:()=>false});
  assert.equal(dry.ok,true);
  assert.equal(dry.workflows[0].id,ID);
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','runtime.sqlite')),false,'dry-run never creates the ledger');
  assert.equal(fs.existsSync(machineFile),false,'dry-run never creates the machine DB');
  assert.ok(fs.existsSync(path.join(wdir,'state.json')),'dry-run never moves sources');
});

test('--archive archives the imported directory and then sets the whole `_local` aside as `_local.migrated` (§13)',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile,archive:true});
  assert.equal(summary.ok,true);
  const moved=path.join(repo,'.starciwork','_local.migrated');
  assert.equal(summary.archivedLocalRoot,moved);
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','_local')),false,'a root that migrated whole keeps no `_local`');
  assert.equal(fs.existsSync(path.join(moved,'workflows',ID)),false,'§10 archived the imported directory before the root moved');
  assert.ok(fs.existsSync(path.join(moved,'workflows-archive',`${ID}.migrated`,'state.json')));
  assert.ok(fs.existsSync(path.join(repo,'.starciwork','runtime.sqlite')),'the ledger is outside `_local` and does not move with it');
});

test('a root that refused a workflow keeps `_local` where it is, even with --archive',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  const wdir=makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  fs.writeFileSync(path.join(wdir,'kernel.lock'),JSON.stringify({pid:process.pid,at:Date.now()}));
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile,archive:true});
  assert.equal(summary.ok,false);
  assert.equal(summary.archivedLocalRoot,undefined);
  assert.ok(fs.existsSync(path.join(repo,'.starciwork','_local')),'`_local` is set aside only once the whole root reports ok');
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','_local.migrated')),false);
});

/** goal.mjs's `stageExternalInputs` copies an owner file here; declare it on both `state.json` and `goal.json`. */
function declareInputs(wdir,id,entries){
  const inputsDir=path.join(path.dirname(path.dirname(wdir)),'inputs',id);
  fs.mkdirSync(inputsDir,{recursive:true});
  const declared=entries.map((entry,index)=>{
    const key=`${index+1}-${entry.name}`;
    if(entry.bytes!==undefined)fs.writeFileSync(path.join(inputsDir,key),entry.bytes);
    return {kind:'file',ref:`.starciwork/_local/inputs/${id}/${key}`,sourceRef:entry.sourceRef,sha256:entry.bytes?crypto.createHash('sha256').update(entry.bytes).digest('hex'):undefined};
  });
  for(const file of ['state.json','goal.json']){
    const parsed=JSON.parse(fs.readFileSync(path.join(wdir,file),'utf8'));
    parsed.inputs=declared;
    fs.writeFileSync(path.join(wdir,file),JSON.stringify(parsed));
  }
  return inputsDir;
}

test('owner-named inputs staged under `_local/inputs/<id>` import into the `inputs` table; a declared file that is gone is reported lost, not refused',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  const wdir=makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  const bytes=Buffer.from('the SRS, verbatim.\n');
  declareInputs(wdir,ID,[{name:'srs.md',bytes,sourceRef:'/owner/srs.md'},{name:'gone.md',sourceRef:'/owner/gone.md'}]);
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(summary.ok,true);
  assert.equal(summary.workflows[0].imported.inputs,1,'the missing file does not count as imported');
  assert.deepEqual(summary.workflows[0].inputsLost,[{key:'2-gone.md',reason:'input-file-missing'}]);
  const db=ledgerDb(repo);
  try{
    assert.equal(db.prepare('SELECT count(*) n FROM inputs WHERE workflow_id=?').get(ID).n,1,'declared twice (state.json + goal.json) imports once, the lost one writes nothing');
    const row=db.prepare('SELECT * FROM inputs WHERE workflow_id=? AND key=?').get(ID,'1-srs.md');
    assert.equal(row.sha256,crypto.createHash('sha256').update(bytes).digest('hex'));
    assert.equal(row.size,bytes.length);assert.equal(row.origin,'/owner/srs.md','the owner original path is kept for provenance');
    assert.equal(row.goal_revision,1);
    assert.equal(Buffer.from(row.bytes).toString(),bytes.toString());
    const workflow=db.prepare('SELECT updated_at FROM workflows WHERE workflow_id=?').get(ID);
    assert.equal(workflow.updated_at,1300,'importing inputs does not clobber the updated_at the events computed');
  }finally{db.close();}
});

test('a second run of an inputs import is a no-op',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  const wdir=makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  declareInputs(wdir,ID,[{name:'srs.md',bytes:Buffer.from('v1'),sourceRef:'/owner/srs.md'}]);
  await migrateLedger({repoRoot:repo,journalFile,machineFile});
  const again=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.deepEqual(again.skipped,[{id:ID,reason:'already-migrated'}]);
  const db=ledgerDb(repo);
  try{assert.equal(db.prepare('SELECT count(*) n FROM inputs WHERE workflow_id=?').get(ID).n,1);}finally{db.close();}
});

test('the migrator reads the `meta` that `openLedger` seeds and writes the initial `ledger-anchor.json` for every workflow it imports',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(summary.ok,true);
  const db=ledgerDb(repo);
  let ledgerId;
  try{
    const rows=Object.fromEntries(db.prepare('SELECT key,value FROM meta').all().map(row=>[row.key,row.value]));
    ledgerId=rows.ledger_id;
    assert.match(ledgerId,/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,'ledger_id is a randomUUID');
    assert.equal(rows.schema,'starci/ledger-db@1');
    assert.equal(rows.journal_mode,'wal','§3 defaults to WAL; the migrator does not seed meta itself so this is openLedger`s own value');
    assert.ok(Number.isFinite(Number(rows.created_at)));
    assert.equal(db.prepare("SELECT count(*) n FROM migrations WHERE source=?").get(path.join(workflowsRoot(repo),ID)+'#anchor').n,1);
  }finally{db.close();}
  const anchorPath=path.join(repo,'.starciwork','ledger-anchor.json');
  const anchor=JSON.parse(fs.readFileSync(anchorPath,'utf8'));
  assert.equal(anchor.schema,'starci/ledger-anchor@1');
  assert.equal(anchor.ledgerId,ledgerId);
  assert.ok(Number.isFinite(anchor.updatedAt));
  const entry=anchor.workflows[ID];
  assert.equal(entry.generation,2);
  assert.equal(entry.checkpointId,`import:${ID}:2`);
  assert.ok(entry.eventsHead,'the anchor carries the digest chain head');
  assert.ok(Number.isInteger(entry.seq)&&entry.seq>0,'the anchor carries the last event seq');
});

test('a second run neither reseeds `meta` nor rewrites the anchor entry it already wrote',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  await migrateLedger({repoRoot:repo,journalFile,machineFile});
  const anchorPath=path.join(repo,'.starciwork','ledger-anchor.json');
  const before=fs.readFileSync(anchorPath,'utf8');
  const db1=ledgerDb(repo);let ledgerIdBefore;try{ledgerIdBefore=db1.prepare("SELECT value FROM meta WHERE key='ledger_id'").get().value;}finally{db1.close();}
  const again=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.deepEqual(again.skipped,[{id:ID,reason:'already-migrated'}]);
  assert.equal(fs.readFileSync(anchorPath,'utf8'),before,'the anchor is untouched for a workflow the migrator does not revisit');
  const db2=ledgerDb(repo);
  try{
    assert.equal(db2.prepare("SELECT count(*) n FROM meta WHERE key='ledger_id'").get().n,1,'meta is never rewritten');
    assert.equal(db2.prepare("SELECT value FROM meta WHERE key='ledger_id'").get().value,ledgerIdBefore);
  }finally{db2.close();}
});


/* ---------------------------------------------------------------------------------------------------
 * §13 — only `_local/workflows/` migrates. Every other family is deleted, rows included, so the migrator's
 * whole job with them is to name them and their size before anything removes them.
 * ------------------------------------------------------------------------------------------------- */

const localRoot=repo=>path.join(repo,'.starciwork','_local');
const write=(file,text)=>{fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,text);};

/** A Plan v2 bundle as `workflows/lifecycle.mjs` writes it — a family §13 deletes rather than imports. */
function makePlan(repo,id){
  const dir=path.join(localRoot(repo),'plans',id);
  write(path.join(dir,'index.yaml'),`schema: starci/plan-index@1\nid: ${id}\n`);
  write(path.join(dir,'goal','index.yaml'),`schema: starci/plan-goal@1\nplanDigest: digest-${id}\n`);
  write(path.join(dir,'approval','index.yaml'),`schema: starci/plan-approval@1\nplanDigest: digest-${id}\n`);
  write(path.join(dir,'run','index.yaml'),`schema: starci/plan-run@1\nstatus: awaiting-plan-approval\n`);
  write(path.join(dir,'PLAN.md'),'# Plan\n\nTwo streams.\n');
  return dir;
}

function makeHistory(repo,entry='canonical-json-migration-20260916'){
  const dir=path.join(localRoot(repo),'history',entry);
  write(path.join(dir,'workflows','agentos-alpha','debug.json'),JSON.stringify({schema:'starci/workflow-debug@1',workflowId:'agentos-alpha'}));
  write(path.join(dir,'notes.md'),'renamed by hand on the 16th\n');
  return dir;
}

/** A retired workflow body inside one of the three archive families: a whole workflow, and still deleted. */
function makeArchivedBody(repo,family,relative,{id,generation=3,bytes=4096}={}){
  const dir=path.join(localRoot(repo),family,...relative.split('/'));
  write(path.join(dir,'goal.md'),`# ${id}\n`);
  write(path.join(dir,'goal.json'),JSON.stringify({schema:'starci/goal-record@1',id,rev:1,job:{title:`retired ${id}`}}));
  write(path.join(dir,'state.json'),JSON.stringify({schema:WORKFLOW_STATE,id,phase:'stopped',createdAt:500,goalDigest:`retired-${id}`,worktree:repo,job:{title:`retired ${id}`},engine:{generation}}));
  write(path.join(dir,'events.jsonl'),'x'.repeat(bytes)+'\n');
  return dir;
}

const draftsOf=repo=>{const dir=path.join(localRoot(repo),'drafts','nivo-group-chat-5-6');write(path.join(dir,'index.html'),'<!doctype html><title>draft</title>');write(path.join(dir,'dist','bundle.js'),'x'.repeat(2048));return dir;};
const dispatchCtxOf=repo=>{const dir=path.join(localRoot(repo),'runtime');write(path.join(dir,'orca-dispatch-ctx_202e50121946.md'),'# dispatch context\n');write(path.join(dir,'orca-dispatch-ctx_27fa95b7f7ff.md'),'# dispatch context\n');return dir;};
/** Everything §13's table lists beside `workflows/`, at once. */
function makeEveryFamily(repo){
  makePlan(repo,'agentos-two-streams');makeHistory(repo);draftsOf(repo);dispatchCtxOf(repo);
  makeArchivedBody(repo,'workflow-archive','agentos-alpha-20260915',{id:'agentos-alpha'});
  makeArchivedBody(repo,'workflows-archive','brand',{id:'brand'});
  makeArchivedBody(repo,'workflow-retirement','20260915-alpha/old-workflow',{id:'retired-alpha'});
}
const familyNames=summary=>summary.families.map(entry=>entry.family).sort();

test('every family beside `workflows/` is named with its byte size and the verdict `deleted-not-imported`',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  makeEveryFamily(repo);
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(summary.ok,true,'a family that is about to be deleted is reported, never a reason to refuse the root');
  assert.deepEqual(familyNames(summary),['drafts','history','plans','runtime','workflow-archive','workflow-retirement','workflows-archive']);
  for(const family of summary.families){
    assert.equal(family.verdict,'deleted-not-imported');
    assert.equal(family.source,path.join(localRoot(repo),family.family));
    assert.ok(family.files>0&&family.bytes>0,`${family.family} is reported with what it weighs`);
  }
  const drafts=summary.families.find(family=>family.family==='drafts');
  assert.ok(drafts.bytes>2048,'the size is the whole tree, not one level of it');
  assert.equal(drafts.files,2);
  assert.deepEqual(drafts.entries,['nivo-group-chat-5-6'],'each family names what is inside it, so the owner recognises what goes');
});

test('not one row of any deleted family reaches the ledger — least of all the archives',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  makeEveryFamily(repo);
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(summary.ok,true);
  assert.deepEqual(summary.workflows.map(entry=>entry.id),[ID],'only `_local/workflows/` migrates');
  const db=ledgerDb(repo);
  try{
    assert.deepEqual(db.prepare('SELECT workflow_id FROM workflows ORDER BY workflow_id').all().map(row=>row.workflow_id),[ID],
      'a retired body is a finished workflow: its rows do not migrate either');
    assert.equal(db.prepare('SELECT count(*) n FROM goals').get().n,1);
    assert.equal(db.prepare('SELECT count(*) n FROM events').get().n,6,'the live workflow`s own events, and nothing else');
    assert.equal(db.prepare('SELECT count(*) n FROM contracts').get().n,1,'dispatch context never becomes a contract (§9)');
    assert.equal(db.prepare('SELECT count(*) n FROM inputs').get().n,0,'a draft is not an input');
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map(row=>row.name);
    assert.equal(tables.includes('plans'),false,'§13 reversed the `plans` table; the migrator does not create one');
    assert.equal(tables.includes('history'),false,'nor a `history` table');
    const recorded=db.prepare("SELECT source,rows_json FROM migrations WHERE kind='local-family-deleted' ORDER BY source").all();
    assert.equal(recorded.length,7,'every family is recorded, which is what makes the second run a no-op');
    for(const row of recorded)assert.equal(JSON.parse(row.rows_json).verdict,'deleted-not-imported');
  }finally{db.close();}
  assert.ok(fs.existsSync(path.join(localRoot(repo),'workflow-archive','agentos-alpha-20260915','events.jsonl')),
    'the migrator reports what is about to be lost; it removes nothing itself');
  assert.ok(fs.existsSync(path.join(localRoot(repo),'runtime','orca-dispatch-ctx_202e50121946.md')));
  assert.ok(fs.existsSync(path.join(localRoot(repo),'plans','agentos-two-streams','PLAN.md')));
});

test('a file sitting directly under `_local` is a family of one, named like the rest',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  write(path.join(localRoot(repo),'notes-to-self.md'),'x'.repeat(512));
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.deepEqual(familyNames(summary),['notes-to-self.md']);
  const [family]=summary.families;
  assert.equal(family.files,1);assert.equal(family.bytes,512);
  assert.equal(family.verdict,'deleted-not-imported');
  assert.deepEqual(family.entries,[]);
});

test('a second run is a no-op for the deleted families too: reported once, recorded once, re-read never',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  makeEveryFamily(repo);
  const first=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(first.families.length,7);
  const counts=db=>Object.fromEntries(['workflows','goals','events','migrations'].map(table=>[table,db.prepare(`SELECT count(*) n FROM ${table}`).get().n]));
  const before=(()=>{const db=ledgerDb(repo);try{return counts(db);}finally{db.close();}})();
  const again=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(again.ok,true);
  assert.deepEqual(again.workflows,[]);
  assert.deepEqual(again.families,[]);
  assert.deepEqual(again.skipped.filter(entry=>entry.reason==='already-reported').map(entry=>path.basename(entry.source)).sort(),
    ['drafts','history','plans','runtime','workflow-archive','workflow-retirement','workflows-archive']);
  const after=(()=>{const db=ledgerDb(repo);try{return counts(db);}finally{db.close();}})();
  assert.deepEqual(after,before,'not one row is written twice');
});

test('a root whose `workflows/` is already gone still names the 2 GB beside it',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),machineFile=path.join(dir,'machine.sqlite');
  makeEveryFamily(repo);
  const summary=await migrateLedger({repoRoot:repo,journalFile:path.join(dir,'absent.sqlite'),machineFile});
  assert.equal(summary.ok,true);
  assert.deepEqual(summary.workflows,[]);
  assert.equal(summary.families.length,7,'the report does not depend on there being a workflow to migrate');
});

test('--dry-run names every family and writes nothing at all',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  makeEveryFamily(repo);
  const dry=await migrateLedger({repoRoot:repo,journalFile,machineFile,dryRun:true,archive:true});
  assert.equal(dry.ok,true);
  assert.equal(dry.families.length,7);
  for(const family of dry.families)assert.equal(family.verdict,'deleted-not-imported');
  assert.equal(dry.archivedLocalRoot,undefined,'--dry-run never moves `_local`, even with --archive');
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','runtime.sqlite')),false);
  assert.ok(fs.existsSync(path.join(localRoot(repo),'plans','agentos-two-streams','index.yaml')));
});

test('--archive carries every deleted family into `_local.migrated`, which is the copy the owner still holds',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  makeEveryFamily(repo);
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile,archive:true});
  assert.equal(summary.ok,true);
  const moved=path.join(repo,'.starciwork','_local.migrated');
  assert.equal(summary.archivedLocalRoot,moved);
  assert.equal(fs.existsSync(path.join(repo,'.starciwork','_local')),false);
  for(const family of ['plans','history','runtime','drafts','workflow-archive','workflows-archive','workflow-retirement'])
    assert.ok(fs.existsSync(path.join(moved,family)),`${family} is set aside, not deleted by the migrator`);
  assert.equal(summary.families.length,7,'the report is measured before the move, so it says what was there');
});

test('`_local/inputs` is never reported as deleted: §10 imports it into the `inputs` table with its workflow',async t=>{
  const dir=temporary();t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  const repo=path.join(dir,'repo'),journalFile=path.join(dir,'journal.sqlite'),machineFile=path.join(dir,'machine.sqlite');
  const wdir=makeWorkflow(repo,ID,{journalFile});makeJournal(journalFile,ID);
  declareInputs(wdir,ID,[{name:'srs.md',bytes:Buffer.from('the SRS, verbatim.\n'),sourceRef:'/owner/srs.md'}]);
  makeEveryFamily(repo);
  const summary=await migrateLedger({repoRoot:repo,journalFile,machineFile});
  assert.equal(summary.ok,true);
  assert.equal(familyNames(summary).includes('inputs'),false,'telling the owner they are about to lose an imported input would be a lie');
  assert.equal(summary.workflows[0].imported.inputs,1);
  const db=ledgerDb(repo);
  try{assert.equal(db.prepare('SELECT count(*) n FROM inputs WHERE workflow_id=?').get(ID).n,1);}finally{db.close();}
});
