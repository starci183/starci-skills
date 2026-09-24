import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {stallFindings,peerWaits,judgePeerWait} from '../scripts/supervisor/stall.mjs';
import {ALERT_TYPES,planAlerts} from '../scripts/supervisor/stall-alert.mjs';

// mia-mia wf-miamia-work-and-stacks-mud7kjun sat at orphaned-frontier / actionable:true with zero open
// operations: its next approved op (brand.decide) cannot pass preflight until PEER workflow
// wf-miamia-base-repos-mud7kk5c installs @starci/grammar 0.5.0 (inc-0aebf976e625, inc-64d1d237f5e0, peer
// requests pm-ab67deff28d8 / pm-fe941a794752). The projection woke the Kernel for nothing and hid the
// cause. `api incident --kind peer-wait --peer <workflowId>` records the wait: the frontier reads peer-wait,
// not actionable; the held jobs read queuedBecause peer-wait; a message from that peer wakes the Kernel
// (and resolves an --until-message wait); the supervisor judges the wait instead of alerting STALLED.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastLine=text=>json(String(text).trim().split('\n').at(-1));

const WORK='wf-miamia-work-and-stacks-mud7kjun',BASE='wf-miamia-base-repos-mud7kk5c',DONE='wf-miamia-finished',OTHER='wf-miamia-other';
const DETAIL='brand.decide preflight needs installed @starci/grammar 0.5.0 in FE; peer owns the FE upgrade (pm-ab67deff28d8)';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-peer-wait-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const base={...process.env};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete base[key];
  const api=args=>spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:base});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const at=Date.now();
    for(const [workflowId,phase] of [[WORK,'running'],[BASE,'running'],[DONE,'finished'],[OTHER,'running']]){
      ledger.ensureWorkflow({workflowId,title:workflowId,ledgerMode:'durable',sourceRoots:[repo]});
      ledger.db.prepare('UPDATE workflows SET phase=? WHERE workflow_id=?').run(phase,workflowId);
      ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
        .run(workflowId,0,`goal-${workflowId}`,'# goal',JSON.stringify({derivedFrom:'peer-wait-spec'}),at);
    }
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
  const ok=args=>{const r=api(args);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout);};
  const refused=(args,code)=>{const r=api(args);assert.equal(r.status,1,`${args.join(' ')} must be refused: ${r.stdout}`);assert.equal(lastLine(r.stderr)?.code,code,r.stderr);return lastLine(r.stderr);};
  const frontier=wf=>ok(['status','--workflow',wf]).frontier;
  const wait=(extra=[])=>ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--op','brand.decide','--detail',DETAIL,...extra]);
  return {repo,api,ok,refused,read,seed,frontier,wait};
};

test('incident --kind peer-wait names a running peer of this workflow; --peer goes with no other kind',t=>{
  const fx=fixture(t);
  fx.refused(['incident','--workflow',WORK,'--kind','peer-wait','--detail',DETAIL],'peer-wait-peer-missing');
  fx.refused(['incident','--workflow',WORK,'--kind','peer-wait','--peer',WORK,'--detail',DETAIL],'peer-self');
  fx.refused(['incident','--workflow',WORK,'--kind','peer-wait','--peer',DONE,'--detail',DETAIL],'peer-not-running');
  fx.refused(['incident','--workflow',WORK,'--kind','peer-wait','--peer','wf-nowhere','--detail',DETAIL],'peer-unknown');
  fx.refused(['incident','--workflow',WORK,'--kind','owner-gate','--peer',BASE,'--detail',DETAIL],'peer-wait-kind-mismatch');
  const raised=fx.wait(['--refs','pm-ab67deff28d8,pm-fe941a794752','--until-message']);
  assert.deepEqual([raised.kind,raised.peer,raised.untilMessage,raised.refs],['peer-wait',BASE,true,['pm-ab67deff28d8','pm-fe941a794752']]);
  const event=fx.read(db=>JSON.parse(db.prepare("SELECT payload_json FROM events WHERE kind='incident-raised' AND entity_id=?").get(raised.incidentId).payload_json));
  assert.deepEqual(event,{kind:'peer-wait',detail:DETAIL,opId:'brand.decide',peer:BASE,untilMessage:true,refs:['pm-ab67deff28d8','pm-fe941a794752']});
});

