import fs from 'node:fs';
import path from 'node:path';
import {getPath} from './calls.mjs';
import {buildReport,reportBody,repositoryRoot,validateReport} from '../../kernel/reports.mjs';
import {createStore} from '../../kernel/store.mjs';

/**
 * §9: a worker gives and takes its data through the CLI against the workflow's own ledger rows. There is no
 * reports directory any more, so both verbs need the workflow id the contract already told the worker to pass.
 */
const reportRef=(workflow,dispatch)=>`ledger://reports/${workflow}/${dispatch}`;
import {notifyTerminal,settleDispatch,sweepWorktree} from './launch.mjs';
import {DEFAULT_STALLED_AFTER_MS,observe} from './observe.mjs';

/**
 * The operation-side protocol on top of the typed Orca runner: `report` (one typed outcome, file first,
 * signal second) and `wait` (one owned boundary tick that classifies every live worker). 5.0 has no
 * supervisor to bootstrap - the kernel is a local process - so `start-coordinator` is gone with the layer it
 * served. The helpers never improvise Orca calls: every call goes through the contract runner and every
 * result is classified.
 */
export const REPORT_RESULT='starci/orca-report-result@1';
export const WAIT_TICK='starci/orca-wait-tick@1';
export const BOUNDARY_TYPES='worker_done,question,escalation';
export const DEFAULT_HEARTBEAT_GRACE_MS=10*60*1000;

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const resultOf=receipt=>plain(receipt?.result)?receipt.result:receipt;
const csv=value=>String(value??'').split(',').map(item=>item.trim()).filter(Boolean);
const sleepSync=ms=>{if(ms>0)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);};
const FENCED_DELIVERY_REASON='This mailbox Delivery belongs to a fenced consumer generation.';

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}

/** One typed outcome: validate, write the file, send the matching Orca signal once, record the send. */
export function reportOutcome(orca,{cwd,kind='op',run,from,task,dispatch,outcome,summary,files=[],checksFile=null,checks=[],open=[],question=null,blocker=null,credentialRequest=null,credentialRequestFile=null,branch=null,head=null,gates=[],observations=[],workflow=null,capability=null,fileKey=null,opId=null,attempt=null,generation=null,now=Date.now}){
  const workflowId=required(workflow,'workflow id'),key=fileKey??required(dispatch,'dispatch id');
  const store=createStore({repoRoot:repositoryRoot(cwd),id:workflowId});
  try{
  const file=reportRef(workflowId,key);
  const existing=store.readReports().find(row=>row.dispatchId===key);
  if(existing?.sent)return {schema:REPORT_RESULT,ok:false,file,reason:'already-reported',existing:{outcome:existing.outcome,sent:existing.sent}};
  const loadedChecks=checksFile?readJson(path.resolve(cwd,checksFile),null):checks;
  need(Array.isArray(loadedChecks),`Checks file is not a JSON array: ${checksFile}`);
  const request=credentialRequestFile?readJson(path.resolve(cwd,credentialRequestFile),null):credentialRequest;
  need(!credentialRequestFile||request!==null,'Credential request file is missing or invalid JSON.');
  const report=buildReport({kind,outcome,run,task,dispatch,from,summary,files,checks:loadedChecks,open,question,blocker,credentialRequest:request,branch,head,gates,observations,reportedAt:now()});
  const written={dispatchId:key,opId,attempt,generation,outcome:report.outcome,fromTerminal:from};
  store.writeReport({...written,report});
  const {type,orcaOutcome}=report.signal;
  const params={run,from,type,subject:`${report.outcome}: ${report.summary.slice(0,120)}`,body:reportBody(report,file),'task-id':task,'dispatch-id':dispatch,'report-path':file};
  if(orcaOutcome)params.outcome=orcaOutcome;
  if(report.files.length)params['files-modified']=report.files.join(',');
  if(capability)params['dispatch-capability']=capability;
  const sent=orca.invoke('send',params,{cwd});
  const messageId=getPath(sent.receipt,'result.message.id')??getPath(sent.receipt,'result.messageId')??getPath(sent.receipt,'result.id')??null;
  report.sent=sent.outcome==='ok'?{messageId,sentAt:now(),type}:null;
  report.sendFailure=sent.outcome==='ok'?null:{outcome:sent.outcome,effectState:sent.effectState,reason:sent.reason};
  store.writeReport({...written,report});
  return {schema:REPORT_RESULT,ok:sent.outcome==='ok',file,outcome:report.outcome,signal:report.signal,messageId,
    send:{outcome:sent.outcome,effectState:sent.effectState,reason:sent.reason},
    reason:sent.outcome==='ok'?null:`report recorded but the ${type} signal was not accepted (${sent.reason??sent.outcome}); the receiver's wait tick still reads the row`};
  }finally{store.close();}
}

