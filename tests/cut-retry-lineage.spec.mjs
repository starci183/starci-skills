import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';
import {cutRetryLineage,retiredBeforeDispatch} from '../engine/admission.mjs';

// Incident inc-72839f63a1f5 (starci-next, 2026-09-24): cut cv-import-rev1 ordinal 1 failed, ordinals 2 and
// 3 passed, and the ordinal-1 retry was enqueued with retry.retryOf = the successful ordinal 3 and
// businessAttempt 4. A cut ordinal chains only to its own ordinal; a wrong lineage already queued is
// repaired through `api reconcile --job <id> --retry-lineage`, never by hand.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const refusal=r=>JSON.parse(r.stderr.trim().split('\n').at(-1));
const json=v=>JSON.stringify(v??null);

const workRoot=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-cutlin-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return dir;
};
const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const seedGoal=(repo,workflowId)=>seed(repo,ledger=>{
  const at=Date.now();
  ledger.ensureWorkflow({workflowId,title:'cut lineage'});
  ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
    .run(workflowId,0,'cutgoal','# goal',json({derivedFrom:'cut-lineage-test'}),at);
});
const payloadOf=(repo,jobId)=>JSON.parse(read(repo,l=>l.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId)).payload_json);
const settle=(repo,jobId,status,result)=>seed(repo,l=>l.db.prepare('UPDATE jobs SET status=?,result_json=? WHERE job_id=?').run(status,JSON.stringify(result),jobId));
const enqueueCut=(repo,wf,ordinal)=>{
  const r=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths',`docs/cut-${ordinal}`,
    '--cut-id','cv-import-rev1','--cut-ordinal',String(ordinal),'--cut-total','3','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  return out(r).job_id;
};
/** The three settled ordinals of the incident: ordinal 1 failed, 2 and 3 passed. */
const incidentCut=(repo,wf)=>{
  const [o1,o2,o3]=[1,2,3].map(n=>enqueueCut(repo,wf,n));
  settle(repo,o1,'failed',{verdict:'fail'});
  settle(repo,o2,'succeeded',{verdict:'pass'});
  settle(repo,o3,'succeeded',{verdict:'pass'});
  return {o1,o2,o3};
};

test('cutRetryLineage chains to the ordinal\'s own latest job and counts only its business attempts',()=>{
  assert.equal(cutRetryLineage([]),null,'a first ordinal attempt has no predecessor');
  const failed={job_id:'o1a1',attempt:1,payload_json:json({cut:{id:'c',ordinal:1,total:3}}),result_json:json({verdict:'fail'})};
  assert.deepEqual(cutRetryLineage([failed],{attempt:4}),{retryOf:'o1a1',resumeOf:null,attempt:4,businessAttempt:2,
    retryClass:'business',effectState:'unknown',resumed:false,reusesDurableAttempt:false,consumesBusinessRetry:true});
  // A recorded businessAttempt from a wrong (sibling) lineage does not leak into the count.
  const polluted={...failed,payload_json:json({cut:{id:'c',ordinal:1,total:3},retry:{businessAttempt:4}})};
  assert.equal(cutRetryLineage([polluted],{attempt:4}).businessAttempt,2);
  // A no-effect launch rejection spends no business attempt; the next business failure does.
  const rejected={job_id:'o1a5',attempt:5,payload_json:json({cut:{id:'c',ordinal:1,total:3}}),
    result_json:json({reason:'dispatch-rejected',effectState:'none',retryable:true,attemptConsumed:false})};
  const afterReject=cutRetryLineage([failed,rejected],{attempt:6});
  assert.deepEqual([afterReject.resumeOf,afterReject.businessAttempt,afterReject.effectState],['o1a5',2,'none']);
});