test('no open operation and an open peer-wait: the frontier reads peer-wait, not actionable, instead of orphaned-frontier',t=>{
  const fx=fixture(t);
  const before=fx.frontier(WORK);
  assert.deepEqual([before.state,before.actionable],['orphaned-frontier',true],'the defect: an orphaned frontier re-wakes the Kernel');
  assert.match(before.reason,/api incident --kind peer-wait --peer <workflowId>/);
  const {incidentId}=fx.wait();
  const after=fx.frontier(WORK);
  assert.deepEqual([after.state,after.actionable],['peer-wait',false]);
  assert.deepEqual(after.peerWaits.map(w=>[w.incidentId,w.peer,w.peerPhase,w.holds,w.untilMessage]),[[incidentId,BASE,'running',['brand.decide'],false]]);
  assert.deepEqual(after.peerWaitsDead,[]);
  assert.match(after.reason,new RegExp(`peer-wait ${incidentId} waits on ${BASE} \\(holds brand.decide\\)`));
  assert.match(after.reason,/resolve the wait \(api incident --resolve\) once its proof holds/);

  // Resolving it (the proof held) makes the next step the Kernel's again.
  fx.ok(['incident','--workflow',WORK,'--resolve',incidentId,'--detail','peer proof checked']);
  assert.equal(fx.frontier(WORK).state,'orphaned-frontier');
});

test('a queued job the peer-wait holds reads queuedBecause peer-wait, the frontier reads peer-wait, and route/dispatch refuse it',t=>{
  const fx=fixture(t);
  const {incidentId}=fx.wait();
  const job=fx.ok(['enqueue','--workflow',WORK,'--op','brand.decide','--paths','.starciwork/brand']).job_id;
  const front=fx.frontier(WORK);
  assert.deepEqual([front.state,front.actionable,front.readyOperations],['peer-wait',false,0],'a held job is the peer\'s to unblock, not engaged work');
  const row=front.queued.find(q=>q.jobId===job);
  assert.equal(row.queuedBecause,'peer-wait');
  assert.deepEqual(row.blockedBy,{incident:incidentId,peer:BASE});
  assert.deepEqual(front.queuedCauses,{'peer-wait':1});
  const dispatch=fx.api(['dispatch','--job',job]);
  assert.equal(dispatch.status,1);
  assert.deepEqual([json(dispatch.stdout).reason,json(dispatch.stdout).incident,json(dispatch.stdout).peer],['peer-wait',incidentId,BASE]);
  const route=fx.api(['route','--job',job]);
  assert.equal(route.status,1);
  assert.equal(json(route.stdout).reason,'peer-wait');
});

test('a message from the awaited peer resolves an --until-message wait and wakes the waiter; another peer\'s message does not',t=>{
  const fx=fixture(t);
  const until=fx.wait(['--until-message']).incidentId;
  const holding=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--op','interface.draw','--detail','needs the FE shell the peer writes']).incidentId;
  const other=fx.ok(['notify','--workflow',OTHER,'--to',WORK,'--kind','heads-up','--subject','unrelated','--body','nothing about grammar']);
  assert.equal(other.sent[0].peerWait,undefined,'a message from another workflow is not the awaited one');
  assert.equal(fx.read(db=>db.prepare("SELECT status FROM incidents WHERE incident_id=?").get(until).status),'open');

  // The waiter's request, then the peer's reply to it (--reply-to names a message the replier received).
  const request=fx.ok(['notify','--workflow',WORK,'--to',BASE,'--kind','request','--subject','FE Grammar 0.5.0 installed proof','--body','send the installed-version proof']).sent[0].key;
  const sent=fx.ok(['notify','--workflow',BASE,'--to',WORK,'--kind','reply','--reply-to',request,
    '--subject','re: FE Grammar 0.5.0','--body','installed 0.5.0: package.json, lockfile and node_modules agree']);
  const arrived=sent.sent[0].peerWait;
  assert.deepEqual(arrived.waits.sort(),[until,holding].sort());
  assert.deepEqual(arrived.resolved,[until]);
  assert.equal(arrived.wake,'kernel-signal-absent','the wake is attempted (no Kernel terminal in a spec)');
  fx.read(db=>{
    assert.equal(db.prepare("SELECT status FROM incidents WHERE incident_id=?").get(until).status,'resolved');
    assert.equal(db.prepare("SELECT status FROM incidents WHERE incident_id=?").get(holding).status,'open','a wait without --until-message stays for the Kernel to resolve');
    const resolved=JSON.parse(db.prepare("SELECT payload_json FROM events WHERE kind='incident-resolved' AND entity_id=?").get(until).payload_json);
    assert.equal(resolved.peerMessage,sent.sent[0].key);
    assert.equal(resolved.by,'peer-message');
  });
  const front=fx.frontier(WORK);
  assert.deepEqual([front.state,front.actionable],['peer-message',true],'the pending message is the Kernel\'s move');
});

