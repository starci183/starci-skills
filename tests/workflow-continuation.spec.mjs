import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createStore,WORKFLOW_STATE} from '../kernel/store.mjs';
import {buildContinuationBrief,continuationBoundary,exportContinuationBrief} from '../kernel/continuation.mjs';
import {createWorkflowState,kernelMain,reconcileContinuationPreflight} from '../kernel/kernel.mjs';
import {toOp} from '../kernel/common.mjs';
import {buildReport} from '../kernel/reports.mjs';
import {openJournal} from '../kernel/journal.mjs';
import {createEngineRuntime} from '../kernel/engine.mjs';
import {stagedResultFile} from '../kernel/job-worker.mjs';
import {sealRuntime} from '../kernel/runtime-pin.mjs';

const state=dir=>({schema:WORKFLOW_STATE,kernel:'starci/workflow-kernel@1',id:'wf-resume',job:'Continue the approved UI delivery',phase:'run',approved:true,
  goalDigest:'a'.repeat(64),scope:['features/chat'],definitionOfDone:['Accepted UI and browser UAT'],worktree:dir,repoRoot:dir,branch:'main',head:'b'.repeat(40),
  engine:{schema:'starci/engine@1',generation:4,journalFile:path.join(dir,'missing-journal.sqlite'),runtimePin:{root:path.join(dir,'.claude'),digest:'c'.repeat(64)}},
  decisions:[{id:'decision-1',choice:2,answer:'Keep the accepted direction'}],needUser:[{kind:'environment',detail:'reconcile the exact stopped dispatch'}],
  ops:[{id:'draw-1',kind:'interface.draw',status:'done',attempt:1,head:'d'.repeat(40),files:['.starciwork/features/chat/ui/index.yaml'],reports:[]},
    {id:'implement-1',kind:'frontend.implement',status:'ready',attempt:3,lease:null,task:null,dispatch:null,terminal:null,reports:[]}],ledger:[],gateResults:[]});

test('continuation export is a stable workflows/<id>.md projection with exact source, pin, decisions and incomplete work',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-continuation-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=createStore({repoRoot:root,id:'wf-resume'}),current=state(root);store.saveState(current);
  const result=exportContinuationBrief(store,current,{now:()=>0,git:()=>({status:0,stdout:`${'e'.repeat(40)}\n`})});
  assert.equal(result.file,path.join(root,'workflows','wf-resume.md'));
  const markdown=fs.readFileSync(result.file,'utf8');
  for(const expected of ['starci/workflow-continuation@1','wf-resume','implement-1','decision-1','Runtime pin digest',current.engine.runtimePin.digest,'Observed source HEAD','Next safe action'])assert.match(markdown,new RegExp(expected));
  assert.match(markdown,/journal, state, runtime pin, candidate packets, reports and source commits remain authoritative/i);
  assert.equal(exportContinuationBrief(store,current,{now:()=>1,git:()=>({status:1})}).file,result.file,'the same workflow updates one stable brief');
});

test('continuation export updates one managed public section and preserves human notes',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-continuation-notes-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=createStore({repoRoot:root,id:'wf-resume'}),current=state(root);store.saveState(current);
  fs.mkdirSync(path.dirname(store.paths.continuation),{recursive:true});fs.writeFileSync(store.paths.continuation,'# Operator notes\n\nKeep this reviewed handoff.\n');
  exportContinuationBrief(store,current,{now:()=>0,git:()=>({status:1})});
  const first=fs.readFileSync(store.paths.continuation,'utf8');assert.match(first,/Keep this reviewed handoff/);assert.equal((first.match(/managed-start/g)??[]).length,1);
  current.phase='blocked';exportContinuationBrief(store,current,{now:()=>1,git:()=>({status:1})});
  const second=fs.readFileSync(store.paths.continuation,'utf8');assert.match(second,/Keep this reviewed handoff/);assert.match(second,/blocked/);assert.equal((second.match(/managed-start/g)??[]).length,1);
});

test('an existing friendly public brief that names the exact workflow receives the managed section',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-continuation-friendly-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  const store=createStore({repoRoot:root,id:'wf-resume'}),current=state(root),friendly=path.join(root,'workflows','friendly-handoff.md');store.saveState(current);
  fs.mkdirSync(path.dirname(friendly),{recursive:true});fs.writeFileSync(friendly,'# Reviewed handoff\n\nWorkflow ID: `wf-resume`\n');
  const result=exportContinuationBrief(store,current,{now:()=>0,git:()=>({status:1})});assert.equal(result.file,friendly);assert.match(fs.readFileSync(friendly,'utf8'),/Reviewed handoff[\s\S]*managed-start/);
  assert.equal(fs.existsSync(path.join(root,'workflows','wf-resume.md')),false);
});

