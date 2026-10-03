// A failed settle always leaves its next step in the ledger (scripts/kernel/cli.mjs enqueueNextStep over
// modules/models/kinds.yaml routes), and `starci kernel status` names the Kernel's next moves as nextActions and
// colours every leg. Before it `starci kernel settle --verdict fail` enqueued nothing, the frontier fell to
// orphaned-frontier, and a worker that died without a report was retried without a cap.
import test,{after,beforeEach} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {seedWorkflow} from '../helpers/ledger-fixture.mjs';
import {createKernelSettleNextStepFixture} from '../helpers/kernel-settle-next-step-fixture.mjs';
import {jobRowOf} from '../../scripts/kernel/verbs/shared/rows.mjs';
import {unitSubjectKey} from '../../engine/admission.mjs';
// These specs exercise the owner-flow contract; autopilot (scripts/kernel/autopilot-run.mjs) is
// on by default, so they run with it off - tests/kernel/autopilot.spec.mjs covers the autopilot flow.
process.env.STARCI_AUTOPILOT ??= 'off';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const json=v=>JSON.stringify(v??null);
const fixture=createKernelSettleNextStepFixture();
beforeEach(()=>fixture.reset());
after(()=>fixture.dispose());

const world=(t,{legs=['docs.author'],edges=legs.slice(1).map((op,i)=>[legs[i],op])}={})=>{
  const {repo,env,seed,read}=fixture;const wf='wf-next-step';
  seed(ledger=>{
    ledger.ensureWorkflow({workflowId:wf,title:'next step'});
    ledger.write.changeWorkflowPhase({workflowId:wf,to:'running',by:'test-fixture',reason:'next step'});
    ledger.db.prepare('INSERT INTO goals(workflow_id,revision,goal_identity,markdown,json,created_at) VALUES(?,?,?,?,?,?)')
      .run(wf,0,'g0','# goal',json({derivedPlan:{legs:legs.map(op=>({op})),edges}}),Date.now());
  });
  const api=(...args)=>{
    const r=spawnSync(process.execPath,[API,...args,'--repo',repo,'--json'],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000,env});
    let body=null;try{body=JSON.parse(r.stdout);}catch{}
    return {...r,body};
  };
  const job=(jobId,op,{status='running',records=[],paths=['docs/'],extra={}}={})=>seed(ledger=>{
    const payload={opId:op,records,owned_paths:paths,...extra};
    seedWorkflow(ledger,{id:wf,jobs:[{jobId,opId:op,status,payload,goalRevision:0,
      subjectKey:unitSubjectKey({cut:payload.cut,params:payload.params,records:payload.records,ownedPaths:payload.owned_paths})}]});
  });
  // A filed report row keyed by the job id (no worker bound), as `starci kernel report` would file it.
  const report=(jobId,outcome='failed',extra={})=>seed(ledger=>{
    const row=ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
    let attempt=ledger.db.prepare('SELECT attempt_id,dispatch_id FROM op_attempts WHERE job_id=? ORDER BY attempt_id DESC LIMIT 1').get(jobId);
    if(!attempt){
      if(row.status==='queued')ledger.write.setJobStatus({jobId,to:'ready',reason:'test dispatch'});
      ledger.write.setJobStatus({jobId,to:'leased',reason:'test dispatch'});
      attempt=ledger.write.startAttempt({jobId,dispatchId:`ctx:${jobId}`});
      ledger.write.setJobStatus({jobId,to:'running',reason:'test dispatch'});
    }
    ledger.db.prepare('INSERT INTO reports(workflow_id,attempt_id,dispatch_id,job_id,outcome,report_json,from_terminal,consumed_at,created_at) VALUES(?,?,?,?,?,?,NULL,NULL,?)')
      .run(wf,attempt.attempt_id,attempt.dispatch_id,jobId,outcome,json({schema:'starci/op-report@1',outcome,summary:`${outcome} on purpose`,...extra}),Date.now());
  });
  const settleFail=(jobId)=>{
    seed(ledger=>{
      if(ledger.db.prepare('SELECT 1 FROM op_attempts WHERE job_id=?').get(jobId))return;
      const current=ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId);
      if(current.status==='queued')ledger.write.setJobStatus({jobId,to:'ready',reason:'test worker dispatch'});
      ledger.write.setJobStatus({jobId,to:'leased',reason:'test worker dispatch'});
      ledger.write.startAttempt({jobId,dispatchId:`ctx:${jobId}`});
      ledger.write.setJobStatus({jobId,to:'running',reason:'test worker dispatch'});
    });
    const r=api('settle','--job',jobId,'--verdict','fail');assert.equal(r.status,0,r.stderr||r.stdout);return r.body;
  };
  const status=()=>{const r=api('status','--workflow',wf);assert.equal(r.status,0,r.stderr);return r.body;};
  const row=jobId=>read(db=>{const r=jobRowOf(db,jobId);return r&&{...r,payload:JSON.parse(r.payload_json),result:JSON.parse(r.result_json??'null')};});
  return {wf,api,job,report,settleFail,status,row,read,seed};
};