test('a peer-wait on a peer that stopped running can never be met: the frontier is actionable and names it',t=>{
  const fx=fixture(t);
  const {incidentId}=fx.wait();
  fx.seed(l=>l.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(BASE));
  const front=fx.frontier(WORK);
  assert.equal(front.state,'peer-wait');
  assert.equal(front.actionable,true);
  assert.deepEqual(front.peerWaitsDead,[incidentId]);
  assert.match(front.reason,new RegExp(`${incidentId} on ${BASE} \\(finished\\) can no longer be met`));
});

/* ------------------------------------------------ settles deferred behind a wait */
// nivo wf-nivo-app-auth-mudqjob3 consumed op-backend.implement-86ff31372a's report and deliberately held
// its cut-closing settle until peer wf-nivo-workspace-provision-mudqjokb landed a commit, recorded as
// peer-wait inc-9f2e1e7ff1f6 --holds <that job>. Status still read settle-ready ACTIONABLE (a wait held
// only queued jobs), so the watchdog re-woke the Kernel every tick and stall.mjs alerted STALLED.
const SETTLE_JOB='op-backend.implement-86ff31372a',OTHER_SETTLE='op-backend.implement-1234567890';
const seedConsumed=(ledger,workflowId,jobId,{op='backend.implement',attempt=25,at=Date.now()}={})=>{
  ledger.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
    VALUES(?,?,?,?,0,'op','op',?,'running',?,?)`).run(jobId,workflowId,op,attempt,JSON.stringify({opId:op}),at,at);
  ledger.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,consumed_at,created_at)
    VALUES(?,?,?,?,0,'done',?,?,?)`).run(workflowId,jobId,op,attempt,JSON.stringify({outcome:'done',summary:'done'}),at,at);
};

test('a consumed-but-unsettled job a peer-wait holds is a deferred settle: heldSettleJobs, frontier peer-wait, not actionable',t=>{
  const fx=fixture(t);
  fx.seed(l=>seedConsumed(l,WORK,SETTLE_JOB));
  const before=fx.frontier(WORK);
  assert.deepEqual([before.state,before.actionable,before.settleReadyJobs,before.heldSettleJobs],['settle-ready',true,[SETTLE_JOB],[]]);
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--holds',SETTLE_JOB,'--detail','the cut-closing full gate needs the peer workspace commit']);
  const held=fx.frontier(WORK);
  assert.deepEqual([held.state,held.actionable,held.settleReadyJobs],['peer-wait',false,[]],'a settle the Kernel deferred behind a recorded wait is not work it can do');
  assert.equal(held.heldSettleJobs.length,1);
  const [row]=held.heldSettleJobs;
  assert.deepEqual([row.jobId,row.opId,row.attempt,row.heldBecause,row.blockedBy],[SETTLE_JOB,'backend.implement',25,'peer-wait',{incident:incidentId,peer:BASE}]);
  assert.match(row.detail,new RegExp(`peer-wait incident ${incidentId} holds its settle until peer ${BASE}`));
  assert.match(held.reason,new RegExp(`the settle of ${SETTLE_JOB} \\(${incidentId}\\) is deferred behind its wait`));
  const env={...process.env};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete env[key];
  const plain=spawnSync(process.execPath,[API,'status','--workflow',WORK,'--repo',fx.repo],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env}).stdout;
  assert.match(plain,new RegExp(`held-settle: ${SETTLE_JOB} \\(backend.implement a25\\) peer-wait ${incidentId}`));

  // A settle the wait does not name is still the Kernel's move.
  fx.seed(l=>seedConsumed(l,WORK,OTHER_SETTLE,{attempt:26}));
  const mixed=fx.frontier(WORK);
  assert.deepEqual([mixed.state,mixed.actionable,mixed.settleReadyJobs,mixed.heldSettleJobs.map(h=>h.jobId)],['settle-ready',true,[OTHER_SETTLE],[SETTLE_JOB]]);
  assert.match(mixed.reason,new RegExp(`^${OTHER_SETTLE} filed a report you consumed but never settled`));
});

