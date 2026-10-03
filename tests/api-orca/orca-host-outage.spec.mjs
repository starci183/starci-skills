import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,openLedger,ledgerFileFor,releaseKernelJob,recordJobResult,openIncident} from '../../engine/db/ledger.mjs';
import {FAKE_ORCA,MISSING_ORCA_COMMAND} from '../helpers/fake-orca.mjs';
import {hostUnavailableOf} from '../../scripts/api/orca/lib.mjs';
import {kernelTerminalVerdict,settledKernelVerdict,awaitOrcaHost} from '../../scripts/kernel/host-outage.mjs';

// 2026-09-24 02:37: Orca auto-updated and restarted. For about a minute the CLI
// answered runtime_unavailable and spawning orca.exe failed with ENOENT, while
// the terminal daemon kept every kernel alive. The watchdogs read it as dead
// kernels: five kernel jobs were stopped with their signals deleted, and one
// workflow got a second kernel beside its live one. An Orca outage is never a
// dead kernel; a live kernel worker whose seat was lost is left running, never duplicated.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const WATCHDOG=path.join(ROOT,'scripts','kernel','kernel-watchdog.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastJson=text=>json(String(text??'').trim().split('\n').filter(Boolean).at(-1));

/* ------------------------------------------------------------------ units */

test('an Orca that does not answer is host-unavailable; a typed refusal from a running Orca is not',()=>{
  assert.equal(hostUnavailableOf({status:null,spawnError:'ENOENT',error:'spawnSync orca.exe ENOENT'},null),true);
  assert.equal(hostUnavailableOf({status:null,spawnError:'ETIMEDOUT'},null),true,'a hung call proves nothing either');
  assert.equal(hostUnavailableOf({status:1,stderr:''},{ok:false,error:{code:'runtime_unavailable',message:'Start the Orca app first.'}}),true);
  assert.equal(hostUnavailableOf({status:1,stderr:'Could not read Orca runtime metadata at x. Start the Orca app first.'},null),true);
  assert.equal(hostUnavailableOf({status:1,stderr:''},{ok:false,error:{code:'terminal_handle_stale'}}),false);
  assert.equal(hostUnavailableOf({status:0,stdout:'{}'},{ok:true}),false);
});

const shows=(...answers)=>{let i=0;return()=>answers[Math.min(i++,answers.length-1)];};
const LIVE={ok:true,connected:true,writable:true,terminal:{handle:'t1'}};
const DOWN={ok:false,hostUnavailable:true,error:'spawnSync orca.exe ENOENT'};
const DEAD={ok:true,connected:false,writable:false,terminal:{handle:'t1'}};

test('kernelTerminalVerdict keeps an outage apart from a death and lets the listing settle other refusals',()=>{
  const listUp=()=>({ok:true,terminals:[{handle:'t1',connected:true,writable:true}]});
  assert.equal(kernelTerminalVerdict('t1',{show:()=>LIVE,list:listUp}).verdict,'live');
  assert.equal(kernelTerminalVerdict('t1',{show:()=>DOWN,list:listUp}).verdict,'host-unavailable');
  assert.equal(kernelTerminalVerdict('t1',{show:()=>DEAD,list:listUp}).verdict,'disconnected');
  assert.equal(kernelTerminalVerdict('t1',{show:()=>({ok:false,errorCode:'terminal_handle_stale'}),list:listUp}).verdict,'gone');
  const odd=()=>({ok:false,errorCode:'runtime_error',error:'odd'});
  assert.equal(kernelTerminalVerdict('t1',{show:odd,list:listUp}).verdict,'live','a listed connected terminal is alive whatever show said');
  assert.equal(kernelTerminalVerdict('t1',{show:odd,list:()=>({ok:true,terminals:[]})}).verdict,'gone');
  assert.equal(kernelTerminalVerdict('t1',{show:odd,list:()=>({ok:false,hostUnavailable:true})}).verdict,'host-unavailable');
  assert.equal(kernelTerminalVerdict('t1',{show:odd,list:()=>({ok:false,error:'boom'})}).verdict,'unverified');
});

