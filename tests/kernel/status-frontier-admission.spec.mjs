import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {ledgerFileFor,openLedger,inspectLedger,recordJobResult,setJobStatus} from '../../engine/db/ledger.mjs';
import {withMachine} from '../../engine/db/machine.mjs';
import {writeProviderCircuit} from '../../scripts/machine/provider-circuit.mjs';
process.env.STARCI_SLEEP_SCALE??='0.02';

// The frontier projection must agree with dispatch admission for EVERY job dispatch can launch
// (kprop-8d86bcc70b / kprop-c0abd30d86). A proven no-effect dispatch rejection or an effect_unknown
// reconcile keeps the same candidate at status 'ready' (cli.mjs requeueRejectedJob, route.mjs
// routableJobOrThrow admits 'queued' and 'ready' alike) — but the frontier built its queued list
// from 'queued' rows only, so a reusable job vanished: engaged, actionable false, readyOperations 0,
// no dispatch in nextActions, and nothing woke the Kernel when the wait lapsed. Status and dispatch
// share the one admission verdict (queuedBecauseOf: owner gates, plan order, slots, provider circuit,
// path leases, pool load, the host probe): a ready job under an open circuit or a starved host reads
// the typed wait with the expiry or the measured numbers, not ready and not actionable, and reads
// ready again once the machine condition clears.

const ROOT=path.resolve(import.meta.dirname,'..','..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const WORKFLOW='wf-frontier-admission';
const OP='code.refactor';
const HOST_ENV='STARCI_HOST_RESOURCES_JSON';

const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write=(root,rel,body)=>{const abs=path.join(root,...rel.split('/'));fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,body);};
const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-frontier-adm-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');
  fs.mkdirSync(repo,{recursive:true});
  git(repo,'init','--quiet');
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  write(repo,'.gitignore','.starciwork/\n');
  write(repo,'apps/app/src/messages/en.json','{}\n');
  write(repo,'apps/app/src/other/en.json','{}\n');
  git(repo,'add','-A');
  const past='2020-01-01T00:00:00Z';
  const c=spawnSync('git',['-C',repo,'commit','--quiet','-m','seed'],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_AUTHOR_DATE:past,GIT_COMMITTER_DATE:past}});
  assert.equal(c.status,0,c.stderr);
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_LOCAL_ROOT:path.join(root,'localappdata'),
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),
  };
  const run=(extraEnv,...args)=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env:{...env,...extraEnv}});
  const withWrite=fn=>{const l=openLedger({file:ledgerFileFor(repo,{env})});try{return fn(l);}finally{l.close();}};
  const inspect=fn=>{const l=inspectLedger({file:ledgerFileFor(repo,{env})});try{return fn(l.db);}finally{l.close();}};
  const machine=fn=>withMachine(fn,{env});
  withWrite(l=>{
    l.ensureWorkflow({workflowId:WORKFLOW,title:'frontier admission'});
    l.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(WORKFLOW);
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(WORKFLOW,0,'frontier admission','# goal','{}',Date.now());
  });
  return {root,repo,env,run,withWrite,inspect,machine};
};
const leading=stdout=>{
  const open=stdout.indexOf('{'),close=stdout.indexOf('\n}');
  return JSON.parse(close<0?stdout.slice(open):stdout.slice(open,close+2));
};
const status=(fx,extraEnv={})=>{
  const r=fx.run(extraEnv,'status','--workflow',WORKFLOW);
  assert.equal(r.status,0,`status: ${r.stderr||r.stdout}`);
  return leading(r.stdout);
};
const enqueue=(fx,paths='apps/app/src/messages')=>{
  const r=fx.run({},'enqueue','--workflow',WORKFLOW,'--op',OP,'--paths',paths);
  assert.equal(r.status,0,`enqueue: ${r.stderr||r.stdout}`);
  return leading(r.stdout).job_id;
};
// The durable shape rejectDispatch leaves behind: jobs.status 'ready', the no-effect result on the job.
const rejectedToReady=(fx,job,{model=null}={})=>fx.withWrite(l=>{
  if(model){
    const payload={...JSON.parse(l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(job).payload_json),model};
    l.db.prepare('UPDATE jobs SET payload_json=? WHERE job_id=?').run(JSON.stringify(payload),job);
  }
  setJobStatus(l.db,{jobId:job,to:'ready',reason:'dispatch-rejected:admission'});
  recordJobResult(l.db,{jobId:job,result:{reason:'dispatch-rejected',step:'admission',error:'no-eligible-candidate',effectState:'none',attemptConsumed:false,retryable:true}});
});

const DRIVE=(root=>root.replace(/[\\/]+$/,'')||root)(path.parse(os.tmpdir()).root);
const LOW_DISK=JSON.stringify({drives:[{drive:DRIVE,path:`${DRIVE}\\Temp`,freeDiskGb:0.5}],totalRamBytes:64e9,freeRamBytes:60e9});
const ROOMY=JSON.stringify({freeDiskGb:500,totalRamBytes:64e9,freeRamBytes:60e9});

