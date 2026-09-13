import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {listWorkflows,repositoryRoot,workflowsRoot} from './store.mjs';
import {DEFAULT_PROBE_MS,probeRuntimeBudget,writeRuntimeBudget} from './budget.mjs';

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
export function inspectWorkflow(entry,{now=Date.now}={}){
  const state=entry.state??readJson(path.join(entry.dir,'state.json'),null);
  const events=path.join(entry.dir,'events.jsonl');
  let lastAt=0,lastEvent=null;
  try{
    const lines=fs.readFileSync(events,'utf8').trim().split('\n');
    for(let index=lines.length-1;index>=0&&index>=lines.length-3;index-=1){const event=JSON.parse(lines[index]);if(!lastAt){lastAt=event.at??0;lastEvent=event.event??null;}}
  }catch{}
  const lock=readJson(path.join(entry.dir,'kernel.lock'),null);
  let alive=false;
  if(lock?.pid){try{process.kill(lock.pid,0);alive=true;}catch{alive=false;}}
  // A finish declared over a stall that time lifts (the daily op budget) is not a finish: the kernel withdraws it
  // on start, so the supervisor keeps such a workflow alive and starts it again.
  const finished=Boolean(state?.finished)&&state.finished.reason!=='no runtime accepted an operation';
  const approved=Boolean(state?.approved);
  const stopRequested=fs.existsSync(path.join(entry.dir,'stop.flag'));
  return {id:entry.id,dir:entry.dir,approved,finished,stopRequested,alive,ledgerRoot:state?.ledgerRoot??null,ledgerSource:state?.ledgerSource??null,pid:lock?.pid??null,lastAt,lastEvent,silentMs:lastAt?now()-lastAt:null,worktree:state?.worktree??null,host:state?.host??null,
    // The host the last kernel of this workflow ran on: the next one is started on the same host, or it would bind a new Orca run over a headless table.
    hostAdapter:typeof state?.hostAdapter==='string'&&state.hostAdapter?state.hostAdapter:null};
}

/** Decide, for one workflow, what the supervisor does this round. */
export function supervisorAction(info,{healthMs=DEFAULT_HEALTH_MS}={}){
  if(!info.approved||info.finished||info.stopRequested)return {action:'leave',reason:!info.approved?'not approved':info.finished?'finished':'stop requested'};
  if(info.alive&&(info.silentMs===null||info.silentMs<healthMs))return {action:'leave',reason:'healthy'};
  if(info.alive)return {action:'restart',reason:`silent for ${Math.round(info.silentMs/60000)} min`};
  return {action:'start',reason:'no kernel process'};
}

/** Start one kernel process detached; its lock file is the only thing that keeps a second one out. */
export function startKernel(info,{launcher,spawnFn=spawn,log=()=>{}}){
  if(!info.worktree)return {ok:false,reason:'the workflow state names no worktree'};
  // A workflow whose tree was named explicitly at goal time is reached the same way: its store follows that tree.
  const named=info.ledgerSource==='option'&&info.ledgerRoot?['--ledger-root',info.ledgerRoot]:[];
  const adapter=info.hostAdapter?['--host-adapter',info.hostAdapter]:[];
  const args=[launcher,'workflow-run','--id',info.id,'--worktree','.','--host',info.host??'',...named,...adapter].filter(Boolean);
  // A kernel that dies must leave its last words: its stdout and stderr are appended to the workflow's own
  // kernel.log, so a crash after a gate round or a launch is readable the next morning instead of inferred.
  let out=null;
  try{out=fs.openSync(path.join(info.dir,'kernel.log'),'a');fs.writeSync(out,`\n=== kernel start ${new Date().toISOString()} ===\n`);}catch{out=null;}
  const child=spawnFn(process.execPath,args,{cwd:info.worktree,detached:true,stdio:out===null?'ignore':['ignore',out,out],windowsHide:true});
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
export function superviseOnce({repoRoot,roots=null,launcher,healthMs=DEFAULT_HEALTH_MS,now=Date.now,spawnFn,killFn,log=()=>{},only=null}){
  const rounds=[];
  // Every store root this supervisor covers: the repository's own and, when it runs from a worktree, that worktree's (a shared ledger puts a workflow's store beside the tree it was named with).
  const stores=[...new Set((roots??[repoRoot]).map(root=>path.resolve(root)))];
  const seen=new Set();
  for(const entry of stores.flatMap(root=>{try{return listWorkflows(root);}catch{return [];}})){
    if(seen.has(entry.dir))continue;seen.add(entry.dir);
    if(only&&!only.includes(entry.id))continue;
    const info=inspectWorkflow(entry,{now});
    const decision=supervisorAction(info,{healthMs});
    let outcome=null;
    if(decision.action==='restart'){stopKernel(info,{killFn,log});try{fs.rmSync(path.join(info.dir,'kernel.lock'),{force:true});}catch{}outcome=startKernel(info,{launcher,spawnFn,log});}
    else if(decision.action==='start'){try{fs.rmSync(path.join(info.dir,'kernel.lock'),{force:true});}catch{}outcome=startKernel(info,{launcher,spawnFn,log});}
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
export function superviseForever({repoRoot,roots=null,launcher,pollMs=DEFAULT_POLL_MS,healthMs,log=()=>{},maxRounds=Infinity,sleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms),
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
      const probed=probe({at:lastProbe});
      if(probed?.ok){
        for(const store of stores){try{writeRuntimeBudget(store,probed.budget);}catch(error){log({event:'budget-write-failed',store,reason:String(error?.message??error)});}}
        log({event:'budget-probed',providers:Object.fromEntries(Object.entries(probed.budget.providers).map(([provider,entry])=>[provider,Object.fromEntries(Object.entries(entry.windows).map(([name,win])=>[name,win.usedPercent]))]))});
      }else log({event:'budget-probe-failed',reason:probed?.reason??'unknown'});
    }
    const result=superviseOnce({repoRoot,roots,launcher,healthMs,log,now});
    log({event:'supervisor-round',round,rounds:result.rounds.map(item=>`${item.id}:${item.action}`)});
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
  if(options.once==='true')return superviseOnce({repoRoot,roots,launcher,log,only:options.id?[options.id]:null});
  const probe=typeof runner?.probeBudget==='function'?()=>runner.probeBudget():probeRuntimeBudget;
  return superviseForever({repoRoot,roots,launcher,log,probe,pollMs:Number(options['poll-ms']??DEFAULT_POLL_MS),healthMs:Number(options['health-ms']??DEFAULT_HEALTH_MS),probeMs:Number(options['probe-ms']??DEFAULT_PROBE_MS)});
}
