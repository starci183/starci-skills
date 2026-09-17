#!/usr/bin/env node
import {classifyTab} from '../../kernel/tab.mjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {readDistJson} from '../../core/runtime-root.mjs';
import {resolveExecutionChain} from '../../kernel/chains.mjs';
import {createOrcaCalls,defaultOrcaExecutable,getPath} from './calls.mjs';
import {HOST_ENV,createHeadlessHost,headlessRoot} from '../headless/host.mjs';
import {attestOperationWorker,formatOrcaDisplayName,planOperationAgentLaunch} from '../../execution/supervision.mjs';
import {protocolMain} from './protocol.mjs';
import {kernelMain,OP_DEADLINE_MS} from '../../kernel/kernel.mjs';
import {roleOf as operationRoleOf} from '../../kernel/graph.mjs';
import {supervisorMain} from '../../kernel/supervisor.mjs';
import {serveWorkflowInputs} from '../../kernel/inputs-server.mjs';
import {QUIET_EVENTS,WORKFLOW_LIST,WORKFLOW_OPS,buildList,buildOpsView,buildView,readWorkflowEvents,renderEventLine,renderEventTail,renderList,renderOpsView,renderView} from '../../kernel/view.mjs';
import {createStore,repositoryRoot} from '../../kernel/store.mjs';
import {inspectLedger,ledgerFileFor,ledgerIdFor,openLedger} from '../../kernel/ledger-db.mjs';
import {DISK_HEADROOM_CODE} from '../../kernel/disk.mjs';

/**
 * Canonical supervised launcher for Orca operation agents, plus the CLI surface of the 5.0 workflow
 * kernel. Every Orca call goes through the typed runner; every candidate attempt is classified, and a
 * failed candidate is fenced, settled and proven effect-free before the next candidate starts.
 */
export {defaultOrcaExecutable};
export const supervisedQwenModel='qwen3.8-flash';
/**
 * The hosts a launcher command may run against. `orca` is the runner every command always had; `headless` is
 * `hosts/headless/host.mjs`, the same call surface answered with child processes and files, selected with
 * `--host-adapter headless` or with `STARCI_HOST=headless` in the environment - which is what the kernel sets on
 * every operation process it spawns, so a child's own `report` lands in the host mailbox without a flag.
 */
export const HOST_ADAPTERS=Object.freeze(['orca','headless']);
export function hostAdapterOf(options={},env=process.env){
  const named=options['host-adapter']??(env?.[HOST_ENV]==='headless'?'headless':'orca');
  need(HOST_ADAPTERS.includes(named),`--host-adapter must be one of ${HOST_ADAPTERS.join(', ')}: ${named}`);
  return named;
}
/** The runner for one command: Orca's typed CLI runner, or the headless host rooted where its files belong. */
export function createHostRunner({adapter,cwd=process.cwd(),env=process.env,reportsDir=null}={}){
  if(adapter==='headless')return createHeadlessHost({cwd,env,root:headlessRoot({cwd,env,reportsDir})});
  return createOrcaCalls();
}
export const qwenLaunchMode='command-terminal';
const OP_LAUNCH='starci/orca-supervised-op-launch@2';
const SETTLEMENT='starci/orca-supervised-settlement@1';
// Orca's worker-start timeout covers the whole supervised worker lifetime, not just prompt delivery. Keep its
// finite fallback aligned with the kernel attempt deadline; callers pass the exact op deadline when available.
const workerExecutionTimeout=(operation,timeoutMs)=>{
  if(timeoutMs!==undefined&&timeoutMs!==null){need(Number.isFinite(timeoutMs)&&timeoutMs>0,'Operation worker timeout must be a positive finite number');return timeoutMs;}
  return operationRoleOf(operation)==='verify'?OP_DEADLINE_MS.verify:OP_DEADLINE_MS.default;
};

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
    if(key==='dry-run'||key==='write'){options[key]=true;continue;}
    // `--lane` is the one flag whose value is optional: alone it names the lane after the workflow id.
    if(key==='lane'&&(index+1>=rest.length||rest[index+1].startsWith('--'))){options[key]=true;continue;}
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

/** Supervisor chains come from model/registry.json; every candidate must be a managed agent. */
export function resolveSupervisorChain(role,registry=readDistJson('model','registry.json')){
  const chain=registry?.supervisors?.[role]?.chain;
  need(Array.isArray(chain)&&chain.length,`Supervisor chain is missing for ${role}`);
  const effort=registry.supervisors[role].effort??null;
  return chain.map((target,priority)=>{
    const route=registry.targets?.[target];
    need(plain(route)&&route.orcaLaunch?.kind==='managed-agent',`Supervisor target must be a managed agent: ${target}`);
    const runtime=registry.aliases?.[route.runtime]??route.runtime;
    const profileId=route.profiles?.working??route.profiles?.reasoning;
    const profile=readDistJson('model',`${runtime}.json`).profiles?.[profileId];
    need(plain(profile),`Unknown supervisor profile: ${target}`);
    return {priority,target,runtime,profile:profileId,model:profile.model??route.requestedModel??null,effort:profile.model||route.requestedModel?effort:null,orcaLaunch:structuredClone(route.orcaLaunch)};
  });
}

/** Parse `--skip target:reason[,target:reason]` into registry-allowed no-effect attempts. */
export function parseSkip(value,chain,registry=readDistJson('model','registry.json')){
  if(value===undefined||value===null||value==='')return [];
  const allowed=registry.fallback.allowedReasons;
  return String(value).split(',').filter(Boolean).map(entry=>{
    const [named,reason='unavailable']=entry.split(':');
    const target=registry.targetAliases?.[named]??named;
    need(chain.some(candidate=>candidate.target===target),`--skip names a target outside this operation chain: ${target}`);
    need(allowed.includes(reason),`--skip reason must be one of ${allowed.join(', ')}: ${reason}`);
    return {target,reason,effectState:'none',source:'monitor-verified-skip'};
  });
}

/**
 * Build the launch request for one operation. By default the ordered candidates come from the operation's
 * own chain and `--skip` removes verified no-effect targets. `candidates` replaces that resolution outright
 * with an explicit, already-resolved selection list: that is the seam runtime allocation uses, since the
 * allocator - not the chain - decides which runtime an operation gets, and the launcher must then try
 * exactly that one. A caller passes either `skip` or `candidates`, never both.
 */
