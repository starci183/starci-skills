import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

// A terminal-send to a Claude Kernel answered agent_prompt_stalled while the wake text sat on its
// screen. `api nudge` already proves delivery from the screen (tests/nudge-delivery-proof.spec.mjs);
// the other Kernel wake paths - the durable transition wake after `api report`, the watchdog's
// liveness wake and the ask-answered wake - called the same send a failure. They now reuse
// scripts/kernel/wake-delivery.mjs: a wake the screen shows landed or queued is delivered, only a
// screen that shows none of it fails.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const WATCHDOG=path.join(ROOT,'scripts','kernel','watchdog.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const KERNEL='kernel-terminal-1';
const CHROME=['─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
const KERNEL_IDLE=[' Yielding — waiting on the code.refactor report.','✻ Brewed for 3m 2s',...CHROME].join('\n');

const world=(t,prefix)=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),prefix));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stubFile=path.join(root,'fake-orca.mjs');fs.writeFileSync(stubFile,FAKE_ORCA);
  const stateFile=path.join(root,'state.json'),logFile=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stubFile]),
    STARCI_FAKE_ORCA_LOG:logFile,STARCI_FAKE_ORCA_STATE:stateFile,LOCALAPPDATA:path.join(root,'localappdata')};
  const orcaState=()=>(fs.existsSync(stateFile)?json(fs.readFileSync(stateFile,'utf8')):null)??{sends:0};
  const writeState=fn=>{const s=orcaState();fn(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  // The Kernel terminal is a Claude frame at its idle prompt until a send changes it.
  const seedKernelTerminal=(screen=KERNEL_IDLE,command='claude --model claude-opus-5-5')=>writeState(s=>{s.terminals={...(s.terminals??{}),[KERNEL]:{handle:KERNEL,connected:true,writable:true,
    sent:false,prompt:null,command,screen}};});
  // Every non-empty `terminal send` to the Kernel is one wake typed into it.
  const kernelWakes=()=>(fs.existsSync(logFile)?fs.readFileSync(logFile,'utf8').trim().split('\n').filter(Boolean).map(json):[])
    .map(e=>e.argv).filter(a=>a[0]==='terminal'&&a[1]==='send'&&a[a.indexOf('--terminal')+1]===KERNEL)
    .map(a=>({text:a.includes('--text')?a[a.indexOf('--text')+1]:'',enter:a.includes('--enter')}));
  return {root,repo,env,orcaState,writeState,seedKernelTerminal,kernelWakes};
};

const signalKernel=(ledger,workflowId)=>ledger.db.prepare("INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,NULL,?,?,?,NULL)")
  .run(workflowId,'kernel-token',JSON.stringify({terminal:KERNEL,host:'orca',agent:'claude'}),Date.now());

/* --------------------------------------------------------------- units */

test('a long wake queued behind a Claude turn is queued, not staged, once the spinner scrolls out of the window',async()=>{
  const {classifyAgentScreen,wakeDeliveryOf}=await import('../scripts/kernel/terminal-liveness.mjs');
  // The shape of buildWakePrompt (scripts/kernel/watchdog.mjs), ~850 chars.
  const wake=['Watchdog liveness wake for wf-long.','The approved workflow is still phase=running, but the prior model turn returned to the terminal input prompt.',
    'Re-read canonical api status and survey now and continue the exact durable frontier.',
    'This wake grants no new approval, path, scope or operation decision: never duplicate an existing job or bypass an effect fence.',
    'Handle every filed Op outcome through consume-report/check/settle and the declared retry or incident path.',
    'Reason and act until the current durable state has no immediately executable transition.',
    'If the workflow is then legitimately waiting for an active Op, a lease, a not-before time, or a new report/message, record the exact wait reason and yield the model turn immediately; the external watchdog owns the 5-minute cadence and will wake this same Kernel identity.',
    'Never run Start-Sleep, shell sleep, a timer, or an in-turn polling loop to keep the model turn alive.'].join(' ');
  const rows=[];let row='';for(const w of wake.split(' ')){if(row&&(row+' '+w).length>76){rows.push(row);row=w;}else row=row?row+' '+w:w;}rows.push(row);
  assert.ok(rows.length+3>=14,'the wake, its rule and the hint fill the 14-row window: the spinner scrolls out');
  const queued=['✢ Transmuting… (running PreToolUse hook · 1m 26s · ↓ 3.9k tokens)','─────',...rows.map((r,i)=>(i?'  ':'❯ ')+r),'─────',
    '  Press up to edit queued messages, Enter to send them immediately'].join('\n');
  assert.equal(classifyAgentScreen(queued,{sentText:wake}).state,'active');
  assert.equal(wakeDeliveryOf({before:KERNEL_IDLE,after:queued,text:wake}).delivery,'queued');
  // The same rows with no queued hint are still a staged wake that needs its Enter.
  const staged=['✻ Brewed for 3m 2s','─────',...rows.map((r,i)=>(i?'  ':'❯ ')+r)].join('\n');
  assert.equal(classifyAgentScreen(staged,{sentText:wake}).state,'staged-input');
});

/* ------------------------------------------------ transition wake (api report) */

const reportWorld=t=>{
  const w=world(t,'starci-transition-wake-');
  const run=(args,more={})=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...w.env,...more}});
  const workflowId='wf-transition-wake',jobId='job-transition-wake';
  const ledger=openLedger({file:ledgerFileFor(w.repo)});
  try{
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}});
    ledger.db.prepare("UPDATE workflows SET phase='queued' WHERE workflow_id=?").run(workflowId);
    signalKernel(ledger,workflowId);
  }finally{ledger.close();}
  const d=run(['dispatch','--repo',w.repo,'--job',jobId,'--model','codex-agent','--spawn','--json']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  w.seedKernelTerminal();
  const report=path.join(w.repo,'report.json');
  fs.writeFileSync(report,JSON.stringify({schema:'starci/op-report@1',outcome:'done',summary:'op done',files:['docs/a.md'],
    checks:[{name:'self-check',command:'true',exitCode:0}],head:'abc1234def'}));
  const fileReport=more=>{
    const r=run(['report','--repo',w.repo,'--job',jobId,'--report',report,'--json'],more);
    assert.equal(r.status,0,`the report is authoritative whatever the wake does: ${r.stderr||r.stdout}`);
    const open=r.stdout.indexOf('{'),close=r.stdout.indexOf('\n}');
    return JSON.parse(r.stdout.slice(open,close+2));
  };
  const woken=()=>{
    const l=inspectLedger({file:ledgerFileFor(w.repo)});
    try{return l.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-transition-woken' ORDER BY seq").all(workflowId).map(r=>json(r.payload_json));}
    finally{l.close();}
  };
  return {...w,fileReport,woken};
};

test('transition wake: agent_prompt_stalled with the wake landed on the Kernel screen is kernel-woken',t=>{
  const fx=reportWorld(t);
  const out=fx.fileReport({STARCI_FAKE_ORCA_SEND_STALLED:'landed'});
  const wake=out.kernelWake;
  assert.deepEqual([wake.action,wake.delivery,wake.evidence,wake.sendErrorCode,wake.state],
    ['kernel-woken','delivered','wake-text','agent_prompt_stalled','turn-idle'],JSON.stringify(wake));
  assert.equal(fx.kernelWakes().length,1,'one wake, no retry');
  const [event]=fx.woken();
  assert.deepEqual([event.transition,event.priorState,event.delivery,event.sendErrorCode],['report-filed:done','turn-idle','delivered','agent_prompt_stalled']);
});

test('transition wake: a wake queued behind the Kernel turn is kernel-woken as queued',t=>{
  const fx=reportWorld(t);
  const wake=fx.fileReport({STARCI_FAKE_ORCA_SEND_STALLED:'queued'}).kernelWake;
  assert.deepEqual([wake.action,wake.delivery,wake.evidence],['kernel-woken','queued','queued-marker']);
  assert.equal(fx.woken().length,1);
});

test('transition wake: a stalled send the screen does not show is kernel-wake-failed with no event',t=>{
  const fx=reportWorld(t);
  const wake=fx.fileReport({STARCI_FAKE_ORCA_SEND_STALLED:'lost'}).kernelWake;
  assert.deepEqual([wake.action,wake.delivery,wake.sendErrorCode],['kernel-wake-failed','failed','agent_prompt_stalled'],JSON.stringify(wake));
  assert.equal(fx.woken().length,0,'no kernel-transition-woken for a wake that never landed');
});

/* --------------------------------------------------------------- watchdog */

const watchdogWorld=t=>{
  const w=world(t,'starci-watchdog-wake-');
  const workflowId='wf-watchdog-wake';
  const ledger=openLedger({file:ledgerFileFor(w.repo)});
  try{
    ledger.ensureWorkflow({workflowId,title:'watchdog wake proof'});
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(workflowId,0,'watchdog-wake','# goal','{}',Date.now());
    signalKernel(ledger,workflowId);
  }finally{ledger.close();}
  w.seedKernelTerminal();
  const tick=more=>{
    const r=spawnSync(process.execPath,[WATCHDOG,'--repo',w.repo,'--workflow',workflowId,'--once','--repair','--json'],
      {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...w.env,...more}});
    return {status:r.status,result:json(r.stdout.trim().split('\n').at(-1)),stderr:r.stderr};
  };
  return {...w,workflowId,tick};
};

