import fs from 'node:fs';
import path from 'node:path';
import {getPath} from './orca-calls.mjs';
import {buildReport,readReports,reportBody,reportPath,reportsDirectory,validateReport} from './reports.mjs';
import {notifyTerminal,resolveSupervisorChain,settleDispatch,sweepWorktree} from './orca-supervised-launch.mjs';

/**
 * Supervision protocol 4.1 on top of the typed Orca runner: `report` (one typed outcome, file first,
 * signal second), `wait` (one owned wait tick that classifies every live worker) and `start-coordinator`
 * (the bootstrap of the persistent Plan agent). The helpers never improvise Orca calls: every call goes
 * through the contract runner and every result is classified.
 */
export const REPORT_RESULT='starci/orca-report-result@1';
export const WAIT_TICK='starci/orca-wait-tick@1';
export const COORDINATOR_LAUNCH='starci/orca-supervised-coordinator-launch@1';
export const BOUNDARY_TYPES='worker_done,worker_failed,question,escalation';
const DEFAULT_STALLED_AFTER_MS=20*60*1000;
export const DEFAULT_HEARTBEAT_GRACE_MS=10*60*1000;

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const required=(value,label)=>{need(typeof value==='string'&&value.trim(),`Missing ${label}`);return value.trim();};
const resultOf=receipt=>plain(receipt?.result)?receipt.result:receipt;
const csv=value=>String(value??'').split(',').map(item=>item.trim()).filter(Boolean);
const sleepSync=ms=>{if(ms>0)Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);};

function readJson(file,fallback){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}}
function writeJson(file,value){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,`${JSON.stringify(value,null,2)}\n`);}

/** One typed outcome: validate, write the file, send the matching Orca signal once, record the send. */
export function reportOutcome(orca,{cwd,kind='op',run,from,task,dispatch,outcome,summary,files=[],checksFile=null,checks=[],open=[],question=null,blocker=null,branch=null,head=null,gates=[],observations=[],reportsDir=null,capability=null,now=Date.now}){
  const directory=reportsDirectory(cwd,required(run,'run id'),reportsDir);
  const file=reportPath(directory,required(dispatch,'dispatch id'));
  const existing=readJson(file,null);
  if(existing?.sent)return {schema:REPORT_RESULT,ok:false,file,reason:'already-reported',existing:{outcome:existing.outcome,sent:existing.sent}};
  const loadedChecks=checksFile?readJson(path.resolve(cwd,checksFile),null):checks;
  need(Array.isArray(loadedChecks),`Checks file is not a JSON array: ${checksFile}`);
  const report=buildReport({kind,outcome,run,task,dispatch,from,summary,files,checks:loadedChecks,open,question,blocker,branch,head,gates,observations,reportedAt:now()});
  writeJson(file,report);
  const {type,orcaOutcome}=report.signal;
  const params={run,from,type,subject:`${report.outcome}: ${report.summary.slice(0,120)}`,body:reportBody(report,path.relative(cwd,file)),'task-id':task,'dispatch-id':dispatch,'report-path':path.relative(cwd,file).replaceAll('\\','/')};
  if(orcaOutcome)params.outcome=orcaOutcome;
  if(report.files.length)params['files-modified']=report.files.join(',');
  if(capability)params['dispatch-capability']=capability;
  const sent=orca.invoke('send',params,{cwd});
  const messageId=getPath(sent.receipt,'result.message.id')??getPath(sent.receipt,'result.messageId')??getPath(sent.receipt,'result.id')??null;
  report.sent=sent.outcome==='ok'?{messageId,sentAt:now(),type}:null;
  report.sendFailure=sent.outcome==='ok'?null:{outcome:sent.outcome,effectState:sent.effectState,reason:sent.reason};
  writeJson(file,report);
  return {schema:REPORT_RESULT,ok:sent.outcome==='ok',file,outcome:report.outcome,signal:report.signal,messageId,
    send:{outcome:sent.outcome,effectState:sent.effectState,reason:sent.reason},
    reason:sent.outcome==='ok'?null:`report written but the ${type} signal was not accepted (${sent.reason??sent.outcome}); the receiver's wait tick still reads the file`};
}

const isLive=w=>['ready','running','starting'].includes(w.workerState)||(w.workerState==='unsupervised'&&['dispatched','pending','ready'].includes(w.dispatchStatus));
const CLAUDE_BUSY=/esc to interrupt/i,CLAUDE_IDLE=/(^|\n)\s*❯\s*$/m,QWEN_BUSY=/esc to cancel/i,QWEN_IDLE=/Type your message/i,QWEN_PROMPT=/Allow execution|Waiting for user confirmation|\(y\/n\)/i;

