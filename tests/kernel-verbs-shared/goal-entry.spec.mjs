import test,{after} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger,postInbox} from '../../engine/db/ledger.mjs';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {JOB_ROW} from '../../scripts/machine/job-row.mjs';
import {openMachine} from '../../engine/db/machine.mjs';
import {FAKE_ORCA} from '../helpers/fake-orca.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const DEFINE_GOAL=path.join(ROOT,'scripts','goal','define-goal.mjs');
const START_WORKFLOW=path.join(ROOT,'scripts','kernel','start-workflow.mjs');
const ENTRY_ROOT=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-'));
after(()=>fs.rmSync(ENTRY_ROOT,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
const ENTRY_HOST=path.join(ENTRY_ROOT,'fake-orca.mjs');fs.writeFileSync(ENTRY_HOST,FAKE_ORCA);
const ENTRY_OWNER=path.join(ENTRY_ROOT,'owner');fs.mkdirSync(ENTRY_OWNER);
fs.copyFileSync(path.join(ROOT,'config.example.yaml'),path.join(ENTRY_OWNER,'config.yaml'));
Object.assign(process.env,{STARCI_TEST_MACHINE_FILE:path.join(ENTRY_ROOT,'machine.sqlite'),
  STARCI_PROJECTS_ROOT:path.join(ENTRY_ROOT,'projects'),STARCI_OWNER_ROOT:ENTRY_OWNER,
  APPDATA:path.join(ENTRY_ROOT,'appdata'),
  STARCI_ORCA_COMMAND:process.execPath,STARCI_ORCA_ARGS:JSON.stringify([ENTRY_HOST]),
  STARCI_FAKE_ORCA_MODE:'healthy',STARCI_FAKE_ORCA_STATE:path.join(ENTRY_ROOT,'state.json')});
const entryMachine=openMachine({file:process.env.STARCI_TEST_MACHINE_FILE});entryMachine.close();
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


// Exercise the native writer with the same terminal/seat bindings currentRole resolves.
// These are private fixture handles; no Orca terminal or host seat is created.
const boundGoalCaller=(t,{role,seat=false})=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-goal-role-'));
  t.after(()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  const handle='private-goal-'+role,guards=path.join(root,'guards');
  const dir=path.join(guards,seat?'seats':'terminals');fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,handle+'.json'),JSON.stringify(seat
    ?{schema:'starci/seat-guard@1',role,terminal:handle}
    :{schema:'starci/op-guard@1',role,jobId:'private-'+role,workflowId:'private-goal',owned:[]}));
  return (...args)=>spawnSync(process.execPath,[DEFINE_GOAL,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,
    env:{...process.env,STARCI_GUARDS_ROOT:guards,ORCA_TERMINAL_HANDLE:handle,STARCI_ROLE:'owner'}});
};
const goalRows=repo=>read(repo,l=>Object.fromEntries(['workflows','goals','inbox','events'].map(table=>
  [table,l.db.prepare('SELECT * FROM '+table).all().map(row=>JSON.stringify(row)).sort()])));
const ownerGoalCall=(...args)=>spawnSync(process.execPath,[DEFINE_GOAL,...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,
  env:{...process.env,ORCA_TERMINAL_HANDLE:'',STARCI_ROLE:''}});

test('bound non-owner callers cannot persist fresh owner-labelled goals and leave no ledger',t=>{
  for(const binding of [{role:'op'},{role:'kernel'},{role:'supervisor',seat:true}]){
    const repo=fixture(t).repo(),file=ledgerFileFor(repo),call=boundGoalCaller(t,binding);
    assert.equal(fs.existsSync(file),false);
    const preview=call('--repo',repo,'--text','build the enrolment api endpoint','--plan','--json');
    assert.equal(preview.status,0,preview.stderr);
    assert.equal(out(preview)?.plan,true);
    assert.equal(fs.existsSync(file),false,'non-owner planning must not create a ledger');
    const made=call('--repo',repo,'--text','build the enrolment api endpoint','--reason','caller claims owner approval','--json');
    t.diagnostic(JSON.stringify({binding,result:{status:made.status,stdout:made.stdout,stderr:made.stderr},ledgerCreated:fs.existsSync(file)}));
    assert.equal(made.status,2,binding.role+' must be refused by the native goal writer');
    assert.match(made.stderr,/owner context/);
    assert.equal(fs.existsSync(file),false,'a refused owner-labelled goal must not open or write a ledger');
  }
});