test('an owner-gate naming a consumed-but-unsettled job defers its settle: frontier awaiting-owner, not actionable',t=>{
  const fx=fixture(t);
  fx.seed(l=>seedConsumed(l,WORK,SETTLE_JOB));
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--op','backend.implement','--detail','owner signs the release before the cut closes']);
  const f=fx.frontier(WORK);
  assert.deepEqual([f.state,f.actionable,f.settleReadyJobs],['awaiting-owner',false,[]]);
  assert.deepEqual(f.heldSettleJobs.map(h=>[h.jobId,h.heldBecause,h.blockedBy]),[[SETTLE_JOB,'owner-gate',{incident:incidentId}]],'--op holds every settle of that op, as it holds queued jobs');
  assert.match(f.reason,new RegExp(`owner-gate incident\\(s\\) ${incidentId}; the settle of ${SETTLE_JOB}`));
  fx.ok(['incident','--workflow',WORK,'--resolve',incidentId,'--detail','owner signed']);
  const after=fx.frontier(WORK);
  assert.deepEqual([after.state,after.actionable,after.settleReadyJobs,after.heldSettleJobs],['settle-ready',true,[SETTLE_JOB],[]]);
});

test('resolving the wait makes the deferred settle settle-ready again; the peer\'s message resolves an --until-message wait and wakes the Kernel',t=>{
  const fx=fixture(t);
  fx.seed(l=>seedConsumed(l,WORK,SETTLE_JOB));
  const kept=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--holds',SETTLE_JOB,'--detail','peer workspace commit']).incidentId;
  assert.equal(fx.frontier(WORK).state,'peer-wait');
  fx.ok(['incident','--workflow',WORK,'--resolve',kept,'--detail','peer commit landed: full gate green']);
  const resolved=fx.frontier(WORK);
  assert.deepEqual([resolved.state,resolved.actionable,resolved.settleReadyJobs],['settle-ready',true,[SETTLE_JOB]],'actionable again: the watchdog wakes the Kernel to check and settle');

  const until=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--holds',SETTLE_JOB,'--until-message','--detail','peer workspace commit']).incidentId;
  assert.deepEqual([fx.frontier(WORK).state,fx.frontier(WORK).actionable],['peer-wait',false]);
  const sent=fx.ok(['notify','--workflow',BASE,'--to',WORK,'--kind','heads-up','--subject','workspace commit landed','--body','commit abc123 on main']);
  const arrived=sent.sent[0].peerWait;
  assert.deepEqual(arrived.resolved,[until]);
  assert.equal(arrived.wake,'kernel-signal-absent','the wake is attempted (no Kernel terminal in a spec)');
  const woken=fx.frontier(WORK);
  assert.deepEqual([woken.state,woken.actionable,woken.settleReadyJobs,woken.heldSettleJobs,woken.peerMessageKeys],['settle-ready',true,[SETTLE_JOB],[],[sent.sent[0].key]],'the released settle ranks before the pending message');
  fx.ok(['inbox','--workflow',WORK,'--ack',sent.sent[0].key,'--disposition','commit verified; settling']);
  assert.deepEqual([fx.frontier(WORK).state,fx.frontier(WORK).actionable],['settle-ready',true]);
});

