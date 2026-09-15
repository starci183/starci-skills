import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {listWorkflows,repositoryRoot,workflowsRoot} from './store.mjs';
import {DEFAULT_PROBE_MS,probeRuntimeBudget,writeRuntimeBudget} from './budget.mjs';
import {verifyRuntimePin} from './runtime-pin.mjs';
import {closeStaleCoordinatorTerminals,recordCoordinatorTerminal} from './coordinator-terminals.mjs';
import {LAUNCH_WINDOW_MS,bindStartupProcess,bindStartupTerminal,inspectStartup,reserveStartup,releaseLaunchingStartup,releaseStartup,startupRowHolds} from './startup-lock.mjs';

/**
 * The process supervisor for workflow kernels: one kernel per approved, unfinished workflow; a kernel that
 * exits or whose event log stays silent past the health window is started again; two kernels for the same
 * workflow never run. This is the "monitor" a workflow needs — a program, not an agent.
 */
export const SUPERVISOR='starci/kernel-supervisor@1';
const DEFAULT_HEALTH_MS=25*60*1000;   // one wait tick (15 min) plus slack
const DEFAULT_POLL_MS=60*1000;
const readJson=(file,fallback)=>{try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return fallback;}};

/** What the log says about a workflow: last event time and whether the kernel declared itself finished or stopped. */
export function inspectWorkflow(entry,{now=Date.now,aliveFn=pid=>{try{process.kill(pid,0);return true;}catch{return false;}}}={}){
  const state=entry.state??readJson(path.join(entry.dir,'state.json'),null);
  const events=path.join(entry.dir,'events.jsonl');
  let lastAt=0,lastEvent=null;
  try{
    const lines=fs.readFileSync(events,'utf8').trim().split('\n');
    for(let index=lines.length-1;index>=0&&index>=lines.length-3;index-=1){const event=JSON.parse(lines[index]);if(!lastAt){lastAt=event.at??0;lastEvent=event.event??null;}}
  }catch{}
  const lock=readJson(path.join(entry.dir,'kernel.lock'),null);
  const startupFile=path.join(entry.dir,'kernel-startup.sqlite');
  const startup=fs.existsSync(startupFile)?(()=>{try{return inspectStartup(entry.dir)}catch{return null}})():null;
  let alive=false;
  if(lock?.pid){try{process.kill(lock.pid,0);alive=true;}catch{alive=false;}}
  // A launch is in progress only while its reservation still holds: a reservation the launch window has outlived,
  // with its reserving process gone and no kernel holding the lock, is a dead launch the next round reclaims.
  const launching=Boolean(startup)&&startup.phase!=='running'&&startupRowHolds(startup,{now,alive:aliveFn,kernelAlive:()=>alive,launchWindowMs:LAUNCH_WINDOW_MS}).holds;
  const finished=Boolean(state?.finished);
  const approved=Boolean(state?.approved);
  const stopRequested=fs.existsSync(path.join(entry.dir,'stop.flag'));
  return {id:entry.id,dir:entry.dir,approved,finished,stopRequested,alive,launching,startup,ledgerRoot:state?.ledgerRoot??null,ledgerSource:state?.ledgerSource??null,pid:lock?.pid??null,lastAt,lastEvent,silentMs:lastAt?now()-lastAt:null,worktree:state?.worktree??null,host:state?.host??null,run:state?.run??null,workflowTask:state?.workflowTask??null,
    // The host the last kernel of this workflow ran on: the next one is started on the same host, or it would bind a new Orca run over a headless table.
    hostAdapter:typeof state?.hostAdapter==='string'&&state.hostAdapter?state.hostAdapter:null,engine:state?.engine??null};
}

