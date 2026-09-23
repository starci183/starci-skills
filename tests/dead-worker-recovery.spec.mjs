import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';

// A host shutdown kills every Orca terminal while the ledger still says an op
// is running. These specs pin the saga recovery:
//   - a running job whose exact terminal is disconnected, or whose handle a
//     live Orca no longer knows (terminal_handle_stale), makes the frontier
//     'worker-dead' and actionable - it no longer reads a silent 'engaged';
//   - api reconcile --dead-worker returns a provably no-effect attempt to
//     queued at the SAME attempt (no business attempt spent), releasing leases;
//   - a filed report takes the ordinary consume/check/settle route, unwritten;
//   - an uncommitted change or a commit on the owned paths fences it
//     effect_unknown with that evidence, leases held;
//   - a live worker is never recovered.

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const WF='wf-dead-worker',JOB='job-dead-worker',HANDLE='term-dead-worker',OP='docs.author';
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const HOUR=3600*1000;

const git=(cwd,args,env={})=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true,env:{...process.env,
    GIT_AUTHOR_NAME:'spec',GIT_AUTHOR_EMAIL:'spec@example.invalid',GIT_COMMITTER_NAME:'spec',GIT_COMMITTER_EMAIL:'spec@example.invalid',...env}});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};

// One world: a git repo that owns the ledger, docs/ committed an hour before
// the dispatch, the fake Orca with the op's terminal record in `terminal`
// ({connected:false} dead, {stale:true} unknown to Orca, null live).
const world=(t,fn,{terminal={connected:false,writable:false}}={})=>withLedger(t,({root,repoRoot,machineHome,ledger})=>{
  git(repoRoot,['init','-q']);
  fs.writeFileSync(path.join(repoRoot,'.gitignore'),'.starciwork/\n');
  fs.mkdirSync(path.join(repoRoot,'docs'),{recursive:true});
  fs.writeFileSync(path.join(repoRoot,'docs','readme.md'),'# docs\n');
  const past=new Date(Date.now()-HOUR).toISOString();
  git(repoRoot,['add','-A']);
  git(repoRoot,['commit','-q','-m','seed'],{GIT_AUTHOR_DATE:past,GIT_COMMITTER_DATE:past});
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'orca-state.json');
  fs.writeFileSync(stateFile,JSON.stringify({sends:0,terminals:terminal?{[HANDLE]:{handle:HANDLE,...terminal}}:{}}));
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_STATE:stateFile,STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    LOCALAPPDATA:machineHome};
  delete env.ORCA_TERMINAL_HANDLE;delete env.STARCI_ROLE;delete env.STARCI_OP_JOB;
  const run=(...args)=>spawnSync(process.execPath,[API,...args,'--repo',repoRoot,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const dispatchedAt=Date.now()-60000;
  seedWorkflow(ledger,{id:WF,state:{phase:'running'},
    jobs:[{jobId:JOB,opId:OP,kind:'op',status:'running',attempt:1,workerId:HANDLE,leaseToken:'tok-dead-worker',createdAt:dispatchedAt,
      payload:{opId:OP,owned_paths:['docs/'],orca:{dispatchId:HANDLE,agentTerminalHandle:HANDLE},
        hierarchy:{runtime:{host:'orca',agent:'codex',dispatchId:HANDLE,terminalHandle:HANDLE}}}}],
    leases:[{resourceKey:'path:docs/',jobId:JOB,expiresAt:Date.now()+HOUR}]});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WF);
  ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WF,OP,1,HANDLE,'# dead worker contract','{}',dispatchedAt);
  const job=()=>ledger.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(JOB);
  const leases=()=>ledger.db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(JOB).n;
  const events=kind=>ledger.db.prepare('SELECT payload_json FROM events WHERE workflow_id=? AND entity_id=? AND kind=?').all(WF,JOB,kind);
  return fn({repoRoot,ledger,run,job,leases,events});
});

const status=run=>{const r=run('status','--workflow',WF);assert.equal(r.status,0,r.stderr||r.stdout);return out(r);};

test('a running job whose terminal disconnected makes the frontier worker-dead and actionable',t=>world(t,({run})=>{
  const body=status(run);
  assert.equal(body.frontier.state,'worker-dead');
  assert.equal(body.frontier.actionable,true);
  assert.deepEqual(body.frontier.deadWorkerJobs,[JOB]);
  assert.equal(body.workers.find(w=>w.jobId===JOB)?.liveness,'disconnected');
  assert.match(body.frontier.reason,/reconcile --job <id> --dead-worker/);
}));