test('boundary audit catches a stranded writer and exact dispatch drift without clearing either',()=>{
  const current=state(process.cwd()),op=current.ops[0];Object.assign(op,{status:'done',task:'task-1',dispatch:'ctx-live',terminal:'term-live',
    launch:{task:'task-1',dispatch:'ctx-other'},lease:{workflowId:current.id,opId:op.id,attempt:1,generation:4,jobId:'job-1',leaseToken:'lease-1'}});
  const journalView={file:'fixture.sqlite',error:null,snapshot:null,
    jobs:[{job_id:'job-1',workflow_id:current.id,op_id:op.id,attempt:1,generation:4,kind:'operation',status:'effect_unknown',lease_token:'lease-1'}],
    leases:[{job_id:'job-1',workflow_id:current.id,op_id:op.id,attempt:1,generation:4,resource_key:'writer:test'}]};
  const checked=continuationBoundary(current,{journalView,controller:{alive:false}});
  assert.equal(checked.ok,false);assert.ok(checked.findings.some(item=>item.code==='dispatch-identity-drift'));
  assert.ok(checked.findings.some(item=>item.code==='settled-operation-retains-writer'));
  assert.equal(op.lease.jobId,'job-1');assert.equal(journalView.leases.length,1,'the read-only audit never releases unknown effects');
  const brief=buildContinuationBrief({id:current.id,dir:'.',paths:{state:'state.json',final:'final.json',continuation:'workflow.md'}},current,
    {now:()=>0,git:()=>({status:1})});assert.match(brief.markdown,/reconcile the exact identities/i);
});

test('model, judge and check leases are validated by their own exact identity rather than classified as orphan operation writers',()=>{
  const current=state(process.cwd()),jobs=['model','judge','check'].map((kind,index)=>({job_id:`job-${kind}`,workflow_id:current.id,op_id:`logical-${index}`,attempt:2,generation:4,kind,status:'effect_unknown',lease_token:`token-${kind}`}));
  const leases=jobs.map(job=>({job_id:job.job_id,workflow_id:job.workflow_id,op_id:job.op_id,attempt:job.attempt,generation:job.generation,resource_key:`ai/${job.kind}`,token:job.lease_token}));
  const checked=continuationBoundary(current,{journalView:{file:'fixture.sqlite',error:null,snapshot:null,jobs,leases},controller:{alive:false}});
  assert.equal(checked.ok,true,JSON.stringify(checked.findings));
  leases[0].token='wrong';const drift=continuationBoundary(current,{journalView:{file:'fixture.sqlite',error:null,snapshot:null,jobs,leases},controller:{alive:false}});
  assert.ok(drift.findings.some(item=>item.code==='job-reservation-identity-drift'));
});

