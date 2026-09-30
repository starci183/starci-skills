import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {writeGreenSonar} from './helpers/sonar-scan.mjs';
import {inspectLedger,ledgerFileFor,openLedger,ensureWorkflow,changeWorkflowPhase,insertGoal,createUnit,enqueueJob,setJobStatus,startAttempt,writeContract,fileReport,recordCheckRun} from '../engine/ledger-db.mjs';

// git's repository-local variables (git rev-parse --local-env-vars) never reach a fixture: a hook or alias run in a linked
// worktree exports GIT_DIR, and every fixture git then writes THAT repository whatever cwd or -C it names - a temp dir's
// `git init` re-inited the live .claude repo core.bare=true (2026-09-29, tests/live-core-bare.spec.mjs).
for(const key of ['GIT_DIR','GIT_COMMON_DIR','GIT_WORK_TREE','GIT_INDEX_FILE','GIT_OBJECT_DIRECTORY','GIT_ALTERNATE_OBJECT_DIRECTORIES','GIT_IMPLICIT_WORK_TREE','GIT_PREFIX','GIT_CONFIG','GIT_CONFIG_PARAMETERS','GIT_CONFIG_COUNT','GIT_GRAFT_FILE','GIT_NO_REPLACE_OBJECTS','GIT_REPLACE_REF_BASE','GIT_SHALLOW_FILE']) delete process.env[key];

// settle's landed proof resolves each owned path against the job's target
// repository (scripts/kernel/target-repo.mjs): one app checkout with be/ and fe/
// sides under a tmp Source, cloned from a local bare origin, the ledger at the
// app root. STARCI_SOURCE_ROOT points the registry lookup at the tmp Source.
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
  const app=clone(dir,'shop',{'be/src/a.ts':'export const a = 1;\n',
    'fe/apps/app/src/page.tsx':'export const Page = 1;\n','.gitignore':'.starciwork/\n'});
  const be={repo:app.repo,side:path.join(app.repo,'be'),commit:(file,body)=>app.commit(`be/${file}`,body)};
  const fe={repo:path.join(app.repo,'fe'),commit:(file,body)=>app.commit(`fe/${file}`,body)};
  fs.writeFileSync(path.join(source,'.workspaces','projects','shop','work.json'),json({
    schema:'starci/workspace-binding@2',project:'shop',
    repository:{pathFromSource:'../shop',gitRepository:'https://example.test/shop.git'},
    sides:{be:'be',fe:'fe'},work:{pathFromRepository:'.starciwork'},
  }));
  const env={...process.env,STARCI_SOURCE_ROOT:source};
  const api=(...args)=>{
    const r=spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
    let body=null;try{body=JSON.parse(r.stdout);}catch{}
    return {r,body};
  };
  return {be,fe,api};
};

// A running job on a running workflow with a contract-bound open attempt whose
// contract worktree is the ledger repo (where the kernel placed the worker), a
// filed done report naming `head`, and a green independent check_runs row:
// everything a pass needs except the landed proof.
const seedJob=(repo,{op,owned,head,repository,jobId='op-target-1',wf='wf-target'})=>{
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const at=Date.now();
    ledger.transaction(db=>{
      ensureWorkflow(db,{workflowId:wf,phase:'queued',title:'target',by:'test-fixture',reason:'seed',at});
      insertGoal(db,{workflowId:wf,revision:1,goalIdentity:`goal-${wf}`,markdown:'# goal',goal:{job:op},createdAt:at});
      changeWorkflowPhase(db,{workflowId:wf,to:'running',by:'test-fixture',reason:'seed',at});
      createUnit(db,{workflowId:wf,unitId:`unit-${jobId}`,opId:op,subjectKey:`unit-${jobId}`,goalRevision:1,createdAt:at});
      enqueueJob(db,{jobId,workflowId:wf,unitId:`unit-${jobId}`,opId:op,kind:'op',payload:{
        opId:op,owned_paths:owned,...(repository?{repository}:{}),orca:{dispatchId:`ctx-${jobId}`,agentTerminalHandle:`term-${jobId}`},
      },createdAt:at});
      setJobStatus(db,{jobId,to:'ready',reason:'seed',at});
      setJobStatus(db,{jobId,to:'leased',reason:'seed',at});
      const attempt=startAttempt(db,{workflowId:wf,jobId,dispatchId:`ctx-${jobId}`,
        terminalHandle:`term-${jobId}`,repoRoot:repo,dispatchedAt:at,startedAt:at,at});
      writeContract(db,{attemptId:attempt.attempt_id,markdown:'# contract',context:{worktree:repo},createdAt:at});
      setJobStatus(db,{jobId,to:'running',reason:'seed',at});
      fileReport(db,{attemptId:attempt.attempt_id,outcome:'done',
        report:{outcome:'done',summary:'landed',head,branch:'main',files:[writeGreenSonar(path.join(repo,'..','sonar-'+jobId))],dispatch:`ctx-${jobId}`,from:jobId},fromTerminal:`term-${jobId}`,createdAt:at});
      recordCheckRun(db,{attemptId:attempt.attempt_id,name:'unit',phase:'verify',runner:'kernel',authority:'runtime',
        status:'pass',exitCode:0,command:'unit',createdAt:at});
    });
  }finally{ledger.close();}
  return jobId;
};
const statusOf=(repo,jobId)=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId)?.status;}finally{l.close();}};
const repoEntry=(detail,root)=>detail.repos.find(r=>real(r.repo)===root);

