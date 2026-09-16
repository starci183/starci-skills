import fs from 'node:fs';
import path from 'node:path';

/**
 * The shared runtime ledger of one repository: `<workflowsRoot>/runtime-loads.json`. Several workflows run at
 * once, each with its own kernel and its own allocator, so nothing but this file tells one kernel that another
 * is already on `claude-fable-5.1` and that a provider parked it two minutes ago. The ledger carries exactly
 * facts per runtime - which workflow reserves/runs which operation, recent settled service durations, shared
 * provider cooldown and compatibility daily counters. It never carries provider quota; the probed budget is a
 * separate fresh observation.
 *
 * Several kernels write the file, so a write takes a `.lock` beside it (pid plus timestamp, retried with short
 * waits, stale after 30 s), rewrites the whole document into a temp file and renames it into place. Reading is
 * unguarded and forgiving: an unreadable, truncated or foreign file reads as an empty ledger, which degrades
 * allocation to today's local behaviour instead of blocking a launch. Entries of a workflow whose kernel is
 * dead - its `kernel.lock` names no live pid - are ignored on read and dropped on the next write, so a crashed
 * kernel never holds a slot of the expensive runtime for the others.
 */
export const RUNTIME_LOADS='starci/runtime-loads@1';
export const LOADS_FILE='runtime-loads.json';
export const LOCK_STALE_MS=30000;
export const LOCK_WAIT_MS=20;
export const LOCK_RETRIES=40;
/** Completed service is relevant only while it can describe current quota/load conditions. */
export const SERVICE_OBSERVATION_MS=6*60*60*1000;
export const MAX_SERVICE_OBSERVATIONS=256;
/** Only a provider limit is everyone's: a rate limit and an exhausted quota are shared, a local failure is not. */
export const SHARED_COOLING_KINDS=['rate-limited','quota'];

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const utcDay=ms=>new Date(ms).toISOString().slice(0,10);
const text=(value,limit=200)=>typeof value==='string'?value.slice(0,limit):null;
const sleepSync=ms=>{try{Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,ms);}catch{}};

/** The ledger of a workflows root; `<repo>/.starciwork/_local/workflows/runtime-loads.json`. */
export function loadsFile(workflowsRoot){return path.join(String(workflowsRoot??''),LOADS_FILE);}
/** The ledger beside a workflow store: the store directory's parent is the repository's workflows root. */
export function loadsFileFor(storeDir){return loadsFile(path.dirname(String(storeDir??'')));}

/** Whether a pid is a live process - the same question the supervisor asks of `kernel.lock`. */
export function pidAlive(pid){
  const id=Number(pid);
  if(!Number.isInteger(id)||id<=0)return false;
  // EPERM means the process exists and belongs to somebody else; only ESRCH means it is gone.
  try{process.kill(id,0);return true;}catch(error){return error?.code==='EPERM';}
}
/** A workflow's kernel is live when its own store directory holds a `kernel.lock` with a live pid. */
export function kernelAliveAt(workflowsRoot,workflow){
  try{return pidAlive(JSON.parse(fs.readFileSync(path.join(String(workflowsRoot??''),String(workflow??''),'kernel.lock'),'utf8'))?.pid);}
  catch{return false;}
}

function readRaw(file){try{return JSON.parse(fs.readFileSync(file,'utf8'));}catch{return null;}}

/**
 * Whatever is on disk, read as the ledger: unknown fields are dropped, an expired cooldown is gone, and a live
 * entry survives only when its workflow is this kernel (always live: it is us) or a kernel with a live pid.
 */
function adopt(raw,{now,own,alive}){
  const at=now(),today=utcDay(at),runtimes={};
  for(const [id,entry] of Object.entries(plain(raw?.runtimes)?raw.runtimes:{})){
    if(!id||!plain(entry))continue;
    const live=(Array.isArray(entry.live)?entry.live:[])
      .filter(item=>plain(item)&&typeof item.workflow==='string'&&item.workflow&&typeof item.op==='string'&&item.op)
      .filter(item=>item.workflow===own||alive(item.workflow))
      .map(item=>({workflow:item.workflow,op:item.op,since:Number.isFinite(item.since)?item.since:at,phase:item.phase==='reserved'?'reserved':'launched',
        launchedAt:Number.isFinite(item.launchedAt)?item.launchedAt:null,
        estimateMs:Number.isFinite(item.estimateMs)&&item.estimateMs>0?item.estimateMs:null,
        role:text(item.role,40),difficulty:text(item.difficulty,20)}));
    const cool=plain(entry.cooling)&&Number.isFinite(entry.cooling.until)&&entry.cooling.until>at
      ?{until:entry.cooling.until,reason:text(entry.cooling.reason),kind:text(entry.cooling.kind,40),workflow:text(entry.cooling.workflow,120)}
      :null;
    const day=typeof entry.day==='string'&&entry.day?entry.day:today;
    const history=(Array.isArray(entry.history)?entry.history:[])
      .filter(item=>plain(item)&&Number.isFinite(item.at)&&item.at>=at-SERVICE_OBSERVATION_MS&&Number.isFinite(item.durationMs)&&item.durationMs>=0)
      .map(item=>({workflow:text(item.workflow,120),op:text(item.op,160),at:item.at,durationMs:item.durationMs,
        role:text(item.role,40),difficulty:text(item.difficulty,20)}))
      .sort((a,b)=>a.at-b.at).slice(-MAX_SERVICE_OBSERVATIONS);
    runtimes[id]={live,history,cooling:cool,usedToday:day===today&&Number.isFinite(entry.usedToday)?Math.max(0,entry.usedToday):0,day:day===today?day:today};
  }
  return {schema:RUNTIME_LOADS,revision:Number.isInteger(raw?.revision)?raw.revision:0,at,runtimes};
}

