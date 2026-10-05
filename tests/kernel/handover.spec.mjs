// The owner handover: a workflow is done only when the owner approves it.
//
// Owner ruling 2026-09-23: at handover one op lets the owner test, give feedback
// or ask, and the workflow counts as done only when the reviewer approves.
// handover.review is that op (modules/ops/ops/handover.review.yaml), the last
// leg of every chain; scripts/kernel/handover.mjs reads the answer receipt back;
// starci kernel settle records handover-approved only for the owner's approve, and api
// finish refuses handover-not-approved without it.
import test,{describe} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {inspectLedger,ledgerFileFor,openLedger,ensureWorkflow,changeWorkflowPhase,insertGoal,createUnit,enqueueJob,setJobStatus,startAttempt,writeContract,reopenUnit,raiseTryBudget,recordJobResult,updateAttempt,markReportConsumed} from '../../engine/db/ledger.mjs';
import { recordArtifactProofs } from '../../scripts/kernel/proof-integrity.mjs';
import { stageBlob, putArtifact, recordCheck } from '../../scripts/machine/evidence-store.mjs';
import { fileReport } from '../../engine/db/ledger.mjs';
import { setSignal, postInbox } from '../../engine/db/ledger.mjs';
import { handoverApprovalOf, handoverGateOf } from '../../scripts/kernel/handover.mjs';
import {parseYaml} from '../../engine/yaml.mjs';
import {checkOpManifest} from '../../scripts/checks/check-op-manifest.mjs';
import {HANDOVER_DECISIONS,HANDOVER_OP,decisionOf,handoverAskProblem} from '../../scripts/kernel/handover.mjs';
import { AUTOPILOT_EVENTS } from '../../scripts/kernel/autopilot-run.mjs';

const ROOT=path.resolve(import.meta.dirname,'..', '..');
const API=path.join(ROOT,'scripts','kernel','cli.mjs');
const PLAN=path.join(ROOT,'scripts','route','route-plan.mjs');
const readYaml=rel=>parseYaml(fs.readFileSync(path.join(ROOT,rel),'utf8'));
const execute=(file,args,options)=>new Promise(resolve=>{
  const child=spawn(file,args,{...options,stdio:['ignore','pipe','pipe']});
  let stdout='',stderr='',settled=false;
  child.stdout.setEncoding('utf8');
  child.stderr.setEncoding('utf8');
  child.stdout.on('data',chunk=>{stdout+=chunk;});
  child.stderr.on('data',chunk=>{stderr+=chunk;});
  const finish=result=>{if(!settled){settled=true;resolve({stdout,stderr,...result});}};
  child.once('error',error=>finish({status:null,error}));
  child.once('close',(status,signal)=>finish({status,signal}));
});
const run=(...args)=>execute(process.execPath,[API,...args],{cwd:ROOT,windowsHide:true,timeout:120000,
  env:{...process.env,ORCA_TERMINAL_HANDLE:'',STARCI_ROLE:''}});
// The settler's own check recording: a caller-declared green never counts toward a pass (H8), so the
// spec records the kernel's check the way the runtime settler does — with STARCI_CALLER=runtime-settler.
const runSettler=(...args)=>execute(process.execPath,[API,...args],{cwd:ROOT,windowsHide:true,timeout:120000,
  env:{...process.env,ORCA_TERMINAL_HANDLE:'',STARCI_ROLE:'',STARCI_CALLER:'runtime-settler'}});
const json=r=>{try{return JSON.parse(r.stdout);}catch{const open=r.stdout.indexOf('{'),close=r.stdout.indexOf('\n}');return open<0||close<0?null:JSON.parse(r.stdout.slice(open,close+2));}};
const OPTIONS=['Duy\u1ec7t - workflow ho\u00e0n t\u1ea5t','G\u00f3p \u00fd / b\u00e1o l\u1ed7i - m\u00f4 t\u1ea3 trong ghi ch\u00fa','\u0110\u1eb7t c\u00e2u h\u1ecfi - ghi trong ghi ch\u00fa'];

const fixture=t=>{
  const repo=fs.mkdtempSync(path.join(os.tmpdir(),'starci-handover-'));
  t.after(()=>fs.rmSync(repo,{recursive:true,force:true,maxRetries:20,retryDelay:25}));
  return repo;
};
const seed=(repo,fn)=>{const ledger=openLedger({file:ledgerFileFor(repo)});try{return fn(ledger);}finally{ledger.close();}};
const read=(repo,fn)=>{const ledger=inspectLedger({file:ledgerFileFor(repo)});try{return fn(ledger.db);}finally{ledger.close();}};