test('settledKernelVerdict waits out an outage and re-verifies; a death must be seen twice',()=>{
  const sleeps=[];const sleep=ms=>sleeps.push(ms);
  const upList=()=>({ok:true,terminals:[]});
  const recovered=settledKernelVerdict('t1',{show:shows(DOWN,LIVE),list:shows({ok:false,hostUnavailable:true},{ok:true,terminals:[]}),sleep,waitMs:60_000,settleMs:0});
  assert.equal(recovered.verdict,'live','the kernel is re-probed once Orca answers, and it was alive all along');
  assert.equal(recovered.hostWait.available,true);
  const stillDown=settledKernelVerdict('t1',{show:()=>DOWN,list:()=>({ok:false,hostUnavailable:true}),sleep,waitMs:3000,settleMs:0});
  assert.equal(stillDown.verdict,'host-unavailable');
  assert.equal(stillDown.hostWait.available,false);
  const flicker=settledKernelVerdict('t1',{show:shows(DEAD,LIVE),list:upList,sleep,settleMs:5});
  assert.equal(flicker.verdict,'live','a pane that re-attached after the Orca app restart is alive');
  const dead=settledKernelVerdict('t1',{show:()=>DEAD,list:upList,sleep,settleMs:5});
  assert.deepEqual([dead.verdict,dead.confirmed],['disconnected',true]);
  const waited=awaitOrcaHost({list:shows({hostUnavailable:true},{hostUnavailable:true},{ok:true}),sleep:()=>{},waitMs:60_000});
  assert.deepEqual([waited.available,waited.probes,waited.waitedMs],[true,3,3000],'backoff 1s then 2s');
});

/* ------------------------------------------------------------ integration */

let sharedFixture=null;
after(()=>{if(sharedFixture)fs.rmSync(sharedFixture.root,{recursive:true,force:true,maxRetries:20,retryDelay:25});});

