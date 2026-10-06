import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {withLedger,seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {stallFindings,judgeGate,ownerGates,namedPaths,kernelTurnState,GATE_GRACE_MS} from '../../scripts/supervisor/stall.mjs';
import { readInbox } from '../../scripts/machine/sup-messages.mjs';
import {wakeKernel} from '../../scripts/kernel/wake-delivery.mjs';

// A nivo Collab workflow sat idle ~2 h behind an owner-gate ("resolve when
// the shell record .starciwork/shell/index.yaml exists (peer heads-up)") after the record had landed
// and the peer's ask had closed. Kernel and watchdog were alive; the supervisor digest checked
// liveness only. scripts/supervisor/stall.mjs classifies progress; stall-alert.mjs routes each finding
// with no chat involved: the owning Kernel first, the supervisor when that fails, the owner only for
// what waits on the owner.

const MIN=60_000;
// Relative to the real clock: a record written by the spec is written 'now', after every seeded gate.
const NOW=Date.now();
const WF='wf-nivo-collab-group-chat-mudqjp5g';
const PEER='wf-nivo-app-auth-mudqjob3';
const TOKEN='123456789:AAFakeTokenForSpecsOnly_abcdefghijklmnop';
const HELD=['op-interface.implement-0a1619a4ac','op-interface.implement-a485eea143','op-interface.implement-490960859c'];
const GATE_TEXT=`Runtime now requires the product app shell record .starciwork/shell/index.yaml (work/layout-tree@1) before interface.draw/implement dispatch; it is absent. Owner decision pending in peer ${PEER}'s ask. Resolve when the shell record exists (peer heads-up).`;

const seedCollab=(ledger,{progressAgoMin=120,gateAgoMin=180,gateText=GATE_TEXT,queuedAgoMin=180}={})=>{
  seedWorkflow(ledger,{id:WF,now:NOW-600*MIN,
    events:[
      {kind:'op-dispatched',payload:{jobId:'op-interface.draw-1111111111'},created_at:NOW-progressAgoMin*MIN},
      {kind:'incident-raised',entityType:'incident',entityId:'inc-48bc556d89a6',payload:{kind:'owner-gate',detail:gateText,holds:[...HELD,'interface.implement']},created_at:NOW-gateAgoMin*MIN},
      {kind:'route-decided',payload:{jobId:HELD[0]},created_at:NOW-5*MIN},
    ],
    jobs:HELD.map(jobId=>({jobId,opId:'interface.implement',status:'queued',createdAt:NOW-queuedAgoMin*MIN,updatedAt:NOW-queuedAgoMin*MIN}))});
  seedWorkflow(ledger,{id:PEER,now:NOW-600*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-5*MIN}]});
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,kind,owner,last_progress,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run('inc-48bc556d89a6',WF,'interface.implement','owner-ask','owner',`[owner-gate] ${gateText}`,'open',NOW-gateAgoMin*MIN,NOW-gateAgoMin*MIN);
};
const addAsk=(ledger,{workflowId=PEER,dispatchId='ctx_aaaaaaaaaaaa',answered=false,at=NOW-200*MIN}={})=>{
  const jobId=`ask-${dispatchId}`;
  seedWorkflow(ledger,{id:workflowId,jobs:[{jobId,opId:'interface.scaffold',status:'reported',dispatchId,createdAt:at}]});
  const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(jobId).attempt_id;
  ledger.db.prepare("INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?)")
    .run(workflowId,attemptId,dispatchId,jobId,'ask','{}',at);
  ledger.appendEvent({workflowId,entityType:'workflow',entityId:workflowId,kind:'ask-notified',payload:{dispatchId},createdAt:at+MIN});
  if(answered)ledger.appendEvent({workflowId,entityType:'workflow',entityId:workflowId,kind:'ask-answered',payload:{dispatchId},createdAt:at+30*MIN});
};
const writeShell=(repoRoot,{state='done',at=NOW-40*MIN}={})=>{
  const file=path.join(repoRoot,'.starciwork','shell','index.yaml');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,`schema: work/layout-tree@1\nid: shell\nstate: ${state}\n`);
  fs.utimesSync(file,new Date(at),new Date(at));
  return file;
};
const frontier=(over={})=>({ok:true,frontier:{state:'engaged',actionable:false,queued:[],queuedCauses:{'owner-gate':3},reason:null,...over},workers:[]});
const byType=(findings,type)=>findings.filter(f=>f.type===type);

