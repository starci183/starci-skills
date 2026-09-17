import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {listWorkflows,repositoryRoot} from './store.mjs';
import {ledgerFileFor,machineFileFor,openLedger,openMachine,inspectLedger} from './ledger-db.mjs';
import {DEFAULT_PROBE_MS,probeRuntimeBudget} from './budget.mjs';
import {verifyRuntimePin} from './runtime-pin.mjs';
import {LAUNCH_WINDOW_MS,claimSupervisor,signalRow,bindStartupProcess,bindStartupTerminal,inspectStartup,reserveStartup,releaseLaunchingStartup,releaseStartup,startupRowHolds,
  closeStaleCoordinatorTerminals,recordCoordinatorTerminal,seedCoordinatorTerminals} from './launch.mjs';
import {recordProviderLoads,sweepRuntimeLoads} from './loads.mjs';
import {reopenLane} from './lanes.mjs';
import {sealedRuntimeOf,plain} from './common.mjs';
import {measureHeadroom} from './disk.mjs';

/**
 * The process supervisor for workflow kernels: one kernel per approved, unfinished workflow; a kernel that
 * exits or whose event log stays silent past the health window is started again; two kernels for the same
 * workflow never run. Every fact it reads - the workflow list, a kernel's liveness, its own single-supervisor
 * claim - is a row of the repository ledger; a root whose `.starciwork/runtime.sqlite` does not exist has no
 * workflows the supervisor may see. This is the "monitor" a workflow needs — a program, not an agent.
 */
export const SUPERVISOR='starci/kernel-supervisor@1';
const DEFAULT_HEALTH_MS=25*60*1000;   // one wait tick (15 min) plus slack
const DEFAULT_POLL_MS=60*1000;
const pidAlive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}};

/** What the ledger says about a workflow: last event time and whether a kernel holds its `kernel-lock` signal. */
export function inspectWorkflow(entry,{ledger,now=Date.now,aliveFn=pidAlive,measure=measureHeadroom}={}){
  const state=entry.state??null;
  // The disk where this workflow writes, measured every round: a kernel is never started onto a volume with no room.
  const headroom=measure([entry.dir,state?.worktree,state?.engine?.journalFile,state?.engine?.ledgerFile]);
  let lastAt=0,lastEvent=null;
  if(ledger?.db){
    const last=ledger.db.prepare('SELECT kind,created_at FROM events WHERE workflow_id=? ORDER BY seq DESC LIMIT 1').get(entry.id);
    if(last){lastAt=last.created_at;lastEvent=last.kind;}
  }
  const startup=ledger?.db?inspectStartup(ledger,entry.id):null;
  const alive=Boolean(startup)&&startup.phase==='running'&&Number.isInteger(startup.pid)&&aliveFn(startup.pid);
  // A launch is in progress only while its reservation still holds: a reservation the launch window has outlived,
  // with its reserving process gone and no kernel holding the lock, is a dead launch the next round reclaims.
  const launching=Boolean(startup)&&startup.phase!=='running'&&startupRowHolds(startup,{now,alive:aliveFn,kernelAlive:()=>alive,launchWindowMs:LAUNCH_WINDOW_MS}).holds;
  const finished=Boolean(state?.finished);
  const approved=Boolean(state?.approved);
  const stopRequested=Boolean(ledger?.db&&signalRow(ledger.db,entry.id,'stop'));
  return {id:entry.id,dir:entry.dir??null,approved,finished,stopRequested,alive,launching,startup,ledgerRoot:state?.ledgerRoot??null,ledgerSource:state?.ledgerSource??null,pid:alive?startup.pid:null,lastAt,lastEvent,silentMs:lastAt?now()-lastAt:null,worktree:state?.worktree??null,lane:plain(state?.lane)?state.lane:null,host:state?.host??null,run:state?.run??null,workflowTask:state?.workflowTask??null,
    // The host the last kernel of this workflow ran on: the next one is started on the same host, or it would bind a new Orca run over a headless table.
    hostAdapter:typeof state?.hostAdapter==='string'&&state.hostAdapter?state.hostAdapter:null,engine:state?.engine??null,headroom};
}