test('a failed report queues its route: the same op again, pinned to the failed attempt, and status names it',t=>{
  const w=world(t);
  w.job('j1','docs.author');w.report('j1');
  const settled=w.settleFail('j1');
  assert.equal(settled.nextStep.kind,'retry');
  assert.equal(settled.nextStep.route,'failed-retries-the-same-op');
  assert.deepEqual([settled.nextStep.firing,settled.nextStep.limit],[1,3]);
  const retry=w.row(settled.nextStep.jobs[0]);
  assert.equal(retry.status,'queued');
  assert.equal(retry.retry_of,'j1');
  assert.deepEqual(retry.payload.owned_paths,['docs/']);
  assert.equal(retry.payload.routed.route,'failed-retries-the-same-op');
  assert.equal(w.row('j1').result.nextStep.jobs[0],retry.job_id,'the step is recorded on the failed job');
  const s=w.status();
  assert.deepEqual(s.nextActions[0],{kind:'dispatch',op:'docs.author',jobId:retry.job_id,reason:`ready: starci kernel route --job ${retry.job_id}, then starci kernel dispatch`,
    label:'Vi\u1ebft t\u00e0i li\u1ec7u',displayName:'Vi\u1ebft t\u00e0i li\u1ec7u · docs · next step'});
  // The leg also carries why of the failed attempt it retries (scripts/kernel/why.mjs), headline first.
  assert.equal(Object.keys(s.legs[0].why)[0],'headline');
  assert.equal(s.legs[0].why.state,'failed');
  assert.deepEqual(s.legs.map(({why,attempts,...leg})=>leg),[{op:'docs.author',color:'yellow',jobId:retry.job_id,status:'queued',label:'Vi\u1ebft t\u00e0i li\u1ec7u'}],'the queued retry is actionable');
});

test('past the route limit an owner gate holds that job alone; resolving it names the retry',t=>{
  const w=world(t,{legs:['docs.author','test.author']});
  w.job('j1','docs.author');w.report('j1');
  let next=w.settleFail('j1').nextStep;
  for(let firing=2;firing<=3;firing+=1){
    const id=next.jobs[0];w.report(id);
    next=w.settleFail(id).nextStep;
    assert.deepEqual([next.kind,next.firing],['retry',firing]);
  }
  const last=next.jobs[0];w.report(last);
  const gated=w.settleFail(last).nextStep;
  assert.equal(gated.kind,'owner-gate');
  assert.equal(gated.firing,3);
  assert.ok(gated.incidentId);
  assert.equal(w.read(db=>db.prepare("SELECT count(*) n FROM jobs WHERE op_id='docs.author' AND status='queued'").get().n),0,'no fourth retry');
  // Another leg keeps running: the gate holds only the failed job.
  w.job('other','test.author',{status:'queued',paths:['tests/']});
  let s=w.status();
  assert.equal(s.frontier.queued.find(q=>q.jobId==='other').queuedBecause,'ready');
  assert.deepEqual(s.nextActions.map(a=>[a.kind,a.jobId]),[['dispatch','other'],['owner-gate',last]]);
  assert.deepEqual(s.legs.map(l=>[l.op,l.color]),[['docs.author','red'],['test.author','yellow']]);
  w.seed(l=>l.db.prepare("DELETE FROM jobs WHERE job_id='other'").run());
  s=w.status();
  assert.equal(s.frontier.state,'awaiting-owner');
  assert.equal(s.frontier.actionable,false);
  const resolved=w.api('incident','--workflow',w.wf,'--resolve',gated.incidentId,'--by','kernel');
  assert.equal(resolved.status,0,resolved.stderr);
  s=w.status();
  assert.equal(s.frontier.state,'next-ready');
  assert.equal(s.frontier.actionable,true);
  assert.deepEqual(s.nextActions.map(a=>[a.kind,a.op,a.jobId]),[['retry','docs.author',last]]);
  // The owner granted another round: the Kernel's retry fails again and the route fires afresh.
  const again=w.api('enqueue','--workflow',w.wf,'--op','docs.author','--paths','docs/','--retry-of',last);
  assert.equal(again.status,0,again.stderr);
  w.report(again.body.job_id);
  assert.equal(w.settleFail(again.body.job_id).nextStep.kind,'owner-gate','the original route limit still applies to a renewed failure');
});