/** Decide, for one workflow, what the supervisor does this round. */
export function supervisorAction(info,{healthMs=DEFAULT_HEALTH_MS}={}){
  if(!info.approved||info.finished||info.stopRequested)return {action:'leave',reason:!info.approved?'not approved':info.finished?'finished':'stop requested'};
  if(info.launching)return {action:'leave',reason:'kernel launch in progress'};
  if(info.alive&&(info.silentMs===null||info.silentMs<healthMs))return {action:'leave',reason:'healthy'};
  if(info.alive)return {action:'restart',reason:`silent for ${Math.round(info.silentMs/60000)} min`};
  return {action:'start',reason:'no kernel process'};
}

/** Start one kernel process detached; its lock file is the only thing that keeps a second one out. */
const shellQuote=value=>`'${String(value).replaceAll("'","''")}'`;
export function startKernel(info,{launcher,spawnFn=spawn,orca=null,log=()=>{},startupToken=null,now=Date.now}){
  if(!info.worktree)return {ok:false,reason:'the workflow state names no worktree',effectState:'none'};
  if(info.engine?.major===6){
    const checked=verifyRuntimePin(info.engine.runtimePin);
    if(!checked.ok){log({event:'runtime-pin-rejected',id:info.id,reason:checked.reason});return {ok:false,reason:checked.reason,effectState:'none'};}
    launcher=checked.launcher;
  }
  // A workflow whose tree was named explicitly at goal time is reached the same way: its store follows that tree.
  const named=info.ledgerSource==='option'&&info.ledgerRoot?['--ledger-root',info.ledgerRoot]:[];
  const adapter=info.hostAdapter?['--host-adapter',info.hostAdapter]:[];
  const args=[launcher,'workflow-run','--id',info.id,'--worktree','.','--host',info.host??'',...(startupToken?['--startup-token',startupToken]:[]),...named,...adapter].filter(Boolean);
  if(info.hostAdapter==='orca'&&orca?.invoke){
    // No kernel of this workflow is alive when it is started, so every coordinator terminal on record is a dead
    // kernel's tab: closed here, by handle, because Orca re-titles an exited kernel's tab to its shell and no title
    // sweep would find it again. What cannot be closed stays recorded for the next start.
    const stale=closeStaleCoordinatorTerminals(info.dir,{close:handle=>{try{return orca.invoke('terminal-close',{terminal:handle},{cwd:info.worktree}).outcome==='ok';}catch{return false;}}});
    if(stale.closed.length)log({event:'stale-kernel-terminals-closed',id:info.id,closed:stale.closed,kept:stale.kept});
    const created=orca.invoke('terminal-create',{worktree:`path:${path.resolve(info.worktree)}`,title:`[Kernel] ${info.id}`,command:process.platform==='win32'?'powershell -NoLogo':'bash'},{cwd:info.worktree});
    const terminal=created.outcome==='ok'?created.receipt?.result?.terminal?.handle:null;
    if(!terminal)return {ok:false,reason:`kernel coordinator terminal creation failed: ${created.reason??'missing terminal handle'}`,effectState:created.effectState??'unknown'};
    recordCoordinatorTerminal(info.dir,terminal);
    const ready=orca.invoke('terminal-read',{terminal},{cwd:info.worktree});
    if(ready.outcome!=='ok'){
      let cleanup=null;if(ready.effectState==='none')try{cleanup=orca.invoke('terminal-close',{terminal},{cwd:info.worktree});}catch(error){cleanup={outcome:'unknown',effectState:'unknown',reason:error.message};}
      const cleaned=cleanup?.outcome==='ok';
      return {ok:false,reason:`kernel coordinator terminal readiness failed: ${ready.reason??'unknown'}${cleanup&&!cleaned?`; terminal cleanup unconfirmed: ${cleanup.reason??cleanup.outcome??'unknown'}`:''}`,effectState:cleaned?'none':'unknown',terminal};
    }
    const bound=[...args,'--from',terminal,...(info.run?['--run',info.run]:[])];
    const command=process.platform==='win32'?`& ${[process.execPath,...bound].map(shellQuote).join(' ')}`:[process.execPath,...bound].map(value=>`'${String(value).replaceAll("'","'\\''")}'`).join(' ');
    const sent=orca.invoke('terminal-send',{terminal,text:command,enter:true},{cwd:info.worktree});
    if(sent.outcome!=='ok'){
      let cleanup=null;if(sent.effectState==='none')try{cleanup=orca.invoke('terminal-close',{terminal},{cwd:info.worktree});}catch(error){cleanup={outcome:'unknown',effectState:'unknown',reason:error.message};}
      const cleaned=cleanup?.outcome==='ok';
      return {ok:false,reason:`kernel coordinator command delivery failed: ${sent.reason??'unknown'}${cleanup&&!cleaned?`; terminal cleanup unconfirmed: ${cleanup.reason??cleanup.outcome??'unknown'}`:''}`,effectState:cleaned?'none':'unknown',terminal};
    }
    // The reservation now names the terminal the kernel command went into: a launch that never acquires within
    // the window is reclaimed by the next round, which also closes this terminal instead of leaving it as an idle tab.
    if(startupToken){const bound=bindStartupTerminal(info.dir,{token:startupToken,terminal,now});if(!bound.ok)log({event:'kernel-startup-terminal-unbound',id:info.id,terminal,reason:bound.reason});}
    log({event:'kernel-started-in-coordinator',id:info.id,terminal,run:info.run??null});
    return {ok:true,pid:null,terminal,run:info.run??null};
  }
  // A kernel that dies must leave its last words: its stdout and stderr are appended to the workflow's own
  // kernel.log, so a crash after a gate round or a launch is readable the next morning instead of inferred.
  let out=null;
  try{out=fs.openSync(path.join(info.dir,'kernel.log'),'a');fs.writeSync(out,`\n=== kernel start ${new Date().toISOString()} ===\n`);}catch{out=null;}
  let child;
  try{child=spawnFn(process.execPath,args,{cwd:info.worktree,detached:true,stdio:out===null?'ignore':['ignore',out,out],windowsHide:true});}
  catch(error){if(out!==null)try{fs.closeSync(out);}catch{}return {ok:false,reason:`kernel process spawn failed: ${error.message}`,effectState:'none'};}
  if(startupToken&&Number.isInteger(child.pid)&&child.pid>0){
    const bound=bindStartupProcess(info.dir,{token:startupToken,pid:child.pid,now});
    if(bound.ok)child.once?.('close',(status,signal)=>{const released=releaseLaunchingStartup(info.dir,bound);if(released)log({event:'kernel-launch-exited-before-acquire',id:info.id,pid:child.pid,status:Number.isInteger(status)?status:null,signal:signal??null});});
  }
  child.unref?.();
  if(out!==null){try{fs.closeSync(out);}catch{}}
  log({event:'kernel-started',id:info.id,pid:child.pid,...(out!==null?{log:path.join(info.dir,'kernel.log')}:{})});
  return {ok:true,pid:child.pid};
}