/** Classify one live worker from its screen and terminal metadata. */
export function classifyWorker({screen,terminal,now,stalledAfterMs=DEFAULT_STALLED_AFTER_MS,reported=false}){
  if(!terminal)return {liveness:'dead',reason:'terminal not listed'};
  if(terminal.status&&/exited|closed/i.test(terminal.status))return {liveness:'dead',reason:`terminal ${terminal.status}`};
  if(reported)return {liveness:'reported',reason:'report file present'};
  const flat=String(screen??'');
  if(QWEN_PROMPT.test(flat))return {liveness:'stalled-prompt',reason:'agent is waiting for an interactive confirmation'};
  if(CLAUDE_BUSY.test(flat)||QWEN_BUSY.test(flat))return {liveness:'working',reason:'agent is running'};
  if(CLAUDE_IDLE.test(flat)||QWEN_IDLE.test(flat))return {liveness:'stalled-idle',reason:'agent is idle at its prompt without a report'};
  const last=Number(terminal.lastOutputAt??0);
  if(last&&now-last>stalledAfterMs)return {liveness:'stalled-silent',reason:`no output for ${Math.round((now-last)/60000)} min`};
  return {liveness:'working',reason:'recent output'};
}

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
export function waitTick(orca,{cwd,run,from,timeoutMs=900000,tickMs=DEFAULT_TICK_MS,reportsDir=null,stalledAfterMs=DEFAULT_STALLED_AFTER_MS,heartbeatGraceMs=DEFAULT_HEARTBEAT_GRACE_MS,ack=null,noAck=false,now=Date.now,wait=sleepSync}){
  const started=now();
  const ticks=[];
  let ackOnce=ack,noAckOnce=noAck;
  for(;;){
    const remaining=timeoutMs-(now()-started);
    const slice=Math.max(1000,Math.min(tickMs,remaining));
    const tick=singleTick(orca,{cwd,run,from,timeoutMs:slice,reportsDir,stalledAfterMs,heartbeatGraceMs,ack:ackOnce,noAck:noAckOnce,now,wait});
    ackOnce=null;noAckOnce=false;
    ticks.push({at:now(),event:tick.event,liveness:tick.liveness.map(item=>`${item.dispatch}:${item.liveness}`)});
    if(tick.event!=='timeout'||now()-started>=timeoutMs)return {...tick,ticks:ticks.length,elapsedMs:now()-started};
  }
}

function singleTick(orca,{cwd,run,from,timeoutMs,reportsDir,stalledAfterMs,heartbeatGraceMs=DEFAULT_HEARTBEAT_GRACE_MS,ack,noAck,now,wait}){
  const directory=reportsDirectory(cwd,required(run,'run id'),reportsDir);
  const stateFile=path.join(directory,'wait-state.json');
  const state=readJson(stateFile,{lastDeliveryId:null,seenReports:{}});
  const checkParams={run,terminal:required(from,'own terminal handle'),wait:true,'timeout-ms':String(timeoutMs),types:BOUNDARY_TYPES};
  const ackId=ack??(noAck?null:state.lastDeliveryId);
  if(ackId)checkParams.ack=ackId;
  const checked=orca.invoke('check',checkParams,{cwd});
  const messages=(getPath(checked.receipt,'result.messages')??[]).map(m=>({id:m.id,type:m.type,subject:m.subject??'',body:m.body??'',createdAt:m.created_at??m.createdAt??null,payload:(()=>{try{return JSON.parse(m.payload??'{}');}catch{return {};}})()}));
  const deliveryId=getPath(checked.receipt,'result.deliveryId')??null;
  // Ping: the latest heartbeat per Dispatch, peeked so nothing is marked read.
  const pings=new Map();
  const peeked=orca.invoke('check',{run,terminal:from,peek:true,types:'heartbeat'},{cwd});
  for(const m of (getPath(peeked.receipt,'result.messages')??[])){let p={};try{p=JSON.parse(m.payload??'{}');}catch{}const at=Date.parse(m.created_at??m.createdAt??'')||0;if(p.dispatchId&&at>=(pings.get(p.dispatchId)??0))pings.set(p.dispatchId,at);}
  const reports=readReports(directory).filter(report=>report?.dispatch&&!state.seenReports[report.dispatch]).map(report=>({...report,validation:validateReport(report)}));
  const workers=(getPath(orca.invoke('worker-list',{run},{cwd}).receipt,'result.workers')??[]);
  const listed=getPath(orca.invoke('terminal-list',{},{cwd}).receipt,'result.terminals')??[];
  const tasks=getPath(orca.invoke('task-list',{run},{cwd}).receipt,'result.tasks')??[];
  const names=new Map(tasks.map(task=>[task.id,task.display_name]));
  const reportedDispatches=new Set(readReports(directory).map(report=>report?.dispatch).filter(Boolean));
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
      const answered=orca.invoke('terminal-send',{terminal:handle,text:'1',enter:true},{cwd});
      wait(3000);
      const again=orca.invoke('terminal-read',{terminal:handle,screen:true},{cwd});
      const after=again.outcome==='ok'?(getPath(again.receipt,'result.terminal.tail')??[]).join('\n'):'';
      const still=classifyWorker({screen:after,terminal,now:now(),stalledAfterMs});
      approvals.push({dispatch:worker.dispatchId,terminal:handle,sent:answered.outcome,cleared:still.liveness!=='stalled-prompt'});
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
  if(deliveryId)state.lastDeliveryId=deliveryId;
  writeJson(stateFile,state);
  const stalled=liveness.filter(item=>item.liveness.startsWith('stalled')||item.liveness==='dead');
  const event=messages.length||reports.length?'report':stalled.length?stalled[0].liveness:checked.outcome==='ok'?'timeout':'check-failed';
  return {schema:WAIT_TICK,run,event,deliveryId,check:{outcome:checked.outcome,reason:checked.reason??null},messages,reports,liveness,renamed,approvals,sweep:{closed:sweep.closed,kept:sweep.kept.length},
    next:event==='timeout'?'call wait again; a timeout is not a boundary':event==='report'?'process every message and report, then call wait again':event==='stalled-prompt'?'the agent is inside a confirmation dialog and cannot read a notify: settle it (--close true) and start-op again, then call wait again':'act on the stalled or dead worker (notify to report, or settle and retry), then call wait again'};
}