/** A running workflow whose approved chain is docs.author then the handover, with docs.author settled pass. */
const seedWorkflow=(repo,wf)=>seed(repo,ledger=>ledger.transaction(db=>{
  const at=Date.now();
  ensureWorkflow(db,{workflowId:wf,phase:'queued',title:'handover spec',by:'test-fixture',reason:'seed',at});
  insertGoal(db,{workflowId:wf,revision:0,goalIdentity:'hgoal',markdown:'# goal',
    goal:{opChain:{legs:[{op:'docs.author'},{op:HANDOVER_OP}]},derivedPlan:{legs:[{op:'docs.author'},{op:HANDOVER_OP}],edges:[['docs.author',HANDOVER_OP]]}},createdAt:at});
  changeWorkflowPhase(db,{workflowId:wf,to:'running',by:'test-fixture',reason:'seed',at});
  // This manual owner-handover fixture does not run an autopilot provider or claim measured token usage.
  ledger.appendEvent({workflowId:wf,entityType:'workflow',entityId:wf,kind:AUTOPILOT_EVENTS.configured,payload:{on:false,by:'supervisor',reason:'manual owner-handover fixture'}});
  seedJob(db,{wf,jobId:'job-docs',op:'docs.author',status:'succeeded',result:{verdict:'pass'}});
  ledger.appendEvent({workflowId:wf,entityType:'job',entityId:'job-docs',kind:'op-settled',payload:{verdict:'pass',status:'succeeded'}});
}));
/**
 * One op job of the migrated schema: unit -> queued -> ready -> leased -> a contract-bound open
 * attempt -> running (the state starci kernel report / check / settle accept), or further to reported ->
 * succeeded with its result on the attempt when `status` says so. Jobs of one `unitKey` are the
 * tries of one unit: a retry chains retry_of to the failed previous try, a try after a passed one
 * goes through reopenUnit (H5) — the same lineage starci kernel enqueue writes.
 * Returns {scratch, attemptId}: the attempt's STARCI_JOB_SCRATCH dir (starci kernel report reads the report
 * file only from inside it) and the attempt row id.
 */