/* ------------------------------------------------------------- supervisor */
const MIN=60_000;
const NOW=Date.now();
const seedPair=(ledger,{waitAgoMin=120,peerMovedAgoMin=5,waiterIdleMin=120,peerPhase='running',extra={}}={})=>{
  seedWorkflow(ledger,{id:WORK,now:NOW-600*MIN,events:[
    {kind:'op-settled',payload:{},created_at:NOW-waiterIdleMin*MIN},
    {kind:'incident-raised',entityType:'incident',entityId:'inc-0aebf976e625',payload:{kind:'peer-wait',detail:DETAIL,opId:'brand.decide',peer:BASE,untilMessage:false,refs:['pm-ab67deff28d8'],...extra},created_at:NOW-waitAgoMin*MIN},
  ]});
  seedWorkflow(ledger,{id:BASE,now:NOW-600*MIN,events:[{kind:'op-settled',payload:{},created_at:NOW-peerMovedAgoMin*MIN}]});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WORK);
  ledger.db.prepare("UPDATE workflows SET phase=? WHERE workflow_id=?").run(peerPhase,BASE);
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,last_progress,status,updated_at) VALUES(?,?,?,?,?,?)")
    .run('inc-0aebf976e625',WORK,'brand.decide',`[peer-wait] ${DETAIL}`,'open',NOW-waitAgoMin*MIN);
};
const parked=()=>({ok:true,frontier:{state:'peer-wait',actionable:false,queued:[],queuedCauses:{},reason:'peer-wait'},workers:[]});
const byType=(found,type)=>found.filter(f=>f.type===type&&f.workflowId===WORK);

test('stall: a peer-wait whose peer is running and moving is PEER-WAIT justified, and the parked workflow is not alerted STALLED',t=>withLedger(t,({repoRoot,ledger})=>{
  seedPair(ledger);
  const [wait]=peerWaits(ledger.db,WORK);
  assert.deepEqual([wait.peer,wait.holds,wait.refs],[BASE,['brand.decide'],['pm-ab67deff28d8']]);
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:parked});
  const [line]=byType(found,'PEER-WAIT');
  assert.ok(line,'the wait is explained');
  assert.equal(line.alert,false);
  assert.match(line.line,new RegExp(`^PEER-WAIT ${WORK} inc-0aebf976e625 \\[peer-wait\\] on ${BASE} holds brand.decide: justified: peer ${BASE} is running and moved 5m ago`));
  const [stalled]=byType(found,'STALLED');
  assert.equal(stalled.alert,false,'a frontier parked on a justified peer-wait is not a stall');
  assert.equal(stalled.justifiedPeerWait,true);
  assert.equal(planAlerts(found,{},{now:NOW}).inbox.length,0,'nothing alerts');
}));

test('stall: STALE-PEER-WAIT when the peer is idle too',t=>{
  assert.ok(ALERT_TYPES.includes('STALE-PEER-WAIT'));
  withLedger(t,({repoRoot,ledger})=>{
    seedPair(ledger,{peerMovedAgoMin:90});
    const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:parked});
    const [stale]=byType(found,'STALE-PEER-WAIT');
    assert.ok(stale,'both workflows wait and nobody moves');
    assert.equal(stale.alert,true);
    assert.match(stale.line,new RegExp(`peer ${BASE} is idle too: no progress for 90m`));
    assert.equal(byType(found,'STALLED')[0].alert,true,'a stale wait no longer justifies the stall');
  });
});