test('enqueue of an ordinal-1 retry after ordinal 3 passed carries ordinal-1 lineage',t=>{
  const repo=workRoot(t),wf='wf-cut-lineage-enqueue';
  seedGoal(repo,wf);
  const {o1,o2,o3}=incidentCut(repo,wf);
  assert.equal(payloadOf(repo,o1).retry,undefined);
  assert.equal(payloadOf(repo,o2).retry,undefined,'ordinal 2 is a first attempt of its own slice, not a retry of ordinal 1');
  assert.equal(payloadOf(repo,o3).retry,undefined);

  const retry=enqueueCut(repo,wf,1);
  const job=read(repo,l=>l.db.prepare('SELECT attempt FROM jobs WHERE job_id=?').get(retry));
  assert.equal(job.attempt,4,'durable attempt stays op-wide');
  const lineage=payloadOf(repo,retry).retry;
  assert.deepEqual([lineage.retryOf,lineage.attempt,lineage.businessAttempt,lineage.retryClass,lineage.effectState],
    [o1,4,2,'business','unknown'],'the failed ordinal is the predecessor, never the successful ordinal 3');
  assert.notEqual(lineage.retryOf,o3);

  // A re-dispatch of ordinal 3 chains to ordinal 3.
  const again=enqueueCut(repo,wf,3);
  assert.deepEqual([payloadOf(repo,again).retry.retryOf,payloadOf(repo,again).retry.businessAttempt],[o3,2]);
});

test('reconcile --retry-lineage repairs a wrong-lineage queued job and refuses a dispatched one',t=>{
  const repo=workRoot(t),wf='wf-cut-lineage-repair';
  seedGoal(repo,wf);
  const {o1,o3}=incidentCut(repo,wf);
  const retry=enqueueCut(repo,wf,1);
  // The durable payload the pre-fix enqueue wrote (inc-72839f63a1f5).
  const wrong={retryOf:o3,resumeOf:null,attempt:4,businessAttempt:4,retryClass:'business',effectState:'unknown',
    resumed:false,reusesDurableAttempt:false,consumesBusinessRetry:true};
  seed(repo,l=>l.db.prepare('UPDATE jobs SET payload_json=? WHERE job_id=?').run(JSON.stringify({...payloadOf(repo,retry),retry:wrong}),retry));
  const repairedEvents=()=>read(repo,l=>l.db.prepare("SELECT payload_json FROM events WHERE entity_id=? AND kind='retry-lineage-repaired'").all(retry));

  const r=runApi('reconcile','--repo',repo,'--job',retry,'--retry-lineage','--json');
  assert.equal(r.status,0,r.stderr);
  const body=out(r);
  assert.deepEqual([body.ok,body.repaired,body.before.retryOf,body.after.retryOf,body.after.businessAttempt],[true,true,o3,o1,2]);
  assert.deepEqual(payloadOf(repo,retry).retry,body.after,'the durable payload now carries the ordinal-1 lineage');
  assert.equal(read(repo,l=>l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(retry)).status,'queued');
  const events=repairedEvents();
  assert.equal(events.length,1);
  assert.deepEqual([JSON.parse(events[0].payload_json).before.retryOf,JSON.parse(events[0].payload_json).after.retryOf],[o3,o1]);

  // Idempotent: a correct lineage writes nothing.
  const again=runApi('reconcile','--repo',repo,'--job',retry,'--retry-lineage','--json');
  assert.equal(again.status,0,again.stderr);
  assert.equal(out(again).repaired,false);
  assert.equal(repairedEvents().length,1);

  // Ever dispatched: a contract row for its attempt is history; nothing is rewritten.
  seed(repo,l=>l.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(wf,'docs.author',4,'ctx_test','# contract','{}',Date.now()));
  const before=payloadOf(repo,retry);
  const dispatched=runApi('reconcile','--repo',repo,'--job',retry,'--retry-lineage','--json');
  assert.equal(dispatched.status,1);
  assert.equal(refusal(dispatched).code,'retry-lineage-dispatched');
  assert.deepEqual(payloadOf(repo,retry),before);

  // A settled job is refused before any evidence is read.
  const settled=runApi('reconcile','--repo',repo,'--job',o1,'--retry-lineage','--json');
  assert.equal(settled.status,1);
  assert.equal(refusal(settled).code,'retry-lineage-not-queued');
});