function seedJob(ledger,{wf,jobId,op,unitKey=null,status='running',dispatchId=null,result=null}){
  const db=ledger.db??ledger,at=Date.now();
  const unitId=unitKey??`unit-${jobId}`;
  const scratch=dispatchId?fs.mkdtempSync(path.join(os.tmpdir(),'starci-ho-scratch-')):null;
  if(!db.prepare('SELECT 1 FROM work_units WHERE workflow_id=? AND unit_id=?').get(wf,unitId))
    createUnit(db,{workflowId:wf,unitId,opId:op,subjectKey:unitId,goalRevision:0,createdAt:at});
  const last=db.prepare('SELECT job_id,try_no,status FROM jobs WHERE workflow_id=? AND unit_id=? ORDER BY try_no DESC LIMIT 1').get(wf,unitId);
  const tryNo=(last?.try_no??0)+1;
  const retryOf=last?.status==='failed'?last.job_id:null;
  if(last&&!retryOf)reopenUnit(db,{workflowId:wf,unitId,reason:`${op} runs again`,by:'test-fixture',to:'queued',at});
  // Q13: more tries than the default budget of 5 need a recorded raise, the same call the Supervisor makes.
  const budget=db.prepare('SELECT try_budget FROM work_units WHERE workflow_id=? AND unit_id=?').get(wf,unitId).try_budget;
  if(tryNo>budget)raiseTryBudget(db,{workflowId:wf,unitId,tryBudget:tryNo,by:'supervisor',ref:'spec: extra handover rounds',at});
  enqueueJob(db,{jobId,workflowId:wf,unitId,opId:op,kind:'op',tryNo,retryOf,
    payload:{opId:op,owned_paths:[`.starciwork/evidence/${wf}.handover`],...(dispatchId?{orca:{dispatchId}}:{})},createdAt:at});
  setJobStatus(db,{jobId,to:'ready',reason:'seed',at});
  setJobStatus(db,{jobId,to:'leased',reason:'seed',at});
  const attempt=startAttempt(db,{workflowId:wf,jobId,dispatchId:dispatchId??`ctx-${jobId}`,
    scratchDir:scratch,dispatchedAt:at,startedAt:at,at});
  writeContract(db,{attemptId:attempt.attempt_id,markdown:'# contract',createdAt:at});
  setJobStatus(db,{jobId,to:'running',reason:'seed',at});
  if(status==='succeeded'){
    setJobStatus(db,{jobId,to:'reported',reason:'seed',attemptId:attempt.attempt_id,at});
    setJobStatus(db,{jobId,to:'succeeded',reason:'seed',attemptId:attempt.attempt_id,at});
    updateAttempt(db,{attemptId:attempt.attempt_id,settledAt:at,verdict:'pass',endState:'settled',at});
    recordJobResult(db,{jobId,result:result??{verdict:'pass'},at});
  }
  return {scratch,attemptId:attempt.attempt_id};
}
const writeReport=(dir,name,body)=>{
  const file=path.join(dir,name);
  fs.writeFileSync(file,JSON.stringify({schema:'starci/op-report@1',summary:'handover',...body}),'utf8');
  return file;
};
const status=async(repo,wf)=>{const r=await run('status','--repo',repo,'--workflow',wf,'--json');assert.equal(r.status,0,r.stderr);return json(r);};
/** Files the handover ask of `attempt`, settles it blocked (awaiting-owner) and serves it on a live pid. */
const handOver=async(repo,wf,{attempt,dispatchId})=>{
  const {scratch}=seed(repo,ledger=>seedJob(ledger,{wf,jobId:`job-ho-${attempt}`,op:HANDOVER_OP,unitKey:'ho',dispatchId}));
  const filed=await run('report','--repo',repo,'--job',`job-ho-${attempt}`,'--report',
    writeReport(scratch,`ask-${attempt}.json`,{outcome:'ask',question:{text:'B\u00e0n giao: \u1ee9ng d\u1ee5ng \u0111\u00e3 xong.',options:OPTIONS}}),'--json');
  assert.equal(filed.status,0,filed.stderr||filed.stdout);
  const settled=await run('settle','--repo',repo,'--job',`job-ho-${attempt}`,'--verdict','blocked','--json');
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  assert.equal(json(settled).awaitingOwner,true);
  seed(repo,ledger=>ledger.appendEvent({workflowId:wf,entityType:'report',entityId:dispatchId,kind:'ask-serving',payload:{dispatchId,url:'http://127.0.0.1:6971/a-x',pid:process.pid}}));
};
/** What serve-ask writes on submit: the receipt file and the ask-answered event. */
const answer=(repo,wf,{dispatchId,optionIndex,answeredBy='owner',eventAnsweredBy=answeredBy,receiptDispatch=dispatchId,note=null})=>{
  const dir=path.join(repo,'.starciwork','kernel-evidence',wf,'serve-ask');fs.mkdirSync(dir,{recursive:true});
  const receiptPath=path.join(dir,`answer-${dispatchId}.json`);
  fs.writeFileSync(receiptPath,JSON.stringify({schema:'starci/ask-answer@1',workflowId:wf,dispatchId:receiptDispatch,opId:HANDOVER_OP,
    option:OPTIONS[optionIndex],optionIndex,picks:null,answeredBy,custodyWritten:[],envWritten:[],pointersWritten:[],bridge:null,errors:[],note,at:'2026-09-23T10:00:00.000Z'}));
  seed(repo,ledger=>ledger.appendEvent({workflowId:wf,entityType:'report',entityId:dispatchId,kind:'ask-answered',
    payload:{dispatchId,receiptPath,answeredBy:eventAnsweredBy,optionIndex,custodyWritten:[],envWritten:[],pointersWritten:[],errors:[]}}));
  return receiptPath;
};
/** The attempt that runs after an approve: it files done, the kernel records its check, then settles pass. */
const settleApproval=async(repo,wf,{attempt,dispatchId})=>{
  const {scratch}=seed(repo,ledger=>seedJob(ledger,{wf,jobId:`job-ho-${attempt}`,op:HANDOVER_OP,unitKey:'ho',dispatchId}));
  const filed=await run('report','--repo',repo,'--job',`job-ho-${attempt}`,'--report',writeReport(scratch,`done-${attempt}.json`,{outcome:'done',summary:'approved by the owner'}),'--json');
  assert.equal(filed.status,0,filed.stderr||filed.stdout);
  const checked=await runSettler('record-checks','--repo',repo,'--job',`job-ho-${attempt}`,'--checks',JSON.stringify({checks:[{name:'handover-owner-approval',command:'starci kernel status --json',exitCode:0,evidence:'approve by owner'}]}),'--json');
  assert.equal(checked.status,0,checked.stderr||checked.stdout);
  return run('settle','--repo',repo,'--job',`job-ho-${attempt}`,'--verdict','pass','--json');
};
/** A refused pass leaves its attempt reported on a filed done report; retire it the way a kernel would, failed and consumed. */
const retire=(repo,wf,jobId)=>seed(repo,ledger=>{
  recordJobResult(ledger.db,{jobId,result:{verdict:'fail'}});
  ledger.db.prepare("UPDATE jobs SET status='failed' WHERE job_id=?").run(jobId);
  for(const row of ledger.db.prepare('SELECT attempt_id FROM reports WHERE workflow_id=? AND consumed_at IS NULL').all(wf))
    markReportConsumed(ledger.db,{attemptId:row.attempt_id});
});
const approvals=(repo,wf)=>read(repo,db=>db.prepare("SELECT payload_json FROM events WHERE workflow_id=? AND kind='handover-approved' ORDER BY seq").all(wf).map(r=>JSON.parse(r.payload_json)));