export function stopKernel(info,{killFn=pid=>process.kill(pid),log=()=>{}}={}){
  if(!info.pid)return {ok:false,reason:'no pid'};
  try{killFn(info.pid);log({event:'kernel-killed',id:info.id,pid:info.pid});return {ok:true};}
  catch(error){return {ok:false,reason:error.message};}
}

/** One supervision round over every workflow of a repository. */
export function superviseOnce({repoRoot,roots=null,launcher,healthMs=DEFAULT_HEALTH_MS,now=Date.now,spawnFn,killFn,orca=null,aliveFn=pid=>{try{process.kill(pid,0);return true;}catch{return false;}},log=()=>{},only=null}){
  const rounds=[];
  // Every store root this supervisor covers: the repository's own and, when it runs from a worktree, that worktree's (a shared ledger puts a workflow's store beside the tree it was named with).
  const stores=[...new Set((roots??[repoRoot]).map(root=>path.resolve(root)))];
  const seen=new Set();
  for(const entry of stores.flatMap(root=>{try{return listWorkflows(root);}catch{return [];}})){
    if(seen.has(entry.dir))continue;seen.add(entry.dir);
    if(only&&!only.includes(entry.id))continue;
    const info=inspectWorkflow(entry,{now,aliveFn});
    const decision=supervisorAction(info,{healthMs});
    let outcome=null;
    // Reserve startup, then launch; a reservation reclaimed from a dead launch is recorded with its reason.
    const reserveAndStart=()=>{
      const reservation=reserveStartup(info.dir,{now,alive:aliveFn});
      if(!reservation.ok)return reservation;
      if(reservation.reclaimed){
        // The terminal that launch was sent into is on the coordinator record; the start below closes it with the rest.
        log({event:'startup-reservation-reclaimed',id:info.id,phase:reservation.reclaimed.phase,pid:reservation.reclaimed.pid,reservedAt:reservation.reclaimed.at,terminal:reservation.reclaimed.terminal??null,reason:reservation.reclaimed.reason});
      }
      const started=startKernel(info,{launcher,spawnFn,orca,log,startupToken:reservation.token,now});
      if(!started.ok&&started.effectState==='none')releaseStartup(info.dir,reservation);
      return started;
    };
    if(decision.action==='restart'){
      const stopped=stopKernel(info,{killFn,log});
      if(info.engine?.major===6&&(!stopped.ok||aliveFn(info.pid))){outcome={ok:false,reason:'prior kernel termination is not confirmed; retain lock and defer restart'};log({event:'kernel-restart-deferred',id:info.id,pid:info.pid,reason:outcome.reason});}
      else outcome=reserveAndStart();
    }
    else if(decision.action==='start')outcome=reserveAndStart();
    rounds.push({id:info.id,...decision,approved:info.approved,finished:info.finished,stopRequested:info.stopRequested,alive:info.alive,silentMs:info.silentMs,outcome});
  }
  return {schema:SUPERVISOR,at:now(),rounds};
}

