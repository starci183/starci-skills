// w1-kernel-reconcile regression spec.
//
// Covers three pinned invariants:
//  1. A staged late report that hits `candidate-custody-lost` must return to retry with the late
//     recovery state discarded — never re-quarantined from the stale pre-action marker.
//  2. A blocked `native-stop-reconciliation` op that still holds its lease and Dispatch is
//     reconciled on `workflow retry`: exact stop proof releases the lease and preserves the
//     candidate delta as owned baseline; unprovable proof leaves the op fenced but loud.
//  3. Addendum fallback: any blocked op with a held lease and a pending marker that no dedicated
//     reconciler claims emits `unreconciled-pending` every retry instead of deadlocking silently.
// Regression note kept on purpose: `acceptReports` filters to `op.status==='running'`, so a report
// on disk for an op that already left `running` is skipped — the custody test's second pass covers it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildReport} from '../kernel/reports.mjs';
import {acceptReports,createWorkflowState,kernelMain,quarantineCandidate,stageAnsweredDecisionLateReport} from '../kernel/kernel.mjs';
import {createEngineRuntime} from '../kernel/engine.mjs';
import {createStore} from '../kernel/store.mjs';
import {ledgerFileFor,inspectLedger} from '../kernel/ledger-db.mjs';
import {toOp} from '../kernel/common.mjs';
import {sealRuntime} from '../kernel/runtime-pin.mjs';

const git=(executable,args,options={})=>spawnSync(executable,args,{encoding:'utf8',windowsHide:true,...options});
const GENERATION=8,DIGEST='e'.repeat(64);
// A Git worktree whose `repo/` commit is HEAD: candidate snapshots diff against it.
// `t.after` hooks run in registration order, not LIFO: a hook registered here before the caller's own
// store/runtime-closing hook would remove `root` first and EPERM on the still-open ledger underneath it.
// Returning `cleanup` instead of self-registering lets every caller register it last, after its own handles
// are already queued to close first.
function gitRepo(t){
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'w1-reconcile-')),work=path.join(root,'repo');
  fs.mkdirSync(work,{recursive:true});
  for(const args of [['init'],['config','user.email','w1@test'],['config','user.name','W1']])
    assert.equal(git('git',args,{cwd:work}).status,0);
  fs.mkdirSync(path.join(work,'src'),{recursive:true});
  fs.writeFileSync(path.join(work,'app.txt'),'base\n');
  fs.writeFileSync(path.join(work,'src','a.ts'),'export const a=1;\n');
  assert.equal(git('git',['add','.'],{cwd:work}).status,0);
  assert.equal(git('git',['commit','-m','base'],{cwd:work}).status,0);
  return {root,work,cleanup:()=>fs.rmSync(root,{recursive:true,force:true,maxRetries:20,retryDelay:25})};
}
// Orca proof that the exact recorded Dispatch stopped: completed Dispatch, detached worker,
// succeeded observation, disconnected terminal — everything `completedWorkerProof` requires.
const completedShow=op=>({outcome:'ok',receipt:{result:{
  dispatch:{id:op.dispatch,task_id:op.launch.task,run_id:'run-w1',status:'completed',completed_at:1,capability_revoked_at:2},
  worker:{dispatch_id:op.dispatch,state:'succeeded',stage:'settled'},
  observation:{exactWorker:true,status:'exited'},
  terminal:{handle:op.terminal,connected:false,writable:false,executing:false}}}});
