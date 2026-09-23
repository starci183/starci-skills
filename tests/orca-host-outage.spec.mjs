import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,openLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {FAKE_ORCA,MISSING_ORCA_COMMAND} from './helpers/fake-orca.mjs';
import {hostUnavailableOf} from '../scripts/api/orca/lib.mjs';
import {kernelTerminalVerdict,settledKernelVerdict,awaitOrcaHost} from '../scripts/kernel/host-outage.mjs';

// 2026-09-24 02:37: Orca auto-updated and restarted. For about a minute the CLI
// answered runtime_unavailable and spawning orca.exe failed with ENOENT, while
// the terminal daemon kept every kernel alive. The watchdogs read it as dead
// kernels: five kernel jobs were stopped with their signals deleted, and one
// workflow got a second kernel beside its live one. An Orca outage is never a
// dead kernel; a live kernel whose seat was lost is adopted, never duplicated.
const ROOT=path.resolve(import.meta.dirname,'..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const WATCHDOG=path.join(ROOT,'scripts','kernel','watchdog.mjs');
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

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-host-outage-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
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
  const ledgerRows=()=>{
    const ledger=inspectLedger({file:ledgerFileFor(repo)});
    try{
      return {
        signal:json(ledger.db.prepare("SELECT value_json FROM signals WHERE scope='kernel' AND key=?").get(workflowId)?.value_json??'null'),
        job:{...ledger.db.prepare('SELECT status,worker_id,attempt FROM jobs WHERE job_id=?').get(`kernel-${workflowId}`)},
        kinds:ledger.db.prepare('SELECT kind FROM events WHERE workflow_id=? ORDER BY seq').all(workflowId).map(r=>r.kind),
        incidents:ledger.db.prepare('SELECT incident_id,status FROM incidents WHERE workflow_id=?').all(workflowId).map(r=>({...r})),
      };
    }finally{ledger.close();}
  };
  // The state the 02:37 watchdogs left: the seat cleared as if the kernel were
  // dead (signal deleted, job stopped, an unclosed-residue incident) while its
  // terminal kept running.
  const loseSeat=()=>{
    const ledger=openLedger({file:ledgerFileFor(repo)});
    try{
      ledger.db.prepare("DELETE FROM signals WHERE scope='kernel' AND key=?").run(workflowId);
      ledger.db.prepare("UPDATE jobs SET status='stopped',result_json=? WHERE job_id=?").run(JSON.stringify({reason:'spawnSync orca.exe ENOENT',terminal:kernel}),`kernel-${workflowId}`);
      ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,attempts,model_calls,tokens,elapsed_ms,last_progress,status,updated_at) VALUES(?,?,NULL,0,0,0,0,?,'open',?)")
        .run('inc-unclosed-1',workflowId,`[orca-tree] ${JSON.stringify({code:'kernel-stale-terminal-unclosed',handle:kernel,ok:false})}`,Date.now());
    }finally{ledger.close();}
  };
  return {repo,run,calls,readState,writeState,workflowId,kernel,ledgerRows,loseSeat};
};