/** Bootstrap the persistent Plan Coordinator agent through a temporary helper terminal that is closed afterwards. */
export function startCoordinator(orca,{cwd,plan,spec,run=null,objective=null,shell=process.platform==='win32'?'powershell -NoLogo':'bash',wait=sleepSync}){
  const displayName=`[Monitor] ${required(plan,'plan name')}`;
  const worktree=`path:${cwd}`;
  const boot=orca.invoke('terminal-create',{worktree,title:`[Bootstrap] ${plan}`,command:shell},{cwd});
  need(boot.outcome==='ok',`Bootstrap terminal failed: ${boot.reason}`);
  const from=getPath(boot.receipt,'result.terminal.handle')??getPath(boot.receipt,'result.handle');
  need(from,'Bootstrap terminal receipt is missing the handle');
  const steps=[{name:'terminal-create',handle:from}];
  const fail=(reason,extra={})=>({schema:COORDINATOR_LAUNCH,ok:false,reason,steps,...extra});
  try{
    let runId=run;
    if(!runId){
      const created=orca.invoke('run-create',{objective:required(objective,'run objective'),from},{cwd});
      if(created.outcome!=='ok')return fail(`run-create: ${created.reason}`);
      runId=getPath(created.receipt,'result.run.id')??getPath(created.receipt,'result.id');
      steps.push({name:'run-create',run:runId});
    }
    const bound=orca.invoke('run-use',{id:runId,from},{cwd});
    if(bound.outcome!=='ok')return fail(`run-use (bootstrap): ${bound.reason}`);
    const task=orca.invoke('task-create',{run:runId,from,spec:required(spec,'coordinator spec'),'task-title':`Plan Coordinator - ${plan}`,'display-name':displayName},{cwd});
    if(task.outcome!=='ok')return fail(`task-create: ${task.reason}`);
    const taskId=getPath(task.receipt,'result.task.id');
    steps.push({name:'task-create',task:taskId});
    const attempts=[];
    for(const candidate of resolveSupervisorChain('planCoordinator')){
      const params={task:taskId,worktree,agent:candidate.orcaLaunch.agent,run:runId,from,'display-name':displayName,'timeout-ms':'180000'};
      if(candidate.model)params.model=candidate.model;
      if(candidate.effort)params.effort=candidate.effort;
      const started=orca.invoke('worker-start',params,{cwd});
      const dispatchId=getPath(started.receipt,'result.dispatchId')??getPath(started.receipt,'result.dispatch.id')??null;
      const terminal=(getPath(started.receipt,'result.effects')??getPath(started.receipt,'result.residualResources')??[]).find(e=>e?.kind==='terminal'&&e?.role==='agent')?.id??null;
      if(started.outcome!=='ok'){
        const settlement=dispatchId?settleDispatch(orca,dispatchId,{cwd,reason:`coordinator worker-start ${started.outcome}`,terminalHandle:terminal,closeTerminal:true,wait}):null;
        attempts.push({target:candidate.target,dispatchId,effectState:settlement?.effectState??started.effectState,reason:started.reason});
        if(settlement&&settlement.effectState!=='none')return fail('partial-or-unknown-effects',{attempts});
        const reissued=orca.invoke('task-update',{id:taskId,status:'ready',run:runId,from,result:JSON.stringify({reissuedAfter:dispatchId,reason:'candidate-fell-through'})},{cwd});
        if(reissued.outcome!=='ok')return fail('task-not-reissuable',{attempts});
        continue;
      }
      const shown=orca.invoke('worker-show',{dispatch:dispatchId},{cwd});
      const worker=resultOf(shown.receipt)?.worker,effective=worker?.startOptions?.launch?.effective;
      if(shown.outcome!=='ok'||effective?.agent!==candidate.orcaLaunch.agent||(candidate.model&&effective?.model!==candidate.model)){
        const settlement=settleDispatch(orca,dispatchId,{cwd,reason:'coordinator provider attestation failed',terminalHandle:terminal??worker?.agent_terminal_handle,closeTerminal:true,wait});
        attempts.push({target:candidate.target,dispatchId,effectState:settlement.effectState,reason:`attestation: expected ${candidate.orcaLaunch.agent}/${candidate.model??'any'}, received ${effective?.agent??'unknown'}/${effective?.model??'unknown'}`});
        if(settlement.effectState!=='none')return fail('partial-or-unknown-effects',{attempts});
        continue;
      }
      const handle=worker.agent_terminal_handle;
      const renamed=orca.invoke('terminal-rename',{terminal:handle,title:displayName},{cwd});
      const handoff=orca.invoke('run-use',{id:runId,from:handle},{cwd});
      if(handoff.outcome!=='ok')return fail(`run-use (coordinator): ${handoff.reason}`,{attempts,dispatchId,terminal:handle});
      const runShow=orca.invoke('run-show',{id:runId},{cwd});
      const coordinatorHandle=getPath(runShow.receipt,'result.run.coordinator_handle')??null;
      return {schema:COORDINATOR_LAUNCH,ok:coordinatorHandle===handle,run:runId,task:taskId,dispatchId,terminal:handle,displayName,
        attestation:{target:candidate.target,agent:effective.agent,model:effective.model??null,effort:effective.effort??null,coordinatorHandle,titleCanonical:renamed.outcome==='ok'},
        attempts,steps,reason:coordinatorHandle===handle?null:`coordinator_handle is ${coordinatorHandle}, expected ${handle}`};
    }
    return fail('chain-exhausted',{attempts});
  }finally{
    const closed=orca.invoke('terminal-close',{terminal:from},{cwd});
    steps.push({name:'terminal-close-bootstrap',outcome:closed.outcome});
  }
}