const isLive=w=>['ready','running','starting'].includes(w.workerState)||(w.workerState==='unsupervised'&&['dispatched','pending','ready'].includes(w.dispatchStatus));

/**
 * Classify one live worker from its screen and terminal metadata. The signatures live with the provider
 * adapters in `hosts/orca/observe.mjs`, so this is the protocol-side name for `observe`: the same verdict, plus
 * the family that produced it and the keystroke that family's confirmation dialog accepts.
 */
export const classifyWorker=input=>observe(input);

/**
 * One owned wait tick for a Run: blocking check (with the previous batch acknowledged), report-file scan,
 * liveness of every live worker, sweep of dead terminals and title re-canonicalization. `timeout` means
 * "call wait again", never "end the turn".
 */
export const DEFAULT_TICK_MS=120000;
/**
 * Ping-pong: the blocking check is sliced into short ticks so every live worker is inspected at least
 * once per tick while the supervisor keeps waiting; the call returns at the first boundary (report, stalled,
 * dead) or after the whole timeout with `timeout`.
 */
export function waitTick(orca,{cwd,run,from,timeoutMs=900000,tickMs=DEFAULT_TICK_MS,workflow=null,stalledAfterMs=DEFAULT_STALLED_AFTER_MS,heartbeatGraceMs=DEFAULT_HEARTBEAT_GRACE_MS,ack=null,noAck=false,now=Date.now,wake=null,wait=sleepSync}){
  const started=now();
  const ticks=[];
  let ackOnce=ack,noAckOnce=noAck;
  for(;;){
    const remaining=timeoutMs-(now()-started);
    const slice=Math.max(1000,Math.min(tickMs,remaining));
    const tick=singleTick(orca,{cwd,run,from,timeoutMs:slice,workflow,stalledAfterMs,heartbeatGraceMs,ack:ackOnce,noAck:noAckOnce,now,wait});
    ackOnce=null;noAckOnce=false;
    ticks.push({at:now(),event:tick.event,liveness:tick.liveness.map(item=>`${item.dispatch}:${item.liveness}`)});
    if(tick.event!=='timeout'||now()-started>=timeoutMs)return {...tick,ticks:ticks.length,elapsedMs:now()-started};
    // Something the caller wants handled now - a queued command, a stop flag - ends the wait between two slices,
    // so an approval reaches a kernel within one tick instead of after the whole wait for its running operations.
    if(typeof wake==='function'&&wake())return {...tick,event:'woken',ticks:ticks.length,elapsedMs:now()-started};
  }
}

/**
 * The delivery cursor and seen-report set used to live in `<reports>/wait-state.json`; §8 has no reports
 * directory any more, so it is a `signals` row scoped to the workflow, keyed by run (a workflow's own kernel
 * lock and stop flag use the same table under their own fixed keys - this is one more small keyed record, not
 * workflow state, so it belongs beside them rather than forcing a schema change for one more JSON blob).
 */
