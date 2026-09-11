import test from 'node:test';
import assert from 'node:assert/strict';
import {
  acceptOrcaWorkerDone,
  createArchitectureSidearm,
  createConflictOwner,
  integrateOrcaArchitectureSidearm,
  integrateOrcaSharedChange,
  planOrcaExecution,
  startOrcaExecution,
  validateWorkerDone
} from '../execution/orca.mjs';

const selection=(provider='openai',model='gpt-5.6-sol')=>({provider,model,effort:'high',orcaLaunch:{kind:'managed-agent',agent:'codex'}});
const request=()=>({
  id:'release-widget',mode:'orchestrated',controlPlane:'orca',operations:[
    {id:'prepare',operation:'workspace.manage',spec:'Prepare inputs',dependsOn:[],allowedFiles:['work/prepare/**'],selection:selection()},
    {id:'backend',operation:'backend.implement',spec:'Implement backend',dependsOn:['prepare'],allowedFiles:['services/api/**'],selection:selection()},
    {id:'frontend',operation:'interface.implement',spec:'Implement frontend',dependsOn:['prepare'],allowedFiles:['apps/web/**'],selection:selection('anthropic','claude-opus-4-1')},
    {id:'backend-review',operation:'review.verify',spec:'Review backend',dependsOn:['backend'],allowedFiles:['reviews/backend.md'],selection:selection()}
  ]
});

function fakeOrca(){
  let tasks=0,dispatches=0;
  const calls={runs:[],tasks:[],dispatches:[],stops:[],releases:[],integrations:[]};
  return {calls,adapter:{
    async createRun(input){calls.runs.push(input);return {runId:'run-1'};},
    async createTask(input){calls.tasks.push(structuredClone(input));return {taskId:`task-${++tasks}`};},
    async dispatchWorker(input){calls.dispatches.push(structuredClone(input));return {dispatchId:`dispatch-${++dispatches}`};},
    async stopWorker(input){calls.stops.push(structuredClone(input));return {status:'stopped'};},
    async releaseWorker(input){calls.releases.push(structuredClone(input));return {status:'released'};},
    async integrateChange(input){calls.integrations.push(structuredClone(input));return {status:'integrated'};}
  }};
}

const done=(operation,outcome='succeeded',files=[])=>{
  const attempt=operation.attempts.at(-1);
  return {type:'worker_done',taskId:attempt.taskId,dispatchId:attempt.dispatchId,operationId:operation.id,outcome,filesModified:files};
};

test('orchestrated requests fail closed unless Orca is the control plane and every operation supplies provider/model scope',()=>{
  for(const controlPlane of [undefined,'native-team','generic-subagents']){
    const input=request();input.controlPlane=controlPlane;
    assert.throws(()=>planOrcaExecution(input),/Orca control plane/);
  }
  const solo=request();solo.mode='solo';assert.throws(()=>planOrcaExecution(solo),/orchestrated mode/);
  const noModel=request();delete noModel.operations[1].selection.model;
  assert.throws(()=>planOrcaExecution(noModel),/model selection/);
  const plan=planOrcaExecution(request());
  assert.deepEqual(plan.coordinator,{role:'coordinator',implementsChanges:false,owns:['ownership','review','integration']});
  assert.equal(plan.operations.frontend.selection.provider,'anthropic');
});

test('one coordinator starts only ready Task/Dispatch workers in unique isolated worktrees with no Git integration authority',async()=>{
  const {adapter,calls}=fakeOrca();const plan=await startOrcaExecution({request:request(),adapter});
  assert.equal(calls.runs.length,1);assert.equal(calls.tasks.length,1);assert.equal(calls.dispatches.length,1);
  assert.equal(plan.operations.prepare.status,'dispatched');assert.equal(plan.operations.backend.status,'pending');
  assert.equal(calls.dispatches[0].worktree.kind,'new-child');assert.equal(calls.dispatches[0].worktree.isolated,true);
  assert.deepEqual(calls.dispatches[0].permissions,{merge:false,rebase:false,cherryPick:false,push:false});
  assert.match(calls.dispatches[0].prompt,/Do not merge, rebase, cherry-pick, or push/);
});

