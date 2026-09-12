#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readDistJson} from '../core/runtime-root.mjs';
import {resolveExecutionChain} from '../profiles/select.mjs';
import {createOrcaCalls,defaultOrcaExecutable,getPath} from './orca-calls.mjs';
import {attestOperationWorker,formatOrcaDisplayName,planOperationAgentLaunch} from './supervision.mjs';

/**
 * Canonical supervised launcher for Orca operation agents and Workflow Monitors.
 * Every Orca call goes through the typed runner; every candidate attempt is classified, and a
 * failed candidate is fenced, settled and proven effect-free before the next candidate starts.
 */
export {defaultOrcaExecutable};
export const supervisedQwenModel='qwen3.8-flash';
const OP_LAUNCH='starci/orca-supervised-op-launch@2';
const MONITOR_LAUNCH='starci/orca-supervised-monitor-launch@2';
const SETTLEMENT='starci/orca-supervised-settlement@1';
const WORKER_START_TIMEOUT_MS=120000;

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const resultOf=receipt=>plain(receipt?.result)?receipt.result:receipt;

function parseArgs(argv){
  const [command,...rest]=argv;
  const options={};
  for(let index=0;index<rest.length;index+=1){
    const flag=rest[index];
    need(flag.startsWith('--'),`Unexpected argument: ${flag}`);
    const key=flag.slice(2);
    need(!Object.hasOwn(options,key),`Duplicate option: --${key}`);
    if(key==='dry-run'){options[key]=true;continue;}
    need(index+1<rest.length&&!rest[index+1].startsWith('--'),`Missing value for --${key}`);
    options[key]=rest[++index];
  }
  return {command,options};
}

function exactWorktree(value){
  const relative=required(value,'workflow worktree path');
  need(relative!=='current'&&!relative.startsWith('path:'),'Workflow worktree must be a filesystem-relative path, not an Orca selector');
  need(!path.isAbsolute(relative),'Workflow worktree input must be relative');
  const resolved=path.resolve(relative);
  return {relative,path:resolved,selector:`path:${resolved}`};
}

function specText(file){
  const resolved=path.resolve(required(file,'operation spec file'));
  need(fs.existsSync(resolved)&&fs.statSync(resolved).isFile(),`Operation spec file does not exist: ${resolved}`);
  return required(fs.readFileSync(resolved,'utf8'),'operation spec');
}

function findObject(value,predicate){
  if(predicate(value))return value;
  if(Array.isArray(value))for(const item of value){const found=findObject(item,predicate);if(found)return found;}
  else if(plain(value))for(const item of Object.values(value)){const found=findObject(item,predicate);if(found)return found;}
  return null;
}

function taskFromReceipt(receipt){
  const task=findObject(receipt,value=>plain(value)&&typeof value.id==='string'&&value.id.startsWith('task_')&&typeof value.display_name==='string');
  need(task,'Orca task-create receipt is missing the created Task');
  return task;
}

function dispatchIdFromReceipt(receipt){
  const direct=getPath(receipt,'result.dispatchId')??getPath(receipt,'result.dispatch_id');
  if(typeof direct==='string'&&direct.startsWith('ctx_'))return direct;
  const dispatch=findObject(receipt,value=>plain(value)&&typeof value.id==='string'&&value.id.startsWith('ctx_')&&(typeof value.task_id==='string'||typeof value.dispatch_id==='string'));
  return dispatch?.id??null;
}

function worktreeMatches(workerShow,expectedPath){
  const actual=resultOf(workerShow)?.terminal?.worktreePath;
  if(typeof actual!=='string')return {ok:false,reason:'Worker receipt is missing terminal.worktreePath'};
  const normalize=value=>path.resolve(value).replaceAll('\\','/').toLowerCase();
  return normalize(actual)===normalize(expectedPath)?{ok:true}:{ok:false,reason:`Worker worktree mismatch: expected ${expectedPath}, received ${actual}`};
}