test('public same-ID stop, run recovery and retry use a real journal without discarding unknown or staged work',t=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'starci-continuation-public-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
  assert.equal(spawnSync('git',['init','-q'],{cwd:root,windowsHide:true}).status,0);
  const store=createStore({repoRoot:root,id:'wf-public'}),state=createWorkflowState({job:'Resume exact durable work',worktree:root,branch:'main',store});
  const pin=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(root,'builds'),version:'1.0.0'}),journalFile=path.join(root,'runtime','journal.sqlite');
  state.approved=true;state.phase='run';state.goalDigest='f'.repeat(64);state.definitionOfDone=['retain exact effects'];
  state.engine={schema:'starci/engine@1',version:'1.0.0',generation:4,journalFile,runtimePin:pin,coordination:'agent-v1'};
  state.ops=[{id:'accepted',kind:'backend.implement',status:'done',attempt:1,allowlist:['src/**'],references:[],checks:[],acceptance:[],dependsOn:[],reports:[],files:[]},
    {id:'remaining',kind:'backend.implement',status:'ready',attempt:1,allowlist:['src/**'],references:[],checks:[],acceptance:[],dependsOn:[],reports:[],files:[]}];store.saveState(state);
  const journal=openJournal({file:journalFile}),now=Date.now(),insert=journal.db.prepare("INSERT INTO jobs(job_id,workflow_id,op_id,attempt,generation,kind,role,payload_json,status,priority_json,lease_token,deadline,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)"),lease=journal.db.prepare('INSERT INTO leases(resource_key,job_id,workflow_id,op_id,attempt,generation,token,units,acquired_at,expires_at) VALUES(?,?,?,?,?,?,?,?,?,?)');
  const add=(id,opId,kind,status,token,expires,payload={})=>{insert.run(id,state.id,opId,1,4,kind,kind,JSON.stringify(payload),status,'{}',token,expires,now,now);if(token)lease.run(`${kind}:${id}`,id,state.id,opId,1,4,token,1,now,expires);};
  add('operation-accepted','accepted','operation','effect_unknown','tok-operation',now+60000,{reservationProtocol:'intent-v1'});
  add('model-expired','remaining','model','leased','tok-expired',now-1000,{execution:{schema:'unknown'}});
  add('model-staged','remaining','model','effect_unknown','tok-staged',now+60000,{execution:{schema:'unknown'}});
  add('check-unknown','remaining','check','effect_unknown','tok-check',now+60000,{command:'synthetic'});
  insert.run('judge-queued',state.id,'remaining',1,4,'judge','verify','{}','queued','{}',null,null,now,now);
  const stagedJob=journal.getJob('model-staged'),digest=value=>crypto.createHash('sha256').update(String(value??'')).digest('hex'),result={ok:true,value:{planned:'retained'}},staged={schema:'starci/staged-job-result@1',identity:{jobId:stagedJob.job_id,workflowId:stagedJob.workflow_id,opId:stagedJob.op_id,attempt:stagedJob.attempt,generation:stagedJob.generation,leaseTokenDigest:digest(stagedJob.lease_token),payloadDigest:digest(JSON.stringify(stagedJob.payload))},resultDigest:digest(JSON.stringify(result)),result};
  const stagedFile=stagedResultFile(journalFile,'model-staged');fs.mkdirSync(path.dirname(stagedFile),{recursive:true});fs.writeFileSync(stagedFile,JSON.stringify(staged));journal.close();
  const stopped=kernelMain('workflow-stop',{id:state.id},{orca:{},cwd:root});assert.equal(stopped.id,state.id);assert.equal(stopped.continuation,path.join(root,'workflows',`${state.id}.md`));
  assert.throws(()=>kernelMain('workflow-run',{id:state.id,from:'term-fixture',run:'run-fixture','max-iterations':'0'},{orca:{},cwd:root}),/sealed runtime launcher/,
    'the public run passed recovery and boundary validation before refusing a different sealed launcher');
  const after=openJournal({file:journalFile});assert.equal(after.getJob('operation-accepted').status,'cancelled');assert.equal(after.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get('operation-accepted').n,0);
  assert.equal(after.getJob('model-expired').status,'effect_unknown');for(const id of ['model-expired','model-staged','check-unknown'])assert.equal(after.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get(id).n,1);
  assert.equal(fs.existsSync(stagedFile),true);after.close();
  assert.throws(()=>kernelMain('workflow-retry',{id:state.id},{orca:{},cwd:root}),/durable model\/check jobs must settle/);
  const retryJournal=openJournal({file:journalFile});assert.equal(retryJournal.getJob('judge-queued').status,'cancelled');assert.equal(retryJournal.getJob('model-staged').status,'effect_unknown');retryJournal.close();
});

