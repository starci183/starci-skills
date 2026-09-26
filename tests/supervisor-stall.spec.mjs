import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {stallFindings,judgeGate,ownerGates,namedPaths,kernelTurnState,GATE_GRACE_MS} from '../scripts/supervisor/stall.mjs';
import {planStall,routeFindings,dueEscalations,runStallAlert,wakeKernel,housekeepingReportFile,housekeepingStatus,describe,WAKE_RATE_MS,ESCALATE_MS,ESCALATE_CAP_MS,DIGEST_MS,DIGEST_REMIND_MS} from '../scripts/supervisor/stall-alert.mjs';
import {readInbox} from '../scripts/connectors/telegram-bridge.mjs';
import {ensureStallAlert,resumeAll} from '../scripts/kernel/resume-all.mjs';

// Incident 2026-09-24: nivo Collab sat idle ~2 h behind owner-gate inc-48bc556d89a6 ("resolve when
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
const GATE_TEXT=`Runtime now requires the product app shell record .starciwork/shell/index.yaml (work/app-shell@1) before interface.draw/implement dispatch; it is absent. Owner decision pending in peer ${PEER}'s ask. Resolve when the shell record exists (peer heads-up).`;

const seedCollab=(ledger,{progressAgoMin=120,gateAgoMin=180,gateText=GATE_TEXT,queuedAgoMin=180}={})=>{
  seedWorkflow(ledger,{id:WF,now:NOW-600*MIN,
    events:[
      {kind:'op-dispatched',payload:{jobId:'op-interface.draw-1111111111'},created_at:NOW-progressAgoMin*MIN},
      {kind:'incident-raised',entityType:'incident',entityId:'inc-48bc556d89a6',payload:{kind:'owner-gate',detail:gateText,holds:[...HELD,'interface.implement']},created_at:NOW-gateAgoMin*MIN},
      {kind:'route-decided',payload:{jobId:HELD[0]},created_at:NOW-5*MIN},
    ],
    jobs:HELD.map(jobId=>({jobId,opId:'interface.implement',status:'queued',createdAt:NOW-queuedAgoMin*MIN,updatedAt:NOW-queuedAgoMin*MIN}))});
  seedWorkflow(ledger,{id:PEER,now:NOW-600*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-5*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,last_progress,status,updated_at) VALUES(?,?,?,?,?,?)")
    .run('inc-48bc556d89a6',WF,'interface.implement',`[owner-gate] ${gateText}`,'open',NOW-gateAgoMin*MIN);
};
const addAsk=(ledger,{workflowId=PEER,dispatchId='ctx_aaaaaaaaaaaa',answered=false,at=NOW-200*MIN}={})=>{
  ledger.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(workflowId,dispatchId,'interface.scaffold',1,1,'ask','{}',at);
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
  const hold=judgeGate({db:ledger.db,workflowId:'wf-miamia-base-repos-mud7kk5c',gate:{...g,text:'Supervisor holds interface.scaffold until .starciwork/brand/index.yaml is settled.'},repo:repoRoot,now:NOW});
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

// Owner, 2026-09-24: "check tele sao toàn stale block? bản thân workflow không thể cứu nó hay sao?"
// Every STALE-* / STALLED finding went to the owner's Telegram. Now the owning Kernel gets a
// `[stall]` wake first, the supervisor hears only what outlived that wake, and the owner gets one
// digest of what waits on the owner.
const F=(type,over={})=>({type,key:`${type}|${over.workflowId??'wf-a'}|${over.id??'x'}`,workflowId:'wf-a',repo:'R',alert:true,line:`${type} ${over.workflowId??'wf-a'}`,...over});

test('routing matrix: kernel-fixable findings wake their Kernel, the owner gets only owner waits, the supervisor what no Kernel can fix',()=>{
  const route=(findings,now=NOW)=>Object.fromEntries(routeFindings(findings,{now}).map(f=>[f.key,f.route]));
  assert.deepEqual(route([F('STALE-GATE'),F('STALE-WAIT'),F('STALE-PEER-WAIT')]),
    {'STALE-GATE|wf-a|x':'kernel','STALE-WAIT|wf-a|x':'kernel','STALE-PEER-WAIT|wf-a|x':'kernel'});
  assert.equal(route([F('UNREAD-PEER',{alert:false,pendingSince:NOW-2*MIN})])['UNREAD-PEER|wf-a|x'],'none','a message that just arrived is the Kernel\'s next read anyway');
  assert.equal(route([F('UNREAD-PEER',{alert:false,pendingSince:NOW-GATE_GRACE_MS})])['UNREAD-PEER|wf-a|x'],'kernel');
  const gate=(over)=>F('GATE',{alert:false,young:false,asks:[],waits:[],text:'Owner picks the pricing tier.',...over});
  assert.equal(route([gate({asks:[{workflowId:'wf-a',dispatchId:'ctx_1'}]})])['GATE|wf-a|x'],'owner','an open owner ask');
  assert.equal(route([gate()])['GATE|wf-a|x'],'owner','nothing checkable: only the owner releases it');
  assert.equal(route([gate({young:true})])['GATE|wf-a|x'],'none','inside the grace');
  assert.equal(route([gate({waits:['.starciwork/brand/index.yaml is absent']})])['GATE|wf-a|x'],'none','a record a peer owes is not the owner\'s');
  assert.equal(route([gate({text:'Peer dependency (not an owner step, but the only holding mechanism): Collab waits on Modules\' shell rev.'})])['GATE|wf-a|x'],'kernel',
    'an owner gate its own text calls a peer dependency is re-recorded as a peer-wait by its Kernel');
  const stalled=(over)=>F('STALLED',{frontierState:'orphaned-frontier',actionable:false,justifiedGate:false,...over});
  assert.equal(route([stalled({actionable:true,frontierState:'settle-ready'})])['STALLED|wf-a|x'],'kernel','actionable: the Kernel moves it');
  assert.equal(route([stalled()])['STALLED|wf-a|x'],'kernel','nothing explains the stall: the Kernel derives the next step');
  assert.equal(route([stalled({frontierState:null,actionable:null})])['STALLED|wf-a|x'],'supervisor','an unreadable frontier is a runtime defect');
  assert.equal(route([stalled({frontierState:'awaiting-owner'})])['STALLED|wf-a|x'],'owner');
  assert.equal(route([stalled({frontierState:'awaiting-owner'}),F('STALE-GATE')])['STALLED|wf-a|x'],'kernel','a stale gate makes the frontier read awaiting-owner: the Kernel clears it');
  assert.equal(route([stalled({frontierState:'engaged',justifiedGate:true}),gate()])['STALLED|wf-a|x'],'owner');
  assert.equal(route([stalled({frontierState:'engaged',justifiedGate:true}),gate({waits:['.starciwork/brand/index.yaml is absent']})])['STALLED|wf-a|x'],'supervisor');
  assert.equal(route([stalled({alert:false,justifiedPeerWait:true,frontierState:'peer-wait'})])['STALLED|wf-a|x'],'none');
  assert.equal(route([F('PEER-WAIT',{alert:false})])['PEER-WAIT|wf-a|x'],'none');
});

test('dedupe: one wake per finding per window, a gone finding starts over, one owner digest per hour and a repeat only every 4 h',()=>{
  const findings=[F('STALE-GATE',{id:'g'}),F('STALLED',{id:'s',frontierState:'awaiting-owner',actionable:false}),F('UNREAD-PEER',{id:'u',pendingSince:NOW-60*MIN})];
  const first=planStall(findings,{},{now:NOW});
  assert.deepEqual(first.wakes.map(w=>[w.workflowId,w.findings.map(f=>f.key)]),[['wf-a',['STALE-GATE|wf-a|g','STALLED|wf-a|s','UNREAD-PEER|wf-a|u']]],
    'one wake per workflow carries every Kernel finding of it (a stale gate makes its awaiting-owner stall the Kernel\'s)');
  assert.equal(first.inbox.length,0,'nothing goes to the supervisor before a wake had its chance');
  assert.equal(first.telegram.length,0,'a stale gate makes an awaiting-owner stall the Kernel\'s, not the owner\'s');
  for(const key of Object.keys(first.state.findings))Object.assign(first.state.findings[key],{lastWakeAt:NOW,wokenAt:NOW});
  assert.equal(planStall(findings,first.state,{now:NOW+10*MIN}).wakes.length,0,'ten minutes later: no second wake');
  assert.equal(planStall(findings,first.state,{now:NOW+WAKE_RATE_MS}).wakes.length,1,'after the window a persisting finding is woken again');
  const gone=planStall([findings[0]],first.state,{now:NOW+10*MIN});
  assert.deepEqual(Object.keys(gone.state.findings),['STALE-GATE|wf-a|g'],'a finding that disappeared is dropped');
  assert.equal(planStall(findings,gone.state,{now:NOW+11*MIN}).wakes.length,1,'and is new again when it returns: woken at once');
  // The @1 state's inbox time is the supervisor time; its Telegram time is gone with the owner alerts.
  const legacy=planStall([findings[0]],{schema:'starci/stall-alerts@1',findings:{'STALE-GATE|wf-a|g':{firstAt:NOW-30*MIN,inboxAt:NOW-5*MIN,telegramAt:NOW-5*MIN}}},{now:NOW});
  assert.deepEqual(legacy.state.findings['STALE-GATE|wf-a|g'].supervisorAt,NOW-5*MIN);
  assert.equal(legacy.state.findings['STALE-GATE|wf-a|g'].telegramAt,undefined);

  // The owner digest.
  const owner=[F('GATE',{id:'o1',alert:false,young:false,asks:[{dispatchId:'ctx_1'}],waits:[],text:'Owner decides.'})];
  const d1=planStall(owner,{},{now:NOW});
  assert.deepEqual(d1.telegram.map(f=>f.key),['GATE|wf-a|o1']);
  d1.state.owner={digestAt:NOW,keys:['GATE|wf-a|o1']};
  assert.equal(planStall(owner,d1.state,{now:NOW+30*MIN}).telegram.length,0,'at most one digest an hour');
  const more=[...owner,F('GATE',{id:'o2',workflowId:'wf-b',alert:false,young:false,asks:[],waits:[],text:'Owner approves the budget.'})];
  assert.equal(planStall(more,d1.state,{now:NOW+30*MIN}).telegram.length,0,'a new owner wait also waits for the hour');
  assert.deepEqual(planStall(more,d1.state,{now:NOW+DIGEST_MS}).telegram.map(f=>f.key),['GATE|wf-a|o1','GATE|wf-b|o2'],'then the digest lists every owner wait');
  assert.equal(planStall(owner,d1.state,{now:NOW+2*DIGEST_MS}).telegram.length,0,'nothing new: no repeat inside 4 h');
  assert.equal(planStall(owner,d1.state,{now:NOW+DIGEST_REMIND_MS}).telegram.length,1,'the reminder');
  assert.equal(planStall(findings,d1.state,{now:NOW+DIGEST_MS}).telegram.length,0,'kernel-fixable findings never make a digest');
});

test('escalation: only after the self-heal failed - a persisting finding 20 min after its wake, an unreachable Kernel, or a Kernel busy for an hour',()=>{
  const f=routeFindings([F('STALE-GATE',{id:'g'})],{now:NOW});
  const esc=(entry,now)=>dueEscalations(f,{'STALE-GATE|wf-a|g':{firstAt:NOW,...entry}},{now}).length;
  assert.equal(esc({wokenAt:NOW,lastWake:{at:NOW,action:'kernel-woken'}},NOW+10*MIN),0,'the Kernel has its turn');
  assert.equal(esc({wokenAt:NOW,lastWake:{at:NOW,action:'kernel-woken'}},NOW+ESCALATE_MS),1,'still there 20 min after the wake');
  assert.equal(esc({wokenAt:NOW,supervisorAt:NOW+ESCALATE_MS},NOW+ESCALATE_MS+10*MIN),0,'repeated at most hourly');
  assert.equal(esc({lastWake:{at:NOW,action:'kernel-busy'}},NOW+ESCALATE_MS),0,'a busy Kernel is not a failed self-heal');
  assert.equal(esc({lastWake:{at:NOW,action:'kernel-busy'}},NOW+ESCALATE_CAP_MS),1,'but an hour of it is');
  assert.equal(esc({lastWake:{at:NOW,action:'kernel-exited'}},NOW+ESCALATE_MS),1,'a Kernel that cannot take a wake');
  assert.equal(dueEscalations(routeFindings([F('GATE',{alert:false,young:false,asks:[{dispatchId:'c'}],waits:[]})],{now:NOW}),{'GATE|wf-a|x':{firstAt:NOW-5*60*MIN}},{now:NOW}).length,0,'an owner wait is never escalated');
});

async function fakeBot(t,{fail=null}={}){
  const bot={sent:[],paths:[]};
  const server=http.createServer((req,res)=>{
    let body='';
    req.on('data',c=>{body+=c;});
    req.on('end',()=>{
      bot.paths.push(req.url);
      res.writeHead(fail?fail.status:200,{'content-type':'application/json'});
      if(fail)return res.end(JSON.stringify(fail.json));
      bot.sent.push(JSON.parse(body||'{}'));
      res.end(JSON.stringify({ok:true,result:{message_id:700+bot.sent.length}}));
    });
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>{server.closeAllConnections?.();server.close(()=>resolve());}));
  bot.apiBase=`http://127.0.0.1:${server.address().port}`;
  return bot;
}
const fakeWake=(outcomes)=>{
  const calls=[];
  const wake=({workflowId,text})=>{calls.push({workflowId,text});const r=typeof outcomes==='function'?outcomes(calls.length):outcomes;return {terminal:'term_k',...r};};
  return {calls,wake};
};
const stallWakes=(ledger,wf=WF)=>ledger.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='stall-wake' ORDER BY seq").all(wf).map(r=>JSON.parse(r.payload_json));

test('stall-alert: a stale gate wakes its own Kernel with the evidence and the api action, records stall-wake, and never reaches the owner\'s Telegram',async t=>{
  const bot=await fakeBot(t);
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedCollab(ledger);
    addAsk(ledger,{answered:true});
    writeShell(repoRoot);
    const env={LOCALAPPDATA:machineHome,STARCI_TELEGRAM_API_BASE:bot.apiBase};
    const settings={ready:true,token:TOKEN,chatId:'4242',language:'vi'};
    const {calls,wake}=fakeWake({action:'kernel-woken',delivered:true,delivery:'delivered',evidence:'wake-text',state:'turn-idle'});
    const run=(now)=>runStallAlert({repos:[repoRoot],env,now,stallMinutes:30,settings,apiBase:bot.apiBase,frontierOf:()=>frontier(),wake});

    const first=await run(NOW);
    assert.equal(first.ok,true,JSON.stringify(first));
    assert.deepEqual(first.findings.map(f=>[f.type,f.route]).sort(),[['STALE-GATE','kernel'],['STALLED','kernel']]);
    assert.equal(calls.length,1,'one wake for the workflow');
    assert.equal(calls[0].workflowId,WF);
    assert.match(calls[0].text,/^\[stall\] Stall self-heal wake for wf-nivo-collab-group-chat-mudqjp5g/);
    assert.match(calls[0].text,/It grants no new scope, path or authority\./);
    assert.doesNotMatch(calls[0].text,/already approved|needs no confirmation/,'the wake proves itself through wakeIdentity, not by claiming approval');
    assert.match(calls[0].text,/STALE-GATE inc-48bc556d89a6: its reason is gone - \.starciwork\/shell\/index\.yaml exists \(done\)/,'the evidence');
    assert.match(calls[0].text,/api incident --workflow wf-nivo-collab-group-chat-mudqjp5g --resolve inc-48bc556d89a6 --detail/,'the exact action');
    assert.doesNotMatch(calls[0].text,/\n/,'one line: a newline would submit half a wake');
    const events=stallWakes(ledger);
    assert.equal(events.length,1,'a stall-wake event on the workflow');
    assert.deepEqual(events[0].findings.map(f=>f.type).sort(),['STALE-GATE','STALLED']);
    assert.equal(events[0].delivery,'delivered');
    assert.equal(readInbox('main',env).length,0,'the supervisor is not told while the Kernel has its turn');
    assert.equal(bot.sent.length,0,'nothing on the owner\'s Telegram');

    const soon=await run(NOW+10*MIN);
    assert.equal(calls.length,1,'no second wake inside the window');
    assert.equal(soon.alerted.inbox.length,0);

    // Still there 20 minutes after the wake: the self-heal failed, the supervisor hears it.
    const later=await run(NOW+ESCALATE_MS);
    assert.equal(calls.length,2,'the Kernel is woken again');
    assert.deepEqual(later.alerted.inbox.sort(),[`STALE-GATE|${WF}|inc-48bc556d89a6`,`STALLED|${WF}`]);
    const inbox=readInbox('main',env);
    assert.equal(inbox.length,1);
    assert.match(inbox[0].text,/^STALL-ALERT 2 finding\(s\) the workflows could not fix themselves: /);
    assert.match(inbox[0].text,/\[self-heal failed: 2 stall wake\(s\) since \d\d:\d\d, the finding persists; last wake kernel-woken/);
    assert.equal(bot.sent.length,0,'an escalation goes to the supervisor, never straight to the owner');
    await run(NOW+ESCALATE_MS+10*MIN);
    assert.equal(readInbox('main',env).length,1,'the supervisor hears it at most hourly');
    assert.equal(bot.sent.length,0);
  });
});

test('stall-alert: a busy Kernel or a worker mid-turn is skipped and retried next pass; an unreachable Kernel escalates after 20 min',async t=>{
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedCollab(ledger);
    addAsk(ledger,{answered:true});
    writeShell(repoRoot);
    const env={LOCALAPPDATA:machineHome,STARCI_CONNECTORS_OFF:'1'};
    let working=true;
    const frontierOf=()=>({...frontier(),workers:working?[{jobId:'op-x',liveness:'active'}]:[]});
    const {calls,wake}=fakeWake((n)=>(n===1?{action:'kernel-busy',delivered:false,state:'active'}:{action:'kernel-exited',delivered:false}));
    const run=(now)=>runStallAlert({repos:[repoRoot],env,now,stallMinutes:30,frontierOf,wake});
    const mid=await run(NOW);
    assert.equal(calls.length,0,'a worker mid-turn: no wake');
    assert.equal(mid.skipped[0].action,'worker-mid-turn');
    working=false;
    const busy=await run(NOW+10*MIN);
    assert.equal(calls.length,1);
    assert.equal(busy.skipped[0].action,'kernel-busy');
    assert.equal(stallWakes(ledger).length,0,'no stall-wake for a wake that was not delivered');
    const exited=await run(NOW+20*MIN);
    assert.equal(calls.length,2,'retried the next pass');
    assert.deepEqual(exited.alerted.inbox,[`STALE-GATE|${WF}|inc-48bc556d89a6`],'a Kernel that cannot take a wake 20 min into the finding: the supervisor (the stall shows only once the worker stopped)');
    assert.match(readInbox('main',env)[0].text,/self-heal impossible: the Kernel cannot take a wake \(kernel-exited\)/);
  });
});