test('bound non-owner callers cannot apply an owner-labelled revision even with the exact preview token',t=>{
  const repo=fixture(t).repo();
  const original=ownerGoalCall('--repo',repo,'--text','build the enrolment api endpoint','--json');
  assert.equal(original.status,0,original.stderr);
  const workflowId=out(original)?.workflowId;
  const reason='caller claims the owner accepted this plan';
  const previewRun=ownerGoalCall('--repo',repo,'--revise',workflowId,'--text','build the improved enrolment api endpoint','--reason',reason,'--plan','--json');
  assert.equal(previewRun.status,0,previewRun.stderr);
  const token=out(previewRun)?.revisionPreview?.approval?.token;assert.ok(token);
  const before=goalRows(repo);
  for(const binding of [{role:'op'},{role:'kernel'},{role:'supervisor',seat:true}]){
    const call=boundGoalCaller(t,binding);
    const applied=call('--repo',repo,'--revise',workflowId,'--text','build the improved enrolment api endpoint',
      '--reason',reason,'--approve-revision',token,'--json');
    t.diagnostic(JSON.stringify({binding,result:{status:applied.status,stdout:applied.stdout,stderr:applied.stderr}}));
    assert.equal(applied.status,2,binding.role+' cannot label this revision owner-approved');
    assert.match(applied.stderr,/owner context/);
    assert.deepEqual(goalRows(repo),before,'role refusal must precede every goal/inbox/event mutation');
  }
});

test('owner-labelled persistence keeps honest conversation assurance and Supervisor bridging remains provisional',t=>{
  const ownerRepo=fixture(t).repo();
  const accepted=ownerGoalCall('--repo',ownerRepo,'--text','build the enrolment api endpoint','--reason','private owner fixture accepted the exact plan','--json');
  assert.equal(accepted.status,0,accepted.stderr);
  const ownerGoal=read(ownerRepo,l=>l.db.prepare('SELECT approved_by,json FROM goals').get());
  assert.equal(ownerGoal.approved_by,'owner');
  assert.equal(JSON.parse(ownerGoal.json).ownerApproval.assurance,'conversation-context-not-authenticated');
  const bridgeRepo=fixture(t).repo(),supervisor=boundGoalCaller(t,{role:'supervisor',seat:true});
  const bridged=supervisor('--repo',bridgeRepo,'--text','build the enrolment api endpoint','--defined-by','supervisor',
    '--bridge-id','private-supervisor-bridge','--reason','private provisional bridge','--json');
  assert.equal(bridged.status,0,bridged.stderr);
  const bridgeGoal=read(bridgeRepo,l=>l.db.prepare('SELECT approved_by,approval_ref,json FROM goals').get());
  assert.equal(bridgeGoal.approved_by,'supervisor');assert.equal(bridgeGoal.approval_ref,'private-supervisor-bridge');
  assert.equal(JSON.parse(bridgeGoal.json).provisional,true);
  assert.equal(JSON.parse(bridgeGoal.json).ownerApproval,undefined);
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
    ledger.write.changeWorkflowPhase({workflowId,to:'running',by:'test-fixture',reason:'live revision preview'});
    ledger.db.prepare("UPDATE inbox SET status='claimed',applied_at=? WHERE workflow_id=? AND kind='goal'").run(now,workflowId);
    ledger.db.prepare("INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES('kernel',?,?,?,?,?,?)")
      .run(workflowId,process.pid,'kernel-test',JSON.stringify({state:'running'}),now,now+60000);
    seedWorkflow(ledger,{id:workflowId,jobs:[{jobId:queuedJobId,opId:'work.author',kind:'op',goalRevision:0,
      payload:{opId:'work.author',owned_paths:['docs/old-plan']}}]});
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
    goals:l.db.prepare('SELECT revision,goal_identity,amendment_json,approval_ref FROM goals WHERE workflow_id=? ORDER BY revision').all(workflowId),
    goalInbox:l.db.prepare("SELECT count(*) n FROM inbox WHERE workflow_id=? AND kind='goal'").get(workflowId).n,
    revisionInbox:l.db.prepare("SELECT status,payload_json FROM inbox WHERE workflow_id=? AND kind='goal-revision'").get(workflowId),
    event:l.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='goal-revised' ORDER BY seq DESC LIMIT 1").get(workflowId),
    superseded:l.db.prepare(`SELECT ${JOB_ROW} FROM jobs WHERE job_id=?`).get(queuedJobId),
    supersededEvent:l.db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND entity_id=? AND kind='job-superseded-by-goal-revision'").get(workflowId,queuedJobId),
  }));
  assert.equal(rows.workflowCount,1,'revision must not create a duplicate workflow');
  assert.equal(rows.workflow.phase,'running','a revision preserves the live workflow phase');
  assert.deepEqual(rows.goals.map(g=>g.revision),[0,1]);
  assert.equal(rows.goals[0].goal_identity,rows.goals[1].goal_identity,'goal identity must remain stable across revisions');
  assert.equal(rows.workflow.goal_identity,rows.goals[1].goal_identity);
  assert.equal(rows.goalInbox,1,'revision must not enqueue a second kernel goal');
  assert.equal(rows.revisionInbox.status,'pending');
  // The writer redacts *token keys inside inbox.payload_json (REDACTED_COLUMNS, ledger-db.mjs:323 +
  // redact.mjs:39 SECRET_KEY); the token's durable unredacted home is the goals.approval_ref identity
  // column (define-goal.mjs:552 passes approvalRef; ledger-db.mjs:462 stores it outside the redaction set).
  assert.equal(JSON.parse(rows.revisionInbox.payload_json).approvalToken,'[redacted]');
  assert.equal(rows.goals[1].approval_ref,preview.approval.token);
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
    ledger.write.changeWorkflowPhase({workflowId,to:'running',by:'test-fixture',reason:'live operation'});
    seedWorkflow(ledger,{id:workflowId,jobs:[{jobId:'op-live',opId:'interface.implement',kind:'op',goalRevision:0,
      status:'running',workerId:'worker-live',payload:{opId:'interface.implement',owned_paths:['apps/landing']}}]});
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
  try{ledger.write.changeWorkflowPhase({workflowId,to:'running',by:'test-fixture',reason:'seed finished workflow'});
    ledger.write.changeWorkflowPhase({workflowId,to:'finished',by:'test-fixture',reason:'seed finished workflow'});}
  finally{ledger.close();}
  const r=run(START_WORKFLOW,'--repo',repo,'--goal',workflowId,'--json');
  assert.notEqual(r.status,0,'a finished workflow never restarts — starting it again must be refused');
});


