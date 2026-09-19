import path from 'node:path';
import {getPath} from '../hosts/orca/calls.mjs';
import {dispatchLastWords,settleDispatch} from '../hosts/orca/launch.mjs';
import {RESTART_LIMIT,firstLine,need,plain,sleepSync} from './common.mjs';
import {buildReport} from './reports.mjs';
import {redactSecrets} from './owner.mjs';
import {closeStaleCoordinatorTerminals,inspectStartup,pruneClosedCoordinatorTerminals,readClosedCoordinatorTerminals,seedCoordinatorTerminals,startupRowHolds} from './launch.mjs';

/**
 * Tabs and the Run they hang from. The rule is one sentence - a tab exists only while somebody reads it - and
 * the code is the whole of what it takes to keep that true against a real IDE: a coordinator tab whose pane is
 * gone, a duplicate left by a restart, an op tab nobody is on, a sibling workflow's tab whose kernel died, a
 * Dispatch Orca still lists that no operation names, and an operation the kernel believes is running whose
 * agent is not there at all.
 *
 * It is its own file because none of it is policy: nothing here decides what an operation does, and the loop
 * calls it at fixed points (at start, every `RECONCILE_EVERY` ticks, every `SWEEP_MS`, and on a lost pane).
 */

/**
 * Reconcile the kernel's picture with Orca's: a live Dispatch of this Run that no operation names is an orphan
 * (a launch the kernel lost) and is settled; the check is cheap and runs at start and every RECONCILE_EVERY ticks.
 */
export const RECONCILE_EVERY=10;
/** The terminals Orca lists for a worktree, as `{handle,title}`; an unreachable Orca lists none. */
export function listTerminals(orca,cwd){
  try{const listed=orca.invoke('terminal-list',{},{cwd});return listed.outcome==='ok'?(getPath(listed.receipt,'result.terminals')??[]).filter(plain):[];}catch{return [];}
}
export const closeTerminal=(orca,cwd,handle)=>{try{const closed=orca.invoke('terminal-close',{terminal:handle},{cwd});return closed.outcome==='ok';}catch{return false;}};
/**
 * The kernel's own Orca terminal: the tab titled `[Kernel] <id>` in the worktree. One that already exists (a
 * previous start of this workflow) is reused and any duplicate is closed; none exists, one is created. A
 * process restart therefore never adds a tab.
 */
/**
 * The kernel's coordinator tab lost its pane (Orca: "The coordinator terminal has no stable pane identity"):
 * the old handle is closed, a fresh `[Kernel] <id>` tab is opened and the Run is re-bound to it, so the next
 * launch is accepted. The event names both handles.
 */
export function recoverCoordinatorTab(orca,store,state,{cwd=state.worktree}={}){
  const lost=state.from??null;
  if(lost){try{orca.invoke('terminal-close',{terminal:lost},{cwd});}catch{}}
  state.from=null;
  try{state.from=ownKernelTerminal(orca,store,state,cwd);}
  catch(error){store.appendEvent({event:'coordinator-tab-lost',terminal:lost,reason:String(error?.message??error)});state.from=lost;return false;}
  state.kernelTerminalOwned=true;
  let rebound=false;
  try{rebound=rebindRunIfNeeded(orca,store,state,{cwd});}catch{rebound=false;}
  store.appendEvent({event:'coordinator-tab-recovered',was:lost,terminal:state.from,rebound});
  store.saveState(state);
  return true;
}
export function ownKernelTerminal(orca,store,state,worktree){
  const title=`[Kernel] ${state.id}`;
  const mine=listTerminals(orca,worktree).filter(item=>item.title===title&&item.handle);
  for(const extra of mine.slice(1)){closeTerminal(orca,worktree,extra.handle);store.appendEvent({event:'kernel-terminal-closed',terminal:extra.handle,reason:'duplicate'});}
  if(mine[0]){store.appendEvent({event:'kernel-terminal',terminal:mine[0].handle,reused:true});return mine[0].handle;}
  const shell=process.platform==='win32'?'powershell -NoLogo':'bash';
  const created=orca.invoke('terminal-create',{worktree:`path:${path.resolve(worktree)}`,title,command:shell},{cwd:worktree});
  const handle=getPath(created.receipt,'result.terminal.handle')??null;
  need(handle,`The kernel could not open its own Orca terminal: ${created.reason??'terminal-create failed'}; pass --from <own terminal>`);
  store.appendEvent({event:'kernel-terminal',terminal:handle});
  return handle;
}
/**
 * An operation's terminal has no reader once its report is accepted: it is closed with the acceptance. A
 * blocked or failed op keeps its terminal, which is where its last words are. `sweepStaleTerminals` closes
 * what an older build or a lost kernel left behind: `[Op]` tabs of this workflow's done ops, and `[Kernel]` tabs
 * of this workflow that are not the one the kernel is in. Tabs of other workflows are never touched.
 */
