const PLAN_SCHEMA='starci/orca-execution-plan@1';
const TERMINAL=new Set(['completed','failed','blocked']);

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const copy=value=>structuredClone(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const text=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const idOf=(receipt,...keys)=>{
  need(plain(receipt),'Invalid Orca adapter receipt');
  for(const key of keys)if(typeof receipt[key]==='string'&&receipt[key])return receipt[key];
  throw Error(`Orca adapter receipt is missing ${keys.join(' or ')}`);
};
const slug=value=>value.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,38)||'operation';
const worktreeName=(plan,operation,attempt)=>`starci-${slug(operation.id).slice(0,20)}-${operation.index}-${attempt}`;

function controlPlane(request){return request.controlPlane??request.execution?.controlPlane;}
function executionMode(request){return request.mode??request.execution?.mode;}
function dependencies(operation){return operation.dependsOn??operation.dependencies??[];}
function allowlist(operation){return operation.allowedFiles??operation.fileAllowlist??operation.scope?.allowedFiles;}
function selection(operation){return operation.selection??operation.executionSelection;}
function operatorOf(operation){return operation.operation??operation.operator??null;}

function safePattern(value){
  need(typeof value==='string'&&value.length>0&&!value.includes('\\'),'Invalid file allowlist entry');
  need(!value.startsWith('/')&&!/^[A-Za-z]:/.test(value),'File allowlist entries must be relative');
  const segments=value.split('/');
  need(!segments.some(part=>!part||part==='.'||part==='..'),'Unsafe file allowlist entry');
  need(segments.every(part=>part==='*'||part==='**'||!part.includes('*')),'Only whole-segment * and ** wildcards are supported');
  return value;
}

function safeFile(value){
  need(typeof value==='string'&&value.length>0&&!value.includes('\\'),'Invalid modified file');
  need(!value.startsWith('/')&&!/^[A-Za-z]:/.test(value),'Modified files must be relative');
  need(!value.split('/').some(part=>!part||part==='.'||part==='..'),'Unsafe modified file');
  return value;
}

function matches(pattern,file){
  const p=pattern.split('/'),f=file.split('/');
  const visit=(pi,fi)=>{
    if(pi===p.length)return fi===f.length;
    if(p[pi]==='**')return visit(pi+1,fi)||(fi<f.length&&visit(pi,fi+1));
    return fi<f.length&&(p[pi]==='*'||p[pi]===f[fi])&&visit(pi+1,fi+1);
  };
  return visit(0,0);
}

/** Validate an exact worker_done identity and its reported writes against the worker allowlist. */
export function validateWorkerDone(worker,event){
  need(plain(worker)&&plain(event),'Invalid worker_done');
  need(event.type==='worker_done','Expected worker_done');
  need(worker.taskId===event.taskId&&worker.dispatchId===event.dispatchId,'worker_done does not belong to this Task and Dispatch');
  need(event.outcome==='succeeded'||event.outcome==='failed','worker_done needs an explicit outcome');
  const files=event.filesModified??event.files??[];
  need(Array.isArray(files),'worker_done filesModified must be an array');
  const normalized=files.map(safeFile);
  need(new Set(normalized).size===normalized.length,'worker_done contains duplicate files');
  const allowed=(worker.allowedFiles??[]).map(safePattern);
  const outside=normalized.filter(file=>!allowed.some(pattern=>matches(pattern,file)));
  need(!outside.length,`Out-of-scope worker outcome: ${outside.join(', ')}`);
  if(event.operationId!==undefined)need(event.operationId===worker.operationId,'worker_done reports the wrong operation');
  return {...copy(event),filesModified:normalized};
}

function validateSelection(value,operationId){
  need(plain(value),`Operation ${operationId} needs an Orca execution selection`);
  const provider=text(value.provider,`provider selection for ${operationId}`);
  const model=text(value.model??value.requestedModel,`model selection for ${operationId}`);
  if(value.effort!==undefined)text(value.effort,`effort selection for ${operationId}`);
  return {...copy(value),provider,model,requestedModel:value.requestedModel??model};
}