/** The long-running supervisor: poll, act, sleep; exits only when no approved workflow is unfinished. */
/** The build the supervisor runs from: the launcher's mtime, which every `npm run build` rewrites. */
export function launcherStamp(launcher){try{return Math.round(fs.statSync(launcher).mtimeMs);}catch{return null;}}
/** The supervisor's replacement: the same command line, detached, so the process that reads the new build outlives this one. */
export function respawnSelf({spawnFn=spawn,cwd=process.cwd()}={}){
  const child=spawnFn(process.execPath,process.argv.slice(1),{cwd,detached:true,stdio:'ignore',windowsHide:true});
  child.unref?.();
  return child.pid??null;
}
export function superviseForever({repoRoot,roots=null,launcher,pollMs=DEFAULT_POLL_MS,healthMs,log=()=>{},orca=null,maxRounds=Infinity,sleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms),
  probe=probeRuntimeBudget,probeMs=DEFAULT_PROBE_MS,now=Date.now,stamp=()=>launcherStamp(launcher),respawn=null}){
  let round=0,lastProbe=null;
  const stores=[...new Set((roots??[repoRoot]).map(root=>workflowsRoot(root)))];
  const born=stamp();
  for(;;){
    // The supervisor follows the build exactly as the kernels do: a rebuilt launcher is a new supervisor, started
    // from the same command line before this one leaves, so no build ever needs a hand restart to take effect.
    const current=stamp();
    if(born&&current&&current!==born){
      const pid=respawn?respawn():respawnSelf({cwd:process.cwd()});
      log({event:'supervisor-rebuilt',from:born,to:current,successor:pid});
      return {rounds:[],rebuilt:{from:born,to:current,successor:pid}};
    }
    // The provider quota, on a slow cadence, written beside every store root: kernels read the file, never Orca.
    // A probe that fails leaves the last good budget in place and says so.
    if(lastProbe===null||now()-lastProbe>=probeMs){
      lastProbe=now();
      // A probe that THROWS is a broken `orca` on the PATH, not a reason to stop supervising anything.
      let probed=null;
      try{probed=probe({at:lastProbe});}
      catch(error){probed={ok:false,reason:String(error?.message??error).slice(0,300)};}
      if(probed?.ok){
        for(const store of stores){try{writeRuntimeBudget(store,probed.budget);}catch(error){log({event:'budget-write-failed',store,reason:String(error?.message??error)});}}
        log({event:'budget-probed',providers:Object.fromEntries(Object.entries(probed.budget.providers).map(([provider,entry])=>[provider,Object.fromEntries(Object.entries(entry.windows).map(([name,win])=>[name,win.usedPercent]))]))});
      }else log({event:'budget-probe-failed',reason:probed?.reason??'unknown'});
    }
    // One bad round - a state file read mid-write, a launch that threw - is logged and survived: the supervisor
    // is the one process that must outlive every fault it meets, or nothing restarts anything.
    let result;
    try{result=superviseOnce({repoRoot,roots,launcher,healthMs,log,now,orca});}
    catch(error){log({event:'supervisor-round-failed',round,reason:String(error?.stack??error?.message??error).slice(0,600)});sleep(pollMs);round+=1;continue;}
    log({event:'supervisor-round',round,rounds:result.rounds.map(item=>`${item.id}:${item.action}`)});
    // The pulse a kernel reads to know its supervisor lives (`reviveSupervisor`): pid and time, beside each store.
    for(const store of stores){try{fs.mkdirSync(store,{recursive:true});fs.writeFileSync(path.join(store,'supervisor.lock'),JSON.stringify({pid:process.pid,at:now(),round}));}catch{}}
    // The supervisor lives as long as any approved workflow is unfinished: a stop flag pauses a kernel, it does not
    // end supervision, because the flag is removed when the kernel may run again.
    const active=result.rounds.filter(item=>item.approved&&!item.finished);
    if(!active.length||++round>=maxRounds)return result;
    sleep(pollMs);
  }
}