export function closeOpTerminal(orca,store,state,op){
  if(!op?.terminal)return;
  if(keepAskTab(store,state,op))return;
  const handle=op.terminal;
  if(closeTerminal(orca,state.worktree,handle))store.appendEvent({event:'op-terminal-closed',op:op.id,terminal:handle});
  op.terminal=null;
}
/**
 * A prepared decision is shown where the owner sits: the `decision.prepare` op printed the question and the
 * numbered options in its own tab, then reported so the work could continue on its recommendation. That tab is
 * the only place the owner sees the question, so it stays open - after the report, past every sweep - until the
 * owner answers (in the tab, or with `workflow-answer`) or the workflow finishes. Closing it with the report, as
 * every other op's tab is closed, is how the owner looked at six tabs and found no question in any of them.
 */
export function keepsAskTab(state,op){
  if(op?.retainedOwnerTerminal?.schema==='starci/retained-owner-terminal@1'&&op.retainedOwnerTerminal.ownership==='user_owned'&&
    op.retainedOwnerTerminal.handle===op.terminal&&op.retainedOwnerTerminal.dispatch===op.dispatch)return true;
  if(op?.kind!=='decision.prepare'||op.status!=='done'||op.answer||state?.finished)return false;
  const last=[...(op.reports??[])].reverse().find(report=>report?.outcome==='done')??null;
  return /^\s*decision:/.test(String(last?.summary??''));
}
/** Keeps the tab of an unanswered prepared decision and says so once (`ask-tab-kept`); false when it is not one. */
function keepAskTab(store,state,op){
  if(!keepsAskTab(state,op))return false;
  if(!op.tabKept){op.tabKept=true;store.appendEvent({event:'ask-tab-kept',op:op.id,terminal:op.terminal});}
  return true;
}
/** An op tab has a reader only while its op is on it: running, answering a question, or paused to resume there. */
export const TAB_STATUSES=['running','answering','paused'];
export const SWEEP_MS=5*60*1000;
/**
 * Every tab of this workflow that nobody reads is closed: a stale kernel tab, and the tab of any op of this
 * workflow that is not on it right now - done, blocked, retried, pending alike - because a tab only exists for
 * the time its op runs. Tabs of other workflows and tabs the owner opened are never touched. The sweep runs on
 * time (`SWEEP_MS`), not only every N iterations: a workflow whose iterations are minutes long never reached
 * the N-th one, and the owner counted fifteen idle tabs.
 */