function validateRequest(request){
  need(plain(request),'Invalid WorkflowRequest');
  need(executionMode(request)==='orchestrated','Orca adapter requires orchestrated mode');
  need(controlPlane(request)==='orca','Orchestrated execution requires the Orca control plane');
  need(Array.isArray(request.operations)&&request.operations.length>0,'WorkflowRequest needs ordered operations');
  const ids=new Set(),operations=[];
  for(const [index,input] of request.operations.entries()){
    need(plain(input),'Invalid workflow operation');
    const id=text(input.id,'operation id');need(!ids.has(id),'Duplicate operation id');ids.add(id);
    const deps=dependencies(input);need(Array.isArray(deps)&&new Set(deps).size===deps.length,`Invalid dependencies for ${id}`);
    const allowed=allowlist(input);need(Array.isArray(allowed)&&allowed.length>0,`Operation ${id} needs a file allowlist`);
    operations.push({input,id,index,deps:[...deps],allowedFiles:allowed.map(safePattern),selection:validateSelection(selection(input),id),operator:operatorOf(input)});
  }
  for(const op of operations){
    for(const dep of op.deps)need(ids.has(dep)&&operations.find(x=>x.id===dep).index<op.index,`Operation ${op.id} has an unknown or forward dependency`);
  }
  return operations;
}

/** Build the effect-free coordinator/worker plan. No CLI or repository command is run here. */
export function planOrcaExecution(request){
  const operations=validateRequest(request),workflowId=text(request.id??request.workflowId,'workflow request id');
  return {
    schema:PLAN_SCHEMA,workflowId,controlPlane:'orca',status:'planned',runId:null,
    coordinator:{role:'coordinator',implementsChanges:false,owns:['ownership','review','integration']},
    operations:Object.fromEntries(operations.map(op=>[op.id,{
      id:op.id,index:op.index,spec:op.input.spec??op.input.prompt??op.id,dependsOn:op.deps,
      operator:op.operator,allowedFiles:op.allowedFiles,selection:op.selection,status:op.deps.length?'pending':'ready',
      attempts:[],sharedDependencies:[],blockedBy:[]
    }])),
    order:operations.map(op=>op.id),conflicts:{},sidearms:{},events:[]
  };
}

function adapterMethod(adapter,name){need(plain(adapter)&&typeof adapter[name]==='function',`Orca adapter method ${name} is required`);return adapter[name].bind(adapter);}
function operationTaskDeps(plan,operation){
  const ids=[];
  for(const dep of operation.dependsOn){
    const attempt=plan.operations[dep].attempts.at(-1);need(attempt?.taskId,`Missing completed Task for dependency ${dep}`);ids.push(attempt.taskId);
  }
  ids.push(...operation.sharedDependencies);
  return [...new Set(ids)];
}
function workerPrompt(operation,{resume=false}={}){
  return `${resume?'Resume':'Execute'} operation ${operation.id} within only: ${operation.allowedFiles.join(', ')}. `+
    'Do not merge, rebase, cherry-pick, or push. Report worker_done exactly once with the Task/Dispatch IDs and every modified file.';
}

async function dispatchOperation(plan,operationId,adapter,{resume=false}={}){
  const operation=plan.operations[operationId],attemptNumber=operation.attempts.length+1;
  const createTask=adapterMethod(adapter,'createTask'),dispatchWorker=adapterMethod(adapter,'dispatchWorker');
  const taskReceipt=await createTask({
    runId:plan.runId,kind:resume?'resume-operation':'operation',operationId,
    title:`${resume?'Resume ':'Operation '}${operationId}`,spec:`${operation.spec}\n${workerPrompt(operation,{resume})}`,
    deps:operationTaskDeps(plan,operation),allowedFiles:copy(operation.allowedFiles),selection:copy(operation.selection)
  });
  const taskId=idOf(taskReceipt,'taskId','id');
  const worktree={kind:'new-child',name:worktreeName(plan,operation,attemptNumber),isolated:true};
  const dispatchReceipt=await dispatchWorker({
    runId:plan.runId,taskId,operationId,worktree,selection:copy(operation.selection),
    prompt:workerPrompt(operation,{resume}),permissions:{merge:false,rebase:false,cherryPick:false,push:false}
  });
  const dispatchId=idOf(dispatchReceipt,'dispatchId','id');
  operation.attempts.push({taskId,dispatchId,attempt:attemptNumber,worktree,allowedFiles:copy(operation.allowedFiles),status:'dispatched'});
  operation.status='dispatched';operation.blockedBy=[];
}