/**
 * What the allocator of one workflow needs from the file: the other kernels' live ops per runtime (`loads`,
 * `ops`) and every shared cooldown (`cooling`). This workflow's own live entries are left out of `loads`,
 * because its allocator already counts those locally. Never throws: `ok:false` is an empty view.
 */
export function readLoads({path:file,workflow=null,now=Date.now,alive=null}={}){
  const root=path.dirname(String(file??''));
  const isAlive=alive??(id=>kernelAliveAt(root,id));
  const raw=file?readRaw(file):null;
  const empty={ok:false,schema:RUNTIME_LOADS,revision:0,at:now(),runtimes:{},loads:{},ops:{},cooling:{},history:{}};
  if(!plain(raw)||!plain(raw.runtimes))return empty;
  const ledger=adopt(raw,{now,own:workflow,alive:isAlive});
  const loads={},ops={},cooling={},history={};
  for(const [id,entry] of Object.entries(ledger.runtimes)){
    const outside=entry.live.filter(item=>item.workflow!==workflow);
    if(outside.length){loads[id]=outside.length;ops[id]=outside;}
    if(entry.history.length)history[id]=entry.history;
    if(entry.cooling)cooling[id]=entry.cooling;
  }
  return {ok:true,...ledger,loads,ops,cooling,history};
}

/** The lock beside the ledger. A lock whose pid is dead or whose stamp is older than `staleMs` is broken. */
function acquire(file,{now,retries,waitMs,staleMs,sleep}){
  const lock=`${file}.lock`;
  for(let attempt=0;attempt<=retries;attempt+=1){
    try{
      fs.mkdirSync(path.dirname(file),{recursive:true});
      fs.writeFileSync(lock,JSON.stringify({pid:process.pid,at:now()}),{flag:'wx'});
      return {locked:true,release:()=>{try{const held=readRaw(lock);if(!held||held.pid===process.pid)fs.rmSync(lock,{force:true});}catch{}}};
    }catch(error){
      if(error?.code!=='EEXIST')return {locked:false,release:()=>{}};
      const held=readRaw(lock);
      const stale=!held||!Number.isFinite(held.at)||now()-held.at>staleMs||!pidAlive(held.pid);
      if(stale){try{fs.rmSync(lock,{force:true});}catch{}continue;}
      sleep(waitMs);
    }
  }
  // The writer that waited out its retries still writes: a lost update of a load counter is cheaper than a
  // kernel that refuses to record a launch it already made.
  return {locked:false,release:()=>{}};
}

function writeAtomic(file,ledger){
  const tmp=`${file}.${process.pid}.tmp`;
  fs.mkdirSync(path.dirname(file),{recursive:true});
  fs.writeFileSync(tmp,`${JSON.stringify(ledger,null,2)}\n`);
  fs.renameSync(tmp,file);
}

/**
 * One workflow's handle on the shared ledger. Every write is a read-modify-write under the lock that also
 * drops the dead kernels' entries, and every write is best effort: a failure returns null and is never fatal.
 */