test('stall-alert: the owner gets one digest of what waits on the owner, in config.yaml language, at most hourly; a failed send is scrubbed and retried',async t=>{
  const bot=await fakeBot(t);
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedCollab(ledger);
    addAsk(ledger); // the peer's owner ask is open and the shell record is absent: a justified gate
    const env={LOCALAPPDATA:machineHome};
    const {calls,wake}=fakeWake({action:'kernel-woken',delivered:true});
    const run=(now,language='vi',apiBase=bot.apiBase)=>runStallAlert({repos:[repoRoot],env,now,stallMinutes:30,settings:{ready:true,token:TOKEN,chatId:'4242',language},apiBase,frontierOf:()=>frontier(),wake});
    const first=await run(NOW);
    const routes=Object.fromEntries(first.findings.map(f=>[f.type,f.route]));
    // A gate waiting on an open ask AND an absent record: the ask makes it the owner's.
    assert.deepEqual(routes,{STALLED:'owner',GATE:'owner'});
    assert.equal(calls.length,0,'nothing for the Kernel to do');
    assert.equal(bot.sent.length,1,'one digest');
    const text=bot.sent[0].text;
    assert.match(text,/^🕒 StarCi: 1 workflow đang chờ thầy/);
    assert.match(text,/• wf-nivo-collab-group-chat-mudqjp5g: inc-48bc556d89a6: Runtime now requires .* \(ask ctx_aaaaaaaaaaaa\) — từ \d\d:\d\d \(3h\)/);
    assert.match(text,/\/asks/);
    assert.doesNotMatch(text,/STALE|STALLED|UNREAD/,'no raw finding lines on the owner\'s Telegram');
    assert.equal(readInbox('main',env).length,0,'an owner wait is not the supervisor\'s');
    await run(NOW+30*MIN);
    assert.equal(bot.sent.length,1,'at most one digest an hour');
    await run(NOW+2*DIGEST_MS);
    assert.equal(bot.sent.length,1,'the same waits: no repeat inside 4 h');
    await run(NOW+DIGEST_REMIND_MS);
    assert.equal(bot.sent.length,2,'the reminder');
  });
  const failing=await fakeBot(t,{fail:{status:401,json:{ok:false,description:`Unauthorized for bot${TOKEN}`}}});
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedCollab(ledger);
    addAsk(ledger);
    const env={LOCALAPPDATA:machineHome};
    const run=(now)=>runStallAlert({repos:[repoRoot],env,now,stallMinutes:30,settings:{ready:true,token:TOKEN,chatId:'4242',language:'en'},apiBase:failing.apiBase,frontierOf:()=>frontier(),wake:fakeWake({action:'kernel-busy',delivered:false}).wake});
    const r=await run(NOW);
    assert.equal(r.ok,false);
    assert.doesNotMatch(r.telegram.error,new RegExp(TOKEN.split(':')[1]),'the token is scrubbed from the error');
    assert.doesNotMatch(JSON.stringify(r),new RegExp(TOKEN.split(':')[1]));
    const again=await run(NOW+5*MIN);
    assert.equal(again.telegram.ok,false,'a digest that did not go out is tried again next pass');
    assert.equal(failing.paths.length,2);
  });
});

