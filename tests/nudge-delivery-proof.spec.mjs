import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {wakeDeliveryOf} from '../scripts/kernel/terminal-liveness.mjs';
import {sendWakeWithProof,sendEnterWithProof} from '../scripts/kernel/wake-delivery.mjs';

// inc-b87a42ec8690, inc-e4f69f9ef061, inc-13ab4be5059f (part 2): `api nudge` returned ok:false
// terminal-send-failed and wrote no op-worker-nudged event whenever Orca answered agent_prompt_stalled,
// although the wake sat on the worker's screen (landed, or queued behind its running turn). Nudge now reads
// the frame before and after the send and reports delivered / queued / failed from the screen.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

const WAKE='Operation liveness wake for durable job op-architecture.decide-173438ab83 (architecture.decide) attempt 1. Your accepted contract remains running but no durable report is filed.';
const CHROME=['─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
const IDLE=['● Waiting on the op-contract read.','✻ Brewed for 3m 2s',...CHROME].join('\n');
const wrap=(text,width=76)=>{const rows=[];let row='';for(const w of text.split(' ')){if(row&&(row+' '+w).length>width){rows.push(row);row=w;}else row=row?row+' '+w:w;}if(row)rows.push(row);return rows;};
const QUEUED=['✢ Transmuting… (running PreToolUse hook · 1m 26s · ↓ 3.9k tokens)','─────',...wrap(WAKE).map((r,i)=>(i?'  ':'❯ ')+r),'─────','  Press up to edit queued messages, Enter to send them immediately'].join('\n');
const LANDED=[IDLE,...wrap(WAKE).map((r,i)=>(i?'  ':'❯ ')+r),'✻ Pondering… (2s · ↓ 12 tokens)',...CHROME].join('\n');

/* ------------------------------------------------------------------ units */

test('the screen proves a wake delivered, queued, staged or not at all',()=>{
  assert.equal(wakeDeliveryOf({before:IDLE,after:LANDED,text:WAKE}).delivery,'delivered');
  assert.equal(wakeDeliveryOf({before:IDLE,after:QUEUED,text:WAKE}).delivery,'queued');
  assert.equal(wakeDeliveryOf({before:IDLE,after:IDLE,text:WAKE}).delivery,'unproven');
  // An older wake still in scrollback proves nothing about this one.
  assert.equal(wakeDeliveryOf({before:LANDED,after:LANDED,text:WAKE}).delivery,'unproven');
  // A queued marker that was already there before the send needs the wake text beside it.
  const oldMarker=[IDLE,'  Press up to edit queued messages'].join('\n');
  assert.equal(wakeDeliveryOf({before:oldMarker,after:oldMarker,text:WAKE}).delivery,'unproven');
  // Typed but never submitted: the wake sits in the input row of an idle frame.
  const staged=['● Waiting on the op-contract read.','✻ Brewed for 3m 2s','─────',...wrap(WAKE).map((r,i)=>(i?'  ':'❯ ')+r)].join('\n');
  assert.equal(wakeDeliveryOf({before:IDLE,after:staged,text:WAKE}).delivery,'staged');
});

const stub=({sends,screens})=>{
  const calls=[];let reads=0;
  return {calls,deps:{
    send:(input)=>{calls.push(input);return sends.shift()??{ok:true};},
    read:()=>({ok:true,screen:screens[Math.min(reads++,screens.length-1)]}),
    sleep:()=>{},
  }};
};

test('sendWakeWithProof: agent_prompt_stalled with the wake on screen is delivered or queued, never failed',()=>{
  const stalled={ok:false,errorCode:'agent_prompt_stalled',error:'agent_prompt_stalled'};
  let s=stub({sends:[stalled],screens:[IDLE,QUEUED]});
  let r=sendWakeWithProof({terminal:'t',text:WAKE,deps:s.deps});
  assert.deepEqual([r.ok,r.delivery,r.evidence,r.sendErrorCode],[true,'queued','queued-marker','agent_prompt_stalled']);
  assert.equal(s.calls.length,1,'one send, no retry');
  s=stub({sends:[stalled],screens:[IDLE,IDLE,LANDED]});
  r=sendWakeWithProof({terminal:'t',text:WAKE,deps:s.deps});
  assert.deepEqual([r.ok,r.delivery,r.evidence],[true,'delivered','wake-text'],'a later repaint still proves it');
  s=stub({sends:[stalled],screens:[IDLE]});
  r=sendWakeWithProof({terminal:'t',text:WAKE,deps:s.deps});
  assert.deepEqual([r.ok,r.delivery,r.evidence],[false,'failed','unproven'],'nothing on screen is a real failure');
  // agent_prompt_blocked: terminal-send already followed it with an Enter-only send that Orca confirmed.
  s=stub({sends:[{ok:true,errorCode:null,enterRetry:{after:'agent_prompt_blocked',ok:true}}],screens:[IDLE,IDLE]});
  r=sendWakeWithProof({terminal:'t',text:WAKE,deps:s.deps});
  assert.deepEqual([r.ok,r.delivery,r.evidence,r.sendErrorCode],[true,'delivered','receipt','agent_prompt_blocked']);
  // Blocked and the Enter retry refused too, but the wake landed.
  s=stub({sends:[{ok:false,errorCode:'agent_prompt_blocked',enterRetry:{after:'agent_prompt_blocked',ok:false}}],screens:[IDLE,LANDED]});
  r=sendWakeWithProof({terminal:'t',text:WAKE,deps:s.deps});
  assert.deepEqual([r.ok,r.delivery],[true,'delivered']);
});

test('sendWakeWithProof: a wake left in the input row gets one Enter-only send',()=>{
  const staged=['✻ Brewed for 3m 2s','─────',...wrap(WAKE).map((r,i)=>(i?'  ':'❯ ')+r)].join('\n');
  const s=stub({sends:[{ok:false,errorCode:'agent_prompt_stalled'},{ok:true}],screens:[IDLE,staged,LANDED]});
  const r=sendWakeWithProof({terminal:'t',text:WAKE,deps:s.deps});
  assert.deepEqual([r.ok,r.delivery,r.enterRetried],[true,'delivered',true]);
  assert.deepEqual(s.calls.map(c=>[c.text===WAKE?'wake':c.text,c.enter]),[['wake',true],['',true]]);
  const e=stub({sends:[{ok:false,errorCode:'agent_prompt_stalled'}],screens:['✻ Brewed for 3m 2s\n✶ Pondering… (3s)\n❯']});
  const entered=sendEnterWithProof({terminal:'t',sentText:WAKE,deps:e.deps});
  assert.deepEqual([entered.ok,entered.delivery,entered.evidence],[true,'delivered','screen'],'a stalled Enter whose paste left the input row submitted it');
});

/* ------------------------------------------------------------ fake Orca */

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-nudge-proof-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const stubFile=path.join(root,'fake-orca.mjs');fs.writeFileSync(stubFile,FAKE_ORCA);
  const stateFile=path.join(root,'state.json'),logFile=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stubFile]),
    STARCI_FAKE_ORCA_LOG:logFile,STARCI_FAKE_ORCA_STATE:stateFile};
  const run=(args,more={})=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...env,...more}});
  const orcaState=()=>json(fs.readFileSync(stateFile,'utf8'))??{};
  const writeState=fn=>{const s=orcaState();fn(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  const workflowId='wf-nudge-proof',jobId='job-nudge-proof';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}});
  }finally{ledger.close();}
  const events=kind=>{
    const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq').all(jobId,kind).map(r=>json(r.payload_json));}
    finally{l.close();}
  };
  const d=run(['dispatch','--repo',repo,'--job',jobId,'--model','codex-agent','--spawn','--json']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  // The worker sits at its prompt: status calls it turn-idle and nudge wakes it.
  writeState(s=>{s.terminals['fake-terminal-1'].screen=IDLE;});
  return {repo,workflowId,jobId,run,events,orcaState};
};