export function createLoadsLedger({path:file,workflow,now=Date.now,alive=null,retries=LOCK_RETRIES,
  waitMs=LOCK_WAIT_MS,staleMs=LOCK_STALE_MS,sleep=sleepSync}={}){
  need(typeof file==='string'&&file.trim(),'A shared runtime ledger needs a file path');
  need(typeof workflow==='string'&&workflow.trim(),'A shared runtime ledger needs the workflow id that writes it');
  const root=path.dirname(file);
  const isAlive=alive??(id=>kernelAliveAt(root,id));
  const entryOf=(ledger,runtime)=>(ledger.runtimes[runtime]=ledger.runtimes[runtime]??{live:[],history:[],cooling:null,usedToday:0,day:utcDay(now())});
  const mutate=change=>{
    const lock=acquire(file,{now,retries,waitMs,staleMs,sleep});
    try{
      const ledger=adopt(readRaw(file),{now,own:workflow,alive:isAlive});
      const result=change(ledger);
      if(plain(result)&&result.skipWrite)return {ok:true,locked:lock.locked,ledger,...result};
      ledger.revision+=1;
      writeAtomic(file,ledger);
      return {ok:true,locked:lock.locked,ledger,...(plain(result)?result:{})};
    }catch(error){return {ok:false,locked:lock.locked,reason:String(error?.message??error).slice(0,200)};}
    finally{lock.release();}
  };
  return {
    schema:RUNTIME_LOADS,file,workflow,
    /** The other kernels' loads and every shared cooldown; an unreadable file reads as nothing shared. */
    read(){return readLoads({path:file,workflow,now,alive:isAlive});},
    /** Compare-and-reserve: a selector that read an older revision retries instead of overbooking stale headroom. */
    reserved({runtime,op,estimateMs=null,role=null,difficulty=null,expectedRevision=null}){
      if(!runtime||!op)return null;
      return mutate(ledger=>{
        if(Number.isInteger(expectedRevision)&&ledger.revision!==expectedRevision)return {conflict:true,expectedRevision,actualRevision:ledger.revision,skipWrite:true};
        const entry=entryOf(ledger,runtime);
        entry.live=[...entry.live.filter(item=>!(item.workflow===workflow&&item.op===op)),{workflow,op,since:now(),phase:'reserved',
          estimateMs:Number.isFinite(estimateMs)&&estimateMs>0?estimateMs:null,role:text(role,40),difficulty:text(difficulty,20)}];
        return {reserved:true,revision:ledger.revision+1};
      });
    },
    /** An operation actually launched on a runtime: one live reservation. Completion is charged on release. */
    launched({runtime,op,estimateMs=null,role=null,difficulty=null}){
      if(!runtime||!op)return null;
      return mutate(ledger=>{
        const entry=entryOf(ledger,runtime);
        const prior=entry.live.find(item=>item.workflow===workflow&&item.op===op);
        entry.live=[...entry.live.filter(item=>!(item.workflow===workflow&&item.op===op)),{workflow,op,since:prior?.since??now(),phase:'launched',launchedAt:now(),
          estimateMs:Number.isFinite(estimateMs)&&estimateMs>0?estimateMs:null,role:text(role,40),difficulty:text(difficulty,20)}];
      });
    },
    /**
     * An operation settled: its reservation goes. Only observed work (`completed:true`) enters the rolling
     * service history; failed/no-effect admission releases capacity without manufacturing completed service.
     */
    released({runtime,op=null,completed=false}){
      if(!runtime)return null;
      return mutate(ledger=>{
        const entry=entryOf(ledger,runtime);
        const mine=entry.live.filter(item=>item.workflow===workflow);
        const drop=op?mine.find(item=>item.op===op):mine.sort((a,b)=>a.since-b.since)[0];
        if(drop){
          entry.live=entry.live.filter(item=>item!==drop);
          if(completed){
            entry.usedToday+=1;
            entry.history=[...(entry.history??[]),{workflow,op:drop.op,at:now(),durationMs:Math.max(0,now()-(drop.launchedAt??drop.since)),role:drop.role,difficulty:drop.difficulty}]
              .filter(item=>item.at>=now()-SERVICE_OBSERVATION_MS).slice(-MAX_SERVICE_OBSERVATIONS);
          }
        }
        return {dropped:drop?drop.op:null};
      });
    },
    /** A provider limit this kernel ran into: every kernel of the repository sees the same cooldown. */
    cooled({runtime,until,reason=null,kind=null}){
      if(!runtime||!Number.isFinite(until))return null;
      return mutate(ledger=>{
        const entry=entryOf(ledger,runtime);
        // A cooldown is never shortened by another kernel's shorter one: the longest wait seen wins.
        if(!entry.cooling||entry.cooling.until<until)entry.cooling={until,reason:text(reason),kind:text(kind,40),workflow};
      });
    },
    /** At start: this workflow's entries whose operation is no longer running are its own leftovers. */
    sync({ops=[]}={}){
      const running=new Set((Array.isArray(ops)?ops:[]).filter(id=>typeof id==='string'));
      return mutate(ledger=>{
        const dropped=[];
        for(const [runtime,entry] of Object.entries(ledger.runtimes)){
          const stale=entry.live.filter(item=>item.workflow===workflow&&!running.has(item.op));
          if(!stale.length)continue;
          entry.live=entry.live.filter(item=>!stale.includes(item));
          for(const item of stale)dropped.push({runtime,op:item.op});
        }
        return {dropped};
      });
    }
  };
}
