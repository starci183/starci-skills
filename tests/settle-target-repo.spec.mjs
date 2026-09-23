import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';

// settle's landed proof resolves each owned path against the job's target
// repository (scripts/kernel/target-repo.mjs): a split be/fe project binding
// under a tmp Source, both repos cloned from local bare origins, the ledger in
// be. STARCI_SOURCE_ROOT points the registry lookup at the tmp Source.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=v=>JSON.stringify(v??null);
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const real=p=>fs.realpathSync.native(p);

const clone=(dir,name,files)=>{
  const origin=path.join(dir,`${name}.git`),repo=path.join(dir,name);
  git(dir,'init','--quiet','--bare',origin);
  git(dir,'clone','--quiet',origin,repo);
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  for(const [file,body] of Object.entries(files)){
    fs.mkdirSync(path.dirname(path.join(repo,file)),{recursive:true});
    fs.writeFileSync(path.join(repo,file),body);
  }
  git(repo,'add','.');
  git(repo,'commit','--quiet','-m','init');
  git(repo,'push','--quiet','-u','origin','main');
  const commit=(file,body)=>{
    fs.writeFileSync(path.join(repo,file),body);
    git(repo,'add',file);
    git(repo,'commit','--quiet','-m',`edit ${file}`);
    return git(repo,'rev-parse','HEAD');
  };
  return {repo:real(repo),commit};
};

const project=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-target-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const source=path.join(dir,'source');
  fs.mkdirSync(path.join(source,'.workspaces','projects','shop'),{recursive:true});
  const be=clone(dir,'shop-backend',{'src/a.ts':'export const a = 1;\n','.gitignore':'.starciwork/\n'});
  const fe=clone(dir,'shop-fe',{'apps/app/src/page.tsx':'export const Page = 1;\n'});
  fs.writeFileSync(path.join(source,'.workspaces','projects','shop','work.json'),json({
    schema:'starci/workspace-binding@1',project:'shop',
    repositories:{
      be:{pathFromSource:'../shop-backend',gitRepository:'https://example.test/shop-backend.git'},
      fe:{pathFromSource:'../shop-fe',gitRepository:'https://example.test/shop-fe.git'},
    },
    work:{ownerRole:'be',pathFromRepository:'.starciwork'},
  }));
  const env={...process.env,STARCI_SOURCE_ROOT:source};
  const api=(...args)=>{
    const r=spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
    let body=null;try{body=JSON.parse(r.stdout);}catch{}
    return {r,body};
  };
  return {be,fe,api};
};

// A running job with a bound contract whose worktree is the ledger repo (where
// the kernel placed the worker), a filed done report naming `head`, and green
// recorded checks: everything a pass needs except the landed proof.
const seedJob=(repo,{op,owned,head,repository,jobId='op-target-1',wf='wf-target'})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const at=Date.now();
    ledger.ensureWorkflow({workflowId:wf,title:'target'});
    ledger.enqueueJob({jobId,workflowId:wf,opId:op,kind:'op',payload:{
      opId:op,owned_paths:owned,...(repository?{repository}:{}),orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},
    }});
    ledger.db.prepare("UPDATE jobs SET status='running' WHERE job_id=?").run(jobId);
    ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
      .run(wf,op,1,`ctx-${jobId}`,'# contract',json({worktree:repo}),at);
    ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
      .run(wf,`ctx-${jobId}`,op,1,0,'done',json({outcome:'done',summary:'landed',head,branch:'main'}),null,at);
    ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
      .run(wf,op,1,json({checks:[{name:'unit',exitCode:0}]}),at);
  }finally{ledger.close();}
  return jobId;
};
const statusOf=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;}finally{l.close();}};
const repoEntry=(detail,root)=>detail.repos.find(r=>real(r.repo)===root);

test('a frontend op\'s bare owned path lands in the fe repo: clean fe + clean be settles pass',t=>{
  const {be,fe,api}=project(t);
  const head=fe.commit('apps/app/src/page.tsx','export const Page = 2;\n');
  const jobId=seedJob(be.repo,{op:'interface.implement',owned:['apps/app/src','.starciwork/features/shop/impl'],head});
  const {r,body}=api('settle','--repo',be.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.ok,true);
  assert.equal(real(body.landed.repo),fe.repo,'head is verified in the fe checkout');
  assert.equal(body.landed.headCheck,'verified');
  assert.deepEqual(repoEntry(body.landed,fe.repo),{repo:repoEntry(body.landed,fe.repo).repo,role:'fe',paths:['apps/app/src'],dirty:[]});
  assert.equal(repoEntry(body.landed,be.repo).role,'be','the Work path stays with the Work owner');
  assert.equal(statusOf(be.repo,jobId),'succeeded');
});