export function protocolMain(command,options,{orca,cwd}){
  if(command==='report'){
    return reportOutcome(orca,{cwd,kind:options.kind??'op',run:required(options.run,'run id'),from:required(options.from,'own terminal handle'),task:required(options.task,'task id'),dispatch:required(options.dispatch,'dispatch id'),
      outcome:required(options.outcome,'outcome'),summary:required(options.summary,'summary'),files:csv(options.files),checksFile:options['checks-file']??null,open:csv(options.open),
      question:options.question?{text:options.question,options:csv(options.options)}:null,
      blocker:options.blocker?{kind:options.blocker.split(':')[0],detail:options.blocker.split(':').slice(1).join(':').trim()}:null,
      branch:options.branch??null,head:options.head??null,gates:options.gates?csv(options.gates).map(gate=>{const [name,status]=gate.split('=');return {name,status:status??'passed'};}):[],
      observations:options.observations?[options.observations]:[],reportsDir:options['reports-dir']??null,capability:options.capability??null});
  }
  if(command==='wait')return waitTick(orca,{cwd,run:required(options.run,'run id'),from:required(options.from,'own terminal handle'),timeoutMs:Number(options['timeout-ms']??900000),tickMs:Number(options['tick-ms']??DEFAULT_TICK_MS),reportsDir:options['reports-dir']??null,stalledAfterMs:Number(options['stalled-after-ms']??DEFAULT_STALLED_AFTER_MS),ack:options.ack??null,noAck:options['no-ack']==='true'});
  if(command==='start-coordinator')return startCoordinator(orca,{cwd,plan:required(options.plan,'plan name'),spec:options.spec,run:options.run??null,objective:options.objective??null});
  throw Error(`Unsupported protocol command: ${command}`);
}

export {notifyTerminal};