test('successive accepted revisions supersede only older pending revision notifications with retained history', t=>{
  const repo=fixture(t).repo();
  const initial=run(DEFINE_GOAL,'--repo',repo,'--text','build the enrolment page','--json');
  assert.equal(initial.status,0,initial.stderr);const wf=out(initial).workflowId;
  const ledger=openLedger({file:ledgerFileFor(repo)});
  try{postInbox(ledger.db,{workflowId:wf,kind:'owner-answer',key:'other-input',payload:{message:'must remain pending'}});}finally{ledger.close();}
  for(const text of ['build the improved enrolment page','build the improved enrolment page with validation']){
    const preview=run(DEFINE_GOAL,'--repo',repo,'--revise',wf,'--text',text,'--plan','--json');
    assert.equal(preview.status,0,preview.stderr);
    const cmd=out(preview).revisionPreview.approval.command;
    const accepted=spawnSync(cmd.executable,cmd.args,{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});
    assert.equal(accepted.status,0,accepted.stderr||accepted.stdout);
  }
  const rows=read(repo,l=>({goals:l.db.prepare('SELECT revision FROM goals WHERE workflow_id=? ORDER BY revision').all(wf),
    inbox:l.db.prepare('SELECT kind,status,payload_json,disposition_json FROM inbox WHERE workflow_id=? ORDER BY inbox_id').all(wf)}));
  assert.deepEqual(rows.goals.map(g=>g.revision),[0,1,2]);
  const revisions=rows.inbox.filter(i=>i.kind==='goal-revision');
  assert.deepEqual(revisions.map(i=>i.status),['done','pending']);
  assert.deepEqual(JSON.parse(revisions[0].disposition_json),{action:'goal-revision-superseded',revision:1,supersededByRevision:2});
  assert.equal(rows.inbox.find(i=>i.kind==='owner-answer').status,'pending');
  assert.equal(rows.inbox.find(i=>i.kind==='goal').status,'pending','revision does not claim the initial workflow queue');
});