/** Decide, for one workflow, what the supervisor does this round. */
export function supervisorAction(info,{healthMs=DEFAULT_HEALTH_MS}={}){
  if(!info.approved||info.finished||info.stopRequested)return {action:'leave',reason:!info.approved?'not approved':info.finished?'finished':'stop requested'};
  if(info.launching)return {action:'leave',reason:'kernel launch in progress'};
  if(info.headroom&&!info.headroom.ok)return {action:'leave',reason:'disk headroom below threshold',headroom:info.headroom};
  if(info.alive&&(info.silentMs===null||info.silentMs<healthMs))return {action:'leave',reason:'healthy'};
  if(info.alive)return {action:'restart',reason:`silent for ${Math.round(info.silentMs/60000)} min`};
  return {action:'start',reason:'no kernel process'};
}

/** Start one kernel process detached; its `kernel-lock` signal is the only thing that keeps a second one out. */
const shellQuote=value=>`'${String(value).replaceAll("'","''")}'`;
export function startKernel(info,{launcher,spawnFn=spawn,orca=null,log=()=>{},startupToken=null,now=Date.now,ledger=null}){
  if(!info.worktree)return {ok:false,reason:'the workflow state names no worktree',effectState:'none'};
  // A worktree deleted since the last run (by hand, or by a host that garbage-collects idle trees) is not a
  // dead workflow: the lane's branch still lives in the repository, and the recorded row is reopened on it
  // before anything is spawned into a directory that is not there.
  if(!fs.existsSync(info.worktree)){
    if(!info.lane?.branch||!info.lane?.base?.worktree)return {ok:false,reason:`the workflow worktree ${info.worktree} is not on disk and no lane is recorded to reopen it`,effectState:'none'};
    if(!orca?.invoke)return {ok:false,reason:`the workflow worktree ${info.worktree} is not on disk and no Orca runner is available to reopen its lane`,effectState:'none'};
    try{
      const reopened=reopenLane(orca,{workflowId:info.id,branch:info.lane.branch,path:info.worktree,repoRoot:info.lane.base.worktree});
      log({event:'lane-reopened',id:info.id,worktree:reopened.worktree,branch:reopened.branch});
      info={...info,worktree:reopened.worktree};
    }catch(error){return {ok:false,reason:`the workflow worktree is not on disk and reopening its lane failed: ${error.message}`,effectState:'none'};}
  }
  if(sealedRuntimeOf({engine:info.engine})){
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
    // The record is seeded from the supervisor's own log: every coordinator terminal a supervisor ever opened for this
    // workflow is on it, including those opened before the signal existed.
    if(ledger?.db){
      seedCoordinatorTerminals(ledger,info.id,{logFile:path.join(path.dirname(ledger.file),'supervisor.log')});
      const stale=closeStaleCoordinatorTerminals(ledger,info.id,{close:handle=>{try{return orca.invoke('terminal-close',{terminal:handle},{cwd:info.worktree}).outcome==='ok';}catch{return false;}}});
      if(stale.closed?.length)log({event:'stale-kernel-terminals-closed',id:info.id,closed:stale.closed,kept:stale.open});
    }
    const created=orca.invoke('terminal-create',{worktree:`path:${path.resolve(info.worktree)}`,title:`[Kernel] ${info.id}`,command:process.platform==='win32'?'powershell -NoLogo':'bash'},{cwd:info.worktree});
    const terminal=created.outcome==='ok'?created.receipt?.result?.terminal?.handle:null;
    if(!terminal)return {ok:false,reason:`kernel coordinator terminal creation failed: ${created.reason??'missing terminal handle'}`,effectState:created.effectState??'unknown'};
    if(ledger?.db)recordCoordinatorTerminal(ledger,info.id,terminal);
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
    if(startupToken&&ledger?.db){const bound=bindStartupTerminal(ledger,info.id,{token:startupToken,terminal,now});if(!bound.ok)log({event:'kernel-startup-terminal-unbound',id:info.id,terminal,reason:bound.reason});}
    log({event:'kernel-started-in-coordinator',id:info.id,terminal,run:info.run??null});
    return {ok:true,pid:null,terminal,run:info.run??null};
  }
  // A kernel that dies must leave its last words: its stdout and stderr go to a kernel.log outside the ledger -
  // it is a crash artifact, not state, and no other stream imports it.
  const kernelLog=path.join(os.tmpdir(),'starci',info.id,'kernel.log');
  let out=null;
  try{fs.mkdirSync(path.dirname(kernelLog),{recursive:true});out=fs.openSync(kernelLog,'a');fs.writeSync(out,`\n=== kernel start ${new Date().toISOString()} ===\n`);}catch{out=null;}
  let child;
  try{child=spawnFn(process.execPath,args,{cwd:info.worktree,detached:true,stdio:out===null?'ignore':['ignore',out,out],windowsHide:true});}
  catch(error){if(out!==null)try{fs.closeSync(out);}catch{}return {ok:false,reason:`kernel process spawn failed: ${error.message}`,effectState:'none'};}
  if(startupToken&&Number.isInteger(child.pid)&&child.pid>0&&ledger?.db){
    const bound=bindStartupProcess(ledger,info.id,{token:startupToken,pid:child.pid,now});
    if(bound.ok)child.once?.('close',(status,signal)=>{if(releaseLaunchingStartup(ledger,info.id,bound))log({event:'kernel-launch-exited-before-acquire',id:info.id,pid:child.pid,status:Number.isInteger(status)?status:null,signal:signal??null});});
  }
  child.unref?.();
  if(out!==null){try{fs.closeSync(out);}catch{}}
  log({event:'kernel-started',id:info.id,pid:child.pid,...(out!==null?{log:kernelLog}:{})});
  return {ok:true,pid:child.pid};
}