/**
 * `runner` is the host the launcher selected (`--host-adapter`, `STARCI_HOST`): the supervisor only spawns
 * launchers, so the one thing it takes from the host is the budget probe - a host that cannot read the provider
 * quota answers with a reason and the last written budget stands, exactly as an unreachable Orca does.
 */
export function supervisorMain(options,{cwd,runner=null}){
  // The workflow store lives in the repository the worktree belongs to (git common dir), exactly as the kernel resolves it.
  const repoRoot=repositoryRoot(path.resolve(cwd));
  const roots=[repoRoot,path.resolve(cwd)];
  const host=path.resolve(options.host??'');
  const launcher=path.join(host,'.dist','hosts','orca','launch.mjs');
  // One line per round into every store root this supervisor covers, so each workflow's view finds its supervisor beside it.
  const logFiles=[...new Set(roots.map(root=>path.join(workflowsRoot(root),'supervisor.log')))];
  const log=event=>{const line=`${JSON.stringify({at:Date.now(),...event})}
`;for(const file of logFiles){try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.appendFileSync(file,line);}catch{}}};
  if(options.once==='true')return superviseOnce({repoRoot,roots,launcher,log,orca:runner,only:options.id?[options.id]:null});
  const probe=typeof runner?.probeBudget==='function'?()=>runner.probeBudget():probeRuntimeBudget;
  return superviseForever({repoRoot,roots,launcher,log,orca:runner,probe,pollMs:Number(options['poll-ms']??DEFAULT_POLL_MS),healthMs:Number(options['health-ms']??DEFAULT_HEALTH_MS),probeMs:Number(options['probe-ms']??DEFAULT_PROBE_MS)});
}