/** Supervisor chains come from profiles/registry.json; every candidate must be a managed agent. */
export function resolveSupervisorChain(role,registry=readDistJson('profiles','registry.json')){
  const chain=registry?.supervisors?.[role]?.chain;
  need(Array.isArray(chain)&&chain.length,`Supervisor chain is missing for ${role}`);
  const effort=registry.supervisors[role].effort??null;
  return chain.map((target,priority)=>{
    const route=registry.targets?.[target];
    need(plain(route)&&route.orcaLaunch?.kind==='managed-agent',`Supervisor target must be a managed agent: ${target}`);
    const runtime=registry.aliases?.[route.runtime]??route.runtime;
    const profile=readDistJson('profiles',`${runtime}.json`).profiles?.[route.profile];
    need(plain(profile),`Unknown supervisor profile: ${target}`);
    return {priority,target,runtime,profile:route.profile,model:profile.model??route.requestedModel??null,effort:profile.model||route.requestedModel?effort:null,orcaLaunch:structuredClone(route.orcaLaunch)};
  });
}

/** Parse `--skip target:reason[,target:reason]` into registry-allowed no-effect attempts. */
export function parseSkip(value,chain,registry=readDistJson('profiles','registry.json')){
  if(value===undefined||value===null||value==='')return [];
  const allowed=registry.fallback.allowedReasons;
  return String(value).split(',').filter(Boolean).map(entry=>{
    const [target,reason='unavailable']=entry.split(':');
    need(chain.some(candidate=>candidate.target===target),`--skip names a target outside this operation chain: ${target}`);
    need(allowed.includes(reason),`--skip reason must be one of ${allowed.join(', ')}: ${reason}`);
    return {target,reason,effectState:'none',source:'monitor-verified-skip'};
  });
}

export function buildOperationLaunch({run,workflowTask,from,worktree,operation,scope,spec,skip}){
  const runId=required(run,'nested workflow Run ID'),workflow=required(workflowTask,'parent workflow Task ID');
  const monitor=required(from,'Workflow Monitor terminal handle');
  need(monitor.startsWith('term_'),'--from must be the exact Workflow Monitor terminal handle');
  const target=exactWorktree(worktree),op=required(operation,'operation'),opScope=required(scope,'operation scope');
  const contract=required(spec,'operation spec');
  const fullChain=resolveExecutionChain({skill:'starci',op}).candidates;
  need(fullChain.length,'Operation provider chain is empty');
  const skipped=parseSkip(skip,fullChain);
  const chain=fullChain.filter(candidate=>!skipped.some(item=>item.target===candidate.target));
  need(chain.length,'Every candidate of the operation chain was skipped');
  const displayName=formatOrcaDisplayName('operation-agent',{operation:op,scope:opScope});
  const candidates=chain.map(selection=>{
    const planned=planOperationAgentLaunch({taskId:'$operationTaskId',worktree:target.selector,selection,operation:op,scope:opScope});
    const start=planned.steps[0].args;
    const workerParams={task:'$operationTaskId',worktree:start.worktree,agent:start.agent,run:runId,from:monitor,'display-name':displayName,'timeout-ms':WORKER_START_TIMEOUT_MS};
    if(start.model)workerParams.model=start.model;
    if(start.effort)workerParams.effort=start.effort;
    return {selection,workerParams};
  });
  return {schema:'starci/orca-supervised-op-request@2',runId,workflowTask:workflow,from:monitor,worktree:target,operation:op,scope:opScope,displayName,
    selection:candidates[0].selection,candidates,skipped,
    runAttestationParams:{id:runId},
    taskParams:{run:runId,from:monitor,'task-title':`${op} - ${opScope}`,'display-name':displayName,spec:contract}};
}