test('stall: a peer whose ledger is quiet but whose worker or Kernel is mid-turn is working, not idle',t=>withLedger(t,({repoRoot,ledger})=>{
  // nivo AUTH inc-9f2e1e7ff1f6 read STALE-PEER-WAIT + STALLED while its peer's
  // op-backend.implement-82b3110067 worker (Devin) was active: only ledger events counted.
  seedPair(ledger,{peerMovedAgoMin:90});
  const asked=[];
  const workerBusy=(repo,wf)=>{asked.push(wf);return wf===BASE?{...parked(),workers:[{jobId:'op-backend.implement-82b3110067',liveness:'active'}]}:parked();};
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:workerBusy,kernelTurnOf:()=>null});
  assert.equal(byType(found,'STALE-PEER-WAIT').length,0,'a worker mid-turn is the peer moving');
  const [line]=byType(found,'PEER-WAIT');
  assert.match(line.line,new RegExp(`justified: peer ${BASE} is running and working \\(worker op-backend\\.implement-82b3110067 mid-turn; its ledger quiet 90m\\)`));
  assert.deepEqual([byType(found,'STALLED')[0].alert,byType(found,'STALLED')[0].justifiedPeerWait],[false,true],'so the parked workflow is not a stall either');
  assert.ok(asked.includes(BASE),'the peer\'s own api status is read');

  // Its Kernel mid-turn counts the same; a Kernel at its prompt does not.
  const kernelBusy=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:parked,kernelTurnOf:(db,wf)=>(wf===BASE?'active':'turn-idle')});
  assert.match(byType(kernelBusy,'PEER-WAIT')[0].line,/is running and working \(its Kernel is mid-turn; its ledger quiet 90m\)/);
  const idle=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:parked,kernelTurnOf:()=>'turn-idle'});
  assert.equal(byType(idle,'STALE-PEER-WAIT').length,1,'nobody working: the peer is idle');
}));

test('stall: a peer-wait holding a deferred settle is justified like one holding a queued job; STALE-PEER-WAIT rules unchanged',t=>withLedger(t,({repoRoot,ledger})=>{
  seedPair(ledger,{extra:{holds:[SETTLE_JOB]}});
  seedConsumed(ledger,WORK,SETTLE_JOB,{at:NOW-130*MIN});
  const held=()=>({ok:true,frontier:{state:'peer-wait',actionable:false,queued:[],queuedCauses:{},settleReadyJobs:[],
    heldSettleJobs:[{jobId:SETTLE_JOB,heldBecause:'peer-wait',blockedBy:{incident:'inc-0aebf976e625',peer:BASE}}],reason:'peer-wait'},workers:[{jobId:SETTLE_JOB,liveness:'turn-idle'}]});
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:held});
  const [line]=byType(found,'PEER-WAIT');
  assert.ok(line,'the wait is explained');
  assert.equal(line.alert,false);
  assert.match(line.line,new RegExp(`^PEER-WAIT ${WORK} inc-0aebf976e625 \\[peer-wait\\] on ${BASE} defers the settle of ${SETTLE_JOB}: justified: peer ${BASE} is running`));
  const [stalled]=byType(found,'STALLED');
  assert.deepEqual([stalled.alert,stalled.justifiedPeerWait],[false,true],'a Kernel parked on a deferred settle behind a justified wait is not stalled');
  assert.equal(planAlerts(found,{},{now:NOW}).inbox.length,0,'nothing alerts');

  // The same wait with an idle peer is still STALE-PEER-WAIT, and the stall alerts again.
  ledger.db.prepare("UPDATE events SET created_at=? WHERE workflow_id=? AND kind='op-settled'").run(NOW-90*MIN,BASE);
  const stale=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,frontierOf:held});
  const [staleLine]=byType(stale,'STALE-PEER-WAIT');
  assert.ok(staleLine);
  assert.match(staleLine.line,new RegExp(`defers the settle of ${SETTLE_JOB} for 120m: peer ${BASE} is idle too`));
  assert.equal(byType(stale,'STALLED')[0].alert,true);
}));

