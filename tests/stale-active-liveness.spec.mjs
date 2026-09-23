import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {allocationMs} from '../engine/config.mjs';
import {classifyAgentScreen,staleAwareState} from '../scripts/kernel/terminal-liveness.mjs';

// 2026-09-24: both starci-next Kernels printed nothing for ~3.7 hours; their screens ended with a
// finished answer at the prompt, but older spinner rows stayed in the last lines, so the watchdog
// reported `action: active, outputAgeMs: 13365199` every tick and never woke them.
const ROOT=path.resolve(import.meta.dirname,'..');
const WATCHDOG=path.join(ROOT,'scripts','kernel','watchdog.mjs');
const STALE_MS=allocationMs('liveness.activeStaleMs');

// A Codex Kernel frame: the old spinner row, then the finished answer, then the prompt.
const FINISHED_AFTER_SPINNER=[
  '• Ran node scripts/kernel/api.mjs status --repo D:\\Repositories\\starci-next --workflow wf-x',
  '  └ wf-x phase=running frontier=engaged ACTIONABLE',
  '• Working (12m 03s • esc to interrupt) · 1 background terminal running',
  '• No new report or repair is recorded. The queued ordinal-1 retry still has invalid lineage, so',
  '  it remains fenced under incident inc-72839f63a1f5. The workflow awaits the runtime repair.',
  '  done 11:27 PM',
  '› Ask Codex to do anything',
  '  gpt-6-sol high · D:\\Repositories\\starci-next · Orchestrate starci-next workflow',
].join('\n');
// A live Codex turn: the spinner sits directly above the input row.
const SPINNER_LAST=[
  '• Slice 2 launch was rejected before an accepted contract; rerouting it.',
  '• Ran node scripts/kernel/api.mjs route --job op-x --prefer devin-agent --json',
  '  └ {"ok": true}',
  '• Working (3m 44s • esc to interrupt) · 1 background terminal running · /ps to view',
  '› Ask Codex to do anything',
  '  gpt-6-sol high · D:\\Repositories\\starci-next · Prepare starci-next base repos',
].join('\n');

test('a finished answer and prompt after the last spinner row is turn-idle; the last rows decide',()=>{
  assert.equal(classifyAgentScreen(FINISHED_AFTER_SPINNER).state,'turn-idle');
  assert.equal(classifyAgentScreen(SPINNER_LAST).state,'active');
  // A Claude todo list under a live spinner and blank/rule chrome are not a finished answer.
  const claudeLive='● Reading the contract\n✻ Working… (41s · esc to interrupt)\n  ⎿  ☐ Consume report\n     ☐ Settle\n────────\n> \n  ? for shortcuts';
  assert.equal(classifyAgentScreen(claudeLive).state,'active');
  // A Devin queued message under a live spinner is still a running turn.
  assert.equal(classifyAgentScreen('⠉⠁ Thinking · 4m 46s (esc twice to interrupt)\n❭ Press Enter to send queued messages now').state,'active');
});

test('an active frame is trusted only while output is recent (allocation.liveness.activeStaleMs)',()=>{
  assert.equal(STALE_MS,600000,'the threshold is data in modules/models/runtimes.yaml');
  assert.deepEqual(staleAwareState('active',5000,STALE_MS),{state:'active',staleActive:false,reason:null});
  assert.deepEqual(staleAwareState('active',13365199,STALE_MS),{state:'turn-idle',staleActive:true,reason:'stale-active'});
  assert.equal(staleAwareState('active',null,STALE_MS).state,'active','an unknown output age proves nothing');
  assert.equal(staleAwareState('wedged',13365199,STALE_MS).state,'wedged','only active is re-read');
  assert.equal(staleAwareState('turn-idle',13365199,STALE_MS).staleActive,false);
});

