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