// Incident inc-26189cb8bfda (starci-next base-repos, backend.scaffold): enqueueing cut be-baseline-r1-g2
// ordinals 2..5 wrote payload.retry.retryOf chained to the preceding sibling with businessAttempt 2..5 -
// four first executions of distinct slices charged as business retries. The pre-fix enqueue chained every
// job of the op to the op's latest attempt; a cut ordinal chains only to its own ordinal (fab36d654).
// Also covers a different cut id of the same op: an earlier cut's failed ordinal is not a predecessor.
test('first executions of cut ordinals 2..5 carry no retry lineage, whatever settled before them',t=>{
  const repo=workRoot(t),wf='wf-cut-lineage-first-exec';
  seedGoal(repo,wf);
  const enqueue=(cutId,ordinal,total)=>{
    const r=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths',`docs/${cutId}-${ordinal}`,
      '--cut-id',cutId,'--cut-ordinal',String(ordinal),'--cut-total',String(total),'--json');
    assert.equal(r.status,0,r.stderr||r.error?.message);
    return out(r).job_id;
  };
  // An earlier generation of the cut whose ordinal 2 failed: a different cut id never chains.
  const g1o2=enqueue('be-baseline-r1-g1',2,5);
  settle(repo,g1o2,'failed',{verdict:'fail'});
  // The seam ordinal of the new cut ran and passed; ordinals 2..5 are then enqueued together.
  const seam=enqueue('be-baseline-r1-g2',1,5);
  settle(repo,seam,'succeeded',{verdict:'pass'});
  const siblings=[2,3,4,5].map(n=>enqueue('be-baseline-r1-g2',n,5));
  for(const [i,jobId] of siblings.entries()){
    assert.equal(payloadOf(repo,jobId).retry,undefined,
      `ordinal ${i+2} is a first execution of its own slice, not a business retry of ordinal ${i+1}`);
  }
  // Durable attempts stay op-wide and distinct; only the business counter is per ordinal.
  const attempts=read(repo,l=>siblings.map(id=>l.db.prepare('SELECT attempt FROM jobs WHERE job_id=?').get(id).attempt));
  assert.deepEqual(attempts,[3,4,5,6]);
  // A real retry of ordinal 4 after it fails chains to ordinal 4 only, at business attempt 2.
  settle(repo,siblings[2],'failed',{verdict:'fail'});
  const retry=enqueue('be-baseline-r1-g2',4,5);
  const lineage=payloadOf(repo,retry).retry;
  assert.deepEqual([lineage.retryOf,lineage.businessAttempt,lineage.retryClass],[siblings[2],2,'business']);
});

// Incidents inc-5005d003825a and inc-b428eb47fde3 (starci-next work-and-stacks, cut business-paths-rag-rev1):
// ordinal 1 settled blocked on an ask that was then answered; its retry was enqueued --after the ask attempt
// and dropped (never dispatched), and the next ordinal-1 retry chained to that DROPPED row as a business
// retry (businessAttempt 2) instead of the owner-answer lineage (businessAttempt 1); --retry-lineage then
// reported repaired:false. After that retry was dropped too, ordinal 2's retry read the dropped row as its
// seam and sat dependency-failed. A row retired before dispatch ran nothing: it is never a predecessor and
// never a seam.
const BCUT='business-paths-rag-rev1';
const enqueueBiz=(repo,wf,ordinal,...extra)=>runApi('enqueue','--repo',repo,'--workflow',wf,'--op','docs.author','--paths',`docs/biz-${ordinal}`,
  '--cut-id',BCUT,'--cut-ordinal',String(ordinal),'--cut-total','2',...extra,'--json');