function refreshReadiness(plan){
  for(const id of plan.order){
    const op=plan.operations[id];
    if(op.status!=='pending'&&op.status!=='ready')continue;
    const failed=op.dependsOn.find(dep=>['failed','blocked'].includes(plan.operations[dep].status));
    if(failed){op.status='blocked';op.blockedBy=[failed];continue;}
    const waiting=op.dependsOn.filter(dep=>plan.operations[dep].status!=='completed');
    if(!waiting.length&&!op.blockedBy.length)op.status='ready';
  }
}

/** Dispatch every currently independent operation; unrelated branches stay runnable. */
export async function dispatchReadyOrcaOperations(plan,adapter){
  need(plan?.schema===PLAN_SCHEMA&&plan.runId,'Started Orca plan required');
  const next=copy(plan);refreshReadiness(next);
  const ready=next.order.filter(id=>next.operations[id].status==='ready');
  for(const id of ready)await dispatchOperation(next,id,adapter);
  next.status=next.order.every(id=>TERMINAL.has(next.operations[id].status))?'completed':'running';
  return next;
}

/** Create the Orca Run, then Task+Dispatch pairs for the first runnable wave. */
export async function startOrcaExecution({request,adapter}){
  let plan=planOrcaExecution(request);
  const receipt=await adapterMethod(adapter,'createRun')({objective:`Execute StarCi workflow ${plan.workflowId}`,controlPlane:'orca'});
  plan.runId=idOf(receipt,'runId','id');plan.status='running';
  return dispatchReadyOrcaOperations(plan,adapter);
}

function descendants(plan,roots){
  const affected=new Set(roots);let changed=true;
  while(changed){changed=false;for(const id of plan.order)if(!affected.has(id)&&plan.operations[id].dependsOn.some(dep=>affected.has(dep))){affected.add(id);changed=true;}}
  return affected;
}

/**
 * Turn an out-of-scope shared-change escalation into a coordinator-authorized conflict owner.
 * The decision is explicit input; the coordinator never edits the fix itself.
 */
export async function createConflictOwner({plan,event,decision,selection:ownerSelection,adapter}){
  need(plan?.schema===PLAN_SCHEMA&&plain(event)&&event.type==='escalation','Invalid shared-change escalation');
  need(event.reason==='out-of-scope-shared-change','Escalation is not a shared-change ownership request');
  const source=plan.operations[event.operationId];need(source,'Unknown escalating operation');
  const active=source.attempts.at(-1);need(active&&active.taskId===event.taskId&&active.dispatchId===event.dispatchId,'Escalation does not belong to the active Dispatch');
  need(plain(decision)&&decision.action==='create-conflict-owner','Coordinator must explicitly assign a conflict owner');
  const sharedFiles=(event.files??event.sharedFiles??[]).map(safeFile);need(sharedFiles.length,'Shared-change escalation needs exact files');
  need(sharedFiles.some(file=>!source.allowedFiles.some(pattern=>matches(pattern,file))),'Escalated change is already inside the worker allowlist');
  const ownerFiles=(decision.allowedFiles??[]).map(safePattern);need(ownerFiles.length&&sharedFiles.every(file=>ownerFiles.some(pattern=>matches(pattern,file))),'Conflict owner allowlist must cover every shared file');
  const requested=decision.affectedOperations??[source.id];need(Array.isArray(requested)&&requested.includes(source.id),'Affected operations must include the escalating operation');
  for(const id of requested)need(plan.operations[id],`Unknown affected operation ${id}`);
  const affected=descendants(plan,requested),next=copy(plan),conflictId=`conflict-${Object.keys(next.conflicts).length+1}`;
  const stopWorker=adapterMethod(adapter,'stopWorker');
  for(const id of affected){
    const op=next.operations[id];
    if(op.status!=='completed'&&!['failed','blocked'].includes(op.status)){
      op.blockedBy=[...new Set([...op.blockedBy,conflictId])];
      if(op.status==='dispatched'){
        const attempt=op.attempts.at(-1);
        await stopWorker({runId:next.runId,taskId:attempt.taskId,dispatchId:attempt.dispatchId,reason:'paused-for-shared-change'});
        attempt.status='superseded';
      }
      if(op.status==='dispatched'||op.status==='ready'||op.status==='pending')op.status='waiting-conflict';
    }
  }
  const selected=validateSelection(ownerSelection,conflictId),createTask=adapterMethod(adapter,'createTask'),dispatchWorker=adapterMethod(adapter,'dispatchWorker');
  const upstream=source.dependsOn.map(id=>next.operations[id].attempts.at(-1)?.taskId).filter(Boolean);
  const taskReceipt=await createTask({runId:next.runId,kind:'conflict-owner',parentTaskId:active.taskId,title:`Shared change owner: ${sharedFiles.join(', ')}`,spec:decision.spec??`Implement the authorized shared change in ${sharedFiles.join(', ')}`,deps:upstream,allowedFiles:ownerFiles,selection:selected});
  const taskId=idOf(taskReceipt,'taskId','id'),worktree={kind:'new-child',name:slug(`${next.workflowId}-${conflictId}`),isolated:true};
  const dispatchReceipt=await dispatchWorker({runId:next.runId,taskId,conflictId,worktree,selection:selected,prompt:`Implement only the coordinator-authorized shared change: ${sharedFiles.join(', ')}. Do not merge, rebase, cherry-pick, or push.`,permissions:{merge:false,rebase:false,cherryPick:false,push:false}});
  const dispatchId=idOf(dispatchReceipt,'dispatchId','id');
  next.conflicts[conflictId]={id:conflictId,sourceOperationId:source.id,sharedFiles,allowedFiles:ownerFiles,affectedOperations:[...affected],selection:selected,status:'dispatched',taskId,dispatchId,worktree,review:null,integration:null};
  next.events.push({type:'conflict-owner-created',conflictId,taskId,dispatchId});
  return next;
}