describe('handover',{concurrency:2},()=>{
test('handover.review is a valid op manifest wired into the kind catalog, the routes and the allocator',()=>{
  const result=checkOpManifest();
  assert.deepEqual(result.findings.filter(f=>f.op===HANDOVER_OP),[],'the handover manifest holds starci/op@1 and the prose rules');
  const registry=readYaml('modules/ops/registry.yaml');
  assert.ok(registry.ops.some(op=>op.id===HANDOVER_OP),'the generated registry indexes the op');
  const kinds=readYaml('modules/models/kinds.yaml');
  assert.deepEqual([kinds.kinds[HANDOVER_OP]?.family,kinds.kinds[HANDOVER_OP]?.role,kinds.kinds[HANDOVER_OP]?.operator],['prove','verify',HANDOVER_OP]);
  assert.ok(kinds.vocabularies.families.includes('prove')&&kinds.vocabularies.roles.includes('verify'));
  const routeIds=kinds.routes.map(r=>r.id);
  const handoverRoutes=kinds.routes.filter(r=>r.from===HANDOVER_OP);
  assert.deepEqual(handoverRoutes.map(r=>r.on.answer),HANDOVER_DECISIONS,'one route per answer, in option order');
  for(const r of handoverRoutes)assert.ok(routeIds.indexOf(r.id)<routeIds.indexOf('question-needs-the-user'),`${r.id} stands before the generic ask route`);
  assert.deepEqual(handoverRoutes.map(r=>r.to.kind),['same','lane.build','same'],'feedback repairs the build, approve and question run the handover again');
  assert.deepEqual(readYaml('modules/models/runtimes.yaml').roleOfKind[HANDOVER_OP],{role:'verify',work:'think',floor:'hard',order:'review'});
  // Owner decision 2026-09-25 review-hands: the hands write the handover verdict, Opus and Sol as overflow.
  assert.deepEqual(readYaml('modules/models/registry.yaml').operators[HANDOVER_OP].chain,['devin-agent','claude-agent','codex-agent']);
});

test('a handover ask carries exactly the three options approve, feedback, question; starci kernel report refuses any other shape',async t=>{
  assert.equal(handoverAskProblem({text:'x',options:OPTIONS}),null);
  assert.match(handoverAskProblem({text:'x',options:OPTIONS.slice(0,2)}),/exactly 3 options/);
  assert.match(handoverAskProblem({text:'x',options:[...OPTIONS,'Kh\u00e1c']}),/exactly 3 options/);
  assert.match(handoverAskProblem({text:'x',options:[OPTIONS[0],OPTIONS[0],OPTIONS[2]]}),/distinct/);
  assert.match(handoverAskProblem({text:'x',options:OPTIONS,picks:[{id:'p',choices:['a','b']}]}),/no picks/);
  assert.equal(decisionOf({optionIndex:0},{options:OPTIONS}),'approve');
  assert.equal(decisionOf({option:OPTIONS[1]},{options:OPTIONS}),'feedback','an older receipt is matched by its label');
  assert.equal(decisionOf({optionIndex:2},{options:OPTIONS}),'question');

  const repo=fixture(t),wf='wf-handover-shape';
  seedWorkflow(repo,wf);
  const {scratch}=seed(repo,ledger=>seedJob(ledger,{wf,jobId:'job-ho-1',op:HANDOVER_OP,unitKey:'ho',dispatchId:'ho-d1'}));
  const two=await run('report','--repo',repo,'--job','job-ho-1','--report',writeReport(scratch,'two.json',{outcome:'ask',question:{text:'B\u00e0n giao',options:OPTIONS.slice(0,2)}}),'--json');
  assert.notEqual(two.status,0,'a two-option handover ask is refused');
  assert.match(two.stderr,/report-invalid/);
  assert.match(two.stderr,/exactly 3 options/);
  assert.equal(read(repo,db=>db.prepare('SELECT count(*) n FROM reports WHERE workflow_id=?').get(wf).n),0,'nothing is filed');
  const three=await run('report','--repo',repo,'--job','job-ho-1','--report',writeReport(scratch,'three.json',{outcome:'ask',question:{text:'B\u00e0n giao',options:OPTIONS}}),'--json');
  assert.equal(three.status,0,three.stderr||three.stdout);
  assert.deepEqual(read(repo,db=>JSON.parse(db.prepare('SELECT report_json FROM reports WHERE workflow_id=?').get(wf).report_json)).question.options,OPTIONS);
});

test('finish is refused without the owner approval and allowed after it; a later business settle makes it stale',async t=>{
  const repo=fixture(t),wf='wf-handover-finish';
  seedWorkflow(repo,wf);
  const refused=await run('finish','--repo',repo,'--workflow',wf,'--json');
  assert.notEqual(refused.status,0,'no approval, no finish');
  assert.match(refused.stderr,/handover-not-approved/);
  assert.equal(read(repo,db=>db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf).phase),'running','a refused finish writes nothing');

  let s=await status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.state,s.handover.due],['handover-due',true,'not-started',true],
    'every approved leg settled: the handover is the Kernel\'s next move');
  assert.match(s.frontier.reason,/enqueue handover\.review as the final leg/);

  await handOver(repo,wf,{attempt:1,dispatchId:'ho-d1'});
  s=await status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.state],['awaiting-owner',false,'awaiting-owner'],
    'a workflow waiting on its handover waits on the owner, it is not orphaned');

  answer(repo,wf,{dispatchId:'ho-d1',optionIndex:0});
  s=await status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.ask.decision,s.handover.ask.byOwner],['handover-answered',true,'approve',true]);
  assert.match(s.frontier.reason,/enqueue handover\.review again/);
  assert.equal((await run('finish','--repo',repo,'--workflow',wf,'--json')).status===0,false,'an answer is not yet the recorded approval');

  const settled=await settleApproval(repo,wf,{attempt:2,dispatchId:'ho-d2'});
  assert.equal(settled.status,0,settled.stderr||settled.stdout);
  assert.deepEqual(json(settled).handoverApproved,{dispatchId:'ho-d1',answeredBy:'owner'});
  const [approved]=approvals(repo,wf);
  assert.deepEqual([approved.jobId,approved.dispatchId,approved.answeredBy,approved.at],['job-ho-2','ho-d1','owner','2026-09-23T10:00:00.000Z'],
    'handover-approved {jobId, dispatchId, answeredBy, at}');

  s=await status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.state,s.handover.finishAllowed],['finish-ready',true,'approved',true],
    'an approved but unfinished workflow is the Kernel\'s to finish');

  // A business job that settles after the approval: the owner approved a package that no longer covers the product.
  seed(repo,ledger=>{
    seedJob(ledger,{wf,jobId:'job-docs-2',op:'docs.author',status:'succeeded',result:{verdict:'pass'}});
    ledger.appendEvent({workflowId:wf,entityType:'job',entityId:'job-docs-2',kind:'op-settled',payload:{verdict:'pass',status:'succeeded'}});
  });
  s=await status(repo,wf);
  assert.equal(s.handover.finishAllowed,false);
  assert.equal(s.frontier.state,'handover-due');
  const stale=await run('finish','--repo',repo,'--workflow',wf,'--json');
  assert.notEqual(stale.status,0);
  assert.match(stale.stderr,/handover-not-approved/);

  // Handed over again and approved again: the new approval covers the new settle.
  await handOver(repo,wf,{attempt:3,dispatchId:'ho-d3'});
  answer(repo,wf,{dispatchId:'ho-d3',optionIndex:0});
  assert.equal((await settleApproval(repo,wf,{attempt:4,dispatchId:'ho-d4'})).status,0);
  const finished=await run('finish','--repo',repo,'--workflow',wf,'--json');
  assert.equal(finished.status,0,finished.stderr||finished.stdout);
  assert.equal(json(finished).handover.via,'handover-approved');
  assert.equal(read(repo,db=>db.prepare('SELECT phase FROM workflows WHERE workflow_id=?').get(wf).phase),'finished');
});