const enqueueBizOk=(repo,wf,ordinal)=>{const r=enqueueBiz(repo,wf,ordinal);assert.equal(r.status,0,r.stderr||r.error?.message);return out(r).job_id;};
const dropJob=(repo,jobId,reason)=>{const r=runApi('reconcile','--repo',repo,'--job',jobId,'--drop','--reason',reason,'--json');assert.equal(r.status,0,r.stderr);return out(r);};
const attemptOf=(repo,jobId)=>read(repo,l=>l.db.prepare('SELECT attempt FROM jobs WHERE job_id=?').get(jobId).attempt);
/** Ordinal 1 settled blocked on a filed (and answered) ask; ordinal 2 settled fail with no report. */
const businessIncident=(repo,wf)=>{
  const o1=enqueueBizOk(repo,wf,1),o2=enqueueBizOk(repo,wf,2);
  settle(repo,o1,'failed',{verdict:'blocked'});
  const askAttempt=attemptOf(repo,o1);
  seed(repo,l=>{
    const at=Date.now();
    l.db.prepare(`INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,consumed_at,created_at) VALUES(?,?,?,?,0,'ask',?,?,?)`)
      .run(wf,'ctx_ask','docs.author',askAttempt,json({outcome:'ask',summary:'four paths?',question:{text:'which paths?'}}),at,at);
    l.appendEvent({workflowId:wf,entityType:'report',entityId:'ctx_ask',kind:'ask-answered',payload:{dispatchId:'ctx_ask',answeredBy:'auto-recommended'}});
  });
  settle(repo,o2,'failed',{verdict:'fail',reportFiled:false});
  return {o1,o2};
};
const ownerAnswer=(o1,attempt)=>({retryOf:o1,resumeOf:null,attempt,businessAttempt:1,retryClass:'owner-answer',effectState:'unknown',
  resumed:false,reusesDurableAttempt:false,consumesBusinessRetry:false});

test('retiredBeforeDispatch: only a dropped or superseded row with no dispatch binding ran nothing',()=>{
  const row=(status,result,payload={})=>({job_id:'j',attempt:3,status,payload_json:json(payload),result_json:json(result)});
  assert.equal(retiredBeforeDispatch(row('cancelled',{verdict:'dropped',reason:'x'})),true);
  assert.equal(retiredBeforeDispatch(row('cancelled',{reason:'goal-revision-superseded',effectState:'none'})),true);
  assert.equal(retiredBeforeDispatch(row('failed',{verdict:'dropped'})),false,'only a cancelled row');
  assert.equal(retiredBeforeDispatch(row('cancelled',{verdict:'cancelled'})),false,'a cancel of another kind is history');
  assert.equal(retiredBeforeDispatch(row('cancelled',{reason:'goal-revision-superseded'},{rejectedDispatches:[{dispatchId:'d'}]})),false,
    'a rejected dispatch crossed the boundary');
  assert.equal(retiredBeforeDispatch(row('cancelled',{verdict:'dropped'},{orca:{dispatchId:'d'}})),false);

  // cutRetryLineage skips the dropped row: the owner-answer lineage of the ask attempt stands.
  const ask={job_id:'a6',attempt:6,status:'failed',payload_json:json({cut:{id:'c',ordinal:1,total:2}}),result_json:json({verdict:'awaiting-owner'})};
  const dropped={job_id:'a9',attempt:9,status:'cancelled',payload_json:json({cut:{id:'c',ordinal:1,total:2},after:['a6']}),result_json:json({verdict:'dropped'})};
  assert.deepEqual(cutRetryLineage([ask,dropped],{attempt:10}),ownerAnswer('a6',10));
  assert.equal(cutRetryLineage([dropped],{attempt:10}),null,'an ordinal whose only row was dropped has no predecessor');
});