test('watchdog wake: agent_prompt_stalled with the wake landed is woken, not retried and not a failed tick',t=>{
  const fx=watchdogWorld(t);
  const {status,result,stderr}=fx.tick({STARCI_FAKE_ORCA_SEND_STALLED:'landed'});
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.deepEqual([result.ok,result.action,result.delivery,result.evidence,result.sendErrorCode,result.error],
    [true,'woken','delivered','wake-text','agent_prompt_stalled',null],JSON.stringify(result));
  const wakes=fx.kernelWakes();
  assert.equal(wakes.length,1,'exactly one wake: a delivered wake is not retried');
  assert.match(wakes[0].text,/Watchdog liveness wake for wf-watchdog-wake/);
});

test('watchdog wake: a wake queued behind the running turn is woken as queued',t=>{
  const fx=watchdogWorld(t);
  const {status,result}=fx.tick({STARCI_FAKE_ORCA_SEND_STALLED:'queued'});
  assert.equal(status,0,JSON.stringify(result));
  assert.deepEqual([result.ok,result.action,result.delivery,result.evidence],[true,'woken','queued','queued-marker']);
  assert.equal(fx.kernelWakes().length,1);
});

test('watchdog wake: a stalled send the screen does not show is still wake-failed',t=>{
  const fx=watchdogWorld(t);
  const {status,result}=fx.tick({STARCI_FAKE_ORCA_SEND_STALLED:'lost'});
  assert.equal(status,1,'a screen-proven miss fails the tick');
  assert.deepEqual([result.ok,result.action,result.delivery,result.sendErrorCode],[false,'wake-failed','failed','agent_prompt_stalled'],JSON.stringify(result));
  assert.equal(result.error,'agent_prompt_stalled');
});