test('a running workflow with no progress past stallMinutes and nothing actionable is STALLED; progress, a working worker or a short idle is not',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger);
  addAsk(ledger);
  let calls=0;
  const frontierOf=()=>{calls++;return frontier();};
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf});
  const [stalled]=byType(found,'STALLED');
  assert.ok(stalled,'the idle Collab workflow is STALLED');
  assert.match(stalled.line,new RegExp(`^STALLED ${WF} idle 120m: frontier engaged; queued: owner-gate 3; gates: inc-48bc556d89a6 justified holds 3; last progress op-dispatched`));
  assert.equal(stalled.alert,true);
  assert.equal(stalled.justifiedGate,true,'a stall behind a justified owner gate is marked so the owner sees it');
  assert.ok(!found.some(f=>f.workflowId===PEER),'the peer moved 5m ago');
  assert.equal(calls,1,'the frontier is read only for a workflow idle past the threshold (or holding an old queued job)');

  // The route-decided at -5m is the Kernel looking, not progress; an op-settled is.
  ledger.appendEvent({workflowId:WF,entityType:'job',entityId:'x',kind:'op-settled',payload:{},createdAt:NOW-10*MIN});
  assert.equal(byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()}),'STALLED').filter(f=>f.workflowId===WF).length,0,'fresh progress clears the stall');
  assert.equal(byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW+45*MIN,stallMinutes:30,frontierOf:()=>({...frontier(),workers:[{jobId:'op-x',liveness:'active'}]})}),'STALLED').filter(f=>f.workflowId===WF).length,0,
    'a worker mid-turn is progress the ledger does not see yet');
  const actionable=byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW+45*MIN,stallMinutes:30,frontierOf:()=>frontier({state:'peer-message',actionable:true})}),'STALLED').find(f=>f.workflowId===WF);
  assert.match(actionable.line,/frontier peer-message ACTIONABLE but the Kernel has not moved/,'actionable work nobody moves on is a stall too (the wake is not landing)');
}));

test('STALE-GATE: an owner gate whose named record now exists (written after the gate, state done) is stale even while an ask is open',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger);
  addAsk(ledger);
  writeShell(repoRoot);
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
  const [gate]=byType(found,'STALE-GATE');
  assert.ok(gate,'the gate is stale');
  assert.equal(gate.incidentId,'inc-48bc556d89a6');
  assert.match(gate.line,/^STALE-GATE wf-nivo-collab-group-chat-mudqjp5g inc-48bc556d89a6 \[owner-gate\] holds 3 queued job\(s\) for 180m: /);
  assert.match(gate.line,/\.starciwork\/shell\/index\.yaml exists \(done\), (created|written) \d\d:\d\d/);
  assert.doesNotMatch(gate.line,/no owner ask open/,'the peer ask is still open, so only the landed record is the evidence');
  assert.match(gate.line,/tell its Kernel to resolve it/);
  assert.equal(byType(found,'GATE').length,0);
  assert.match(byType(found,'STALLED')[0].line,/inc-48bc556d89a6 STALE holds 3/,'the stall names the stale gate');

  // The same record still in draft is something the gate waits for, not evidence.
  writeShell(repoRoot,{state:'draft'});
  const draft=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
  assert.equal(byType(draft,'STALE-GATE').length,0);
  assert.match(byType(draft,'GATE')[0].line,/justified: ask ctx_aaaaaaaaaaaa open in wf-nivo-app-auth-mudqjob3, waits: \.starciwork\/shell\/index\.yaml is draft/);
}));

test('STALE-GATE: an owner gate with no owner ask open in its workflow or the peer it names is stale',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger,{gateText:`Owner decision pending in peer ${PEER}'s ask; resolve on the peer heads-up.`});
  addAsk(ledger,{answered:true});
  const [gate]=byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()}),'STALE-GATE');
  assert.ok(gate);
  assert.match(gate.line,/no owner ask open in wf-nivo-collab-group-chat-mudqjp5g, wf-nivo-app-auth-mudqjob3/);

  // A heads-up the peer delivered after the gate is evidence as well.
  ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at,applied_at) VALUES(?,?,?,?,?,?,?)")
    .run(WF,'peer-message','pm-d2e851605215',JSON.stringify({from:PEER,kind:'heads-up',subject:'App shell ask answered'}),'applied',NOW-100*MIN,NOW-99*MIN);
  const [again]=byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()}),'STALE-GATE');
  assert.match(again.line,/peer heads-up pm-d2e851605215 from wf-nivo-app-auth-mudqjob3 arrived \d\d:\d\d and was acked: App shell ask answered/);
}));