// An ambiguous Orca view: the worker is still recorded running and the terminal close fails, so
// `settleDispatch` returns `effectState:'unknown'` — proof fails and the op must stay fenced.
const unprovableOrca=(calls,op)=>({invoke:command=>{
  calls.push(command);
  if(command==='worker-show')return {outcome:'ok',receipt:{result:{
    dispatch:{id:op.dispatch,task_id:op.launch.task,run_id:'run-w1',status:'dispatched'},
    worker:{dispatch_id:op.dispatch,state:'running',stage:'process_running'},
    observation:{exactWorker:true,status:'running'},
    terminal:{handle:op.terminal,connected:true,writable:true,executing:false}}}};
  if(command==='worker-stop')return {outcome:'ok',receipt:{result:{state:'running'}}};
  if(command==='terminal-close')return {outcome:'failed',reason:'pty still attached'};
  if(command==='worker-release')return {outcome:'ok',receipt:{result:{state:'released'}}};
  return {outcome:'ok',receipt:{result:{}}};
}});
const retryOpSpec=(id= 'impl-1')=>({id,kind:'backend.implement',goal:'Change one file.',allowlist:['src/**'],
  checks:[{name:'unit',command:'node -e "process.exit(0)"'}],acceptance:['change accepted']});
// An op that launched, held its durable lease, then quarantined mid-generation. Returns the op after
// `quarantineCandidate` fenced it, plus the lease clone and the journal file for assertions.
function quarantinedFixture(t,{id='impl-1',pending={kind:'native-stop-reconciliation',effectState:'unknown',reasons:['fixture quarantine']},change='export const a=2;\n',dispatch=true}={}){
  const {root,work,cleanup}=gitRepo(t);
  const store=createStore({repoRoot:work,id:`wf-w1-${id}`});
  t.after(()=>{try{store.close();}catch{}});
  t.after(cleanup);
  // One shared ledger per repo (§3/§8): the engine's own handle must open the SAME file the store
  // does, or `store.bindJournal` refuses it as `ledger-binding-mismatch` - a second, repo-external
  // `journal.sqlite` is the retired two-file 1.0.3 shape.
  const journalFile=ledgerFileFor(work),machineFile=path.join(root,'runtime','machine.sqlite');
  const pin=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(root,'builds'),version:'1.0.0'});
  const current=createWorkflowState({job:'Reconcile a quarantined native stop',worktree:work,branch:'main',store});
  const op=toOp(retryOpSpec(id),0);
  Object.assign(current,{approved:true,phase:'run',run:'run-w1',from:'term-kernel',goalDigest:DIGEST,ops:[op],
    engine:{schema:'starci/engine@1',version:'1.0.0',generation:GENERATION,ledgerFile:journalFile,machineFile,journalChosen:true,runtimePin:pin,coordination:'agent-v1'}});
  Object.assign(op,{attempt:3,status:'running',runtime:'gpt-5.6-luna',dispatch:dispatch?'ctx-stopped':null,terminal:dispatch?'term-stopped':null});
  const runtime=createEngineRuntime({store,state:current,git,candidateBase:path.join(root,'runtime','candidates'),
    eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})});
  assert.equal(runtime.reserveOperation(op,{role:'implement',runtime:op.runtime,target:op.runtime}).ok,true);
  runtime.beginCandidate(op,{environmentDigest:pin.digest});
  if(dispatch){
    if(change)fs.writeFileSync(path.join(work,'src','a.ts'),change);
    runtime.beginLaunchIntent(op);
    op.launch={ok:true,task:'task-w1',dispatch:op.dispatch,effectState:'none',attempts:[]};
    runtime.recordLaunchObservation(op);runtime.launched(op);
  }
  quarantineCandidate(store,current,op,pending);
  store.bindJournal(runtime.journal,GENERATION,{state:current,goalIdentity:current.goalDigest});
  store.saveState(current);
  const lease=structuredClone(op.lease);
  store.unbindJournal(runtime.journal);runtime.close();
  store.signal.set(store.id,'stop',{value:{at:Date.now()}});
  return {root,work,store,state:current,op,lease,journalFile};
}
const heldLease=(file,jobId)=>{
  const ledger=inspectLedger({file});
  try{return ledger.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get(jobId).n;}
  finally{ledger.close();}
};
const jobStatus=(file,jobId)=>{
  const ledger=inspectLedger({file});
  try{return ledger.db.prepare('SELECT status FROM jobs WHERE job_id=?').get(jobId).status;}
  finally{ledger.close();}
};

