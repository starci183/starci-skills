import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {parseCondition,evaluateCondition,typedIncidents,recordRevision} from '../scripts/kernel/gate-conditions.mjs';

// Owner-gate and peer-wait incidents described their release only in free text; nobody re-checked it
// and workflows sat for hours after it held (nivo AUTH inc-9f2e1e7ff1f6 waited on WSPV's
// op-backend.implement-82b3110067; Collab inc-28187662c4fe on the Modules shell rev). Typed
// --until-* conditions are stored on the incident, evaluated read-only on every status (every watchdog
// tick), before route/dispatch, after a settle and after a peer message, and the runtime resolves the
// incident once all hold. Opt-in: an incident without them keeps its free-text behaviour exactly.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const json=text=>{try{return JSON.parse(text);}catch{return null;}};
const lastLine=text=>json(String(text).trim().split('\n').at(-1));
const WORK='wf-gc-work',BASE='wf-gc-base',DONE='wf-gc-finished';

const fixture=t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-gate-cond-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(root,'repo');fs.mkdirSync(repo,{recursive:true});
  const env={...process.env};
  for(const key of ['ORCA_TERMINAL_HANDLE','STARCI_ROLE','STARCI_OP_JOB'])delete env[key];
  const api=(args,{json:asJson=true}={})=>spawnSync(process.execPath,[API,...args,'--repo',repo,...(asJson?['--json']:[])],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    const at=Date.now();
    for(const [workflowId,phase] of [[WORK,'running'],[BASE,'running'],[DONE,'finished']]){
      ledger.ensureWorkflow({workflowId,title:workflowId,ledgerMode:'durable',sourceRoots:[repo]});
      ledger.db.prepare('UPDATE workflows SET phase=? WHERE workflow_id=?').run(phase,workflowId);
      ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
        .run(workflowId,0,`goal-${workflowId}`,'# goal',JSON.stringify({derivedFrom:'gate-conditions-spec'}),at);
    }
  }finally{ledger.close();}
  const read=fn=>{const l=inspectLedger({file:ledgerFileFor(repo)});try{return fn(l.db);}finally{l.close();}};
  const seed=fn=>{const l=openLedger({file:ledgerFileFor(repo)});try{return fn(l);}finally{l.close();}};
  const ok=args=>{const r=api(args);assert.equal(r.status,0,`${args.join(' ')}: ${r.stderr||r.stdout}`);return json(r.stdout);};
  const refused=(args,code)=>{const r=api(args);assert.equal(r.status,1,`${args.join(' ')} must be refused: ${r.stdout}`);assert.equal(lastLine(r.stderr)?.code,code,r.stderr);return lastLine(r.stderr);};
  const frontier=wf=>ok(['status','--workflow',wf]).frontier;
  const incidentStatus=id=>read(db=>db.prepare('SELECT status FROM incidents WHERE incident_id=?').get(id)?.status);
  const events=(id,kind)=>read(db=>db.prepare('SELECT payload_json FROM events WHERE entity_id=? AND kind=? ORDER BY seq').all(id,kind).map(r=>JSON.parse(r.payload_json)));
  const seedJob=(workflowId,jobId,{op='backend.implement',status='running',payload={}}={})=>seed(l=>{
    const at=Date.now();
    l.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
      VALUES(?,?,?,1,0,'op','op',?,?,?,?)`).run(jobId,workflowId,op,JSON.stringify({opId:op,...payload}),status,at,at);
  });
  const setJob=(jobId,status)=>seed(l=>l.db.prepare('UPDATE jobs SET status=?,updated_at=? WHERE job_id=?').run(status,Date.now(),jobId));
  return {root,repo,api,ok,refused,read,seed,frontier,incidentStatus,events,seedJob,setJob};
};

const PEER_JOB='op-backend.implement-82b3110067';

test('parseCondition reads every typed form, Windows drive paths included, and refuses a malformed one',()=>{
  assert.deepEqual(parseCondition('record','.starciwork/shell/index.yaml'),{type:'record',path:'.starciwork/shell/index.yaml'});
  assert.deepEqual(parseCondition('record','.starciwork/shell>=18'),{type:'record',path:'.starciwork/shell',minRev:18});
  assert.deepEqual(parseCondition('record','.starciwork/brand@done'),{type:'record',path:'.starciwork/brand',state:'done'});
  assert.deepEqual(parseCondition('job',PEER_JOB),{type:'job',jobId:PEER_JOB,want:'settled'});
  assert.deepEqual(parseCondition('job',`${PEER_JOB}:succeeded`),{type:'job',jobId:PEER_JOB,want:'succeeded'});
  assert.deepEqual(parseCondition('message',`${BASE}:reply`),{type:'message',peer:BASE,kind:'reply'});
  assert.deepEqual(parseCondition('commit','D:/Repositories/miamia-fe:app/layout.tsx'),{type:'commit',repo:'D:/Repositories/miamia-fe',target:'app/layout.tsx'});
  assert.deepEqual(parseCondition('incident','inc-123456789012'),{type:'incident',incidentId:'inc-123456789012',want:'resolved'});
  assert.throws(()=>parseCondition('job',`${PEER_JOB}:done`),{code:'until-invalid'});
  assert.throws(()=>parseCondition('commit','no-colon'),{code:'until-invalid'});
  assert.throws(()=>parseCondition('incident','inc-1:open'),{code:'until-invalid'});
});

test('an incident without typed conditions keeps its free-text behaviour: stored as before, never auto-resolved',t=>{
  const fx=fixture(t);
  fx.seedJob(BASE,PEER_JOB,{status:'succeeded'});
  const raised=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--op','brand.decide','--detail',`wait for ${PEER_JOB} to settle`]);
  assert.equal(raised.until,undefined);
  assert.deepEqual(fx.events(raised.incidentId,'incident-raised'),[{kind:'peer-wait',detail:`wait for ${PEER_JOB} to settle`,opId:'brand.decide',peer:BASE,untilMessage:false,refs:[]}]);
  const f=fx.frontier(WORK);
  assert.deepEqual([f.state,f.actionable,f.gateConditions,f.autoResolved],['peer-wait',false,undefined,undefined]);
  assert.equal(fx.incidentStatus(raised.incidentId),'open','the named job settled, yet a free-text wait stays for the Kernel');
});

test('--until-job: the status after the awaited job settles resolves the wait, releases the held job and records the evidence',t=>{
  const fx=fixture(t);
  fx.seedJob(BASE,PEER_JOB);
  const raised=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--op','brand.decide','--until-job',PEER_JOB,'--detail','needs the peer workspace module']);
  assert.deepEqual([raised.status,raised.until],['open',[{type:'job',jobId:PEER_JOB,want:'settled'}]]);
  const job=fx.ok(['enqueue','--workflow',WORK,'--op','brand.decide','--paths','.starciwork/brand']).job_id;
  const held=fx.frontier(WORK);
  assert.deepEqual([held.state,held.actionable,held.queued[0].queuedBecause],['peer-wait',false,'peer-wait']);
  assert.equal(held.gateConditions.length,1);
  assert.deepEqual(held.gateConditions[0].conditions.map(c=>[c.condition,c.met]),[[`job ${PEER_JOB}:settled`,false]]);
  assert.match(held.gateConditions[0].conditions[0].evidence,new RegExp(`${PEER_JOB} \\(${BASE}\\) running`));

  fx.setJob(PEER_JOB,'succeeded');
  const released=fx.frontier(WORK);
  assert.equal(fx.incidentStatus(raised.incidentId),'resolved');
  assert.deepEqual(released.autoResolved.map(r=>r.incidentId),[raised.incidentId]);
  assert.equal(released.queued.find(q=>q.jobId===job).queuedBecause,'ready','the held job is released in the same projection');
  assert.equal(released.actionable,true,'the watchdog wakes the Kernel on this tick');
  assert.equal(released.gateConditions,undefined);
  const [resolvedEvent]=fx.events(raised.incidentId,'incident-resolved');
  assert.equal(resolvedEvent.by,'until-conditions');
  assert.match(resolvedEvent.evidence[0],new RegExp(`job ${PEER_JOB}:settled: ${PEER_JOB} \\(${BASE}\\) succeeded`));
  const [auto]=fx.events(raised.incidentId,'incident-auto-resolved');
  assert.deepEqual([auto.kind,auto.until,auto.holds],['peer-wait',[{type:'job',jobId:PEER_JOB,want:'settled'}],['brand.decide']]);
  assert.equal(fx.frontier(WORK).autoResolved,undefined,'resolved once; the next status has nothing to release');
});

test('--until-job :succeeded on a job that settled failed can no longer be met: actionable, named, never auto-resolved',t=>{
  const fx=fixture(t);
  fx.seedJob(BASE,PEER_JOB);
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--op','brand.decide','--until-job',`${PEER_JOB}:succeeded`,'--detail','peer module must land']);
  assert.deepEqual([fx.frontier(WORK).state,fx.frontier(WORK).actionable],['awaiting-owner',false]);
  fx.setJob(PEER_JOB,'failed');
  const f=fx.frontier(WORK);
  assert.equal(fx.incidentStatus(incidentId),'open');
  assert.equal(f.actionable,true);
  assert.deepEqual(f.gateConditionsUnmeetable,[incidentId]);
  assert.match(f.reason,new RegExp(`typed wait ${incidentId} \\(job ${PEER_JOB} settled failed, not succeeded\\) can no longer be met`));
});

// starci-next sn-subscription inc-da9c2be0115a waited 2h on learn-content fa50f7be16:succeeded after it
// settled failed while its retry 77798b1b10 was queued - the wait read unmeetable and nobody re-pointed it.
test('--until-job follows the retry lineage: a failed job with a queued retry is a live wait, met when the retry succeeds',t=>{
  const fx=fixture(t);
  fx.seedJob(BASE,PEER_JOB);
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--op','brand.decide','--until-job',`${PEER_JOB}:succeeded`,'--detail','peer module must land']);
  fx.setJob(PEER_JOB,'failed');
  assert.deepEqual(fx.frontier(WORK).gateConditionsUnmeetable,[incidentId],'a failure with no retry yet is the Kernel\'s to move');
  const RETRY='op-backend.implement-77798b1b10',at=Date.now();
  fx.seed(l=>l.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
    VALUES(?,?,'backend.implement',2,0,'op','op',?,'queued',?,?)`).run(RETRY,BASE,JSON.stringify({opId:'backend.implement',retry:{retryOf:PEER_JOB}}),at,at));
  const cond={type:'job',jobId:PEER_JOB,want:'succeeded'};
  const live=fx.read(db=>evaluateCondition(db,cond,{repo:fx.repo,workflowId:WORK}));
  assert.deepEqual([live.met,live.unmeetable],[false,undefined]);
  assert.match(live.evidence,new RegExp(`${PEER_JOB} failed, replaced by ${RETRY} \\(${BASE}\\) queued`));
  const f=fx.frontier(WORK);
  assert.deepEqual([f.gateConditionsUnmeetable??[],f.actionable],[[],false]);
  assert.equal(fx.incidentStatus(incidentId),'open');
  fx.setJob(RETRY,'succeeded');
  fx.frontier(WORK);
  assert.equal(fx.incidentStatus(incidentId),'resolved','the retry succeeding releases the wait');
});