export function buildMonitorLaunch({run,parentTask,from,worktree,workflow,spec}){
  const runId=required(run,'run ID'),parent=required(parentTask,'parent Coordinator Task ID');
  const coordinator=required(from,'parent Coordinator terminal handle');
  need(coordinator.startsWith('term_'),'--from must be the exact parent Coordinator terminal handle');
  const target=exactWorktree(worktree),name=required(workflow,'workflow name'),contract=required(spec,'Workflow Monitor spec');
  const displayName=formatOrcaDisplayName('workflow-manager',{workflow:name});
  const candidates=resolveSupervisorChain('workflowMonitor').map(selection=>{
    const workerParams={task:'$monitorTaskId',worktree:target.selector,agent:selection.orcaLaunch.agent,run:runId,from:coordinator,'display-name':displayName,'timeout-ms':WORKER_START_TIMEOUT_MS};
    if(selection.model){workerParams.model=selection.model;if(selection.effort)workerParams.effort=selection.effort;}
    return {selection,workerParams};
  });
  return {schema:'starci/orca-supervised-monitor-request@2',runId,parentTask:parent,from:coordinator,worktree:target,workflow:name,displayName,candidates,
    taskParams:{run:runId,parent,from:coordinator,'task-title':`Monitor ${name}`,'display-name':displayName,spec:contract}};
}

/** Stop, release and verify one Dispatch. Returns a typed settlement; never throws on Orca failure. */
const SETTLE_RECONCILE_ATTEMPTS=6,SETTLE_RECONCILE_WAIT_MS=5000;
const sleepSync=ms=>{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);};

/** After an unknown stop, wait for the process to settle and prove it read-only before stopping again. */
function reconcileUnknownStop(orca,dispatchId,{cwd,wait=sleepSync}){
  const observed=[];
  for(let attempt=1;attempt<=SETTLE_RECONCILE_ATTEMPTS;attempt+=1){
    wait(SETTLE_RECONCILE_WAIT_MS);
    const show=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});
    const result=resultOf(show.receipt),state=result?.worker?.state??null,status=result?.observation?.status??null;
    observed.push({attempt,state,status});
    if(show.outcome==='ok'&&(status==='exited'||['failed','stopped','abandoned'].includes(state)))return {settled:true,observed};
  }
  return {settled:false,observed};
}

export function settleDispatch(orca,dispatchId,{cwd,reason='fence-failed-attempt',wait,terminalHandle=null}={}){
  let stop=orca.invoke('worker-stop',{dispatch:dispatchId},{cwd}),reconciliation=null,closedTerminal=null;
  if(stop.outcome==='unknown'){
    reconciliation=reconcileUnknownStop(orca,dispatchId,{cwd,wait});
    if(!reconciliation.settled){
      // The fenced attempt's own agent terminal is still alive and Orca will not stop it: contain it
      // by closing exactly that handle, never any other terminal, then prove the stop again.
      const show=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});
      const owned=getPath(show.receipt,'result.worker.agent_terminal_handle')??null;
      const handle=terminalHandle??owned;
      if(handle&&(terminalHandle===null||owned===null||owned===terminalHandle)){
        const closed=orca.invoke('terminal-close',{terminal:handle},{cwd});
        closedTerminal={handle,outcome:closed.outcome,reason:closed.reason};
        if(closed.outcome==='ok'){const again=reconcileUnknownStop(orca,dispatchId,{cwd,wait});reconciliation={...again,afterClose:true};}
      }
    }
    if(reconciliation.settled)stop=orca.invoke('worker-stop',{dispatch:dispatchId},{cwd});
  }
  const release=stop.outcome==='unknown'?null:orca.invoke('worker-release',{dispatch:dispatchId},{cwd});
  const stopState=getPath(stop.receipt,'result.state')??null;
  const releaseState=getPath(release?.receipt,'result.state')??null;
  const releaseReason=getPath(release?.receipt,'result.reason')??null;
  const processAction=getPath(release?.receipt,'result.processAction')??null;
  let effectState='unknown',residualTerminal=null;
  if(stop.outcome!=='unknown'&&release?.outcome==='ok')effectState='none';
  else if(releaseState==='retained'&&processAction==='none'&&['failed','stopped','abandoned'].includes(stopState)){
    // Orca will not close a terminal whose identity it cannot prove, but the worker process is gone:
    // no live effect remains, only a UI terminal the operator may close by hand.
    effectState='none';residualTerminal={state:releaseState,reason:releaseReason,processAction};
  }
  else if(release?.outcome==='failed'&&release.effectState==='partial')effectState='partial';
  return {schema:SETTLEMENT,dispatchId,reason,effectState,residualTerminal,reconciliation,closedTerminal,
    stop:{outcome:stop.outcome,effectState:stop.effectState,state:stopState,alreadySettled:getPath(stop.receipt,'result.alreadySettled')??null,reason:stop.reason},
    release:release?{outcome:release.outcome,effectState:release.effectState,state:releaseState,processAction,reason:releaseReason??release.reason}:{outcome:'skipped',reason:'worker-stop outcome unknown'}};
}

