import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {seedWorkflow} from './_ledger-fixture.mjs';

// nivo inc-c1d5bdbea173 (2026-09-25, Collab): the Kernel wrapped `api dispatch --job
// op-backend.implement-dd957e8395 --spawn` in a shell `timeout 115`, which killed the api mid-spawn. The row
// stayed leased with no worker and no terminal: reconcile --drop refused drop-not-queued, --dead-worker
// refused dead-worker-not-running, dispatch refused job-not-queued. The lease deadline (jobs.deadline,
// dispatchLeaseTtlMs after the lease) existed, but nothing read it. A leased job with no worker is now a
// launch in flight until that deadline and `launch-abandoned` after it: status reads it worker-dead and
// reconcile --dead-worker returns it to queued (or settles it) like any dead worker.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

const fixture=(t,{deadline,launchTerminal=null})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-leased-abandoned-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  fs.writeFileSync(path.join(repo,'docs','a.md'),'# a\n');fs.writeFileSync(path.join(repo,'.gitignore'),'.starciwork/\n');
  const git=(...a)=>spawnSync('git',['-C',repo,'-c','user.email=spec@starci','-c','user.name=spec',...a],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_AUTHOR_DATE:'2026-01-01T00:00:00Z',GIT_COMMITTER_DATE:'2026-01-01T00:00:00Z'}});
  git('init','-q');git('add','-A');git('commit','-qm','base');
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json');
  if(launchTerminal)fs.writeFileSync(stateFile,JSON.stringify({sends:0,terminals:{[launchTerminal]:{handle:launchTerminal,connected:true,writable:true}}}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:stateFile};
  const api=args=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const workflowId='wf-leased-abandoned',jobId='job-leased-abandoned';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    // The kernel worker runs; the op job is seeded 'ready' (the attempt row is written only after
    // spawnAgent returns a terminal, so a dispatch killed mid-spawn leaves none) — or 'leased' when
    // the kill came after fileContract, which a settle path must read as dispatched.
    seedWorkflow(ledger,{id:workflowId,jobs:[
      {jobId:`kernel-${workflowId}`,kind:'kernel',role:'kernel',status:'running',workerId:'fake-kernel-terminal',
        payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}},
      {jobId,opId:'code.refactor',status:launchTerminal?'leased':'ready',leaseToken:'tok-killed',
        payload:{opId:'code.refactor',owned_paths:['docs/'],model:'devin-agent',difficulty:'medium'}}]});
    // What the killed dispatch left: leased (ready→leased is the lease transition), its path lease
    // taken, no worker, no terminal, no contract.
    const at=Date.now()-40*60000;
    ledger.db.prepare("INSERT OR IGNORE INTO resources(resource_key,capacity) VALUES('path:docs/',1)").run();
    ledger.db.prepare("UPDATE jobs SET status='leased',deadline=?,updated_at=? WHERE job_id=?").run(deadline,at,jobId);
    if(launchTerminal)ledger.db.prepare("UPDATE jobs SET payload_json=json_set(payload_json,'$.launchTerminal',json(?)) WHERE job_id=?").run(JSON.stringify({handle:launchTerminal,at}),jobId);
    const job=ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId);
    // leases_match_job: the row carries the job's identity (try_no, generation, token).
    ledger.db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,try_no,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)')
      .run('path:docs/',jobId,workflowId,'code.refactor',job.try_no,job.generation,'tok-killed',1,at,deadline);
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const status=()=>{const out=json(api(['status','--workflow',workflowId]).stdout);return {out,worker:out.workers.find(w=>w.jobId===jobId)};};
  const orcaState=()=>json(fs.readFileSync(stateFile,'utf8'))??{};
  return {api,jobId,read,status,orcaState};
};