test('stall-alert: connectors off skips only the digest; a spec run never types into a real terminal',async t=>{
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedCollab(ledger);
    addAsk(ledger);
    const r=await runStallAlert({repos:[repoRoot],env:{LOCALAPPDATA:machineHome,STARCI_CONNECTORS_OFF:'1'},now:NOW,stallMinutes:30,settings:{ready:true,token:TOKEN,chatId:'1'},frontierOf:()=>frontier()});
    assert.equal(r.telegram.skipped,'STARCI_CONNECTORS_OFF');
  });
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedCollab(ledger);
    addAsk(ledger,{answered:true});
    writeShell(repoRoot);
    const r=await runStallAlert({repos:[repoRoot],env:{LOCALAPPDATA:machineHome,NODE_TEST_CONTEXT:'child',STARCI_CONNECTORS_OFF:'1'},now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
    assert.equal(r.skipped[0].reason,'test context: refusing a real terminal wake');
  });
});

test('a frontier parked on the owner (gates that all hold, held settles included) is a wait, not a stall; the owner digest still lists it',t=>withLedger(t,({repoRoot,ledger})=>{
  seedCollab(ledger);
  addAsk(ledger);
  const awaiting=()=>frontier({state:'awaiting-owner',heldSettleJobs:[{jobId:'op-x',heldBecause:'owner-gate'}]});
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:awaiting});
  const [stalled]=byType(found,'STALLED');
  assert.deepEqual([stalled.alert,stalled.justifiedOwnerWait],[false,true]);
  assert.match(stalled.line,/\(justified: it waits on the owner\)$/);
  assert.equal(routeFindings(found,{now:NOW}).find(f=>f.type==='STALLED').route,'owner');
  // Once the gate's record lands the gate is stale: the stall is the Kernel's again.
  writeShell(repoRoot);
  const stale=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:awaiting});
  assert.equal(byType(stale,'STALLED')[0].alert,true);
  assert.equal(routeFindings(stale,{now:NOW}).find(f=>f.type==='STALLED').route,'kernel');
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
  assert.equal(wakeKernel({db:ledger.db,workflowId:WF,text,deps:deps(['PS D:\\repo> '])}).action,'kernel-exited');
  assert.equal(sends.length,0,'nothing typed into a busy Kernel or a shell');
  const r=wakeKernel({db:ledger.db,workflowId:WF,text,deps:deps([IDLE,IDLE,ACTIVE])});
  assert.equal(r.action,'kernel-woken');
  assert.equal(r.delivered,true);
  assert.deepEqual(sends[0],{terminal:'term_k',text,enter:true});
  // A seated Kernel job: the wake ends with the seat's identity, which api status (kernel.attempt, kernel.you) proves.
  ledger.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,worker_id,created_at,updated_at) VALUES(?,?,NULL,2,0,'kernel','kernel','{}','running','term_k',?,?)").run(`kernel-${WF}`,WF,NOW,NOW);
  sends.length=0;
  assert.equal(wakeKernel({db:ledger.db,workflowId:WF,text,deps:deps([IDLE,IDLE,ACTIVE])}).action,'kernel-woken');
  assert.equal(sends[0].text,`${text} Runtime wake for Kernel attempt 2 of ${WF}: api status --workflow ${WF} shows kernel.attempt 2 and kernel.you true on your terminal.`);
}));