test('--until-record: exists, @state and >=rev read the record on disk; every condition must hold',t=>{
  const fx=fixture(t);
  const shell=path.join(fx.repo,'.starciwork','shell');
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--holds','interface.draw',
    '--until-record','.starciwork/shell>=18','--until-record','.starciwork/shell@done','--detail','Collab redraw waits on the Modules shell rev']);
  assert.deepEqual(fx.frontier(WORK).gateConditions[0].conditions.map(c=>[c.met,c.evidence]),[[false,'.starciwork/shell absent'],[false,'.starciwork/shell absent']]);
  fs.mkdirSync(shell,{recursive:true});
  fs.writeFileSync(path.join(shell,'index.yaml'),'id: shell\nstate: done\nrev: 17\n');
  const partial=fx.frontier(WORK).gateConditions[0].conditions;
  assert.deepEqual(partial.map(c=>c.met),[false,true],'one condition holding is not enough');
  assert.equal(partial[0].evidence,'.starciwork/shell state=done rev=17');
  fs.writeFileSync(path.join(shell,'index.yaml'),'id: shell\nstate: done\nrev: 18\n');
  fx.frontier(WORK);
  assert.equal(fx.incidentStatus(incidentId),'resolved');
});

test('--until-commit: a ref, or a path committed at HEAD, of another repo',t=>{
  const fx=fixture(t);
  const other=path.join(fx.root,'fe');fs.mkdirSync(other);
  const git=(...args)=>{const r=spawnSync('git',['-C',other,...args],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
  git('init','-q');git('config','user.email','x@x');git('config','user.name','x');
  fs.writeFileSync(path.join(other,'README.md'),'x');git('add','.');git('commit','-qm','init');
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--op','brand.decide','--until-commit',`${other}:app/layout.tsx`,'--detail','FE app router']);
  fx.frontier(WORK);
  assert.equal(fx.incidentStatus(incidentId),'open');
  fs.mkdirSync(path.join(other,'app'));fs.writeFileSync(path.join(other,'app','layout.tsx'),'export default 1');
  fx.frontier(WORK);
  assert.equal(fx.incidentStatus(incidentId),'open','written but not committed is not landed');
  git('add','.');git('commit','-qm','app');
  const f=fx.frontier(WORK);
  assert.equal(fx.incidentStatus(incidentId),'resolved');
  assert.match(f.autoResolved[0].evidence[0],/app\/layout\.tsx committed at HEAD/);
  // A ref form resolves on the ref.
  const tag=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--op','brand.decide','--until-commit',`${other}:v1`,'--detail','release tag']).incidentId;
  fx.frontier(WORK);assert.equal(fx.incidentStatus(tag),'open');
  git('tag','v1');fx.frontier(WORK);assert.equal(fx.incidentStatus(tag),'resolved');
});

test('--until-incident and a condition already met at raise time resolve at once',t=>{
  const fx=fixture(t);
  const first=fx.ok(['incident','--workflow',BASE,'--kind','environment','--detail','peer toolchain broken']).incidentId;
  const waiting=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--op','brand.decide','--until-incident',first,'--detail','waits on the peer toolchain']);
  assert.equal(waiting.status,'open');
  fx.ok(['incident','--workflow',BASE,'--resolve',first,'--detail','fixed']);
  fx.frontier(WORK);
  assert.equal(fx.incidentStatus(waiting.incidentId),'resolved');
  const already=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--op','brand.decide','--until-incident',first,'--detail','already fixed']);
  assert.equal(already.status,'resolved');
  assert.match(already.autoResolved.evidence[0],new RegExp(`incident ${first}:resolved: ${first} resolved`));
});

test('--until-message <peer>:<kind>: only that kind from that peer, after the wait was raised, resolves it on notify',t=>{
  const fx=fixture(t);
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--op','brand.decide','--until-message',`${BASE}:handoff`,'--detail','peer hands the record over']);
  assert.deepEqual(fx.events(incidentId,'incident-raised')[0].until,[{type:'message',peer:BASE,kind:'handoff'}]);
  const heads=fx.ok(['notify','--workflow',BASE,'--to',WORK,'--kind','heads-up','--subject','soon','--body','almost there']);
  assert.equal(heads.sent[0].autoResolved,undefined);
  assert.equal(fx.incidentStatus(incidentId),'open');
  const handoff=fx.ok(['notify','--workflow',BASE,'--to',WORK,'--kind','handoff','--subject','record ready','--body','shell rev 18 landed']);
  assert.deepEqual(handoff.sent[0].autoResolved.map(r=>[r.incidentId,r.wake]),[[incidentId,'kernel-signal-absent']],'the release wakes the waiter (no Kernel terminal in a spec)');
  assert.equal(fx.incidentStatus(incidentId),'resolved');
});

test('a bare --until-message still means the peer-wait form; typed flags are refused when malformed or naming nothing',t=>{
  const fx=fixture(t);
  const bare=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--op','brand.decide','--until-message','--detail','x']);
  assert.deepEqual([bare.untilMessage,bare.until],[true,undefined]);
  fx.refused(['incident','--workflow',WORK,'--kind','owner-gate','--until-job','op-nothing-0123456789','--detail','x'],'until-job-unknown');
  fx.refused(['incident','--workflow',WORK,'--kind','owner-gate','--until-incident','inc-nope','--detail','x'],'until-incident-unknown');
  fx.refused(['incident','--workflow',WORK,'--kind','owner-gate','--until-message',WORK,'--detail','x'],'until-message-peer-unknown');
  fx.refused(['incident','--workflow',WORK,'--kind','owner-gate','--until-commit','nocolon','--detail','x'],'until-invalid');
});

test('--attach types an already-open free-text incident without re-raising it; a closed one is refused',t=>{
  const fx=fixture(t);
  fx.seedJob(BASE,PEER_JOB);
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','peer-wait','--peer',BASE,'--op','backend.implement','--detail',`Chờ job ${PEER_JOB} settle + sha`]);
  fx.refused(['incident','--workflow',WORK,'--attach',incidentId],'until-missing');
  const attached=fx.ok(['incident','--workflow',WORK,'--attach',incidentId,'--until-job',PEER_JOB]);
  assert.deepEqual([attached.status,attached.until],['open',[{type:'job',jobId:PEER_JOB,want:'settled'}]]);
  assert.deepEqual(fx.read(db=>typedIncidents(db)).map(i=>[i.incidentId,i.kind,i.holds]),[[incidentId,'peer-wait',['backend.implement']]]);
  fx.setJob(PEER_JOB,'succeeded');
  assert.equal(fx.frontier(WORK).autoResolved[0].incidentId,incidentId);
  fx.refused(['incident','--workflow',WORK,'--attach',incidentId,'--until-job',PEER_JOB],'incident-not-open');
  fx.refused(['incident','--workflow',WORK,'--attach','inc-000000000000','--until-job',PEER_JOB],'incident-unknown');
});

test('route and dispatch release a met typed wait before reading the gates',t=>{
  const fx=fixture(t);
  fx.seedJob(BASE,PEER_JOB);
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--op','brand.decide','--until-job',PEER_JOB,'--detail','x']);
  const job=fx.ok(['enqueue','--workflow',WORK,'--op','brand.decide','--paths','.starciwork/brand']).job_id;
  assert.equal(json(fx.api(['route','--job',job]).stdout)?.reason,'owner-gate');
  fx.setJob(PEER_JOB,'succeeded');
  const route=fx.api(['route','--job',job]);
  assert.notEqual(json(route.stdout)?.reason,'owner-gate',route.stdout);
  assert.equal(fx.incidentStatus(incidentId),'resolved');
});

test('evaluateCondition is read-only and a finished workflow\'s incidents are never typed-evaluated',t=>{
  const fx=fixture(t);
  fx.seedJob(BASE,PEER_JOB);
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--op','x','--until-job',`${PEER_JOB}:succeeded`,'--detail','x']);
  fx.seed(l=>l.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(WORK));
  fx.setJob(PEER_JOB,'succeeded');
  fx.frontier(WORK);fx.frontier(BASE);
  assert.equal(fx.incidentStatus(incidentId),'open','a finished workflow\'s leftover incident is history, not a wait to release');
  const cond={type:'job',jobId:PEER_JOB,want:'succeeded'};
  const before=fx.read(db=>db.prepare('SELECT count(*) n FROM events').get().n);
  assert.equal(fx.read(db=>evaluateCondition(db,cond,{repo:fx.repo,workflowId:WORK})).met,true);
  assert.equal(fx.read(db=>db.prepare('SELECT count(*) n FROM events').get().n),before);
});

test('--until-job: a cancelled job is not settled; the wait follows its replacement (nivo auth inc-7c46a61faba1)',t=>{
  const fx=fixture(t);
  const cut={id:'backend-implement-r2',ordinal:3,total:3};
  const at=Date.now();
  const add=(jobId,attempt,status,payload)=>fx.seed(l=>l.db.prepare(`INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,created_at,updated_at)
    VALUES(?,?,?,?,0,'op','op',?,?,?,?)`).run(jobId,BASE,'backend.implement',attempt,JSON.stringify({opId:'backend.implement',...payload}),status,at,at));
  add('op-backend.implement-3156a882e8',31,'cancelled',{cut,retry:{retryOf:'op-backend.implement-7c8f373e93'}});
  const cond={type:'job',jobId:'op-backend.implement-3156a882e8',want:'settled'};
  const evaluate=c=>fx.read(db=>evaluateCondition(db,c,{repo:fx.repo,workflowId:WORK}));
  const none=evaluate(cond);
  assert.equal(none.met,false,'a cancel without a replacement leaves the gate unmet');
  assert.match(none.evidence,/cancelled; no replacement/);
  add('op-backend.implement-712a98deb1',32,'succeeded',{cut:{...cut,ordinal:2},retry:{retryOf:'op-backend.implement-94ca037c3a'}});
  assert.equal(evaluate(cond).met,false,'a sibling ordinal is not the replacement');
  add('op-backend.implement-0c103b186e',33,'running',{cut,retry:{retryOf:'op-backend.implement-7c8f373e93'}});
  const running=evaluate(cond);
  assert.equal(running.met,false);
  assert.match(running.evidence,/3156a882e8 cancelled, replaced by op-backend\.implement-0c103b186e .* running/);
  fx.setJob('op-backend.implement-0c103b186e','failed');
  assert.equal(evaluate(cond).met,true,'the replacement settling fail meets settled');
  const succ=evaluate({...cond,want:'succeeded'});
  assert.equal(succ.met,false);
  assert.match(succ.unmeetable,/0c103b186e settled failed/);
  // uncut: an explicit retry of the cancelled job is its replacement
  add('op-backend.implement-aaaaaaaaaa',40,'cancelled',{retry:{retryOf:'op-backend.implement-9999999999'}});
  add('op-backend.implement-bbbbbbbbbb',41,'succeeded',{retry:{retryOf:'op-backend.implement-aaaaaaaaaa'}});
  assert.equal(evaluate({type:'job',jobId:'op-backend.implement-aaaaaaaaaa',want:'succeeded'}).met,true);
});

// --until-record >=<rev> reads the record's OWN revision (starci-next wf-sn-subscription inc-13eb86851909):
// app-layout (work/ui-screen@1) stood at change.rev 6 yet '>=6' stayed pending with evidence rev=-,
// because only a top-level rev was read and a ui-screen has none - its nested brand.rev 5 / shell.rev 7
// are bindings to other records. Each fixture below is real-shaped (trimmed from starci-next) and its
// nested revs are chosen so that reading one would flip the verdict.
const APP_LAYOUT=`schema: work/ui-screen@1
id: ui.learning-paths.app-layout
title: Signed-in learner app layout
state: done
activity: idle
brand:
  rev: 5
shell:
  ref: shell
  rev: 7
  layouts: []
route: /(app)
surface: layout
persona: learner
refs:
  - fr.identity.access-workspace
  - fr.learning-paths.view-roadmap
  - fr.profiles.view-progress-and-evidence
ui:
  status: Owner-accepted design direction (draw-review ask ctx_b5040e0330e3,
    2026-09-25T05:44:15.030Z); implementation and real-render review remain pending.
  supersededDirection:
    path: .starciwork/features/learning-paths/ui/app-layout/assets/evidence/draw-r1/direction.png
    sha256: d9b90f46ae2337b3d4d36d996ceb9e531e33d92d43f1444086ac574a0c999a70
    reason: Shell rev 7 adds the Subscription navigation destination; the rev 1 drawing showed only
      Roadmap and Profile.
assets:
  - path: assets/directions/rev2--page--desktop--light.content.prompt.txt
    role: prompt
    sha256: 4968ebbdc786eaf5dd25c11205d531b74c28fc23e9e4f49d25422c204b3dc4d9
change:
  rev: 6
  kind: clarifying
  at: 2026-09-25T05:46:16.950Z
  reason: The owner accepted the drawn parts in draw-review ask ctx_b5040e0330e3. Revision 6
    records the accepted shell rev 7 direction for downstream consumers.
verificationSource: authored-claim
because: "The owner accepted the drawn parts (desktop and mobile, light) in draw-review ask
  ctx_b5040e0330e3 at 2026-09-25T05:44:15.030Z."
`;
// A ui-screen bound per layout: shell.layouts[].rev 9 is above the record's own change.rev 3.
const UI_SCREEN_LAYOUTS=`schema: work/ui-screen@1
id: ui.commerce.checkout
state: todo
activity: idle
brand:
  rev: 9
shell:
  ref: shell
  rev: 9
  layouts:
    - node: /(app)
      rev: 9
route: /(app)/subscriptions/checkout
change:
  rev: 3
  kind: clarifying
  at: 2026-09-24T22:21:14Z
  reason: Bound to the /(app) layout rev 9.
`;
const LAYOUT_TREE=`schema: work/layout-tree@1
id: shell
kind: shell
state: done
rev: 7
origin: repository
app:
  repository: starci-next-fe
  root: .
  appDir: src/app
  framework: next-app-router
nodes:
  - id: /
    parent: null
    segment: /
    segmentKind: root
    layout:
      chrome: passthrough
      state: done
      rev: 12
  - id: /(app)
    parent: /
    segment: (app)
    segmentKind: group
    layout:
      chrome: visible
      state: done
      rev: 2
      design: ui.learning-paths.app-layout
change:
  rev: 7
  kind: clarifying
  at: 2026-09-24T22:21:14Z
  reason: Planned /(app)/subscriptions and /(app)/subscriptions/checkout; the accepted /(app) layout (rev 2) is unchanged.
review:
  reviewer: brand.decide operator
  reviewedAt: 2026-09-24T20:57:56Z
  rev: 11
`;
const BRAND=`schema: work/brand@1
id: brand
kind: brand
state: done
activity: idle
rev: 5
brand:
  decisions:
    - rev: 8
      at: 2026-09-24T00:00:00Z
      chosen: B
  tokens:
    primary: "#6a3cf2"
review:
  rev: 9
change:
  rev: 5
  kind: breaking
  at: 2026-09-25T00:00:00Z
  retains:
    - "The rev 4 change block, moved verbatim to evidence/brand-v4/brand-v5/previous-change-rev4.yaml."
`;
const CONTRACT=`schema: work/contract@1
id: contract.authoring.content.reviewed-concept-for-concepts
title: Exact reviewed lesson-content candidate hand-off between Authoring and Concepts
state: todo
activity: idle
owner: authoring
between:
  - authoring
  - concepts
blockedBy:
  - record: contract.commerce.foundation.entitlement-contract
    rev: 14
    because: The publication hand-off reads the entitlement contract at rev 14.
conflictsWith:
  - record: contract.concepts.publication.direct
    rev: 11
    because: Both claim the publication write.
extensions:
  decisions:
    - rev: 10
      at: 2026-09-20T00:00:00Z
      gap: owner
      chosen: authoring
      why: Authoring owns the candidate.
change:
  rev: 2
  kind: clarifying
  at: 2026-09-21T00:00:00Z
  reason: Added the import intake guarantee.
`;

test('recordRevision: the record\'s own top-level rev or change.rev, never a nested binding\'s rev (inc-13eb86851909)',()=>{
  const cases=[
    [{schema:'work/ui-screen@1',brand:{rev:5},shell:{ref:'shell',rev:7,layouts:[]},change:{rev:6,kind:'clarifying'}},{rev:6,source:'change.rev'}],
    [{schema:'work/layout-tree@1',rev:7,nodes:[{layout:{rev:12}}],change:{rev:7}},{rev:7,source:'rev'}],
    [{schema:'work/brand@1',rev:5,brand:{decisions:[{rev:8}]},change:{rev:5}},{rev:5,source:'rev'}],
    [{schema:'work/contract@1',blockedBy:[{record:'x',rev:14}],conflictsWith:[{record:'y',rev:11}],change:{rev:2}},{rev:2,source:'change.rev'}],
    // a change list names its latest entry; a quoted integer is still an integer
    [{change:[{rev:1},{rev:'4'},{rev:3}]},{rev:4,source:'change.rev'}],
    // top-level and change disagreeing: the top-level rev is the record's, the drift is reported
    [{rev:7,change:{rev:8}},{rev:7,source:'rev',changeRev:8}],
    // only nested revs: the record states no revision of its own
    [{brand:{rev:5},shell:{rev:7},review:{rev:3}},{rev:null,source:null}],
    [{rev:'brand-1',change:{rev:0}},{rev:null,source:null}],
    [null,{rev:null,source:null}],
  ];
  for(const [doc,want] of cases)assert.deepEqual(recordRevision(doc),want,JSON.stringify(doc));
});

test('--until-record >=rev judges real-shaped ui-screen, layout-tree, brand and contract records by their own revision',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-gate-rev-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const put=(rel,text)=>{const dir=path.join(root,rel);fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'index.yaml'),text);return rel;};
  const at=(rel,minRev)=>evaluateCondition(null,{type:'record',path:rel,minRev},{repo:root,workflowId:WORK});
  const appLayout=put('.starciwork/features/learning-paths/ui/app-layout',APP_LAYOUT);
  const checkout=put('.starciwork/features/commerce/ui/checkout',UI_SCREEN_LAYOUTS);
  const shell=put('.starciwork/shell',LAYOUT_TREE);
  const brand=put('.starciwork/brand',BRAND);
  const contract=put('.starciwork/features/authoring/contract/content/reviewed-concept-for-concepts',CONTRACT);
  // the exact incident: '>=6' holds at change.rev 6; brand.rev 5 must not hold it back, shell.rev 7 must not carry '>=7'
  assert.deepEqual(at(appLayout,6),{met:true,evidence:`${appLayout} state=done rev=6 (change.rev)`});
  assert.equal(at(appLayout,7).met,false);
  // per-layout bindings above the record's own rev never meet a wait on the screen
  assert.equal(at(checkout,3).met,true);
  assert.equal(at(checkout,4).met,false,'shell.layouts[].rev 9 is the /(app) layout\'s revision, not the screen\'s');
  // layout-tree: top-level rev 7; nodes[].layout.rev 12 and review.rev 11 are not the tree's
  assert.deepEqual(at(shell,7),{met:true,evidence:`${shell} state=done rev=7`});
  assert.equal(at(shell,8).met,false);
  // brand: top-level rev 5; decisions[].rev 8 and review.rev 9 are not the brand's
  assert.equal(at(brand,5).met,true);
  assert.equal(at(brand,6).met,false);
  // contract: change.rev 2; blockedBy/conflictsWith/decisions revs are other records' or settled entries'
  assert.deepEqual(at(contract,2),{met:true,evidence:`${contract} state=todo rev=2 (change.rev)`});
  assert.equal(at(contract,3).met,false);
  // a file path reads the same record as its directory
  assert.equal(at(`${appLayout}/index.yaml`,6).met,true);
});

test('--until-record >=rev on the app-layout shape: the typed wait resolves once change.rev reaches the target',t=>{
  const fx=fixture(t);
  const rel='.starciwork/features/learning-paths/ui/app-layout';
  const dir=path.join(fx.repo,rel);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'index.yaml'),APP_LAYOUT.replace('change:\n  rev: 6','change:\n  rev: 5'));
  const {incidentId}=fx.ok(['incident','--workflow',WORK,'--kind','owner-gate','--holds','interface.draw',
    '--until-record',`${rel}>=6`,'--detail','draw waits on app-layout rev 6']);
  const pending=fx.frontier(WORK).gateConditions[0].conditions;
  assert.deepEqual(pending.map(c=>[c.met,c.evidence]),[[false,`${rel} state=done rev=5 (change.rev)`]]);
  assert.equal(fx.incidentStatus(incidentId),'open');
  fs.writeFileSync(path.join(dir,'index.yaml'),APP_LAYOUT);
  fx.frontier(WORK);
  assert.equal(fx.incidentStatus(incidentId),'resolved');
  assert.match(fx.events(incidentId,'incident-auto-resolved')[0].evidence[0],/rev=6 \(change\.rev\)/);
});