test('a non-owner answer never approves a handover',async t=>{
  const repo=fixture(t),wf='wf-handover-delegate';
  seedWorkflow(repo,wf);
  await handOver(repo,wf,{attempt:1,dispatchId:'ho-d1'});
  answer(repo,wf,{dispatchId:'ho-d1',optionIndex:0,answeredBy:'supervisor'});
  const s=await status(repo,wf);
  assert.deepEqual([s.frontier.state,s.handover.ask.decision,s.handover.ask.byOwner],['handover-answered','approve',false]);
  assert.match(s.frontier.reason,/only the owner approves a handover/);
  const refused=await settleApproval(repo,wf,{attempt:2,dispatchId:'ho-d2'});
  assert.notEqual(refused.status,0,'a delegated approve cannot settle the handover pass');
  assert.match(refused.stderr,/handover-not-approved/);
  assert.match(refused.stderr,/answered by supervisor/);
  assert.equal(read(repo,db=>db.prepare("SELECT status FROM jobs WHERE job_id='job-ho-2'").get().status),'reported','the refused settle writes nothing');
  assert.deepEqual(approvals(repo,wf),[]);
  retire(repo,wf,'job-ho-2');
  assert.match((await run('finish','--repo',repo,'--workflow',wf,'--json')).stderr,/handover-not-approved/);

  // A receipt that says owner under an event that does not, and a receipt bound to another ask, approve nothing either.
  for(const [dispatchId,opts] of [['ho-d3',{eventAnsweredBy:'supervisor'}],['ho-d5',{receiptDispatch:'ho-other'}]]){
    const attempt=Number(dispatchId.slice(-1));
    await handOver(repo,wf,{attempt,dispatchId});
    answer(repo,wf,{dispatchId,optionIndex:0,...opts});
    const r=await settleApproval(repo,wf,{attempt:attempt+1,dispatchId:`${dispatchId}-next`});
    assert.notEqual(r.status,0,`${dispatchId} must not approve`);
    assert.match(r.stderr,/handover-not-approved/);
    retire(repo,wf,`job-ho-${attempt+1}`);
  }
  assert.deepEqual(approvals(repo,wf),[]);
});