/** A tab Orca answered a close for but still lists is not asked again before this much time has passed. */
export const UNCLOSABLE_RETRY_MS=30*60*1000;
export function sweepStaleTerminals(orca,store,state,{cwd=state.worktree,now=Date.now}={}){
  const closed=[],unclosable=[];
  const ours=new Map(state.ops.map(op=>[op.id,op]));
  // A close Orca answers `ok` for is not a closed tab: a pty it cannot stop keeps the tab listed, and asking every
  // sweep spends an Orca call and an event line each time. Each attempt is remembered on the state; a handle still
  // listed after one is reported once as unclosable and left alone for UNCLOSABLE_RETRY_MS.
  const attempts=state.terminalCloseAttempts=plain(state.terminalCloseAttempts)?state.terminalCloseAttempts:{};
  const tryClose=handle=>{
    const prior=attempts[handle];
    if(prior&&now()-Number(prior.at)<UNCLOSABLE_RETRY_MS){if(!prior.reported){prior.reported=true;unclosable.push(handle);}return false;}
    attempts[handle]={at:now(),reported:false};
    return closeTerminal(orca,cwd,handle);
  };
  // A tab is an op's by the handle the op holds, whatever its title: a command-terminal launch whose rename
  // never landed keeps the agent's default title, and those were the tabs nobody could match.
  const byHandle=new Map(state.ops.filter(op=>op.terminal).map(op=>[op.terminal,op]));
  const listed=listTerminals(orca,cwd);
  // The coordinator terminals earlier kernels of this workflow ran in, by handle: Orca re-titles an exited kernel's
  // tab to its shell, so the title match below never sees them; the record beside the store does.
  seedCoordinatorTerminals(store.ledger,state.id,{logFile:path.join(path.dirname(store.ledgerFile),'supervisor.log')});
  for(const handle of Object.keys(attempts))if(!listed.some(item=>item.handle===handle))delete attempts[handle];
  const recorded=closeStaleCoordinatorTerminals(store.ledger,state.id,{keep:state.from?[state.from]:[],known:listed.map(item=>item.handle),close:tryClose});
  for(const item of recorded.closed)if(item.reason!=='coordinator terminal already gone')closed.push({terminal:item.terminal,reason:'stale kernel tab'});
  // A tab whose close was answered earlier but which Orca still lists: asked again only after the window, reported once.
  const listedHandles=listed.map(item=>item.handle);
  for(const handle of readClosedCoordinatorTerminals(store.ledger,state.id))if(listedHandles.includes(handle)&&handle!==state.from&&tryClose(handle))closed.push({terminal:handle,reason:'stale kernel tab'});
  pruneClosedCoordinatorTerminals(store.ledger,state.id,listedHandles);
  const closedHandles=new Set(closed.map(item=>item.terminal));
  for(const item of listed){
    if(closedHandles.has(item.handle))continue;
    const title=String(item.title??'');
    if(title===`[Kernel] ${state.id}`&&item.handle!==state.from){if(tryClose(item.handle))closed.push({terminal:item.handle,reason:'stale kernel tab'});continue;}
    // The kernel tab of a sibling workflow of this repository that finished, or whose kernel is gone, has no reader.
    const sibling=title.startsWith('[Kernel] ')?title.slice(9).trim():null;
    if(sibling&&sibling!==state.id){
      if(siblingKernelGone(store,sibling,{terminal:item.handle,now})&&tryClose(item.handle))closed.push({terminal:item.handle,workflow:sibling,reason:'kernel tab of a workflow that is not running'});
      continue;
    }
    const opId=title.startsWith('[Op] ')?title.slice(title.lastIndexOf(' - ')+3).trim():null;
    const op=(opId?ours.get(opId):null)??byHandle.get(item.handle)??null;
    if(!op)continue;
    const inUse=op.terminal===item.handle&&TAB_STATUSES.includes(op.status);
    if(inUse||(op.terminal===item.handle&&keepAskTab(store,state,op)))continue;
    if(tryClose(item.handle)){closed.push({terminal:item.handle,op:op.id,reason:op.status==='done'?'op done':`op ${op.status}`});if(op.terminal===item.handle)op.terminal=null;}
  }
  state.lastSweepAt=now();
  if(unclosable.length)store.appendEvent({event:'terminals-unclosable',terminals:unclosable,retryAfterMs:UNCLOSABLE_RETRY_MS,reason:'Orca answered the close but still lists the tab; its pty could not be stopped'});
  if(closed.length)store.appendEvent({event:'terminals-swept',closed});
  return closed;
}
/** Whether a sibling workflow of this store root is finished or has no live kernel: its `[Kernel]` tab is then nobody's. */
export function siblingKernelGone(store,id,{terminal=null,now=Date.now,alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}}}={}){
  let sibling=null;
  // A workflow this ledger does not know is not this kernel's to judge: its tab is left alone.
  try{const row=store.ledger.db.prepare("SELECT state_json FROM state_snapshots WHERE workflow_id=? AND state_json<>'' ORDER BY snapshot_id DESC LIMIT 1").get(id);
    if(!row)return false;sibling=JSON.parse(row.state_json);}catch{return false;}
  if(sibling?.finished)return true;
  // A native supervisor first reserves startup while creating/reading/sending to the coordinator terminal, then
  // binds its exact handle. Closing either window can kill a kernel between command delivery and lock creation.
  // Age alone is not worker-stop proof; the supervisor owns reconciliation of an expired launch reservation.
  try{const startup=inspectStartup(store.ledger,id),standing=startupRowHolds(startup,{now,alive,kernelAlive:()=>false});
    if(startup?.phase==='running'&&alive(Number(startup.pid))&&startup.terminal!==terminal)return false;
    if(startup?.phase==='launching'&&standing.holds)return false;
    if(startup?.phase==='launching-native'&&startup.terminal===terminal)return false;
    if(startup?.phase==='running'&&startup.terminal===terminal&&alive(Number(startup.pid)))return false;}catch{}
  return true;
}
/** The kernel's own tab is released when the kernel leaves without finishing: the next start opens one and re-binds the Run. */
export function releaseKernelTab(orca,store,state,{cwd,reason}){
  if(!(state.kernelTerminalOwned&&state.from))return;
  try{orca.invoke('terminal-close',{terminal:state.from},{cwd});}catch{}
  store.appendEvent({event:'kernel-terminal-closed',terminal:state.from,reason});
  state.from=null;state.kernelTerminalOwned=false;
}
/**
 * How many times one operation may be restarted for a failure that was never its own before the environment
 * itself becomes the owner's question. It sits far above `RESTART_LIMIT` on purpose: a report command this
 * build no longer has, or a prompt Orca never delivered, costs time, not judgement, and the operation that
 * paid for it did nothing wrong. `RESTART_LIMIT` and the launch cooling keep counting `op.restarts` alone.
 */