export function buildOperationLaunch({run,workflowTask,from,worktree,operation,scope,spec,skip,candidates:allocated=null,kind=null,timeoutMs=null}){
  const runId=required(run,'nested workflow Run ID'),workflow=required(workflowTask,'parent workflow Task ID');
  const monitor=required(from,'own supervising terminal handle');
  need(monitor.startsWith('term_'),'--from must be the exact supervising terminal handle');
  const target=exactWorktree(worktree),op=required(operation,'operation'),opScope=required(scope,'operation scope');
  const contract=required(spec,'operation spec');
  if(allocated!==null){
    need(Array.isArray(allocated)&&allocated.length,'An explicit candidate list must name at least one resolved selection');
    need(skip===undefined||skip===null||skip==='','An explicit candidate list already is the decision: --skip cannot narrow it further');
    for(const selection of allocated)need(plain(selection)&&plain(selection.orcaLaunch)&&typeof selection.target==='string'&&selection.target.trim(),'Each explicit candidate must be a resolved selection with a target and an Orca launch shape');
  }
  // Capacity-gated targets are valid allocator destinations but never implicit launcher fallbacks. The workflow
  // must hand one in explicitly after its quota opened the runtime.
  const fullChain=allocated??resolveExecutionChain({skill:'starci',op}).candidates.filter(candidate=>candidate.orcaLaunch?.capacityGate!=='explicit-workflow-quota');
  need(fullChain.length,'Operation provider chain is empty');
  const skipped=allocated?[]:parseSkip(skip,fullChain);
  const chain=fullChain.filter(candidate=>!skipped.some(item=>item.target===candidate.target));
  need(chain.length,'Every candidate of the operation chain was skipped');
  // The tab is named after the op's KIND: an `e2e.verify` op launched through the `uat.verify` operator contract must read as e2e.
  const displayName=formatOrcaDisplayName('operation-agent',{operation:kind??op,scope:opScope});
  const executionTimeoutMs=workerExecutionTimeout(kind??op,timeoutMs);
  const candidates=chain.map(selection=>{
    const planned=planOperationAgentLaunch({taskId:'$operationTaskId',worktree:target.selector,selection,operation:op,scope:opScope});
    if(planned.mode==='command-terminal'){
      return {selection,launch:'command-terminal',terminalParams:{worktree:target.selector,title:displayName,command:planned.steps[0].args.command},dispatchParams:{task:'$operationTaskId',to:'$terminalHandle',from:monitor,run:runId,'return-preamble':true}};
    }
    const start=planned.steps[0].args;
    const workerParams={task:'$operationTaskId',worktree:start.worktree,agent:start.agent,run:runId,from:monitor,'display-name':displayName,'timeout-ms':executionTimeoutMs};
    if(start.model)workerParams.model=start.model;
    if(start.effort)workerParams.effort=start.effort;
    return {selection,launch:'managed-agent',workerParams};
  });
  return {schema:'starci/orca-supervised-op-request@2',runId,workflowTask:workflow,from:monitor,worktree:target,operation:op,scope:opScope,displayName,
    selection:candidates[0].selection,candidates,skipped,
    runAttestationParams:{id:runId},
    taskParams:{run:runId,from:monitor,'task-title':`${op} - ${opScope}`,'display-name':displayName,spec:contract}};
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

/**
 * `last_failure` as this Orca prints it: a JSON string on 1.4.x, an object on some builds, a double-encoded
 * string on others, and prose when the failure came from the runner itself. Parsed defensively - anything that
 * is not an object is no last words at all - because the alternative is a throw inside the reconcile loop.
 */
export function parseLastFailure(value){
  if(plain(value))return value;
  if(typeof value!=='string'||!value.trim())return null;
  let parsed=null;
  try{parsed=JSON.parse(value);}catch{return null;}
  if(typeof parsed==='string'){try{parsed=JSON.parse(parsed);}catch{return null;}}
  return plain(parsed)?parsed:null;
}
/** The outcomes a worker may state in its own report; anything else is read as `failed`. */
export const WORKER_REPORT_OUTCOMES=Object.freeze(['done','partial','failed','blocked','ask']);
/**
 * What a Dispatch said last. A worker whose run ended before it could report through the kernel's own command
 * still tells Orca why: `last_failure` carries `provenance:"worker_report"` with the agent's subject and body -
 * the work it finished and the reason the report never landed. Those are the operation's last words, and
 * reading them is the difference between judging a finished piece of work and restarting it from scratch.
 * `text` is every failure string the receipt carries, for a caller that must decide whose fault the failure was.
 */
export function workerLastWords(dispatch,worker=null){
  const raw=dispatch?.last_failure??dispatch?.lastFailure??null;
  const failure=parseLastFailure(raw);
  const text=[typeof raw==='string'?raw:raw?JSON.stringify(raw):'',
    worker?.last_error,worker?.lastError,dispatch?.reason,dispatch?.status]
    .filter(value=>typeof value==='string'&&value.trim()).join(' | ');
  const subject=typeof failure?.subject==='string'?failure.subject.trim():'';
  const body=typeof failure?.body==='string'?failure.body.trim():'';
  if(failure?.provenance!=='worker_report'||!(subject||body))return {failure,text,report:null};
  const outcome=WORKER_REPORT_OUTCOMES.includes(failure.outcome)?failure.outcome:'failed';
  const declaredOpen=Array.isArray(failure.open)?failure.open.filter(item=>typeof item==='string'&&item.trim()):[];
  // A failed worker report retained by Orca is diagnostic evidence, even when the contract reporter vanished
  // before transporting its structured findings. Label the prose accordingly; it is not verified structure.
  const open=!declaredOpen.length&&['failed','partial'].includes(outcome)&&body
    ?[`Unresolved worker report (structured findings unavailable): ${body}`]
    :declaredOpen;
  return {failure,text,report:{
    outcome,subject,body,open,
    blocker:plain(failure.blocker)?failure.blocker:null,question:plain(failure.question)?failure.question:null}};
}
/** Ask Orca for one Dispatch and read its last words; an unreachable Orca simply has none. */
export function dispatchLastWords(orca,dispatchId,{cwd}={}){
  let shown=null;
  try{shown=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});}catch(error){return {ok:false,status:null,failure:null,text:String(error?.message??error),report:null};}
  if(shown?.outcome!=='ok')return {ok:false,status:null,failure:null,text:String(shown?.reason??''),report:null};
  const result=resultOf(shown.receipt);
  const dispatch=plain(result?.dispatch)?result.dispatch:null;
  return {ok:true,status:dispatch?.status??null,...workerLastWords(dispatch,plain(result?.worker)?result.worker:null)};
}
const TERMINAL_STOP_STATES=['failed','stopped','abandoned'];
/** Orca's own record of one worker: has its process exited, and is the tab it lived in gone from the worktree? */
const IDLE_TAB_VERDICTS=['idle','finished-unreported','prompt-missing'];
/** How long a dispatch heartbeat must have been silent before an idle prompt counts as a finished worker. */
export const HEARTBEAT_STALE_MS=15*60*1000;
function exitedWorkerProof(orca,dispatchId,{cwd,now=Date.now}){
  let show;try{show=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});}catch(error){return {proven:false,reason:String(error?.message??error)};}
  const worker=getPath(show.receipt,'result.worker')??null;
  const state=worker?.state??null,stage=worker?.stage??null,terminal=worker?.agent_terminal_handle??null;
  if(show.outcome!=='ok'||!TERMINAL_STOP_STATES.includes(state)||stage!=='process_exited'||!terminal)return {proven:false,state,stage,terminal,reason:'the worker record does not show an exited process in a terminal state'};
  let listed;try{listed=orca.invoke('terminal-list',{},{cwd});}catch(error){return {proven:false,state,stage,terminal,reason:String(error?.message??error)};}
  if(listed.outcome!=='ok')return {proven:false,state,stage,terminal,reason:'the worktree terminals could not be listed'};
  const listedHandles=receipt=>(getPath(receipt,'result.terminals')??[]).map(item=>item?.handle);
  if(!listedHandles(listed.receipt).includes(terminal))return {proven:true,state,stage,terminal,tabListed:false};
  // The fenced attempt's own tab is still there (an earlier close was answered but not honoured): contain it by
  // closing exactly that handle, never another, and take the tab's disappearance as the proof. A tab that stays
  // listed after that keeps the settlement unknown.
  let closed;try{closed=orca.invoke('terminal-close',{terminal},{cwd});}catch(error){closed={outcome:'unknown',reason:String(error?.message??error)};}
  if(closed.outcome!=='ok')return {proven:false,state,stage,terminal,reason:`the worker tab is still listed and could not be closed: ${closed.reason??closed.outcome}`};
  let again;try{again=orca.invoke('terminal-list',{},{cwd});}catch(error){return {proven:false,state,stage,terminal,reason:String(error?.message??error)};}
  if(again.outcome!=='ok')return {proven:false,state,stage,terminal,reason:'the worktree terminals could not be listed after the close'};
  if(!listedHandles(again.receipt).includes(terminal))return {proven:true,state,stage,terminal,tabListed:false,closedTab:true};
  // Orca answered the close but the pty outlived it ("stop unverifiable"). What is left is a TUI at its prompt: the
  // screen says whether a turn is still running, and the dispatch heartbeat says for how long nothing has. An idle
  // prompt with a heartbeat older than the stale window is a finished worker whose tab nobody can kill; its effects
  // are complete, the tab is recorded as residual. A drawing turn, a question, or a fresh heartbeat stays unknown.
  let read;try{read=orca.invoke('terminal-read',{terminal},{cwd});}catch(error){return {proven:false,state,stage,terminal,closedTab:true,reason:String(error?.message??error)};}
  if(read.outcome!=='ok')return {proven:false,state,stage,terminal,closedTab:true,reason:'the worker tab is still listed after its close and could not be read'};
  const verdict=classifyTab({lines:getPath(read.receipt,'result.terminal.tail')??[]});
  const heartbeatAt=Date.parse(getPath(show.receipt,'result.dispatch.last_heartbeat_at')??'');
  const heartbeatAgeMs=Number.isFinite(heartbeatAt)?now()-heartbeatAt:null;
  if(!IDLE_TAB_VERDICTS.includes(verdict.verdict))return {proven:false,state,stage,terminal,closedTab:true,screen:verdict.verdict,heartbeatAgeMs,reason:`the worker tab is still listed after its close and its screen reads ${verdict.verdict}`};
  if(heartbeatAgeMs===null||heartbeatAgeMs<HEARTBEAT_STALE_MS)return {proven:false,state,stage,terminal,closedTab:true,screen:verdict.verdict,heartbeatAgeMs,reason:'the worker tab is still listed after its close and its dispatch heartbeat is not stale'};
  return {proven:true,state,stage,terminal,tabListed:true,closedTab:true,screen:verdict.verdict,heartbeatAgeMs,residualTab:{terminal,verdict:verdict.verdict,reason:'an idle prompt whose pty Orca could not stop; retained'}};
}
const classifySettlement=(stop,release)=>{
  const stopState=getPath(stop?.receipt,'result.state')??null,releaseState=getPath(release?.receipt,'result.state')??null;
  const releaseReason=getPath(release?.receipt,'result.reason')??null,processAction=getPath(release?.receipt,'result.processAction')??null;
  let effectState='unknown',residualTerminal=null;
  if(stop?.outcome==='ok'&&TERMINAL_STOP_STATES.includes(stopState)&&release?.outcome==='ok'&&['released','already_released'].includes(releaseState))effectState='none';
  else if(releaseState==='retained'&&processAction==='none'&&['failed','stopped','abandoned'].includes(stopState)){
    effectState='none';residualTerminal={state:releaseState,reason:releaseReason,processAction};
  }else if(release?.outcome==='failed'&&release.effectState==='partial')effectState='partial';
  return {effectState,residualTerminal,stopState,releaseState,releaseReason,processAction};
};
const cleanupProof=({releaseState=null,releaseReason=null,processAction=null,closedTerminal=null,exitedWorker=null}={})=>{
  if(closedTerminal?.outcome==='ok')return {complete:true,proof:'exact-terminal-closed',terminal:closedTerminal.handle};
  if(['released','already_released'].includes(releaseState))return {complete:true,proof:'owned-resource-released'};
  if(exitedWorker?.proven&&exitedWorker.tabListed===false)return {complete:true,proof:'exact-terminal-absent',terminal:exitedWorker.terminal};
  return {complete:false,proof:null,reason:releaseReason??(releaseState?`worker-release returned ${releaseState}`:'cleanup ownership is unproven'),
    releaseState,processAction,residualTerminal:Boolean(releaseState==='retained'||exitedWorker?.residualTab)};
};

/** Prove an already-successful worker exited before issuing another native mutation. */
function completedWorkerProof(orca,dispatchId,{cwd}={}){
  let shown;try{shown=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});}catch(error){return {proven:false,reason:String(error?.message??error)};}
  if(shown?.outcome!=='ok')return {proven:false,reason:`worker-show failed: ${shown?.reason??shown?.outcome??'unknown'}`};
  const result=resultOf(shown.receipt),dispatch=result?.dispatch,worker=result?.worker,observation=result?.observation,terminal=result?.terminal,
    terminalResource=result?.terminalResource,ownershipState=String(terminalResource?.ownershipState??'').toLowerCase();
  const completed=dispatch?.status==='completed'&&Boolean(dispatch?.completed_at)&&Boolean(dispatch?.capability_revoked_at)&&worker?.state==='succeeded'&&worker?.stage==='settled';
  // After an Orca restart the terminal handle is stale: observation reads `missing` and the resource is
  // retained as `identity_unproven`. The completed, capability-revoked, settled worker is still the proof
  // that nothing runs; the unclosable tab is recorded residue, not a live effect. A user-owned retained
  // tab of a completed dispatch is the same class: the human owns the leftover surface, not the work.
  const retainedResidue=completed&&terminalResource?.releaseState==='retained'
    &&terminalResource?.originDispatchId===dispatchId&&terminalResource?.ownerDispatchId===dispatchId
    &&(observation?.status==='missing'||ownershipState==='user_owned');
  const exact=dispatch?.id===dispatchId&&worker?.dispatch_id===dispatchId&&(observation?.exactWorker===true||retainedResidue);
  const terminalAbsent=!terminal,terminalDisconnected=terminal?.connected===false&&terminal?.writable===false;
  if(ownershipState==='user_owned'&&!retainedResidue)return {proven:false,userOwned:true,ownershipState,reason:'the completed worker terminal is user-owned'};
  if(!exact||!completed||(observation?.status!=='exited'&&!retainedResidue)||(!terminalAbsent&&!terminalDisconnected&&!retainedResidue))return {proven:false,ownershipState,reason:'the exact completed worker is not proved exited with an absent or disconnected terminal'};
  const cleanup=terminalAbsent?{complete:true,proof:'exact-terminal-absent'}:
    retainedResidue?{complete:false,proof:'retained-terminal',reason:`the completed worker terminal is retained (${terminalResource?.retainedReason??'residual'})`,residualTerminal:true}:
    {complete:false,proof:null,reason:'the exited worker terminal remains recorded as disconnected',residualTerminal:true};
  return {proven:true,dispatchStatus:dispatch.status,workerState:worker.state,workerStage:worker.stage,capabilityRevoked:true,
    ownershipState:ownershipState||null,terminal:terminal?{handle:terminal.handle??null,connected:false,writable:false}:null,cleanup};
}

