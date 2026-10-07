import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';
import {fakeDevinQuotaEnv} from '../helpers/fake-devin-quota.mjs';
import {inspectLedger,ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {withMachine} from '../../engine/db/machine.mjs';
import {publishThrottle} from '../../scripts/machine/ram-throttle.mjs';
import {placeOnRepo} from '../helpers/op-placement.mjs';
import {addWorkflowWorktree} from '../helpers/workflow-worktree-row.mjs';
import {adoptLaunchTrust} from '../helpers/launch-trust.mjs';
// Attestation/settle waits are counted logically; scaled down they cost milliseconds, not load-dependent seconds.
process.env.STARCI_SLEEP_SCALE??='0.02';

// Spec item 3: `starci kernel dispatch --spawn` refuses on a host below allocation.resources.minFreeDiskGb /
// minFreeRamPct with the typed reason host-resources-low — a WAIT like path-lease (waiting:true, the
// job stays queued, no leases and no dispatch-rejected event), never a failure. Each dispatch
// re-probes, so once there is room again the very next attempt launches (auto-recovery). The probe is
// driven through the STARCI_HOST_RESOURCES_JSON seam (scripts/machine/host-resources.mjs) whose numbers
// are judged against the real thresholds.

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const WORKFLOW='wf-host-resources';
const LIGHT_WORKFLOW='wf-host-resources-light';
const OP='code.refactor';
const HOST_ENV='STARCI_HOST_RESOURCES_JSON';

const git=(cwd,...args)=>{
  const r=spawnSync('git',['-C',cwd,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(r.status,0,`git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout.trim();
};
const write=(root,rel,body)=>{const abs=path.join(root,...rel.split('/'));fs.mkdirSync(path.dirname(abs),{recursive:true});fs.writeFileSync(abs,body);};
const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-host-res-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  if(process.env.STARCI_TEST_TEMP_DIR)t.after(()=>fs.rmSync(path.join(process.env.STARCI_TEST_TEMP_DIR,'starci-job-scratch'),
    {recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');
  fs.mkdirSync(repo,{recursive:true});
  git(repo,'init','--quiet');
  git(repo,'config','user.email','lane@starci.test');
  git(repo,'config','user.name','lane');
  git(repo,'config','core.autocrlf','false');
  git(repo,'checkout','--quiet','-b','main');
  write(repo,'.gitignore','.starciwork/\n');
  write(repo,'apps/app/src/messages/en.json','{}\n');
  git(repo,'add','-A');
  const past='2020-01-01T00:00:00Z';
  const c=spawnSync('git',['-C',repo,'commit','--quiet','-m','seed'],{encoding:'utf8',windowsHide:true,env:{...process.env,GIT_AUTHOR_DATE:past,GIT_COMMITTER_DATE:past}});
  assert.equal(c.status,0,c.stderr);
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const env={...process.env,...fakeDevinQuotaEnv(t,path.join(root,'appdata')),
    STARCI_ORCA_COMMAND:process.execPath,
    STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_MODE:'healthy',
    STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),
    STARCI_FAKE_ORCA_STATE:path.join(root,'state.json'),
    STARCI_LOCAL_ROOT:path.join(root,'localappdata'),
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),
    ...adoptLaunchTrust(root,{roots:[repo],ref:'private host-resources fixture adoption'}),
  };
  const run=(extraEnv,...args)=>spawnSync(process.execPath,[API,...placeOnRepo(args,treeOfJob(args[args.indexOf('--job')+1])),'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:180000,env:{...env,...extraEnv}});
  const trees=new Map([WORKFLOW,LIGHT_WORKFLOW].map(wf=>[wf,addWorkflowWorktree({repo,workflowId:wf,env}).path]));
  const treeOfJob=job=>trees.get(inspect(db=>db.prepare('SELECT workflow_id FROM jobs WHERE job_id=?').get(job)?.workflow_id));
  const withWrite=fn=>{const l=openLedger({file:ledgerFileFor(repo,{env})});try{return fn(l);}finally{l.close();}};
  withWrite(l=>{
    // Every unit belongs to an approved goal revision. LIGHT_WORKFLOW holds the light op: the fake Orca answers one
    // dispatch id, unique per workflow in op_attempts.
    for(const wf of [WORKFLOW,LIGHT_WORKFLOW]){
      l.ensureWorkflow({workflowId:wf,title:'host resources'});
      l.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(wf);
      l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)').run(wf,0,'host resources','# goal','{}',Date.now());
    }
  });
  const inspect=fn=>{const l=inspectLedger({file:ledgerFileFor(repo,{env})});try{return fn(l.db);}finally{l.close();}};
  const machine=fn=>withMachine(fn,{env});
  return {root,repo,run,inspect,withWrite,machine};
};
const leading=stdout=>{
  const open=stdout.indexOf('{'),close=stdout.indexOf('\n}');
  return JSON.parse(close<0?stdout.slice(open):stdout.slice(open,close+2));
};
const DRIVE=(root=>root.replace(/[\\/]+$/,'')||root)(path.parse(os.tmpdir()).root),LOW_DISK=JSON.stringify({drives:[{drive:DRIVE,path:`${DRIVE}\\Temp`,freeDiskGb:0.5}],totalRamBytes:64e9,freeRamBytes:60e9});
const LOW_RAM=JSON.stringify({freeDiskGb:500,freeRamPct:3});
const ROOMY=JSON.stringify({freeDiskGb:500,totalRamBytes:64e9,freeRamBytes:60e9});

test('a low disk refuses the spawn as a typed wait: host-resources-low, queued, no leases, nothing recorded',t=>{
  const fx=fixture(t);
  const job=leading(fx.run({},'enqueue','--workflow',WORKFLOW,'--op',OP,'--paths','apps/app/src/messages').stdout).job_id;
  const events=()=>fx.inspect(db=>db.prepare("SELECT kind FROM events WHERE entity_id=? AND kind IN ('dispatch-rejected','route-decided','op-dispatched')").all(job).map(r=>r.kind));

  for(const attempt of [1,2]){
    const d=fx.run({[HOST_ENV]:LOW_DISK},'dispatch','--job',job,'--model','devin-agent','--spawn');
    assert.notEqual(d.status,0,`dispatch ${attempt} does not launch on a starved host`);
    const body=leading(d.stdout);
    assert.equal(body.reason,'host-resources-low');
    assert.equal(body.waiting,true);
    assert.equal(body.rejected,undefined,'a host wait is never a dispatch rejection');
    assert.equal(body.host.ok,false);
    assert.equal(body.host.lowDisk,true);
    assert.equal(body.host.lowRam,false);
    assert.equal(body.host.drive,DRIVE);
    assert.equal(body.host.freeDiskGb,0.5);
    assert.deepEqual(body.host.thresholds,{minFreeDiskGb:5,minFreeRamPct:10});
    assert.match(body.detail,new RegExp(`drive ${DRIVE} has 0\\.5 GB free`));
    assert.match(body.detail,/do not re-dispatch it by hand/);
  }
  assert.deepEqual(events(),[],'no dispatch-rejected or op-dispatched event for the waiting job');
  assert.equal(fx.inspect(db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job).status),'queued');
  assert.deepEqual(fx.inspect(db=>db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(job)),[],'a waiting job holds nothing');

  // Auto-recovery is just the next dispatch: the probe sees room again and the job launches.
  const now=fx.run({[HOST_ENV]:ROOMY},'dispatch','--job',job,'--model','devin-agent','--spawn');
  assert.equal(now.status,0,`room again, the same job dispatches: ${now.stderr||now.stdout}`);
  assert.equal(fx.inspect(db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job).status),'running');
  assert.deepEqual(events().filter(k=>k==='dispatch-rejected'),[]);
});

test('a low RAM refuses with lowRam in the probe numbers',t=>{
  const fx=fixture(t);
  const job=leading(fx.run({},'enqueue','--workflow',WORKFLOW,'--op',OP,'--paths','apps/app/src/messages').stdout).job_id;
  const d=fx.run({[HOST_ENV]:LOW_RAM},'dispatch','--job',job,'--model','devin-agent','--spawn');
  assert.notEqual(d.status,0);
  const body=leading(d.stdout);
  assert.equal(body.reason,'host-resources-low');
  assert.equal(body.waiting,true);
  assert.equal(body.host.lowRam,true);
  assert.equal(body.host.lowDisk,false);
  assert.equal(body.host.freeRamPct,3);
  assert.match(body.detail,/RAM 3\.0% free/);
  assert.equal(fx.inspect(db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(job).status),'queued');
  assert.deepEqual(fx.inspect(db=>db.prepare('SELECT resource_key FROM leases WHERE job_id=?').all(job)),[]);
});

test('a host with room proceeds: the packet, leases and spawn all land',t=>{
  const fx=fixture(t);
  const job=leading(fx.run({},'enqueue','--workflow',WORKFLOW,'--op',OP,'--paths','apps/app/src/messages').stdout).job_id;
  const d=fx.run({[HOST_ENV]:ROOMY},'dispatch','--job',job,'--model','devin-agent','--spawn');
  assert.equal(d.status,0,`a roomy host dispatches: ${d.stderr||d.stdout}`);
  const body=leading(d.stdout);
  assert.equal(body.ok,true);
  assert.ok(fx.inspect(db=>db.prepare('SELECT COUNT(*) n FROM leases WHERE job_id=?').get(job).n)>0,'the lease rows exist');
  assert.ok(fx.inspect(db=>db.prepare("SELECT COUNT(*) n FROM events WHERE entity_id=? AND kind='op-dispatched'").get(job).n)>0,'the dispatch is recorded');
});

// The RAM-aware throttle (scripts/machine/ram-throttle.mjs, owner ruling 2026-09-28) on the same wait: at 12% free RAM
// of a 68.6 GB host a heavy op (code.refactor) waits host-resources-low with the numbers and a dispatch-throttled
// event, while a light op (docs.author) still launches; the hysteresis keeps the heavy one waiting at 18%.
const GB=1024**3;
const RAM_AT=(pct,extra={})=>JSON.stringify({freeDiskGb:500,totalRamBytes:68.6*GB,freeRamBytes:68.6*GB*pct/100,cpuBusy:0.6,...extra});

test('under 10% free RAM a heavy op waits with a dispatch-throttled event; a light op still launches',t=>{
  const fx=fixture(t);
  const heavy=leading(fx.run({},'enqueue','--workflow',WORKFLOW,'--op',OP,'--paths','apps/app/src/messages').stdout).job_id;
  const d=fx.run({[HOST_ENV]:RAM_AT(8)},'dispatch','--job',heavy,'--model','devin-agent','--spawn');
  assert.notEqual(d.status,0);
  const body=leading(d.stdout);
  assert.equal(body.reason,'host-resources-low');
  assert.equal(body.waiting,true);
  assert.equal(body.throttle.reason,'heavy-paused');
  assert.equal(body.throttle.class,'heavy');
  assert.equal(body.throttle.mode,'heavy-paused');
  assert.equal(body.throttle.freeRamPct,8);
  assert.equal(body.throttle.maxParallelOps,20);
  assert.match(body.detail,/RAM 8\.0% free, effective cap \d+\/20/);
  const events=fx.inspect(db=>db.prepare("SELECT kind,payload_json FROM events WHERE entity_id=? AND kind IN ('dispatch-throttled','dispatch-rejected')").all(heavy));
  assert.deepEqual(events.map(e=>e.kind),['dispatch-throttled']);
  assert.equal(JSON.parse(events[0].payload_json).reason,'heavy-paused');
  assert.equal(fx.inspect(db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(heavy).status),'queued');
  // 13% is back over the 10% floor but under the 15% resume line: the hysteresis is the Resource controller's (the one
  // writer of the mode); while its published mode is heavy-paused, the heavy op still waits.
  const held=fx.machine(m=>m.db.prepare('SELECT job_id,reason,released_at FROM throttle_decisions').all());
  assert.deepEqual(held.map(r=>[r.job_id,r.reason,r.released_at]),[[heavy,'heavy-paused',null]],'the held op is an open throttle_decisions row');
  fx.machine(m=>publishThrottle(m,{mode:'heavy-paused',why:'free RAM 8% < 10%',writer:'reconciler/resource'}));
  const again=fx.run({[HOST_ENV]:RAM_AT(13)},'dispatch','--job',heavy,'--model','devin-agent','--spawn');
  assert.notEqual(again.status,0);
  assert.equal(leading(again.stdout).throttle.reason,'heavy-paused');

  const light=leading(fx.run({},'enqueue','--workflow',LIGHT_WORKFLOW,'--op','docs.author','--paths','docs').stdout).job_id;
  const l=fx.run({[HOST_ENV]:RAM_AT(8)},'dispatch','--job',light,'--model','devin-agent','--spawn');
  assert.equal(l.status,0,`a light op launches under the heavy pause: ${l.stderr||l.stdout}`);
  assert.equal(fx.inspect(db=>db.prepare('SELECT status FROM jobs WHERE job_id=?').get(light).status),'running');

  // At 20%, above the 15% resume line, the controller publishes normal again and the heavy op launches.
  fx.machine(m=>publishThrottle(m,{mode:'normal',why:'free RAM 20%',writer:'reconciler/resource'}));
  const back=fx.run({[HOST_ENV]:RAM_AT(20)},'dispatch','--job',heavy,'--model','devin-agent','--spawn');
  assert.equal(back.status,0,`above the resume line the heavy op dispatches: ${back.stderr||back.stdout}`);
  const decisions=fx.machine(m=>m.db.prepare('SELECT job_id,released_at,waited_ms FROM throttle_decisions').all());
  assert.equal(decisions.length,1,'one row per held job, however often it re-probed');
  assert.ok(decisions[0].released_at!=null&&decisions[0].waited_ms>=0,'admitted: released with its wait');
  assert.deepEqual(fx.machine(m=>m.db.prepare('SELECT from_mode,to_mode FROM throttle_events ORDER BY seq').all().map(e=>[e.from_mode,e.to_mode])),[[null,'heavy'],['heavy','normal']]);
});
