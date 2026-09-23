import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger} from '../engine/ledger-db.mjs';

const ROOT=path.resolve(import.meta.dirname,'..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
// Lane k7: the owner->goal->kernel entry path. define-goal queues (workflows +
// goals rev 0 + pending inbox row); start-workflow claims. --plan on either is
// read-only by contract (modules/goal/define-goal.yaml, modules/kernel/
// start-workflow.yaml). The --project flag on define-goal lands in a sibling
// lane and is not covered here.
const run=(script,...args)=>spawnSync(process.execPath,[script,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
const out=r=>{try{return JSON.parse(r.stdout);}catch{return null;}};

const fixture=t=>{
  const dirs=[];
  t.after(()=>{for(const dir of dirs)fs.rmSync(dir,{recursive:true,force:true,maxRetries:20,retryDelay:25});});
  return {repo(){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-'));dirs.push(dir);return dir;}};
};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};

test('define-goal --plan writes nothing to sqlite',t=>{
  const repo=fixture(t).repo(),file=ledgerFileFor(repo);
  const inboxBefore=fs.existsSync(file)
    ?read(repo,l=>l.db.prepare('SELECT count(*) n FROM inbox').get().n)
    :0;
  const r=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--plan','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  assert.equal(out(r)?.plan,true,'--plan output should carry plan:true');
  if(!fs.existsSync(file))return; // the cleanest proof: --plan never even opened the ledger
  const inboxAfter=read(repo,l=>l.db.prepare('SELECT count(*) n FROM inbox').get().n);
  assert.equal(inboxAfter,inboxBefore,'--plan must not write inbox rows');
});

test('define-goal creates the workflow, goal revision 0 and a pending inbox row',t=>{
  const repo=fixture(t).repo();
  const r=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const workflowId=out(r)?.workflowId;
  assert.ok(workflowId,`define-goal --json should print workflowId, got: ${r.stdout}`);
  const rows=read(repo,l=>({
    wf:l.db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(workflowId),
    goal:l.db.prepare('SELECT revision,markdown FROM goals WHERE workflow_id=?').get(workflowId),
    inbox:l.db.prepare("SELECT status,kind FROM inbox WHERE workflow_id=? AND kind='goal'").get(workflowId),
  }));
  assert.ok(rows.wf,'no workflows row');
  assert.equal(rows.wf.phase,'queued');
  assert.ok(rows.goal,'no goals row');
  assert.equal(rows.goal.revision,0);
  assert.ok(rows.inbox,'no inbox row');
  assert.equal(rows.inbox.status,'pending');
});

test('goal revision preview is read-only, identity-preserving and approval-gated',t=>{
  const repo=fixture(t).repo();
  const original=run(DEFINE_GOAL,'--repo',repo,'--text','refactor the enrolment module','--json');
  assert.equal(original.status,0,original.stderr);
  const workflowId=out(original)?.workflowId;
  assert.ok(workflowId);

  // A co-resident product workflow is related only by ledger custody. The
  // revision preview must not manufacture a conflict from that fact.
  const landing=run(DEFINE_GOAL,'--repo',repo,'--text','build the canonical NIVO public landing page','--json');
  assert.equal(landing.status,0,landing.stderr);

  const ledger=openLedger({file:ledgerFileFor(repo)});
  const queuedJobId='op-old-plan-queued';
  try{
    const now=Date.now();
    ledger.db.prepare("UPDATE workflows SET phase='running' WHERE workflow_id=?").run(workflowId);
    ledger.db.prepare("UPDATE inbox SET status='claimed',applied_at=? WHERE workflow_id=? AND kind='goal'").run(now,workflowId);
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,?,?,?,?,?)")
      .run(workflowId,process.pid,'kernel-test',JSON.stringify({state:'running'}),now,now+60000);
    ledger.enqueueJob({jobId:queuedJobId,workflowId,opId:'work.author',kind:'op',payload:{opId:'work.author',owned_paths:['docs/old-plan']}});
  }finally{ledger.close();}

  const before=read(repo,l=>({
    workflows:l.db.prepare('SELECT count(*) n FROM workflows').get().n,
    goals:l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(workflowId).n,
    inbox:l.db.prepare('SELECT count(*) n FROM inbox WHERE workflow_id=?').get(workflowId).n,
  }));
  const prompt='refactor and canonicalize .starciwork and .starcistacks against the current contracts';
  const previewRun=run(DEFINE_GOAL,'--repo',repo,'--revise',workflowId,'--text',prompt,'--plan','--json');
  assert.equal(previewRun.status,0,previewRun.stderr);
  const preview=out(previewRun)?.revisionPreview;
  assert.equal(preview?.schema,'starci/goal-revision-preview@1');
  assert.equal(preview?.baseRevision,0);
  assert.equal(preview?.nextRevision,1);
  assert.equal(preview?.preservesGoalIdentity,true);
  assert.equal(preview?.kernel?.live,true);
  assert.equal(preview?.kernel?.resumeAllowed,false);
  assert.deepEqual(preview?.checkpoint?.queuedSupersedable,[queuedJobId]);
  assert.deepEqual(preview?.checkpoint?.mustSettleFirst,[]);
  assert.deepEqual(preview?.opChainDiff?.after,[
    'scope.define','test.author','code.refactor','workspace.manage','review.verify','handover.review',
  ]);
  assert.deepEqual(preview?.opChainDiff?.removed,['work.author']);
  assert.deepEqual(preview?.opChainDiff?.added,['scope.define','workspace.manage']);
  assert.equal(preview?.scope?.sameLedgerIsNotConflict,true);
  assert.ok(preview?.scope?.otherLiveWorkflows.some(w=>w.workflow_id===out(landing).workflowId&&w.conflictInferred===false));

  const afterPreview=read(repo,l=>({
    workflows:l.db.prepare('SELECT count(*) n FROM workflows').get().n,
    goals:l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(workflowId).n,
    inbox:l.db.prepare('SELECT count(*) n FROM inbox WHERE workflow_id=?').get(workflowId).n,
  }));
  assert.deepEqual(afterPreview,before,'revision preview must not mutate the ledger');

  const ungated=run(DEFINE_GOAL,'--repo',repo,'--revise',workflowId,'--text',prompt,'--json');
  assert.notEqual(ungated.status,0,'a revision without the approved preview token must fail');
  assert.match(ungated.stderr,/approval required/i);
  assert.equal(read(repo,l=>l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(workflowId).n),1);

  const apply=spawnSync(preview.approval.command.executable,preview.approval.command.args,{
    cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,
  });
  assert.equal(apply.status,0,apply.stderr||apply.error?.message);
  const applied=out(apply);
  assert.equal(applied?.workflowId,workflowId);
  assert.equal(applied?.goalRevision,1);
  assert.equal(applied?.kernel?.resumeAllowed,true);

  const rows=read(repo,l=>({
    workflowCount:l.db.prepare('SELECT count(*) n FROM workflows WHERE workflow_id=?').get(workflowId).n,
    workflow:l.db.prepare('SELECT phase,goal_identity FROM workflows WHERE workflow_id=?').get(workflowId),
    goals:l.db.prepare('SELECT revision,goal_identity,amendment_json FROM goals WHERE workflow_id=? ORDER BY revision').all(workflowId),
    goalInbox:l.db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND kind='goal'").get(workflowId).n,
    revisionInbox:l.db.prepare("SELECT status,payload_json FROM inbox WHERE workflow_id=? AND kind='goal-revision'").get(workflowId),
    event:l.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='goal-revised' ORDER BY seq DESC LIMIT 1").get(workflowId),
    superseded:l.db.prepare('SELECT status,result_json FROM jobs WHERE job_id=?').get(queuedJobId),
    supersededEvent:l.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND entity_id=? AND kind='job-superseded-by-goal-revision'").get(workflowId,queuedJobId),
  }));
  assert.equal(rows.workflowCount,1,'revision must not create a duplicate workflow');
  assert.equal(rows.workflow.phase,'running','a revision preserves the live workflow phase');
  assert.deepEqual(rows.goals.map(g=>g.revision),[0,1]);
  assert.equal(rows.goals[0].goal_identity,rows.goals[1].goal_identity,'goal identity must remain stable across revisions');
  assert.equal(rows.workflow.goal_identity,rows.goals[1].goal_identity);
  assert.equal(rows.goalInbox,1,'revision must not enqueue a second kernel goal');
  assert.equal(rows.revisionInbox.status,'pending');
  assert.equal(JSON.parse(rows.revisionInbox.payload_json).approvalToken,preview.approval.token);
  assert.equal(JSON.parse(rows.event.payload_json).kernelResume,'resurvey-pending-revision-inbox');
  assert.equal(rows.superseded.status,'cancelled');
  assert.equal(JSON.parse(rows.superseded.result_json).reason,'goal-revision-superseded');
  assert.equal(JSON.parse(rows.superseded.result_json).effectState,'none');
  assert.equal(JSON.parse(rows.supersededEvent.payload_json).nextRevision,1);
  assert.deepEqual(JSON.parse(rows.revisionInbox.payload_json).supersededJobs,[queuedJobId]);

  const replay=spawnSync(preview.approval.command.executable,preview.approval.command.args,{
    cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,
  });
  assert.equal(replay.status,0,replay.stderr||replay.error?.message);
  assert.equal(out(replay)?.alreadyApplied,true);
  assert.equal(read(repo,l=>l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(workflowId).n),2,'approval replay must not append another revision');
});

test('goal revision refuses jobs whose operation effects may still exist',t=>{
  const repo=fixture(t).repo();
  const original=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment page','--json');
  assert.equal(original.status,0,original.stderr);
  const workflowId=out(original)?.workflowId;
  const prompt='build the improved enrolment page';
  const previewRun=run(DEFINE_GOAL,'--repo',repo,'--revise',workflowId,'--text',prompt,'--plan','--json');
  assert.equal(previewRun.status,0,previewRun.stderr);
  const preview=out(previewRun)?.revisionPreview;

  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{
    ledger.enqueueJob({jobId:'op-live',workflowId,opId:'interface.implement',kind:'op',payload:{opId:'interface.implement',owned_paths:['apps/landing']}});
    ledger.db.prepare("UPDATE jobs SET status='running',worker_id='worker-live' WHERE job_id='op-live'").run();
  }finally{ledger.close();}

  const apply=spawnSync(preview.approval.command.executable,preview.approval.command.args,{
    cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,
  });
  assert.notEqual(apply.status,0,'running operation must block revision checkpoint');
  assert.match(apply.stderr,/operation job\(s\) have possible effects|operation effects are still possible/);
  const rows=read(repo,l=>({
    revisions:l.db.prepare('SELECT count(*) n FROM goals WHERE workflow_id=?').get(workflowId).n,
    status:l.db.prepare("SELECT status FROM jobs WHERE job_id='op-live'").get().status,
  }));
  assert.equal(rows.revisions,1);
  assert.equal(rows.status,'running');
});

test('start-workflow --plan prints the plan and leaves the inbox row pending',t=>{
  const repo=fixture(t).repo();
  const def=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--json');
  assert.equal(def.status,0,def.stderr);
  const workflowId=out(def)?.workflowId;
  assert.ok(workflowId);
  const r=run(START_WORKFLOW,'--repo',repo,'--goal',workflowId,'--plan','--json');
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const plan=out(r);
  assert.equal(plan?.plan,true);
  assert.equal(plan?.workflowId,workflowId);
  const status=read(repo,l=>l.db.prepare("SELECT status FROM inbox WHERE workflow_id=? AND kind='goal'").get(workflowId)?.status);
  assert.equal(status,'pending','--plan claimed the inbox row — it must only read');
});

test('start-workflow treats --repo as the project ledger owner when launched outside Source',t=>{
  const repo=fixture(t).repo();
  const def=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--json');
  assert.equal(def.status,0,def.stderr);
  const workflowId=out(def)?.workflowId;
  assert.ok(workflowId);
  // Codex, Claude and Devin chats are ingress launchers. They may invoke the
  // absolute executable from any cwd; --repo remains the project-owned
  // ledger root, while Source is derived from the executable itself.
  const r=spawnSync(process.execPath,[START_WORKFLOW,'--repo',repo,'--goal',workflowId,'--plan','--json'],{
    cwd:repo,encoding:'utf8',windowsHide:true,timeout:120000,
  });
  assert.equal(r.status,0,r.stderr||r.error?.message);
  const plan=out(r);
  assert.equal(plan?.sourceHost,path.dirname(ROOT));
  assert.equal(path.resolve(plan?.ledger??''),ledgerFileFor(repo));
  assert.equal(plan?.executionHost,'orca');
  assert.equal(plan?.inbox,'pending');
});

test('start-workflow on a finished workflow exits nonzero',t=>{
  const repo=fixture(t).repo();
  const def=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment api endpoint','--json');
  assert.equal(def.status,0,def.stderr);
  const workflowId=out(def)?.workflowId;
  assert.ok(workflowId);
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{ledger.db.prepare("UPDATE workflows SET phase='finished' WHERE workflow_id=?").run(workflowId);}
  finally{ledger.close();}
  const r=run(START_WORKFLOW,'--repo',repo,'--goal',workflowId,'--json');
  assert.notEqual(r.status,0,'a finished workflow never restarts — starting it again must be refused');
});