function exactSdsFiles(values){
  const files=values.map(safePattern);
  need(files.length&&files.every(file=>!file.includes('*')&&file.startsWith('.starciwork/')&&file.includes('/architecture/')&&file.endsWith('/index.yaml')),'Architecture sidearm allowlist must contain exact architecture index.yaml paths');
  return files;
}

/** Pause one implementation branch and create its separately owned architecture.decide SDS worker. */
export async function createArchitectureSidearm({plan,event,decision,selection:architectureSelection,adapter}){
  need(plan?.schema===PLAN_SCHEMA&&plain(event)&&event.type==='secondary_request','Invalid architecture secondary request');
  need(event.reason==='sds-technical-gap'&&event.secondaryOp==='architecture.decide','Secondary request is not an architecture SDS correction');
  const source=plan.operations[event.operationId];need(source,'Unknown requesting operation');
  need(['backend.implement','interface.implement'].includes(source.operator),'Only implementation operators may request the architecture sidearm');
  const active=source.attempts.at(-1);need(active&&active.taskId===event.taskId&&active.dispatchId===event.dispatchId,'Secondary request does not belong to the active Dispatch');
  need(plain(decision)&&decision.action==='create-architecture-sidearm','Coordinator must assign the architecture sidearm');
  need(decision.businessChanged===false&&decision.srsChanged===false&&decision.sourceChanged===false,'Architecture sidearm cannot change business, SRS or product source');
  const allowedFiles=exactSdsFiles(decision.allowedFiles??[]),next=copy(plan),sidearmId=`architecture-${Object.keys(next.sidearms??{}).length+1}`;
  const affected=descendants(next,[source.id]),stopWorker=adapterMethod(adapter,'stopWorker');
  for(const id of affected){
    const op=next.operations[id];op.blockedBy=[...new Set([...op.blockedBy,sidearmId])];
    if(op.status==='dispatched'){
      const attempt=op.attempts.at(-1);
      await stopWorker({runId:next.runId,taskId:attempt.taskId,dispatchId:attempt.dispatchId,reason:'paused-for-architecture-sidearm'});
      attempt.status='superseded';
    }
    if(['dispatched','ready','pending'].includes(op.status))op.status='waiting-sidearm';
  }
  const selected=validateSelection(architectureSelection,sidearmId),createTask=adapterMethod(adapter,'createTask'),dispatchWorker=adapterMethod(adapter,'dispatchWorker');
  const upstream=source.dependsOn.map(id=>next.operations[id].attempts.at(-1)?.taskId).filter(Boolean);
  const taskReceipt=await createTask({runId:next.runId,kind:'secondary-operation',role:'implementation.architecture',operator:'architecture.decide',parentTaskId:active.taskId,title:`Architecture sidearm for ${source.id}`,spec:decision.spec??event.problem??'Correct the selected SDS technical gap without changing business or SRS.',deps:upstream,allowedFiles,selection:selected});
  const taskId=idOf(taskReceipt,'taskId','id'),worktree={kind:'new-child',name:slug(`${next.workflowId}-${sidearmId}`),isolated:true};
  const prompt='Run architecture.decide for only the selected SDS index.yaml files. Preserve business and SRS, write Vietnamese natural-language prose with English identifiers, store no source paths/symbols/evidence, edit no product source, call no secondary, and do not merge, rebase, cherry-pick, or push.';
  const dispatchReceipt=await dispatchWorker({runId:next.runId,taskId,sidearmId,operator:'architecture.decide',role:'implementation.architecture',worktree,selection:selected,prompt,permissions:{merge:false,rebase:false,cherryPick:false,push:false}});
  const dispatchId=idOf(dispatchReceipt,'dispatchId','id');
  next.sidearms[sidearmId]={id:sidearmId,sourceOperationId:source.id,operator:'architecture.decide',role:'implementation.architecture',allowedFiles,affectedOperations:[...affected],selection:selected,status:'dispatched',taskId,dispatchId,worktree,review:null,integration:null};
  next.events.push({type:'architecture-sidearm-created',sidearmId,sourceOperationId:source.id,taskId,dispatchId});
  return next;
}

