import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {WORK_COMMIT_CHANGE} from '../scripts/kernel/settle-landed.mjs';
import {loadContractChanges} from '../scripts/kernel/contract-version.mjs';

// Work debt a finished workflow's jobs cover (inc-6262420b8467, Supervisor ruling 2026-09-24): a
// file no report or run window attributes, whose covering jobs all belong to finished or archived
// workflows, is adoptable by one live workflow (--adopt-from <any covering workflow>
// --as-repo-owner) instead of stranded as unattributed; a file a live workflow's job still covers
// stays with that workflow - the adopt names it `held` and never takes it.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=v=>JSON.stringify(v??null);
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const checkout=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-work-debt-adopt-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(dir,'work');
  fs.mkdirSync(path.join(repo,'.starciwork'),{recursive:true});
  git(repo,'init','--quiet');
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  const ledger=path.relative(repo,ledgerFileFor(repo)).replaceAll('\\','/');
  fs.writeFileSync(path.join(repo,'.gitignore'),`${ledger}*\n${path.posix.dirname(ledger)}/*.lock\n`);
  git(repo,'add','.');
  git(repo,'commit','--quiet','-m','init');
  const write=(rel,body,at)=>{const abs=path.join(repo,rel);fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,body);fs.utimesSync(abs,new Date(at),new Date(at));};
  return {dir,repo,write};
};
const registryAt=(dir,at)=>{
  const ops=loadContractChanges(ROOT).changes.find(c=>c.id===WORK_COMMIT_CHANGE)?.ops??[];
  const file=path.join(dir,'contract-changes.yaml');
  fs.writeFileSync(file,`schema: starci/contract-changes@1\nchanges:\n  - id: ${WORK_COMMIT_CHANGE}\n    effectiveAt: '${new Date(at).toISOString()}'\n    summary: spec\n    ops: [${ops.join(', ')}]\n    reach: new-legs\n`);
  return {STARCI_CONTRACT_CHANGES:file};
};
const api=(env,...args)=>{
  const r=spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,...env}});
  let body=null;try{body=JSON.parse(r.stdout);}catch{}
  return {r,body};
};
const seedJob=(repo,{op,jobId,wf,admittedAt,status='succeeded',owned})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.ensureWorkflow({workflowId:wf,title:wf});
    ledger.enqueueJob({jobId,workflowId:wf,opId:op,attempt:1,kind:'op',payload:{opId:op,owned_paths:owned,orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},settledAt:admittedAt+1000}});
    ledger.db.prepare('UPDATE jobs SET status=? WHERE job_id=?').run(status,jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,op,1,`ctx-${jobId}`,'# contract',json({worktree:repo}),admittedAt);
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,`ctx-${jobId}`,op,1,0,'done',json({outcome:'done',summary:jobId}),null,admittedAt+500);
  }finally{ledger.close();}
};
const finish=(repo,wf,{archive=false}={})=>{const l=openLedger({file:ledgerFileFor(repo)});try{
  if(archive)l.db.prepare('UPDATE workflows SET archived_at=? WHERE workflow_id=?').run(Date.now(),wf);
  else l.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(wf);}finally{l.close();}};
const payloadOf=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return JSON.parse(l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId).payload_json);}finally{l.close();}};

const OP='architecture.decide';
const AUTHORITY='.starciwork/decision/module-authority/index.yaml';
const NAMING='.starciwork/decision/module-naming/index.yaml';
const LIVE_HELD='.starciwork/shell/layout.yaml';

// wf-pred (finished) and wf-arch (archived) both covered the decision area; neither's report nor run
// window names the files (written hours before either ran). wf-other is live and its settled job
// still covers one of them. wf-collab is the live adopter, authoring elsewhere.
const fixture=t=>{
  const {dir,repo,write}=checkout(t);
  const env=registryAt(dir,Date.now()-3_600_000);
  const now=Date.now(),old=now-10*3_600_000;
  for(const rel of [AUTHORITY,NAMING,LIVE_HELD])write(rel,'id: x\n',old);
  seedJob(repo,{op:OP,jobId:'op-pred',wf:'wf-pred',admittedAt:now-120_000,owned:['.starciwork/decision/','.starciwork/shell/']});
  seedJob(repo,{op:OP,jobId:'op-arch',wf:'wf-arch',admittedAt:now-100_000,owned:['.starciwork/decision/module-naming/']});
  seedJob(repo,{op:OP,jobId:'op-other',wf:'wf-other',admittedAt:now-90_000,owned:['.starciwork/shell/']});
  seedJob(repo,{op:'work.author',jobId:'op-collab',wf:'wf-collab',admittedAt:now-80_000,status:'queued',owned:['.starciwork/features/collab/work/w.yaml']});
  finish(repo,'wf-pred');
  finish(repo,'wf-arch',{archive:true});
  return {env,repo};
};