test('a worker that ended without a report retries twice, then an owner gate',t=>{
  const w=world(t);
  w.job('d1','docs.author');
  let next=w.settleFail('d1').nextStep;
  assert.deepEqual([next.kind,next.route,next.firing,next.limit],['retry','no-report-retries-on-another-pool',1,2]);
  assert.equal(w.row(next.jobs[0]).payload.retryReason.reason,'failed-no-report');
  next=w.settleFail(next.jobs[0]).nextStep;
  assert.deepEqual([next.kind,next.firing],['retry',2]);
  next=w.settleFail(next.jobs[0]).nextStep;
  assert.equal(next.kind,'owner-gate');
  assert.equal(w.read(db=>db.prepare("SELECT count(*) n FROM jobs WHERE status='queued'").get().n),0);
});

test('a root-cause claim on another node queues a read-only verify of that node before the op runs again',t=>{
  const w=world(t,{legs:['backend.implement','e2e.verify']});
  w.job('build','backend.implement',{status:'succeeded',records:['feat.login'],paths:['.starciwork/features/login/','src/login/']});
  w.job('e2e','e2e.verify',{records:['feat.login'],paths:['.starciwork/features/login/evidence/']});
  w.report('e2e','failed',{rootCause:{node:'backend.implement',category:'contract',evidence:'401 on /login'}});
  const next=w.settleFail('e2e').nextStep;
  assert.equal(next.kind,'root-verify');
  assert.equal(next.rootCause.node,'backend.implement');
  const [verifyId,rerunId]=next.jobs;
  const verify=w.row(verifyId),rerun=w.row(rerunId);
  assert.equal(verify.op_id,'review.verify');
  assert.deepEqual(verify.payload.owned_paths,['.starciwork/features/login/'],'it writes evidence only into the root node record');
  assert.deepEqual([verify.payload.rootVerify.node,verify.payload.rootVerify.of,verify.payload.rootVerify.rootJob],['backend.implement','e2e','build']);
  assert.equal(rerun.op_id,'e2e.verify');
  assert.deepEqual(rerun.payload.after,[verifyId]);
  assert.equal(rerun.retry_of,'e2e');
  const s=w.status();
  assert.deepEqual(s.nextActions[0].kind,'root-verify');
  assert.equal(s.nextActions[0].jobId,verifyId);
  assert.equal(s.frontier.queued.find(q=>q.jobId===rerunId).queuedBecause,'dependency');
});

test('a red proof with no root claim repairs the build of its lane, then runs the proof again behind it',t=>{
  const w=world(t,{legs:['backend.implement','e2e.verify']});
  w.job('build','backend.implement',{status:'succeeded',records:['feat.login'],paths:['src/login/']});
  w.job('e2e','e2e.verify',{records:['feat.login'],paths:['.starciwork/features/login/evidence/']});
  w.report('e2e');
  const next=w.settleFail('e2e').nextStep;
  assert.deepEqual([next.kind,next.route],['repair','e2e-red-repairs-the-build']);
  const [repairId,rerunId]=next.jobs;
  assert.deepEqual([w.row(repairId).op_id,w.row(repairId).unit_id,w.row(repairId).try_no,w.row(repairId).payload.owned_paths],
    ['backend.implement',w.row('build').unit_id,2,['src/login/']],'a passed build is reopened as its next unit try');
  assert.deepEqual(w.row(rerunId).payload.after,[repairId]);
});

