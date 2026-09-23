import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {landedProof,policyCommits,policyPushes} from '../scripts/kernel/settle-landed.mjs';

// settle's landed proof (modules/kernel/api.yaml commands.settle refuses
// not-landed / landed-unverifiable). A tmp clone of a local bare origin is the
// target checkout and also the ledger repo; no network.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const json=v=>JSON.stringify(v??null);
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

const checkout=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-landed-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const origin=path.join(dir,'origin.git'),repo=path.join(dir,'work');
  git(dir,'init','--quiet','--bare',origin);
  git(dir,'clone','--quiet',origin,repo);
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  fs.mkdirSync(path.join(repo,'src'));
  fs.writeFileSync(path.join(repo,'src','a.ts'),'export const a = 1;\n');
  fs.writeFileSync(path.join(repo,'.gitignore'),'.starciwork/\n');
  git(repo,'add','.');
  git(repo,'commit','--quiet','-m','init');
  git(repo,'push','--quiet','-u','origin','main');
  const commit=(file,body)=>{
    fs.writeFileSync(path.join(repo,file),body);
    git(repo,'add',file);
    git(repo,'commit','--quiet','-m',`edit ${file}`);
    return git(repo,'rev-parse','HEAD');
  };
  return {dir,origin,repo,commit};
};

// A running job of `op` owning src/, with a bound contract, a filed done
// report naming `head`, and green recorded checks — everything a pass needs
// except the landed proof.
const seedJob=(repo,{op,head,jobId='op-landed-1',wf='wf-landed'})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const at=Date.now();
    ledger.ensureWorkflow({workflowId:wf,title:'landed'});
    ledger.enqueueJob({jobId,workflowId:wf,opId:op,kind:'op',payload:{
      opId:op,owned_paths:['src/'],orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},
    }});
    ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,op,1,`ctx-${jobId}`,'# contract',json({worktree:repo}),at);
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,`ctx-${jobId}`,op,1,0,'done',json({outcome:'done',summary:'landed',...(head?{head,branch:'main'}:{})}),null,at);
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(wf,op,1,json({checks:[{name:'unit',exitCode:0}]}),at);
  }finally{ledger.close();}
  return jobId;
};
const settlePass=(repo,jobId)=>{
  const r=runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
  let body=null;try{body=JSON.parse(r.stdout);}catch{}
  return {r,body};
};
const statusOf=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;}finally{l.close();}};

test('policy vocabulary: scoped-local-commit commits, push:true pushes, none/absent does neither',()=>{
  assert.equal(policyCommits({mode:'scoped-local-commit',push:false}),true);
  assert.equal(policyPushes({mode:'scoped-local-commit',push:false}),false);
  assert.equal(policyPushes({mode:'scoped-local-commit',push:true}),true);
  assert.equal(policyCommits(null),false);
  assert.equal(policyCommits({mode:'none',push:true}),false);
  assert.equal(policyPushes({mode:'none',push:true}),false);
});

test('push:false op with a dirty owned path is refused not-landed with the dirty list',t=>{
  const {repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 2;\n');
  fs.writeFileSync(path.join(repo,'src','b.ts'),'export const b = 1;\n');
  const jobId=seedJob(repo,{op:'backend.implement',head});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,1,r.stderr||r.stdout);
  assert.equal(body.ok,false);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.dirty,['src/b.ts']);
  assert.equal(body.detail.head,head);
  assert.deepEqual(body.detail.missing,[]);
  assert.equal(statusOf(repo,jobId),'running','a refused settle writes nothing');
});

test('push:false op committed locally while the checkout is ahead of origin settles pass',t=>{
  const {repo,commit}=checkout(t);
  commit('src/a.ts','export const a = 2;\n');
  const head=commit('src/a.ts','export const a = 3;\n');
  assert.notEqual(git(repo,'rev-parse','HEAD'),git(repo,'rev-parse','origin/main'),'fixture must be ahead of origin');
  const jobId=seedJob(repo,{op:'backend.implement',head});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.ok,true);
  assert.equal(body.landed.head,head);
  assert.equal(body.landed.originHead,undefined,'push:false never reads origin');
  assert.equal(statusOf(repo,jobId),'succeeded');
});

test('push:false op whose report head is not in local history is refused not-landed',t=>{
  const {repo}=checkout(t);
  const head='0123456789abcdef0123456789abcdef01234567';
  const jobId=seedJob(repo,{op:'backend.implement',head});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,1,r.stderr||r.stdout);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.missing,[`commit:${head}`]);
});

test('push:false op whose done report names no head is refused not-landed',t=>{
  const {repo}=checkout(t);
  const jobId=seedJob(repo,{op:'backend.implement',head:null});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,1,r.stderr||r.stdout);
  assert.deepEqual(body.detail.missing,['head']);
});

test('op without a commitPolicy settles pass over a dirty tree unchanged',t=>{
  const {repo}=checkout(t);
  fs.writeFileSync(path.join(repo,'src','b.ts'),'export const b = 1;\n');
  const jobId=seedJob(repo,{op:'docs.author',head:null});
  const {r,body}=settlePass(repo,jobId);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.ok,true);
  assert.equal(body.landed,undefined);
});

test('a job whose owned paths sit in no git checkout settles as before',t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-landed-plain-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  assert.deepEqual(landedProof({base:dir,ownedPaths:['src/'],head:null,branch:null,pushes:true}),{checked:false,why:'repo-unresolved'});
});

test('push:true: unpushed head is not-landed, pushed head passes, a vanished origin is landed-unverifiable',t=>{
  const {origin,repo,commit}=checkout(t);
  const head=commit('src/a.ts','export const a = 2;\n');
  const unpushed=landedProof({base:repo,ownedPaths:['src/'],head,branch:'main',pushes:true});
  assert.equal(unpushed.reason,'not-landed');
  assert.notEqual(unpushed.detail.originHead,head);
  assert.deepEqual(unpushed.detail.missing,[`origin/main:${head}`]);

  git(repo,'push','--quiet','origin','main');
  const pushed=landedProof({base:repo,ownedPaths:['src/'],head,branch:'main',pushes:true});
  assert.equal(pushed.ok,true,JSON.stringify(pushed));
  assert.equal(pushed.detail.originHead,head);

  fs.rmSync(origin,{recursive:true,force:true});
  const gone=landedProof({base:repo,ownedPaths:['src/'],head,branch:'main',pushes:true});
  assert.equal(gone.ok,false);
  assert.equal(gone.reason,'landed-unverifiable');
  assert.equal(gone.detail.step,'fetch');
});
