import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {FAKE_ORCA} from './helpers/fake-orca.mjs';
import {openLedger,inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';
import {allocationMs} from '../engine/config.mjs';

// nivo inc-f1b576fb6006 (2026-09-25, wf-nivo-collab-group-chat-mudqjp5g): Codex op
// op-interface.implement-2face44a5b froze its frame at "Working (5m 30s • esc to interrupt)" for 50
// minutes. status read it turn-idle (stale-active) and nudge-ready; Orca showed the terminal writable but
// refused both nudges terminal_not_writable; reconcile --dead-worker refused it as worker-alive. No verb
// could move it. Meanwhile its Orca dispatch heartbeat every 5-10 minutes: the worker was working.
//  - a heartbeat younger than activeStaleMs makes the frozen frame read active (nothing to nudge);
//  - with no heartbeat, the refused nudge is the writability judgement: the worker reads disconnected,
//    and reconcile --dead-worker --settle-failed recovers it.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const STALE_MS=allocationMs('liveness.activeStaleMs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};

// The frame captured from term_fdb7ffd3 at 15:02Z: the spinner row above Codex's input row, frozen since 14:13Z.
const FROZEN_CODEX=[
  '• Ran $a=Get-Content \'apps/app/src/messages/vi.json\';for($i=356;$i -le 386;$i++){"$i`: $($a[$i-1])"}',
  '  └ 356:       },','    357:       "state": {','    … +77 lines (ctrl + t to view transcript)',
  '    454:       invite: {','    455:         title: t("invite.title"),',
  '• Working (5m 30s • esc to interrupt)',
  '› Ask Codex to do anything',
  '  gpt-6-sol high · D:\\Repositories\\nivo-backend · Report task outcome',
].join('\n');

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-stale-unreachable-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(path.join(repo,'docs'),{recursive:true});
  fs.writeFileSync(path.join(repo,'docs','a.md'),'# a\n');fs.writeFileSync(path.join(repo,'.gitignore'),'.starciwork/\n');
  const git=(...a)=>spawnSync('git',['-C',repo,'-c','user.email=spec@starci','-c','user.name=spec',...a],{encoding:'utf8',windowsHide:true});
  git('init','-q');git('add','-A');git('commit','-qm','base');
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json'),logFile=path.join(root,'calls.jsonl');
  const env={...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
    STARCI_FAKE_ORCA_LOG:logFile,STARCI_FAKE_ORCA_STATE:stateFile};
  const api=args=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const orcaState=()=>json(fs.readFileSync(stateFile,'utf8'))??{};
  const writeState=fn=>{const s=orcaState();fn(s);fs.writeFileSync(stateFile,JSON.stringify(s));};
  const workflowId='wf-stale-unreachable',jobId='job-stale-unreachable';
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:`kernel-${workflowId}`,workflowId,kind:'kernel',role:'kernel',
      payload:{hierarchy:{schema:'starci/agent-hierarchy@1',nodeId:`agent:kernel:${workflowId}`,parentNodeId:`workflow:${workflowId}`,role:'kernel'}}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='fake-kernel-terminal' WHERE job_id=?").run(`kernel-${workflowId}`);
    ledger.enqueueJob({jobId,workflowId,opId:'code.refactor',kind:'op',payload:{opId:'code.refactor',owned_paths:['docs/'],model:'codex-agent',difficulty:'hard'}});
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const events=kind=>read(db=>db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq').all(jobId,kind).map(r=>json(r.payload_json)));
  // Dispatch, then freeze the frame 19 minutes ago and age the dispatch past any launch grace.
  const d=api(['dispatch','--job',jobId,'--model','codex-agent','--spawn']);
  assert.equal(d.status,0,d.stderr||d.stdout);
  const handle=read(db=>{const p=json(db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId).payload_json);
    return p.managed?.agentTerminalHandle??p.orca?.agentTerminalHandle??p.hierarchy?.runtime?.terminalHandle;});
  const l=openLedger({file:ledgerFileFor(repo)});
  try{l.db.prepare("UPDATE events SET created_at=created_at-3600000 WHERE entity_id=? AND kind='op-dispatched'").run(jobId);}finally{l.close();}
  writeState(s=>{Object.assign(s.terminals[handle],{screen:FROZEN_CODEX,lastOutputAt:Date.now()-19*60000,sendRefused:'terminal_not_writable'});});
  const status=()=>{const out=json(api(['status','--workflow',workflowId]).stdout);return {out,worker:out.workers.find(w=>w.jobId===jobId)};};
  return {api,workflowId,jobId,handle,orcaState,writeState,read,events,status};
};

test('a frozen Working frame whose dispatch still heartbeats is active: no nudge, no dead-worker recovery',t=>{
  const fx=fixture(t);
  fx.writeState(s=>{s.heartbeatAt=new Date(Date.now()-60000).toISOString();});
  const {out,worker}=fx.status();
  assert.deepEqual([worker.screenState,worker.liveness,worker.livenessReason,worker.writable],['active','active','heartbeat',true],JSON.stringify(worker));
  assert.ok(worker.heartbeatAgeMs<STALE_MS);
  assert.notEqual(out.frontier.state,'worker-nudge-ready');
  const nudged=fx.api(['nudge','--job',fx.jobId]);
  assert.equal(nudged.status,0,nudged.stderr);
  assert.equal(json(nudged.stdout).reason,'worker-active');
  assert.equal(fx.orcaState().refusedSends??0,0,'nothing typed');
  const reconciled=fx.api(['reconcile','--job',fx.jobId,'--dead-worker','--settle-failed']);
  assert.equal(reconciled.status,1);
  assert.equal(json(reconciled.stdout).reason,'worker-alive');
});