function attemptRecord(candidate,extra){return {target:candidate.selection.target??candidate.selection.orcaLaunch.agent,agent:candidate.selection.orcaLaunch.agent,model:candidate.selection.model??null,...extra};}

function launchCandidate(orca,{cwd,candidate,taskId,taskRecord,displayName,expectedPath,attest}){
  const params={...candidate.workerParams,task:taskId};
  const started=orca.invoke('worker-start',params,{cwd});
  const dispatchId=dispatchIdFromReceipt(started.receipt);
  if(started.outcome!=='ok'){
    const ownTerminal=(getPath(started.receipt,'result.residualResources')??getPath(started.receipt,'result.effects')??[]).find(e=>e?.kind==='terminal'&&e?.role==='agent')?.id??null;
    const settlement=dispatchId&&started.effectState!=='none'?settleDispatch(orca,dispatchId,{cwd,reason:`worker-start ${started.outcome}`,terminalHandle:ownTerminal}):null;
    const effectState=settlement?settlement.effectState:started.effectState==='unknown'&&!dispatchId?'unknown':started.effectState;
    return {ok:false,dispatchId,effectState,reason:started.reason??`worker-start ${started.outcome}`,stage:started.stage,call:started,settlement};
  }
  need(dispatchId,'Orca worker-start receipt is missing the supervised Dispatch');
  const ownTerminal=(getPath(started.receipt,'result.effects')??[]).find(e=>e?.kind==='terminal'&&e?.role==='agent')?.id??null;
  const fence=reason=>{
    const settlement=settleDispatch(orca,dispatchId,{cwd,reason,terminalHandle:ownTerminal});
    return {ok:false,dispatchId,effectState:settlement.effectState,reason,call:started,settlement};
  };
  let show=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});
  if(show.outcome!=='ok')return fence(`worker-show after start: ${show.reason}`);
  const placement=worktreeMatches(show.receipt,expectedPath);
  if(!placement.ok)return fence(placement.reason);
  const delivery=promptDelivery(show.receipt);
  if(!delivery.ok)return fence(delivery.reason);
  let attestation;
  try{attestation=attest({workerShow:show.receipt,phase:'provider-identity'});}
  catch(error){return fence(error.message);}
  const rename=orca.invoke('terminal-rename',{terminal:attestation.terminalHandle,title:displayName},{cwd});
  if(rename.outcome!=='ok')return fence(`terminal rename: ${rename.reason}`);
  show=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});
  if(show.outcome!=='ok')return fence(`worker-show after rename: ${show.reason}`);
  // Immutable identity is re-attested; the title is mutable native UI metadata. A native agent may
  // overwrite it immediately with an activity title, so drift is recorded and recanonicalized, never fenced.
  try{attestation=attest({workerShow:show.receipt,phase:'runtime'});}
  catch(error){return fence(error.message);}
  let observedTitle=resultOf(show.receipt)?.terminal?.title??null;
  if(observedTitle!==displayName){
    const again=orca.invoke('terminal-rename',{terminal:attestation.terminalHandle,title:displayName},{cwd});
    if(again.outcome==='ok'){const check=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});if(check.outcome==='ok')observedTitle=resultOf(check.receipt)?.terminal?.title??observedTitle;}
  }
  const canonical=observedTitle===displayName;
  attestation={...attestation,terminalTitle:{observed:observedTitle,canonical,mutableUiMetadata:true,action:canonical?'none':'recanonicalize-without-fencing'}};
  return {ok:true,dispatchId,terminal:attestation.terminalHandle,attestation,titleDrift:!canonical,call:started,taskRecord};
}