function activeWorker(plan,event){
  for(const id of plan.order){const op=plan.operations[id],attempt=op.attempts.at(-1);if(attempt?.taskId===event.taskId&&attempt?.dispatchId===event.dispatchId)return {kind:'operation',operation:op,attempt};}
  for(const conflict of Object.values(plan.conflicts))if(conflict.taskId===event.taskId&&conflict.dispatchId===event.dispatchId)return {kind:'conflict',conflict,worker:{...conflict,operationId:conflict.id}};
  for(const sidearm of Object.values(plan.sidearms??{}))if(sidearm.taskId===event.taskId&&sidearm.dispatchId===event.dispatchId)return {kind:'sidearm',sidearm,worker:{...sidearm,operationId:sidearm.id}};
  throw Error('worker_done is outside this Orca execution plan');
}

/** Accept an allowlisted completion and dispatch only newly unblocked ordinary work. */
export async function acceptOrcaWorkerDone({plan,event,adapter}){
  const next=copy(plan),found=activeWorker(next,event);
  if(found.kind==='sidearm'){
    const done=validateWorkerDone(found.worker,event);found.sidearm.status=done.outcome==='succeeded'?'awaiting-review':'failed';found.sidearm.filesModified=done.filesModified;
    await adapterMethod(adapter,'releaseWorker')({runId:next.runId,taskId:event.taskId,dispatchId:event.dispatchId,outcome:done.outcome});
    if(done.outcome==='failed')for(const id of found.sidearm.affectedOperations)next.operations[id].status='blocked';
    return next;
  }
  if(found.kind==='conflict'){
    const done=validateWorkerDone(found.worker,event);found.conflict.status=done.outcome==='succeeded'?'awaiting-review':'failed';found.conflict.filesModified=done.filesModified;
    await adapterMethod(adapter,'releaseWorker')({runId:next.runId,taskId:event.taskId,dispatchId:event.dispatchId,outcome:done.outcome});
    if(done.outcome==='failed')for(const id of found.conflict.affectedOperations){next.operations[id].status='blocked';}
    return next;
  }
  const done=validateWorkerDone({...found.attempt,operationId:found.operation.id},event);
  await adapterMethod(adapter,'releaseWorker')({runId:next.runId,taskId:event.taskId,dispatchId:event.dispatchId,outcome:done.outcome});
  found.attempt.status=done.outcome==='succeeded'?'completed':'failed';found.attempt.filesModified=done.filesModified;
  found.operation.status=found.attempt.status;
  next.events.push({type:'worker-completed',operationId:found.operation.id,outcome:done.outcome});
  refreshReadiness(next);
  return dispatchReadyOrcaOperations(next,adapter);
}