test('public retry durably stages same-generation late-report recovery before its early return',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-continuation-late-save-')),root=path.join(temp,'repo');fs.mkdirSync(root);t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  assert.equal(spawnSync('git',['init','-q'],{cwd:root,windowsHide:true}).status,0);assert.equal(spawnSync('git',['config','user.email','fixture@example.test'],{cwd:root}).status,0);assert.equal(spawnSync('git',['config','user.name','Fixture'],{cwd:root}).status,0);
  fs.writeFileSync(path.join(root,'decision.yaml'),'author: attempt-10\n');spawnSync('git',['add','.'],{cwd:root});spawnSync('git',['commit','-qm','base'],{cwd:root});
  const store=createStore({repoRoot:root,id:'wf-late-save'}),journalFile=path.join(temp,'runtime','journal.sqlite'),pin=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(temp,'builds'),version:'1.0.0'}),pinFile=path.join(temp,'pin.json');fs.writeFileSync(pinFile,JSON.stringify(pin));
  const current=createWorkflowState({job:'Recover the exact answered decision report',worktree:root,branch:'main',store}),op=toOp({id:'ask-3',kind:'decision.prepare',goal:'Prepare the platform ledger decision.',allowlist:['decision.yaml'],checks:[],acceptance:['the exact decision draft is preserved']},0);
  Object.assign(current,{approved:true,phase:'run',run:'run-late',from:'term-kernel',goalDigest:'f'.repeat(64),amendments:[{digest:'owner-amendment',authority:{source:'owner'}}],ops:[op],engine:{schema:'starci/engine@1',version:'1.0.0',generation:29,journalFile,runtimePin:{...pin,digest:'a'.repeat(64),root:path.join(temp,'old-build')},coordination:'agent-v1'}});
  Object.assign(op,{attempt:11,status:'running',runtime:'claude-opus',dispatch:'ctx-late',terminal:'term-owner',question:{kind:'decision',text:'Which ledger?',options:[{id:'1',label:'Customer'},{id:'2',label:'Platform'}],prepared:true},ownerRequestStatus:'answered',ownerAnswer:{receiptId:'receipt-owner',value:'2'},ownerContinuationReceipt:'receipt-owner'});
  const git=(executable,args,options={})=>spawnSync(executable,args,{encoding:'utf8',windowsHide:true,...options}),runtime=createEngineRuntime({store,state:current,git,candidateBase:path.join(temp,'runtime','candidates'),eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})});
  assert.equal(runtime.reserveOperation(op,{role:'decide',runtime:'claude-opus',target:'claude-opus'}).ok,true);runtime.beginCandidate(op,{environmentDigest:current.engine.runtimePin.digest});runtime.beginLaunchIntent(op);op.launch={ok:true,task:'task-late',dispatch:op.dispatch,effectState:'partial',attempts:[]};runtime.recordLaunchObservation(op);runtime.launched(op);
  fs.writeFileSync(path.join(root,'decision.yaml'),'author: attempt-11\n');op.status='done';
  const report=buildReport({outcome:'done',run:current.run,task:'task-late',dispatch:op.dispatch,from:op.terminal,summary:'decision: demo.ledger recommended: 2',files:['decision.yaml'],checks:[{name:'decision-shape',command:'node -e "process.exit(0)"',exitCode:0,evidence:'valid'}]});report.sent={messageId:'msg-late',sentAt:2,type:'worker_done'};fs.writeFileSync(store.reportPath(op.dispatch),`${JSON.stringify(report,null,2)}\n`);
  store.bindJournal(runtime.journal,29,{state:current,goalIdentity:current.goalDigest});store.saveState(current);store.unbindJournal(runtime.journal);const before=structuredClone(current);runtime.close();fs.writeFileSync(path.join(store.dir,'stop.flag'),'stopped');
  const calls=[],orca={invoke(name){calls.push(name);if(name!=='worker-show')throw Error(`unexpected native mutation ${name}`);return {outcome:'ok',receipt:{result:{dispatch:{id:'ctx-late',task_id:'task-late',run_id:'run-late',status:'completed',completed_at:1,capability_revoked_at:2},worker:{dispatch_id:'ctx-late',state:'succeeded',stage:'settled'},observation:{exactWorker:true,status:'live'},terminal:{handle:'term-owner',connected:true,writable:true},terminalResource:{ownershipState:'USER_OWNED',originDispatchId:'ctx-late',terminalHandle:'term-owner'}}}};}};
  const result=kernelMain('workflow-retry',{id:current.id,'runtime-pin':pinFile},{orca,cwd:root});assert.equal(result.recoveryPending,true);assert.deepEqual(calls,['worker-show']);assert.equal(fs.existsSync(path.join(store.dir,'stop.flag')),false);
  fs.writeFileSync(store.paths.state,`${JSON.stringify(before,null,2)}\n`,'utf8');const reloaded=store.loadState();assert.equal(reloaded.engine.runtimePin.digest,'a'.repeat(64));
  const recovered=reconcileContinuationPreflight(store,reloaded);assert.equal(recovered.recovered,true);assert.equal(reloaded.engine.runtimePin.digest,pin.digest);assert.equal(reloaded.ops[0].lateReportRecovery.dispatch,'ctx-late');assert.equal(reloaded.ops[0].workerSettled,true);
  assert.equal(reloaded.ops[0].lease.jobId,op.lease.jobId);assert.equal(reloaded.ops[0].candidate.identity.jobId,op.lease.jobId);assert.equal(reloaded.ops[0].terminal,'term-owner');assert.equal(reloaded.amendments[0].digest,'owner-amendment');
});