test('resume-all launches the stall check detached every pass, once at a time, and a spec run never does',t=>withLedger(t,({repoRoot,machineHome})=>{
  const launched=[];
  const spawn=(file,args)=>{launched.push({file,args});return 4242;};
  const r=ensureStallAlert({repos:[repoRoot],env:{LOCALAPPDATA:machineHome},spawn});
  assert.deepEqual(r,{ok:true,launched:4242});
  assert.match(launched[0].file,/scripts[\\/]supervisor[\\/]stall-alert\.mjs$/);
  assert.deepEqual(launched[0].args,['--repo',repoRoot]);
  assert.deepEqual(ensureStallAlert({repos:[repoRoot],env:{LOCALAPPDATA:machineHome},spawn,dryRun:true}),{ok:true,wouldStart:true});
  assert.equal(ensureStallAlert({env:{NODE_TEST_CONTEXT:'1'},spawn}).skipped,'test context');
  const pass=resumeAll({repos:[repoRoot],workflowsOf:()=>[],watchdogs:()=>[],connectors:{cloudflare:{mode:'off'}},ensureBridge:()=>({ok:true,skipped:'x'}),
    stallAlert:({repos})=>({ok:true,launched:7,repos})});
  assert.deepEqual(pass.stallAlert,{ok:true,launched:7,repos:[repoRoot]});
}));

