import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildReport} from '../kernel/reports.mjs';
import {acceptReports,applyOpReport,stageAnsweredDecisionLateReport} from '../kernel/kernel.mjs';
import {createEngineRuntime} from '../kernel/engine.mjs';

const git=(executable,args,options={})=>spawnSync(executable,args,{encoding:'utf8',windowsHide:true,...options});
const command='node test/oracle.test.mjs';

function fixture(t){
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-engine-kernel-flow-')),root=path.join(temp,'repo');
  fs.mkdirSync(root,{recursive:true});
  fs.mkdirSync(path.join(root,'test'),{recursive:true});
  fs.writeFileSync(path.join(root,'app.txt'),'pending\n');
  fs.writeFileSync(path.join(root,'test','oracle.test.mjs'),
    "import fs from 'node:fs';\nconst ok=fs.readFileSync('app.txt','utf8').includes('ready');\nconsole.log(ok?'ready':'expected-pending');\nprocess.exit(ok?0:1);\n");
  assert.equal(git('git',['init','-q'],{cwd:root}).status,0);
  assert.equal(git('git',['config','user.email','fixture@example.test'],{cwd:root}).status,0);
  assert.equal(git('git',['config','user.name','Fixture'],{cwd:root}).status,0);
  assert.equal(git('git',['add','.'],{cwd:root}).status,0);
  assert.equal(git('git',['commit','-qm','base'],{cwd:root}).status,0);
  const head=git('git',['rev-parse','HEAD'],{cwd:root}).stdout.trim();
  const dir=path.join(temp,'kernel');
  const events=[];
  const store={id:'wf-engine-flow',dir,events,paths:{},appendEvent(event){events.push(event);return event;},saveState(){},
    writeChecks(){},readChecks(){return null;}};
  const op={id:'implement-ready',kind:'backend.implement',goal:'Make the application ready.',acceptance:['app.txt contains the exact ready state'],
    allowlist:['app.txt'],checks:[{name:'ready-oracle',command}],attempt:1,status:'running',runtime:'gpt-5.6-sol',dispatch:'ctx-1',
    launchedAt:Date.now(),baseHead:head,reports:[],findings:[],dependsOn:[],ledgerIds:[],expectedBaseFailures:{'test/oracle.test.mjs':'expected-pending'}};
  const state={id:store.id,dir,job:'fixture',worktree:root,branch:'main',head,approved:true,engine:{schema:'starci/engine@1',generation:1,ledgerFile:path.join(dir,'.starciwork','runtime.sqlite'),machineFile:path.join(dir,'machine.sqlite')},
    ops:[op],inputs:[],ledger:[],needUser:[],lanes:{},gates:[],gateResults:[],verifyRounds:{},gateRounds:0,counters:{},iterations:1,
    decisions:[],sharedQueue:[],silences:{},dynamicOps:0,dynamicOpsBudget:8,stalls:0};
  fs.mkdirSync(dir,{recursive:true});
  const runtime=createEngineRuntime({store,state,git,candidateBase:path.join(temp,'candidates'),eligibility:()=>({eligible:true,mode:'qualified'}),spawnChild:()=>({pid:1,once(){},unref(){}})});
  const lease=runtime.reserveOperation(op,{role:'implement',runtime:'gpt-5.6-sol',target:'gpt-5.6-sol'});
  assert.equal(lease.ok,true);
  runtime.beginCandidate(op,{oraclePaths:['test/oracle.test.mjs'],environmentDigest:'fixture-node-runtime'});
  fs.writeFileSync(path.join(root,'app.txt'),'ready\n');
  runtime.settled(op,{workerOnly:true});
  const frozen=runtime.freezeCandidate(op,{reportedFiles:['app.txt']});
  assert.equal(frozen.status,'sealed');
  // The durable process launcher is tested separately. Here commands run synchronously while retaining the
  // real journal-backed operation lease and the real frozen base/worker/oracle candidate roots.
  runtime.check=(cmd,options)=>spawnSync(cmd,{shell:true,encoding:'utf8',windowsHide:true,...options});
  runtime.candidateCheck=(cmd,options={},candidateOp)=>runtime.check(cmd,{...options,cwd:runtime.candidateCwd(candidateOp)},candidateOp);
  const guards={protectedPaths:()=>[],revertProtected:()=>({reverted:[],removed:[]}),resourceLocks:()=>[],resourcesClash:()=>false,
    gitQueue:fn=>fn(),preflight:()=>({ok:true,fixes:[],problems:[]}),parseSharedChangePaths:()=>[]};
  const ctx={cwd:root,git,exec:(cmd,options)=>spawnSync(cmd,{shell:true,encoding:'utf8',windowsHide:true,...options}),guards,engine:runtime,orca:null,
    now:()=>Date.now(),work:null,allocator:{snapshot:()=>({cooling:[]})},validator:['gpt-5.6-sol'],reconcile:null,renderChecks:null,
    contractDigest:null,kindsProfile:null,validateOp:()=>({ok:true,verdict:'accept',summary:'criterion and reproduced check pass',findings:[],dropped:[],
      provider:'gpt-5.6-sol',complete:true,independentFromAttempt:true,freshContext:true,reviewerAttemptId:'validator-job-2'})};
  const report=buildReport({outcome:'done',run:'run-fixture',task:'task-fixture',dispatch:'ctx-1',from:'term-fixture',
    summary:'application is ready',files:['app.txt'],checks:[{name:'ready-oracle',command,exitCode:0,evidence:'ready'}]});
  return {temp,root,store,state,op,runtime,ctx,report,head};
}

