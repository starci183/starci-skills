import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../kernel/ledger-db.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const API=path.join(ROOT,'scripts','kernel','api.mjs');
// Lane k7: this spec is written against the lane contract for api.mjs —
//   survey|status|plan|enqueue|dispatch|settle|incident|retire
//   --repo <path> --workflow <id> [--job <id>] [--kind <k>] [--op <id>]
//   [--verdict pass|fail] [--report <file>] --json
// wrapping kernel/ledger-db.mjs tables (workflows, goals, inbox, jobs,
// signals, incidents, events). api.mjs lands in a sibling lane; until it does
// every test here is skipped (the gate lane runs them after all lanes land).
const API_EXISTS=fs.existsSync(API);
const skip=API_EXISTS?false:'scripts/kernel/api.mjs has not landed yet — written against the lane contract';

const runApi=(...args)=>spawnSync(process.execPath,[API,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

/** One temp Work root per test: a plain directory; openLedger creates .starciwork/runtime.sqlite on demand. */
const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {repo(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-kapi-'));dirs.push(dir);return dir;}};
};
/** Seed rows through the ledger API, then close so the spawned CLI never shares the handle. */
const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const json=v=>JSON.stringify(v??null);

/** A workflow with a goal revision and a pending inbox goal row — the shape define-goal.mjs writes. */
const seedGoal=(repo,workflowId)=>{
  seed(repo,ledger=>{
    const at=Date.now();
    ledger.ensureWorkflow({workflowId,title:'k7 api smoke'});
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(workflowId,0,'k7goal','# goal',json({derivedFrom:'k7-test'}),at);
    ledger.db.prepare("INSERT INTO inbox(workflow_id,kind,key,payload_json,status,created_at) VALUES(?,?,?,?,'pending',?)")
      .run(workflowId,'goal',workflowId,json({prompt:'k7'}),at);
  });
};

test('survey on an empty workflow exits 0 with a sane empty result',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-empty';
  seed(repo,ledger=>ledger.ensureWorkflow({workflowId:wf,title:'empty'}));
  const r=runApi('survey','--repo',repo,'--workflow',wf,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const body=out(r);
  assert.ok(body&&typeof body==='object',`survey --json should print a JSON object, got: ${r.stdout}`);
  // Nothing exists yet — whatever summary shape the CLI chose, it must not invent rows.
  for(const key of ['jobs','events','inbox','incidents','signals'])
    if(Array.isArray(body[key]))assert.equal(body[key].length,0,`empty workflow but survey.${key} is non-empty`);
});

test('enqueue writes a pending job row the ledger can see',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-enqueue';
  seedGoal(repo,wf);
  const r=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--paths','docs/','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const jobs=read(repo,l=>l.db.prepare('SELECT * FROM jobs WHERE workflow_id=?').all(wf));
  assert.ok(jobs.length>=1,'enqueue produced no jobs row');
  const job=jobs.find(j=>j.op_id==='ex-test.probe')??jobs[0];
  assert.ok(['pending','queued'].includes(job.status),`fresh job must be pending/queued, got ${job.status}`);
});

test('dispatch --job without --spawn prints the packet and leaves the job unclaimed',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-dispatch';
  seedGoal(repo,wf);
  const enq=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--paths','docs/','--json');
  assert.equal(enq.status,0,enq.stderr);
  const jobId=out(enq)?.jobId??out(enq)?.job_id??read(repo,l=>l.db.prepare('SELECT job_id FROM jobs WHERE workflow_id=?').get(wf))?.job_id;
  assert.ok(jobId,'could not resolve the enqueued job id');
  const r=runApi('dispatch','--repo',repo,'--workflow',wf,'--job',jobId,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  assert.ok(r.stdout.trim().length>0,'dispatch without --spawn should print the packet');
  const job=read(repo,l=>l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId));
  assert.notEqual(job?.status,'running','a packet print must not mark the job running — nothing was spawned');
});

test('settle --verdict pass --report marks the job settled and appends an event',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-settle';
  seedGoal(repo,wf);
  const enq=runApi('enqueue','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--paths','docs/','--json');
  assert.equal(enq.status,0,enq.stderr);
  const jobId=out(enq)?.jobId??out(enq)?.job_id??read(repo,l=>l.db.prepare('SELECT job_id FROM jobs WHERE workflow_id=?').get(wf))?.job_id;
  assert.ok(jobId);
  const reportFile=path.join(repo,'k7-report.json');
  fs.writeFileSync(reportFile,json({outcome:'done',summary:'k7 settle smoke',checks:[]}));
  const before=read(repo,l=>l.db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(wf).n);
  const r=runApi('settle','--repo',repo,'--workflow',wf,'--job',jobId,'--verdict','pass','--report',reportFile,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const after=read(repo,l=>({
    job:l.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId),
    events:l.db.prepare('SELECT count(*) n FROM events WHERE workflow_id=?').get(wf).n,
  }));
  assert.ok(after.job,'settled job row vanished');
  assert.ok(!['pending','queued','running'].includes(after.job.status),`settled job still live: ${after.job.status}`);
  assert.ok(after.events>before,'settle appended no event');
});

test('incident writes an incidents row for the workflow',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-incident';
  seedGoal(repo,wf);
  const r=runApi('incident','--repo',repo,'--workflow',wf,'--op','ex-test.probe','--kind','test','--detail','k7 incident smoke','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const n=read(repo,l=>l.db.prepare('SELECT count(*) n FROM incidents WHERE workflow_id=?').get(wf).n);
  assert.ok(n>=1,'incident produced no incidents row');
});

test('retire finishes the workflow, closes its inbox and keeps the goals rows',{skip},t=>{
  const fx=fixture(t),repo=fx.repo(),wf='wf-k7-retire';
  seedGoal(repo,wf);
  const goalsBefore=read(repo,l=>l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(wf).n);
  assert.ok(goalsBefore>=1);
  const r=runApi('retire','--repo',repo,'--workflow',wf,'--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const after=read(repo,l=>({
    phase:l.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf)?.phase,
    pending:l.db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND status='pending'").get(wf).n,
    goals:l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(wf).n,
  }));
  assert.equal(after.phase,'finished','retire must set workflows.phase=finished');
  assert.equal(after.pending,0,'retire must close the workflow inbox — no pending rows left');
  assert.equal(after.goals,goalsBefore,'retire retires the goal, it never deletes the record');
});