test('a dirty file in the fe repo refuses not-landed naming the fe repo',t=>{
  const {be,fe,api}=project(t);
  const head=fe.commit('apps/app/src/page.tsx','export const Page = 2;\n');
  fs.writeFileSync(path.join(fe.repo,'apps','app','src','extra.tsx'),'export const Extra = 1;\n');
  fs.mkdirSync(path.join(be.repo,'apps','app','src'),{recursive:true});
  const jobId=seedJob(be.repo,{op:'interface.implement',owned:['apps/app/src'],head});
  const {r,body}=api('settle','--repo',be.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(r.status,1,r.stderr||r.stdout);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.dirty,['apps/app/src/extra.tsx']);
  const entry=repoEntry(body.detail,fe.repo);
  assert.equal(entry.role,'fe');
  assert.deepEqual(entry.dirty,['apps/app/src/extra.tsx']);
  assert.equal(statusOf(be.repo,jobId),'running','a refused settle writes nothing');
});

test('a backend op\'s bare owned path still resolves to the backend repo',t=>{
  const {be,fe,api}=project(t);
  const head=be.commit('src/a.ts','export const a = 2;\n');
  fs.mkdirSync(path.join(fe.repo,'src'));
  fs.writeFileSync(path.join(fe.repo,'src','noise.ts'),'export const n = 1;\n');
  const clean=seedJob(be.repo,{op:'backend.implement',owned:['src/'],head});
  const ok=api('settle','--repo',be.repo,'--job',clean,'--verdict','pass','--json');
  assert.equal(ok.r.status,0,ok.r.stderr||ok.r.stdout);
  assert.deepEqual(ok.body.landed.repos.map(e=>real(e.repo)),[be.repo],'fe noise under src/ is not the backend op\'s');

  fs.writeFileSync(path.join(be.repo,'src','b.ts'),'export const b = 1;\n');
  const dirty=seedJob(be.repo,{op:'backend.implement',owned:['src/'],head,jobId:'op-target-2',wf:'wf-target-2'});
  const refused=api('settle','--repo',be.repo,'--job',dirty,'--verdict','pass','--json');
  assert.equal(refused.r.status,1,refused.r.stdout);
  assert.equal(refused.body.reason,'not-landed');
  assert.equal(real(refused.body.detail.repo),be.repo);
  assert.deepEqual(refused.body.detail.dirty,['src/b.ts']);
});

test('a path that names its repository is honoured: ../<fe>/… and payload.repository',t=>{
  const {be,fe,api}=project(t);
  const head=fe.commit('apps/app/src/page.tsx','export const Page = 2;\n');
  const edited=seedJob(be.repo,{op:'interface.implement',owned:['../shop-fe/apps/app/src'],head});
  const a=api('settle','--repo',be.repo,'--job',edited,'--verdict','pass','--json');
  assert.equal(a.r.status,0,a.r.stderr||a.r.stdout);
  assert.equal(repoEntry(a.body.landed,fe.repo).role,'fe');

  fs.writeFileSync(path.join(fe.repo,'apps','app','src','page.tsx'),'export const Page = 3;\n');
  const pinned=seedJob(be.repo,{op:'code.refactor',owned:['apps/app/src'],head,repository:'fe',jobId:'op-target-3',wf:'wf-target-3'});
  const b=api('settle','--repo',be.repo,'--job',pinned,'--verdict','pass','--json');
  assert.equal(b.r.status,1,b.r.stdout);
  assert.equal(b.body.reason,'not-landed');
  assert.deepEqual(repoEntry(b.body.detail,fe.repo).dirty,['apps/app/src/page.tsx']);

  const unbound=seedJob(be.repo,{op:'code.refactor',owned:['apps/app/src'],head,repository:'mobile',jobId:'op-target-4',wf:'wf-target-4'});
  const c=api('settle','--repo',be.repo,'--job',unbound,'--verdict','pass','--json');
  assert.equal(c.r.status,1,c.r.stdout);
  assert.equal(c.body.reason,'landed-unverifiable');
  assert.equal(c.body.detail.step,'repository');
});