test('status waits on plan edges, not on every earlier leg',t=>{
  const w=world(t,{legs:['docs.author','test.author','review.verify'],edges:[['docs.author','review.verify'],['test.author','review.verify']]});
  w.job('a','docs.author',{status:'running'});
  w.job('b','test.author',{status:'queued',paths:['tests/']});
  w.job('c','review.verify',{status:'queued',paths:['.starciwork/review/']});
  const s=w.status();
  const why=id=>s.frontier.queued.find(q=>q.jobId===id);
  assert.equal(why('b').queuedBecause,'ready','no edge leads from docs.author to test.author');
  assert.deepEqual([why('c').queuedBecause,why('c').blockedBy],['dependency',{op:'docs.author',job:'a'}]);
  assert.deepEqual(s.nextActions.map(a=>[a.kind,a.jobId]),[['dispatch','b'],['wait','a'],['wait','c']]);
  assert.deepEqual(s.legs.map(l=>l.color),['yellow','yellow','yellow']);
});

test('a plan whose edges are the linear chain: every earlier leg in flight holds the job',t=>{
  const w=world(t,{legs:['docs.author','test.author','review.verify']});
  w.job('a','docs.author',{status:'running'});
  w.job('c','review.verify',{status:'queued',paths:['.starciwork/review/']});
  assert.deepEqual(w.status().frontier.queued[0].blockedBy,{op:'docs.author',job:'a'});
});

test('with nothing open, the next plan leg whose ancestors succeeded is a dispatch and the frontier is next-ready',t=>{
  const w=world(t,{legs:['request.analyze','docs.author','test.author']});
  w.job('a','docs.author',{status:'succeeded'});
  const s=w.status();
  assert.equal(s.frontier.state,'next-ready');
  assert.deepEqual(s.nextActions.map(a=>[a.kind,a.op,a.jobId]),[['dispatch','test.author',undefined]]);
  assert.deepEqual(s.legs.map(l=>[l.op,l.color]),[['request.analyze','gray'],['docs.author','green'],['test.author','gray']]);
});

test("the Kernel's own enqueue is refused while the runtime's retry is open, never doubles it",t=>{
  const w=world(t);
  w.job('j1','docs.author');w.report('j1');
  const auto=w.settleFail('j1').nextStep.jobs[0];
  const mine=w.api('enqueue','--workflow',w.wf,'--op','docs.author','--paths','docs/');
  assert.equal(mine.status,1);
  assert.match(mine.stdout+mine.stderr,/unit-in-flight/);
  assert.match(mine.stdout+mine.stderr,new RegExp(auto));
  assert.equal(w.row(auto).status,'queued');
  assert.equal(w.row(auto).retry_of,'j1');
  assert.equal(w.read(db=>db.prepare("SELECT count(*) n FROM jobs WHERE status='queued'").get().n),1);
});