/** The native agent must have consumed its Task input: state ready and no dispatch_input failure. */
export function promptDelivery(workerShow){
  const result=resultOf(workerShow),worker=result?.worker,dispatch=result?.dispatch;
  if(!plain(worker))return {ok:false,reason:'Worker receipt is missing worker state'};
  if(dispatch?.status==='failed')return {ok:false,reason:`Dispatch failed: ${dispatch.last_failure??worker.last_error??'unknown'}`};
  if(!['ready','running'].includes(worker.state))return {ok:false,reason:`Worker is ${worker.state??'unknown'} at stage ${worker.stage??'unknown'}: ${worker.last_error??'prompt not consumed'}`};
  const input=(worker.effects??[]).find(effect=>effect?.kind==='dispatch_input');
  if(input&&input.state!=='accepted')return {ok:false,reason:`Task input was ${input.state}`};
  return {ok:true};
}

function runChain(orca,{cwd,request,candidates,taskId,taskRecord,attest,expectedPath}){
  const attempts=[];
  for(const candidate of candidates){
    const result=launchCandidate(orca,{cwd,candidate,taskId,taskRecord,displayName:request.displayName,expectedPath,attest:attest.bind(null,candidate.selection)});
    if(result.ok)return {ok:true,candidate,result,attempts};
    attempts.push(attemptRecord(candidate,{dispatchId:result.dispatchId,effectState:result.effectState,reason:result.reason,stage:result.stage??null,settlement:result.settlement}));
    if(result.effectState!=='none')return {ok:false,exhausted:false,stopReason:'partial-or-unknown-effects',attempts};
  }
  return {ok:false,exhausted:true,stopReason:'chain-exhausted',attempts};
}

export function startOperation(input,{orca=createOrcaCalls()}={}){
  const request=buildOperationLaunch(input),cwd=request.worktree.path;
  const run=orca.invoke('run-show',request.runAttestationParams,{cwd});
  need(run.outcome==='ok',`Nested workflow Run attestation failed: ${run.reason}`);
  const observedRun=resultOf(run.receipt)?.run;
  need(observedRun?.id===request.runId,'Nested workflow Run attestation failed');
  need(observedRun?.coordinator_handle===request.from,'Operation can be launched only by the exact Workflow Monitor bound as nested Run coordinator');
  const created=orca.invoke('task-create',request.taskParams,{cwd});
  need(created.outcome==='ok',`Operation Task creation failed (${created.effectState}): ${created.reason}`);
  const task=taskFromReceipt(created.receipt);
  need(task.display_name===request.displayName,`Created Task name mismatch: ${task.display_name??'unknown'}`);
  const attest=(selection,{workerShow,phase})=>attestOperationWorker({taskId:task.id,operation:request.operation,scope:request.scope,selection,taskRecord:task,workerShow,phase});
  const chain=runChain(orca,{cwd,request,candidates:request.candidates,taskId:task.id,taskRecord:task,attest,expectedPath:cwd});
  const attempts=[...request.skipped,...chain.attempts];
  if(chain.ok)return {schema:OP_LAUNCH,ok:true,task,dispatchId:chain.result.dispatchId,terminal:chain.result.terminal,selection:chain.candidate.selection,attestation:chain.result.attestation,titleDrift:chain.result.titleDrift??false,attempts};
  return {schema:OP_LAUNCH,ok:false,task,exhausted:chain.exhausted,stopReason:chain.stopReason,attempts,
    recovery:chain.exhausted?'report-workflow-boundary-worker_failed':'reconcile-residual-resources-before-retry'};
}