export const INFRA_RESTART_LIMIT=12;
/**
 * Whose fault a dead Dispatch was. The report command missing (the launcher this build relocated), a task Orca
 * never delivered to the agent, a terminal Orca closed under a live worker: none of these is the operation's,
 * and charging it a restart for them is how a dozen finished operations were launched again from scratch.
 */
const INFRASTRUCTURE=[
  [/MODULE_NOT_FOUND|ERR_MODULE_NOT_FOUND|Cannot find module/i,'the report command could not be loaded (MODULE_NOT_FOUND)'],
  [/agent_prompt_stalled/i,'the task was never delivered to the agent (agent_prompt_stalled)'],
  [/session_not_reported/i,'the agent session was never reported (session_not_reported)'],
  [/terminal[_ -]?(?:was[_ -]?)?(?:closed|gone)|terminal[_ -]?not[_ -]?found|no such terminal/i,'Orca closed the terminal the agent ran in']
];
/** The infrastructure cause a failure text names, or null when the failure is the operation's own. */
export function infrastructureCause(text,{launcher=null}={}){
  const value=String(text??'');
  for(const [pattern,cause] of INFRASTRUCTURE)if(pattern.test(value))return cause;
  const name=launcher?path.basename(String(launcher)):null;
  if(/ENOENT/i.test(value)&&(/orca-supervised-launch|\.dist[\\/]/i.test(value)||(name&&value.includes(name))))
    return `the report command is not on disk (ENOENT ${name??'launcher'})`;
  return null;
}
/** The subject and the head of the body, redacted, for the event that records why a Dispatch ended. */
function lastWordsOf(words){
  const subject=redactSecrets(String(words?.report?.subject??words?.failure?.subject??'').trim());
  const body=redactSecrets(String(words?.report?.body??words?.failure?.body??'').trim());
  return subject||body?{subject:subject||null,body:body.slice(0,200)}:null;
}
/**
 * The last words of a Dispatch, written where the kernel already looks for an operation's report. The agent
 * finished its work and said so; only the command it was told to report through was gone. Taking the words as
 * the report is what lets the ordinary acceptance path judge them - a `failed` goes straight back to the op with
 * the body as its finding - instead of the kernel calling the op dead and paying for the same work twice.
 */