export function stopKernel(info,{killFn=pid=>process.kill(pid),log=()=>{}}={}){
  if(!info.pid)return {ok:false,reason:'no pid'};
  try{killFn(info.pid);log({event:'kernel-killed',id:info.id,pid:info.pid});return {ok:true};}
  catch(error){return {ok:false,reason:error.message};}
}

/** One supervision round over every ledger-registered workflow of the roots it covers. */
/** Which workflows the supervisor has already reported as out of disk or unmigrated: the event is logged on the change, not every round. */
const headroomReported=new Set(),unmigratedReported=new Set();
export function superviseOnce({repoRoot,roots=null,launcher,healthMs=DEFAULT_HEALTH_MS,now=Date.now,spawnFn,killFn,orca=null,aliveFn=pidAlive,log=()=>{},only=null,measure=measureHeadroom,
  listFn=listWorkflows,ledgerFor=null,machine=null,machineFile=null,inspectLedgerFn=inspectLedger}){
  const rounds=[];
  // Every ledger root this supervisor covers: the repository's own and, when it runs from a worktree, that
  // worktree's (a shared ledger puts a workflow beside the tree it was named with).
  const stores=[...new Set((roots??[repoRoot]).map(root=>path.resolve(root)))];
  // The machine db's share of the tick: expired and orphaned cross-ledger leases go before any local act.
  let machineHandle=machine??null;
  try{
    if(!machineHandle)machineHandle=openMachine({file:machineFile??machineFileFor(),now});
    const swept=machineHandle.sweep({inspectLedger:inspectLedgerFn,at:now()});
    if(swept&&(swept.expired||swept.orphaned))log({event:'machine-leases-swept',expired:swept.expired,orphaned:swept.orphaned});
  }catch(error){log({event:'machine-sweep-failed',reason:String(error?.message??error).slice(0,200)});}
  finally{if(!machine&&machineHandle)try{machineHandle.close();}catch{}}
  const ledgers=new Map(),opened=[];
  const ledgerOf=root=>{
    if(ledgers.has(root))return ledgers.get(root);
    let handle=ledgerFor?.(root)??null;
    if(!handle&&fs.existsSync(ledgerFileFor(root))){
      try{handle=openLedger({file:ledgerFileFor(root),now});opened.push(handle);}
      catch(error){log({event:'ledger-open-failed',root,file:ledgerFileFor(root),reason:String(error?.message??error).slice(0,200)});handle=null;}
    }
    ledgers.set(root,handle);return handle;
  };
  try{
    const seen=new Set();
    for(const root of stores){
      const ledger=ledgerOf(root);
      if(!ledger){
        // A `_local` store with no ledger is a checkout that was never migrated: named once, never scanned.
        if(fs.existsSync(path.join(root,'.starciwork','_local','workflows'))&&!unmigratedReported.has(root)){unmigratedReported.add(root);log({event:'ledger-unmigrated',root});}
        continue;
      }
      const swept=sweepRuntimeLoads(ledger,{now});
      if(swept.dropped?.length)log({event:'runtime-loads-swept',root,dropped:swept.dropped});
      let entries=[];try{entries=listFn(root)??[];}catch{entries=[];}
      for(const entry of entries){
        if(seen.has(entry.id))continue;seen.add(entry.id);
        if(only&&!only.includes(entry.id))continue;
        const info=inspectWorkflow(entry,{ledger,now,aliveFn,measure});
        const decision=supervisorAction(info,{healthMs});
        if(decision.headroom){if(!headroomReported.has(info.id)){headroomReported.add(info.id);log({event:'disk-headroom-exhausted',id:info.id,thresholdBytes:decision.headroom.thresholdBytes,volumes:decision.headroom.exhausted.map(item=>({path:item.path,freeBytes:item.freeBytes}))});}}
        else if(headroomReported.delete(info.id))log({event:'disk-headroom-restored',id:info.id});
        let outcome=null;
        // Reserve startup, then launch; a reservation reclaimed from a dead launch is recorded with its reason.
        const reserveAndStart=()=>{
          const reservation=reserveStartup(ledger,info.id,{now,alive:aliveFn});
          if(!reservation.ok)return reservation;
          if(reservation.reclaimed){
            // The terminal that launch was sent into is on the coordinator record; the start below closes it with the rest.
            log({event:'startup-reservation-reclaimed',id:info.id,phase:reservation.reclaimed.phase,pid:reservation.reclaimed.pid,reservedAt:reservation.reclaimed.at,terminal:reservation.reclaimed.terminal??null,reason:reservation.reclaimed.reason});
          }
          const started=startKernel(info,{launcher,spawnFn,orca,log,startupToken:reservation.token,now,ledger});
          if(!started.ok&&started.effectState==='none')releaseStartup(ledger,info.id,reservation);
          return started;
        };
        if(decision.action==='restart'){
          const stopped=stopKernel(info,{killFn,log});
          if(info.engine&&(!stopped.ok||aliveFn(info.pid))){outcome={ok:false,reason:'prior kernel termination is not confirmed; retain lock and defer restart'};log({event:'kernel-restart-deferred',id:info.id,pid:info.pid,reason:outcome.reason});}
          else outcome=reserveAndStart();
        }
        else if(decision.action==='start')outcome=reserveAndStart();
        rounds.push({id:info.id,...decision,approved:info.approved,finished:info.finished,stopRequested:info.stopRequested,alive:info.alive,silentMs:info.silentMs,outcome});
      }
    }
  }finally{for(const handle of opened)try{handle.close();}catch{}}
  return {schema:SUPERVISOR,at:now(),rounds};
}