const createFixture=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-host-outage-'));
  const repo=path.join(root,'repo');fs.mkdirSync(repo);
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json'),log=path.join(root,'calls.jsonl');
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot);
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),'language: en\neffort: medium\nkernel: {agent: codex, model: gpt-6-sol, effort: high}\n');
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  fs.writeFileSync(fake,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE:state,STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',STARCI_OWNER_ROOT:ownerRoot,
    STARCI_HOST_WAIT_MS:'0',STARCI_KERNEL_DEATH_SETTLE_MS:'0',LOCALAPPDATA:path.join(root,'localappdata')};
  const run=(script,args,more={})=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...env,...more}});
  const calls=()=>fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>json(l).argv.slice(0,2).join(' ')):[];
  const readState=()=>json(fs.readFileSync(state,'utf8'));
  const writeState=fn=>{const s=readState();fn(s);fs.writeFileSync(state,JSON.stringify(s));};
  const defined=run(DEFINE_GOAL,['--repo',repo,'--text','survive an Orca restart','--json']);
  assert.equal(defined.status,0,defined.stderr);
  const workflowId=json(defined.stdout)?.workflowId;assert.ok(workflowId);
  const booted=run(START_WORKFLOW,['--repo',repo,'--goal',workflowId,'--json']);
  assert.equal(booted.status,0,booted.stderr);
  const kernel=json(booted.stdout)?.terminal;assert.ok(kernel);
  // The kernel sits at its idle Codex prompt, alive.
  writeState(s=>{s.terminals[kernel].screen='• Yielding - waiting on the op report.\n› Ask Codex to do anything\n  gpt-6-sol high · repo';});
  // Every integration case starts from this same fully booted workflow. Restore
  // all test-observed mutable state, including the workflow ledger, before the next
  // case so no test observes another test's terminal, job, event, or call log.
  const baseline=path.join(root,'baseline');fs.mkdirSync(baseline);
  for(const name of ['repo','owner'])fs.cpSync(path.join(root,name),path.join(baseline,name),{recursive:true});
  fs.copyFileSync(state,path.join(baseline,'orca-state.json'));
  if(fs.existsSync(log))fs.copyFileSync(log,path.join(baseline,'calls.jsonl'));
  const ledgerFile=ledgerFileFor(repo,{env});
  fs.copyFileSync(ledgerFile,path.join(baseline,'runtime.sqlite'));
  const reset=()=>{
    for(const name of ['repo','owner']){
      fs.rmSync(path.join(root,name),{recursive:true,force:true,maxRetries:20,retryDelay:25});
      fs.cpSync(path.join(baseline,name),path.join(root,name),{recursive:true});
    }
    fs.copyFileSync(path.join(baseline,'orca-state.json'),state);
    const baselineLog=path.join(baseline,'calls.jsonl');
    if(fs.existsSync(baselineLog))fs.copyFileSync(baselineLog,log);else fs.rmSync(log,{force:true});
    for(const suffix of ['','-wal','-shm'])fs.rmSync(`${ledgerFile}${suffix}`,{force:true});
    fs.copyFileSync(path.join(baseline,'runtime.sqlite'),ledgerFile);
  };
  const ledgerRows=()=>{
    // The spawned verbs resolve the ledger under the fixture's LOCALAPPDATA; the
    // same env must name the file here or this process lands on the host's root
    // (engine/db/ledger.mjs ledgerFileFor/projectsRootFor).
    const ledger=inspectLedger({file:ledgerFile});
    try{
      const jobRow=ledger.db.prepare('SELECT status,worker_id,payload_json FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`);
      return {
        signal:json(ledger.db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId)?.value_json??'null'),
        // jobs has no attempt column: the kernel seat's boot count lives in
        // payload.hierarchy.attempt (start-workflow.mjs kernelAttemptOf).
        job:jobRow?{status:jobRow.status,worker_id:jobRow.worker_id,attempt:json(jobRow.payload_json)?.hierarchy?.attempt??null}:{},
        kinds:ledger.db.prepare('SELECT kind FROM events WHERE workflow_id=? ORDER BY seq').all(workflowId).map(r=>r.kind),
        incidents:ledger.db.prepare('SELECT incident_id,status FROM incidents WHERE workflow_id=?').all(workflowId).map(r=>({...r})),
      };
    }finally{ledger.close();}
  };
  // The state the 02:37 watchdogs left: the seat cleared as if the kernel were
  // dead (signal deleted, job released, an unclosed-residue incident) while its
  // terminal kept running.
  const loseSeat=()=>{
    const ledger=openLedger({file:ledgerFile});
    const at=Date.now();
    try{
      ledger.transaction(()=>{
        ledger.db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=?").run(workflowId);
        // The migrated schema has no 'stopped' status and no result_json: a cleared kernel seat is
        // running -> ready with its worker dropped (releaseKernelJob, engine/db/ledger.mjs) and the
        // result on a job-result event — the pair start-workflow writes on kernel-stale-cleared.
        releaseKernelJob(ledger.db,{workflowId,reason:'kernel-stopped',at});
        recordJobResult(ledger.db,{jobId:`kernel-${workflowId}`,result:{reason:'spawnSync orca.exe ENOENT',terminal:kernel},at});
        // incidents now require kind/owner/created_at; the runtime files this residue as a
        // supervisor-owned runtime-defect (start-workflow.mjs openIncident kernel-stale-terminal-unclosed).
        openIncident(ledger.db,{incidentId:'inc-unclosed-1',workflowId,kind:'runtime-defect',owner:'supervisor',at,
          lastProgress:`[orca-tree] ${JSON.stringify({code:'kernel-stale-terminal-unclosed',handle:kernel,ok:false})}`});
      });
    }finally{ledger.close();}
  };
  return {root,repo,run,calls,readState,writeState,workflowId,kernel,ledgerRows,loseSeat,reset};
};

const fixture=()=>{
  if(!sharedFixture)sharedFixture=createFixture();else sharedFixture.reset();
  return sharedFixture;
};

test('start-workflow refuses to replace a kernel while Orca answers runtime_unavailable, and touches nothing',t=>{
  const f=fixture(t);
  const before=f.ledgerRows();const creates=f.calls().filter(c=>c==='orchestration worker-start').length;
  const r=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json'],{STARCI_FAKE_ORCA_HOST:'runtime_unavailable'});
  assert.equal(r.status,75,r.stderr||r.stdout);
  const out=lastJson(r.stdout);
  assert.deepEqual([out.ok,out.step,out.terminal],[false,'host-unavailable',f.kernel]);
  assert.match(out.error,/runtime_unavailable|Start the Orca app first/);
  assert.deepEqual(f.ledgerRows(),before,'no signal deleted, no job released, no event, no incident');
  assert.equal(f.calls().filter(c=>c==='orchestration worker-start').length,creates,'no second kernel');
});