test('feedback and question answers are the Kernel\'s move, and a passed fix makes the handover due again',async t=>{
  const repo=fixture(t),wf='wf-handover-feedback';
  seedWorkflow(repo,wf);
  await handOver(repo,wf,{attempt:1,dispatchId:'ho-d1'});
  answer(repo,wf,{dispatchId:'ho-d1',optionIndex:1,note:'N\u00fat l\u01b0u kh\u00f4ng ho\u1ea1t \u0111\u1ed9ng'});
  let s=await status(repo,wf);
  assert.deepEqual([s.frontier.state,s.frontier.actionable,s.handover.ask.decision,s.handover.ask.note],['handover-answered',true,'feedback','N\u00fat l\u01b0u kh\u00f4ng ho\u1ea1t \u0111\u1ed9ng']);
  assert.match(s.frontier.reason,/handover-feedback-repairs-the-build/);
  assert.match((await settleApproval(repo,wf,{attempt:2,dispatchId:'ho-d2'})).stderr,/not approve/,'feedback is no approval');
  retire(repo,wf,'job-ho-2');
  seed(repo,ledger=>{
    seedJob(ledger,{wf,jobId:'job-fix',op:'docs.author',status:'succeeded',result:{verdict:'pass'}});
    ledger.appendEvent({workflowId:wf,entityType:'job',entityId:'job-fix',kind:'op-settled',payload:{verdict:'pass',status:'succeeded'}});
  });
  s=await status(repo,wf);
  assert.deepEqual([s.frontier.state,s.handover.state],['handover-due','due'],'the fix passed: hand over again');
  const deliveries=json(await run('survey','--repo',repo,'--workflow',wf,'--deliveries','--json'));
  assert.deepEqual(deliveries.handoverHistory.map(h=>[h.dispatchId,h.decision,h.note]),[['ho-d1','feedback','N\u00fat l\u01b0u kh\u00f4ng ho\u1ea1t \u0111\u1ed9ng']],
    'the next handover and the fix op read the note through survey --deliveries');
  assert.deepEqual(deliveries.deliveries.map(d=>d.jobId),['job-docs','job-fix']);

  await handOver(repo,wf,{attempt:4,dispatchId:'ho-d4'});
  answer(repo,wf,{dispatchId:'ho-d4',optionIndex:2,note:'L\u00e0m sao \u0111\u0103ng nh\u1eadp?'});
  s=await status(repo,wf);
  assert.deepEqual([s.frontier.state,s.handover.ask.decision],['handover-answered','question']);
  assert.match(s.frontier.reason,/answers it in the package/);
});

test('the planner appends handover.review as the final leg of every chain',()=>{
  const plan=(...args)=>{const r=spawnSync(process.execPath,[PLAN,'--simulate','--json',...args],{cwd:ROOT,encoding:'utf8',windowsHide:true,timeout:120000});return JSON.parse(r.stdout);};
  for(const text of ['vi\u1ebft SDS, khai b\u00e1o .starcistacks','build the enrolment screen','scaffold a backend and a frontend']){
    const p=plan('--text',text);
    assert.equal(p.status,'ok',text);
    const last=p.legs.at(-1);
    assert.equal(last.op,HANDOVER_OP,`${text}: ${p.legs.map(l=>l.op).join(' > ')}`);
    assert.deepEqual(last.producesCovered,['handover: approved']);
    assert.ok(last.injected);
    assert.equal(p.legs.filter(l=>l.op===HANDOVER_OP).length,1);
  }
  const vars=readYaml('modules/goal/legality.yaml').producesVocabulary;
  assert.deepEqual(vars.opProduces[HANDOVER_OP],['handover: approved']);
  assert.ok(vars.stateVariables.includes('handover: approved'));
  const ambiguous=plan('--text','xyzzy');
  assert.equal(ambiguous.status,'needs-owner');
  assert.ok(!ambiguous.legs.some(l=>l.op===HANDOVER_OP),'an intent question is no chain to hand over');
});

test('starci kernel plan does not count a trailing handover.review appended to an older chain as divergence',async t=>{
  const repo=fixture(t),wf='wf-handover-plan';
  seedWorkflow(repo,wf);
  seed(repo,ledger=>ledger.db.prepare('UPDATE goals SET json=? WHERE workflow_id=?').run(JSON.stringify({opChain:{legs:[{op:'docs.author'},{op:'review.verify'}]},derivedPlan:{legs:[{op:'docs.author'},{op:'review.verify'}],edges:[['docs.author','review.verify']]}}),wf));
  const planFile=(name,legs)=>{const f=path.join(repo,name);fs.writeFileSync(f,JSON.stringify({legs:legs.map(op=>({op})),edges:legs.slice(1).map((op,i)=>[legs[i],op])}));return f;};
  const appended=await run('plan','--repo',repo,'--workflow',wf,'--file',planFile('a.json',['docs.author','review.verify',HANDOVER_OP]),'--json');
  assert.equal(appended.status,0,appended.stderr);
  assert.deepEqual([json(appended).divergence.diverged,json(appended).divergence.handoverAppended,json(appended).divergence.extra],[false,true,[]]);
  const middle=await run('plan','--repo',repo,'--workflow',wf,'--file',planFile('b.json',['docs.author',HANDOVER_OP,'review.verify']),'--json');
  assert.equal(json(middle).divergence.diverged,true,'anywhere but last it is a structural change');
});
});