test('public retry re-admits a completed report without replacing its candidate writer or model attempt',t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-completed-report-retry-')),root=path.join(temp,'repo');fs.mkdirSync(root);t.after(()=>fs.rmSync(temp,{recursive:true,force:true}));
  for(const args of [['init','-q'],['config','user.email','fixture@example.test'],['config','user.name','Fixture']])assert.equal(spawnSync('git',args,{cwd:root,windowsHide:true}).status,0);
  fs.mkdirSync(path.join(root,'src'));fs.writeFileSync(path.join(root,'src','a.ts'),'export const a=1;\n');spawnSync('git',['add','.'],{cwd:root});spawnSync('git',['commit','-qm','base'],{cwd:root});
  const store=createStore({repoRoot:root,id:'wf-completed-report'}),journalFile=path.join(temp,'runtime','journal.sqlite'),pin=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(temp,'builds'),version:'1.0.0'}),pinFile=path.join(temp,'pin.json');fs.writeFileSync(pinFile,JSON.stringify(pin));
  const current=createWorkflowState({job:'Recover completed report',worktree:root,branch:'main',store}),op=toOp({id:'impl',kind:'frontend.implement',goal:'Change one file.',allowlist:['src'],checks:[{name:'unit',command:'node -e "process.exit(0)"'}],acceptance:['change accepted']},0);
  Object.assign(current,{approved:true,phase:'run',run:'run-exact',from:'term-kernel',goalDigest:'e'.repeat(64),ops:[op],engine:{schema:'starci/engine@1',version:'1.0.0',generation:8,journalFile,runtimePin:{...pin,digest:'a'.repeat(64),root:path.join(temp,'old-build')},coordination:'agent-v1'}});
  Object.assign(op,{attempt:3,status:'running',runtime:'gpt-5.6-luna',dispatch:'ctx-exact',terminal:'term-exact'});
  const git=(executable,args,options={})=>spawnSync(executable,args,{encoding:'utf8',windowsHide:true,...options}),runtime=createEngineRuntime({store,state:current,git,candidateBase:path.join(temp,'runtime','candidates'),eligibility:()=>({eligible:true}),spawnChild:()=>({pid:1,once(){},unref(){}})});
  assert.equal(runtime.reserveOperation(op,{role:'write',runtime:op.runtime,target:op.runtime}).ok,true);runtime.beginCandidate(op,{environmentDigest:current.engine.runtimePin.digest});runtime.beginLaunchIntent(op);op.launch={ok:true,task:'task-exact',dispatch:op.dispatch,effectState:'none',attempts:[]};runtime.recordLaunchObservation(op);runtime.launched(op);
  const report=buildReport({outcome:'done',run:current.run,task:'task-exact',dispatch:op.dispatch,from:op.terminal,summary:'done',files:['src/a.ts'],checks:[{name:'unit',command:'node -e "process.exit(0)"',exitCode:0,evidence:'pass'}]});report.sent={messageId:'msg-exact',sentAt:2,type:'worker_done'};fs.writeFileSync(store.reportPath(op.dispatch),`${JSON.stringify(report,null,2)}\n`);
  op.status='blocked';op.refusal='runtime-reconciliation';op.pending={kind:'dispatch-reconciliation',effectState:'unknown'};store.bindJournal(runtime.journal,8,{state:current,goalIdentity:current.goalDigest});store.saveState(current);store.unbindJournal(runtime.journal);const lease=structuredClone(op.lease),candidate=structuredClone(op.candidate.identity);runtime.close();fs.writeFileSync(path.join(store.dir,'stop.flag'),'stopped');
  const calls=[],orca={invoke(name){calls.push(name);assert.equal(name,'worker-show');return {outcome:'ok',receipt:{result:{dispatch:{id:'ctx-exact',task_id:'task-exact',run_id:'run-exact',status:'completed',completed_at:1,capability_revoked_at:2},worker:{dispatch_id:'ctx-exact',state:'succeeded',stage:'settled'},observation:{exactWorker:true,status:'exited'},terminal:{handle:'term-exact',connected:false,writable:false},terminalResource:{ownershipState:'retained'}}}};}};
  const result=kernelMain('workflow-retry',{id:current.id,'runtime-pin':pinFile},{orca,cwd:root});const after=store.loadState();
  assert.equal(result.recoveryPending,true);assert.equal(result.retainedCompletedReport,true);assert.deepEqual(calls,['worker-show']);assert.equal(after.ops[0].status,'running');assert.equal(after.ops[0].attempt,3);
  assert.deepEqual(after.ops[0].lease,lease);assert.deepEqual(after.ops[0].candidate.identity,candidate);assert.equal(after.ops[0].workerSettled,true);assert.equal(after.ops[0].pending,undefined);
});