test('the supervisor digest prints the stall findings, one line each, under the workflow lines',async t=>{
  const {cycle}=await import('../scripts/supervisor/poll.mjs');
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
  seedWorkflow(ledger,{id:'wf-cause',jobs:[{jobId:'op-interface.draw-da76af80ce',opId:'interface.draw',status:'failed',updatedAt:NOW-181*MIN}]});
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()});
  assert.equal(byType(found,'STALE-GATE').length,0);
  assert.match(byType(found,'GATE')[0].line,/justified: no checkable condition, waits on: Peer dependency/);
  assert.equal(byType(found,'STALLED').length,1,'the stall itself is still reported');

  // The same named job settling after the gate is evidence the gate can go.
  ledger.db.prepare('UPDATE jobs SET status=?,updated_at=? WHERE job_id=?').run('succeeded',NOW-20*MIN,'op-interface.draw-da76af80ce');
  const [stale]=byType(stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier()}),'STALE-GATE');
  assert.match(stale.line,/named job\(s\) settled after the gate: op-interface\.draw-da76af80ce succeeded \d\d:\d\d/);
  assert.doesNotMatch(stale.line,/no owner ask open/);
}));

// Live false positive (2026-09-24, mia-mia): STALE-GATE for wf-miamia-base-repos-mud7kk5c inc-55060d946270
// because peer heads-up pm-a34aec2c6891 ("Brand job admitted after Grammar 0.5.0 proof") arrived after the
// gate. The gate waits for .starciwork/brand/index.yaml to SETTLE; the brand job was only admitted and the
// record did not exist yet. A gate that names a path is released by that path landing and nothing else;
// a pending peer message is UNREAD-PEER (the Kernel reads its inbox), never STALE-GATE.
test('a gate naming a record is not released by a peer heads-up while the record is absent; the pending message is UNREAD-PEER',t=>withLedger(t,({repoRoot,ledger})=>{
  const BASE='wf-miamia-base-repos-mud7kk5c',WORK='wf-miamia-work-and-stacks-mud7kjun';
  const text=`Supervisor holds interface.scaffold until .starciwork/brand/index.yaml is settled by peer ${WORK} (heads-up when brand lands).`;
  seedWorkflow(ledger,{id:BASE,now:NOW-600*MIN,events:[
    {kind:'op-settled',payload:{},created_at:NOW-120*MIN},
    {kind:'incident-raised',entityType:'incident',entityId:'inc-55060d946270',payload:{kind:'owner-gate',detail:text,holds:['interface.scaffold']},created_at:NOW-180*MIN}]});
  seedWorkflow(ledger,{id:WORK,now:NOW-600*MIN,events:[{kind:'op-dispatched',payload:{},created_at:NOW-5*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,last_progress,status,updated_at) VALUES(?,?,?,?,?,?)")
    .run('inc-55060d946270',BASE,'interface.scaffold',`[owner-gate] ${text}`,'open',NOW-180*MIN);
  ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,?,?)")
    .run(BASE,'peer-message','pm-a34aec2c6891',JSON.stringify({from:WORK,kind:'heads-up',subject:'Brand job admitted after Grammar 0.5.0 proof'}),'pending',NOW-20*MIN);
  const run=()=>stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:()=>frontier({state:'peer-message',actionable:true})});
  const found=run().filter(f=>f.workflowId===BASE);
  assert.equal(found.filter(f=>f.type==='STALE-GATE').length,0,'the record the gate waits for does not exist');
  assert.match(found.find(f=>f.type==='GATE').line,/justified: waits: \.starciwork\/brand\/index\.yaml is absent/);
  const unread=found.find(f=>f.type==='UNREAD-PEER');
  assert.equal(unread.alert,false);
  assert.match(unread.line,/^UNREAD-PEER wf-miamia-base-repos-mud7kk5c pm-a34aec2c6891 from wf-miamia-work-and-stacks-mud7kjun \[heads-up\] Brand job admitted after Grammar 0\.5\.0 proof: pending since \d\d:\d\d \(20m\); inc-55060d946270 may concern it and still holds; tell its Kernel to read api inbox/);

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

// The StarCi-Housekeeping scheduled task (resume-all.mjs --install-startup) runs
// scripts/supervisor/housekeeping.mjs --apply daily; its JSON report lands beside stall-alerts.json
// and every stall pass surfaces its totals on the line stall-alert.log keeps.
test('stall-alert surfaces the daily housekeeping report from the connectors state file; missing or stale is reported, never a failure',async t=>{
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    const env={LOCALAPPDATA:machineHome,STARCI_CONNECTORS_OFF:'1'};
    const file=housekeepingReportFile(env);
    assert.match(file,/StarCi[/\\]runtime[/\\]connectors[/\\]housekeeping-report\.json$/);
    const run=(now)=>runStallAlert({repos:[repoRoot],env,now,stallMinutes:30,frontierOf:()=>frontier()});

    const none=await run(NOW);
    assert.equal(none.ok,true);
    assert.deepEqual(none.housekeeping,{file,missing:true});
    assert.match(describe(none).split('\n')[0],/housekeeping: no report yet/);

    fs.mkdirSync(path.dirname(file),{recursive:true});
    fs.writeFileSync(file,JSON.stringify({schema:'starci/housekeeping-report@1',at:NOW-2*MIN,ok:true,apply:true,totals:{tmpRemoved:42,freedBytes:1572864}}));
    const fresh=await run(NOW);
    assert.deepEqual({missing:fresh.housekeeping.missing,ok:fresh.housekeeping.ok,stale:fresh.housekeeping.stale,at:fresh.housekeeping.at},
      {missing:false,ok:true,stale:false,at:NOW-2*MIN});
    assert.deepEqual(fresh.housekeeping.totals,{tmpRemoved:42,freedBytes:1572864});
    assert.match(describe(fresh).split('\n')[0],/housekeeping ran \d\d:\d\d \(\d+m\): tmpRemoved 42, freedBytes 1572864/,'its totals ride the log line');

    fs.writeFileSync(file,JSON.stringify({at:NOW-40*60*MIN,ok:false,totals:{}}));
    const stale=await run(NOW);
    assert.equal(stale.ok,true,'a failed or old report never fails the stall pass');
    assert.equal(stale.housekeeping.ok,false);
    assert.equal(stale.housekeeping.stale,true);
    assert.match(describe(stale).split('\n')[0],/housekeeping FAILED .* \(stale\)/);

    assert.deepEqual(housekeepingStatus({env:{LOCALAPPDATA:path.join(machineHome,'absent')},now:NOW}).missing,true,'an unreadable file reads as missing');
  });
});