test('inc-5005d003825a: an owner-answer retry skips a dropped retry and --retry-lineage repairs the wrong lineage',t=>{
  const repo=workRoot(t),wf='wf-biz-owner-answer';
  seedGoal(repo,wf);
  const {o1}=businessIncident(repo,wf);

  // The accidental shape is refused now: --after a settled ask can never be met.
  const refused=enqueueBiz(repo,wf,1,'--after',o1);
  assert.equal(refused.status,1);
  assert.equal(refusal(refused).code,'after-settled');

  // Reproduce attempt 9 as the pre-fix kernel wrote it: queued --after the ask attempt, then dropped.
  const a9=enqueueBizOk(repo,wf,1);
  seed(repo,l=>l.db.prepare('UPDATE jobs SET payload_json=? WHERE job_id=?').run(JSON.stringify({...payloadOf(repo,a9),after:[o1]}),a9));
  assert.equal(dropJob(repo,a9,'queued --after the answered ask').status,'cancelled');

  // Attempt 10: the same ordinal re-enqueued without --after chains to the ask, not to the dropped row.
  const a10=enqueueBizOk(repo,wf,1);
  assert.deepEqual(payloadOf(repo,a10).retry,ownerAnswer(o1,attemptOf(repo,a10)));

  // The durable payload the pre-fix enqueue wrote: retryOf the dropped row, a business retry at 2.
  const wrong={retryOf:a9,resumeOf:null,attempt:attemptOf(repo,a10),businessAttempt:2,retryClass:'business',effectState:'unknown',
    resumed:false,reusesDurableAttempt:false,consumesBusinessRetry:true};
  seed(repo,l=>l.db.prepare('UPDATE jobs SET payload_json=? WHERE job_id=?').run(JSON.stringify({...payloadOf(repo,a10),retry:wrong}),a10));
  const r=runApi('reconcile','--repo',repo,'--job',a10,'--retry-lineage','--json');
  assert.equal(r.status,0,r.stderr);
  const body=out(r);
  assert.deepEqual([body.repaired,body.before.retryOf,body.after.retryOf,body.after.retryClass,body.after.businessAttempt],[true,a9,o1,'owner-answer',1]);
  assert.deepEqual(payloadOf(repo,a10).retry,ownerAnswer(o1,attemptOf(repo,a10)));
  const again=runApi('reconcile','--repo',repo,'--job',a10,'--retry-lineage','--json');
  assert.equal(out(again).repaired,false,'idempotent once repaired');
});

test('inc-b428eb47fde3: a dropped seam retry is no seam; ordinal 2 waits on the live ordinal-1 head',t=>{
  const repo=workRoot(t),wf='wf-biz-seam';
  seedGoal(repo,wf);
  const {o1,o2}=businessIncident(repo,wf);
  const a9=enqueueBizOk(repo,wf,1);
  dropJob(repo,a9,'queued --after the answered ask');
  const a10=enqueueBizOk(repo,wf,1);

  // Ordinal 2's retry chains to its own failed attempt as business attempt 2.
  const a11=enqueueBizOk(repo,wf,2);
  const lineage=payloadOf(repo,a11).retry;
  assert.deepEqual([lineage.retryOf,lineage.businessAttempt,lineage.retryClass],[o2,2,'business']);
  const queued=id=>{const r=runApi('status','--repo',repo,'--workflow',wf,'--json');assert.equal(r.status,0,r.stderr);return out(r).frontier.queued.find(q=>q.jobId===id);};
  assert.deepEqual([queued(a11).queuedBecause,queued(a11).blockedBy.job],['dependency',a10],'the queued ordinal-1 retry is the seam');

  // Drop ordinal 1's retry as the incident did: dropping the live seam head names ordinal 2 as waiting,
  // and the seam falls back to the ask attempt that actually ran - an owner wait, not a dead dependency.
  assert.deepEqual(dropJob(repo,a10,'lineage points at a dropped row').waiting,[a11]);
  assert.deepEqual([queued(a11).queuedBecause,queued(a11).blockedBy.job],['dependency',o1],
    'never the cancelled attempt 10 read as dependency-failed');

  // The next ordinal-1 retry becomes the seam; its lineage is still the owner answer.
  const a12=enqueueBizOk(repo,wf,1);
  assert.deepEqual(payloadOf(repo,a12).retry,ownerAnswer(o1,attemptOf(repo,a12)));
  assert.deepEqual([queued(a11).queuedBecause,queued(a11).blockedBy.job],['dependency',a12]);
  settle(repo,a12,'succeeded',{verdict:'pass'});
  assert.equal(queued(a11).queuedBecause,'ready');
});