const waitStateKeyFor=run=>`wait-state:${required(run,'run id')}`;
function singleTick(orca,{cwd,run,from,timeoutMs,workflow,stalledAfterMs,heartbeatGraceMs=DEFAULT_HEARTBEAT_GRACE_MS,ack,noAck,now,wait}){
  const workflowId=required(workflow,'workflow id'),waitStateKey=waitStateKeyFor(run);
  const store=createStore({repoRoot:repositoryRoot(cwd),id:workflowId});
  try{
  const recorded=store.readReports();
  const saved=store.signal.get(workflowId,waitStateKey)?.value;
  const state=plain(saved)?saved:{lastDeliveryId:null,seenReports:{}};
  const checkParams={run,terminal:required(from,'own terminal handle'),wait:true,'timeout-ms':String(timeoutMs),types:BOUNDARY_TYPES};
  // New cursors are scoped to the consumer that obtained them. Legacy state did not carry that binding;
  // try it once for compatibility and let Orca's generation fence prove whether it is still usable.
  const savedAckBelongsHere=!(state.run&&state.from&&(state.run!==run||state.from!==from));
  const savedAck=savedAckBelongsHere?state.lastDeliveryId:null;
  const ackId=ack??(noAck?null:savedAck);
  if(ackId)checkParams.ack=ackId;
  let checked=orca.invoke('check',checkParams,{cwd});
  // A controller generation cannot acknowledge its predecessor's Delivery. Drop only that obsolete token,
  // then ask Orca to redeliver the still-unread batch to this tick; the kernel must see it before any new
  // Delivery is acknowledged. Every other check failure remains a visible check-failed boundary.
  const recoveredFencedDelivery=Boolean(ackId&&checked.outcome!=='ok'&&checked.reason===FENCED_DELIVERY_REASON);
  if(recoveredFencedDelivery){
    delete checkParams.ack;
    checked=orca.invoke('check',checkParams,{cwd});
  }
  const messages=(getPath(checked.receipt,'result.messages')??[]).map(m=>({id:m.id,type:m.type,subject:m.subject??'',body:m.body??'',createdAt:m.created_at??m.createdAt??null,payload:(()=>{try{return JSON.parse(m.payload??'{}');}catch{return {};}})()}));
  const deliveryId=getPath(checked.receipt,'result.deliveryId')??null;
  // Ping: the latest heartbeat per Dispatch, peeked so nothing is marked read.
  const pings=new Map();
  const peeked=orca.invoke('check',{run,terminal:from,peek:true,types:'heartbeat'},{cwd});
  for(const m of (getPath(peeked.receipt,'result.messages')??[])){let p={};try{p=JSON.parse(m.payload??'{}');}catch{}const at=Date.parse(m.created_at??m.createdAt??'')||0;if(p.dispatchId&&at>=(pings.get(p.dispatchId)??0))pings.set(p.dispatchId,at);}
  const reports=recorded.filter(report=>report?.dispatch&&!state.seenReports[report.dispatch]).map(report=>({...report,validation:validateReport(report)}));
  const workers=(getPath(orca.invoke('worker-list',{run},{cwd}).receipt,'result.workers')??[]);
  const listed=getPath(orca.invoke('terminal-list',{},{cwd}).receipt,'result.terminals')??[];
  const tasks=getPath(orca.invoke('task-list',{run},{cwd}).receipt,'result.tasks')??[];
  const names=new Map(tasks.map(task=>[task.id,task.display_name]));
  const reportedDispatches=new Set(recorded.map(report=>report?.dispatch).filter(Boolean));
  const liveness=[],renamed=[],approvals=[];
  for(const worker of workers.filter(isLive)){
    const handle=worker.agentTerminalHandle;
    const terminal=listed.find(t=>t.handle===handle)??null;
    const read=terminal?orca.invoke('terminal-read',{terminal:handle,screen:true},{cwd}):null;
    const screen=read?.outcome==='ok'?(getPath(read.receipt,'result.terminal.tail')??[]).join('\n'):'';
    const lastPing=pings.get(worker.dispatchId)??null;
    const pingAgeMs=lastPing===null?null:now()-lastPing;
    let verdict=classifyWorker({screen,terminal,now:now(),stalledAfterMs,reported:reportedDispatches.has(worker.dispatchId)});
    // A command-terminal operation runs in an isolated worktree under a contract allowlist, so an interactive
    // confirmation is answered by the supervisor ("allow once"), never left for a human. Only a prompt that
    // survives the answer is reported as stalled-prompt.
    if(verdict.liveness==='stalled-prompt'&&terminal){
      // The accepting keystroke belongs to the provider, not to the supervisor: Claude and Qwen number their
      // choices, Codex and a shell answer `y`.
      const answered=orca.invoke('terminal-send',{terminal:handle,text:verdict.answer??'1',enter:true},{cwd});
      wait(3000);
      const again=orca.invoke('terminal-read',{terminal:handle,screen:true},{cwd});
      const after=again.outcome==='ok'?(getPath(again.receipt,'result.terminal.tail')??[]).join('\n'):'';
      const still=classifyWorker({screen:after,terminal,now:now(),stalledAfterMs,provider:verdict.provider});
      approvals.push({dispatch:worker.dispatchId,terminal:handle,provider:verdict.provider,answer:verdict.answer??'1',sent:answered.outcome,cleared:still.liveness!=='stalled-prompt'});
      verdict=still.liveness==='stalled-prompt'?{liveness:'stalled-prompt',reason:'confirmation prompt survived an allow-once answer'}:{liveness:'working',reason:'confirmation prompt answered by the supervisor'};
    }
    // No ping inside the grace window and no visible activity: the worker is polled and reported as silent.
    if(verdict.liveness==='working'&&verdict.reason==='recent output'&&(pingAgeMs===null||pingAgeMs>heartbeatGraceMs)&&(now()-Number(terminal?.lastOutputAt??0))>heartbeatGraceMs)verdict={liveness:'stalled-silent',reason:`no heartbeat for ${pingAgeMs===null?'the whole attempt':`${Math.round(pingAgeMs/60000)} min`} and no output for ${Math.round((now()-Number(terminal?.lastOutputAt??0))/60000)} min`};
    liveness.push({dispatch:worker.dispatchId,task:worker.taskId,name:names.get(worker.taskId)??null,terminal:handle,workerState:worker.workerState,lastPingAt:lastPing,pingAgeMs,...verdict});
    const canonical=names.get(worker.taskId);
    if(terminal&&canonical&&terminal.title!==canonical&&verdict.liveness!=='dead'){
      const rename=orca.invoke('terminal-rename',{terminal:handle,title:canonical},{cwd});
      renamed.push({terminal:handle,from:terminal.title,to:canonical,outcome:rename.outcome});
    }
  }
  const sweep=sweepWorktree(orca,{cwd,from});
  for(const report of reports)state.seenReports[report.dispatch]=now();
  state.run=run;state.from=from;
  if(!savedAckBelongsHere||recoveredFencedDelivery)state.lastDeliveryId=null;
  if(deliveryId)state.lastDeliveryId=deliveryId;
  store.signal.set(workflowId,waitStateKey,{value:state});
  // A rate-limited provider is a boundary too: the runtime must be parked now, not when the whole timeout ends.
  const stalled=liveness.filter(item=>item.liveness.startsWith('stalled')||['dead','rate-limited'].includes(item.liveness));
  const event=messages.length||reports.length?'report':stalled.length?stalled[0].liveness:checked.outcome==='ok'?'timeout':'check-failed';
  return {schema:WAIT_TICK,run,event,deliveryId,check:{outcome:checked.outcome,reason:checked.reason??null},messages,reports,liveness,renamed,approvals,sweep:{closed:sweep.closed,kept:sweep.kept.length},
    next:event==='timeout'?'call wait again; a timeout is not a boundary':event==='report'?'process every message and report, then call wait again':event==='rate-limited'?'the provider refused with a quota signal: park that runtime (allocator.failed with the reason) and re-dispatch the op elsewhere, then call wait again':event==='stalled-prompt'?'the agent is inside a confirmation dialog and cannot read a notify: settle it (--close true) and start-op again, then call wait again':'act on the stalled or dead worker (notify to report, or settle and retry), then call wait again'};
  }finally{store.close();}
}


