import fs from 'node:fs';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {listWorkflows,repositoryRoot,workflowsRoot} from './workflow-store.mjs';

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
  const finished=Boolean(state?.finished);
  const approved=Boolean(state?.approved);
  const stopRequested=fs.existsSync(path.join(entry.dir,'stop.flag'));
  return {id:entry.id,dir:entry.dir,approved,finished,stopRequested,alive,ledgerRoot:state?.ledgerRoot??null,ledgerSource:state?.ledgerSource??null,pid:lock?.pid??null,lastAt,lastEvent,silentMs:lastAt?now()-lastAt:null,worktree:state?.worktree??null,host:state?.host??null};
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
  const args=[launcher,'workflow-run','--id',info.id,'--worktree','.','--host',info.host??'',...named].filter(Boolean);
  const child=spawnFn(process.execPath,args,{cwd:info.worktree,detached:true,stdio:'ignore',windowsHide:true});
  child.unref?.();
  log({event:'kernel-started',id:info.id,pid:child.pid});
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
export function superviseForever({repoRoot,roots=null,launcher,pollMs=DEFAULT_POLL_MS,healthMs,log=()=>{},maxRounds=Infinity,sleep=ms=>Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms)}){
  let round=0;
  for(;;){
    const result=superviseOnce({repoRoot,roots,launcher,healthMs,log});
    log({event:'supervisor-round',round,rounds:result.rounds.map(item=>`${item.id}:${item.action}`)});
    // The supervisor lives as long as any approved workflow is unfinished: a stop flag pauses a kernel, it does not
    // end supervision, because the flag is removed when the kernel may run again.
    const active=result.rounds.filter(item=>item.approved&&!item.finished);
    if(!active.length||++round>=maxRounds)return result;
    sleep(pollMs);
  }
}

export function supervisorMain(options,{cwd}){
  // The workflow store lives in the repository the worktree belongs to (git common dir), exactly as the kernel resolves it.
  const repoRoot=repositoryRoot(path.resolve(cwd));
  const roots=[repoRoot,path.resolve(cwd)];
  const host=path.resolve(options.host??'');
  const launcher=path.join(host,'.dist','execution','orca-supervised-launch.mjs');
  // One line per round into every store root this supervisor covers, so each workflow's view finds its supervisor beside it.
  const logFiles=[...new Set(roots.map(root=>path.join(workflowsRoot(root),'supervisor.log')))];
  const log=event=>{const line=`${JSON.stringify({at:Date.now(),...event})}
`;for(const file of logFiles){try{fs.mkdirSync(path.dirname(file),{recursive:true});fs.appendFileSync(file,line);}catch{}}};
  if(options.once==='true')return superviseOnce({repoRoot,roots,launcher,log,only:options.id?[options.id]:null});
  return superviseForever({repoRoot,roots,launcher,log,pollMs:Number(options['poll-ms']??DEFAULT_POLL_MS),healthMs:Number(options['health-ms']??DEFAULT_HEALTH_MS)});
}
