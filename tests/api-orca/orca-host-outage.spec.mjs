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
import { installGuardLauncher } from '../helpers/guard-launcher.mjs';

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
// The sender terminal every launch needs (workflowSender): the caller's own Orca terminal, which the fake Orca accepts.
const SENDER='fake-sender-terminal';
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
after(()=>{if(sharedFixture)removeTree(sharedFixture.root);});

const removeTree=dir=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});

const buildFixture=root=>{
  const repo=path.join(root,'repo');fs.mkdirSync(repo);
  const fake=path.join(root,'fake-orca.mjs'),state=path.join(root,'orca-state.json'),log=path.join(root,'calls.jsonl');
  const ownerRoot=path.join(root,'owner');fs.mkdirSync(ownerRoot);
  const trustHome=path.join(root,'trust-home');fs.mkdirSync(trustHome);installGuardLauncher(trustHome);
  // This private fixture owner adopts only its exact launch root; the real trust writer stays enabled.
  const ownerConfig=fs.readFileSync(path.join(ROOT,'config.example.yaml'),'utf8')
    .replace(/^language:.*$/m,'language: en').replace(/^effort:.*$/m,'effort: medium')
    .replace(/^kernel:.*$/m,'kernel: {agent: codex, model: gpt-6.1-sol, effort: high}')
    .replace(/^launchTrust:.*$/m,`launchTrust: ${JSON.stringify({profile:'automatic',approvedBy:'owner',approvalRef:'private Orca outage fixture adoption',roots:[repo]})}`);
  fs.writeFileSync(path.join(ownerRoot,'config.yaml'),ownerConfig);
  fs.writeFileSync(state,JSON.stringify({sends:0,counter:0,terminals:{},commands:[]}));
  fs.writeFileSync(fake,FAKE_ORCA);
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([fake]),
    STARCI_FAKE_ORCA_STATE:state,STARCI_FAKE_ORCA_LOG:log,STARCI_FAKE_ORCA_UNIQUE_TERMINALS:'1',STARCI_OWNER_ROOT:ownerRoot,STARCI_AGENT_TRUST_HOME:trustHome,ORCA_TERMINAL_HANDLE:SENDER,
    STARCI_HOST_WAIT_MS:'0',STARCI_KERNEL_DEATH_SETTLE_MS:'0',STARCI_LOCAL_ROOT:path.join(root,'localappdata'),
    STARCI_TEST_MACHINE_FILE:path.join(root,'machine.sqlite'),STARCI_PROJECTS_ROOT:path.join(root,'projects')};
  // Both external boundaries belong to every descendant, including watchdog -> start-workflow.
  const closureImport=`data:text/javascript,${encodeURIComponent(`import{register}from'node:module';register(${JSON.stringify(new URL('../helpers/worker-close-loader.mjs',import.meta.url).href)});register(${JSON.stringify(new URL('../helpers/workflow-startup-loader.mjs',import.meta.url).href)});`)}`;
  env.NODE_OPTIONS=[env.NODE_OPTIONS,`--import=${closureImport}`].filter(Boolean).join(' ');
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
  writeState(s=>{s.terminals[kernel].screen='• Yielding - waiting on the op report.\n› Ask Codex to do anything\n  gpt-6.1-sol high · repo';});
  // Every integration case starts from this same fully booted workflow. Restore
  // all test-observed mutable state, including the workflow ledger, before the next
  // case so no test observes another test's terminal, job, event, or call log.
  const baseline=path.join(root,'baseline');fs.mkdirSync(baseline);
  for(const name of ['repo','owner','trust-home'])fs.cpSync(path.join(root,name),path.join(baseline,name),{recursive:true});
  fs.copyFileSync(state,path.join(baseline,'orca-state.json'));
  if(fs.existsSync(log))fs.copyFileSync(log,path.join(baseline,'calls.jsonl'));
  const ledgerFile=ledgerFileFor(repo,{env});
  fs.copyFileSync(ledgerFile,path.join(baseline,'runtime.sqlite'));
  for(const suffix of ['','-wal','-shm'])if(fs.existsSync(`${env.STARCI_TEST_MACHINE_FILE}${suffix}`))
    fs.copyFileSync(`${env.STARCI_TEST_MACHINE_FILE}${suffix}`,path.join(baseline,`machine.sqlite${suffix}`));
  const reset=()=>{
    for(const name of ['repo','owner','trust-home']){
      fs.rmSync(path.join(root,name),{recursive:true,force:true,maxRetries:20,retryDelay:25});
      fs.cpSync(path.join(baseline,name),path.join(root,name),{recursive:true});
    }
    fs.copyFileSync(path.join(baseline,'orca-state.json'),state);
    const baselineLog=path.join(baseline,'calls.jsonl');
    if(fs.existsSync(baselineLog))fs.copyFileSync(baselineLog,log);else fs.rmSync(log,{force:true});
    for(const suffix of ['','-wal','-shm'])fs.rmSync(`${ledgerFile}${suffix}`,{force:true});
    fs.copyFileSync(path.join(baseline,'runtime.sqlite'),ledgerFile);
    for(const suffix of ['','-wal','-shm']){
      fs.rmSync(`${env.STARCI_TEST_MACHINE_FILE}${suffix}`,{force:true});
      const saved=path.join(baseline,`machine.sqlite${suffix}`);
      if(fs.existsSync(saved))fs.copyFileSync(saved,`${env.STARCI_TEST_MACHINE_FILE}${suffix}`);
    }
  };
  const ledgerRows=()=>{
    // The spawned verbs resolve the ledger under the fixture's STARCI_LOCAL_ROOT; the
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
        boots:ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind IN ('kernel-booted','kernel-restarted') ORDER BY seq").all(workflowId).map(r=>json(r.payload_json)),
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
        // The current schema has no 'stopped' status and no result_json: a cleared kernel seat is
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

// A fixture that fails part-way leaves no temp tree behind.
const createFixture=()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-host-outage-'));
  try{return buildFixture(root);}catch(error){removeTree(root);throw error;}
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
  t.diagnostic(JSON.stringify({status,result,stderr}));
  assert.equal(status,0,JSON.stringify({status,result,stderr}));
  assert.equal(result.action,'restarted',JSON.stringify(result));
  assert.equal(result.fenced?.ok,true,'the dead Kernel\'s Dispatch is stopped and released before the replacement');
  assert.equal(result.fenced?.handle,f.kernel);
  assert.equal(result.fenced?.closed?.ok,true);
  assert.ok(['gone','disconnected'].includes(result.fenced?.closed?.proof),JSON.stringify(result.fenced));
  assert.equal(result.fenced?.processes?.verdict,'none',JSON.stringify(result.fenced));
  assert.notEqual(result.replacementTerminal,f.kernel);
  const rows=f.ledgerRows();
  assert.deepEqual([rows.job.status,rows.job.worker_id,rows.job.attempt],['running',result.replacementTerminal,2]);
  assert.equal(rows.boots.at(-1)?.startup?.host?.fixture,true,'the grandchild native boot retains the external host boundary');
});