test('an accepted goal revision invalidates both handover approval routes and finish preserves pending input and kernel custody', async t => {
  const repo=fixture(t),wf='wf-handover-revised';
  seedWorkflow(repo,wf);
  await handOver(repo,wf,{attempt:1,dispatchId:'revision-ho-1'});
  answer(repo,wf,{dispatchId:'revision-ho-1',optionIndex:0});
  const approved=await settleApproval(repo,wf,{attempt:2,dispatchId:'revision-ho-2'});
  assert.equal(approved.status,0,approved.stderr||approved.stdout);
  const prompt='refactor and canonicalize .starciwork and .starcistacks against the current contracts';
  const define=path.join(ROOT,'scripts','goal','define-goal.mjs');
  const preview=await execute(process.execPath,[define,'--repo',repo,'--revise',wf,'--text',prompt,'--plan','--json'],
    {cwd:ROOT,windowsHide:true,timeout:120000,env:{...process.env,ORCA_TERMINAL_HANDLE:'',STARCI_ROLE:''}});
  assert.equal(preview.status,0,preview.stderr||preview.stdout);
  const command=json(preview).revisionPreview.approval.command;
  const applied=await execute(command.executable,command.args,{cwd:ROOT,windowsHide:true,timeout:120000,
    env:{...process.env,ORCA_TERMINAL_HANDLE:'',STARCI_ROLE:''}});
  assert.equal(applied.status,0,applied.stderr||applied.stdout);
  seed(repo,ledger=>ledger.transaction(db=>{
    setSignal(db,{scope:'kernel',key:wf,workflowId:wf,token:'revision-seat',value:{workflowId:wf,terminal:null},expiresAt:null});
    postInbox(db,{workflowId:wf,kind:'owner-answer',key:'preserve-note',payload:{note:'independent consequential input'}});
  }));
  assert.equal(read(repo,db=>handoverGateOf(db,wf).ok),false);
  assert.equal(read(repo,db=>handoverApprovalOf(db,wf,{attempt:3}).approved),false);
  const capture=()=>read(repo,db=>({workflow:db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(wf),
    inbox:db.prepare('SELECT * FROM inbox WHERE workflow_id=? ORDER BY inbox_id').all(wf),
    signals:db.prepare('SELECT * FROM signals WHERE workflow_id=?').all(wf),
    events:db.prepare('SELECT * FROM events WHERE workflow_id=? ORDER BY seq').all(wf)}));
  const before=capture();
  const refused=await run('finish','--repo',repo,'--workflow',wf,'--json');
  assert.notEqual(refused.status,0);
  assert.match(refused.stderr,/handover-not-approved/);
  assert.deepEqual(capture(),before,'refusal neither finishes nor consumes the pending revision/note, releases custody or records a finish');
  const goal=read(repo,db=>JSON.parse(db.prepare('SELECT json FROM goals WHERE workflow_id=? ORDER BY revision DESC LIMIT 1').get(wf).json));
  const plan=path.join(repo,'revised-plan.json');fs.writeFileSync(plan,JSON.stringify(goal.derivedPlan));
  const planned=await run('plan','--repo',repo,'--workflow',wf,'--file',plan,'--json');
  assert.equal(planned.status,0,planned.stderr||planned.stdout);
  assert.equal(read(repo,db=>handoverGateOf(db,wf).ok),false,'planning the revision does not revive the old approval');
  await handOver(repo,wf,{attempt:3,dispatchId:'revision-ho-3'});
  answer(repo,wf,{dispatchId:'revision-ho-3',optionIndex:0});
  const fresh=await settleApproval(repo,wf,{attempt:4,dispatchId:'revision-ho-4'});
  assert.equal(fresh.status,0,fresh.stderr||fresh.stdout);
  const done=await run('finish','--repo',repo,'--workflow',wf,'--json');
  assert.equal(done.status,0,done.stderr||done.stdout);
});


