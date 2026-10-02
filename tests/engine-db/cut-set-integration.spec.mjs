import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../../engine/db/ledger.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {writeGreenProofs} from '../helpers/sonar-scan.mjs';
import {startCutSetCli} from '../helpers/engine-db-cut-set-integration-fixture.mjs';

// Live incident (a base-repos backend.scaffold run): which cut pass runs the whole-set
// integration gate. settle used to call ordinal === total "final", but once the seam passes the other
// ordinals run in parallel and settle in any order: ordinal total could pass while a lower sibling was still
// running (so full-regression-final could not be green yet), and the sibling that settled LAST passed on its
// slice checks alone - no pass ever ran the unchanged full gates over the finished set. The pass that leaves
// no other ordinal open closes the set and is the one held to full-regression-final.
const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const CLI=startCutSetCli();
after(()=>CLI.close());
const runApiFresh=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const runApi=(...args)=>CLI.run(args);
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};
const refusal=r=>{try{return JSON.parse(r.stderr.trim().split('\n').at(-1));}catch{return null;}};
const json=v=>JSON.stringify(v??null);

const workRoot=t=>{
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-cutset-'));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return dir;
};
const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};

const OP='docs.author',CUT='be-baseline-r1-g2',TOTAL=3;
// docs.author owes its READ digest and document gate at settle (knowledge/op-gate.yaml opProofs): each ordinal attaches the green ones.
const PROOF_DIR=fs.mkdtempSync(path.join(os.tmpdir(),'starci-cutset-proofs-'));
const PROOFS=writeGreenProofs(PROOF_DIR);
after(()=>fs.rmSync(PROOF_DIR,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
const jobsByAttempt=new Map();
/** One dispatched cut ordinal: running, its contract written, a done report filed. */
const seedOrdinal=(ledger,wf,ordinal,attempt)=>{
  const jobId=`op-cut-${ordinal}-a${attempt}`,dispatch=`ctx-cut-${ordinal}-a${attempt}`;
  const goal=ledger.db.prepare('SELECT revision FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(wf);
  seedWorkflow(ledger,{id:wf,goal:goal?null:{revision:1,markdown:'Cut set fixture',json:{}},jobs:[{jobId,opId:OP,status:'queued',goalRevision:goal?.revision??1,
    payload:{opId:OP,owned_paths:[`docs/cut-${ordinal}`],cut:{id:CUT,ordinal,total:TOTAL},orca:{dispatchId:dispatch}}}]});
  return dispatchOrdinal(ledger,wf,jobId,attempt,dispatch);
};
/** A queued ordinal dispatched: running, its contract written, a done report filed. */
const dispatchOrdinal=(ledger,wf,jobId,attempt,dispatch=`ctx-${jobId}`)=>{
  const payload=JSON.parse(ledger.db.prepare('SELECT payload_json FROM jobs WHERE job_id=?').get(jobId).payload_json);
  ledger.write.updateJob({jobId,payload:{...payload,orca:{dispatchId:dispatch}}});
  const phase=ledger.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf).phase;
  if(phase==='queued')ledger.write.changeWorkflowPhase({workflowId:wf,to:'running',by:'test-fixture',reason:'dispatch cut ordinal'});
  ledger.write.setJobStatus({jobId,to:'ready',reason:'fixture admission'});
  ledger.write.setJobStatus({jobId,to:'leased',reason:'fixture admission',leaseToken:`lease-${jobId}`});
  const {attempt_id:attemptId}=ledger.write.startAttempt({workflowId:wf,jobId,dispatchId:dispatch});
  ledger.write.setJobStatus({jobId,to:'running',reason:'fixture dispatch'});
  ledger.write.writeContract({attemptId,markdown:'# cut contract',context:{}});
  ledger.write.fileReport({attemptId,outcome:'done',report:{outcome:'done',files:PROOFS}});
  jobsByAttempt.set(`${wf}:${attempt}`,jobId);
  return jobId;
};
const recordChecks=(repo,wf,attempt,names)=>seed(repo,l=>{
  const jobId=jobsByAttempt.get(`${wf}:${attempt}`);
  const attemptId=l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId).attempt_id;
  for(const name of names)l.write.recordCheckRun({attemptId,name,phase:'verify',runner:'kernel',status:'pass',exitCode:0});
});
const SLICE=['cut-slice-postcondition','cut-regression-inventory'];
const status=(repo,wf)=>{const r=runApi('status','--repo',repo,'--workflow',wf,'--json');assert.equal(r.status,0,r.stderr);return out(r);};
const settlePass=(repo,jobId)=>runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');
const settlePassFresh=(repo,jobId)=>runApiFresh('settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');

test('the last sibling to settle closes the cut set and alone owes full-regression-final',t=>{
  const repo=workRoot(t),wf='wf-cut-set-close';
  seed(repo,l=>{
    l.ensureWorkflow({workflowId:wf,title:'cut set'});
    l.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(wf,0,'cutsetgoal','# goal',json({derivedFrom:'cut-set-test'}),Date.now());
  });
  const [o1,o2,o3]=seed(repo,l=>[1,2,3].map(n=>seedOrdinal(l,wf,n,n)));

  // The seam passes on its slice checks: ordinals 2 and 3 are still open.
  recordChecks(repo,wf,1,SLICE);
  const seam=settlePass(repo,o1);
  assert.equal(seam.status,0,seam.stderr);
  assert.deepEqual(out(seam).cutSet,{id:CUT,total:TOTAL,closesSet:false,open:[2,3]});

  // Ordinal 3 is ordinal === total but settles BEFORE ordinal 2: it is not the closing pass, so it
  // passes on its slice checks (the pre-fix rule refused it for a full-regression-final it could not have).
  recordChecks(repo,wf,3,SLICE);
  const third=settlePass(repo,o3);
  assert.equal(third.status,0,third.stderr);
  assert.deepEqual(out(third).cutSet,{id:CUT,total:TOTAL,closesSet:false,open:[2]});

  // Status names the one open ordinal as the closing pass and the check it owes.
  const open=status(repo,wf).cutSets;
  assert.equal(open.length,1);
  assert.deepEqual([open[0].id,open[0].closingOrdinal,open[0].closingJob,open[0].closingCheck],[CUT,2,o2,'full-regression-final']);

  // Ordinal 2 settles last: slice checks alone no longer pass it.
  recordChecks(repo,wf,2,SLICE);
  const refused=settlePassFresh(repo,o2);
  assert.equal(refused.status,1);
  assert.equal(refusal(refused).code,'cut-checks-missing');
  assert.match(refusal(refused).error,/full-regression-final/);
  assert.match(refusal(refused).error,/closes cut set/);
  assert.equal(read(repo,l=>l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(o2).status),'running');

  recordChecks(repo,wf,2,[...SLICE,'full-regression-final']);
  const closing=settlePass(repo,o2);
  assert.equal(closing.status,0,closing.stderr);
  assert.deepEqual(out(closing).cutSet,{id:CUT,total:TOTAL,closesSet:true,open:[]});
  const closed=read(repo,l=>l.db.prepare("SELECT entity_id,payload_json FROM events WHERE workflow_id=? AND kind='cut-set-closed'").all(wf));
  assert.equal(closed.length,1);
  assert.equal(closed[0].entity_id,o2);
  assert.deepEqual([JSON.parse(closed[0].payload_json).closedBy,JSON.parse(closed[0].payload_json).ordinal],[o2,2]);
  assert.deepEqual(status(repo,wf).cutSets,[],'a closed set is no longer projected open');
});

test('a failed sibling keeps the set open; its passing retry is the closing pass',t=>{
  const repo=workRoot(t),wf='wf-cut-set-retry';
  seed(repo,l=>l.ensureWorkflow({workflowId:wf,title:'cut set retry'}));
  const [o1,o2,o3]=seed(repo,l=>[1,2,3].map(n=>seedOrdinal(l,wf,n,n)));
  for(const [jobId,attempt] of [[o1,1],[o3,3]]){
    recordChecks(repo,wf,attempt,SLICE);
    assert.equal(settlePass(repo,jobId).status,0);
  }
  // A red independent check overrules ordinal 2's done claim to fail (the incident's settle).
  seed(repo,l=>{
    const attemptId=l.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get(o2).attempt_id;
    l.write.recordCheckRun({attemptId,name:'cut-slice-postcondition',phase:'verify',runner:'kernel',status:'fail',exitCode:1});
  });
  const failed=runApi('settle','--repo',repo,'--job',o2,'--verdict','fail','--json');
  assert.equal(failed.status,0,failed.stderr);
  // The settle queued the ordinal's retry itself (settle.nextStep): it is the set's closing job.
  const retry=out(failed).nextStep.jobs[0];
  assert.deepEqual(status(repo,wf).cutSets.map(s=>[s.closingOrdinal,s.closingJob]),[[2,retry]],'the failed ordinal still holds the set open');
  seed(repo,l=>dispatchOrdinal(l,wf,retry,4));
  recordChecks(repo,wf,4,SLICE);
  const refused=settlePassFresh(repo,retry);
  assert.equal(refused.status,1);
  assert.equal(refusal(refused).code,'cut-checks-missing');
  recordChecks(repo,wf,4,[...SLICE,'full-regression-final']);
  const closing=settlePass(repo,retry);
  assert.equal(closing.status,0,closing.stderr);
  assert.equal(out(closing).cutSet.closesSet,true);
});