test('a job a no-effect dispatch rejection returned to ready is still the Kernel\'s to move: queued, ready, actionable',t=>{
  const fx=fixture(t);
  const job=enqueue(fx);
  rejectedToReady(fx,job);
  assert.equal(fx.inspect(db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job).status),'ready');
  const s=status(fx);
  const item=s.frontier.queued.find((q)=>q.jobId===job);
  assert.ok(item,'the reusable job stays in frontier.queued — an unlisted ready job stalled silently');
  assert.equal(item.queuedBecause,'ready');
  assert.equal(s.frontier.readyOperations,1,'a ready job counts in readyOperations');
  assert.equal(s.frontier.actionable,true,'it is the Kernel\'s move, so the watchdog wakes it');
  assert.ok(s.nextActions.some((a)=>a.kind==='dispatch'&&a.jobId===job),'nextActions names the dispatch');
});

test('a ready job an open provider circuit holds reads circuit-open with the expiry, actionable only once it clears',t=>{
  const fx=fixture(t);
  const job=enqueue(fx);
  const queuedPeer=enqueue(fx,'apps/app/src/other');
  for(const j of [job,queuedPeer])fx.withWrite(l=>{
    const payload={...JSON.parse(l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(j).payload_json),model:'claude-agent'};
    l.db.prepare('UPDATE jobs SET payload_json=? WHERE job_id=?').run(JSON.stringify(payload),j);
  });
  rejectedToReady(fx,job);
  const until=Date.now()+120000;
  fx.machine(m=>writeProviderCircuit('claude',{machine:m,expiresAt:until,
    value:{schema:'starci/provider-health@1',provider:'claude',status:'unavailable',failureKind:'worker-start',strikes:2,failures:2,cooldownMs:120000,observedAt:Date.now(),detail:'worker-start refused'}}));
  const held=status(fx);
  for(const j of [job,queuedPeer]){
    const item=held.frontier.queued.find((q)=>q.jobId===j);
    assert.equal(item?.queuedBecause,'circuit-open',`${j} (${j===job?'ready':'queued'}) reads the same typed provider wait`);
    assert.deepEqual(item.blockedBy,{provider:'claude',pool:'claude-agent'});
    assert.ok(item.detail.includes(new Date(until).toISOString().slice(0,10))||item.detail.includes(String(until)),'the wait carries its expiry');
  }
  assert.equal(held.frontier.queuedCauses['circuit-open'],2);
  assert.equal(held.frontier.readyOperations,0,'a machine wait is not work the Kernel can do');
  assert.equal(held.frontier.actionable,false,'the watchdog stops waking the Kernel for a provider wait');
  assert.equal(held.nextActions.filter((a)=>a.kind==='dispatch').length,0,'no dispatch action while the circuit is open');
  assert.ok(held.nextActions.some((a)=>a.kind==='wait'&&a.jobId===job&&a.reason.startsWith('circuit-open')));

  // The cooldown lapsing is the only change the wait needs: the next status reads both jobs ready again.
  fx.machine(m=>m.db.prepare('UPDATE provider_health SET circuit_open_until=? WHERE provider=?').run(Date.now()-1,'claude'));
  const clear=status(fx);
  for(const j of [job,queuedPeer])
    assert.equal(clear.frontier.queued.find((q)=>q.jobId===j)?.queuedBecause,'ready',`${j} is ready the moment the circuit expires`);
  assert.equal(clear.frontier.readyOperations,2);
  assert.equal(clear.frontier.actionable,true);
  assert.ok(clear.nextActions.some((a)=>a.kind==='dispatch'&&a.jobId===job),'the wait becomes a dispatch again');
});

test('a ready job dispatch would refuse host-resources-low reads as that typed wait, ready again with room',t=>{
  const fx=fixture(t);
  const job=enqueue(fx);
  rejectedToReady(fx,job);
  const held=status(fx,{[HOST_ENV]:LOW_DISK});
  const item=held.frontier.queued.find((q)=>q.jobId===job);
  assert.equal(item?.queuedBecause,'host-resources-low','the reusable job shares the dispatch verdict, not ready');
  assert.equal(item.blockedBy.drive,DRIVE);
  assert.equal(item.blockedBy.freeDiskGb,0.5);
  assert.equal(held.frontier.readyOperations,0);
  assert.equal(held.frontier.actionable,false,'a host wait is not the Kernel\'s move');
  const room=status(fx,{[HOST_ENV]:ROOMY});
  assert.equal(room.frontier.queued.find((q)=>q.jobId===job)?.queuedBecause,'ready');
  assert.equal(room.frontier.readyOperations,1);
  assert.equal(room.frontier.actionable,true,'with room the job reads ready and wakes the Kernel');
});