test('stall: an owner gate naming a deferred settle reports it in its GATE line and the STALLED gate bits',t=>withLedger(t,({repoRoot,ledger})=>{
  seedWorkflow(ledger,{id:WORK,now:NOW-600*MIN,events:[
    {kind:'op-settled',payload:{},created_at:NOW-120*MIN},
    {kind:'incident-raised',entityType:'incident',entityId:'inc-ownerhold01',payload:{kind:'owner-gate',detail:'owner signs the release',opId:'backend.implement',holds:[SETTLE_JOB]},created_at:NOW-120*MIN},
  ]});
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(WORK);
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,last_progress,status,updated_at) VALUES(?,?,?,?,?,?)")
    .run('inc-ownerhold01',WORK,'backend.implement','[owner-gate] owner signs the release','open',NOW-120*MIN);
  seedConsumed(ledger,WORK,SETTLE_JOB,{at:NOW-130*MIN});
  const found=stallFindings(ledger.db,{repo:repoRoot,now:NOW,stallMinutes:30,
    frontierOf:()=>({ok:true,frontier:{state:'awaiting-owner',actionable:false,queued:[],queuedCauses:{},reason:'owner'},workers:[]})});
  const [gate]=byType(found,'GATE');
  assert.match(gate.line,new RegExp(`inc-ownerhold01 \\[owner-gate\\] holds 0 queued job\\(s\\) and defers the settle of ${SETTLE_JOB}`));
  const [stalled]=byType(found,'STALLED');
  assert.match(stalled.line,new RegExp(`frontier awaiting-owner; gates: inc-ownerhold01 justified defers settle of ${SETTLE_JOB}`));
  assert.doesNotMatch(stalled.line,/ACTIONABLE/);
}));

test('judgePeerWait: a finished peer is stale; a message from the peer is UNREAD-PEER, never staleness; a young wait and an unknown peer',t=>withLedger(t,({ledger})=>{
  seedPair(ledger,{peerPhase:'finished'});
  const dbOf=wf=>ledger.db.prepare('SELECT 1 FROM workflows WHERE workflow_id=?').get(wf)?ledger.db:null;
  const [wait]=peerWaits(ledger.db,WORK);
  const finished=judgePeerWait({db:ledger.db,workflowId:WORK,wait,dbOf,now:NOW});
  assert.equal(finished.stale,true);
  assert.match(finished.reasons[0],/is phase finished, so it will land nothing more/);
  ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(BASE);
  ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,?,?)")
    .run(WORK,'peer-message','pm-proof00000001',JSON.stringify({from:BASE,kind:'reply',subject:'installed 0.5.0'}),'pending',NOW-10*MIN);
  const messaged=judgePeerWait({db:ledger.db,workflowId:WORK,wait,dbOf,now:NOW});
  assert.equal(messaged.stale,false,'a message is the wake, not proof the wait is over');
  assert.deepEqual(messaged.unread.map(m=>m.key),['pm-proof00000001'],'the pending message is for the Kernel to read');
  const found=stallFindings(ledger.db,{now:NOW,stallMinutes:30,frontierOf:()=>({ok:true,frontier:{state:'peer-message',actionable:true,queued:[],queuedCauses:{}},workers:[]})});
  const [unreadLine]=found.filter(f=>f.type==='UNREAD-PEER');
  assert.equal(unreadLine.alert,false);
  assert.ok(unreadLine.line.startsWith(`UNREAD-PEER ${WORK} pm-proof00000001 from ${BASE} [reply] installed 0.5.0: pending since `),unreadLine.line);
  assert.match(unreadLine.line,/inc-0aebf976e625 may concern it and still holds; tell its Kernel to read api inbox/);
  ledger.db.prepare("UPDATE inbox SET status='applied' WHERE key='pm-proof00000001'").run();
  const acked=judgePeerWait({db:ledger.db,workflowId:WORK,wait,dbOf,now:NOW});
  assert.deepEqual([acked.stale,acked.unread],[false,[]],'the Kernel read it and kept the wait: its call');
  assert.equal(judgePeerWait({db:ledger.db,workflowId:WORK,wait:{...wait,raisedAt:NOW-2*MIN},dbOf,now:NOW}).stale,false,'a young wait is not judged');
  const unknown=judgePeerWait({db:ledger.db,workflowId:WORK,wait:{...wait,peer:'wf-elsewhere'},dbOf,now:NOW});
  assert.deepEqual([unknown.stale,unknown.unknown],[false,true]);
}));