/** The long-running supervisor: claim, poll, act, sleep; exits only when no approved workflow is unfinished. */
/** The build the supervisor runs from: the launcher's mtime, which every `npm run build` rewrites. */
export function launcherStamp(launcher){try{return Math.round(fs.statSync(launcher).mtimeMs);}catch{return null;}}
/** The supervisor's replacement: the same command line, detached, so the process that reads the new build outlives this one. */
export function respawnSelf({spawnFn=spawn,cwd=process.cwd()}={}){
  const child=spawnFn(process.execPath,process.argv.slice(1),{cwd,detached:true,stdio:'ignore',windowsHide:true});
  child.unref?.();
  return child.pid??null;
}
export function superviseForever({repoRoot,roots=null,launcher,pollMs=DEFAULT_POLL_MS,healthMs,log=()=>{},orca=null,maxRounds=Infinity,sleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms),
  probe=probeRuntimeBudget,probeMs=DEFAULT_PROBE_MS,now=Date.now,stamp=()=>launcherStamp(launcher),respawn=null,aliveFn=pidAlive,listFn=listWorkflows,ledgerFor=null,machine=null,machineFile=null,inspectLedgerFn=inspectLedger,lockTtlMs=null}){
  let round=0,lastProbe=null;
  const stores=[...new Set((roots??[repoRoot]).map(root=>path.resolve(root)))];
  const ttl=lockTtlMs??Math.max(pollMs*3,DEFAULT_POLL_MS);
  const yielded=new Set(),held=[];
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
    // The single-supervisor rule: one live holder per ledger. A claim doubles as the round's pulse - the row's
    // `at` and `round` are refreshed here, and a kernel reads it to know its supervisor lives.
    const claimed=[],handles=[];
    for(const root of stores){
      const file=ledgerFileFor(root);
      if(!fs.existsSync(file)){
        if(fs.existsSync(path.join(root,'.starciwork','_local','workflows'))&&!unmigratedReported.has(root)){unmigratedReported.add(root);log({event:'ledger-unmigrated',root});}
        continue;
      }
      let handle=null;
      try{handle=openLedger({file,now});}catch(error){log({event:'ledger-open-failed',root,file,reason:String(error?.message??error).slice(0,200)});continue;}
      const claim=claimSupervisor(handle,{pid:process.pid,round,ttl,now,alive:aliveFn});
      if(claim.ok){claimed.push(root);handles.push(handle);if(yielded.delete(root))log({event:'supervisor-claimed',root});}
      else{if(!yielded.has(root)){yielded.add(root);log({event:'supervisor-yielded',root,holder:claim.holder?.pid??null});}try{handle.close();}catch{}}
    }
    if(!claimed.length)return {schema:SUPERVISOR,at:now(),rounds:[],yielded:true};
    // The provider quota, on a slow cadence, written into every claimed ledger: kernels read the rows, never Orca.
    // A probe that fails leaves the last good budget in place and says so.
    if(lastProbe===null||now()-lastProbe>=probeMs){
      lastProbe=now();
      // A probe that THROWS is a broken `orca` on the PATH, not a reason to stop supervising anything.
      let probed=null;
      try{probed=probe({at:lastProbe});}
      catch(error){probed={ok:false,reason:String(error?.message??error).slice(0,300)};}
      if(probed?.ok){
        for(const handle of handles){try{recordProviderLoads(handle,probed.budget,{now});}catch(error){log({event:'budget-write-failed',root:handle.path,reason:String(error?.message??error).slice(0,200)});}}
        log({event:'budget-probed',providers:Object.fromEntries(Object.entries(probed.budget.providers).map(([provider,entry])=>[provider,Object.fromEntries(Object.entries(entry.windows).map(([name,win])=>[name,win.usedPercent]))]))});
      }else log({event:'budget-probe-failed',reason:probed?.reason??'unknown'});
    }
    const byRoot=new Map(claimed.map((root,index)=>[root,handles[index]]));
    // One bad round - a row read mid-write, a launch that threw - is logged and survived: the supervisor
    // is the one process that must outlive every fault it meets, or nothing restarts anything.
    let result;
    try{result=superviseOnce({repoRoot,roots:claimed,launcher,healthMs,log,now,orca,aliveFn,listFn,ledgerFor:root=>byRoot.get(root)??null,machine,machineFile,inspectLedgerFn});}
    catch(error){log({event:'supervisor-round-failed',round,reason:String(error?.stack??error?.message??error).slice(0,600)});for(const handle of handles)try{handle.close();}catch{}sleep(pollMs);round+=1;continue;}
    for(const handle of handles)try{handle.close();}catch{}
    log({event:'supervisor-round',round,rounds:result.rounds.map(item=>`${item.id}:${item.action}`)});
    // The supervisor lives as long as any approved workflow is unfinished: a stop signal pauses a kernel, it does
    // not end supervision, because the signal is cleared when the kernel may run again.
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
  // The workflow ledger lives in the repository the worktree belongs to (git common dir), exactly as the kernel resolves it.
  const repoRoot=repositoryRoot(path.resolve(cwd));
  const roots=[repoRoot,path.resolve(cwd)];
  const host=path.resolve(options.host??'');
  const launcher=path.join(host,'.dist','hosts','orca','launch.mjs');
  // One line per round into every ledger root this supervisor covers, so each workflow's view finds its supervisor beside it.
  const logFiles=[...new Set(roots.map(root=>path.join(root,'.starciwork','supervisor.log')))];
  const log=event=>{const line=`${JSON.stringify({at:Date.now(),...event})}
`;for(const file of logFiles){try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.appendFileSync(file,line);}catch{}}};
  if(options.once==='true')return superviseOnce({repoRoot,roots,launcher,log,orca:runner,only:options.id?[options.id]:null});
  const probe=typeof runner?.probeBudget==='function'?()=>runner.probeBudget():probeRuntimeBudget;
  return superviseForever({repoRoot,roots,launcher,log,orca:runner,probe,pollMs:Number(options['poll-ms']??DEFAULT_POLL_MS),healthMs:Number(options['health-ms']??DEFAULT_HEALTH_MS),probeMs:Number(options['probe-ms']??DEFAULT_PROBE_MS)});
}