test('a frozen Working frame a nudge cannot reach reads disconnected and reconcile --dead-worker --settle-failed recovers it',t=>{
  const fx=fixture(t);
  // An old heartbeat proves nothing: the frame reads stale-active and nudge-ready, as it did live.
  fx.writeState(s=>{s.heartbeatAt=new Date(Date.now()-40*60000).toISOString();});
  let {out,worker}=fx.status();
  assert.deepEqual([worker.screenState,worker.liveness,worker.livenessReason,worker.writable],['active','turn-idle','stale-active',true],JSON.stringify(worker));
  assert.equal(out.frontier.state,'worker-nudge-ready');

  // The nudge is refused terminal_not_writable: recorded, and the one writability judgement follows it.
  const nudged=fx.api(['nudge','--job',fx.jobId]);
  assert.equal(nudged.status,1);
  assert.deepEqual([json(nudged.stdout).reason,json(nudged.stdout).sendRefused],['terminal-send-failed',true]);
  assert.match(json(nudged.stdout).worker.terminalHandle,/./);
  assert.equal(fx.events('op-worker-unwritable').length,1);
  assert.equal(fx.events('op-worker-nudged').length,0);

  ({out,worker}=fx.status());
  assert.deepEqual([worker.liveness,worker.writable,worker.livenessReason,worker.errorCode],['disconnected',false,'terminal-incarnation-stale','terminal_not_writable'],JSON.stringify(worker));
  assert.equal(out.frontier.state,'worker-dead');
  assert.deepEqual(out.frontier.deadWorkerJobs,[fx.jobId]);
  const refusedBefore=fx.orcaState().refusedSends;
  const again=fx.api(['nudge','--job',fx.jobId]);
  assert.equal(again.status,1);
  assert.equal(json(again.stdout).reason,'worker-unavailable');
  assert.equal(fx.orcaState().refusedSends,refusedBefore,'a known-unwritable terminal is not typed into again');

  const reconciled=fx.api(['reconcile','--job',fx.jobId,'--dead-worker','--settle-failed']);
  assert.equal(reconciled.status,0,reconciled.stderr||reconciled.stdout);
  const r=json(reconciled.stdout);
  assert.ok(['requeued','settled-failed'].includes(r.recovery),JSON.stringify(r));
  assert.equal(fx.read(db=>db.prepare('SELECT count(*) n FROM leases WHERE job_id=?').get(fx.jobId).n),0,'the lease is released');
  assert.deepEqual([r.terminalClosed?.closed,r.terminalClosed?.proof],[true,'unwritable']);
  assert.equal(fx.orcaState().refusedSends,refusedBefore,'no quit input is typed into a terminal Orca refuses');
  assert.ok((fx.orcaState().closed??[]).includes(fx.handle));
});

test('output or a heartbeat after the refusal voids it',t=>{
  const fx=fixture(t);
  fx.writeState(s=>{s.heartbeatAt=new Date(Date.now()-40*60000).toISOString();});
  assert.equal(fx.api(['nudge','--job',fx.jobId]).status,1);
  assert.equal(fx.status().worker.liveness,'disconnected');
  fx.writeState(s=>{s.heartbeatAt=new Date(Date.now()+1000).toISOString();});
  const {worker}=fx.status();
  assert.deepEqual([worker.liveness,worker.writable,worker.livenessReason],['active',true,'heartbeat'],JSON.stringify(worker));
  fx.writeState(s=>{s.heartbeatAt=null;s.terminals[fx.handle].lastOutputAt=Date.now()+1000;s.terminals[fx.handle].screen='• Ran ls\n› Ask Codex to do anything';});
  const printed=fx.status().worker;
  assert.deepEqual([printed.liveness,printed.writable],['turn-idle',true],JSON.stringify(printed));
});

// Orca 1.4.209 prompt delivery: a text+Enter send answers result.send.prompt {requestId, stages,
// processIncarnation}; an ambiguous transport failure carries error.data.orchestrationRequestId, and the
// send is reissued once with --retry-request <id>, never re-sent blind.
test('terminal-send reissues an ambiguous prompt failure once with its --retry-request id',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-retry-request-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const stub=path.join(root,'fake-orca.mjs');fs.writeFileSync(stub,FAKE_ORCA);
  const stateFile=path.join(root,'state.json');
  fs.writeFileSync(stateFile,JSON.stringify({sends:0,terminals:{'term-1':{handle:'term-1',connected:true,writable:true,transportFailOnce:'req_7f3a'}}}));
  const r=spawnSync(process.execPath,[path.join(ROOT,'scripts','api','orca','terminal-send.mjs'),'--terminal','term-1','--text','Operation liveness wake for durable job j1.'],
    {cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([stub]),
      STARCI_FAKE_ORCA_LOG:path.join(root,'calls.jsonl'),STARCI_FAKE_ORCA_STATE:stateFile}});
  const out=json(r.stdout);
  assert.equal(r.status,0,r.stdout+r.stderr);
  assert.deepEqual(out.requestRetry,{requestId:'req_7f3a',ok:true});
  assert.deepEqual(out.prompt,{requestId:'req_7f3a',stages:['input_accepted','turn_started'],processIncarnation:'inc-1'});
  const sends=json(fs.readFileSync(stateFile,'utf8')).promptSends;
  assert.deepEqual(sends.map(s=>[s.retryRequest,s.waitSubmit]),[[null,null],['req_7f3a','5']],'one blind send, one reissue bound to its request id');
});