test('start-workflow refuses to replace a kernel while Orca answers runtime_unavailable, and touches nothing',t=>{
  const f=fixture(t);
  const before=f.ledgerRows();const creates=f.calls().filter(c=>c==='terminal create').length;
  const r=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json'],{STARCI_FAKE_ORCA_HOST:'runtime_unavailable'});
  assert.equal(r.status,75,r.stderr||r.stdout);
  const out=lastJson(r.stdout);
  assert.deepEqual([out.ok,out.step,out.terminal],[false,'host-unavailable',f.kernel]);
  assert.match(out.error,/runtime_unavailable|Start the Orca app first/);
  assert.deepEqual(f.ledgerRows(),before,'no signal deleted, no job stopped, no event, no incident');
  assert.equal(f.calls().filter(c=>c==='terminal create').length,creates,'no second kernel');
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

test('a kernel whose seat was lost is never duplicated: start-workflow refuses, --adopt binds it back',t=>{
  const f=fixture(t);
  f.loseSeat();
  const creates=f.calls().filter(c=>c==='terminal create').length;
  const refused=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json']);
  assert.equal(refused.status,3,refused.stderr||refused.stdout);
  assert.deepEqual([lastJson(refused.stdout)?.step,lastJson(refused.stdout)?.terminal],['kernel-terminal-alive',f.kernel]);
  assert.equal(f.calls().filter(c=>c==='terminal create').length,creates,'no second kernel beside the live one');

  const adopted=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--adopt',f.kernel,'--json']);
  assert.equal(adopted.status,0,adopted.stderr||adopted.stdout);
  const out=lastJson(adopted.stdout);
  assert.deepEqual([out.ok,out.adopted,out.terminal,out.agent,out.model,out.screenState,out.previousJobStatus],
    [true,true,f.kernel,'codex','gpt-6-sol','turn-idle','stopped']);
  assert.deepEqual(out.resolvedIncidents,['inc-unclosed-1']);
  const rows=f.ledgerRows();
  assert.equal(rows.signal.terminal,f.kernel);assert.equal(rows.signal.adopted,true);assert.equal(rows.signal.model,'gpt-6-sol');
  assert.deepEqual(rows.job,{status:'running',worker_id:f.kernel,attempt:1},'same seat, same attempt');
  assert.ok(rows.kinds.includes('kernel-adopted'));
  assert.deepEqual(rows.incidents,[{incident_id:'inc-unclosed-1',status:'resolved'}]);
  assert.equal(f.calls().filter(c=>c==='terminal send').length,1,'adopt types nothing into the kernel (only the boot prompt was sent)');

  const again=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json']);
  assert.equal(again.status,0,again.stderr);
  assert.equal(json(again.stdout)?.terminal,f.kernel,'the adopted kernel is the live seat');
});

test('--adopt refuses a terminal that is not this kernel and a bare shell; re-adopting the live seat is a no-op',t=>{
  const f=fixture(t);
  f.writeState(s=>{s.terminals['stranger']={handle:'stranger',connected:true,writable:true,sent:false,command:'codex',screen:'› Ask Codex to do anything'};});
  const stranger=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--adopt','stranger','--json']);
  assert.equal(stranger.status,1);assert.equal(lastJson(stranger.stdout)?.step,'adopt-terminal-not-this-kernel');

  const live=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--adopt',f.kernel,'--json']);
  assert.equal(live.status,0,'re-adopting the live seat itself is a no-op repair');

  f.loseSeat();
  f.writeState(s=>{s.terminals[f.kernel].screen='PS D:\\repo>';});
  const shell=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--adopt',f.kernel,'--json']);
  assert.equal(shell.status,1);assert.equal(lastJson(shell.stdout)?.step,'adopt-terminal-agent-exited','a bare shell is an exited kernel, not one to adopt');
  assert.equal(f.ledgerRows().job.status,'stopped','a refused adopt changes nothing');
});

test('--adopt never binds a second kernel over a live one: the duplicate is quit and closed first',t=>{
  // wf-miamia-work-and-stacks: the 02:38 restart launched a new kernel while the
  // old one kept running. The old one may be adopted only once the new one is gone.
  const f=fixture(t);
  f.writeState(s=>{s.terminals[f.kernel].connected=false;s.terminals[f.kernel].writable=false;});
  const restarted=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json']);
  assert.equal(restarted.status,0,restarted.stderr);
  const second=json(restarted.stdout)?.terminal;assert.notEqual(second,f.kernel);
  f.writeState(s=>{Object.assign(s.terminals[f.kernel],{connected:true,writable:true,closed:false});});
  const refused=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--adopt',f.kernel,'--json']);
  assert.equal(refused.status,1);
  assert.deepEqual([lastJson(refused.stdout)?.step,lastJson(refused.stdout)?.liveTerminal],['kernel-already-live',second]);
  f.writeState(s=>{Object.assign(s.terminals[second],{connected:false,writable:false,closed:true});});
  const adopted=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--adopt',f.kernel,'--json']);
  assert.equal(adopted.status,0,adopted.stderr||adopted.stdout);
  const rows=f.ledgerRows();
  assert.deepEqual([rows.signal.terminal,rows.job.worker_id,rows.job.status],[f.kernel,f.kernel,'running']);
});

const tick=(f,more={})=>{
  const r=f.run(WATCHDOG,['--repo',f.repo,'--workflow',f.workflowId,'--once','--repair','--json'],more);
  return {status:r.status,result:lastJson(r.stdout),stderr:r.stderr};
};

test('watchdog: an Orca outage is host-unavailable, never a restart',t=>{
  const f=fixture(t);
  const before=f.ledgerRows();const creates=f.calls().filter(c=>c==='terminal create').length;
  for(const more of [{STARCI_FAKE_ORCA_HOST:'runtime_unavailable'},{STARCI_ORCA_COMMAND:MISSING_ORCA_COMMAND,STARCI_ORCA_ARGS:'[]'}]){
    // api status/survey read only the ledger; the kernel probe is the Orca call that fails.
    const {status,result,stderr}=tick(f,more);
    assert.equal(status,0,stderr||JSON.stringify(result));
    assert.deepEqual([result.ok,result.action,result.terminal],[true,'host-unavailable',f.kernel],JSON.stringify(result));
  }
  assert.deepEqual(f.ledgerRows(),before);
  assert.equal(f.calls().filter(c=>c==='terminal create').length,creates);
});

test('watchdog: a seat lost while the kernel lived is adopted back, not relaunched',t=>{
  const f=fixture(t);
  f.loseSeat();
  const creates=f.calls().filter(c=>c==='terminal create').length;
  const {status,result,stderr}=tick(f);
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.deepEqual([result.action,result.terminal],['adopted',f.kernel],JSON.stringify(result));
  assert.equal(f.calls().filter(c=>c==='terminal create').length,creates,'exactly one kernel terminal');
  const rows=f.ledgerRows();
  assert.deepEqual([rows.signal.terminal,rows.job.status,rows.job.worker_id],[f.kernel,'running',f.kernel]);
});

test('watchdog: a kernel a responding Orca proves dead is still replaced',t=>{
  const f=fixture(t);
  f.writeState(s=>{s.terminals[f.kernel].connected=false;s.terminals[f.kernel].writable=false;});
  const {status,result,stderr}=tick(f);
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.equal(result.action,'restarted',JSON.stringify(result));
  assert.notEqual(result.replacementTerminal,f.kernel);
  const rows=f.ledgerRows();
  assert.deepEqual([rows.job.status,rows.job.worker_id,rows.job.attempt],['running',result.replacementTerminal,2]);
});

/* ------------------------------------------------ kernel agent exited */

// A kernel whose agent exited leaves its host shell: Orca (responding) shows the
// terminal connected and writable, the frame ends in a bare PowerShell prompt. The
// watchdog read it 'observed' and the workflow sat without a kernel. It is a dead
// kernel: replaced through start-workflow, and its shell closed only after the
// replacement holds the seat. Shaped on a Codex kernel's exit (token usage and
// resume line) with the idle frame still above it.
const EXITED_KERNEL=['• Yielding - waiting on the op report.','› Ask Codex to do anything','  gpt-6-sol high · repo','',
  'Token usage: total=1,204,331 input=1,150,002 (+ 9,876,544 cached) output=54,329 (reasoning 31,020)',
  'To continue this session, run codex resume 0199a7c2-5b1e-7d40-9c1f-3e2a8b6d4f10','','PS D:\\Repositories\\mia-mia-backend>'].join('\n');
const exitKernel=f=>f.writeState(s=>{s.terminals[f.kernel].screen=EXITED_KERNEL;});
// Every call in order with its terminal argument: 'terminal create' / 'terminal close:<handle>'.
const callLog=f=>{
  const file=path.join(path.dirname(f.repo),'calls.jsonl');
  return fs.readFileSync(file,'utf8').trim().split('\n').filter(Boolean).map(l=>json(l).argv).map(a=>{
    const verb=a.slice(0,2).join(' '),i=a.indexOf('--terminal');
    return i>=0&&verb==='terminal close'?`${verb}:${a[i+1]}`:verb;
  });
};

test('watchdog: a kernel whose agent exited to a shell is replaced, and its shell closed after the replacement',t=>{
  const f=fixture(t);
  exitKernel(f);
  const {status,result,stderr}=tick(f);
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.deepEqual([result.action,result.state,result.shellPrompt],['restarted','agent-exited','PS D:\\Repositories\\mia-mia-backend>'],JSON.stringify(result));
  const next=result.replacementTerminal;
  assert.ok(next&&next!==f.kernel);
  assert.deepEqual(result.exitedTerminalsClosed.map(c=>[c.handle,c.closed,c.proof]),[[f.kernel,true,'shell-prompt']]);
  const calls=callLog(f);
  const created=calls.lastIndexOf('terminal create'),closed=calls.indexOf(`terminal close:${f.kernel}`);
  assert.ok(closed>created&&created>=0,`the old shell is closed after the replacement launched: ${calls.join(', ')}`);
  assert.deepEqual(f.readState().closedTabs,[f.kernel],'closed with its tab');
  const rows=f.ledgerRows();
  assert.deepEqual([rows.signal.terminal,rows.job.status,rows.job.worker_id,rows.job.attempt],[next,'running',next,2]);
  assert.ok(rows.kinds.includes('kernel-stale-cleared')&&rows.kinds.includes('kernel-restarted')&&rows.kinds.includes('kernel-exited-terminal-closed'),rows.kinds.join(','));
  assert.deepEqual(rows.incidents,[],'a closed shell leaves no residue incident');
});

test('watchdog without --repair reports an exited kernel as restart-needed and touches nothing',t=>{
  const f=fixture(t);
  exitKernel(f);
  const before=f.ledgerRows();
  const r=f.run(WATCHDOG,['--repo',f.repo,'--workflow',f.workflowId,'--once','--json']);
  const result=lastJson(r.stdout);
  assert.deepEqual([result.action,result.state],['restart-needed','agent-exited'],JSON.stringify(result));
  assert.deepEqual(f.ledgerRows(),before);
  assert.equal(f.readState().closed,undefined,'nothing closed');
});

test('an Orca outage is still host-unavailable while the kernel frame shows a shell',t=>{
  const f=fixture(t);
  exitKernel(f);
  const before=f.ledgerRows();const creates=f.calls().filter(c=>c==='terminal create').length;
  const {result}=tick(f,{STARCI_FAKE_ORCA_HOST:'runtime_unavailable'});
  assert.deepEqual([result.ok,result.action],[true,'host-unavailable'],JSON.stringify(result));
  const started=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json'],{STARCI_FAKE_ORCA_HOST:'runtime_unavailable'});
  assert.equal(started.status,75);
  assert.deepEqual(f.ledgerRows(),before);
  assert.equal(f.calls().filter(c=>c==='terminal create').length,creates);
});

test('start-workflow: an exited kernel is not a live seat; a failed launch leaves its shell for the next start to close',t=>{
  const f=fixture(t);
  exitKernel(f);
  // The pinned kernel agent is dead: the launch fails after the seat was cleared.
  const failed=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json'],{STARCI_FAKE_ORCA_DEAD:'codex'});
  assert.equal(failed.status,1,failed.stdout);
  assert.equal(f.readState().closed,undefined,'no replacement, so the old shell is not closed');
  assert.equal(f.ledgerRows().signal,null);
  // The next start finds the shell through the kernel job, launches, then closes it.
  const started=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--json']);
  assert.equal(started.status,0,started.stderr||started.stdout);
  const out=json(started.stdout);
  assert.notEqual(out.terminal,f.kernel,'an exited kernel job terminal is not kernel-terminal-alive');
  assert.deepEqual(out.exitedTerminalsClosed.map(c=>[c.handle,c.closed,c.proof]),[[f.kernel,true,'shell-prompt']]);
  assert.deepEqual(f.readState().closedTabs,[f.kernel]);
});

test('--adopt refuses a kernel terminal whose agent exited',t=>{
  const f=fixture(t);
  f.loseSeat();
  exitKernel(f);
  const r=f.run(START_WORKFLOW,['--repo',f.repo,'--goal',f.workflowId,'--adopt',f.kernel,'--json']);
  assert.equal(r.status,1);
  const out=lastJson(r.stdout);
  assert.deepEqual([out.step,out.screenState,out.shellPrompt],['adopt-terminal-agent-exited','agent-exited','PS D:\\Repositories\\mia-mia-backend>']);
  assert.equal(f.ledgerRows().job.status,'stopped','a refused adopt changes nothing');
  assert.equal(f.readState().closed,undefined);
});

test('watchdog: a lost seat whose kernel terminal is a bare shell is relaunched, never adopted',t=>{
  const f=fixture(t);
  f.loseSeat();
  exitKernel(f);
  const {status,result,stderr}=tick(f);
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.equal(result.action,'restarted',JSON.stringify(result));
  assert.notEqual(result.terminal,f.kernel);
  assert.deepEqual(result.exitedTerminalsClosed.map(c=>[c.handle,c.closed]),[[f.kernel,true]]);
  const rows=f.ledgerRows();
  assert.deepEqual([rows.signal.terminal,rows.job.status],[result.terminal,'running']);
  assert.deepEqual(rows.incidents,[{incident_id:'inc-unclosed-1',status:'resolved'}],'the closed shell is no longer residue');
  assert.deepEqual(result.exitedTerminalsClosed[0].resolvedIncidents,['inc-unclosed-1']);
});