test('native handover and finish revalidate the actual required proof bytes and canonical obligations',async t=>{
  const repo=fixture(t),wf='wf-handover-integrity';seedWorkflow(repo,wf);
  const old=process.env.STARCI_ARTIFACT_ROOT;process.env.STARCI_ARTIFACT_ROOT=path.join(repo,'private-artifacts');
  t.after(()=>{if(old===undefined)delete process.env.STARCI_ARTIFACT_ROOT;else process.env.STARCI_ARTIFACT_ROOT=old;});
  const rel='.starciwork/features/acceptance/fr/delivery',id='fr.acceptance.delivery',command='node --test tests/delivery.spec.mjs',e2eCommand='node --test tests/e2e.spec.mjs';
  fs.mkdirSync(path.join(repo,rel),{recursive:true});fs.mkdirSync(path.join(repo,'tests'));
  fs.writeFileSync(path.join(repo,'tests/delivery.spec.mjs'),"import test from 'node:test';test('private delivery boundary',()=>{});\n");
  fs.writeFileSync(path.join(repo,'tests/e2e.spec.mjs'),"import test from 'node:test';test('private e2e boundary',()=>{});\n");
  seed(repo,l=>l.db.prepare("UPDATE jobs SET payload_json=? WHERE job_id='job-docs'").run(JSON.stringify({opId:'docs.author',records:[rel],owned_paths:['tests/']})));
  const jobId='job-ho-proof';const {scratch}=seed(repo,l=>seedJob(l,{wf,jobId,op:HANDOVER_OP,unitKey:'ho',dispatchId:'proof-ho-1'}));
  const ask=writeReport(scratch,'missing-canonical.json',{outcome:'ask',question:{text:'delivery',options:OPTIONS}});
  const absent=await run('report','--repo',repo,'--job',jobId,'--report',ask,'--json');assert.notEqual(absent.status,0);assert.match(absent.stderr,/handover-proof-unjudged/);
  assert.equal(read(repo,db=>db.prepare('SELECT count(*) n FROM reports WHERE job_id=?').get(jobId).n),0);assert.equal(fs.existsSync(ask),true);
  fs.writeFileSync(path.join(repo,rel,'index.yaml'),`id: ${id}\nrequiresProof:\n  unit: { required: true, command: '${command}' }\n  requirements: { required: true, command: '${e2eCommand}' }\n`);
  const missing=await run('report','--repo',repo,'--job',jobId,'--report',ask,'--json');assert.notEqual(missing.status,0);assert.match(missing.stderr,/handover-proof-owed/);
  const child=spawnSync(process.execPath,['--test','tests/delivery.spec.mjs'],{cwd:repo,encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(child.status,0,child.stderr||child.stdout);
  const blob=stageBlob(child.stdout,{file:false});
  seed(repo,l=>l.transaction(db=>{
    const job=db.prepare("SELECT * FROM jobs WHERE job_id='job-docs'").get(),attemptId=db.prepare("SELECT attempt_id FROM op_attempts WHERE job_id='job-docs'").get().attempt_id;
    const envelope={outcome:'done',summary:'actual private run',claims:[{frs:[id]}],checks:[{name:'delivery',command,exitCode:child.status}]};
    fileReport(db,{attemptId,outcome:'done',report:envelope});recordCheck(db,{attemptId,name:'delivery',phase:'verify',runner:'kernel',command,cwd:repo,exitCode:child.status,stdout:blob});
    const {artifactId}=putArtifact(db,{workflowId:wf,attemptId,role:'check-stdout',name:'delivery-output.txt',blob,origin:'op'});
    recordArtifactProofs(db,{repo,job,payload:JSON.parse(job.payload_json),envelope,artifacts:[{artifactId,name:'delivery-output.txt',kind:'text',abs:blob.fileUri}]});
    l.appendEvent({workflowId:wf,entityType:'job',entityId:job.job_id,kind:'artifacts-indexed',payload:{artifacts:[{id:artifactId,name:'delivery-output.txt',sha256:blob.sha}]}});
  }));
  const diagnostic=await run('coverage','--repo',repo,'--workflow',wf,'--json');assert.equal(diagnostic.status,0,diagnostic.stderr||diagnostic.stdout);
  assert.deepEqual(json(diagnostic).items.find(item=>item.id===id).obligations.map(row=>[row.kind,row.status]),[['requirements','missing'],['unit','proven']]);
  const stillOwed=await run('report','--repo',repo,'--job',jobId,'--report',ask,'--json');assert.notEqual(stillOwed.status,0);assert.match(stillOwed.stderr,/handover-proof-owed/);
  const e2e=spawnSync(process.execPath,['--test','tests/e2e.spec.mjs'],{cwd:repo,encoding:'utf8',windowsHide:true,timeout:30000});assert.equal(e2e.status,0,e2e.stderr||e2e.stdout);
  seed(repo,l=>{const attemptId=l.db.prepare("SELECT attempt_id FROM op_attempts WHERE job_id='job-docs'").get().attempt_id;
    recordCheck(l.db,{attemptId,name:'e2e',phase:'verify',runner:'kernel',command:e2eCommand,cwd:repo,exitCode:e2e.status,stdout:stageBlob(e2e.stdout,{file:false})});});
  assert.equal(json(await run('coverage','--repo',repo,'--workflow',wf,'--json')).mustOwed.length,0);
  assert.equal((await run('report','--repo',repo,'--job',jobId,'--report',ask,'--json')).status,0);
  assert.equal((await run('settle','--repo',repo,'--job',jobId,'--verdict','blocked','--json')).status,0);
  seed(repo,l=>l.appendEvent({workflowId:wf,entityType:'report',entityId:'proof-ho-1',kind:'ask-serving',payload:{dispatchId:'proof-ho-1',url:'http://127.0.0.1:6971/a-x',pid:process.pid}}));
  answer(repo,wf,{dispatchId:'proof-ho-1',optionIndex:0});
  const approved=await settleApproval(repo,wf,{attempt:2,dispatchId:'proof-ho-2'});assert.equal(approved.status,0,approved.stderr||approved.stdout);
  fs.writeFileSync(blob.fileUri,'tampered after approval');
  const before=read(repo,db=>({workflow:db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(wf),events:db.prepare('SELECT * FROM events WHERE workflow_id=? ORDER BY seq').all(wf)}));
  const refused=await run('finish','--repo',repo,'--workflow',wf,'--json');assert.notEqual(refused.status,0);assert.match(refused.stderr,/handover-proof-unjudged/);
  assert.deepEqual(read(repo,db=>({workflow:db.prepare('SELECT * FROM workflows WHERE workflow_id=?').get(wf),events:db.prepare('SELECT * FROM events WHERE workflow_id=? ORDER BY seq').all(wf)})),before);
});

test('native coverage refuses absent or ambiguous admitted handover selection',async t=>{
  const repo=fixture(t),wf='wf-coverage-policy';seedWorkflow(repo,wf);
  let out=await run('coverage','--repo',repo,'--workflow',wf,'--json');
  assert.notEqual(out.status,0);assert.match(out.stderr,/handover-proof-unjudged/);
  seed(repo,l=>{seedJob(l,{wf,jobId:'job-ho-policy-a',op:HANDOVER_OP});
    seedJob(l,{wf,jobId:'job-ho-policy-b',op:HANDOVER_OP});});
  out=await run('coverage','--repo',repo,'--workflow',wf,'--json');
  assert.notEqual(out.status,0);assert.match(out.stderr,/more than one active handover/);
});