// A canned Orca for the watchdog: `terminal show` reports STARCI_TEST_LAST_OUTPUT_AT, `terminal read`
// shows STARCI_TEST_SCREEN, `terminal send` appends its argv to STARCI_TEST_SEND_LOG. A submitted wake
// shows on the next frame (echoed under the input glyph, a turn running): scripts/kernel/wake-delivery.mjs
// retries a wake whose frame stays idle with no trace of it as lost.
const STUB=String.raw`const fs=require('fs');const argv=process.argv.slice(2);const verb=argv.slice(0,2).join(' ');
const out=o=>console.log(JSON.stringify(o));const handle='kern-term-1';
if(verb==='terminal show'){out({ok:true,result:{terminal:{handle,connected:true,writable:true,status:'running',lastOutputAt:Number(process.env.STARCI_TEST_LAST_OUTPUT_AT)}}});process.exit(0);}
if(verb==='terminal read'){const log=process.env.STARCI_TEST_SEND_LOG;
  const sent=(fs.existsSync(log)?fs.readFileSync(log,'utf8').trim().split('\n').filter(Boolean).map(l=>JSON.parse(l)):[])
    .filter(a=>a.includes('--enter')&&a.indexOf('--text')>=0&&a[a.indexOf('--text')+1]).at(-1);
  const screen=(process.env.STARCI_TEST_SCREEN||'')+(sent?'\n› '+sent[sent.indexOf('--text')+1]+'\n• Working (1s • esc to interrupt)\n› Ask Codex to do anything':'');
  out({ok:true,result:{terminal:{handle,screen}}});process.exit(0);}
if(verb==='terminal send'){fs.appendFileSync(process.env.STARCI_TEST_SEND_LOG,JSON.stringify(argv)+'\n');out({ok:true,result:{sent:true}});process.exit(0);}
out({ok:true,result:{}});`;

const watchdogOnce=(t,{screen,outputAgeMs})=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stale-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const wf='wf-stale-active';
  const ledger=openLedger({file:ledgerFileFor(dir)});
  try{
    const at=Date.now();
    ledger.ensureWorkflow({workflowId:wf,title:'stale active'});
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(wf,0,'stale','# goal','{}',at);
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,NULL,?,?,?,NULL)")
      .run(wf,'kernel-test',JSON.stringify({terminal:'kern-term-1',host:'orca',agent:'codex'}),at);
  }finally{ledger.close();}
  const stub=path.join(dir,'orca-stub.cjs'),sendLog=path.join(dir,'sends.jsonl');
  fs.writeFileSync(stub,STUB);
  const r=spawnSync(process.execPath,[WATCHDOG,'--repo',dir,'--workflow',wf,'--once','--repair','--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,
    env:{...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),STARCI_ORCA_SKIP_LIVE_CHECK:'1',
      STARCI_TEST_SCREEN:screen,STARCI_TEST_LAST_OUTPUT_AT:String(Date.now()-outputAgeMs),STARCI_TEST_SEND_LOG:sendLog}});
  const result=JSON.parse(r.stdout.trim().split('\n').at(-1));
  const sends=fs.existsSync(sendLog)?fs.readFileSync(sendLog,'utf8').trim().split('\n').filter(Boolean):[];
  return {result,sends};
};

test('watchdog: a spinner-last frame with fresh output stays active and is not woken',t=>{
  const {result,sends}=watchdogOnce(t,{screen:SPINNER_LAST,outputAgeMs:5000});
  assert.deepEqual([result.action,result.state],['active','active']);
  assert.equal(result.reason,undefined);
  assert.equal(sends.length,0);
});

test('watchdog: a spinner-last frame past activeStaleMs is stale-active and woken through terminal send',t=>{
  const {result,sends}=watchdogOnce(t,{screen:SPINNER_LAST,outputAgeMs:STALE_MS+60000});
  assert.equal(result.action,'woken',JSON.stringify(result));
  assert.deepEqual([result.reason,result.livenessReason,result.screenState],['stale-active','stale-active','active']);
  assert.equal(sends.length,1,'exactly one wake through the canonical terminal-send path');
  assert.match(sends[0],/Watchdog liveness wake for wf-stale-active/);
});

test('watchdog: a finished answer after an old spinner is turn-idle and woken',t=>{
  const {result,sends}=watchdogOnce(t,{screen:FINISHED_AFTER_SPINNER,outputAgeMs:120000});
  assert.equal(result.action,'woken',JSON.stringify(result));
  assert.equal(result.livenessReason,undefined,'turn-idle on its own frame, not by the stale rule');
  assert.equal(sends.length,1);
});
