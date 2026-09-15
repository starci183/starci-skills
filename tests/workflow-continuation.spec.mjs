import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createStore,WORKFLOW_STATE} from '../kernel/store.mjs';
import {buildContinuationBrief,continuationBoundary,exportContinuationBrief} from '../kernel/continuation.mjs';
import {createWorkflowState,kernelMain} from '../kernel/kernel.mjs';
import {openJournal} from '../kernel/journal.mjs';
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
