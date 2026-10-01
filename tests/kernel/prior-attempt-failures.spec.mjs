import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger,changeWorkflowPhase,recordCheckRun,recordJobResult,setJobStatus,startAttempt,updateAttempt} from '../../engine/db/ledger.mjs';
import {priorAttemptFailures} from '../../scripts/kernel/prior-failures.mjs';

// Incidents inc-eafe6e1c3bc3, inc-49885f42c608, inc-2fa6209de98d (nivo-backend): dispatch read the
// prompt's prior_attempt_failures from the newest checks row of the op with attempt < job.attempt. Cut
// ordinals share the op's durable attempt counter, so with interleaved ordinals a retry inherited a
// SIBLING ordinal's checks (green or red) and never saw its own red ones
// (op-backend.implement-27899a6088, cut collab-be-identity-r2 ordinal 5, attempt 11, re-filed partial).
// The row now comes from the job's own retry lineage: jobs.retry_of, the previous FAILED try of the same
// work unit (prior-failures.mjs:17-24 - a unit is one cut ordinal, units.mjs admitUnit), and the checks are
// the predecessor attempt's check_runs (api-lib/check-evidence.mjs independentChecksOf), never an op-wide row.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const OP='docs.author';
const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const json=v=>JSON.stringify(v??null);

const workRoot=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-priorfail-'));fs.mkdirSync(path.join(dir,'docs'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return dir;
};
const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const seedGoal=(repo,workflowId)=>seed(repo,ledger=>ledger.transaction(db=>{
  ledger.ensureWorkflow({workflowId,title:'prior failures'});
  // A running workflow: op_attempts may only be created on one (op_attempts_dispatch_guard, 0001-init.sql:376-383).
  changeWorkflowPhase(db,{workflowId,to:'running',by:'seed',reason:'fixture'});
  db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
    .run(workflowId,0,'priorgoal','# goal',json({derivedFrom:'prior-failures-test'}),Date.now());
}));
const enqueue=(repo,wf,cut=null)=>{
  const r=runApi('enqueue','--repo',repo,'--workflow',wf,'--op',OP,'--paths',cut?`docs/${cut.id}-${cut.ordinal}`:'docs/uncut',
    ...(cut?['--cut-id',cut.id,'--cut-ordinal',String(cut.ordinal),'--cut-total',String(cut.total)]:[]),'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  return out(r).job_id;
};
const jobRow=(repo,jobId)=>read(repo,l=>l.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId));
/** Settle a job and record its kernel check_runs on its own dispatch attempt: {name: exitCode}. */
const finish=(repo,wf,jobId,status,checks)=>seed(repo,l=>l.transaction(db=>{
  const at=Date.now();
  // The status path a real dispatched job walks (job_transitions, 0001-init.sql:83-92): the attempt row may
  // only be inserted while the job is leased, and it settles through running→reported→<terminal>.
  for(const to of ['ready','leased'])setJobStatus(db,{jobId,to,reason:'seed-dispatch',at});
  const attempt=startAttempt(db,{workflowId:wf,jobId,dispatchId:`seed-dispatch:${jobId}`,at});
  for(const to of ['running','reported'])setJobStatus(db,{jobId,to,reason:'seed-run',at});
  if(checks)for(const [name,exitCode] of Object.entries(checks))
    recordCheckRun(db,{attemptId:attempt.attempt_id,name,phase:'verify',runner:'kernel',
      status:exitCode===0?'pass':'fail',exitCode,createdAt:at,
      summary:{entry:{name,exitCode,evidence:`${name} exit ${exitCode}`}}});
  recordJobResult(db,{jobId,result:{verdict:status==='succeeded'?'pass':'fail'},at});
  setJobStatus(db,{jobId,to:status,reason:'seed-settle',at});
  updateAttempt(db,{attemptId:attempt.attempt_id,settledAt:at,endState:'settled',at});
}));
const failuresOf=(repo,jobId)=>read(repo,l=>priorAttemptFailures(l.db,l.db.prepare('SELECT * FROM jobs WHERE job_id=?').get(jobId)));
const names=list=>list.map(f=>f.name);