export function writeLastWordsReport(store,state,op,words){
  const summary=redactSecrets([words.subject,words.body].filter(Boolean).join(' - '));
  const base={kind:'op',run:state.run,task:op.task??op.id,dispatch:op.dispatch,
    from:op.terminal??state.from??'kernel',summary,files:[],checks:[]};
  let report=null;
  // A stated outcome is honoured only when the words carry what the contract makes that outcome owe - open items,
  // a blocker, a question. `done` is never honoured: it owes checks, and no lost worker ran any the kernel saw.
  if(words.outcome!=='done')try{report=buildReport({...base,outcome:words.outcome,open:words.open??[],blocker:words.blocker??null,question:words.question??null});}catch{report=null;}
  if(!report)report=buildReport({...base,outcome:'failed'});
  report.via='orca-worker-report';
  store.writeReport({dispatchId:op.dispatch,opId:op.id,attempt:op.attempt,report,fromTerminal:op.terminal??state.from??'kernel'});
  return report;
}
/**
 * `settleStopped(op,{settlement,reason})` is the durable half of this reconciliation, injected by the kernel so
 * this module never has to import the engine. An enrolled operation holds a ledger job and a lease; flipping its
 * record back to `ready` without settling that job leaves the lease behind, and every scheduler seam refuses an
 * operation that still holds one - the op would sit `ready` for good, dispatched by nobody. It returns false
 * when the stop could not be reconciled (the attempt is quarantined instead of silently requeued).
 */