test('a justified gate is reported as GATE, never alerted; a young gate is not judged; a gate waiting on an absent record is justified',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger);
  addAsk(ledger);
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
  assert.equal(byType(found,'STALE-GATE').length,0);
  const [gate]=byType(found,'GATE');
  assert.equal(gate.alert,false);
  assert.match(gate.line,/^GATE wf-nivo-collab-group-chat-mudqjp5g inc-48bc556d89a6 \[owner-gate\] holds 3 queued job\(s\): justified: ask ctx_aaaaaaaaaaaa open in wf-nivo-app-auth-mudqjob3, waits: \.starciwork\/shell\/index\.yaml is absent/);

  const [g]=ownerGates(ledger.db,WF);
  const young=judgeGate({db:ledger.db,workflowId:WF,gate:{...g,text:'no ask anywhere'},repo:repoRoot,now:g.raisedAt+GATE_GRACE_MS-1});
  assert.equal(young.stale,false,'inside the grace window the Kernel may still be parking the ask');
  assert.equal(young.young,true);

  // A supervisor hold that waits for a record nobody wrote yet is justified with no ask at all.
  const hold=judgeGate({db:ledger.db,workflowId:'wf-shop-base-repos-mud7kk5c',gate:{...g,text:'Supervisor holds interface.scaffold until .starciwork/brand/index.yaml is settled.'},repo:repoRoot,now:NOW});
  assert.equal(hold.stale,false);
  assert.deepEqual(hold.waits,['.starciwork/brand/index.yaml is absent']);
  assert.deepEqual(namedPaths('record .starciwork/shell/index.yaml. And .starciwork/brand/.'),['.starciwork/shell/index.yaml','.starciwork/brand']);
}));

test('STALE-WAIT: a queued job waiting past stallMinutes on a blocker that settled',t=>withLedger(t,({repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:'wf-next',now:NOW-600*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-5*MIN}],
    jobs:[{jobId:'op-workspace.manage-aaaaaaaaaa',opId:'workspace.manage',status:'queued',createdAt:NOW-90*MIN,updatedAt:NOW-90*MIN},
      {jobId:'op-workspace.manage-bbbbbbbbbb',opId:'workspace.manage',status:'failed',createdAt:NOW-120*MIN,updatedAt:NOW-70*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  const frontierOf=()=>frontier({queuedCauses:{'dependency-failed':1},actionable:true,
    queued:[{jobId:'op-workspace.manage-aaaaaaaaaa',opId:'workspace.manage',queuedBecause:'dependency-failed',blockedBy:{op:'workspace.manage',job:'op-workspace.manage-bbbbbbbbbb'}}]});
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf});
  assert.equal(byType(found,'STALLED').length,0,'the workflow itself moved 5m ago');
  const [wait]=byType(found,'STALE-WAIT');
  assert.match(wait.line,/^STALE-WAIT wf-next op-workspace\.manage-aaaaaaaaaa \(workspace\.manage\) dependency-failed for 90m: blocker op-workspace\.manage-bbbbbbbbbb settled failed 70m ago/);
  assert.equal(wait.alert,true);

  // A blocker that settled moments ago leaves the Kernel its turn to re-enqueue or re-point:
  // nivo Modules re-enqueued 9 s after the settle, yet the alert fired at "0m ago".
  ledger.db.prepare('UPDATE jobs SET updated_at=? WHERE job_id=?').run(NOW-2*MIN,'op-workspace.manage-bbbbbbbbbb');
  assert.equal(byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf}),'STALE-WAIT').length,0);
}));

// Owner, 2026-09-24: "check Telegram, why is it all stale blocks? can't the workflow rescue it itself?"
// Every STALE-* / STALLED finding went to the owner's Telegram. Now the owning Kernel gets a
// `[stall]` wake first, the supervisor hears only what outlived that wake, and the owner gets one
// digest of what waits on the owner.
const F=(type,over={})=>({type,key:`${type}|${over.workflowId??'wf-a'}|${over.id??'x'}`,workflowId:'wf-a',repo:'R',alert:true,line:`${type} ${over.workflowId??'wf-a'}`,...over});