export function protocolMain(command,options,{orca,cwd}){
  if(command==='report'){
    return reportOutcome(orca,{cwd,kind:options.kind??'op',run:required(options.run,'run id'),from:required(options.from,'own terminal handle'),task:required(options.task,'task id'),dispatch:required(options.dispatch,'dispatch id'),
      outcome:required(options.outcome,'outcome'),summary:required(options.summary,'summary'),files:csv(options.files),checksFile:options['checks-file']??null,open:csv(options.open),
      question:options.question?{text:options.question,options:csv(options.options)}:null,
      blocker:options.blocker?{kind:options.blocker.split(':')[0],detail:options.blocker.split(':').slice(1).join(':').trim()}:null,
      credentialRequestFile:options['credential-request-file']??null,
      branch:options.branch??null,head:options.head??null,gates:options.gates?csv(options.gates).map(gate=>{const [name,status]=gate.split('=');return {name,status:status??'passed'};}):[],
      observations:options.observations?[options.observations]:[],workflow:required(options.workflow,'workflow id'),opId:options.op??null,attempt:options.attempt!==undefined?Number(options.attempt):null,capability:options.capability??null});
  }
  if(command==='wait')return waitTick(orca,{cwd,run:required(options.run,'run id'),from:required(options.from,'own terminal handle'),timeoutMs:Number(options['timeout-ms']??900000),tickMs:Number(options['tick-ms']??DEFAULT_TICK_MS),workflow:required(options.workflow,'workflow id'),stalledAfterMs:Number(options['stalled-after-ms']??DEFAULT_STALLED_AFTER_MS),ack:options.ack??null,noAck:options['no-ack']==='true'});
  throw Error(`Unsupported protocol command: ${command}`);
}

export {notifyTerminal};
