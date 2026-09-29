import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import path from 'node:path';
import {withLedger} from './_ledger-fixture.mjs';
import {endRejectedAttempt,inspectLedger} from '../engine/ledger-db.mjs';
import {findRejectedOpenAttempts,repairRejectedAttempts} from '../scripts/kernel/repair-rejected-attempts.mjs';
import {attemptOpen,attemptStatus,pipelineOf} from '../ui/api/pipeline.mjs';

// A dispatch refused at submission (prompt-stuck, nivo wf-nivo-collab-mum8xsop attempt 28) used to leave its attempt
// row without settled_at / released_at: every reader that asks "still open?" showed it running for hours and the unit
// counted it as a dispatch. The refusal now ends the attempt (engine/ledger-db.mjs endRejectedAttempt) and the one-shot
// repair seals the rows written before it.
const ROOT=path.resolve(import.meta.dirname,'..');
const REPAIR=path.join(ROOT,'scripts','kernel','repair-rejected-attempts.mjs');
const T0=Date.parse('2026-09-29T07:00:00Z');
const wf='wf-rejected-attempt';

// One job of a unit dispatched (leased, attempt started) at `at`; `attested` marks a launch that reached the op.
const dispatched=(l,{n,attested=false,at=T0+n*60000})=>{
  const jobId=`job-${n}`,unitId=`unit-${n}`;
  l.write.createUnit({workflowId:wf,unitId,opId:'scope.define',subjectKey:unitId,goalRevision:1,createdAt:at});
  l.write.enqueueJob({jobId,workflowId:wf,unitId,opId:'scope.define',kind:'op',createdAt:at,payload:{opId:'scope.define'}});
  for(const to of ['ready','leased'])l.write.setJobStatus({jobId,to,reason:'seed',at});
  const attempt=l.write.startAttempt({workflowId:wf,jobId,dispatchId:`ctx_${n}`,at,dispatchedAt:at,terminalHandle:`term_${n}`});
  if(attested)l.write.updateAttempt({attemptId:attempt.attempt_id,startedAt:at+1,attestedAt:at+1,at});
  return {jobId,unitId,attemptId:attempt.attempt_id,at};
};
const rejection=(l,{jobId,at},payload={})=>l.appendEvent({workflowId:wf,entityType:'job',entityId:jobId,kind:'dispatch-rejected',createdAt:at+17000,
  payload:{step:'submission',signal:'prompt-stuck',...payload}});
const seed=(l)=>{
  l.ensureWorkflow({workflowId:wf,title:wf,ledgerMode:'durable',at:T0});
  l.write.changeWorkflowPhase({workflowId:wf,to:'running',by:'test',reason:'seed',at:T0});
  // 1: the legacy shape - end_state requeued written by the refusal, never settled or released
  const legacy=dispatched(l,{n:1});
  l.write.updateAttempt({attemptId:legacy.attemptId,endState:'requeued',effectState:'none',at:legacy.at+17000,
    settleJson:JSON.stringify({reason:'dispatch-rejected',step:'submission',signal:'prompt-stuck',detail:'paste stayed in the input box'})});
  rejection(l,legacy);
  // 2: still open (end_state NULL) with a dispatch-rejected event of its job inside its window
  const open=dispatched(l,{n:2});
  rejection(l,open);
  // 3: a launch that reached the op (attested): running, never a candidate even with a rejection event of its job
  const running=dispatched(l,{n:3,attested:true});
  rejection(l,running);
  // 4: an ordinary open attempt with no rejection at all
  const plain=dispatched(l,{n:4});
  return {legacy,open,running,plain};
};
const attemptRow=(file,id)=>{const r=inspectLedger({file});try{return r.db.prepare('SELECT * FROM op_attempts WHERE attempt_id=?').get(id);}finally{r.close();}};
const dispatchesOf=(file,unitId)=>{const r=inspectLedger({file});try{return r.db.prepare('SELECT dispatches FROM work_units WHERE unit_id=?').get(unitId).dispatches;}finally{r.close();}};

test('endRejectedAttempt ends the attempt, releases it, and gives the dispatch back to the unit; a second call is a no-op',t=>withLedger(t,({ledger})=>{
  const {open}=seed(ledger);
  assert.equal(dispatchesOf(ledger.file,open.unitId),1);
  const at=T0+999;
  ledger.transaction(db=>assert.equal(endRejectedAttempt(db,{attemptId:open.attemptId,endState:'requeued',effectState:'none',releasedAt:at,taskClosedAt:at,at}),true));
  const row=attemptRow(ledger.file,open.attemptId);
  assert.equal(row.end_state,'requeued');
  assert.equal(row.settled_at,at);assert.equal(row.released_at,at);assert.equal(row.task_closed_at,at);
  assert.equal(row.settled_by,'kernel');assert.equal(row.verdict,null);
  assert.equal(dispatchesOf(ledger.file,open.unitId),0);
  ledger.transaction(db=>assert.equal(endRejectedAttempt(db,{attemptId:open.attemptId,endState:'requeued',effectState:'none',releasedAt:at+5,at:at+5}),false));
  assert.equal(dispatchesOf(ledger.file,open.unitId),0,'never given back twice');
}));