test('completion validates exact Dispatch identity and allowlisted file outcomes before releasing dependent branches',async()=>{
  const {adapter,calls}=fakeOrca();let plan=await startOrcaExecution({request:request(),adapter});
  const prepare=plan.operations.prepare;
  assert.throws(()=>validateWorkerDone({...prepare.attempts[0],operationId:'prepare'},{...done(prepare),dispatchId:'other'}),/does not belong/);
  await assert.rejects(()=>acceptOrcaWorkerDone({plan,event:done(prepare,'succeeded',['README.md']),adapter}),/Out-of-scope/);
  plan=await acceptOrcaWorkerDone({plan,event:done(prepare,'succeeded',['work/prepare/context.yaml']),adapter});
  assert.equal(plan.operations.backend.status,'dispatched');assert.equal(plan.operations.frontend.status,'dispatched');
  assert.equal(plan.operations['backend-review'].status,'pending');assert.equal(calls.dispatches.length,3);
  assert.equal(calls.releases.length,1);assert.equal(calls.releases[0].dispatchId,prepare.attempts[0].dispatchId);
  assert.notEqual(plan.operations.backend.attempts[0].worktree.name,plan.operations.frontend.attempts[0].worktree.name);
  assert.equal(calls.dispatches.find(call=>call.operationId==='backend').input.schema,'starci/operation-input@1');
  assert.equal(calls.dispatches.find(call=>call.operationId==='backend').input.dependencyOutputs[0].operationId,'prepare');
  assert.equal(calls.dispatches.find(call=>call.operationId==='backend').input.dependencyOutputs[0].output.schema,'starci/operation-output@1');
  assert.equal(plan.operations.prepare.output.operationId,'prepare');
});

test('a shared out-of-scope escalation creates an authorized conflict-owner Task while unrelated work remains runnable',async()=>{
  const {adapter,calls}=fakeOrca();let plan=await startOrcaExecution({request:request(),adapter});
  plan=await acceptOrcaWorkerDone({plan,event:done(plan.operations.prepare,'succeeded',['work/prepare/context.yaml']),adapter});
  const backend=plan.operations.backend,attempt=backend.attempts[0];
  plan=await createConflictOwner({
    plan,adapter,selection:selection(),
    event:{type:'escalation',reason:'out-of-scope-shared-change',operationId:'backend',taskId:attempt.taskId,dispatchId:attempt.dispatchId,files:['packages/contracts/widget.ts']},
    decision:{action:'create-conflict-owner',affectedOperations:['backend'],allowedFiles:['packages/contracts/**'],spec:'Own the widget contract change'}
  });
  assert.equal(plan.operations.backend.status,'waiting-conflict');
  assert.equal(plan.operations['backend-review'].status,'waiting-conflict');
  assert.equal(plan.operations.frontend.status,'dispatched');
  assert.equal(plan.conflicts['conflict-1'].status,'dispatched');
  assert.equal(calls.stops.length,1);assert.equal(calls.stops[0].dispatchId,attempt.dispatchId);
  assert.equal(calls.tasks.at(-1).kind,'conflict-owner');
  assert.deepEqual(calls.dispatches.at(-1).permissions,{merge:false,rebase:false,cherryPick:false,push:false});
});

test('conflict outcomes are scoped, then coordinator integration creates explicit sync/resume dependencies and a fresh worker',async()=>{
  const {adapter,calls}=fakeOrca();let plan=await startOrcaExecution({request:request(),adapter});
  plan=await acceptOrcaWorkerDone({plan,event:done(plan.operations.prepare,'succeeded',['work/prepare/context.yaml']),adapter});
  const firstBackend=plan.operations.backend.attempts[0];
  plan=await createConflictOwner({plan,adapter,selection:selection(),event:{type:'escalation',reason:'out-of-scope-shared-change',operationId:'backend',taskId:firstBackend.taskId,dispatchId:firstBackend.dispatchId,sharedFiles:['packages/contracts/widget.ts']},decision:{action:'create-conflict-owner',affectedOperations:['backend'],allowedFiles:['packages/contracts/**']}});
  const conflict=plan.conflicts['conflict-1'];
  await assert.rejects(()=>acceptOrcaWorkerDone({plan,adapter,event:{type:'worker_done',taskId:conflict.taskId,dispatchId:conflict.dispatchId,operationId:'conflict-1',outcome:'succeeded',filesModified:['services/api/escape.ts']}}),/Out-of-scope/);
  plan=await acceptOrcaWorkerDone({plan,adapter,event:{type:'worker_done',taskId:conflict.taskId,dispatchId:conflict.dispatchId,operationId:'conflict-1',outcome:'succeeded',filesModified:['packages/contracts/widget.ts']}});
  assert.equal(plan.conflicts['conflict-1'].status,'awaiting-review');
  await assert.rejects(()=>integrateOrcaSharedChange({plan,conflictId:'conflict-1',decision:{review:'rejected'},adapter}),/explicitly accept/);
  plan=await integrateOrcaSharedChange({plan,conflictId:'conflict-1',decision:{review:'accepted',integration:'integrate',notes:'Contract reviewed'},adapter});
  assert.equal(calls.integrations.length,1);assert.equal(calls.integrations[0].performedBy,'coordinator');
  assert.equal(calls.stops.length,1);assert.equal(calls.stops[0].dispatchId,firstBackend.dispatchId);
  assert.equal(calls.releases.at(-1).dispatchId,conflict.dispatchId);
  assert.equal(plan.operations.backend.status,'dispatched');assert.equal(plan.operations.backend.attempts.length,2);
  assert.equal(plan.operations.backend.attempts[0].status,'superseded');
  assert.ok(plan.operations.backend.sharedDependencies.includes(conflict.taskId));
  const resumeTask=calls.tasks.find(task=>task.kind==='resume-operation');
  assert.ok(resumeTask.deps.includes(conflict.taskId));
  assert.deepEqual(plan.events.at(-1).syncResumeDependencies,[
    {operationId:'backend',dependsOnTaskId:conflict.taskId},
    {operationId:'backend-review',dependsOnTaskId:conflict.taskId}
  ]);
  assert.equal(plan.operations.frontend.attempts.length,1,'unrelated worker was not restarted');
});