export function settleDispatch(orca,dispatchId,{cwd,reason='fence-failed-attempt',wait,terminalHandle=null,closeTerminal=false,now=Date.now}={}){
  // A completed, capability-revoked, settled worker whose tab is gone is proof on its own - whoever closed the tab
  // (the kernel, the user, a wiped worktree): asking Orca to stop and release it again answers `identity_unproven`.
  const completedWorker=completedWorkerProof(orca,dispatchId,{cwd});
  if(completedWorker.proven)return {schema:SETTLEMENT,dispatchId,reason,effectState:'none',residualTerminal:completedWorker.cleanup.complete?null:{state:'retained',reason:completedWorker.cleanup.reason,processAction:'none'},
    reconciliation:null,closedTerminal:null,completedWorker,cleanup:completedWorker.cleanup,
    stop:{outcome:'skipped',effectState:'none',state:'succeeded',alreadySettled:true,reason:'exact completed worker already exited'},
    release:{outcome:'skipped',reason:'completed worker requires no process release'}};
  if(completedWorker.userOwned)return {schema:SETTLEMENT,dispatchId,reason,effectState:'unknown',residualTerminal:{state:'retained',reason:completedWorker.reason,processAction:'none'},
    reconciliation:null,closedTerminal:null,completedWorker,cleanup:{complete:false,proof:null,reason:completedWorker.reason,residualTerminal:true},
    stop:{outcome:'skipped',effectState:'unknown',state:'succeeded',alreadySettled:true,reason:completedWorker.reason},release:{outcome:'skipped',reason:completedWorker.reason}};
  let stop=orca.invoke('worker-stop',{dispatch:dispatchId},{cwd}),reconciliation=null,closedTerminal=null;
  if(closeTerminal&&terminalHandle){
    // A command-terminal attempt owns its terminal outright: the process lives only there, so closing
    // that exact handle after fencing the Dispatch is the settlement.
    const closed=orca.invoke('terminal-close',{terminal:terminalHandle},{cwd});
    closedTerminal={handle:terminalHandle,outcome:closed.outcome,reason:closed.reason};
    const release=orca.invoke('worker-release',{dispatch:dispatchId},{cwd});
    const classified=classifySettlement(stop,release);
    const stopped=stop.outcome==='ok'&&['failed','stopped','abandoned'].includes(classified.stopState);
    const released=release.outcome==='ok'&&['released','already_released'].includes(classified.releaseState);
    const retained=classified.releaseState==='retained'&&classified.processAction==='none';
    const effectState=closed.outcome==='ok'?'none':stopped&&(released||retained)?'none':'unknown';
    return {schema:SETTLEMENT,dispatchId,reason,effectState,residualTerminal:closed.outcome==='ok'?null:classified.residualTerminal,reconciliation:null,closedTerminal,
      cleanup:cleanupProof({...classified,closedTerminal}),
      stop:{outcome:stop.outcome,effectState:stop.effectState,state:getPath(stop.receipt,'result.state')??null,alreadySettled:getPath(stop.receipt,'result.alreadySettled')??null,reason:stop.reason},
      release:{outcome:release.outcome,effectState:release.effectState,state:getPath(release.receipt,'result.state')??null,processAction:getPath(release.receipt,'result.processAction')??null,reason:getPath(release.receipt,'result.reason')??release.reason}};
  }
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
    if(stop.outcome==='unknown'&&closedTerminal?.outcome==='ok'){
      // Orca cannot move a stop_unknown Dispatch, but the attempt's only process lived in the terminal we
      // just closed: abandon records the fence honestly and no live effect remains.
      const abandoned=orca.invoke('worker-abandon',{dispatch:dispatchId},{cwd});
      if(abandoned.outcome==='ok'){
        return {schema:SETTLEMENT,dispatchId,reason,effectState:'none',residualTerminal:null,reconciliation,closedTerminal,abandoned:true,
          cleanup:cleanupProof({closedTerminal}),
          stop:{outcome:stop.outcome,effectState:stop.effectState,state:getPath(stop.receipt,'result.state')??null,alreadySettled:null,reason:stop.reason},
          release:{outcome:'skipped',reason:'dispatch abandoned after its own terminal was closed'}};
      }
    }
  }
  const release=stop.outcome==='unknown'?null:orca.invoke('worker-release',{dispatch:dispatchId},{cwd});
  let classified=classifySettlement(stop,release),exitedWorker=null;
  // The worker's own tab was closed before this settlement (a blocked op's sweep closes it), so Orca answers the
  // release with `release_unknown` / `closed_agent_terminal`: it cannot confirm a process it no longer holds. Its
  // worker record can: a terminal state with the process exited, and a tab no longer listed, is the proof that
  // nothing of this attempt is still running. Anything short of that stays unknown.
  if(classified.effectState==='unknown'&&stop.outcome==='ok'&&TERMINAL_STOP_STATES.includes(classified.stopState)&&release?.outcome==='unknown'&&classified.processAction==='closed_agent_terminal'){
    exitedWorker=exitedWorkerProof(orca,dispatchId,{cwd,now});
    if(exitedWorker.proven)classified={...classified,effectState:'none',residualTerminal:{state:classified.releaseState,reason:classified.releaseReason,processAction:classified.processAction}};
  }
  const {effectState,residualTerminal,stopState,releaseState,releaseReason,processAction}=classified;
  return {schema:SETTLEMENT,dispatchId,reason,effectState,residualTerminal,reconciliation,closedTerminal,...(exitedWorker?{exitedWorker}:{}),
    cleanup:cleanupProof({releaseState,releaseReason,processAction,closedTerminal,exitedWorker}),
    stop:{outcome:stop.outcome,effectState:stop.effectState,state:stopState,alreadySettled:getPath(stop.receipt,'result.alreadySettled')??null,reason:stop.reason},
    release:release?{outcome:release.outcome,effectState:release.effectState,state:releaseState,processAction,reason:releaseReason??release.reason}:{outcome:'skipped',reason:'worker-stop outcome unknown'}};
}

function attemptRecord(candidate,extra){return {target:candidate.selection.target??candidate.selection.orcaLaunch.agent,agent:candidate.selection.orcaLaunch.agent,model:candidate.selection.model??null,...extra};}

/** Long preambles crash Qwen's paste handling; hand them over as a short @file reference instead. */
function deliveryText(adapter,{cwd,dispatchId,preamble}){
  const delivery=adapter.delivery;
  if(!delivery||preamble.length<=delivery.maxInlineChars)return preamble;
  const directory=path.join(cwd,delivery.fileDirectory);
  fs.mkdirSync(directory,{recursive:true});
  const file=path.join(directory,delivery.fileName.replace('<dispatch>',dispatchId));
  fs.writeFileSync(file,preamble.endsWith('\n')?preamble:`${preamble}\n`);
  return delivery.prompt.replace('<file>',path.relative(cwd,file).replaceAll('\\','/'));
}

const screenText=receipt=>(getPath(receipt,'result.terminal.tail')??[]).join('\n');

/**
 * Coordinator -> Monitor delivery that bypasses the Run mailbox. Orca fences a terminal to the one Run it
 * consumes (a Monitor bound to its nested Run never reads parent-Run mail: consumer_fenced), so the message
 * is typed into the Monitor's own agent terminal. A busy Claude queues typed input and reads it when its turn
 * ends; Orca then reports agent_prompt_stalled although the text is staged, so delivery is proven from the
 * screen, never from the send receipt.
 */
export function notifyTerminal(orca,{cwd,terminal,file,text,wait=sleepSync}){
  need(text||file,'notify needs --text or --file');
  const body=file?fs.readFileSync(path.resolve(cwd,file),'utf8').trim():text;
  const pointer=file?`Read ${path.resolve(cwd,file).replaceAll('\\','/')} completely and apply it now; it supersedes the corresponding clauses of your contract. Summary: ${body.split('\n').find(line=>line.trim())?.slice(0,300)??''}`:body;
  const sent=orca.invoke('terminal-send',{terminal,text:pointer,enter:true},{cwd});
  wait(1500);
  const read=orca.invoke('terminal-read',{terminal,screen:true},{cwd});
  const screen=read.outcome==='ok'?screenText(read.receipt):'';
  const marker=pointer.slice(-40).replace(/\s+/g,' ');
  const flat=screen.replace(/\s+/g,' ');
  const delivered=/queued messages/i.test(flat)?'queued':flat.includes(marker)?'staged':sent.outcome==='ok'?'submitted':null;
  return {schema:'starci/orca-notify-result@1',ok:Boolean(delivered),terminal,file:file??null,delivered,
    effectState:delivered?'committed':sent.outcome==='ok'?'unknown':'none',
    send:{outcome:sent.outcome,effectState:sent.effectState,reason:sent.reason},
    reason:delivered?null:`message not visible on the terminal screen (${sent.reason??sent.outcome})`};
}

