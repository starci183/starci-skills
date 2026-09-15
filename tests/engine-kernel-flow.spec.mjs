import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {buildReport} from '../kernel/reports.mjs';
import {applyOpReport} from '../kernel/kernel.mjs';
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
    checksPath:id=>path.join(dir,'checks',`${id}.json`)};
  const op={id:'implement-ready',kind:'backend.implement',goal:'Make the application ready.',acceptance:['app.txt contains the exact ready state'],
    allowlist:['app.txt'],checks:[{name:'ready-oracle',command}],attempt:1,status:'running',runtime:'gpt-5.6-sol',dispatch:'ctx-1',
    launchedAt:Date.now(),baseHead:head,reports:[],findings:[],dependsOn:[],ledgerIds:[],expectedBaseFailures:{'test/oracle.test.mjs':'expected-pending'}};
  const state={id:store.id,dir,job:'fixture',worktree:root,branch:'main',head,approved:true,engine:{schema:'starci/engine@1',generation:1,journalFile:path.join(dir,'journal.sqlite')},
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