test('a leased job with no worker is a launch in flight until its lease deadline',t=>{
  const fx=fixture(t,{deadline:Date.now()+10*60000});
  const {out,worker}=fx.status();
  assert.equal(worker.liveness,'launching',JSON.stringify(worker));
  assert.notEqual(out.frontier.state,'worker-dead');
  const r=fx.api(['reconcile','--job',fx.jobId,'--dead-worker','--settle-failed']);
  assert.equal(r.status,1);
  assert.equal(json(r.stdout).reason,'dispatch-in-flight');
  assert.equal(fx.read(db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(fx.jobId).status),'leased','nothing written');
});

test('past its lease deadline it is launch-abandoned: worker-dead, and reconcile --dead-worker requeues it',t=>{
  const fx=fixture(t,{deadline:Date.now()-10*60000});
  const {out,worker}=fx.status();
  assert.equal(worker.liveness,'launch-abandoned',JSON.stringify(worker));
  assert.equal(out.frontier.state,'worker-dead');
  assert.deepEqual(out.frontier.deadWorkerJobs,[fx.jobId]);
  const r=fx.api(['reconcile','--job',fx.jobId,'--dead-worker','--settle-failed']);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual([json(r.stdout).recovery,json(r.stdout).status,json(r.stdout).attemptConsumed],['requeued','queued',false],r.stdout);
  assert.deepEqual(fx.read(db=>[db.prepare('SELECT status FROM jobs WHERE job_id=?').get(fx.jobId).status,
    db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(fx.jobId).n]),['queued',0]);
});

test('the driver loop forbids bounding an api call with a shell timeout',async()=>{
  const {parseYaml}=await import('../engine/yaml.mjs');
  const rule=parseYaml(fs.readFileSync(path.join(ROOT,'modules','kernel','driver-loop.yaml'),'utf8')).boundary.apiCallsRunToEnd;
  assert.match(rule,/Never wrap an api call \(`api dispatch --spawn` above all\) in a shell\s+`timeout`/);
});

// nivo inc-e523617a3c31: a job settled failed while the terminal its killed dispatch created was still
// live, and nothing in the ledger named that terminal. Dispatch records the handle the moment the terminal
// exists (payload.launchTerminal); reconcile --dead-worker and settle quit and close it.
test('the terminal a killed dispatch created is closed by reconcile --dead-worker',t=>{
  const fx=fixture(t,{deadline:Date.now()-10*60000,launchTerminal:'term-orphan'});
  assert.equal(fx.status().worker.launchTerminal,'term-orphan');
  const r=fx.api(['reconcile','--job',fx.jobId,'--dead-worker','--settle-failed']);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.deepEqual([json(r.stdout).terminalClosed?.handle,json(r.stdout).terminalClosed?.closed],['term-orphan',true]);
  assert.ok((fx.orcaState().closed??[]).includes('term-orphan'));
});

test('settle of a leased job closes the terminal its dispatch created',t=>{
  const fx=fixture(t,{deadline:Date.now()+10*60000,launchTerminal:'term-orphan'});
  const r=fx.api(['settle','--job',fx.jobId,'--verdict','fail']);
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.ok((fx.orcaState().closed??[]).includes('term-orphan'),JSON.stringify(fx.orcaState()));
});

test('spawnAgent hands the caller the terminal handle before it waits on the launch',async t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-on-created-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const r=spawnSync(process.execPath,['--input-type=module','-e',`
    import {spawnAgent} from ${JSON.stringify(new URL('../scripts/agent/lib.mjs',import.meta.url).href)};
    const seen=[];
    const out=spawnAgent({provider:'devin',worktree:${JSON.stringify(root)},title:'t',dispatchId:'j1',onCreated:(h)=>seen.push(h)});
    console.log(JSON.stringify({seen,ok:out.ok,step:out.step,terminal:out.terminal}));`],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env:{...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
      STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),STARCI_FAKE_ORCA_MODE:'auth'}});
  const out=json(r.stdout.trim().split(/\r?\n/).at(-1));
  assert.ok(out,r.stdout+r.stderr);
  assert.equal(out.ok,false,'the launch itself fails at readiness');
  assert.deepEqual(out.seen,[out.terminal],'the handle reached the caller before the readiness wait');
});