/** Command-terminal launch: one terminal per attempt, Task delivered by dispatch --return-preamble + terminal send. */
function launchCommandTerminalCandidate(orca,{cwd,candidate,taskId,displayName,wait=sleepSync}){
  const adapterName=required(candidate.selection?.orcaLaunch?.adapter,'command-terminal adapter');
  const adapter=readDistJson('providers','orca','adapters',`${adapterName}.json`);
  const prefixContract=adapter.commandPrefix??adapter.credentialRefresh??{};
  const prefix=process.platform==='win32'?(prefixContract.win32??''):(prefixContract.posix??'');
  const created=orca.invoke('terminal-create',{...candidate.terminalParams,command:`${prefix}${candidate.terminalParams.command}`},{cwd});
  if(created.outcome!=='ok')return {ok:false,dispatchId:null,effectState:created.effectState==='unknown'?'unknown':'none',reason:`terminal create: ${created.reason}`,call:created,settlement:null};
  const handle=getPath(created.receipt,'result.terminal.handle');
  const fenceTerminal=(reason,dispatchId=null)=>{
    if(dispatchId){const settlement=settleDispatch(orca,dispatchId,{cwd,reason,terminalHandle:handle,closeTerminal:true});return {ok:false,dispatchId,effectState:settlement.effectState,reason,call:created,settlement};}
    const closed=orca.invoke('terminal-close',{terminal:handle},{cwd});
    return {ok:false,dispatchId:null,effectState:closed.outcome==='ok'?'none':'unknown',reason,call:created,settlement:{schema:SETTLEMENT,dispatchId:null,reason,effectState:closed.outcome==='ok'?'none':'unknown',closedTerminal:{handle,outcome:closed.outcome,reason:closed.reason}}};
  };
  const readiness=new RegExp(adapter.readiness.screenPattern);
  let screen='',ready=false;
  for(let elapsed=0;elapsed<adapter.readiness.timeoutMs;elapsed+=adapter.readiness.intervalMs){
    wait(adapter.readiness.intervalMs);
    const read=orca.invoke('terminal-read',{terminal:handle,screen:true},{cwd});
    screen=read.outcome==='ok'?screenText(read.receipt):'';
    if(readiness.test(screen)){ready=true;break;}
  }
  if(!ready)return fenceTerminal(`terminal readiness timeout: no input prompt within ${adapter.readiness.timeoutMs} ms`);
  const dispatched=orca.invoke('dispatch',{...candidate.dispatchParams,task:taskId,to:handle},{cwd});
  if(dispatched.outcome!=='ok')return fenceTerminal(`dispatch --return-preamble: ${dispatched.reason}`,dispatchIdFromReceipt(dispatched.receipt));
  const dispatchId=dispatchIdFromReceipt(dispatched.receipt),preamble=getPath(dispatched.receipt,'result.preamble');
  if(!dispatchId||typeof preamble!=='string'||!preamble.trim())return fenceTerminal('dispatch --return-preamble returned no Dispatch or preamble',dispatchId);
  const text=deliveryText(adapter,{cwd,dispatchId,preamble});
  const sent=orca.invoke('terminal-send',{terminal:handle,text,enter:true},{cwd});
  if(sent.outcome!=='ok')return fenceTerminal(`terminal send: ${sent.reason}`,dispatchId);
  const staged=new RegExp(adapter.submission.stagedPattern),activity=new RegExp(adapter.submission.activityPattern);
  let enters=1,submitted=false;
  for(let elapsed=0;elapsed<adapter.submission.timeoutMs;elapsed+=adapter.submission.settleMs){
    wait(adapter.submission.settleMs);
    const read=orca.invoke('terminal-read',{terminal:handle,screen:true},{cwd});
    screen=read.outcome==='ok'?screenText(read.receipt):'';
    // Activity proves the turn started even when the transcript still shows the collapsed paste marker.
    if(activity.test(screen)){submitted=true;break;}
    if(staged.test(screen)&&enters<adapter.submission.maxEnter){orca.invoke('terminal-send',{terminal:handle,enter:true},{cwd});enters+=1;}
  }
  if(!submitted)return fenceTerminal(`prompt was not consumed by the terminal agent; last frame: ${screen.split('\n').filter(l=>l.trim()).slice(-4).join(' | ').slice(0,300)}`,dispatchId);
  const shown=orca.invoke('dispatch-show',{task:taskId},{cwd});
  const dispatch=getPath(shown.receipt,'result.dispatch');
  if(shown.outcome!=='ok'||dispatch?.id!==dispatchId||dispatch?.assignee_handle!==handle)return fenceTerminal(`dispatch assignee attestation failed: expected ${handle} for ${dispatchId}`,dispatchId);
  const model=candidate.selection.model??candidate.selection.requestedModel??adapter.model;
  const identityPattern=adapter.readiness?.identityPattern??adapter.modelMarker;
  if(typeof identityPattern!=='string'||!identityPattern.trim()||!new RegExp(identityPattern,'i').test(screen))return fenceTerminal(`rendered provider attestation failed: ${identityPattern??'no identity pattern'} not shown`,dispatchId);
  const attestation={schema:'starci/orca-command-terminal-attestation@1',ok:true,supervision:'command-terminal',taskId,dispatchId,terminalHandle:handle,displayName,target:candidate.selection.target??null,adapter:adapterName,agent:adapter.agent,model,modelAuthority:adapter.modelAuthority,submitEnters:enters,delivery:text.startsWith('@')?'file-reference':'inline',terminalTitle:{observed:displayName,canonical:true,mutableUiMetadata:true,action:'none'}};
  return {ok:true,dispatchId,terminal:handle,attestation,titleDrift:false,call:created,launch:'command-terminal'};
}

/**
 * A TUI agent asks whether it may trust a folder it has never been opened in, and Orca's pasted task lands in
 * that dialog: the start times out (`agent_prompt_stalled`), the agent exits, and every attempt in a fresh
 * worktree fails the same way - no drawing launched in the frontend worktrees all afternoon. Trust is granted
 * to the exact worktree before the worker starts, the way the agent itself would record the owner's answer:
 * Claude Code in `~/.claude.json` (`projects[path].hasTrustDialogAccepted`), Codex in `~/.codex/config.toml`
 * (`[projects.'<path>'] trust_level = "trusted"`). Nothing else in those files is touched.
 */
export function ensureAgentTrust(agent,worktree,{home=os.homedir()}={}){
  const absolute=path.resolve(String(worktree??''));
  if(!absolute)return {ok:false,agent,reason:'no worktree'};
  try{
    if(agent==='claude'){
      const file=path.join(home,'.claude.json');
      let config={};
      try{config=JSON.parse(fs.readFileSync(file,'utf8'));}catch{config={};}
      if(!config||typeof config!=='object'||Array.isArray(config))config={};
      config.projects=config.projects&&typeof config.projects==='object'?config.projects:{};
      const keys=[absolute,absolute.replaceAll('\\','/')];
      const known=keys.find(key=>config.projects[key]&&typeof config.projects[key]==='object');
      if(known&&config.projects[known].hasTrustDialogAccepted===true)return {ok:true,agent,worktree:absolute,action:'already-trusted'};
      const entry=known?config.projects[known]:{allowedTools:[],mcpContextUris:[],enabledMcpjsonServers:[],disabledMcpjsonServers:[]};
      config.projects[known??absolute]={...entry,hasTrustDialogAccepted:true,hasClaudeMdExternalIncludesApproved:entry.hasClaudeMdExternalIncludesApproved??false,hasClaudeMdExternalIncludesWarningShown:entry.hasClaudeMdExternalIncludesWarningShown??false};
      fs.writeFileSync(file,`${JSON.stringify(config,null,2)}\n`);
      return {ok:true,agent,worktree:absolute,action:'trusted'};
    }
    if(agent==='codex'){
      const file=path.join(home,'.codex','config.toml');
      let text='';
      try{text=fs.readFileSync(file,'utf8');}catch{text='';}
      // Codex writes the project key lower-cased with backslashes on Windows; the same spelling is matched here.
      const key=process.platform==='win32'?absolute.toLowerCase():absolute;
      const escaped=key.replaceAll('\\','\\\\');
      const present=new RegExp(`^\\[projects\\.(?:'${key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}'|"${escaped.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}")\\]\\s*\\r?\\ntrust_level\\s*=\\s*"trusted"`,'m');
      if(present.test(text))return {ok:true,agent,worktree:absolute,action:'already-trusted'};
      fs.mkdirSync(path.dirname(file),{recursive:true});
      const block=`${text.length&&!text.endsWith('\n')?'\n':''}${text.length?'\n':''}[projects.'${key}']\ntrust_level = "trusted"\n`;
      fs.appendFileSync(file,block);
      return {ok:true,agent,worktree:absolute,action:'trusted'};
    }
    return {ok:true,agent,worktree:absolute,action:'no-dialog'};
  }catch(error){return {ok:false,agent,worktree:absolute,reason:String(error?.message??error)};}
}
function launchCandidate(orca,{cwd,candidate,taskId,taskRecord,displayName,expectedPath,attest,wait,trust=ensureAgentTrust}){
  if(candidate.launch==='command-terminal')return launchCommandTerminalCandidate(orca,{cwd,candidate,taskId,displayName,wait});
  const trusted=trust(candidate.selection?.orcaLaunch?.agent??candidate.workerParams?.agent,expectedPath??cwd);
  const params={...candidate.workerParams,task:taskId};
  let started=orca.invoke('worker-start',params,{cwd});
  if(started.outcome==='ok'&&started.receipt&&typeof started.receipt==='object')started={...started,receipt:{...started.receipt,trust:trusted}};
  const dispatchId=dispatchIdFromReceipt(started.receipt);
  let recovery=null;
  // The stall is read from the whole receipt: the reason field alone missed the flat `result.lastError` Orca prints.
  if(started.outcome!=='ok'&&dispatchId&&/agent_prompt_stalled/.test(`${started.reason??''} ${getPath(started.receipt,'error.code')??''} ${JSON.stringify(started.receipt?.result??{})}`)){
    recovery=recoverStagedPrompt(orca,{cwd,started,dispatchId,wait});
    if(recovery.ok)started=recovery.started;
  }
  if(started.outcome!=='ok'){
    const ownTerminal=(getPath(started.receipt,'result.residualResources')??getPath(started.receipt,'result.effects')??[]).find(e=>e?.kind==='terminal'&&e?.role==='agent')?.id??null;
    const settlement=dispatchId&&started.effectState!=='none'?settleDispatch(orca,dispatchId,{cwd,reason:`worker-start ${started.outcome}`,terminalHandle:ownTerminal}):null;
    const effectState=settlement?settlement.effectState:started.effectState==='unknown'&&!dispatchId?'unknown':started.effectState;
    return {ok:false,dispatchId,effectState,reason:started.reason??`worker-start ${started.outcome}`,stage:started.stage,call:started,settlement,trust:trusted,
      ...(recovery?{recovery:{ok:recovery.ok,reason:recovery.reason??null,action:recovery.action??null}}:{})};
  }
  need(dispatchId,'Orca worker-start receipt is missing the supervised Dispatch');
  const ownTerminal=(getPath(started.receipt,'result.effects')??getPath(started.receipt,'result.residualResources')??[]).find(e=>e?.kind==='terminal'&&e?.role==='agent')?.id??null;
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
  return {ok:true,dispatchId,terminal:attestation.terminalHandle,attestation,titleDrift:!canonical,call:started,taskRecord,recovery};
}