test('a frontier parked on the owner (gates that all hold, held settles included) is a wait, not a stall',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger);
  addAsk(ledger);
  const awaiting=()=>frontier({state:'awaiting-owner',heldSettleJobs:[{jobId:'op-x',heldBecause:'owner-gate'}]});
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:awaiting});
  const [stalled]=byType(found,'STALLED');
  assert.deepEqual([stalled.alert,stalled.justifiedOwnerWait],[false,true]);
  assert.match(stalled.line,/\(justified: it waits on the owner\)$/);
  // Once the gate's record lands the gate is stale: the stall is the Kernel's again.
  writeShell(repoRoot);
  const stale=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:awaiting});
  assert.equal(byType(stale,'STALLED')[0].alert,true);
}));

test('kernelTurnState reads the attested Kernel frame: active, turn-idle, or null with no seat or no answer',t=>withLedger(t,({ledger})=>{
  seedWorkflow(ledger,{id:WF,now:NOW-60*MIN});
  const CHROME=['─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
  const deps=(screen,shown={ok:true,connected:true,writable:true,terminal:{lastOutputAt:Date.now()}})=>({show:()=>shown,read:()=>({ok:true,screen}),env:{}});
  assert.equal(kernelTurnState(ledger.db,WF,deps('x')),null,'no kernel seat');
  ledger.db.prepare("INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,NULL,'k',?,?,NULL)").run(WF,JSON.stringify({terminal:'term_k'}),NOW);
  assert.equal(kernelTurnState(ledger.db,WF,deps([' Reading','✻ Brewing… (12s · esc to interrupt)',...CHROME].join('\n'))),'active');
  assert.equal(kernelTurnState(ledger.db,WF,deps([' Done.','✻ Brewed for 3m 2s',...CHROME].join('\n'))),'turn-idle');
  assert.equal(kernelTurnState(ledger.db,WF,deps('x',{ok:false})),null,'Orca did not answer');
  assert.equal(kernelTurnState(ledger.db,WF,{env:{NODE_TEST_CONTEXT:'1'}}),null,'a spec never reaches a real Orca');
}));

test('wakeKernel: no seat, a busy or gated Kernel and a shell refuse; an idle Kernel takes the wake through the proven path',t=>withLedger(t,({ledger})=>{
  seedWorkflow(ledger,{id:WF,now:NOW-60*MIN});
  const CHROME=['─────','❯','─────','  ⏵⏵ bypass permissions on (shift+tab to cycle) · ← for agents'];
  const IDLE=[' Yielding — waiting on the peer.','✻ Brewed for 3m 2s',...CHROME].join('\n');
  const ACTIVE=[' Reading status','✻ Brewing… (12s · ↓ 1.2k tokens · esc to interrupt)',...CHROME].join('\n');
  const text='[stall] Stall self-heal wake for x';
  assert.equal(wakeKernel({db:ledger.db,workflowId:WF,text}).action,'kernel-signal-absent');
  ledger.db.prepare("INSERT OR REPLACE INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,NULL,'k',?,?,NULL)").run(WF,JSON.stringify({terminal:'term_k'}),NOW);
  const sends=[];
  const deps=(screens)=>{let i=0;return {show:()=>({ok:true,connected:true,writable:true,terminal:{lastOutputAt:Date.now()}}),
    read:()=>({ok:true,screen:screens[Math.min(i++,screens.length-1)]}),send:(a)=>{sends.push(a);return {ok:true};},sleep:()=>{}};};
  assert.equal(wakeKernel({db:ledger.db,workflowId:WF,text,deps:{...deps([IDLE]),show:()=>({ok:true,connected:false,writable:true})}}).action,'kernel-unavailable');
  assert.deepEqual([wakeKernel({db:ledger.db,workflowId:WF,text,deps:deps([ACTIVE])})].map(r=>[r.action,r.state]),[['kernel-busy','active']]);
  assert.equal(wakeKernel({db:ledger.db,workflowId:WF,text,deps:deps([`PS ${path.parse(process.cwd()).root}repo> `])}).action,'kernel-exited');
  assert.equal(sends.length,0,'nothing typed into a busy Kernel or a shell');
  const r=wakeKernel({db:ledger.db,workflowId:WF,text,deps:deps([IDLE,IDLE,ACTIVE])});
  assert.equal(r.action,'kernel-woken');
  assert.equal(r.delivered,true);
  assert.deepEqual(sends[0],{terminal:'term_k',text,enter:true});
  // A seated Kernel job: the wake ends with the seat's identity, which starci kernel status (kernel.attempt, kernel.you) proves.
  ledger.enqueueJob({jobId:`kernel-${WF}`,workflowId:WF,kind:'kernel',role:'kernel',status:'running',payload:{hierarchy:{attempt:2}},createdAt:NOW});
  ledger.db.prepare('UPDATE jobs SET worker_id=? WHERE job_id=?').run('term_k',`kernel-${WF}`);
  sends.length=0;
  assert.equal(wakeKernel({db:ledger.db,workflowId:WF,text,deps:deps([IDLE,IDLE,ACTIVE])}).action,'kernel-woken');
  // Between them the runtime-rev sentence (scripts/kernel/runtime-rev.mjs): this seat never acknowledged a complete runtime READ, so it is asked for one full re-read.
  assert.ok(sends[0].text.startsWith(`${text} Runtime rev `),sends[0].text);
  assert.match(sends[0].text,/ Runtime rev [0-9a-f]{12}: no complete runtime READ is acknowledged; re-read modules\/kernel\/kernel-prompt\.md and modules\/kernel\/driver-loop\.yaml, then starci kernel kernel-ack-rev /);
  assert.ok(sends[0].text.endsWith(` Runtime wake for Kernel attempt 2 of ${WF}: starci kernel status --workflow ${WF} shows kernel.attempt 2 and kernel.you true on your terminal.`));
}));

test('the supervisor digest prints the stall findings, one line each, under the workflow lines',async t=>{
  const {cycle}=await import('../../scripts/supervisor/poll.mjs');
  await withLedger(t,async({repoRoot,ledger})=>{
    seedCollab(ledger);
    addAsk(ledger,{answered:true});
    writeShell(repoRoot);
    const out=await cycle(ledger.db,{repo:repoRoot,state:{lastReportId:0,lastArtifacts:Date.now(),first:false},watchdogs:()=>null,
      stall:(db,opts)=>stallFindings(db,{...opts,now:NOW,frontierOf:()=>frontier()}),stallMinutes:30});
    assert.match(out.text,/\n {2}STALLED wf-nivo-collab-group-chat-mudqjp5g idle 120m: /);
    assert.match(out.text,/\n {2}STALE-GATE wf-nivo-collab-group-chat-mudqjp5g inc-48bc556d89a6 \[owner-gate\]/);
    assert.deepEqual(out.stalls.map(f=>f.type),['STALLED','STALE-GATE']);
    const broken=await cycle(ledger.db,{repo:repoRoot,state:{lastReportId:0,lastArtifacts:Date.now(),first:false},watchdogs:()=>null,stall:()=>{throw Error('boom');}});
    assert.match(broken.text,/stall check failed: boom/,'a failing stall check never stops the digest');
  });
});

test('a peer-dependency gate names no ask, so a closed ask is no evidence, and the job that settled before it is its cause, not its release',t=>withLedger(t,({repoRoot,ledger})=>{
  const text="Peer dependency (not an owner step, but the only holding mechanism): Collab's interface.draw op-interface.draw-da76af80ce settled blocked brand-gap. Holds the redraw until Modules' new shell rev lands.";
  seedCollab(ledger,{gateText:text});
  seedWorkflow(ledger,{id:'wf-cause',jobs:[{jobId:'op-interface.draw-da76af80ce',opId:'interface.draw',status:'running',updatedAt:NOW-181*MIN}]});
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
  assert.equal(byType(found,'STALE-GATE').length,0);
  assert.match(byType(found,'GATE')[0].line,/justified: no checkable condition, waits on: Peer dependency/);
  assert.equal(byType(found,'STALLED').length,1,'the stall itself is still reported');

  // The same named job settling after the gate is evidence the gate can go.
  ledger.db.prepare('UPDATE jobs SET status=?,updated_at=? WHERE job_id=?').run('reported',NOW-20*MIN,'op-interface.draw-da76af80ce');
  ledger.db.prepare('UPDATE jobs SET status=?,updated_at=? WHERE job_id=?').run('succeeded',NOW-20*MIN,'op-interface.draw-da76af80ce');
  const [stale]=byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()}),'STALE-GATE');
  assert.match(stale.line,/named job\(s\) settled after the gate: op-interface\.draw-da76af80ce succeeded \d\d:\d\d/);
  assert.doesNotMatch(stale.line,/no owner ask open/);
}));