test('reconcile --work-debt: files only finished or archived workflows cover are adoptable debt; a live-covered one is held by its live owner',t=>{
  const {env,repo}=fixture(t);
  const listed=api(env,'reconcile','--repo',repo,'--work-debt','--json');
  assert.equal(listed.r.status,0,listed.r.stderr);
  assert.deepEqual(listed.body.unattributed.map(u=>[u.file,u.liveOwners]),[[LIVE_HELD,['wf-other']]],'only the live-covered file stays unattributed');
  const debts=listed.body.debts.filter(d=>d.workflowFinished);
  assert.deepEqual(debts.flatMap(d=>d.paths).sort(),[AUTHORITY,NAMING].sort());
  assert.ok(debts.every(d=>d.attributedBy.cover>=1),JSON.stringify(debts));
  assert.deepEqual(listed.body.batches,[],'a finished workflow\'s debt is never a live batch');
  const adoptions=listed.body.adoptions;
  assert.ok(adoptions.length>=1);
  assert.deepEqual(adoptions.flatMap(a=>a.held),[],'the held file is not a finished workflow\'s debt');
  assert.ok(adoptions.every(a=>a.repoOwner?.enqueue.includes('--as-repo-owner')));
});

test('enqueue --adopt-from a finished covering workflow --as-repo-owner takes what only finished workflows cover; the live-covered file is held, named',t=>{
  const {env,repo}=fixture(t);
  const adopt=api(env,'enqueue','--repo',repo,'--workflow','wf-collab','--op',OP,'--commit-only-work-debt','--adopt-from','wf-pred','--as-repo-owner','--json');
  assert.equal(adopt.r.status,0,adopt.r.stderr||adopt.r.stdout);
  const payload=payloadOf(repo,adopt.body.job_id);
  assert.deepEqual([...payload.owned_paths].sort(),[AUTHORITY,NAMING].sort(),'a file an archived and a finished workflow both cover goes to the adopter');
  assert.equal(payload.commitOnly.adoptedFrom,'wf-pred');
  assert.equal(payload.commitOnly.asRepoOwner,true);
  assert.deepEqual(payload.commitOnly.held,[{file:LIVE_HELD,liveOwners:['wf-other']}]);

  const again=api(env,'enqueue','--repo',repo,'--workflow','wf-collab','--op',OP,'--commit-only-work-debt','--adopt-from','wf-pred','--as-repo-owner','--json');
  assert.equal(again.r.status,1);
  assert.equal(again.body.reason,'adopt-held-live');
  assert.match(again.body.detail,/wf-other/);
  assert.deepEqual(again.body.held,[{file:LIVE_HELD,liveOwners:['wf-other']}]);
});

test('an archived covering workflow adopts too; a live one is still refused adopt-from-live',t=>{
  const {env,repo}=fixture(t);
  const adopt=api(env,'enqueue','--repo',repo,'--workflow','wf-collab','--op',OP,'--commit-only-work-debt','--adopt-from','wf-arch','--as-repo-owner','--json');
  assert.equal(adopt.r.status,0,adopt.r.stderr||adopt.r.stdout);
  assert.deepEqual(payloadOf(repo,adopt.body.job_id).owned_paths,[NAMING],'only the file wf-arch covers');
  const live=api(env,'enqueue','--repo',repo,'--workflow','wf-collab','--op',OP,'--commit-only-work-debt','--adopt-from','wf-other','--as-repo-owner','--json');
  assert.equal(live.r.status,1);
  assert.match(live.r.stderr,/adopt-from-live/);
});