test('implementation SDS gap creates a separate architecture sidearm and resumes only the affected branch after review',async()=>{
  const {adapter,calls}=fakeOrca();let plan=await startOrcaExecution({request:request(),adapter});
  plan=await acceptOrcaWorkerDone({plan,event:done(plan.operations.prepare,'succeeded',['work/prepare/context.yaml']),adapter});
  const firstBackend=plan.operations.backend.attempts[0],event={type:'secondary_request',reason:'sds-technical-gap',secondaryOp:'architecture.decide',operationId:'backend',taskId:firstBackend.taskId,dispatchId:firstBackend.dispatchId,problem:'Missing recovery result mapping'};
  const decision={action:'create-architecture-sidearm',allowedFiles:['.starciwork/features/agentos/architecture/sds/contracts/recovery/index.yaml'],businessChanged:false,srsChanged:false,sourceChanged:false};
  await assert.rejects(()=>createArchitectureSidearm({plan,event,decision:{...decision,businessChanged:true},selection:selection(),adapter}),/cannot change business/);
  await assert.rejects(()=>createArchitectureSidearm({plan,event,decision:{...decision,allowedFiles:['.starciwork/features/agentos/architecture/**']},selection:selection(),adapter}),/exact architecture index.yaml/);
  plan=await createArchitectureSidearm({plan,event,decision,selection:selection('openai','gpt-5.6-sol'),adapter});
  assert.equal(plan.operations.backend.status,'waiting-sidearm');
  assert.equal(plan.operations['backend-review'].status,'waiting-sidearm');
  assert.equal(plan.operations.frontend.status,'dispatched');
  const sidearm=plan.sidearms['architecture-1'];
  assert.equal(sidearm.operator,'architecture.decide');
  assert.equal(calls.tasks.at(-1).kind,'secondary-operation');
  assert.deepEqual(calls.dispatches.at(-1).permissions,{merge:false,rebase:false,cherryPick:false,push:false});
  plan=await acceptOrcaWorkerDone({plan,adapter,event:{type:'worker_done',taskId:sidearm.taskId,dispatchId:sidearm.dispatchId,operationId:sidearm.id,outcome:'succeeded',filesModified:decision.allowedFiles}});
  assert.equal(plan.sidearms['architecture-1'].status,'awaiting-review');
  plan=await integrateOrcaArchitectureSidearm({plan,sidearmId:'architecture-1',decision:{review:'accepted',integration:'integrate',businessChanged:false,srsChanged:false,sourceChanged:false},adapter});
  assert.equal(plan.sidearms['architecture-1'].status,'integrated');
  assert.equal(calls.integrations.at(-1).kind,'architecture-sidearm');
  assert.equal(plan.operations.backend.status,'dispatched');
  assert.equal(plan.operations.backend.attempts.length,2);
  assert.ok(calls.tasks.find(task=>task.kind==='resume-operation').deps.includes(sidearm.taskId));
  assert.equal(plan.operations.frontend.attempts.length,1,'unrelated implementation stays on its original worktree');
});

test('a failed branch blocks only its dependents, not independent dispatched work',async()=>{
  const {adapter}=fakeOrca();let plan=await startOrcaExecution({request:request(),adapter});
  plan=await acceptOrcaWorkerDone({plan,event:done(plan.operations.prepare,'succeeded',['work/prepare/context.yaml']),adapter});
  plan=await acceptOrcaWorkerDone({plan,event:done(plan.operations.backend,'failed',['services/api/widget.ts']),adapter});
  assert.equal(plan.operations.backend.status,'failed');assert.equal(plan.operations['backend-review'].status,'blocked');
  assert.equal(plan.operations.frontend.status,'dispatched');
});