test('interleaved cut ordinals: each retry sees only its own ordinal\'s red checks',t=>{
  const repo=workRoot(t),wf='wf-prior-fail-cut';
  seedGoal(repo,wf);
  const cut=ordinal=>({id:'collab-be-identity-r2',ordinal,total:5});
  const o1a1=enqueue(repo,wf,cut(1));                 // attempt 1
  finish(repo,wf,o1a1,'failed',{'ord1-slice':1});
  const o2a2=enqueue(repo,wf,cut(2));                 // attempt 2
  finish(repo,wf,o2a2,'failed',{'ord2-slice':1,'ord2-green':0});
  const o1a3=enqueue(repo,wf,cut(1));                 // attempt 3: ordinal 1 retry
  assert.deepEqual(names(failuresOf(repo,o1a3)),['ord1-slice'],'ordinal 1 sees its own red, not ordinal 2\'s newer red');
  finish(repo,wf,o1a3,'succeeded',{'ord1-slice':0});
  const o2a4=enqueue(repo,wf,cut(2));                 // try 2 of ordinal 2's unit, after a sibling went green
  assert.equal(jobRow(repo,o2a4).try_no,2,'try_no counts the unit, not the op (jobs.try_no, 0001-init.sql:256)');
  assert.deepEqual(names(failuresOf(repo,o2a4)),['ord2-slice'],
    'a sibling\'s newer GREEN row must not hide this ordinal\'s own red checks');
  const o5a5=enqueue(repo,wf,cut(5));                 // attempt 5: ordinal 5 first execution
  assert.deepEqual(failuresOf(repo,o5a5),[],'a first execution of an ordinal inherits no sibling failures');
  finish(repo,wf,o2a4,'failed',{'ord2-again':1});
  finish(repo,wf,o5a5,'failed',{'ord5-slice':1});
  const o2a6=enqueue(repo,wf,cut(2));                 // attempt 6
  const o5a7=enqueue(repo,wf,cut(5));                 // attempt 7
  const own=failuresOf(repo,o2a6);
  assert.deepEqual(names(own),['ord2-again']);
  assert.match(own[0].evidence,/^attempt 2: /,'evidence names the predecessor\'s try_no');
  assert.deepEqual(names(failuresOf(repo,o5a7)),['ord5-slice'],'ordinal 5 retry sees its own red past ordinal 2\'s newer row');
  // A different cut id of the same op is a different lineage too.
  const other=enqueue(repo,wf,{id:'collab-be-identity-r3',ordinal:2,total:3});
  assert.deepEqual(failuresOf(repo,other),[]);

  // End to end: the dry-run dispatch prompt of the ordinal-2 retry names only ordinal 2's red check,
  // although ordinal 5's red row is the op's newest earlier one.
  const r=runApi('dispatch','--repo',repo,'--job',o2a6,'--json');
  assert.equal(r.status,0,r.stderr||r.stdout);
  const prompt=out(r).prompt;
  assert.match(prompt,/prior_attempt_failures:/);
  assert.match(prompt,/\[ord2-again\] attempt 2: /);
  assert.doesNotMatch(prompt,/ord5-|ord1-|ord2-slice/);
});

test('jobs.retry_of picks the predecessor within the lineage; the column is the lineage',t=>{
  const repo=workRoot(t),wf='wf-prior-fail-retryof';
  seedGoal(repo,wf);
  const cut=ordinal=>({id:'c',ordinal,total:3});
  const o1a1=enqueue(repo,wf,cut(1));
  finish(repo,wf,o1a1,'failed',{'first-red':1});
  const o2a2=enqueue(repo,wf,cut(2));
  finish(repo,wf,o2a2,'failed',{'sibling-red':1});
  const o1a3=enqueue(repo,wf,cut(1));
  finish(repo,wf,o1a3,'failed',{'second-red':1});
  const o1a4=enqueue(repo,wf,cut(1));
  // The lineage is jobs.retry_of now, not payload.retry.retryOf (enqueue writes no retry payload;
  // admitUnitTry chains the retry to the unit's latest failed try, units.mjs:86 + admission.mjs:274-276).
  assert.equal(jobRow(repo,o1a4).retry_of,o1a3);
  assert.deepEqual(names(failuresOf(repo,o1a4)),['second-red']);
  const withRetryOf=retryOf=>{
    const row=jobRow(repo,o1a4);
    return read(repo,l=>priorAttemptFailures(l.db,{...row,retry_of:retryOf}));
  };
  assert.deepEqual(names(withRetryOf(o1a1)),['first-red'],'rows after the named predecessor are not its checks');
  // The reader trusts retry_of literally; a cross-unit value is unwritable in a real ledger
  // (jobs_enqueue_guard refuses retry_of not of the same unit, 0001-init.sql:292-294), so no
  // sibling-fallback exists to assert - naming a sibling reads the sibling's checks.
  assert.deepEqual(names(withRetryOf(o2a2)),['sibling-red']);
});

test('an uncut op: a retry reads the checks of the try it follows',t=>{
  const repo=workRoot(t),wf='wf-prior-fail-uncut';
  seedGoal(repo,wf);
  const a1=enqueue(repo,wf);
  assert.deepEqual(failuresOf(repo,a1),[],'a first attempt has no prior failures');
  finish(repo,wf,a1,'failed',{'unit':1,'lint':0});
  const a2=enqueue(repo,wf);
  assert.deepEqual(names(failuresOf(repo,a2)),['unit']);
  finish(repo,wf,a2,'failed',null);                   // settled without a checks row
  const a3=enqueue(repo,wf);
  // The contract is strict: a retry reads the checks of the try it follows (prior-failures.mjs:17-24);
  // a2 recorded none, so nothing speaks - an older try's row is not inherited across a checked-miss.
  assert.deepEqual(failuresOf(repo,a3),[]);
  finish(repo,wf,a3,'failed',{'unit':0});
  const a4=enqueue(repo,wf);
  assert.deepEqual(failuresOf(repo,a4),[],'a green newest row carries no failures');
});