test('start-workflow refuses while orca.exe cannot be spawned (ENOENT), and touches nothing',t=>{
  const f=fixture(t);
  const before=f.ledgerRows();
  const r=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json'],{STARCI_ORCA_COMMAND:MISSING_ORCA_COMMAND,STARCI_ORCA_ARGS:'[]'});
  assert.equal(r.status,75,r.stderr||r.stdout);
  const out=lastJson(r.stdout);
  assert.equal(out.step,'host-unavailable');
  assert.match(out.error,/ENOENT/);
  assert.deepEqual(f.ledgerRows(),before);
});

test('a kernel whose seat was lost is never duplicated: its live worker refuses a second one until it is stopped',t=>{
  const f=fixture(t);
  f.loseSeat();
  const starts=f.calls().filter(c=>c==='orchestration worker-start').length;
  const refused=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json']);
  assert.equal(refused.status,3,refused.stderr||refused.stdout);
  assert.deepEqual([lastJson(refused.stdout)?.step,lastJson(refused.stdout)?.terminal],['kernel-worker-alive',f.kernel]);
  assert.equal(f.calls().filter(c=>c==='orchestration worker-start').length,starts,'no second kernel beside the live one');
  // Once Orca shows the worker ended, the next start launches the replacement - attempt 2, a new worker.
  f.writeState(s=>{s.workerStates={...(s.workerStates||{}),'dispatch-fake-1':'stopped'};});
  const started=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json']);
  assert.equal(started.status,0,started.stderr||started.stdout);
  const out=json(started.stdout);
  assert.notEqual(out.terminal,f.kernel);
  assert.equal(out.launch,'worker');
  const rows=f.ledgerRows();
  assert.deepEqual([rows.signal.terminal,rows.job.status,rows.job.attempt],[out.terminal,'running',2]);
});

const tick=(f,more={})=>{
  const r=f.run(WATCHDOG,['--repo',f.repo,'--workflow',f.workflowId,'--once','--repair','--json'],more);
  return {status:r.status,result:lastJson(r.stdout),stderr:r.stderr};
};

test('watchdog: an Orca outage is host-unavailable, never a restart',t=>{
  const f=fixture(t);
  const before=f.ledgerRows();const creates=f.calls().filter(c=>c==='orchestration worker-start').length;
  for(const more of [{STARCI_FAKE_ORCA_HOST:'runtime_unavailable'},{STARCI_ORCA_COMMAND:MISSING_ORCA_COMMAND,STARCI_ORCA_ARGS:'[]'}]){
    // starci kernel status/survey read only the ledger; the kernel probe is the Orca call that fails.
    const {status,result,stderr}=tick(f,more);
    assert.equal(status,0,stderr||JSON.stringify(result));
    assert.deepEqual([result.ok,result.action,result.terminal],[true,'host-unavailable',f.kernel],JSON.stringify(result));
  }
  assert.deepEqual(f.ledgerRows(),before);
  assert.equal(f.calls().filter(c=>c==='orchestration worker-start').length,creates);
});

test('watchdog: a seat lost while the kernel worker lived is left running, not relaunched',t=>{
  const f=fixture(t);
  f.loseSeat();
  const starts=f.calls().filter(c=>c==='orchestration worker-start').length;
  const {status,result,stderr}=tick(f);
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.equal(result.action,'already-live',JSON.stringify(result));
  assert.equal(f.calls().filter(c=>c==='orchestration worker-start').length,starts,'exactly one kernel worker');
});

test('watchdog: a kernel a responding Orca proves dead is fenced and replaced',t=>{
  const f=fixture(t);
  f.writeState(s=>{s.terminals[f.kernel].connected=false;s.terminals[f.kernel].writable=false;});
  const {status,result,stderr}=tick(f);
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.equal(result.action,'restarted',JSON.stringify(result));
  assert.equal(result.fenced?.ok,true,'the dead Kernel\'s Dispatch is stopped and released before the replacement');
  assert.notEqual(result.replacementTerminal,f.kernel);
  const rows=f.ledgerRows();
  assert.deepEqual([rows.job.status,rows.job.worker_id,rows.job.attempt],['running',result.replacementTerminal,2]);
});