const STAGED_PROMPT=/(^|\n)\s*❯\s*\S|Pasted Content|Press up to edit queued messages/;
/**
 * A managed Claude sometimes leaves the delivered prompt staged in its input box (long specs): Orca reports
 * agent_prompt_stalled although the agent is alive. One verified Enter submits it; anything else is fenced.
 */
function recoverStagedPrompt(orca,{cwd,started,dispatchId,wait=sleepSync}){
  // The agent terminal is named in the receipt's effects, or - when a flat receipt lists none - by the worker
  // record Orca keeps for the Dispatch; without it the staged prompt cannot be submitted and the launch fails.
  let terminal=(getPath(started.receipt,'result.residualResources')??getPath(started.receipt,'result.effects')??[]).find(e=>e?.kind==='terminal'&&e?.role==='agent')?.id??null;
  if(!terminal){const shown=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});terminal=getPath(shown.receipt,'result.worker.agent_terminal_handle')??getPath(shown.receipt,'result.terminal.handle')??null;}
  if(!terminal)return {ok:false,reason:'no agent terminal in the stalled receipt nor in the worker record'};
  const read=orca.invoke('terminal-read',{terminal,screen:true},{cwd});
  const screen=read.outcome==='ok'?screenText(read.receipt):'';
  if(!STAGED_PROMPT.test(screen))return {ok:false,reason:'prompt is not staged on the screen',terminal};
  const submitted=orca.invoke('terminal-send',{terminal,enter:true},{cwd});
  wait(4000);
  const show=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});
  const state=resultOf(show.receipt)?.worker?.state??null;
  if(show.outcome!=='ok'||!['ready','running'].includes(state))return {ok:false,reason:`worker is ${state??'unknown'} after submitting the staged prompt`,terminal,submitted:submitted.outcome};
  const receipt={...started.receipt,ok:true,result:{...(started.receipt?.result??{}),state,dispatchId,effects:[{kind:'terminal',role:'agent',id:terminal},{kind:'dispatch_input',state:'accepted'}]}};
  return {ok:true,terminal,action:'submitted-staged-prompt',started:{...started,outcome:'ok',effectState:'committed',reason:null,receipt}};
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

function runChain(orca,{cwd,request,candidates,taskId,taskRecord,attest,expectedPath,wait}){
  const attempts=[];
  for(const [index,candidate] of candidates.entries()){
    const result=launchCandidate(orca,{cwd,candidate,taskId,taskRecord,displayName:request.displayName,expectedPath,attest:attest.bind(null,candidate.selection),wait});
    if(result.ok)return {ok:true,candidate,result,attempts};
    attempts.push(attemptRecord(candidate,{dispatchId:result.dispatchId,effectState:result.effectState,reason:result.reason,stage:result.stage??null,settlement:result.settlement,...(result.trust?{trust:result.trust}:{}),...(result.recovery?{recovery:result.recovery}:{})}));
    if(result.effectState!=='none')return {ok:false,exhausted:false,stopReason:'partial-or-unknown-effects',attempts};
    // A settled attempt leaves the Task blocked or failed; only a ready Task accepts the next candidate.
    if(index<candidates.length-1&&result.dispatchId){
      const reissued=orca.invoke('task-update',{id:taskId,status:'ready',run:request.runId,from:request.from,result:JSON.stringify({reissuedAfter:result.dispatchId,reason:'candidate-fell-through'})},{cwd});
      if(reissued.outcome!=='ok'){attempts.at(-1).reissue={outcome:reissued.outcome,reason:reissued.reason};return {ok:false,exhausted:false,stopReason:'task-not-reissuable',attempts};}
    }
  }
  return {ok:false,exhausted:true,stopReason:'chain-exhausted',attempts};
}

const SWEEP='starci/orca-supervised-sweep@1';
const DEAD_TITLE=/npm view @qwen-code|^Report task outcome|^Terminal \d+$|^\s*$/i;
/** Close dead terminals in this workflow worktree: settled-dispatch terminals and residual agent terminals; never a live worker, Monitor or Coordinator. */
export function sweepWorktree(orca,{cwd,from,keep=[]}){
  const listed=orca.invoke('terminal-list',{},{cwd});
  need(listed.outcome==='ok',`terminal list failed: ${listed.reason}`);
  const workers=orca.invoke('worker-list',{},{cwd});
  const rows=getPath(workers.receipt,'result.workers')??[];
  // A command-terminal operation shows as unsupervised with an active Dispatch: it is live.
  const isLive=w=>['ready','running','starting'].includes(w.workerState)||(w.workerState==='unsupervised'&&['dispatched','pending','ready'].includes(w.dispatchStatus));
  const live=new Set(rows.filter(isLive).map(w=>w.agentTerminalHandle));
  const settled=new Set(rows.filter(w=>!isLive(w)&&['failed','abandoned','succeeded','stop_unknown','unsupervised'].includes(w.workerState)&&['failed','completed','abandoned'].includes(w.dispatchStatus??'failed')).map(w=>w.agentTerminalHandle));
  const protect=new Set([from,...keep].filter(Boolean));
  const normalize=value=>path.resolve(String(value??'')).replaceAll('\\','/').toLowerCase();
  const closed=[],kept=[];
  for(const terminal of getPath(listed.receipt,'result.terminals')??[]){
    if(normalize(terminal.worktreePath)!==normalize(cwd))continue;
    const handle=terminal.handle,title=terminal.title??'';
    if(protect.has(handle)||live.has(handle)){kept.push({handle,title,reason:protect.has(handle)?'protected':'live-worker'});continue;}
    if(!(settled.has(handle)||DEAD_TITLE.test(title))){kept.push({handle,title,reason:'unknown-ownership'});continue;}
    const result=orca.invoke('terminal-close',{terminal:handle},{cwd});
    closed.push({handle,title,outcome:result.outcome,reason:result.reason});
  }
  return {schema:SWEEP,worktree:cwd,closed,kept};
}

/**
 * Launch one attested operation agent. `candidates` is the allocator's seam: pass the one resolved
 * selection it chose and the launcher tries exactly that candidate instead of walking the chain.
 */
export function startOperation(input,{orca=createOrcaCalls(),wait,candidates=null}={}){
  const request=buildOperationLaunch(candidates===null?input:{...input,candidates}),cwd=request.worktree.path;
  const run=orca.invoke('run-show',request.runAttestationParams,{cwd});
  need(run.outcome==='ok',`Nested workflow Run attestation failed: ${run.reason}`);
  const observedRun=resultOf(run.receipt)?.run;
  need(observedRun?.id===request.runId,'Nested workflow Run attestation failed');
  if(observedRun?.coordinator_handle!==request.from){const error=Error('Operation can be launched only by the exact Workflow Monitor bound as nested Run coordinator');error.code='ORCA_COORDINATOR_MISMATCH';error.effectState='none';error.observedCoordinator=observedRun?.coordinator_handle??null;throw error;}
  const created=orca.invoke('task-create',request.taskParams,{cwd});
  if(created.outcome!=='ok'){const error=Error(`Operation Task creation failed (${created.effectState}): ${created.reason}`);error.code='ORCA_TASK_CREATE_FAILED';error.effectState=created.effectState??'unknown';throw error;}
  const task=taskFromReceipt(created.receipt);
  need(task.display_name===request.displayName,`Created Task name mismatch: ${task.display_name??'unknown'}`);
  const attest=(selection,{workerShow,phase})=>attestOperationWorker({taskId:task.id,operation:request.operation,scope:request.scope,selection,taskRecord:task,workerShow,phase});
  const chain=runChain(orca,{cwd,request,candidates:request.candidates,taskId:task.id,taskRecord:task,attest,expectedPath:cwd,wait});
  const attempts=[...request.skipped,...chain.attempts];
  if(chain.ok)return {schema:OP_LAUNCH,ok:true,task,dispatchId:chain.result.dispatchId,terminal:chain.result.terminal,selection:chain.candidate.selection,launch:chain.candidate.launch,attestation:chain.result.attestation,titleDrift:chain.result.titleDrift??false,attempts};
  const effectState=chain.exhausted&&attempts.length>0&&attempts.every(attempt=>attempt.effectState==='none')?'none':'unknown';
  return {schema:OP_LAUNCH,ok:false,task,exhausted:chain.exhausted,effectState,stopReason:chain.stopReason,attempts,
    recovery:chain.exhausted?'report-workflow-boundary-worker_failed':'reconcile-residual-resources-before-retry'};
}

/**
 * The usage block names the one command entry first. `bin/starci.mjs` forwards argv to this `main` unchanged,
 * so a reader who is told the entry never has to know that a module path exists; the direct path is printed
 * once underneath, because the kernel and the supervisor still spawn this file by path and a person reading a
 * spawn log must be able to match it to a command.
 */