test('a handle Orca answers terminal_handle_stale for (after a reboot) reads gone and is worker-dead',t=>world(t,({run})=>{
  const body=status(run);
  const worker=body.workers.find(w=>w.jobId===JOB);
  assert.equal(worker?.liveness,'gone');
  assert.equal(worker?.errorCode,'terminal_handle_stale');
  assert.equal(body.frontier.state,'worker-dead');
  assert.equal(body.frontier.actionable,true);
},{terminal:{stale:true}}));

test('a live worker keeps the frontier engaged and --dead-worker refuses it without writing',t=>world(t,({run,job,leases})=>{
  const body=status(run);
  assert.notEqual(body.frontier.state,'worker-dead');
  assert.deepEqual(body.frontier.deadWorkerJobs,[]);
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,1);
  assert.equal(out(r)?.reason,'worker-alive');
  assert.equal(job().status,'running');
  assert.equal(leases(),1);
},{terminal:null}));

test('a dead worker with no effect returns to queued at the same attempt, leases released, no business attempt spent',t=>world(t,({run,job,leases,events})=>{
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.equal(body.recovery,'requeued');
  assert.equal(body.attemptConsumed,false);
  assert.equal(body.effectState,'none');
  const row=job();
  assert.equal(row.status,'queued');
  assert.equal(row.attempt,1,'same attempt');
  assert.equal(row.worker_id,null);
  assert.equal(leases(),0);
  const payload=JSON.parse(row.payload_json);
  assert.equal(payload.orca?.agentTerminalHandle,undefined,'the dead terminal binding is cleared');
  assert.equal(payload.hierarchy.runtime.terminalHandle,undefined);
  assert.equal(payload.deadWorkers.length,1);
  assert.equal(payload.deadWorkers[0].recovery,'requeued');
  const result=JSON.parse(row.result_json);
  assert.equal(result.reason,'dead-worker-requeued');
  assert.equal(result.proof.paths.provable,true);
  assert.equal(events('dead-worker-requeued').length,1);
  const after=status(run);
  assert.notEqual(after.frontier.state,'worker-dead');
  assert.equal(after.frontier.readyOperations>0||after.frontier.queued.some(q=>q.jobId===JOB),true);
  const again=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(again.status,0);
  assert.equal(out(again).alreadyRecovered,true);
  assert.equal(events('dead-worker-requeued').length,1,'idempotent');
}));

test('a dead worker that filed a report goes the consume/check/settle route and nothing is written',t=>world(t,({run,ledger,job,leases,events})=>{
  ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(WF,HANDLE,OP,1,'done','{"outcome":"done"}',Date.now());
  const body=status(run);
  assert.equal(body.frontier.state,'transition-ready','the report outranks the dead worker');
  assert.deepEqual(body.frontier.deadWorkerJobs,[],'a job with a filed report is not dead-worker work');
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(out(r).route,'settle');
  assert.equal(out(r).report.outcome,'done');
  assert.equal(job().status,'running');
  assert.equal(leases(),1);
  assert.equal(events('dead-worker-requeued').length+events('dead-worker-fenced').length,0);
}));

test('an uncommitted change on the owned paths fences the job effect_unknown with the evidence, leases held',t=>world(t,({repoRoot,run,job,leases,events})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','half-written.md'),'partial\n');
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const body=out(r);
  assert.equal(body.recovery,'fenced');
  assert.equal(body.effectState,'partial');
  assert.ok(body.evidence.includes('dirty:docs/half-written.md'),JSON.stringify(body.evidence));
  assert.equal(job().status,'effect_unknown');
  assert.equal(job().attempt,1);
  assert.equal(leases(),1,'the fence keeps the owned-path lease');
  assert.equal(events('dead-worker-fenced').length,1);
  const plain=run('reconcile','--job',JOB);
  assert.equal(plain.status,1);
  assert.match(plain.stderr,/dead-worker-fenced/);
  assert.equal(status(run).frontier.actionable,true,'a fenced job stays the Kernel\'s to settle');
}));

test('a commit on the owned paths since dispatch fences the job even with a clean tree',t=>world(t,({repoRoot,run,job})=>{
  fs.writeFileSync(path.join(repoRoot,'docs','landed.md'),'landed\n');
  git(repoRoot,['add','-A']);
  git(repoRoot,['commit','-q','-m','worker commit']);
  const sha=git(repoRoot,['rev-parse','HEAD']);
  const r=run('reconcile','--job',JOB,'--dead-worker');
  assert.equal(r.status,0,r.stderr||r.stdout);
  assert.equal(out(r).recovery,'fenced');
  assert.ok(out(r).evidence.includes(`commit:${sha}`),JSON.stringify(out(r).evidence));
  assert.equal(job().status,'effect_unknown');
}));