export function startMonitor(input,{orca=createOrcaCalls()}={}){
  const request=buildMonitorLaunch(input),cwd=request.worktree.path;
  const created=orca.invoke('task-create',request.taskParams,{cwd});
  need(created.outcome==='ok',`Monitor Task creation failed (${created.effectState}): ${created.reason}`);
  const task=taskFromReceipt(created.receipt);
  need(task.display_name===request.displayName,`Created Monitor Task name mismatch: ${task.display_name??'unknown'}`);
  const attest=(selection,{workerShow,phase})=>{
    const result=resultOf(workerShow),effective=result?.worker?.startOptions?.launch?.effective;
    need(plain(effective)&&effective.agent===selection.orcaLaunch.agent,`Workflow Monitor provider attestation failed: expected agent ${selection.orcaLaunch.agent}, received ${effective?.agent??'unknown'}`);
    if(selection.model)need(effective.model===selection.model,`Workflow Monitor provider attestation failed: expected model ${selection.model}, received ${effective.model??'unknown'}`);
    const terminalHandle=result?.worker?.agent_terminal_handle;
    need(typeof terminalHandle==='string'&&terminalHandle,'Workflow Monitor receipt is missing the agent terminal handle');
    if(phase==='canonical-title')need(result?.terminal?.title===request.displayName,`Workflow Monitor title mismatch: expected ${request.displayName}, received ${result?.terminal?.title??'unknown'}`);
    return {schema:'starci/orca-monitor-provider-attestation@1',ok:true,taskId:task.id,dispatchId:result.dispatch?.id??null,terminalHandle,displayName:request.displayName,target:selection.target,agent:effective.agent,model:effective.model??null};
  };
  const chain=runChain(orca,{cwd,request,candidates:request.candidates,taskId:task.id,taskRecord:task,attest,expectedPath:cwd});
  if(chain.ok)return {schema:MONITOR_LAUNCH,ok:true,task,dispatchId:chain.result.dispatchId,terminal:chain.result.terminal,selection:chain.candidate.selection,attestation:chain.result.attestation,titleDrift:chain.result.titleDrift??false,attempts:chain.attempts};
  return {schema:MONITOR_LAUNCH,ok:false,task,exhausted:chain.exhausted,stopReason:chain.stopReason,attempts:chain.attempts,
    recovery:chain.exhausted?'report-coordinator-boundary-workflow-manager-failure':'reconcile-residual-resources-before-retry'};
}

/** Replace a dead Workflow Monitor: prove it is settled, then start a fresh one linked with --retry-of. */
export function replaceMonitor(input,{orca=createOrcaCalls()}={}){
  const dead=required(input.dispatch,'dead Workflow Monitor Dispatch ID');
  const request=buildMonitorLaunch(input),cwd=request.worktree.path;
  const show=orca.invoke('worker-show',{dispatch:dead},{cwd});
  const state=resultOf(show.receipt)?.worker?.state??null;
  need(show.outcome==='ok','Dead Workflow Monitor could not be inspected');
  need(!['ready','running'].includes(state),`Workflow Monitor ${dead} is ${state}; a live Monitor is never replaced`);
  const settlement=settleDispatch(orca,dead,{cwd,reason:'replace-dead-monitor'});
  if(settlement.effectState!=='none')return {schema:MONITOR_LAUNCH,ok:false,replaced:dead,settlement,stopReason:'dead-monitor-not-settled',recovery:'reconcile-residual-resources-before-retry',attempts:[]};
  const retryRequest={...request,candidates:request.candidates.map(candidate=>({...candidate,workerParams:{...candidate.workerParams,'retry-of':dead}}))};
  const attest=(selection,{workerShow,phase})=>{
    const result=resultOf(workerShow),effective=result?.worker?.startOptions?.launch?.effective;
    need(plain(effective)&&effective.agent===selection.orcaLaunch.agent,`Workflow Monitor provider attestation failed: expected agent ${selection.orcaLaunch.agent}`);
    const terminalHandle=result?.worker?.agent_terminal_handle;need(typeof terminalHandle==='string'&&terminalHandle,'Workflow Monitor receipt is missing the agent terminal handle');
    if(phase==='canonical-title')need(result?.terminal?.title===request.displayName,`Workflow Monitor title mismatch: expected ${request.displayName}`);
    return {schema:'starci/orca-monitor-provider-attestation@1',ok:true,taskId:null,dispatchId:result.dispatch?.id??null,terminalHandle,displayName:request.displayName,target:selection.target,agent:effective.agent,model:effective.model??null};
  };
  // Orca delivers the Task's stored spec as the agent prompt, so a replacement Monitor needs a fresh
  // Task carrying the current contract; the dead Task is closed and linked, never reused.
  const previousTask=required(input.task,'previous Workflow Monitor Task ID');
  const created=orca.invoke('task-create',request.taskParams,{cwd});
  need(created.outcome==='ok',`Replacement Monitor Task creation failed (${created.effectState}): ${created.reason}`);
  const task=taskFromReceipt(created.receipt);
  need(task.display_name===request.displayName,`Created Monitor Task name mismatch: ${task.display_name??'unknown'}`);
  const closed=orca.invoke('task-update',{id:previousTask,status:'failed',run:request.runId,from:request.from,result:JSON.stringify({replacedBy:task.id,replacedDispatch:dead,reason:'workflow-manager-replaced'})},{cwd});
  const chain=runChain(orca,{cwd,request:retryRequest,candidates:retryRequest.candidates,taskId:task.id,taskRecord:task,attest,expectedPath:cwd});
  const previous={task:previousTask,closed:closed.outcome==='ok',closeReason:closed.outcome==='ok'?null:closed.reason};
  if(chain.ok)return {schema:MONITOR_LAUNCH,ok:true,replaced:dead,previous,settlement,task,dispatchId:chain.result.dispatchId,terminal:chain.result.terminal,selection:chain.candidate.selection,attestation:chain.result.attestation,titleDrift:chain.result.titleDrift??false,attempts:chain.attempts};
  return {schema:MONITOR_LAUNCH,ok:false,replaced:dead,previous,settlement,task,exhausted:chain.exhausted,stopReason:chain.stopReason,attempts:chain.attempts,recovery:chain.exhausted?'report-coordinator-boundary-workflow-manager-failure':'reconcile-residual-resources-before-retry'};
}