function usage(){return `Usage (the one command line; <skill root> is the installed .claude directory):
  node <skill root>/bin/starci.mjs <command> ... - and the same command run directly is
  node <skill root>/.dist/hosts/orca/launch.mjs <command> ...

  node bin/starci.mjs start-op --run <nested-workflow-run> --workflow-task <parent-workflow-task> --from <monitor-terminal> --worktree <relative-path> --operation <op> --scope <scope> --spec-file <relative-file> [--skip <target:reason[,target:reason]>] [--dry-run]
    --skip records a Monitor-verified no-effect failure for a chain target (reason from registry fallback.allowedReasons) so the chain starts at the next candidate
  node bin/starci.mjs settle --dispatch <dispatch> [--worktree <relative-path>] [--terminal <own-agent-terminal>] [--close true]
  node bin/starci.mjs sweep --worktree <relative-path> --from <monitor-terminal> [--keep <handle,handle>]
  node bin/starci.mjs notify --terminal <monitor-terminal> (--file <message-file> | --text <text>) [--worktree <relative-path>]
  node bin/starci.mjs report --run <run> --from <own-terminal> --task <task> --dispatch <dispatch> --outcome <done|partial|failed|ask|blocked> --summary <text> [--files a,b] [--checks-file <json>] [--open a,b] [--question <text> --options a,b] [--blocker <kind:detail>] [--credential-request-file <safe JSON>] [--kind op|workflow --branch <b> --head <sha> --gates name=status,...] [--reports-dir <dir>] [--capability <dcap>] [--worktree <relative-path>]
  node bin/starci.mjs wait --run <run> --from <own-terminal> [--timeout-ms 900000] [--tick-ms 120000] [--reports-dir <dir>] [--stalled-after-ms <ms>] [--worktree <relative-path>]
  node bin/starci.mjs workflow-goal --job <text> [--id <workflow-id>] [--lane [<name>]] [--inputs a,b] [--gates a,b] [--ledger work|plan] [--scope feature1,feature2] [--reintake feature] [--migrate feature1,feature2|all] [--ledger-root <path>] [--allocation codex-agent=5,claude-agent=3,qwen-agent=2] [--host <path-to-.claude>] [--worktree <relative-path>]
    --lane gives the workflow a worktree of its own: an Orca worktree of this repository on a new branch cut
    from the branch you are on, as the top-level row [Workflow] <id> (default name: the workflow id). The
    kernel and every operation run in it, and its branch is merged back into the base branch when the
    workflow finishes done. Two workflows never share a worktree.
    turns the job into a goal and prints it for the one user approval. With a Work tree under
    <repo>/.starciwork/features the ledger is that tree (--ledger work, the default): the ops are derived
    from the eligible nodes in --scope and a node without an allowlist or checks is named as needing you.
    Without one the ledger is assessed by a model (--ledger plan).
    A repository that shares another repository's tree (a frontend working its backend's Work) is routed by
    the host registry <host>/../.workspaces/projects/*/work.json, so --host is what makes a frontend job
    resolvable; --ledger-root names the tree outright instead. The workflow directory and every Work commit
    then live in the owner repository, while code, checks and code commits stay in this worktree. A node that
    names no repository belongs to the side its layout sits in, so implementation/frontend/** is never a
    backend job's work and implementation/backend/** is never a frontend's.
  node bin/starci.mjs workflow-answer --id <workflow-id> --op <decision.prepare-or-provision.ask-op> [--choice <n>] [--note "<answer>"] [--envelope '<json>' | --envelope-file <file>] [--host <path-to-.claude>] [--worktree <relative-path>]
    the owner's answer to a question the kernel prepared (needUser kind 'decision'): the option number and/or a note; the answer reaches the paused operation in its next contract.
    --envelope carries the typed answer {"questionId","digest","goalRev","answers":{<field id>:<option id | [ids] | text | yes/no>}}; an answer outside the offered options is rejected and the question is asked again.
  node bin/starci.mjs workflow-approve --id <workflow-id> [--allocation <runtime=slots,...>] [--allow-dynamic N] [--accept-critique "<reason>"] [--ledger-root <path>] [--host <path-to-.claude>] [--worktree <relative-path>]
    --accept-critique is the owner overriding a goal critique that answered refuse: the reason is recorded and
    the kernel never asks for it again.
  node bin/starci.mjs workflow-run --id <workflow-id> [--from <own-terminal> --run <run>] [--launch-file <file>] [--allocation <runtime=slots,...>] [--max-iterations N] [--ledger-root <path>] [--host <path-to-.claude>] [--worktree <relative-path>]
  node bin/starci.mjs workflow-retry --id <workflow-id> --runtime-pin <pin-record.json> [--journal-file <path>] [--host <path-to-.claude>] [--worktree <relative-path>]
    After the kernel is paused, settle native dispatches and retry unfinished active operations with fresh
    contexts on the sealed build named by the pin. A state written by an earlier build is migrated here: op fields,
    the engine record and the journal location move to this build's shape on the record, never by hand.
    runs the kernel loop: up to 10 operation agents in one worktree, machine-verified acceptance, gates, final report.
    On the Work ledger every accepted slice is written back into its node (state, completion, evidence) and
    committed with a "Work: <node id>" trailer - in the repository that owns the tree, which is this one
    unless the product routes the Work elsewhere.
  node bin/starci.mjs workflow-amend --id <workflow-id> --amendment <record.yaml> [--host <path-to-.claude>] [--worktree <relative-path>]
    while workflow-stop is present and its controller has exited, bind a starci/workflow-amendment@1 owner grant
    to this exact frozen goal identity. The grant and the coordinator application decision are separate; accepted
    work, receipts, decisions, evidence and unknown effects are preserved. Added scope needs an explicit path ceiling.
  node bin/starci.mjs op-contract --workflow <workflow-id> --op <op> [--attempt N] [--dispatch <id>] [--json true] [--worktree <relative-path>]
    prints the contract markdown the kernel wrote for this operation attempt (--json prints {markdown,context}).
    The dispatch prompt tells the worker to run exactly this to read its own contract.
  node bin/starci.mjs workflow-export --id <workflow-id> --to <directory> [--worktree <relative-path>]
    writes today's human-readable file layout (state.json, events.jsonl, goal.md/json, reports/, contracts/,
    checks/) from the workflow's ledger rows, for a reader or a tool that still wants files on disk.
  node bin/starci.mjs ledger-verify --repo <ledger-repository-root> [--id <workflow-id>]
    walks the hash chain of one workflow's events, or every workflow the ledger holds when --id is omitted,
    and checks each against the tracked .starciwork/ledger-anchor.json head (§12); ok:false the moment a
    chain is broken or an anchored head is not reached (ledger-behind-anchor, ledger-identity-mismatch), or
    the ledger file itself is gone while the anchor is still tracked (ledger-missing).
  node bin/starci.mjs ledger-anchor --write --repo <ledger-repository-root> [--id <workflow-id>]
    regenerate .starciwork/ledger-anchor.json from a healthy ledger: one workflow with --id, every workflow
    otherwise. A workflow whose chain does not verify is refused, never anchored.
  node bin/starci.mjs ledger-migrate --repo <ledger-repository-root> [--journal-file <old-journal.sqlite>] [--machine-file <machine.sqlite>] [--dry-run] [--archive true]
    forwards to scripts/ledger-migrate.mjs: folds .starciwork/_local/workflows/<id> plus the retired journal's
    rows for it into .starciwork/runtime.sqlite, per workflow, refusing a workflow a live kernel lock or an
    unreconciled generation still owns.
  node bin/starci.mjs ledger-prune --repo <ledger-repository-root> [--retire <id[,id]>] [--vacuum true] [--dry-run]
    retire the rows of every workflow the ledger itself proves settled (finished, or named with --retire); a
    workflow with live leases or unsettled jobs is kept by the ledger itself.
  node bin/starci.mjs ledger-retire --repo <ledger-repository-root> [--delete true]
    the whole runtime.sqlite, only when nothing in it is live and nothing wrote to it inside the quiet window;
    deleted only with --delete true.
  node bin/starci.mjs journal-prune | journal-retire
    renamed ledger-prune / ledger-retire (--repo <root>, not --journal-file): refused with a one-line pointer, exit 2.
  node bin/starci.mjs workflow-status --id <workflow-id> [--json true] [--ledger-root <path>] [--host <path-to-.claude>] [--worktree <relative-path>]
    prints one status view of the workflow, derived from its own files: kernel liveness, runtimes, running
    and blocked operations, the ledger by feature, reviews, the validator, what needs you, the rate and the
    last events. --json true prints the machine shape (the kernel's own status fields plus view).
  node bin/starci.mjs workflow-list [--json true] [--worktree <relative-path>]
    one line per workflow of this repository: phase, operations done, kernel liveness, last event age
  node bin/starci.mjs workflow-tail --id <workflow-id> [--lines 40] [--all true] [--follow true] [--poll-ms 1500] [--color true|false] [--ledger-root <path>] [--host <path-to-.claude>] [--worktree <relative-path>]
    the workflow's event log as it happens, one line per event: launches and allocations cyan, accepted and
    proven work green, waits and deferrals yellow, blocks and failures red, owner and manager events magenta.
    --follow keeps the tail open; heartbeat noise is hidden unless --all asks for it; colour follows the
    terminal unless --color or NO_COLOR says otherwise. --json true prints the raw events instead.
  node bin/starci.mjs workflow-ops --id <workflow-id> [--watch true] [--poll-ms 2000] [--color true|false] [--json true] [--ledger-root <path>] [--host <path-to-.claude>] [--worktree <relative-path>]
    the schedule on one screen: each live op's runtime and pinned model with the last allocation reason,
    what each waiting op is held by, what each blocked op is blocked on, and how oversized work was split.
    --watch repaints every --poll-ms; the screen clears only on a terminal. --json true prints the digest record.
  node bin/starci.mjs workflow-stop --id <workflow-id> [--ledger-root <path>] [--host <path-to-.claude>] [--worktree <relative-path>]
    approve, status and stop find the workflow directory where the goal put it, so a job whose ledger is
    owned by another repository is reached with the same --host (or --ledger-root) the goal was given.
  node bin/starci.mjs workflow-lane-close --id <workflow-id> [--host <path-to-.claude>] [--worktree <relative-path>]
    removes the merged lane worktree from Orca and from git and keeps its branch. Refused while the kernel is
    alive (workflow-stop first) and while the lane has not been merged into its base branch.
  node bin/starci.mjs workflow-supervise --host <path-to-.claude> [--once true] [--id <workflow-id>] [--poll-ms 60000] [--health-ms 1500000] [--worktree <repo>]
  node bin/starci.mjs workflow-inputs --session <kernel-owned-session-file>
    the independent credential helper; the kernel creates and reconciles its session and browser page.
  node bin/starci.mjs verify
  Every command accepts --host-adapter orca|headless (default orca; headless when STARCI_HOST=headless). The
  headless host runs the same kernel without Orca: operations are one-at-a-time claude -p / codex exec
  processes in the worktree, reports reach the kernel through a mailbox file, and a kind that needs a host
  capability the headless host lacks (interface.asset needs design-tool, which model/hosts.yaml declares only
  for the Orca host) is refused as host-unsupported.`;}