test('nudge: agent_prompt_stalled with the wake queued on screen is a queued nudge with its event',t=>{
  const fx=fixture(t);
  const status=json(fx.run(['status','--repo',fx.repo,'--workflow',fx.workflowId,'--json']).stdout);
  assert.equal(status.workers.find(w=>w.jobId===fx.jobId).liveness,'turn-idle');
  const r=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json'],{STARCI_FAKE_ORCA_SEND_STALLED:'queued'});
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=json(r.stdout);
  assert.deepEqual([out.ok,out.nudged,out.delivery,out.evidence,out.sendErrorCode],[true,true,'queued','queued-marker','agent_prompt_stalled']);
  const [event]=fx.events('op-worker-nudged');
  assert.deepEqual([event.delivery,event.sendErrorCode,event.priorLiveness],['queued','agent_prompt_stalled','turn-idle']);
});

test('nudge: agent_prompt_stalled with the wake landed is delivered; with nothing on screen it fails truthfully',t=>{
  const fx=fixture(t);
  const landed=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json'],{STARCI_FAKE_ORCA_SEND_STALLED:'landed'});
  assert.equal(landed.status,0,landed.stderr||landed.stdout);
  assert.deepEqual([json(landed.stdout).delivery,json(landed.stdout).evidence],['delivered','wake-text']);
  assert.equal(fx.events('op-worker-nudged').length,1);

  const lost=fixture(t);
  const r=lost.run(['nudge','--repo',lost.repo,'--job',lost.jobId,'--json'],{STARCI_FAKE_ORCA_SEND_STALLED:'lost'});
  assert.equal(r.status,1);
  const out=json(r.stdout);
  assert.deepEqual([out.ok,out.reason,out.delivery,out.sendErrorCode],[false,'terminal-send-failed','failed','agent_prompt_stalled']);
  assert.equal(lost.events('op-worker-nudged').length,0,'no event for a wake that never landed');
});

test('nudge: agent_prompt_blocked followed by a confirmed Enter-only send is delivered',t=>{
  const fx=fixture(t);
  const r=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json'],{STARCI_FAKE_ORCA_STUCK_PASTE:'blocked'});
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=json(r.stdout);
  assert.deepEqual([out.nudged,out.delivery,out.sendErrorCode],[true,'delivered','agent_prompt_blocked']);
  assert.equal(fx.orcaState().terminals['fake-terminal-1'].enters,1,'terminal-send sent the one Enter');
  assert.equal(fx.events('op-worker-nudged')[0].sendErrorCode,'agent_prompt_blocked');
});