test('api enqueue records the resolved target repository; an unbound repository is refused',t=>{
  const {be,api}=project(t);
  const ledger=openLedger({file:ledgerFileFor(be.repo)});
  try{ledger.ensureWorkflow({workflowId:'wf-enq',title:'enqueue'});}finally{ledger.close();}
  const enqueue=(...extra)=>api('enqueue','--repo',be.repo,'--workflow','wf-enq','--json',...extra);
  const payloadOf=jobId=>{const l=inspectLedger({file:ledgerFileFor(be.repo)});try{return JSON.parse(l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId).payload_json);}finally{l.close();}};

  const fe=enqueue('--op','interface.implement','--paths','apps/app/src');
  assert.equal(fe.r.status,0,fe.r.stderr||fe.r.stdout);
  assert.equal(fe.body.repository,'fe');
  assert.equal(payloadOf(fe.body.job_id).repository,'fe');

  const beJob=enqueue('--op','backend.implement','--paths','src/');
  assert.equal(beJob.r.status,0,beJob.r.stderr||beJob.r.stdout);
  assert.equal(payloadOf(beJob.body.job_id).repository,undefined,'a backend op targets where dispatch places it');

  const named=enqueue('--op','code.refactor','--paths','apps/app/src','--repository','shop-fe');
  assert.equal(named.r.status,0,named.r.stderr||named.r.stdout);
  assert.equal(payloadOf(named.body.job_id).repository,'fe','a repo name resolves to its binding role');

  const unknown=enqueue('--op','code.refactor','--paths','src/','--repository','mobile');
  assert.equal(unknown.r.status,1,unknown.r.stdout);
  assert.equal(unknown.body.reason,'repository-unknown');
  const prefixed=enqueue('--op','code.refactor','--paths','repository:mobile/src');
  assert.equal(prefixed.r.status,1,prefixed.r.stdout);
  assert.equal(prefixed.body.reason,'path-repository-unknown');
});

test('ownedPathPlacements: a contract worktree of the target repo is its checkout; no binding keeps the placement',async t=>{
  const {ownedPathPlacements}=await import('../scripts/kernel/target-repo.mjs');
  const {be,fe}=project(t);
  const child=path.join(path.dirname(fe.repo),'shop-fe-child');
  git(fe.repo,'worktree','add','--quiet','-b','child',child);
  const prior=process.env.STARCI_SOURCE_ROOT;
  t.after(()=>{if(prior===undefined)delete process.env.STARCI_SOURCE_ROOT;else process.env.STARCI_SOURCE_ROOT=prior;});
  process.env.STARCI_SOURCE_ROOT=path.join(path.dirname(be.repo),'source');
  const [src,work]=ownedPathPlacements({op:'interface.implement',payload:{},ownedPaths:['apps/app/src','.starciwork/x'],repo:be.repo,worktree:child,timeoutMs:30000});
  assert.equal(src.base,child);
  assert.equal(src.via,'op-frontend');
  assert.equal(work.base,be.repo);
  assert.equal(work.via,'work-owner');
  process.env.STARCI_SOURCE_ROOT=path.join(path.dirname(be.repo),'nowhere');
  const [plain]=ownedPathPlacements({op:'interface.implement',payload:{},ownedPaths:['apps/app/src'],repo:be.repo,worktree:child,timeoutMs:30000});
  assert.equal(plain.base,child);
  assert.equal(plain.via,'placement','no binding: the dispatch placement is the target, as before');
});

test('an owned path spelled <owner-name>/… is checked at the owner root, not a nested <owner-name>/ dir',t=>{
  const {be,api}=project(t);
  const head=be.commit('src/a.ts','export const a = 2;\n');
  fs.writeFileSync(path.join(be.repo,'src','b.ts'),'export const b = 1;\n');
  const jobId=seedJob(be.repo,{op:'backend.implement',owned:['shop-backend/src'],head});
  const {r,body}=api('settle','--repo',be.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(r.status,1,r.stdout);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.dirty,['src/b.ts']);
  assert.equal(repoEntry(body.detail,be.repo).role,'be');
});