test('workflow retry reconciles a blocked native stop and re-admits the op',t=>{
  const {work,store,state,op,lease,journalFile}=quarantinedFixture(t);
  const calls=[],orca={invoke:command=>{calls.push(command);return command==='worker-show'?completedShow(op):{outcome:'ok',receipt:{result:{}}};}};
  const result=kernelMain('workflow-retry',{id:state.id},{orca,cwd:work});
  assert.equal(result.ok,true);
  assert.ok(result.retried.includes(op.id));
  assert.ok(calls.every(command=>command==='worker-show'),JSON.stringify(calls));
  const after=store.loadState(),retried=after.ops.find(item=>item.id===op.id);
  assert.equal(retried.status,'ready');
  assert.equal(retried.lease,undefined);
  assert.equal(retried.pending,undefined);
  assert.equal(retried.refusal,undefined);
  assert.equal(retried.dispatch,null);
  assert.equal(retried.terminal,null);
  assert.equal(retried.attempt,4);
  assert.ok(retried.ownedBaselinePaths.includes('src/a.ts'));
  assert.equal(retried.priorStoppedAttempt.dispatch,'ctx-stopped');
  assert.equal(retried.retryReconciled,undefined,'the retry consumes the reconciliation receipt');
  const events=store.readEvents();
  assert.ok(events.some(entry=>entry.event==='native-stop-reconciled'&&entry.op===op.id&&entry.dispatch==='ctx-stopped'&&entry.jobId===lease.jobId));
  assert.ok(!events.some(entry=>entry.event==='native-stop-unreconciled'&&entry.op===op.id));
  assert.equal(jobStatus(journalFile,lease.jobId),'failed');
  assert.equal(heldLease(journalFile,lease.jobId),0);
});

test('workflow retry keeps an unprovable native stop fenced and loud',t=>{
  const {work,store,state,op,lease,journalFile}=quarantinedFixture(t,{id:'impl-2',change:null});
  const calls=[];
  const result=kernelMain('workflow-retry',{id:state.id},{orca:unprovableOrca(calls,op),cwd:work});
  assert.equal(result.ok,true);
  assert.ok(calls.includes('worker-show'));
  const after=store.loadState(),fenced=after.ops.find(item=>item.id===op.id);
  assert.equal(fenced.status,'blocked');
  assert.equal(fenced.pending.kind,'native-stop-reconciliation');
  assert.equal(fenced.refusal,'runtime-reconciliation');
  assert.deepEqual(fenced.lease,lease);
  assert.equal(fenced.dispatch,'ctx-stopped');
  assert.equal(fenced.terminal,'term-stopped');
  const events=store.readEvents();
  assert.ok(events.some(entry=>entry.event==='native-stop-unreconciled'&&entry.op===op.id&&typeof entry.reason==='string'));
  assert.ok(!events.some(entry=>entry.event==='native-stop-reconciled'&&entry.op===op.id));
  assert.ok(heldLease(journalFile,lease.jobId)>0,'the writer reservation stays held while the stop is unproven');
});

test('workflow retry emits unreconciled-pending for a held-lease pending kind with no dedicated path',t=>{
  const {work,store,state,op}=quarantinedFixture(t,{id:'impl-3',dispatch:false,pending:{kind:'external-review-hold',reasons:['fixture pending kind']}});
  const orca={invoke:()=>({outcome:'ok',receipt:{result:{}}})};
  for(let attempt=0;attempt<2;attempt+=1){
    const result=kernelMain('workflow-retry',{id:state.id},{orca,cwd:work});
    assert.equal(result.ok,true);
    const after=store.loadState(),fenced=after.ops.find(item=>item.id===op.id);
    assert.equal(fenced.status,'blocked');
    assert.equal(fenced.pending.kind,'external-review-hold');
    assert.ok(fenced.lease,'the held lease stays held while the pending kind is unresolved');
    const emitted=store.readEvents().filter(entry=>entry.event==='unreconciled-pending'&&entry.op===op.id&&entry.kind==='external-review-hold');
    assert.equal(emitted.length,attempt+1,'every retry emits the fallback event instead of deadlocking silently');
    assert.ok(emitted.every(entry=>entry.leaseAgeMs===null||typeof entry.leaseAgeMs==='number'));
    assert.ok(emitted.every(entry=>entry.disposition==='blocked'));
  }
  // The addendum invariant: every pending kind that can coexist with a held lease either has a
  // dedicated reconcile path (native-stop emits native-stop-unreconciled when it fails) or emits
  // unreconciled-pending — no held lease may deadlock silently.
  const final=store.loadState(),events=store.readEvents();
  for(const held of final.ops.filter(item=>item.lease&&item.status==='blocked'&&item.pending))
    assert.ok(events.some(entry=>(entry.event==='unreconciled-pending'||entry.event==='native-stop-unreconciled')&&entry.op===held.id),
      `pending kind ${held.pending.kind} on ${held.id} must reconcile or emit`);
});