function usage(){return `Usage:
  node orca-supervised-launch.mjs start-op --run <nested-workflow-run> --workflow-task <parent-workflow-task> --from <monitor-terminal> --worktree <relative-path> --operation <op> --scope <scope> --spec-file <relative-file> [--skip <target:reason[,target:reason]>] [--dry-run]
    --skip records a Monitor-verified no-effect failure for a chain target (reason from registry fallback.allowedReasons) so the chain starts at the next candidate
  node orca-supervised-launch.mjs start-monitor --run <run> --parent-task <task> --from <coordinator-terminal> --worktree <relative-path> --workflow <name> --spec-file <relative-file> [--dry-run]
  node orca-supervised-launch.mjs replace-monitor --run <run> --parent-task <task> --task <monitor-task> --dispatch <dead-dispatch> --from <coordinator-terminal> --worktree <relative-path> --workflow <name> --spec-file <relative-file>
  node orca-supervised-launch.mjs settle --dispatch <dispatch> [--worktree <relative-path>]
  node orca-supervised-launch.mjs verify`;}

export function main(argv=process.argv.slice(2),{orca}={}){
  const {command,options}=parseArgs(argv);
  need(['start-op','start-monitor','replace-monitor','settle','verify'].includes(command),usage());
  const runner=orca??createOrcaCalls();
  if(command==='verify'){const result=runner.verify();return {schema:'starci/orca-live-contract-verification@1',...result,result:undefined};}
  if(command==='settle')return settleDispatch(runner,required(options.dispatch,'dispatch'),{cwd:options.worktree?exactWorktree(options.worktree).path:process.cwd(),reason:'explicit-settle'});
  const common={run:options.run,from:options.from,worktree:options.worktree,spec:specText(options['spec-file'])};
  if(command==='start-op'){
    const input={...common,workflowTask:options['workflow-task'],operation:options.operation,scope:options.scope,skip:options.skip};
    return options['dry-run']?buildOperationLaunch(input):startOperation(input,{orca:runner});
  }
  const input={...common,parentTask:options['parent-task'],workflow:options.workflow};
  if(command==='start-monitor')return options['dry-run']?buildMonitorLaunch(input):startMonitor(input,{orca:runner});
  return replaceMonitor({...input,task:options.task,dispatch:options.dispatch},{orca:runner});
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  try{
    const output=main();
    process.stdout.write(`${JSON.stringify(output,null,2)}\n`);
    if(output?.ok===false)process.exitCode=1;
  }catch(error){process.stderr.write(`${JSON.stringify({ok:false,error:{message:error.message}},null,2)}\n`);process.exitCode=1;}
}