const dispose=f=>{f.runtime.close();fs.rmSync(f.temp,{recursive:true,force:true});};

function lateDecisionFixture(t){
  const f=fixture(t),receipt='receipt-owner';f.state.run='run-fixture';
  Object.assign(f.op,{kind:'decision.prepare',goal:'Prepare the ledger decision.',terminal:'term-owner',workerSettled:true,
    launch:{task:'task-fixture',dispatch:'ctx-1'},
    question:{kind:'decision',text:'Which ledger?',options:[{id:'1',label:'Customer'},{id:'2',label:'Platform'}],prepared:true},
    ownerRequestStatus:'answered',ownerAnswer:{receiptId:receipt,value:'2'},ownerContinuationReceipt:receipt});
  f.report={...f.report,from:'term-owner',summary:'decision: demo.ledger recommended: 2\n1. Customer\n2. Platform',sent:{messageId:'msg-late',sentAt:2,type:'worker_done'}};
  const reportFile=path.join(f.store.dir,'reports',`${f.op.dispatch}.json`);fs.mkdirSync(path.dirname(reportFile),{recursive:true});fs.writeFileSync(reportFile,`${JSON.stringify(f.report,null,2)}\n`);
  Object.assign(f.store,{reportPath:id=>path.join(f.store.dir,'reports',`${id}.json`),readReports:()=>[JSON.parse(fs.readFileSync(reportFile,'utf8'))],acknowledgeRuntimeFile(){},saveState(){}});
  const staged=stageAnsweredDecisionLateReport(f.state,f.op,{store:f.store,runtime:f.runtime,dispatchId:f.op.dispatch,taskId:f.report.task});assert.equal(staged.ok,true,staged.reason);
  f.ctx.allocator={snapshot:()=>({cooling:[]}),release(){}};
  f.ctx.kindsProfile={kinds:{'decision.prepare':{family:'design',role:'decide',readOnly:false,reads:[],writes:['code']}}};
  const orcaCalls=[];f.orcaCalls=orcaCalls;f.orca={invoke:(name,input)=>{orcaCalls.push([name,input]);return {outcome:'ok',receipt:{result:{}}};}};
  return f;
}

test('real applyOpReport commits only a sealed candidate with reproduced checks and fresh independent evidence',t=>{
  const f=fixture(t);
  t.after(()=>dispose(f));
  const action=applyOpReport(null,f.store,f.state,f.op,f.report,f.ctx);
  assert.equal(action,'done',JSON.stringify({pending:f.op.pending,proof:f.op.proof,validation:f.op.validation}));
  assert.equal(f.op.status,'done');
  assert.notEqual(f.state.head,f.head);
  assert.equal(git('git',['status','--porcelain'],{cwd:f.root}).stdout.trim(),'');
  assert.equal(f.op.verifiedChecks[0].name,'ready-oracle');
  assert.equal(f.op.proof.verdict,'pass');
  assert.ok(f.store.events.some(event=>event.event==='op-done'));
  assert.ok(fs.existsSync(path.join(f.store.dir,'evidence',`${f.op.candidate.identity.jobId}-validation.json`)));
});

test('real applyOpReport refuses canonical drift after candidate freeze without committing or completing the op',t=>{
  const f=fixture(t);
  t.after(()=>dispose(f));
  fs.writeFileSync(path.join(f.root,'app.txt'),'drift-after-freeze\n');
  const action=applyOpReport(null,f.store,f.state,f.op,f.report,f.ctx);
  assert.equal(action,'acceptance-pending');
  assert.notEqual(f.op.status,'done');
  assert.equal(git('git',['rev-parse','HEAD'],{cwd:f.root}).stdout.trim(),f.head);
  assert.equal(fs.readFileSync(path.join(f.root,'app.txt'),'utf8'),'drift-after-freeze\n');
});

test('real applyOpReport leaves a matching green candidate uncommitted when fresh review evidence is incomplete',t=>{
  const f=fixture(t);
  t.after(()=>dispose(f));
  f.ctx.validateOp=()=>({ok:true,verdict:'accept',summary:'review transport was truncated',findings:[],dropped:[],provider:'gpt-5.6-sol',
    complete:false,independentFromAttempt:true,freshContext:true,reviewerAttemptId:'validator-job-incomplete'});
  assert.equal(applyOpReport(null,f.store,f.state,f.op,f.report,f.ctx),'acceptance-pending');
  assert.equal(f.op.pending.kind,'required-validation');
  assert.notEqual(f.op.status,'done');
  assert.equal(git('git',['rev-parse','HEAD'],{cwd:f.root}).stdout.trim(),f.head);
  assert.match(git('git',['status','--porcelain'],{cwd:f.root}).stdout,/app\.txt/);
});

