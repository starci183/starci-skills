import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';

// Incident inc-751dd1ac4492 (starci-next base-repos, backend.scaffold): which cut pass runs the whole-set
// integration gate. settle used to call ordinal === total "final", but once the seam passes the other
// ordinals run in parallel and settle in any order: ordinal total could pass while a lower sibling was still
// running (so full-regression-final could not be green yet), and the sibling that settled LAST passed on its
// slice checks alone - no pass ever ran the unchanged full gates over the finished set. The pass that leaves
// no other ordinal open closes the set and is the one held to full-regression-final.
const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
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
/** One dispatched cut ordinal: running, its contract written, a done report filed. */
const seedOrdinal=(ledger,wf,ordinal,attempt)=>{
  const jobId=`op-cut-${ordinal}-a${attempt}`,dispatch=`ctx-cut-${ordinal}-a${attempt}`,at=Date.now();
  ledger.enqueueJob({jobId,workflowId:wf,opId:OP,kind:'op',attempt,payload:{
    opId:OP,owned_paths:[`docs/cut-${ordinal}`],cut:{id:CUT,ordinal,total:TOTAL},orca:{dispatchId:dispatch},
  }});
  ledger.db.prepare("UPDATE jobs SET status='running',attempt=? WHERE job_id=?").run(attempt,jobId);
  ledger.db.prepare('INSERT INTO contracts(workflow_id,op_id,attempt,dispatch_id,markdown,context_json,created_at) VALUES(?,?,?,?,?,?,?)')
    .run(wf,OP,attempt,dispatch,'# cut contract',json({}),at);
  ledger.db.prepare('INSERT INTO reports(workflow_id,dispatch_id,op_id,attempt,generation,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,?,?,NULL,?)')
    .run(wf,dispatch,OP,attempt,0,'done',json({outcome:'done'}),null,at);
  return jobId;
};
const recordChecks=(repo,wf,attempt,names)=>seed(repo,l=>l.db.prepare('INSERT OR REPLACE INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
  .run(wf,OP,attempt,json({checks:names.map(name=>({name,exitCode:0}))}),Date.now()));
const SLICE=['cut-slice-postcondition','cut-regression-inventory'];
const status=(repo,wf)=>{const r=runApi('status','--repo',repo,'--workflow',wf,'--json');assert.equal(r.status,0,r.stderr);return out(r);};
const settlePass=(repo,jobId)=>runApi('settle','--repo',repo,'--job',jobId,'--verdict','pass','--json');

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
  const refused=settlePass(repo,o2);
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
  seed(repo,l=>l.db.prepare('INSERT OR REPLACE INTO checks(workflow_id,op_id,attempt,checks_json,created_at) VALUES(?,?,?,?,?)')
    .run(wf,OP,2,json({checks:[{name:'cut-slice-postcondition',exitCode:1}]}),Date.now()));
  const failed=runApi('settle','--repo',repo,'--job',o2,'--verdict','fail','--json');
  assert.equal(failed.status,0,failed.stderr);
  assert.deepEqual(status(repo,wf).cutSets.map(s=>[s.closingOrdinal,s.closingJob]),[[2,o2]],'the failed ordinal still holds the set open');

  const retry=seed(repo,l=>seedOrdinal(l,wf,2,4));
  recordChecks(repo,wf,4,SLICE);
  const refused=settlePass(repo,retry);
  assert.equal(refused.status,1);
  assert.equal(refusal(refused).code,'cut-checks-missing');
  recordChecks(repo,wf,4,[...SLICE,'full-regression-final']);
  const closing=settlePass(repo,retry);
  assert.equal(closing.status,0,closing.stderr);
  assert.equal(out(closing).cutSet.closesSet,true);
});