export function reconcileWithOrca(orca,store,state,{cwd=state.worktree,wait=sleepSync,allocator=null,settleStopped=null}={}){
  const listed=orca.invoke('worker-list',{run:state.run},{cwd});
  if(listed.outcome!=='ok')return {orphans:[],dead:[],reason:listed.reason};
  const live=(getPath(listed.receipt,'result.workers')??[]).filter(w=>['ready','running','starting'].includes(w.workerState)||(w.workerState==='unsupervised'&&['dispatched','pending','ready'].includes(w.dispatchStatus)));
  const known=new Set(state.ops.map(op=>op.dispatch).filter(Boolean));
  const orphans=[];
  for(const worker of live){
    if(known.has(worker.dispatchId))continue;
    const settlement=settleDispatch(orca,worker.dispatchId,{cwd,reason:'orphan dispatch not named by any operation',terminalHandle:worker.agentTerminalHandle??null,closeTerminal:true,wait});
    orphans.push({dispatch:worker.dispatchId,terminal:worker.agentTerminalHandle??null,effectState:settlement.effectState});
  }
  if(orphans.length)store.appendEvent({event:'reconciled-orphans',orphans});
  // The other direction: an op the kernel believes is running, whose Dispatch Orca no longer lists and whose
  // terminal is gone, has no agent behind it. Nothing would ever observe it, so it is settled and queued again
  // here; a report file it left is not touched - acceptReports consumes that first. Before any of that the
  // Dispatch is asked what it said last: a worker report is the op's own report, an infrastructure failure is
  // the runtime's to pay for, and only silence is death.
  const terminals=orca.invoke('terminal-list',{},{cwd});
  const handles=new Set((getPath(terminals.receipt,'result.terminals')??[]).map(item=>item.handle).filter(Boolean));
  const liveDispatches=new Set(live.map(worker=>worker.dispatchId));
  const dead=[];
  if(terminals.outcome==='ok')for(const op of state.ops.filter(item=>item.status==='running'&&item.dispatch)){
    if(liveDispatches.has(op.dispatch)||(op.terminal&&handles.has(op.terminal)))continue;
    if(store.readReports().some(report=>report.dispatchId===op.dispatch))continue;
    // What the Dispatch said last is read BEFORE it is called dead. A worker that finished its work and could
    // not reach the kernel's report command is not a lost agent, and it is never charged for that.
    const words=dispatchLastWords(orca,op.dispatch,{cwd});
    const spoke=Boolean(words.report);
    const settlement=settleDispatch(orca,op.dispatch,{cwd,reason:spoke?'the worker reported its last words through Orca':'dead: no worker and no terminal',
      terminalHandle:op.terminal,closeTerminal:false,wait});
    const entry={op:op.id,dispatch:op.dispatch,terminal:op.terminal,runtime:op.runtime,effectState:settlement.effectState};
    const heard=lastWordsOf(words);
    if(heard)entry.lastWords=heard;
    if(spoke){
      // The op keeps its dispatch and its runtime: the report is now on disk and `acceptReports` judges it
      // on the next tick exactly as it judges a report the agent wrote itself.
      const report=writeLastWordsReport(store,state,op,words.report);
      store.appendEvent({event:'dispatch-last-words',op:op.id,dispatch:op.dispatch,outcome:report.outcome,subject:heard?.subject??null});
      dead.push({...entry,cause:'worker-report',restarts:op.restarts});
      continue;
    }
    // Nothing spoke for this Dispatch. Settle the durable attempt first, while the writer fence is still held:
    // only then is the record free to be requeued or blocked.
    if(op.lease&&settleStopped&&!settleStopped(op,{settlement,reason:'dead: no worker and no terminal'})){
      dead.push({...entry,cause:'native-stop-unreconciled',restarts:op.restarts});
      continue;
    }
    if(allocator&&op.runtime)allocator.release(op.runtime,{op:op.id});
    const infrastructure=infrastructureCause(words.text,{launcher:state.launcher});
    if(infrastructure){
      op.infraRestarts=(op.infraRestarts??0)+1;op.infraCause=infrastructure;
      dead.push({...entry,cause:'infrastructure',detail:infrastructure,restarts:op.restarts,infraRestarts:op.infraRestarts});
      if(op.infraRestarts>INFRA_RESTART_LIMIT){
        op.status='blocked';op.dispatch=null;op.terminal=null;
        state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} lost its agent ${op.infraRestarts} times to the environment and never to its own work: ${infrastructure}`});
        continue;
      }
      op.status='ready';op.dispatch=null;op.terminal=null;op.nudged=false;
      continue;
    }
    op.restarts+=1;
    dead.push({...entry,cause:'no-worker-no-terminal',restarts:op.restarts});
    if(op.restarts>RESTART_LIMIT){
      op.status='blocked';op.dispatch=null;op.terminal=null;
      state.needUser.push({op:op.id,kind:'environment',detail:`${op.id} lost its agent ${op.restarts} times; the last terminal ${op.terminal??'?'} no longer exists`});
      continue;
    }
    op.status='ready';op.dispatch=null;op.terminal=null;op.nudged=false;
  }
  if(dead.length)store.appendEvent({event:'reconciled-dead',dead});
  return {orphans,dead};
}

/**
 * A resumed kernel is expected to be the terminal Orca bound as the Run's coordinator; only that terminal may
 * launch operations. When the tab is gone (closed by a person, or by an older build) and the kernel opened a
 * new one, the Run is re-bound to it once - which fences the live Dispatches of the old tab, so the reconcile
 * that follows settles them - and the event says so. A matching coordinator changes nothing.
 */
export function rebindRunIfNeeded(orca,store,state,{cwd}){
  if(!state.run||!state.from)return false;
  let coordinator=null;
  try{const shown=orca.invoke('run-show',{id:state.run},{cwd});coordinator=getPath(shown.receipt,'result.run.coordinator_handle')??null;}catch{return false;}
  if(!coordinator||coordinator===state.from)return false;
  const bound=orca.invoke('run-use',{id:state.run,from:state.from},{cwd});
  store.appendEvent({event:'run-rebound',run:state.run,from:state.from,was:coordinator,ok:bound.outcome==='ok',...(bound.outcome==='ok'?{}:{reason:bound.reason??null})});
  return bound.outcome==='ok';
}
export function bindRun(orca,{cwd,state,from}){
  const created=orca.invoke('run-create',{objective:`Workflow ${state.id}: ${firstLine(state.job)}`,from},{cwd});
  need(created.outcome==='ok',`run-create failed: ${created.reason}`);
  const run=getPath(created.receipt,'result.run.id');
  const shownRun=orca.invoke('run-show',{id:run},{cwd});
  const coordinator=getPath(shownRun.receipt,'result.run.coordinator_handle')??null;
  if(coordinator!==from){
    // Binding is a one-time hand-off: a repeated run-use from the same terminal bumps Orca's consumer generation
    // and invalidates every live Dispatch of the Run, so a resumed kernel never re-binds.
    const bound=orca.invoke('run-use',{id:run,from},{cwd});
    need(bound.outcome==='ok',`run-use failed: ${bound.reason}`);
  }
  return run;
}