/* ------------------------------------------------ kernel agent exited */

// A kernel whose agent exited leaves its host shell: Orca (responding) shows the terminal connected and writable
// and may still call the worker ready, the frame ends in a bare PowerShell prompt. The watchdog proves it from the
// frame (two reads), fences the worker's Dispatch and has start-workflow replace it. Shaped on a Codex kernel's
// exit (token usage and resume line) with the idle frame still above it.
const EXITED_KERNEL=['• Yielding - waiting on the op report.','› Ask Codex to do anything','  gpt-6-sol high · repo','',
  'Token usage: total=1,204,331 input=1,150,002 (+ 9,876,544 cached) output=54,329 (reasoning 31,020)',
  'To continue this session, run codex resume 0199a7c2-5b1e-7d40-9c1f-3e2a8b6d4f10','',`PS ${path.join(os.tmpdir(), 'shop-be')}>`].join('\n');
const exitKernel=f=>f.writeState(s=>{s.terminals[f.kernel].screen=EXITED_KERNEL;});

test('watchdog: a kernel whose agent exited to a shell is fenced and replaced by a new worker',t=>{
  const f=fixture(t);
  exitKernel(f);
  const {status,result,stderr}=tick(f);
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.deepEqual([result.action,result.state,result.shellPrompt],['restarted','agent-exited',`PS ${path.join(os.tmpdir(), 'shop-be')}>`],JSON.stringify(result));
  assert.equal(result.fenced?.ok,true);
  const next=result.replacementTerminal;
  assert.ok(next&&next!==f.kernel);
  assert.equal(f.readState().workerStates['dispatch-fake-1'],'released','the exited Kernel\'s worker is released');
  assert.equal(f.calls().includes('terminal create'),false);
  const rows=f.ledgerRows();
  assert.deepEqual([rows.signal.terminal,rows.job.status,rows.job.worker_id,rows.job.attempt],[next,'running',next,2]);
  assert.ok(rows.kinds.includes('kernel-stale-cleared')&&rows.kinds.includes('kernel-restarted'),rows.kinds.join(','));
});

test('watchdog without --repair reports an exited kernel as restart-needed and touches nothing',t=>{
  const f=fixture(t);
  exitKernel(f);
  const before=f.ledgerRows();
  const r=f.run(WATCHDOG,['--repo',f.repo,'--workflow',f.workflowId,'--once','--json']);
  const result=lastJson(r.stdout);
  assert.deepEqual([result.action,result.state],['restart-needed','agent-exited'],JSON.stringify(result));
  assert.deepEqual(f.ledgerRows(),before);
  assert.equal(f.calls().some(c=>c==='orchestration worker-stop'||c==='orchestration worker-release'),false,'nothing fenced');
});

test('an Orca outage is still host-unavailable while the kernel frame shows a shell',t=>{
  const f=fixture(t);
  exitKernel(f);
  const before=f.ledgerRows();const starts=f.calls().filter(c=>c==='orchestration worker-start').length;
  const {result}=tick(f,{STARCI_FAKE_ORCA_HOST:'runtime_unavailable'});
  assert.deepEqual([result.ok,result.action],[true,'host-unavailable'],JSON.stringify(result));
  const started=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json'],{STARCI_FAKE_ORCA_HOST:'runtime_unavailable'});
  assert.equal(started.status,75);
  assert.deepEqual(f.ledgerRows(),before);
  assert.equal(f.calls().filter(c=>c==='orchestration worker-start').length,starts);
});

test('watchdog: a lost seat whose kernel worker exited to a bare shell is fenced and relaunched',t=>{
  const f=fixture(t);
  f.loseSeat();
  exitKernel(f);
  const {status,result,stderr}=tick(f);
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.equal(result.action,'restarted',JSON.stringify(result));
  assert.equal(result.fenced?.ok,true,'the lost seat\'s exited worker is released first');
  assert.notEqual(result.terminal,f.kernel);
  const rows=f.ledgerRows();
  assert.deepEqual([rows.signal.terminal,rows.job.status],[result.terminal,'running']);
});