test("starci kernel plan records the plan file's own edges and refuses a file without provable ones",t=>{
  const w=world(t,{legs:['docs.author','test.author','review.verify'],edges:[['docs.author','review.verify'],['test.author','review.verify']]});
  const plan=(body)=>{const file=path.join(os.tmpdir(),`plan-${Math.random().toString(36).slice(2)}.json`);fs.writeFileSync(file,json(body));t.after(()=>fs.rmSync(file,{force:true}));
    const r=w.api('plan','--workflow',w.wf,'--file',file);assert.equal(r.status,0,r.stderr);
    return w.read(db=>JSON.parse(db.prepare('SELECT json FROM goals WHERE workflow_id=?').get(w.wf).json).derivedPlan.edges);};
  const legs=['docs.author','test.author','review.verify'].map(op=>({op}));
  assert.deepEqual(plan({legs,edges:[['docs.author','test.author'],['test.author','review.verify']]}),[['docs.author','test.author'],['test.author','review.verify']]);
  const noEdges=path.join(os.tmpdir(),'plan-noedges.json');fs.writeFileSync(noEdges,json({legs}));t.after(()=>fs.rmSync(noEdges,{force:true}));
  const refused=w.api('plan','--workflow',w.wf,'--file',noEdges);
  assert.equal(refused.status,1,'a re-plan without edges is refused, recorded edges are not carried over');
  assert.match(refused.stdout+refused.stderr,/plan-edges-missing/);
  const bad=path.join(os.tmpdir(),'plan-bad.json');fs.writeFileSync(bad,json({legs,edges:[['docs.author']]}));t.after(()=>fs.rmSync(bad,{force:true}));
  assert.equal(w.api('plan','--workflow',w.wf,'--file',bad).status,1);
});

test('a filed report carrying rootCause passes the envelope, and its node on another op reaches root-verify',async t=>{
  const {validateOpReport,rootCauseProblems}=await import('../../scripts/kernel/report-envelope.mjs');
  const rootCause={node:'backend.implement',category:'contract',claim:'POST /login answers 401 for a valid session cookie',evidence:['e2e trace: POST /login -> 401','src/login/guard.ts rejects the cookie name'],expectedFix:'accept the session cookie',recheck:'npm run e2e -- login'};
  const filed=validateOpReport({outcome:'failed',summary:'login e2e fails',rootCause});
  assert.equal(filed.ok,true,JSON.stringify(filed.reasons));
  assert.match(rootCauseProblems({node:'x',category:'c',claim:'y',evidence:'one string'}).join('\n'),/evidence must be a nonempty array/);
  assert.match(rootCauseProblems({category:'c',claim:'y',evidence:['e'],why:'z'}).join('\n'),/unknown field 'why'[\s\S]*rootCause\.node is required/);
  assert.equal(validateOpReport({outcome:'failed',summary:'s',rootCause:'backend.implement'}).ok,false);
  const w=world(t,{legs:['backend.implement','e2e.verify']});
  w.job('build','backend.implement',{status:'succeeded',records:['feat.login'],paths:['.starciwork/features/login/','src/login/']});
  w.job('e2e','e2e.verify',{records:['feat.login'],paths:['.starciwork/features/login/evidence/']});
  // File the worker envelope through starci kernel report before settling its attempt.
  const file=path.join(fs.mkdtempSync(path.join(os.tmpdir(),'starci-root-cause-')),'report.json');
  t.after(()=>fs.rmSync(path.dirname(file),{recursive:true,force:true}));
  w.seed(ledger=>{
    const attemptId=ledger.db.prepare('SELECT attempt_id FROM op_attempts WHERE job_id=?').get('e2e').attempt_id;
    ledger.write.updateAttempt({attemptId,scratchDir:path.dirname(file)});
    ledger.db.prepare('INSERT INTO contracts(attempt_id,workflow_id,job_id,markdown,created_at) VALUES(?,?,?,?,?)')
      .run(attemptId,w.wf,'e2e','# e2e contract',Date.now());
  });
  fs.writeFileSync(file,JSON.stringify({schema:'starci/op-report@1',outcome:'failed',summary:'login e2e fails',rootCause}));
  const filedReport=w.api('report','--job','e2e','--report',file);
  assert.equal(filedReport.status,0,filedReport.stderr||filedReport.stdout);
  const settled=w.api('settle','--job','e2e','--verdict','fail');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  assert.equal(w.read(db=>db.prepare("SELECT outcome FROM reports WHERE job_id='e2e'").get()?.outcome),'failed',
    'the envelope with rootCause was filed, not refused');
  const next=settled.body.nextStep;
  assert.equal(next.kind,'root-verify');
  assert.deepEqual(next.rootCause,{node:'backend.implement',...Object.fromEntries(Object.entries(rootCause).filter(([k])=>k!=='node'))});
  assert.equal(w.row(next.jobs[0]).payload.rootVerify.claim.claim,rootCause.claim);
});