test('watchdog: an unproven process tree retains the disconnected Kernel singleton',t=>{
  const f=fixture(t),starts=f.calls().filter(c=>c==='orchestration worker-start').length;
  f.writeState(s=>{s.terminals[f.kernel].connected=false;s.terminals[f.kernel].writable=false;});
  const {status,result,stderr}=tick(f,{STARCI_FAKE_CLOSURE_UNPROVEN:'1'});
  t.diagnostic(JSON.stringify({status,result,stderr}));
  assert.equal(status,1,JSON.stringify({status,result,stderr}));
  assert.equal(result.ok,false);
  assert.equal(result.action,'restart-failed');
  assert.equal(result.detail?.step,'kernel-stale-terminal-unclosed');
  assert.equal(result.detail?.effectState,'unknown');
  const processes=result.detail?.closure?.processes;
  assert.equal(processes?.verdict,'unverifiable',JSON.stringify(result));
  assert.equal(processes?.reason,'an exact native process stop was refused or unverified');
  assert.deepEqual(processes?.stopReceipts,[{ok:false,outcome:'unknown'}]);
  assert.deepEqual(processes?.stopped,[],'an unknown stop is never a successful process closure');
  assert.deepEqual(processes?.members?.map(row=>row.pid),[991],'the process object was captured before closure');
  assert.deepEqual(processes?.census?.map(row=>row.pid),[991],'the terminal census still contains the measured process');
  assert.deepEqual(processes?.survivors?.map(row=>row.pid),[991]);
  assert.equal(f.ledgerRows().signal.terminal,f.kernel);
  assert.equal(f.calls().filter(c=>c==='orchestration worker-start').length,starts,'no worker beside an unproven process tree');
});

/* ------------------------------------------------ kernel agent exited */

// A kernel whose agent exited leaves its host shell: Orca (responding) shows the terminal connected and writable
// and may still call the worker ready, the frame ends in a bare PowerShell prompt. The watchdog proves it from the
// frame (two reads), fences the worker's Dispatch and has start-workflow replace it. Shaped on a Codex kernel's
// exit (token usage and resume line) with the idle frame still above it.
const EXITED_KERNEL=['• Yielding - waiting on the op report.','› Ask Codex to do anything','  gpt-6.1-sol high · repo','',
  'Token usage: total=1,204,331 input=1,150,002 (+ 9,876,544 cached) output=54,329 (reasoning 31,020)',
  'To continue this session, run codex resume 0199a7c2-5b1e-7d40-9c1f-3e2a8b6d4f10','',`PS ${path.join(os.tmpdir(), 'shop-be')}>`].join('\n');
const exitKernel=f=>f.writeState(s=>{s.terminals[f.kernel].screen=EXITED_KERNEL;});

test('watchdog: a kernel whose agent exited to a shell is fenced and replaced by a new worker',t=>{
  const f=fixture(t);
  exitKernel(f);
  const {status,result,stderr}=tick(f);
  t.diagnostic(JSON.stringify({status,result,stderr}));
  assert.equal(status,0,JSON.stringify({status,result,stderr}));
  assert.deepEqual([result.action,result.state,result.shellPrompt],['restarted','agent-exited',`PS ${path.join(os.tmpdir(), 'shop-be')}>`],JSON.stringify(result));
  assert.equal(result.fenced?.ok,true);
  assert.equal(result.fenced?.handle,f.kernel);
  assert.equal(result.fenced?.closed?.ok,true);
  assert.ok(['gone','disconnected'].includes(result.fenced?.closed?.proof),JSON.stringify(result.fenced));
  assert.equal(result.fenced?.processes?.verdict,'none',JSON.stringify(result.fenced));
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