test('public stop, valid-pin retry and pinned same-ID run preserve accepted history while completing remaining work',async t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'starci-continuation-positive-')),root=path.join(temp,'repo');let runtime=null;fs.mkdirSync(root);
  t.after(()=>{try{runtime?.close();}finally{fs.rmSync(temp,{recursive:true,force:true,maxRetries:5,retryDelay:100});}});
  assert.equal(spawnSync('git',['init','-q'],{cwd:root,windowsHide:true}).status,0);
  assert.equal(spawnSync('git',['config','user.email','fixture@example.test'],{cwd:root,windowsHide:true}).status,0);
  assert.equal(spawnSync('git',['config','user.name','Fixture'],{cwd:root,windowsHide:true}).status,0);
  fs.mkdirSync(path.join(root,'src'),{recursive:true});fs.writeFileSync(path.join(root,'src','app.txt'),'pending\n');fs.writeFileSync(path.join(root,'.gitignore'),'.starciwork/_local/\n');
  assert.equal(spawnSync('git',['add','.'],{cwd:root,windowsHide:true}).status,0);
  assert.equal(spawnSync('git',['commit','-qm','base'],{cwd:root,windowsHide:true}).status,0);
  const git=(executable,args,options={})=>spawnSync(executable,args,{encoding:'utf8',windowsHide:true,...options});
  const readyCheck=`node -e "const fs=require('node:fs');process.exit(fs.readFileSync('src/app.txt','utf8').trim()==='ready'?0:1)"`;
  const store=createStore({repoRoot:root,id:'wf-positive'}),current=createWorkflowState({job:'Complete the remaining accepted delivery',worktree:root,branch:'main',store});
  const accepted=toOp({id:'accepted',kind:'backend.implement',goal:'Preserve the accepted foundation.',allowlist:['src/accepted.txt'],acceptance:['the accepted foundation remains accepted']},0);
  Object.assign(accepted,{status:'done',attempt:1,head:git('git',['rev-parse','HEAD'],{cwd:root}).stdout.trim(),files:[],reports:[{outcome:'done',summary:'accepted before checkpoint'}]});
  const remaining=toOp({id:'remaining',kind:'backend.implement',goal:'Complete the remaining application state.',allowlist:['src/app.txt'],
    checks:[{name:'ready-content',command:readyCheck}],acceptance:['src/app.txt contains ready']},1);
  remaining.status='ready';
  const pin=sealRuntime({sourceRoot:process.cwd(),buildsRoot:path.join(temp,'builds'),version:'1.0.0'}),journalFile=path.join(temp,'runtime','journal.sqlite');
  Object.assign(current,{approved:true,phase:'run',run:'run-positive',from:'term-positive',goalDigest:'f'.repeat(64),
    definitionOfDone:['accepted history remains intact','remaining application state reaches ready'],ops:[accepted,remaining],
    decisions:[{id:'decision-accepted',choice:2,answer:'retain the accepted foundation'}],head:accepted.head,
    engine:{schema:'starci/engine@1',version:'1.0.0',generation:1,journalFile,journalChosen:true,runtimePin:pin,coordination:'kernel-v0'}});
  store.saveState(current);openJournal({file:journalFile}).close();

  const stopped=kernelMain('workflow-stop',{id:current.id},{orca:{},cwd:root});
  assert.equal(stopped.id,current.id);assert.ok(fs.existsSync(path.join(root,'workflows',`${current.id}.md`)));
  const retried=kernelMain('workflow-retry',{id:current.id},{orca:{},cwd:root});
  assert.equal(retried.ok,true);assert.equal(retried.id,current.id);assert.equal(retried.generation,2);assert.deepEqual(retried.retried,[]);
  const afterRetry=store.loadState();assert.equal(afterRetry.engine.coordination,'agent-v1');assert.equal(afterRetry.ops.find(op=>op.id==='accepted').status,'done');
  assert.deepEqual(afterRetry.decisions,current.decisions);assert.equal(afterRetry.ops.find(op=>op.id==='remaining').status,'ready');

  const nonce=`positive-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const pinnedKernel=await import(`${pathToFileURL(path.join(pin.root,'.dist','kernel','kernel.mjs')).href}?${nonce}`);
  const pinnedEngine=await import(`${pathToFileURL(path.join(pin.root,'.dist','kernel','engine.mjs')).href}?${nonce}`);
  const pinnedStoreModule=await import(`${pathToFileURL(path.join(pin.root,'.dist','kernel','store.mjs')).href}?${nonce}`);
  const pinnedStore=pinnedStoreModule.createStore({repoRoot:root,id:current.id}),engineState=pinnedStore.loadState();
  runtime=pinnedEngine.createEngineRuntime({store:pinnedStore,state:engineState,git,candidateBase:path.join(temp,'candidates'),
    eligibility:()=>({eligible:true,mode:'qualified'}),spawnChild:()=>{throw Error('the fake host owns native execution in this fixture');}});
  runtime.model=(name)=>name==='validateOp'?{ok:true,verdict:'accept',summary:'fixture validator reproduced the bounded change',findings:[],dropped:[],
    provider:'fixture-validator',complete:true,independentFromAttempt:true,freshContext:true,reviewerAttemptId:'validator-positive'}:
    {ok:true,value:{option:'continue'}};
  let managerCalls=0;runtime.manageWorkflow=snapshot=>{managerCalls+=1;return {schema:'starci/manager-decision@1',workflowId:snapshot.workflowId,generation:snapshot.generation,
    version:snapshot.version,digest:snapshot.digest,decisionId:snapshot.decisionId,basisDigest:snapshot.basisDigest,
    orderedActionIds:snapshot.actions.map(action=>action.id),rationale:'dispatch the remaining authorized operation'};};
  runtime.check=(command,options={})=>spawnSync(command,{shell:true,encoding:'utf8',windowsHide:true,...options});
  runtime.candidateCheck=(command,options={},op)=>runtime.check(command,{...options,cwd:runtime.candidateCwd(op)});
  let activeOp=null,operationJobId=null,durableSettlement=null;const beginCandidate=runtime.beginCandidate.bind(runtime);
  runtime.beginCandidate=(op,options)=>{activeOp=op;operationJobId=op.lease?.jobId??null;return beginCandidate(op,options);};
  const settleOperation=runtime.settled.bind(runtime);runtime.settled=(op,options={})=>{
    const result=settleOperation(op,options);
    if(result.ok&&options.workerOnly!==true&&op.id==='remaining'){
      const job=runtime.journal.getJob(operationJobId);
      durableSettlement={jobId:operationJobId,status:job?.status??null,leaseToken:job?.lease_token??null,
        leases:runtime.journal.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get(operationJobId).n};
    }
    return result;
  };
  const allocator={maxParallelOps:1,allocate:()=>({ok:true,runtime:'gpt-5.6-sol',target:'gpt-5.6-sol',role:'implement',
    candidate:{selection:{target:'gpt-5.6-sol',orcaLaunch:{agent:'codex',model:'gpt-5.6-sol'}}}}),
    release(){},failed(){},launched(){},deferred(){},snapshot:()=>({}),serialize:()=>({}),sharedSync:()=>({dropped:[]})};
  const dispatch='ctx-positive';let workerLive=false,deliverPending=false;
  const deliver=()=>{
    fs.writeFileSync(path.join(root,'src','app.txt'),'ready\n');
    const report=buildReport({outcome:'done',run:'run-positive',task:'task-positive',dispatch,from:'term-worker',summary:'remaining work completed',files:['src/app.txt'],
      checks:[{name:'ready-content',command:readyCheck,exitCode:0,evidence:'ready'}]});
    fs.writeFileSync(pinnedStore.reportPath(dispatch),`${JSON.stringify(report)}\n`);deliverPending=false;
  };
  const receipt=result=>({outcome:'ok',effectState:'none',receipt:{ok:true,result}}),orca={host:{name:'orca',capabilities:['design-tool'],sequential:false},
    invoke(name){
      if(name==='run-show')return receipt({run:{id:'run-positive',coordinator_handle:'term-positive'}});
      if(name==='worker-list')return receipt({workers:workerLive?[{dispatchId:dispatch,taskId:'task-positive',workerState:'unsupervised',dispatchStatus:'dispatched',agentTerminalHandle:'term-worker'}]:[]});
      if(name==='terminal-list')return receipt({terminals:workerLive?[{handle:'term-worker',title:'[Op] backend.implement - remaining',worktreePath:root,status:'running'}]:[]});
      if(name==='task-list')return receipt({tasks:workerLive?[{id:'task-positive',display_name:'[Op] backend.implement - remaining'}]:[]});
      if(name==='worker-stop')return receipt({state:'stopped'});
      if(name==='worker-release'){workerLive=false;return receipt({state:'released',processAction:'none'});}
      if(name==='terminal-close')return receipt({state:'closed'});
      if(name==='terminal-read')return receipt({terminal:{handle:'term-worker',status:'running',tail:['worker completing bounded change']}});
      if(name==='check'){if(workerLive&&deliverPending)deliver();return receipt({messages:[]});}
      if(name==='send')return receipt({message:{id:'msg-positive'}});
      throw Error(`Unexpected fake Orca call: ${name}`);
    }};
  const guards={protectedPaths:()=>[],revertProtected:()=>({reverted:[],removed:[]}),resourceLocks:()=>[],resourcesClash:()=>false,
    gitQueue:fn=>fn(),preflight:()=>({ok:true,fixes:[],problems:[]}),parseSharedChangePaths:()=>[]};
  const launch=()=>{
    assert.equal(activeOp?.id,'remaining');
    workerLive=true;deliverPending=true;
    return {ok:true,effectState:'committed',selection:{target:'gpt-5.6-sol'},task:{id:'task-positive'},dispatchId:dispatch,terminal:'term-worker'};
  };
  let clock=Date.now();const now=()=>{clock+=1000;return clock;},wait=ms=>{clock+=Math.max(0,Number(ms)||0);};
  const finished=pinnedKernel.kernelMain('workflow-run',{id:current.id,from:'term-positive',run:'run-positive','max-iterations':'8'},
    {orca,cwd:root,wait,functions:{engineRuntime:runtime,allocator,launch,guards,git,reconcileInputs:()=>{},refreshPreparation:()=>{},deferPreparation:()=>false,
      now,wait,waitTimeoutMs:5000,tickMs:1000,pollMs:1000}});
  assert.equal(finished.id,current.id);assert.equal(finished.finished?.outcome,'done');
  const final=pinnedStore.loadState();assert.equal(final.engine.generation,2);assert.equal(final.engine.coordination,'agent-v1');assert.ok(managerCalls>0);
  assert.deepEqual(final.engine.manager.lastActions,['dispatch:remaining']);assert.equal(final.ops.find(op=>op.id==='accepted').status,'done');
  assert.equal(final.ops.find(op=>op.id==='accepted').reports[0].summary,'accepted before checkpoint');
  const completed=final.ops.find(op=>op.id==='remaining');assert.equal(completed.status,'done',JSON.stringify({finished,remaining:completed,needUser:final.needUser,events:pinnedStore.readEvents().slice(-40)}));
  assert.equal(completed.dispatch,dispatch);assert.equal(completed.terminal,null);assert.equal(completed.lease,undefined);assert.equal(workerLive,false);
  assert.equal(completed.candidate?.status,'sealed');assert.equal(completed.candidate?.identity?.jobId,operationJobId);assert.deepEqual(final.decisions,current.decisions.map(decision=>({...decision,goalRev:1})));
  assert.deepEqual(durableSettlement,{jobId:operationJobId,status:'succeeded',leaseToken:null,leases:0});
  const settledJournal=openJournal({file:journalFile});
  try{
    assert.equal(settledJournal.getJob(operationJobId)??null,null);
    assert.equal(settledJournal.db.prepare('SELECT count(*) AS n FROM leases WHERE job_id=?').get(operationJobId).n,0);
    assert.deepEqual(settledJournal.liveRows(current.id),{leases:[],jobs:[]});
  }finally{settledJournal.close();}
  assert.equal(fs.readFileSync(path.join(root,'src','app.txt'),'utf8'),'ready\n');
  assert.ok(pinnedStore.readEvents().some(event=>event.event==='run-resumed'));
  assert.ok(pinnedStore.readEvents().some(event=>event.event==='workflow-retried'));
});