test('a frontend op\'s bare owned path lands in fe/: clean app checkout settles pass',t=>{
  const {be,fe,api}=project(t);
  const head=fe.commit('apps/app/src/page.tsx','export const Page = 2;\n');
  const jobId=seedJob(be.repo,{op:'interface.implement',owned:['apps/app/src','.starciwork/features/shop/impl'],head});
  const {r,body}=api('settle','--repo',be.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(body.ok,true);
  assert.equal(real(body.landed.repo),be.repo,'head is verified in the app checkout');
  assert.equal(body.landed.headCheck,'verified');
  assert.deepEqual(repoEntry(body.landed,be.repo),{repo:repoEntry(body.landed,be.repo).repo,role:'fe',
    paths:['fe/apps/app/src','.starciwork/features/shop/impl'],dirty:[]});
  assert.equal(statusOf(be.repo,jobId),'succeeded');
});

test('a dirty file in fe/ refuses not-landed naming the app checkout',t=>{
  const {be,fe,api}=project(t);
  const head=fe.commit('apps/app/src/page.tsx','export const Page = 2;\n');
  fs.writeFileSync(path.join(fe.repo,'apps','app','src','extra.tsx'),'export const Extra = 1;\n');
  fs.mkdirSync(path.join(be.side,'apps','app','src'),{recursive:true});
  const jobId=seedJob(be.repo,{op:'interface.implement',owned:['apps/app/src'],head});
  const {r,body}=api('settle','--repo',be.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(r.status,1,r.stderr||r.stdout);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.dirty,['fe/apps/app/src/extra.tsx']);
  const entry=repoEntry(body.detail,be.repo);
  assert.equal(entry.role,'fe');
  assert.deepEqual(entry.dirty,['fe/apps/app/src/extra.tsx']);
  assert.equal(statusOf(be.repo,jobId),'running','a refused settle writes nothing');
});

test('a backend op\'s bare owned path resolves to be/',t=>{
  const {be,fe,api}=project(t);
  const head=be.commit('src/a.ts','export const a = 2;\n');
  fs.mkdirSync(path.join(fe.repo,'src'));
  fs.writeFileSync(path.join(fe.repo,'src','noise.ts'),'export const n = 1;\n');
  const clean=seedJob(be.repo,{op:'backend.implement',owned:['src/'],head});
  const ok=api('settle','--repo',be.repo,'--job',clean,'--verdict','pass','--json');
  assert.equal(ok.r.status,0,ok.r.stderr||ok.r.stdout);
  assert.deepEqual(ok.body.landed.repos.map(e=>real(e.repo)),[be.repo],'fe noise under src/ is outside the backend grant');

  fs.writeFileSync(path.join(be.side,'src','b.ts'),'export const b = 1;\n');
  const dirty=seedJob(be.repo,{op:'backend.implement',owned:['src/'],head,jobId:'op-target-2',wf:'wf-target-2'});
  const refused=api('settle','--repo',be.repo,'--job',dirty,'--verdict','pass','--json');
  assert.equal(refused.r.status,1,refused.r.stdout);
  assert.equal(refused.body.reason,'not-landed');
  assert.equal(real(refused.body.detail.repo),be.repo);
  assert.deepEqual(refused.body.detail.dirty,['be/src/b.ts']);
});

test('a path that names its side is honoured: fe/… and payload.repository',t=>{
  const {be,fe,api}=project(t);
  const head=fe.commit('apps/app/src/page.tsx','export const Page = 2;\n');
  const edited=seedJob(be.repo,{op:'interface.implement',owned:['fe/apps/app/src'],head});
  const a=api('settle','--repo',be.repo,'--job',edited,'--verdict','pass','--json');
  assert.equal(a.r.status,0,a.r.stderr||a.r.stdout);
  assert.equal(repoEntry(a.body.landed,be.repo).role,'fe');

  fs.writeFileSync(path.join(fe.repo,'apps','app','src','page.tsx'),'export const Page = 3;\n');
  const pinned=seedJob(be.repo,{op:'code.refactor',owned:['apps/app/src'],head,repository:'fe',jobId:'op-target-3',wf:'wf-target-3'});
  const b=api('settle','--repo',be.repo,'--job',pinned,'--verdict','pass','--json');
  assert.equal(b.r.status,1,b.r.stdout);
  assert.equal(b.body.reason,'not-landed');
  assert.deepEqual(repoEntry(b.body.detail,be.repo).dirty,['fe/apps/app/src/page.tsx']);

  const unbound=seedJob(be.repo,{op:'code.refactor',owned:['apps/app/src'],head,repository:'mobile',jobId:'op-target-4',wf:'wf-target-4'});
  const c=api('settle','--repo',be.repo,'--job',unbound,'--verdict','pass','--json');
  assert.equal(c.r.status,1,c.r.stdout);
  assert.equal(c.body.reason,'landed-unverifiable');
  assert.equal(c.body.detail.step,'repository');
});

test('api enqueue records the resolved target repository; an unbound repository is refused',t=>{
  const {be,api}=project(t);
  const ledger=openLedger({file:ledgerFileFor(be.repo)});
  try{ledger.transaction(db=>{
    ensureWorkflow(db,{workflowId:'wf-enq',title:'enqueue',by:'test-fixture',reason:'seed'});
    insertGoal(db,{workflowId:'wf-enq',revision:1,goalIdentity:'goal-wf-enq',markdown:'# goal',goal:{}});
  });}finally{ledger.close();}
  const enqueue=(...extra)=>api('enqueue','--repo',be.repo,'--workflow','wf-enq','--json',...extra);
  const payloadOf=jobId=>{const l=inspectLedger({file:ledgerFileFor(be.repo)});try{return JSON.parse(l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId).payload_json);}finally{l.close();}};

  const fe=enqueue('--op','interface.implement','--paths','apps/app/src');
  assert.equal(fe.r.status,0,fe.r.stderr||fe.r.stdout);
  assert.equal(fe.body.repository,'fe');
  assert.equal(payloadOf(fe.body.job_id).repository,'fe');

  const beJob=enqueue('--op','backend.implement','--paths','src/');
  assert.equal(beJob.r.status,0,beJob.r.stderr||beJob.r.stdout);
  // An unqualified path binds the one side it exists in (enqueue-unqualified-path-binding): src/ exists only in
  // be/, so the job records be explicitly instead of falling back to the dispatch placement.
  assert.equal(payloadOf(beJob.body.job_id).repository,'be','a bare path binds the repository it exists in');

  const named=enqueue('--op','code.refactor','--paths','apps/app/src','--repository','fe');
  assert.equal(named.r.status,0,named.r.stderr||named.r.stdout);
  assert.equal(payloadOf(named.body.job_id).repository,'fe','a side name resolves to its binding role');

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
  const child=path.join(path.dirname(be.repo),'shop-child');
  git(be.repo,'worktree','add','--quiet','-b','child',child);
  const prior=process.env.STARCI_SOURCE_ROOT;
  t.after(()=>{if(prior===undefined)delete process.env.STARCI_SOURCE_ROOT;else process.env.STARCI_SOURCE_ROOT=prior;});
  process.env.STARCI_SOURCE_ROOT=path.join(path.dirname(be.repo),'source');
  const [src,work]=ownedPathPlacements({op:'interface.implement',payload:{},ownedPaths:['apps/app/src','.starciwork/x'],repo:be.repo,worktree:child,timeoutMs:30000});
  assert.equal(src.base,path.join(child,'fe'));
  assert.equal(src.via,'op-side');
  assert.equal(work.base,child);
  assert.equal(work.via,'work-owner');
  process.env.STARCI_SOURCE_ROOT=path.join(path.dirname(be.repo),'nowhere');
  const [plain]=ownedPathPlacements({op:'interface.implement',payload:{},ownedPaths:['apps/app/src'],repo:be.repo,worktree:child,timeoutMs:30000});
  assert.equal(plain.base,child);
  assert.equal(plain.via,'placement','no binding: the dispatch placement is the target, as before');
});

test('an owned path spelled be/… is checked at the backend side',t=>{
  const {be,api}=project(t);
  const head=be.commit('src/a.ts','export const a = 2;\n');
  fs.writeFileSync(path.join(be.side,'src','b.ts'),'export const b = 1;\n');
  const jobId=seedJob(be.repo,{op:'backend.implement',owned:['be/src'],head});
  const {r,body}=api('settle','--repo',be.repo,'--job',jobId,'--verdict','pass','--json');
  assert.equal(r.status,1,r.stdout);
  assert.equal(body.reason,'not-landed');
  assert.deepEqual(body.detail.dirty,['be/src/b.ts']);
  assert.equal(repoEntry(body.detail,be.repo).role,'be');
});
