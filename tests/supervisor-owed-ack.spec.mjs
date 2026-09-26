import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {withLedger,seedWorkflow} from './_ledger-fixture.mjs';
import {owedFindings,patternFindings,ackOwed,unackOwed,readOwedAcks,ackHolds,CLASSES,OWED_ACK_SCOPE} from '../scripts/supervisor/owed.mjs';
import {runStallAlert} from '../scripts/supervisor/stall-alert.mjs';
import {readInbox} from '../scripts/connectors/telegram-bridge.mjs';
import {inspectLedger,ledgerFileFor} from '../engine/ledger-db.mjs';

// A retry-loop / repeat-check stays OWED until a success breaks its streak, so a lineage whose causes
// were already fixed re-alerted every hour: mia wf-miamia-work-and-stacks-mud7kjun brand.decide a1-a8
// failed, fixed by 5069309f2, 7893dcbb0, 7535339ca and 69348e272, then queued behind an owner review
// ask. The supervisor now acks such an item (quiet until a NEWER failure on its lineage re-opens it),
// and a lineage whose newest job waits behind an owner gate or owner ask is the owner's, not OWED.
const ROOT=path.resolve(import.meta.dirname,'..');
const OWED_CLI=path.join(ROOT,'scripts','supervisor','owed.mjs');
const MIN=60_000;
const NOW=Date.now();
const WF='wf-miamia-work-and-stacks-mud7kjun';
const OP='brand.decide';
const id=n=>`op-brand.decide-00000000${String(n).padStart(2,'0')}`;
const job=(n,{status,agoMin,after=null,retry=true})=>({jobId:id(n),opId:OP,attempt:n,status,createdAt:NOW-agoMin*MIN,updatedAt:NOW-(agoMin-5)*MIN,
  payload:{owned_paths:['.starciwork/features/brand'],retry:retry&&n>1?{retryOf:id(n-1),attempt:n}:{retryOf:null,attempt:n},...(after?{after}:{})}});