test('candidate dependency setup failure stays acceptance-pending without retrying or blaming the model',t=>{
  const f=fixture(t);t.after(()=>dispose(f));
  f.op.candidate.dependency={command:'npm ci --ignore-scripts --no-audit --no-fund',ready:false};
  let checks=0;f.runtime.prepareCandidateDependencies=()=>({ready:false,reason:'deterministic dependency install failed',evidence:'offline registry'});
  f.runtime.candidateCheck=()=>{checks+=1;throw Error('machine verification must wait for dependencies');};
  const attempt=f.op.attempt,lease={...f.op.lease};
  assert.equal(applyOpReport(null,f.store,f.state,f.op,f.report,f.ctx),'acceptance-pending');
  assert.deepEqual(f.op.pending,{kind:'candidate-dependencies',reason:'offline registry'});
  assert.equal(f.op.attempt,attempt);assert.deepEqual(f.op.lease,lease);assert.equal(f.op.status,'running');assert.equal(checks,0);
  assert.equal(f.op.reports.at(-1).downgradedTo,undefined);
});

test('late answered decision replays through real acceptance, commits once, preserves the answer and keeps the owner terminal',t=>{
  const f=lateDecisionFixture(t);t.after(()=>dispose(f));const question=structuredClone(f.op.question),receipt=f.op.ownerAnswer.receiptId;
  const actions=acceptReports(f.orca,f.store,f.state,f.ctx);
  assert.deepEqual(actions,[{op:f.op.id,action:'owner-ask-settled'}],JSON.stringify({pending:f.op.pending,status:f.op.status,events:f.store.events.slice(-5)}));assert.equal(f.op.status,'done');assert.deepEqual(f.op.question,question);
  assert.equal(f.op.ownerRequestStatus,'answered');assert.equal(f.op.ownerAnswer.receiptId,receipt);assert.equal(f.op.ownerContinuationReceipt,receipt);
  assert.equal(f.op.terminal,'term-owner');assert.equal(f.op.dispatch,'ctx-1');assert.equal(f.op.lease,undefined);assert.equal(f.op.lateReportRecovery,undefined);
  assert.equal(f.orcaCalls.some(([name])=>['terminal-close','worker-release','worker-stop'].includes(name)),false);
  assert.equal(f.store.events.filter(event=>event.event==='owner-question').length,0);assert.equal(f.store.events.filter(event=>event.event==='prepared-decision-late-report-accepted').length,1);
  assert.equal(git('git',['status','--porcelain'],{cwd:f.root}).stdout.trim(),'');
});

test('late answered decision preserves its writer across a pending check and accepts the persisted replay',t=>{
  const f=lateDecisionFixture(t);t.after(()=>dispose(f));const original=f.runtime.candidateCheck.bind(f.runtime),lease={...f.op.lease};
  const pending=Object.assign(Error('durable check pending'),{code:'STARCI_JOB_PENDING',job:{identity:{jobId:'check-late'},status:'running'}});
  f.runtime.candidateCheck=()=>{throw pending;};assert.deepEqual(acceptReports(f.orca,f.store,f.state,f.ctx),[]);
  assert.deepEqual(f.op.lease,lease);assert.equal(f.op.lateReportRecovery.schema,'starci/answered-decision-late-report@1');assert.equal(f.op.pending.jobId,'check-late');
  f.runtime.candidateCheck=original;assert.deepEqual(acceptReports(f.orca,f.store,f.state,f.ctx),[{op:f.op.id,action:'owner-ask-settled'}]);assert.equal(f.op.lease,undefined);
});

test('late answered decision check failure quarantines the same candidate and retains its writer and terminal',t=>{
  const f=lateDecisionFixture(t);t.after(()=>dispose(f));const lease={...f.op.lease},head=f.head;
  f.op.repairs=99;f.ctx.decide=()=>{throw Error('late acceptance failure must not invoke retry policy or a model decision');};
  f.runtime.candidateCheck=()=>({status:1,stdout:'',stderr:'failed'});assert.deepEqual(acceptReports(f.orca,f.store,f.state,f.ctx),[]);
  assert.equal(f.op.status,'blocked');assert.equal(f.op.refusal,'runtime-reconciliation');assert.deepEqual(f.op.lease,lease);
  assert.equal(f.op.lateReportRecovery.schema,'starci/answered-decision-late-report@1');assert.equal(f.op.terminal,'term-owner');assert.equal(f.op.ownerRequestStatus,'answered');
  assert.equal(git('git',['rev-parse','HEAD'],{cwd:f.root}).stdout.trim(),head);assert.match(git('git',['status','--porcelain'],{cwd:f.root}).stdout,/app\.txt/);
});