// Live false positive: a STALE-GATE fired on an owner gate
// because a peer heads-up ("Brand job admitted after Grammar 0.5.0 proof") arrived after the
// gate. The gate waits for .starciwork/brand/index.yaml to SETTLE; the brand job was only admitted and the
// record did not exist yet. A gate that names a path is released by that path landing and nothing else;
// a pending peer message is UNREAD-PEER (the Kernel reads its inbox), never STALE-GATE.
test('a gate naming a record is not released by a peer heads-up while the record is absent; the pending message is UNREAD-PEER',t=>withLedger(t,({repoRoot,ledger})=>{
  const BASE='wf-shop-base-repos-mud7kk5c',WORK='wf-shop-work-and-stacks-mud7kjun';
  const text=`Supervisor holds interface.scaffold until .starciwork/brand/index.yaml is settled by peer ${WORK} (heads-up when brand lands).`;
  seedWorkflow(ledger,{id:BASE,now:NOW-600*MIN,events:[
    {kind:'op-settled',payload:{},created_at:NOW-120*MIN},
    {kind:'incident-raised',entityType:'incident',entityId:'inc-55060d946270',payload:{kind:'owner-gate',detail:text,holds:['interface.scaffold']},created_at:NOW-180*MIN}]});
  seedWorkflow(ledger,{id:WORK,now:NOW-600*MIN,events:[{kind:'op-dispatched',payload:{},created_at:NOW-5*MIN}]});
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,kind,owner,last_progress,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
    .run('inc-55060d946270',BASE,'interface.scaffold','owner-ask','owner',`[owner-gate] ${text}`,'open',NOW-180*MIN,NOW-180*MIN);
  ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,?,?)")
    .run(BASE,'peer-message','pm-a34aec2c6891',JSON.stringify({from:WORK,kind:'heads-up',subject:'Brand job admitted after Grammar 0.5.0 proof'}),'pending',NOW-20*MIN);
  const run=()=>stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier({state:'peer-message',actionable:true})});
  const found=run().filter(f=>f.workflowId===BASE);
  assert.equal(found.filter(f=>f.type==='STALE-GATE').length,0,'the record the gate waits for does not exist');
  assert.match(found.find(f=>f.type==='GATE').line,/justified: waits: \.starciwork\/brand\/index\.yaml is absent/);
  const unread=found.find(f=>f.type==='UNREAD-PEER');
  assert.equal(unread.alert,false);
  assert.match(unread.line,/^UNREAD-PEER wf-shop-base-repos-mud7kk5c pm-a34aec2c6891 from wf-shop-work-and-stacks-mud7kjun \[heads-up\] Brand job admitted after Grammar 0\.5\.0 proof: pending since \d\d:\d\d \(20m\); inc-55060d946270 may concern it and still holds; tell its Kernel to read starci kernel inbox/);

  // Acked, the message is no finding at all; the record landing (settled) is what releases the gate.
  ledger.db.prepare("UPDATE inbox SET status='applied',applied_at=? WHERE key='pm-a34aec2c6891'").run(NOW-10*MIN);
  assert.equal(run().filter(f=>f.workflowId===BASE&&['UNREAD-PEER','STALE-GATE'].includes(f.type)).length,0);
  const file=path.join(repoRoot,'.starciwork','brand','index.yaml');
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(file,'id: brand\nstate: draft\n');
  assert.equal(run().filter(f=>f.workflowId===BASE&&f.type==='STALE-GATE').length,0,'a draft record is still waited on');
  fs.writeFileSync(file,'id: brand\nstate: done\n');
  const [stale]=run().filter(f=>f.workflowId===BASE&&f.type==='STALE-GATE');
  assert.match(stale.line,/\.starciwork\/brand\/index\.yaml exists \(done\)/);
  assert.doesNotMatch(stale.line,/pm-a34aec2c6891/,'the heads-up is not the evidence');
}));