const KERNEL_COMMANDS=['workflow-goal','workflow-amend','workflow-approve','workflow-answer','workflow-run','workflow-retry','workflow-status','workflow-tail','workflow-ops','workflow-stop','workflow-lane-close','workflow-supervise','workflow-inputs'];
/** Read-only views of the workflow store: they open no kernel, call no Orca and never write. */
const VIEW_COMMANDS=['workflow-list'];
/** Worker IPC and export against one workflow's own ledger rows: no kernel, no Orca. */
const STORE_COMMANDS=['op-contract','workflow-export'];
/** Operator maintenance/inspection of the repository ledger `.starciwork/runtime.sqlite`: no kernel, no Orca. */
const LEDGER_COMMANDS=['ledger-verify','ledger-migrate','ledger-prune','ledger-retire','ledger-anchor'];
/** §12: the small, tracked, human-readable counter-record the self-consistent hash chain cannot be. */
const ANCHOR_SCHEMA='starci/ledger-anchor@1';
const anchorFileFor=repoRoot=>path.join(repoRoot,'.starciwork','ledger-anchor.json');
function readAnchor(repoRoot){
  try{const parsed=JSON.parse(fs.readFileSync(anchorFileFor(repoRoot),'utf8'));return plain(parsed)&&parsed.schema===ANCHOR_SCHEMA?parsed:null;}catch{return null;}
}
/** Write temp + rename: a reader never sees a half-written anchor. */
function writeAnchorAtomic(repoRoot,anchor){
  const file=anchorFileFor(repoRoot);
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const tmp=`${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp,`${JSON.stringify(anchor,null,2)}\n`);
  fs.renameSync(tmp,file);
  return file;
}
/** One workflow's current head, straight from the ledger's own rows: null when nothing is recorded yet. */
function workflowHead(db,workflowId){
  const event=db.prepare('SELECT seq,digest FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1').get(workflowId);
  if(!event)return null;
  const snapshot=db.prepare('SELECT checkpoint_id,generation FROM state_snapshots WHERE workflow_id=? ORDER BY snapshot_id DESC LIMIT 1').get(workflowId);
  return {generation:snapshot?.generation??0,checkpointId:snapshot?.checkpoint_id??null,eventsHead:event.digest,seq:event.seq,at:Date.now()};
}
/**
 * §12's per-workflow check: the ledger being ahead of (or never having reached) its anchor is normal and never
 * refuses; the ledger lacking the anchored head, or belonging to a different ledger identity, does.
 */
function anchorStatus({db,workflowId,anchor,ledgerId}){
  const anchored=anchor?.workflows?.[workflowId]??null;
  if(!anchored)return {ok:true,checked:false,reason:null};
  if(anchor.ledgerId&&anchor.ledgerId!==ledgerId)return {ok:false,checked:true,reason:'ledger-identity-mismatch'};
  const head=db.prepare('SELECT digest FROM events WHERE workflow_id=? AND seq=?').get(workflowId,anchored.seq);
  const settled=db.prepare('SELECT 1 FROM state_snapshots WHERE workflow_id=? AND generation>=? LIMIT 1').get(workflowId,anchored.generation);
  return head&&head.digest===anchored.eventsHead&&settled?{ok:true,checked:true,reason:null}:{ok:false,checked:true,reason:'ledger-behind-anchor'};
}
/** `ledger-anchor --write`: regenerate the anchor from a healthy ledger. A broken chain is never anchored. */
function writeAnchor({repoRoot,file,options}){
  const inspection=inspectLedger({file}),ledgerId=ledgerIdFor(file);
  try{
    const existing=readAnchor(repoRoot);
    const ids=options.id?[options.id]:inspection.workflows().map(entry=>entry.workflowId);
    // A whole-ledger rewrite starts from a clean map (stale entries of a retired workflow do not linger);
    // a scoped `--id` rewrite keeps every other entry the existing anchor already carried, from this same ledger.
    const workflows=options.id&&existing?.ledgerId===ledgerId?{...existing.workflows}:{};
    const written=[],refused=[];
    for(const workflowId of ids){
      const chain=inspection.verifyChain({workflowId});
      if(!chain.ok){refused.push({workflowId,reason:'ledger-chain-broken',brokenAt:chain.brokenAt});continue;}
      const head=workflowHead(inspection.db,workflowId);
      if(!head){refused.push({workflowId,reason:'no recorded event to anchor'});continue;}
      workflows[workflowId]=head;written.push(workflowId);
    }
    const anchor={schema:ANCHOR_SCHEMA,ledgerId,updatedAt:Date.now(),workflows};
    const anchorFile=writeAnchorAtomic(repoRoot,anchor);
    return {schema:ANCHOR_SCHEMA,command:'ledger-anchor',ok:refused.length===0,repo:repoRoot,file:anchorFile,ledgerId,written,refused};
  }finally{inspection.close();}
}
/**
 * 1.0.3 named these `journal-prune`/`journal-retire` against a shared `--journal-file`; 1.0.4 has one ledger
 * per repository, so the operator names `--repo <root>` instead. The old names are refused with a pointer to
 * the new one rather than silently reinterpreting `--journal-file` as `--repo`.
 */
const RENAMED_COMMANDS={'journal-prune':'ledger-prune','journal-retire':'ledger-retire'};
/** A workflow the ledger still holds live rows for is not retired by age alone; `--repo`-scoped, same as journal-retire was. */
const LEDGER_QUIET_MS=30*60*1000;

/** `ledger-prune`: retire every workflow the ledger itself proves settled (finished, or named by --retire) and give the space back. */
function pruneLedger({repoRoot,file,options}){
  const dryRun=options['dry-run']===true;
  const named=new Set(String(options.retire??'').split(',').map(item=>item.trim()).filter(Boolean));
  const handle=dryRun?inspectLedger({file}):openLedger({file});
  const decisions=[];
  try{
    for(const entry of handle.workflows()){
      const row=handle.db.prepare('SELECT finished_json FROM workflows WHERE workflow_id=?').get(entry.workflowId);
      const live=entry.leases.length||entry.jobs.length;
      let decision,reason;
      if(live){decision='kept';reason=`live rows: ${entry.leases.length} lease(s), ${entry.jobs.length} unsettled job(s)`;}
      else if(named.has(entry.workflowId)){decision='retire';reason='named by --retire';}
      else if(row?.finished_json){decision='retire';reason='its state is finished';}
      else {decision='kept';reason='its state is unfinished';}
      let removed=null;
      if(decision==='retire'&&!dryRun){
        const result=handle.retireWorkflow(entry.workflowId);
        if(result.ok)removed=result.removed;else{decision='kept';reason=result.reason;}
      }
      decisions.push({workflowId:entry.workflowId,decision,reason,rows:entry.rows,...(removed?{removed}:{})});
    }
    if(options.vacuum==='true'&&!dryRun)handle.db.exec('VACUUM');
  }finally{handle.close();}
  return {schema:'starci/ledger-prune@1',command:'ledger-prune',ok:true,repo:repoRoot,file,dryRun,decisions};
}
/** `ledger-retire`: the whole ledger file, only when nothing in it is live and nothing wrote to it recently. */
function retireLedger({repoRoot,file,options}){
  const inspection=inspectLedger({file});
  let live;
  try{live=inspection.workflows().filter(entry=>entry.leases.length||entry.jobs.length).map(entry=>({workflowId:entry.workflowId,leases:entry.leases.length,jobs:entry.jobs.length}));}
  finally{inspection.close();}
  const quietFor=Date.now()-fs.statSync(file).mtimeMs,recentlyWritten=quietFor<LEDGER_QUIET_MS;
  const retirable=!live.length&&!recentlyWritten,remove=options.delete==='true';
  const deleted=[];
  if(retirable&&remove)for(const suffix of ['','-journal','-wal','-shm']){const sibling=`${file}${suffix}`;if(fs.existsSync(sibling)){fs.rmSync(sibling,{force:true});deleted.push(sibling);}}
  return {schema:'starci/ledger-retire@1',command:'ledger-retire',ok:retirable,repo:repoRoot,file,orphanedLiveRows:live,quietForMs:Math.round(quietFor),quietMs:LEDGER_QUIET_MS,retirable,deleted,
    ...(retirable?{}:{reason:live.length?'the ledger still holds live reservations or unsettled jobs':`the ledger was written ${Math.round(quietFor/60000)} min ago, inside the ${Math.round(LEDGER_QUIET_MS/60000)} min quiet window`}),
    ...(retirable&&!remove?{next:'run again with --delete true to remove the file'}:{})};
}

/**
 * A command may answer with text instead of a record: `print` is written verbatim by the CLI, so a status
 * page reaches a terminal as a page and not as a JSON string with escaped newlines in it.
 */
const printed=(schema,command,print,rest={})=>({schema,command,...rest,print});

export function main(argv=process.argv.slice(2),{orca,wait,env=process.env}={}){
  const {command,options}=parseArgs(argv);
  if(Object.hasOwn(RENAMED_COMMANDS,command)){
    const to=RENAMED_COMMANDS[command];
    return {schema:'starci/command-renamed@1',command,ok:false,exitCode:2,renamedTo:to,
      print:`starci: '${command}' is now '${to}' (it takes --repo <root>, the one ledger of that repository, not --journal-file). Run: starci ${to} --repo <root> ...\n`};
  }
  need(['start-op','settle','sweep','verify','notify','report','wait',...KERNEL_COMMANDS,...VIEW_COMMANDS,...STORE_COMMANDS,...LEDGER_COMMANDS].includes(command),usage());
  if(command==='workflow-inputs'){
    need(Object.keys(options).length===1&&typeof options.session==='string'&&options.session.trim(),
      'Use starci workflow-inputs --session <kernel-owned-session-file>. The kernel owns this helper.');
    return serveWorkflowInputs(path.resolve(options.session));
  }
  if(VIEW_COMMANDS.includes(command)){
    // Reading a workflow needs no Orca runner at all, so a status page works where Orca is not even installed.
    const workflows=buildList({repoRoot:repositoryRoot(options.worktree?exactWorktree(options.worktree).path:process.cwd())});
    return options.json==='true'?{schema:WORKFLOW_LIST,command,workflows}:printed(WORKFLOW_LIST,command,renderList(workflows),{workflows:workflows.length});
  }
  if(STORE_COMMANDS.includes(command)){
    // Worker IPC against one workflow's own ledger rows: no kernel, no Orca - a worker in a worktree with no
    // multi-agent runner installed still reaches its contract.
    const cwd=options.worktree?exactWorktree(options.worktree).path:process.cwd();
    if(command==='op-contract'){
      const attempt=options.attempt!==undefined?Number(options.attempt):null;
      need(attempt===null||(Number.isInteger(attempt)&&attempt>0),'--attempt must be a positive integer');
      const store=createStore({repoRoot:repositoryRoot(cwd),id:required(options.workflow,'workflow id')});
      try{
        const contract=store.readContract(required(options.op,'operation id'),attempt);
        need(contract,`No contract recorded for ${options.op}${attempt?` attempt ${attempt}`:' (any attempt)'}`);
        need(!options.dispatch||!contract.dispatchId||contract.dispatchId===options.dispatch,
          `Contract for ${options.op} attempt ${contract.attempt} was written for dispatch ${contract.dispatchId}, not ${options.dispatch}`);
        return options.json==='true'
          ?{schema:'starci/op-contract@1',command,workflow:store.id,op:options.op,attempt:contract.attempt,markdown:contract.markdown,context:contract.context}
          :printed('starci/op-contract@1',command,contract.markdown.endsWith('\n')?contract.markdown:`${contract.markdown}\n`,{workflow:store.id,op:options.op,attempt:contract.attempt});
      }finally{store.close();}
    }
    // workflow-export
    const store=createStore({repoRoot:repositoryRoot(cwd),id:required(options.id,'workflow id')});
    try{
      // §3: every copy checkpoints (TRUNCATE) first, so a WAL-mode ledger's -wal/-shm are folded back before
      // anything reads it as a snapshot. A DELETE-mode handle answers the pragma as a harmless no-op.
      store.ledger.db.exec('PRAGMA wal_checkpoint(TRUNCATE)');
      const result=store.exportTo(path.resolve(required(options.to,'export directory')));
      return {schema:'starci/workflow-export@1',command,id:store.id,...result};
    }finally{store.close();}
  }
  if(LEDGER_COMMANDS.includes(command)){
    // Operator maintenance/inspection of the repository ledger: no kernel, no Orca.
    if(command==='ledger-migrate'){
      // Imported by path, per contract: if s7's script is not on this branch yet, the import error names it.
      return (async()=>{
        const {migrateLedger}=await import('../../scripts/ledger-migrate.mjs');
        const summary=await migrateLedger({repoRoot:path.resolve(required(options.repo,'ledger repository root')),
          ...(options['journal-file']?{journalFile:path.resolve(options['journal-file'])}:{}),
          ...(options['machine-file']?{machineFile:path.resolve(options['machine-file'])}:{}),
          dryRun:options['dry-run']===true,archive:options.archive==='true'});
        return {schema:'starci/ledger-migrate@1',command,...summary};
      })();
    }
    const repoRoot=path.resolve(required(options.repo,'ledger repository root'));
    const file=ledgerFileFor(repoRoot);
    if(command==='ledger-verify'){
      const anchor=readAnchor(repoRoot);
      // §12: a tracked anchor with no ledger file at all is a re-clone (the ledger is untracked, the anchor
      // is not) — the named recovery is restoring a backup or ledger-migrate, never a silent fresh start.
      if(!fs.existsSync(file)){
        if(anchor)return {schema:'starci/ledger-verify@1',command,ok:false,repo:repoRoot,file,reason:'ledger-missing',results:Object.keys(anchor.workflows??{}).map(workflowId=>({workflowId,ok:false,anchor:{ok:false,checked:true,reason:'ledger-missing'}}))};
        need(false,`No ledger at ${file}`);
      }
      const inspection=inspectLedger({file}),ledgerId=ledgerIdFor(file);
      try{
        const ids=options.id?[options.id]:inspection.workflows().map(entry=>entry.workflowId);
        need(ids.length,'ledger-verify found no workflow to check in this ledger; pass --id <id>');
        const results=ids.map(workflowId=>{
          const chain=inspection.verifyChain({workflowId});
          const anchorCheck=anchorStatus({db:inspection.db,workflowId,anchor,ledgerId});
          return {workflowId,...chain,anchor:anchorCheck};
        });
        return {schema:'starci/ledger-verify@1',command,ok:results.every(result=>result.ok&&result.anchor.ok),repo:repoRoot,file,results};
      }finally{inspection.close();}
    }
    need(fs.existsSync(file),`No ledger at ${file}`);
    if(command==='ledger-anchor')return writeAnchor({repoRoot,file,options});
    return command==='ledger-prune'?pruneLedger({repoRoot,file,options}):retireLedger({repoRoot,file,options});
  }
  const adapter=hostAdapterOf(options,env);
  const runner=orca??createHostRunner({adapter,cwd:options.worktree?exactWorktree(options.worktree).path:process.cwd(),env,reportsDir:options['reports-dir']??null});
  if(KERNEL_COMMANDS.includes(command)){
    const cwd=options.worktree?exactWorktree(options.worktree).path:process.cwd();
  if(command==='workflow-supervise')return supervisorMain(options,{cwd:options.worktree?exactWorktree(options.worktree).path:process.cwd(),runner});
    if(command==='workflow-status'){
      // The kernel's own status record stays the machine shape; the view is the page a human reads.
      const status=kernelMain(command,options,{orca:runner,cwd,wait});
      // The view reads the directory the kernel resolved (a named ledger keeps its store beside the tree), not a guess from cwd.
      const view=buildView({repoRoot:repositoryRoot(cwd),id:required(options.id,'workflow id'),dir:status.dir??null});
      return options.json==='true'?{...status,view}:printed(view.schema,command,renderView(view),{id:view.id,dir:view.dir});
    }
    if(command==='workflow-tail'){
      // The same directory resolution as status, then the event log itself - a tail opens no kernel.
      const status=kernelMain('workflow-status',options,{orca:runner,cwd,wait});
      const dir=status.dir??null;
      need(dir,'No workflow directory resolved');
      const all=options.all==='true';
      const lines=Math.max(0,Number.isFinite(Number(options.lines))?Number(options.lines):40);
      const color=options.color!=='false'&&!env.NO_COLOR&&(options.color==='true'||Boolean(process.stdout.isTTY));
      const events=()=>readWorkflowEvents(dir);
      if(options.json==='true')return {schema:'starci/workflow-events@1',command,id:required(options.id,'workflow id'),dir,events:events().slice(-lines)};
      if(options.follow!=='true')return printed('starci/workflow-events@1',command,renderEventTail(events(),{color,all,lines}),{id:required(options.id,'workflow id'),dir});
      // Follow mode streams: the returned promise never settles, the interval keeps the process alive, and
      // SIGINT ends the tail the way every terminal tail ends. The first paint is the last `lines` events;
      // after that only lines the file gained since the last poll print.
      const pollMs=Math.max(200,Number.isFinite(Number(options['poll-ms']))?Number(options['poll-ms']):1500);
      const shown=()=>{const list=events();return all?list:list.filter(event=>!QUIET_EVENTS.has(event?.event));};
      let seen=shown().length;
      const head=shown().slice(-lines);
      if(head.length)process.stdout.write(`${head.map(event=>renderEventLine(event,{color})).join('\n')}\n`);
      const pump=()=>{
        const list=shown(),fresh=list.slice(seen>list.length?0:seen);seen=list.length;
        if(fresh.length)process.stdout.write(`${fresh.map(event=>renderEventLine(event,{color})).join('\n')}\n`);
      };
      return new Promise(()=>{setInterval(pump,pollMs);});
    }
    if(command==='workflow-ops'){
      // The same directory resolution as status and tail, then the digest the workflow's own records support.
      const status=kernelMain('workflow-status',options,{orca:runner,cwd,wait});
      const dir=status.dir??null;
      need(dir,'No workflow directory resolved');
      const color=options.color!=='false'&&!env.NO_COLOR&&(options.color==='true'||Boolean(process.stdout.isTTY));
      const render=()=>renderOpsView(buildOpsView({dir}),{color});
      if(options.json==='true')return {schema:WORKFLOW_OPS,command,id:required(options.id,'workflow id'),dir,view:buildOpsView({dir})};
      if(options.watch!=='true')return printed(WORKFLOW_OPS,command,render(),{id:required(options.id,'workflow id'),dir});
      // Watch repaints the whole digest on a poll. The clear-screen escape is a terminal courtesy: a piped
      // stdout gets the pages one after another, separated by a blank line.
      const pollMs=Math.max(200,Number.isFinite(Number(options['poll-ms']))?Number(options['poll-ms']):2000);
      const paint=()=>{
        let text;try{text=render();}catch(error){text=`workflow-ops: ${error.message}\n`;}
        process.stdout.write(`${process.stdout.isTTY?'\x1b[2J\x1b[H':'\n'}${text}`);
      };
      paint();
      return new Promise(()=>{setInterval(paint,pollMs);});
    }
    return kernelMain(command,options,{orca:runner,cwd,wait});
  }
  if(['report','wait'].includes(command)){
    const cwd=options.worktree?exactWorktree(options.worktree).path:process.cwd();
    return protocolMain(command,{...options,spec:options['spec-file']?specText(options['spec-file']):options.spec},{orca:runner,cwd});
  }
  if(command==='sweep')return sweepWorktree(runner,{cwd:exactWorktree(options.worktree).path,from:required(options.from,'monitor terminal handle'),keep:String(options.keep??'').split(',').filter(Boolean)});
  if(command==='notify')return notifyTerminal(runner,{cwd:options.worktree?exactWorktree(options.worktree).path:process.cwd(),terminal:required(options.terminal,'monitor terminal handle'),file:options.file??null,text:options.text??null});
  if(command==='verify'){const result=runner.verify();return {schema:'starci/orca-live-contract-verification@1',...result,result:undefined};}
  if(command==='settle')return settleDispatch(runner,required(options.dispatch,'dispatch'),{cwd:options.worktree?exactWorktree(options.worktree).path:process.cwd(),reason:'explicit-settle',terminalHandle:options.terminal??null,closeTerminal:options.close==='true'});
  const input={run:options.run,from:options.from,worktree:options.worktree,spec:specText(options['spec-file']),
    workflowTask:options['workflow-task'],operation:options.operation,scope:options.scope,skip:options.skip};
  return options['dry-run']?buildOperationLaunch(input):startOperation(input,{orca:runner,wait});
}

const direct=process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url);
if(direct){
  try{
    const output=await main();
    // A text view prints as text; everything else is the record it always was.
    process.stdout.write(typeof output?.print==='string'?output.print.endsWith('\n')?output.print:`${output.print}\n`:`${JSON.stringify(output,null,2)}\n`);
    if(Number.isInteger(output?.exitCode))process.exitCode=output.exitCode;
    else if(output?.ok===false)process.exitCode=1;
  }catch(error){process.stderr.write(`${JSON.stringify({ok:false,error:{code:error.code??null,message:error.message}},null,2)}\n`);process.exitCode=error?.code===DISK_HEADROOM_CODE?3:1;}
}