test('an unknown effect ends the attempt effect-unknown, not settled, and is still a closed row for every reader',t=>withLedger(t,({ledger})=>{
  const {open}=seed(ledger);
  ledger.transaction(db=>endRejectedAttempt(db,{attemptId:open.attemptId,endState:'effect-unknown',effectState:'unknown',at:T0+5}));
  const row=attemptRow(ledger.file,open.attemptId);
  assert.equal(row.end_state,'effect-unknown');assert.equal(row.settled_at,null);assert.equal(row.released_at,null);
  assert.equal(attemptOpen(row),false,'reconcile owns it now, it is not a running attempt');
  assert.equal(attemptStatus(row),'blocked');
}));

test('the readers: a refused, dead or cancelled attempt is not running; only an unended dispatched attempt is',()=>{
  const base={dispatched_at:1,settled_at:null,end_state:null,reported_at:null,report_outcome:null,verdict:null};
  assert.equal(attemptStatus(base),'running');assert.equal(attemptOpen(base),true);
  assert.equal(attemptStatus({...base,reported_at:2}),'settling');
  for(const [end,status] of [['requeued','retry'],['worker-dead','failed'],['effect-unknown','blocked'],['cancelled','dropped']]){
    assert.equal(attemptOpen({...base,end_state:end}),false,end);
    assert.equal(attemptStatus({...base,end_state:end}),status,end);
  }
  assert.equal(attemptStatus({...base,end_state:'requeued',settled_at:3}),'retry','a sealed refusal reads retry, never unknown');
});

test('the pipeline leg reads a refused attempt as retry, closed, never running',t=>withLedger(t,({ledger})=>{
  const {legacy}=seed(ledger);
  const r=inspectLedger({file:ledger.file});
  try{
    const view=pipelineOf(r.db,'proj',wf);
    const leg=view.legs.find(x=>x.op==='scope.define');
    const byId=Object.fromEntries(leg.attempts.map(a=>[a.id,a]));
    assert.equal(byId[legacy.attemptId].status,'retry');
    assert.equal(byId[legacy.attemptId].open,false);
    assert.equal(byId[legacy.attemptId].endState,'requeued');
  }finally{r.close();}
}));

test('repair dry run lists exactly the refused-launch attempts left open, and writes nothing',t=>withLedger(t,({ledger})=>{
  const {legacy,open,running,plain}=seed(ledger);
  const found=findRejectedOpenAttempts(ledger.db).map(x=>x.attemptId);
  assert.deepEqual(found,[legacy.attemptId,open.attemptId],'not the attested run, not the plain open attempt');
  const before=JSON.stringify([legacy,open,running,plain].map(x=>attemptRow(ledger.file,x.attemptId)));
  const out=repairRejectedAttempts({file:ledger.file});
  assert.equal(out.apply,false);assert.equal(out.found.length,2);assert.deepEqual(out.sealed,[]);
  assert.equal(JSON.stringify([legacy,open,running,plain].map(x=>attemptRow(ledger.file,x.attemptId))),before);
  const cli=JSON.parse(execFileSync(process.execPath,['--no-warnings',REPAIR,'--file',ledger.file,'--json'],{cwd:ROOT,encoding:'utf8'}));
  assert.equal(cli.apply,false);assert.equal(cli.found.length,2);
}));

test('repair --apply seals each candidate once through the ledger writer: end state, released, dispatch given back',t=>withLedger(t,({ledger})=>{
  const {legacy,open,running,plain}=seed(ledger);
  ledger.db.close?.();
  const out=repairRejectedAttempts({file:ledger.file,apply:true});
  assert.deepEqual(out.sealed,[legacy.attemptId,open.attemptId]);
  for(const item of [legacy,open]){
    const row=attemptRow(ledger.file,item.attemptId);
    assert.equal(row.end_state,'requeued');
    assert.equal(row.released_at,item.at+17000,'stamped at the moment the refusal was recorded');
    assert.equal(row.settled_at,item.at+17000);
    assert.equal(dispatchesOf(ledger.file,item.unitId),0);
  }
  assert.equal(attemptRow(ledger.file,running.attemptId).end_state,null,'the attested run is untouched');
  assert.equal(attemptRow(ledger.file,plain.attemptId).end_state,null);
  assert.equal(dispatchesOf(ledger.file,running.unitId),1);
  const again=repairRejectedAttempts({file:ledger.file,apply:true});
  assert.deepEqual(again.found,[],'a second run finds nothing');
  assert.equal(dispatchesOf(ledger.file,legacy.unitId),0,'never given back twice');
}));