/* ---------------------------------------------------- ask-answered wake */

// scripts/api/orca/lib.mjs resolves the Orca command at import, so wakeKernel runs in a child
// that starts with the fake Orca in its environment.
const askWake=(w,workflowId,stalled)=>{
  const url=p=>JSON.stringify(new URL(p,import.meta.url).href);
  const code=`const {wakeKernel}=await import(${url('../scripts/kernel/serve-ask.mjs')});
const {openLedger,ledgerFileFor}=await import(${url('../engine/ledger-db.mjs')});
const ledger=openLedger({file:ledgerFileFor(${JSON.stringify(w.repo)})});
try{console.log(JSON.stringify(wakeKernel(ledger,{workflowId:${JSON.stringify(workflowId)},dispatchId:'ctx_ask',receiptPath:'receipt.json'})));}
finally{ledger.close();}`;
  const r=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,
    env:{...w.env,STARCI_FAKE_ORCA_SEND_STALLED:stalled}});
  assert.equal(r.status,0,r.stderr||r.stdout);
  return json(r.stdout.trim().split('\n').at(-1));
};

test('ask-answered wake: agent_prompt_stalled with the wake landed is kernel-woken with its event; a miss still fails',t=>{
  const w=world(t,'starci-ask-wake-');
  const workflowId='wf-ask-wake';
  const ledger=openLedger({file:ledgerFileFor(w.repo)});
  try{ledger.ensureWorkflow({workflowId,title:'ask wake proof'});signalKernel(ledger,workflowId);}finally{ledger.close();}
  w.seedKernelTerminal();
  const woke=askWake(w,workflowId,'landed');
  assert.deepEqual([woke.action,woke.delivery,woke.sendErrorCode],['kernel-woken','delivered','agent_prompt_stalled'],JSON.stringify(woke));
  const events=()=>{
    const l=inspectLedger({file:ledgerFileFor(w.repo)});
    try{return l.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='kernel-transition-woken'").all(workflowId).map(r=>json(r.payload_json));}
    finally{l.close();}
  };
  assert.deepEqual(events().map(e=>[e.transition,e.delivery]),[['ask-answered','delivered']]);
  // A fresh idle frame, and this time the stalled wake never reaches the screen.
  w.seedKernelTerminal();
  const missed=askWake(w,workflowId,'lost');
  assert.deepEqual([missed.action,missed.delivery,missed.error],['kernel-wake-failed','failed','agent_prompt_stalled'],JSON.stringify(missed));
  assert.equal(events().length,1,'no event for the wake that never landed');
});

/* ------------------------------------------ dropped send (Codex), split retry */

// 2026-09-24 01:45: the Codex Kernel term_28a694d9 (wf-miamia-base-repos) took two text+Enter sends that
// Orca answered ok:true with no error code while nothing reached the screen; its ledger was silent from
// 19:59, every watchdog wake dropped the same way. The same text with enter:false staged in the input row
// and an Enter-only send submitted it. Every Kernel wake path now retries a wake whose frame stays idle with
// no trace of it once that way (scripts/kernel/wake-delivery.mjs) - STARCI_FAKE_ORCA_DROP_ENTER_SEND.
const CODEX_KERNEL_IDLE=['• Yielding - waiting on the base-repos report.','','› Ask Codex to do anything','','  gpt-6-sol high · 62% context left'].join('\n');
const CODEX_COMMAND='codex -m gpt-6-sol';
const shapes=wakes=>wakes.map(w=>[w.text?'wake':'',w.enter]);

test('transition wake: a dropped text+Enter send to a Codex Kernel is kernel-woken after the split retry',t=>{
  const fx=reportWorld(t);
  fx.seedKernelTerminal(CODEX_KERNEL_IDLE,CODEX_COMMAND);
  const wake=fx.fileReport({STARCI_FAKE_ORCA_DROP_ENTER_SEND:'1'}).kernelWake;
  assert.deepEqual([wake.action,wake.delivery,wake.evidence,wake.splitRetried,wake.splitOutcome],
    ['kernel-woken','delivered','wake-text',true,'delivered-after-split'],JSON.stringify(wake));
  assert.deepEqual(shapes(fx.kernelWakes()),[['wake',true],['wake',false],['',true]],'the dropped send, the staged text, one Enter');
  const [event]=fx.woken();
  assert.deepEqual([event.delivery,event.splitRetried,event.splitOutcome],['delivered',true,'delivered-after-split']);
});

test('watchdog wake: a dropped send to a Codex Kernel is woken after the split retry; an unstaged split is wake-failed',t=>{
  const fx=watchdogWorld(t);
  fx.seedKernelTerminal(CODEX_KERNEL_IDLE,CODEX_COMMAND);
  const {status,result,stderr}=fx.tick({STARCI_FAKE_ORCA_DROP_ENTER_SEND:'1'});
  assert.equal(status,0,stderr||JSON.stringify(result));
  assert.deepEqual([result.ok,result.action,result.delivery,result.evidence,result.splitRetried,result.splitOutcome,result.error],
    [true,'woken','delivered','wake-text',true,'delivered-after-split',null],JSON.stringify(result));
  const wakes=fx.kernelWakes();
  assert.deepEqual(shapes(wakes),[['wake',true],['wake',false],['',true]]);
  assert.match(wakes[1].text,/Watchdog liveness wake for wf-watchdog-wake/);

  const lost=watchdogWorld(t);
  lost.seedKernelTerminal(CODEX_KERNEL_IDLE,CODEX_COMMAND);
  const missed=lost.tick({STARCI_FAKE_ORCA_DROP_ENTER_SEND:'all'});
  assert.equal(missed.status,1,'a wake the split could not stage fails the tick');
  assert.deepEqual([missed.result.ok,missed.result.action,missed.result.delivery,missed.result.splitRetried,missed.result.splitOutcome],
    [false,'wake-failed','failed',true,'unstaged'],JSON.stringify(missed.result));
  assert.deepEqual(shapes(lost.kernelWakes()),[['wake',true],['wake',false]],'no blind Enter');
});