test('workflow retry settles an unknown pending kind whose dispatch is provably stopped',t=>{
  const {work,store,state,op,lease,journalFile}=quarantinedFixture(t,{id:'impl-4',pending:{kind:'external-review-hold',reasons:['fixture pending kind']},change:'export const a=3;\n'});
  const orca={invoke:command=>command==='worker-show'?completedShow(op):{outcome:'ok',receipt:{result:{}}}};
  const result=kernelMain('workflow-retry',{id:state.id},{orca,cwd:work});
  assert.equal(result.ok,true);
  assert.ok(result.retried.includes(op.id));
  const after=store.loadState(),settled=after.ops.find(item=>item.id===op.id);
  assert.equal(settled.status,'ready');
  assert.equal(settled.lease,undefined);
  assert.equal(settled.pending,undefined);
  assert.equal(settled.dispatch,null);
  assert.equal(settled.attempt,4);
  assert.ok(settled.ownedBaselinePaths.includes('src/a.ts'));
  const events=store.readEvents();
  assert.ok(events.some(entry=>entry.event==='unreconciled-pending'&&entry.op===op.id&&entry.kind==='external-review-hold'&&entry.disposition==='settled'));
  assert.equal(jobStatus(journalFile,lease.jobId),'failed');
});

test('candidate custody lost returns the staged late report to retry without re-quarantine',t=>{
  const {root,work,cleanup}=gitRepo(t),taskId='task-late',dispatchId='ctx-late',receipt='receipt-owner';
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'w1-late-'));
  let runtime=null;
  const store=createStore({repoRoot:work,id:'wf-w1-late'});
  t.after(()=>{try{runtime?.close();}finally{try{store.close();}catch{}fs.rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}});
  t.after(cleanup);
  const pin=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(temp,'builds'),version:'1.0.0'});
  const current=createWorkflowState({job:'Ship a late report',worktree:work,branch:'main',store});
  const op=toOp({id:'decide-1',kind:'decision.prepare',goal:'Prepare the platform decision.',allowlist:['app.txt'],
    checks:[{name:'decision-shape',command:'node -e "process.exit(0)"'}],acceptance:['the exact decision draft is preserved']},0);
  Object.assign(current,{approved:true,phase:'run',run:'run-late',from:'term-kernel',goalDigest:'d'.repeat(64),repoRoot:work,ops:[op],
    head:git('git',['rev-parse','HEAD'],{cwd:work}).stdout.trim(),
    engine:{schema:'starci/engine@1',version:'1.0.0',generation:1,ledgerFile:ledgerFileFor(work),machineFile:path.join(temp,'runtime','machine.sqlite'),runtimePin:pin,coordination:'agent-v1'}});
  Object.assign(op,{status:'running',runtime:'gpt-5.6-luna',dispatch:dispatchId,terminal:'term-owner',workerSettled:true,
    question:{kind:'decision',text:'Which ledger?',options:[{id:'1',label:'Customer'},{id:'2',label:'Platform'}],prepared:true},
    ownerRequestStatus:'answered',ownerAnswer:{receiptId:receipt,value:'2'},ownerContinuationReceipt:receipt});
  runtime=createEngineRuntime({store,state:current,git,candidateBase:path.join(temp,'runtime','candidates'),
    eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})});
  assert.equal(runtime.reserveOperation(op,{role:'decide',runtime:op.runtime,target:op.runtime}).ok,true);
  runtime.beginCandidate(op,{environmentDigest:pin.digest});
  fs.writeFileSync(path.join(work,'app.txt'),'ready\n');
  runtime.settled(op,{workerOnly:true});
  assert.equal(runtime.freezeCandidate(op,{reportedFiles:['app.txt']}).status,'sealed');
  op.launch={task:taskId,dispatch:dispatchId};
  const report=buildReport({outcome:'done',run:current.run,task:taskId,dispatch:dispatchId,from:op.terminal,
    summary:'decision: demo.ledger recommended: 2',files:['app.txt'],
    checks:[{name:'decision-shape',command:'node -e "process.exit(0)"',exitCode:0,evidence:'valid'}]});
  report.sent={messageId:'msg-late',sentAt:2,type:'worker_done'};
  store.writeReport({dispatchId,opId:op.id,attempt:op.attempt,report,fromTerminal:op.terminal});
  assert.equal(stageAnsweredDecisionLateReport(current,op,{store,runtime,dispatchId,taskId}).ok,true);
  // Custody is gone before the replay pass: the sealed candidate's control root no longer exists.
  fs.rmSync(op.candidate.controlRoot,{recursive:true,force:true});
  const orca={invoke:()=>({outcome:'ok',receipt:{result:{terminals:[],workers:[]}}})};
  const ctx={cwd:work,git,exec:(cmd,options)=>spawnSync(cmd,{shell:true,encoding:'utf8',windowsHide:true,...options}),
    guards:{protectedPaths:()=>[],revertProtected:()=>({reverted:[],removed:[]}),resourceLocks:()=>[],resourcesClash:()=>false,
      gitQueue:fn=>fn(),preflight:()=>({ok:true,fixes:[],problems:[]}),parseSharedChangePaths:()=>[]},
    engine:runtime,now:()=>Date.now(),work:null,allocator:{snapshot:()=>({cooling:[]}),release(){}},validator:['gpt-5.6-luna'],
    reconcile:null,renderChecks:null,contractDigest:null,
    kindsProfile:{kinds:{'decision.prepare':{family:'design',role:'decide',readOnly:false,reads:[],writes:['code']}}},
    validateOp:()=>({ok:true,verdict:'accept',summary:'ok',findings:[],dropped:[],provider:'gpt-5.6-luna',complete:true,independentFromAttempt:true,freshContext:true,reviewerAttemptId:'validator-job-1'}),
    decide(){throw new Error('custody loss must not invoke retry policy');}};
  const beforeAttempt=op.attempt;
  const actions=acceptReports(orca,store,current,ctx);
  assert.deepEqual(actions,[{op:'decide-1',action:'retry'}]);
  assert.equal(op.status,'ready');
  assert.equal(op.attempt,beforeAttempt+1);
  assert.equal(op.lateReportRecovery,undefined);
  assert.equal(op.candidate,undefined);
  assert.equal(op.pending,undefined);
  assert.equal(op.dispatch,null);
  assert.equal(op.terminal,null);
  assert.equal(op.lease,undefined,'the durable lease completes on custody loss');
  const names=store.readEvents().map(entry=>entry.event);
  assert.ok(names.includes('candidate-custody-lost'));
  assert.ok(names.includes('retry'));
  assert.ok(!names.includes('candidate-reconciliation-required'),'custody loss must not re-quarantine the op');
  assert.ok(!current.needUser.some(item=>item.code==='candidate-reconciliation'));
  // Regression: the report file still sits on disk, but the op is no longer `running` —
  // `acceptReports` must skip it instead of replaying the dead worker a second time.
  assert.deepEqual(acceptReports(orca,store,current,ctx),[]);
});