/** Integrate a reviewed SDS-only sidearm and resume only its affected implementation branch. */
export async function integrateOrcaArchitectureSidearm({plan,sidearmId,decision,adapter}){
  const next=copy(plan),sidearm=next.sidearms?.[sidearmId];need(sidearm?.status==='awaiting-review','Architecture sidearm result is not ready for review');
  need(plain(decision)&&decision.review==='accepted'&&decision.integration==='integrate','Coordinator must explicitly accept and integrate the architecture sidearm');
  need(decision.businessChanged===false&&decision.srsChanged===false&&decision.sourceChanged===false,'Architecture review cannot accept business, SRS or product-source changes');
  await adapterMethod(adapter,'integrateChange')({runId:next.runId,kind:'architecture-sidearm',sidearmId,taskId:sidearm.taskId,dispatchId:sidearm.dispatchId,worktree:copy(sidearm.worktree),files:copy(sidearm.filesModified),performedBy:'coordinator'});
  sidearm.status='integrated';sidearm.review={status:'accepted',notes:decision.notes??null};sidearm.integration={status:'integrated',performedBy:'coordinator'};
  const resume=[];
  for(const id of sidearm.affectedOperations){
    const op=next.operations[id];op.sharedDependencies=[...new Set([...op.sharedDependencies,sidearm.taskId])];op.blockedBy=op.blockedBy.filter(value=>value!==sidearmId);
    if(op.status==='waiting-sidearm'){op.status=op.dependsOn.every(dep=>next.operations[dep].status==='completed')?'ready':'pending';if(op.attempts.length)resume.push(id);}
  }
  next.events.push({type:'architecture-sidearm-integrated',sidearmId,syncResumeDependencies:sidearm.affectedOperations.map(operationId=>({operationId,dependsOnTaskId:sidearm.taskId}))});
  for(const id of resume)if(next.operations[id].status==='ready')await dispatchOperation(next,id,adapter,{resume:true});
  refreshReadiness(next);
  return dispatchReadyOrcaOperations(next,adapter);
}

/**
 * Record coordinator review/integration, then create fresh resume Dispatches from the integrated
 * base. This avoids asking any worker to merge, rebase, cherry-pick, or push.
 */
export async function integrateOrcaSharedChange({plan,conflictId,decision,adapter}){
  const next=copy(plan),conflict=next.conflicts[conflictId];need(conflict?.status==='awaiting-review','Conflict owner result is not ready for review');
  need(plain(decision)&&decision.review==='accepted'&&decision.integration==='integrate','Coordinator must explicitly accept and integrate the shared change');
  const stopWorker=adapterMethod(adapter,'stopWorker');
  for(const id of conflict.affectedOperations){
    const attempt=next.operations[id].attempts.at(-1);
    if(attempt?.status==='dispatched'){
      await stopWorker({runId:next.runId,taskId:attempt.taskId,dispatchId:attempt.dispatchId,reason:'superseded-by-integrated-shared-change'});
      attempt.status='superseded';
    }
  }
  await adapterMethod(adapter,'integrateChange')({runId:next.runId,conflictId,taskId:conflict.taskId,dispatchId:conflict.dispatchId,worktree:copy(conflict.worktree),files:copy(conflict.filesModified),performedBy:'coordinator'});
  conflict.status='integrated';conflict.review={status:'accepted',notes:decision.notes??null};conflict.integration={status:'integrated',performedBy:'coordinator'};
  const resume=[];
  for(const id of conflict.affectedOperations){
    const op=next.operations[id];op.sharedDependencies=[...new Set([...op.sharedDependencies,conflict.taskId])];op.blockedBy=op.blockedBy.filter(value=>value!==conflictId);
    if(op.status==='waiting-conflict'){op.status=op.dependsOn.every(dep=>next.operations[dep].status==='completed')?'ready':'pending';if(op.attempts.length)resume.push(id);}
  }
  next.events.push({type:'shared-change-integrated',conflictId,syncResumeDependencies:conflict.affectedOperations.map(operationId=>({operationId,dependsOnTaskId:conflict.taskId}))});
  for(const id of resume)if(next.operations[id].status==='ready')await dispatchOperation(next,id,adapter,{resume:true});
  refreshReadiness(next);
  return dispatchReadyOrcaOperations(next,adapter);
}