const settled=(n,agoMin)=>({kind:'op-settled',entityType:'job',entityId:id(n),payload:{status:'failed',verdict:'fail'},created_at:NOW-agoMin*MIN});
// A worker ran each failed attempt (a job settled with no dispatch is no failure of its chain).
const dispatched=(n,agoMin)=>({kind:'op-dispatched',entityType:'job',entityId:id(n),payload:{op:OP},created_at:NOW-agoMin*MIN});
const checkRow=(ledger,{attempt,name})=>ledger.db.prepare('INSERT INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
  .run(WF,OP,attempt,JSON.stringify({checks:[{name,exitCode:1,evidence:'x'}]}),NOW);
const incident=(ledger,{incidentId,kind,text,holds,agoMin=60})=>{
  ledger.db.prepare("INSERT INTO incidents(incident_id,workflow_id,op_id,last_progress,status,updated_at) VALUES(?,?,?,?,?,?)")
    .run(incidentId,WF,null,`[${kind}] ${text}`,'open',NOW-agoMin*MIN);
  ledger.appendEvent({workflowId:WF,entityType:'incident',entityId:incidentId,kind:'incident-raised',payload:{kind,detail:text,holds},createdAt:NOW-agoMin*MIN});
};
// a1-a4 failed (brand-checks failed on a2 and a3), a5 is the queued tail.
const seedLoop=(ledger,{tail={status:'queued',agoMin:30},extraJobs=[],extraEvents=[]}={})=>{
  seedWorkflow(ledger,{id:WF,now:NOW-900*MIN,jobs:[
    job(1,{status:'failed',agoMin:400}),job(2,{status:'failed',agoMin:300}),job(3,{status:'failed',agoMin:200}),job(4,{status:'failed',agoMin:100}),
    job(5,tail),...extraJobs,
  ],events:[dispatched(1,399),settled(1,395),dispatched(2,299),settled(2,295),dispatched(3,199),settled(3,195),dispatched(4,99),settled(4,95),...extraEvents]});
  ledger.db.prepare("UPDATE workflows SET phase='running'").run();
  checkRow(ledger,{attempt:2,name:'brand-checks'});
  checkRow(ledger,{attempt:3,name:'brand-checks'});
};
const LOOP=`pattern:retry-loop:${id(1)}`,REPEAT=`pattern:repeat-check:${id(1)}:brand-checks`;
const findings=(db,repo,acks=new Map())=>owedFindings(db,{repo,now:NOW,commitsOf:()=>[],staleOf:()=>[],acks});

test('an acked pattern is quiet until a failure newer than the ack lands on its lineage',t=>withLedger(t,({repoRoot,ledger})=>{
  seedLoop(ledger);
  const open=findings(ledger.db,repoRoot);
  assert.deepEqual(open.owed.map(i=>i.key).sort(),[REPEAT,LOOP].sort());
  const loop=open.owed.find(i=>i.key===LOOP);
  assert.equal(loop.lastFailureAt,NOW-95*MIN,'the lineage\'s newest failure is its last op-settled');
  const ack={commits:['5069309f2'],reason:'causes fixed',at:NOW-60*MIN};
  const acks=new Map([[LOOP,{...ack,key:LOOP}],[REPEAT,{...ack,key:REPEAT}]]);
  const quiet=findings(ledger.db,repoRoot,acks);
  assert.deepEqual(quiet.owed,[],'both acked items leave the OWED list');
  assert.deepEqual(quiet.items.filter(i=>i.acked).map(i=>[i.key,i.status]).sort(),[[LOOP,'acked'],[REPEAT,'acked']].sort());
  assert.equal(ackHolds(loop,{at:NOW-96*MIN}),false,'an ack older than the newest failure does not hold');
}));

test('a NEW failure after the ack re-opens the item, and says so',t=>withLedger(t,({repoRoot,ledger})=>{
  seedLoop(ledger,{tail:{status:'failed',agoMin:30},extraJobs:[job(6,{status:'queued',agoMin:10})],extraEvents:[dispatched(5,25),settled(5,20)]});
  const acks=new Map([[LOOP,{key:LOOP,commits:['5069309f2'],reason:'causes fixed',at:NOW-60*MIN}]]);
  const {owed}=findings(ledger.db,repoRoot,acks);
  const loop=owed.find(i=>i.key===LOOP);
  assert.ok(loop,'a5 failed 20 min ago, after the ack 60 min ago: OWED again');
  assert.equal(loop.status,'open');
  assert.match(loop.line,/^OWED \S+ pattern:retry-loop:\S+ \[pattern:retry-loop\] age=\d+m open ack-reopened \(acked [0-9T:.-]+Z\): /);
}));

test('a lineage whose newest job is queued behind an owner gate or an owner ask is waiting, not OWED',t=>withLedger(t,({repoRoot,ledger})=>{
  seedLoop(ledger);
  incident(ledger,{incidentId:'inc-60e05a1c204c',kind:'owner-gate',text:'Waits for the owner to accept the app-layout drawing',holds:[OP]});
  const found=patternFindings(ledger.db,{repo:repoRoot,now:NOW,staleOf:()=>[]});
  const loop=found.find(f=>f.key===LOOP);
  assert.equal(loop.class,CLASSES.owner);
  assert.match(loop.reason,/newest job op-brand\.decide-0000000005 is queued behind owner gate inc-60e05a1c204c/);
  assert.equal(found.find(f=>f.key===REPEAT).class,CLASSES.owner);
  assert.deepEqual(findings(ledger.db,repoRoot).owed.filter(i=>i.pattern),[],'no pattern item is OWED');
}));

test('an owner ask filed by a job the tail waits --after is the owner\'s too; a merely queued tail stays OWED',t=>withLedger(t,({repoRoot,ledger})=>{
  const DRAW='op-interface.draw-0000000001';
  seedLoop(ledger,{tail:{status:'queued',agoMin:30,after:[DRAW]},extraJobs:[{jobId:DRAW,opId:'interface.draw',attempt:4,status:'failed',createdAt:NOW-50*MIN,updatedAt:NOW-40*MIN,payload:{owned_paths:['ui']}}]});
  const asked=()=>ledger.db.prepare("INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
    .run(WF,'ctx_63a0b41fe32d','interface.draw',4,0,'ask','{}',NOW-40*MIN);
  assert.equal(findings(ledger.db,repoRoot).owed.some(i=>i.key===LOOP),true,'no ask yet: OWED');
  asked();
  const loop=patternFindings(ledger.db,{repo:repoRoot,now:NOW,staleOf:()=>[]}).find(f=>f.key===LOOP);
  assert.equal(loop.class,CLASSES.owner);
  assert.match(loop.reason,/behind owner ask ctx_63a0b41fe32d \(via op-interface\.draw-0000000001\)/);
  ledger.appendEvent({workflowId:WF,entityType:'workflow',entityId:WF,kind:'ask-answered',payload:{dispatchId:'ctx_63a0b41fe32d'},createdAt:NOW-5*MIN});
  assert.equal(findings(ledger.db,repoRoot).owed.some(i=>i.key===LOOP),true,'answered: the lineage is OWED again');
}));

test('stall-alert and the poll OWED lines leave an acked item out',async t=>{
  const {cycle}=await import('../scripts/supervisor/poll.mjs');
  await withLedger(t,async({repoRoot,ledger,machineHome})=>{
    seedLoop(ledger);
    const acks=new Map([[LOOP,{key:LOOP,commits:['5069309f2'],reason:'causes fixed',at:NOW-60*MIN}]]);
    const env={LOCALAPPDATA:machineHome,STARCI_CONNECTORS_OFF:'1'};
    const owedOf=(db,opts)=>owedFindings(db,{...opts,commitsOf:()=>[],staleOf:()=>[],acks}).owed;
    const r=await runStallAlert({repos:[repoRoot],env,now:NOW,stallMinutes:30,frontierOf:()=>({ok:true,frontier:{state:'engaged',actionable:false,queued:[]},workers:[]}),
      wake:()=>({action:'kernel-busy',delivered:false}),owedOf});
    assert.deepEqual(r.alerted.owed,[REPEAT],'only the un-acked repeat-check is alerted');
    assert.doesNotMatch(readInbox('main',env).map(m=>m.text).join('\n'),/pattern:retry-loop/);
    const out=await cycle(ledger.db,{repo:repoRoot,state:{lastReportId:0,lastArtifacts:Date.now(),first:false},watchdogs:()=>null,stall:()=>[],
      owed:(db,opts)=>owedFindings(db,{...opts,now:NOW,commitsOf:()=>[],staleOf:()=>[],acks}).owed});
    assert.doesNotMatch(out.text,/OWED \S+ pattern:retry-loop/);
    assert.match(out.text,/OWED \S+ pattern:repeat-check:/);
  });
});

test('ack, acks and unack keep the disposition in the supervisor ledger with its audit event',t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owed-ack-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const env={...process.env,STARCI_SUPERVISOR_HOME:home};
  assert.equal(readOwedAcks({env}).size,0,'no supervisor ledger yet: no acks');
  ackOwed({key:LOOP,commits:['a'.repeat(40)],reason:'fixed by the four commits',item:{workflowId:WF,summary:'brand.decide loop'},now:NOW,env});
  const acks=readOwedAcks({env});
  assert.deepEqual({...acks.get(LOOP)},{key:LOOP,commits:['a'.repeat(40)],reason:'fixed by the four commits',at:NOW,by:'cli',workflowId:WF,summary:'brand.decide loop'});
  const l=inspectLedger({file:ledgerFileFor(home)});
  try{
    assert.equal(l.db.prepare('SELECT COUNT(*) n FROM signals WHERE scope=?').get(OWED_ACK_SCOPE).n,1);
    assert.equal(l.db.prepare("SELECT COUNT(*) n FROM events WHERE kind='owed-acked' AND entity_id=?").get(LOOP).n,1);
  }finally{l.close();}
  assert.equal(unackOwed({key:LOOP,env}),true);
  assert.equal(unackOwed({key:LOOP,env}),false);
  assert.equal(readOwedAcks({env}).size,0);
});

test('owed.mjs ack refuses a missing reason, a sha that is no commit and an item that is not OWED (unless --force)',t=>{
  const home=fs.mkdtempSync(path.join(os.tmpdir(),'starci-owed-ack-cli-'));
  t.after(()=>fs.rmSync(home,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const repo=path.join(home,'repo');fs.mkdirSync(repo,{recursive:true});
  const run=args=>{const r=spawnSync(process.execPath,[OWED_CLI,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,STARCI_SUPERVISOR_HOME:home}});
    return {status:r.status,out:JSON.parse(r.stdout.trim().split('\n').pop())};};
  const head=spawnSync('git',['-C',ROOT,'rev-parse','HEAD'],{encoding:'utf8'}).stdout.trim();
  assert.match(run(['ack','--item',LOOP,'--commits',head]).out.error,/needs --item, --commits and --reason|needs --item <key>, --commits/);
  assert.match(run(['ack','--item',LOOP,'--commits','zzzzzzz','--reason','x']).out.error,/not a commit/);
  const missing=run(['ack','--item',LOOP,'--commits',head.slice(0,9),'--reason','x']);
  assert.deepEqual([missing.status,missing.out.error],[1,`no OWED item ${LOOP}`]);
  const forced=run(['ack','--item',LOOP,'--commits',head.slice(0,9),'--reason','causes fixed','--force']);
  assert.deepEqual([forced.status,forced.out.ok,forced.out.ack.commits],[0,true,[head]],'the stored commit is the full sha');
  assert.deepEqual(run(['acks']).out.acks.map(a=>a.key),[LOOP]);
});
