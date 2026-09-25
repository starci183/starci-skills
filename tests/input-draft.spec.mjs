import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

// Orca's `terminal read` lifts the text of an agent's input box out of the frame and answers it as
// `draft`. terminal-read.mjs dropped it, so no reader saw text waiting unsubmitted: a send without
// Enter, or one whose Enter was dropped, left a hidden draft and every later send was appended to it
// (nivo collab Kernel, 2026-09-25). The draft is now read, put back in the input row for the
// classifier, owned or refused before any wake is typed, and cleared with bounded Ctrl+U.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const CHROME=['─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
const IDLE=['● Waiting on the code.refactor report.','✻ Brewed for 3m 2s',...CHROME].join('\n');
const WAKE='Watchdog liveness wake for wf-draft. The approved workflow is still phase=running, but the prior model turn returned to the terminal input prompt.';
const OTHER='Durable transition wake for workflow wf-draft: report-filed:done. Operation job op-x filed dispatch ctx_1.';

// The fake Orca binary: terminals[h] carries screen, draft, draftMode, draftStuck (tests/helpers/fake-orca.mjs).
const orcaWorld=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-input-draft-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const stubFile=path.join(root,'fake-orca.mjs');fs.writeFileSync(stubFile,FAKE_ORCA);
  const stateFile=path.join(root,'state.json'),logFile=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stubFile]),
    STARCI_FAKE_ORCA_LOG:logFile,STARCI_FAKE_ORCA_STATE:stateFile,LOCALAPPDATA:path.join(root,'localappdata')};
  const orcaState=()=>(fs.existsSync(stateFile)?json(fs.readFileSync(stateFile,'utf8')):null)??{sends:0};
  const writeState=fn=>{const s=orcaState();fn(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  const seed=(handle,fields)=>writeState(s=>{s.sends??=0;s.terminals={...(s.terminals??{}),[handle]:{handle,connected:true,writable:true,sent:false,prompt:null,
    command:'claude --model claude-opus-5-5',screen:IDLE,...fields}};});
  // Run one exported function of a runtime module in a child process against the fake Orca.
  const call=(module,fn,input)=>{
    const code=`const m=await import(${JSON.stringify(new URL(`../${module}`,import.meta.url).href)});const input=JSON.parse(process.argv[1]);
      process.stdout.write(JSON.stringify(await m[${JSON.stringify(fn)}](input)));`;
    const r=spawnSync(process.execPath,['--input-type=module','-e',code,JSON.stringify(input)],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
    assert.equal(r.status,0,r.stderr);
    return json(r.stdout);
  };
  const term=h=>orcaState().terminals[h];
  return {root,env,orcaState,writeState,seed,call,term};
};

/* ------------------------------------------------------------------ units */

test('the classifier reads the draft in the input row: the runtime\'s own text is staged input, anyone else\'s is not',async()=>{
  const {classifyAgentScreen,frameWithDraft,draftOwnership}=await import('../scripts/kernel/terminal-liveness.mjs');
  assert.equal(classifyAgentScreen(IDLE,{sentText:WAKE}).state,'turn-idle','the frame alone shows an empty prompt');
  assert.equal(classifyAgentScreen(IDLE,{sentText:WAKE,draft:WAKE}).state,'staged-input');
  assert.equal(classifyAgentScreen(IDLE,{sentText:WAKE,draft:'please look at the lint first'}).state,'turn-idle');
  assert.match(frameWithDraft(IDLE,'two\nrows'),/^❯ two rows$/m,'the draft goes into the last input row, one row');
  assert.match(frameWithDraft('Codex\n  gpt-6 high · 62% left','[Pasted Content 900 chars]'),/› \[Pasted Content 900 chars\]$/,'no input row: appended');
  assert.equal(classifyAgentScreen('Codex\n  gpt-6 high · 62% left',{draft:'[Pasted Content 900 chars]'}).state,'staged-input');
  assert.equal(draftOwnership('',{texts:[WAKE]}).kind,'none');
  assert.equal(draftOwnership(WAKE,{texts:[WAKE]}).kind,'own');
  assert.equal(draftOwnership(`${WAKE} ${WAKE}`,{texts:[WAKE]}).kind,'runtime','wakes piled up are runtime text, not one submission');
  assert.equal(draftOwnership(`${OTHER} ${WAKE.slice(0,50)}`,{texts:[WAKE]}).kind,'runtime','another path\'s wake plus a cut-short one');
  assert.equal(draftOwnership(`${WAKE} also fix the lint`,{texts:[WAKE]}).kind,'foreign','words the runtime never typed');
  assert.equal(draftOwnership('[watchdog] wake: api status',{texts:[WAKE]}).kind,'foreign');
});

/* ---------------------------------------------------------- fake Orca: the read */

test('terminal-read returns the draft Orca reports beside the frame',t=>{
  const w=orcaWorld(t);
  w.seed('term-a',{draft:'continue to cut 6'});
  w.seed('term-b',{});
  const a=w.call('scripts/api/orca/terminal-read.mjs','terminalRead',{terminal:'term-a'});
  assert.deepEqual([a.ok,a.draft],[true,'continue to cut 6']);
  assert.ok(!a.screen.includes('continue to cut 6'),'Orca keeps the draft out of the frame');
  assert.equal(w.call('scripts/api/orca/terminal-read.mjs','terminalRead',{terminal:'term-b'}).draft,null);
});

/* ------------------------------------------------------- fake Orca: clear-draft */

test('clearDraft sends Ctrl+U until the draft reads empty, and stops at its bound',t=>{
  const w=orcaWorld(t);
  w.seed('term-a',{draft:'row one\nrow two\nrow three'});
  const r=w.call('scripts/kernel/clear-draft.mjs','clearDraft',{terminal:'term-a',intervalMs:0});
  assert.deepEqual([r.ok,r.cleared,r.sends,r.draft],[true,true,3,null]);
  assert.deepEqual(w.term('term-a').keys.map(k=>[k.text,k.enter]),[['\u0015',false],['\u0015',false],['\u0015',false]],'Ctrl+U only, never Enter');
  w.seed('term-b',{draft:'stuck text\nrow two\nrow three',draftKeep:1});
  const stuck=w.call('scripts/kernel/clear-draft.mjs','clearDraft',{terminal:'term-b',intervalMs:0,attempts:4});
  assert.deepEqual([stuck.ok,stuck.reason,stuck.sends,stuck.draft],[false,'draft-stuck',4,'stuck text'],'a draft that shrinks but will not empty is stuck');
  w.seed('term-c',{});
  assert.deepEqual(w.call('scripts/kernel/clear-draft.mjs','clearDraft',{terminal:'term-c',intervalMs:0}),{ok:true,cleared:false,sends:0,initial:null,draft:null});
});

/* ------------------------------------------------------- fake Orca: wake delivery */

test('a wake whose Enter is dropped into the draft is submitted once by the Enter retry, never typed twice',t=>{
  const w=orcaWorld(t);
  w.seed('term-k',{draftMode:'drop-enter'});
  const r=w.call('scripts/kernel/wake-delivery.mjs','sendWakeWithProof',{terminal:'term-k',text:WAKE,intervalMs:0});
  assert.deepEqual([r.ok,r.delivery,r.enterRetried],[true,'delivered',true]);
  assert.deepEqual(w.term('term-k').submitted,[WAKE],'the agent received the wake exactly once');
  assert.equal(w.term('term-k').draft,'');
});

test('the runtime\'s own wake already in the draft gets one Enter; nothing is typed onto it',t=>{
  const w=orcaWorld(t);
  w.seed('term-k',{draft:WAKE});
  const r=w.call('scripts/kernel/wake-delivery.mjs','sendWakeWithProof',{terminal:'term-k',text:WAKE,intervalMs:0});
  assert.deepEqual([r.ok,r.delivery,r.evidence,r.draftSubmitted],[true,'delivered','draft-submitted',true]);
  assert.deepEqual(w.term('term-k').keys.map(k=>[k.text,k.enter]),[['',true]]);
  assert.deepEqual(w.term('term-k').submitted,[WAKE]);
});

test('piled runtime wakes are cleared with Ctrl+U before the wake is typed; the agent gets one clean wake',t=>{
  const w=orcaWorld(t);
  w.seed('term-k',{draft:`${OTHER}\n${WAKE.slice(0,60)}`});
  const r=w.call('scripts/kernel/wake-delivery.mjs','sendWakeWithProof',{terminal:'term-k',text:WAKE,intervalMs:0});
  assert.deepEqual([r.ok,r.delivery],[true,'delivered']);
  assert.deepEqual(w.term('term-k').keys.map(k=>k.text==='\u0015'?'^U':k.text===WAKE?'wake':k.text),['^U','^U','wake']);
  assert.deepEqual(w.term('term-k').submitted,[WAKE]);
});

test('real foreign text in the draft refuses the wake: one Ctrl+U probe, its cut typed back; a draft that will not empty refuses too',t=>{
  const w=orcaWorld(t);
  w.seed('term-k',{draft:'[watchdog] wake: api status'});
  const r=w.call('scripts/kernel/wake-delivery.mjs','sendWakeWithProof',{terminal:'term-k',text:WAKE,intervalMs:0});
  assert.deepEqual([r.ok,r.delivery,r.evidence,r.draft,r.sent],[false,'foreign-input','draft','[watchdog] wake: api status',null]);
  assert.deepEqual(r.draftProbe,{verdict:'real',sends:2,restored:true});
  assert.deepEqual(w.term('term-k').keys.map(k=>[k.text,k.enter]),[['\u0015',false],['[watchdog] wake: api status',false]],'the probe, then its cut typed back; the wake never');
  assert.equal(w.term('term-k').draft,'[watchdog] wake: api status','the owner\'s text is back in the box');
  assert.equal(w.term('term-k').submitted,undefined);
  w.seed('term-s',{draft:`${WAKE}\n${WAKE}`,draftKeep:1});
  const s=w.call('scripts/kernel/wake-delivery.mjs','sendWakeWithProof',{terminal:'term-s',text:WAKE,intervalMs:0});
  assert.deepEqual([s.ok,s.delivery],[false,'draft-stuck']);
  assert.ok(w.term('term-s').keys.every(k=>k.text==='\u0015'),'only Ctrl+U was sent');
});

test('sendEnterWithProof trusts the draft, not the receipt: an Enter that left the draft in place failed',async()=>{
  const {sendEnterWithProof}=await import('../scripts/kernel/wake-delivery.mjs');
  const calls=[];
  const deps=draft=>({send:x=>{calls.push(x);return {ok:true};},read:()=>({ok:true,screen:IDLE,draft}),sleep:()=>{}});
  const kept=sendEnterWithProof({terminal:'t',sentText:WAKE,deps:deps(WAKE)});
  assert.deepEqual([kept.ok,kept.delivery,kept.evidence],[false,'failed','draft-unsubmitted']);
  let n=0;
  const gone=sendEnterWithProof({terminal:'t',sentText:WAKE,deps:{...deps(null),read:()=>({ok:true,screen:IDLE,draft:n++===0?WAKE:null})}});
  assert.deepEqual([gone.ok,gone.delivery,gone.evidence],[true,'delivered','draft-submitted']);
});

/* ------------------------------------------------------------------ quit-agent */

test('quit-agent empties a draft before its quit command, and types nothing over a draft it cannot clear',t=>{
  const w=orcaWorld(t);
  w.seed('term-q',{command:'codex --model gpt-6-sol',draft:'half a contract'});
  const r=w.call('scripts/kernel/quit-agent.mjs','quitAgent',{handle:'term-q',agent:'codex',waitMs:0,intervalMs:0});
  assert.equal(r.sent,true);
  assert.deepEqual(w.term('term-q').keys.map(k=>[k.text==='\u0015'?'^U':k.text,k.enter]),[['^U',false],['/quit',true]]);
  assert.equal(w.term('term-q').submitted,undefined,'the draft was never submitted with /quit as its tail');
  assert.equal(w.term('term-q').quit,'/quit');
  w.seed('term-s',{command:'codex --model gpt-6-sol',draft:'half a contract\nsecond row',draftKeep:1});
  const s=w.call('scripts/kernel/quit-agent.mjs','quitAgent',{handle:'term-s',agent:'codex',waitMs:0,intervalMs:0});
  assert.deepEqual([s.sent,s.exited,s.reason,s.draft],[false,false,'draft-stuck','half a contract']);
  assert.ok(w.term('term-s').keys.every(k=>k.text==='\u0015'));
});

/* ------------------------------------------------------------------ api nudge */

const nudgeFixture=t=>{
  const w=orcaWorld(t);
  const repo=path.join(w.root,'repo');fs.mkdirSync(repo,{recursive:true});
  const run=(args,more={})=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...w.env,...more}});
  const workflowId='wf-nudge-draft',jobId='job-nudge-draft';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}});
  }finally{ledger.close();}
  const d=run(['dispatch','--repo',repo,'--job',jobId,'--model','codex-agent','--spawn','--json']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const events=kind=>{const l=inspectLedger({file:ledgerFileFor(repo)});
    try{return l.db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq').all(jobId,kind).map(r=>json(r.payload_json));}finally{l.close();}};
  return {...w,repo,workflowId,jobId,run,events};
};

test('nudge refuses a worker whose input box holds real foreign text in its draft; only the Ctrl+U probe and its restore are typed',t=>{
  const fx=nudgeFixture(t);
  fx.writeState(s=>{Object.assign(s.terminals['fake-terminal-1'],{screen:IDLE,draft:'continue to cut 6',keys:[]});s.sends=0;});
  const r=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']);
  assert.equal(r.status,1,r.stdout);
  const out=json(r.stdout);
  assert.deepEqual([out.ok,out.nudged,out.reason,out.input,out.inputSource],[false,false,'foreign-input','continue to cut 6','draft']);
  assert.deepEqual(out.draftProbe,{verdict:'real',sends:2,restored:true});
  const term=fx.orcaState().terminals['fake-terminal-1'];
  assert.deepEqual(term.keys.map(k=>[k.text,k.enter]),[['\u0015',false],['continue to cut 6',false]],'only the Ctrl+U probe and its restore');
  assert.equal(term.draft,'continue to cut 6');
  assert.equal(fx.events('op-worker-nudged').length,0);
});

test('nudge clears piled runtime wakes from the draft and delivers one clean wake',t=>{
  const fx=nudgeFixture(t);
  const pile=`Operation liveness wake for durable job ${fx.jobId} (code.refactor) attempt 1. Your accepted`;
  fx.writeState(s=>{Object.assign(s.terminals['fake-terminal-1'],{screen:IDLE,draft:`${pile}\n${pile}`,keys:[]});});
  const r=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']);
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=json(r.stdout);
  assert.deepEqual([out.nudged,out.delivery],[true,'delivered']);
  const term=fx.orcaState().terminals['fake-terminal-1'];
  assert.deepEqual(term.keys.map(k=>k.text==='\u0015'?'^U':k.text.startsWith('Operation liveness wake')?'wake':k.text),['^U','^U','wake']);
  assert.equal(term.submitted.length,1);
  assert.ok(term.submitted[0].startsWith(`Operation liveness wake for durable job ${fx.jobId}`)&&!term.submitted[0].includes(`${pile}${pile}`));
  assert.equal(fx.events('op-worker-nudged').length,1);
});

/* ------------------------------------------ a draft stale on Orca's side (sn-foundation, 2026-09-25) */
// Orca blanks the input row of every screen read that carries a draft, so the screen cannot tell a real
// draft from a stale one. On the sn-foundation Kernel (term_da5f72b3) Orca reported 'check status' that
// no Ctrl+U changed while the box was empty; every wake was refused and the Kernel looked unreachable.
// A draft the first Ctrl+U leaves unchanged is draft-stale: a note, never a refusal.

test('clearDraft and probeDraft: a draft Ctrl+U leaves unchanged is stale; one that shrinks is real',t=>{
  const w=orcaWorld(t);
  w.seed('term-a',{draft:'check status',draftStale:true});
  const c=w.call('scripts/kernel/clear-draft.mjs','clearDraft',{terminal:'term-a',intervalMs:0});
  assert.deepEqual([c.ok,c.stale,c.note,c.cleared,c.sends,c.draft],[true,true,'draft-stale',false,1,'check status']);
  assert.deepEqual(w.term('term-a').keys.map(k=>k.text),['\u0015'],'one Ctrl+U decides; no more are sent');
  const p=w.call('scripts/kernel/clear-draft.mjs','probeDraft',{terminal:'term-a',intervalMs:0});
  assert.deepEqual([p.verdict,p.note,p.draft,p.sends],['stale','draft-stale','check status',1]);
  w.seed('term-b',{draft:'please look at the lint first'});
  const real=w.call('scripts/kernel/clear-draft.mjs','probeDraft',{terminal:'term-b',intervalMs:0});
  assert.deepEqual([real.verdict,real.removed,real.restored,real.sends],['real','please look at the lint first',true,2]);
  assert.equal(w.term('term-b').draft,'please look at the lint first','a one-row cut is typed back');
  w.seed('term-c',{draft:'first row\nsecond row'});
  const rows=w.call('scripts/kernel/clear-draft.mjs','probeDraft',{terminal:'term-c',intervalMs:0});
  assert.deepEqual([rows.verdict,rows.removed,rows.restored,rows.sends],['real','second row',false,1],'a row cut from several is reported, never retyped');
  w.seed('term-d',{});
  assert.equal(w.call('scripts/kernel/clear-draft.mjs','probeDraft',{terminal:'term-d',intervalMs:0}).verdict,'none');
});

test('a stale foreign draft does not refuse the wake: draft-stale is noted and the wake lands once',t=>{
  const w=orcaWorld(t);
  w.seed('term-k',{draft:'check status',draftStale:true});
  const r=w.call('scripts/kernel/wake-delivery.mjs','sendWakeWithProof',{terminal:'term-k',text:WAKE,intervalMs:0});
  assert.deepEqual([r.ok,r.delivery,r.draftNote,r.staleDraft],[true,'delivered','draft-stale','check status']);
  assert.deepEqual(w.term('term-k').keys.map(k=>k.text==='\u0015'?'^U':k.text===WAKE?'wake':k.text),['^U','wake']);
  assert.deepEqual(w.term('term-k').submitted,[WAKE],'the agent got the wake, not the stale text');
});

test('stale runtime text in the draft is not draft-stuck: noted, and the wake is typed',t=>{
  const w=orcaWorld(t);
  w.seed('term-k',{draft:OTHER,draftStale:true});
  const r=w.call('scripts/kernel/wake-delivery.mjs','sendWakeWithProof',{terminal:'term-k',text:WAKE,intervalMs:0});
  assert.deepEqual([r.ok,r.delivery,r.draftNote],[true,'delivered','draft-stale']);
  assert.deepEqual(w.term('term-k').submitted,[WAKE]);
});

test('deliveryFieldsOf carries the draft-stale note into receipts and events',async()=>{
  const {deliveryFieldsOf}=await import('../scripts/kernel/wake-delivery.mjs');
  assert.deepEqual(deliveryFieldsOf({delivery:'delivered',evidence:'wake-text',draftNote:'draft-stale',staleDraft:'check status'}),
    {delivery:'delivered',evidence:'wake-text',draftNote:'draft-stale',staleDraft:'check status'});
});

test('quit-agent types its quit command over a stale draft and notes it',t=>{
  const w=orcaWorld(t);
  w.seed('term-q',{command:'codex --model gpt-6-sol',draft:'check status',draftStale:true});
  const r=w.call('scripts/kernel/quit-agent.mjs','quitAgent',{handle:'term-q',agent:'codex',waitMs:0,intervalMs:0});
  assert.deepEqual([r.sent,r.draftNote,r.staleDraft],[true,'draft-stale','check status']);
  assert.deepEqual(w.term('term-q').keys.map(k=>[k.text==='\u0015'?'^U':k.text,k.enter]),[['^U',false],['/quit',true]]);
  assert.equal(w.term('term-q').quit,'/quit');
});

test('nudge wakes a worker whose Orca draft is stale: one Ctrl+U probe, the wake, draft-stale on the event',t=>{
  const fx=nudgeFixture(t);
  fx.writeState(s=>{Object.assign(s.terminals['fake-terminal-1'],{screen:IDLE,draft:'check status',draftStale:true,keys:[]});});
  const r=fx.run(['nudge','--repo',fx.repo,'--job',fx.jobId,'--json']);
  assert.equal(r.status,0,r.stderr||r.stdout);
  const out=json(r.stdout);
  assert.deepEqual([out.nudged,out.delivery,out.draftNote,out.staleDraft],[true,'delivered','draft-stale','check status']);
  const term=fx.orcaState().terminals['fake-terminal-1'];
  assert.deepEqual(term.keys.map(k=>k.text==='\u0015'?'^U':k.text.startsWith('Operation liveness wake')?'wake':k.text),['^U','wake'],'probed once, never refused');
  assert.equal(term.submitted.length,1);
  assert.ok(term.submitted[0].startsWith(`Operation liveness wake for durable job ${fx.jobId}`));
  const events=fx.events('op-worker-nudged');
  assert.deepEqual([events.length,events[0].draftNote,events[0].staleDraft],[1,'draft-stale','check status']);
});
