import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {seedWorkflow} from './_ledger-fixture.mjs';
// Attestation/settle waits are counted logically; scaled down they cost milliseconds, not load-dependent seconds.
process.env.STARCI_SLEEP_SCALE??='0.02';

// api dispatch resolves each owned path against its target repository
// (scripts/kernel/target-repo.mjs) before the packet reaches the worker: a
// path spelled with its repository's name is relative to that repository's
// root — bare when it is the worker's checkout, rooted at the bound sibling
// checkout otherwise — and the prompt names the roots it writes in. A tmp
// Source holds a be/fe binding; the fake `orca` serves a healthy terminal.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=v=>JSON.stringify(v??null);
const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
};
const slash=p=>p.replace(/\\/g,'/');
const esc=s=>s.replace(/[\\^$.*+?()[\]{}|]/g,'\\$&');

const fixture=(t,{bound=true}={})=>{
  const dir=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'starci-dispatch-target-')));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),
    {recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const be=path.join(dir,'shop-next'),fe=path.join(dir,'shop-fe'),source=path.join(dir,'source');
  for(const repo of [be,fe]){
    fs.mkdirSync(path.join(repo,'src'),{recursive:true});
    git(repo,'init','--quiet');
  }
  fs.mkdirSync(path.join(source,'.workspaces','projects','shop'),{recursive:true});
  if(bound)fs.writeFileSync(path.join(source,'.workspaces','projects','shop','work.json'),json({
    schema:'starci/workspace-binding@1',project:'shop',
    repositories:{
      be:{pathFromSource:'../shop-next',gitRepository:'https://example.test/shop-next.git'},
      fe:{pathFromSource:'../shop-fe',gitRepository:'https://example.test/shop-fe2.git'},
    },
    work:{ownerRole:'be',pathFromRepository:'.starciwork'},
  }));
  const stub=path.join(dir,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,STARCI_SOURCE_ROOT:source,
    STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(dir,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(dir,'state.json'),
    LOCALAPPDATA:path.join(dir,'localappdata'),STARCI_PROJECTS_ROOT:path.join(dir,'projects'),
    STARCI_TEST_MACHINE_FILE:path.join(dir,'machine.sqlite')};
  const api=(...args)=>{
    const r=spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
    let body=null;try{body=JSON.parse(r.stdout);}catch{}
    return {r,body};
  };
  const enqueue=(jobId,op,owned)=>{
    const ledger=openLedger({file:ledgerFileFor(be,{env})});
    // Op jobs are unit tries now: the fixture seeds the unit and keeps the workflow running for dispatch.
    try{seedWorkflow(ledger,{id:'wf-dispatch-target',jobs:[{jobId,opId:op,payload:{opId:op,owned_paths:owned}}]});}
    finally{ledger.close();}
    return jobId;
  };
  const contractOf=jobId=>{
    const l=inspectLedger({file:ledgerFileFor(be,{env})});
    try{
      const job=l.db.prepare('SELECT op_id,status FROM jobs WHERE job_id=?').get(jobId);
      // Contracts are keyed by attempt_id (each redispatch keeps its own); job_id reads the newest.
      const row=l.db.prepare('SELECT markdown,context_json FROM contracts WHERE job_id=? ORDER BY attempt_id DESC').get(jobId);
      return {status:job.status,markdown:row.markdown,packet:JSON.parse(row.context_json).packet};
    }finally{l.close();}
  };
  // api report reads the envelope only from the attempt's STARCI_JOB_SCRATCH (op_attempts.scratch_dir).
  const scratchOf=jobId=>{
    const l=inspectLedger({file:ledgerFileFor(be,{env})});
    try{return l.db.prepare('SELECT scratch_dir FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId)?.scratch_dir;}
    finally{l.close();}
  };
  return {be,fe,api,enqueue,contractOf,scratchOf};
};

test('an owner-repo path spelled <owner-name>/… reaches the worker bare, and its report is accepted',t=>{
  const {be,api,enqueue,contractOf,scratchOf}=fixture(t);
  const jobId=enqueue('op-owner-name','backend.scaffold',['shop-next/src/main.ts','.starciwork/features/base/assets/r2']);
  const d=api('dispatch','--repo',be,'--job',jobId,'--spawn','--json');
  assert.equal(d.r.status,0,d.r.stderr||d.r.stdout);
  const {status,markdown,packet}=contractOf(jobId);
  assert.equal(status,'running');
  const main=packet.context.owned_paths.find(p=>p.declared==='shop-next/src/main.ts');
  assert.equal(main.path,'src/main.ts');
  assert.equal(main.repository,'be');
  assert.equal(slash(main.root),slash(be));
  assert.match(markdown,/owned_paths: src\/main\.ts, \.starciwork\/features\/base\/assets\/r2/);
  assert.doesNotMatch(markdown,/owned_paths: [^\n]*shop-next\/src/,'the owner repo gets no <repo>/ prefix');
  assert.match(markdown,new RegExp(`writes_in: ${esc(be)} \\(repository be\\)`));

  const scratch=scratchOf(jobId);
  assert.ok(scratch,'dispatch records the attempt scratch dir');
  fs.mkdirSync(scratch,{recursive:true});
  const file=path.join(scratch,'report.json');
  fs.writeFileSync(file,json({outcome:'blocked',summary:'needs more',files:['src/main.ts'],blocker:{kind:'authority',detail:'more files'}}));
  const rep=api('report','--repo',be,'--job',jobId,'--report',file,'--json');
  assert.equal(rep.r.status,0,rep.r.stderr||rep.r.stdout);
});

test('a sibling-repo path spelled <fe-name>/… reaches the worker rooted at the bound fe checkout',t=>{
  const {be,fe,api,enqueue,contractOf}=fixture(t);
  const jobId=enqueue('op-fe-name','interface.scaffold',['shop-fe/package.json','shop-fe/src/app','.starciwork/features/base/impl/fe/assets/cut-1']);
  const d=api('dispatch','--repo',be,'--job',jobId,'--spawn','--json');
  assert.equal(d.r.status,0,d.r.stderr||d.r.stdout);
  const {markdown,packet}=contractOf(jobId);
  const pkg=packet.context.owned_paths.find(p=>p.declared==='shop-fe/package.json');
  assert.deepEqual({path:pkg.path,repository:pkg.repository,root:slash(pkg.root)},{path:'package.json',repository:'fe',root:slash(fe)});
  assert.ok(markdown.includes(`owned_paths: ${slash(fe)}/package.json, ${slash(fe)}/src/app, .starciwork/features/base/impl/fe/assets/cut-1\n`),'the fe grant is the fe checkout, never <be>/shop-fe');
  assert.match(markdown,/writes_in: [^\n]*\(repository fe\)/);
  assert.equal(fs.existsSync(path.join(be,'shop-fe')),false);
});

test('placed in the fe checkout, fe paths are bare and Work paths are rooted at the Work owner',t=>{
  const {be,fe,api,enqueue,contractOf}=fixture(t);
  const jobId=enqueue('op-fe-placed','interface.scaffold',['shop-fe/package.json','.starciwork/features/base/impl/fe/assets/cut-1']);
  const d=api('dispatch','--repo',be,'--job',jobId,'--worktree',fe,'--spawn','--json');
  assert.equal(d.r.status,0,d.r.stderr||d.r.stdout);
  const {markdown}=contractOf(jobId);
  assert.ok(markdown.includes(`owned_paths: package.json, ${slash(be)}/.starciwork/features/base/impl/fe/assets/cut-1\n`),markdown);
});

test('an unbound ledger keeps today\'s packet: owned paths verbatim, no writes_in',t=>{
  const {be,api,enqueue,contractOf}=fixture(t,{bound:false});
  const jobId=enqueue('op-unbound','backend.scaffold',['shop-next/src/main.ts']);
  const d=api('dispatch','--repo',be,'--job',jobId,'--spawn','--json');
  assert.equal(d.r.status,0,d.r.stderr||d.r.stdout);
  const {markdown,packet}=contractOf(jobId);
  assert.deepEqual(packet.context.owned_paths,[{path:'shop-next/src/main.ts'}]);
  assert.match(markdown,/owned_paths: shop-next\/src\/main\.ts\n/);
  assert.doesNotMatch(markdown,/writes_in:/);
});
