import path from 'node:path';
import {canonicalTarget} from '../modules/models/index.mjs';
import {openLedger,inspectLedger} from './ledger-db.mjs';
import {signalRow,setSignal} from './launch.mjs';

/**
 * The shared runtime ledger of one repository: rows of the `runtime_loads` table in the repository's
 * `.starciwork/runtime.sqlite`, where `runtime-loads.json` used to sit. Several workflows run at once,
 * each with its own kernel and its own allocator, so nothing but these rows tells one kernel that another
 * is already on `claude-fable-5.1` and that a provider parked it two minutes ago. A row carries exactly
 * facts per runtime - which workflow reserves/runs which operation, recent settled service durations,
 * shared provider cooldown and compatibility daily counters. Rows keyed `provider:<name>` carry the
 * supervisor's last probed quota windows instead (`runtime-budget.json`'s successor); they never carry a
 * runtime's live entries.
 *
 * The ledger serializes writers itself: every mutation is one `BEGIN IMMEDIATE` read-modify-write on the
 * handle, which also drops the dead kernels' entries, and every write is best effort - a failure returns
 * `{ok:false}` and is never fatal. Entries of a workflow whose kernel is dead - its `kernel-lock` signal
 * names no live pid - are ignored on read and dropped on the next write, so a crashed kernel never holds a
 * slot of the expensive runtime for the others. The document `revision` lives in the `loads-revision`
 * signal, so the allocator's compare-and-reserve survives with it.
 */
export const RUNTIME_LOADS='starci/runtime-loads@1';
export const LOADS_FILE='runtime-loads.json';
export const PROVIDER_PREFIX='provider:';
/** Completed service is relevant only while it can describe current quota/load conditions. */
export const SERVICE_OBSERVATION_MS=6*60*60*1000;
export const MAX_SERVICE_OBSERVATIONS=256;
/** Only a provider limit is everyone's: a rate limit and an exhausted quota are shared, a local failure is not. */
export const SHARED_COOLING_KINDS=['rate-limited','quota'];
const REVISION_KEY='loads-revision';

const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
const need=(condition,message)=>{if(!condition)throw Error(message);};
const utcDay=ms=>new Date(ms).toISOString().slice(0,10);
const text=(value,limit=200)=>typeof value==='string'?value.slice(0,limit):null;

/** Legacy name kept so callers still wired to `_local` resolve; nothing here ever reads or writes that path. */
export function loadsFileFor(storeDir){return path.join(path.dirname(String(storeDir??'')),LOADS_FILE);}

/** Whether a pid is a live process - the same question the supervisor asks of the `kernel-lock` signal. */
export function pidAlive(pid){
  const id=Number(pid);
  if(!Number.isInteger(id)||id<=0)return false;
  // EPERM means the process exists and belongs to somebody else; only ESRCH means it is gone.
  try{process.kill(id,0);return true;}catch(error){return error?.code==='EPERM';}
}
/** A workflow's kernel is live when its `kernel-lock` signal names a running pid that is. */
export function kernelAliveAt(db,workflow){
  const row=signalRow(db,String(workflow??''),'kernel-lock');
  return Boolean(row)&&row.value?.phase!=='launching'&&row.value?.phase!=='launching-child'&&row.value?.phase!=='launching-native'&&pidAlive(row.pid);
}

const PROVIDER_MATCH=`${PROVIDER_PREFIX}%`;
function readRows(db){
  const runtimes={},providers={};
  for(const row of db.prepare('SELECT runtime,loads_json FROM runtime_loads').all()){
    let entry;try{entry=JSON.parse(row.loads_json);}catch{continue;}
    if(typeof row.runtime==='string'&&row.runtime.startsWith(PROVIDER_PREFIX))providers[row.runtime.slice(PROVIDER_PREFIX.length)]=entry;
    else if(typeof row.runtime==='string'&&row.runtime)runtimes[row.runtime]=entry;
  }
  return{runtimes,providers};
}
const revisionOf=db=>{const value=signalRow(db,'*',REVISION_KEY)?.value;return Number.isInteger(value?.revision)?value.revision:0;};

/**
 * Whatever the table holds, read as the ledger: unknown fields are dropped, an expired cooldown is gone, and a
 * live entry survives only when its workflow is this kernel (always live: it is us) or a kernel with a live pid.
 */
function adopt(runtimes,{now,own,alive}){
  const at=now(),today=utcDay(at),adopted={};
  for(const [id,entry] of Object.entries(runtimes)){
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
    // A ledger another kernel wrote may still name a retired model pool; fold it into the provider window it
    // is an alias of, so the busy/cooling signal lands on the pool the entry really ran on.
    const canonical=canonicalTarget(id);
    const next={live,history,cooling:cool,usedToday:day===today&&Number.isFinite(entry.usedToday)?Math.max(0,entry.usedToday):0,day:day===today?day:today};
    const merged=adopted[canonical];
    adopted[canonical]=merged?{
      live:[...merged.live,...next.live],
      history:[...merged.history,...next.history].sort((a,b)=>a.at-b.at).slice(-MAX_SERVICE_OBSERVATIONS),
      cooling:[merged.cooling,next.cooling].filter(Boolean).sort((a,b)=>b.until-a.until)[0]??null,
      usedToday:merged.usedToday+next.usedToday,day:next.day}:next;
  }
  return {schema:RUNTIME_LOADS,at,runtimes:adopted};
}

/** Write the adopted document back: every runtime row is rewritten, provider rows are never touched. */
function writeRuntimes(db,runtimes,at){
  db.prepare('DELETE FROM runtime_loads WHERE runtime NOT LIKE ?').run(PROVIDER_MATCH);
  const insert=db.prepare('INSERT INTO runtime_loads(runtime,loads_json,at) VALUES(?,?,?)');
  for(const [id,entry] of Object.entries(runtimes))insert.run(id,JSON.stringify(entry),at);
}

/** A readable db for one view: a bound handle wins, a `.sqlite` path opens read-only, anything else is empty. */
function readerOf({ledger,path:file,db}){
  if(db)return{db,close:()=>{}};
  if(ledger?.db)return{db:ledger.db,close:()=>{}};
  if(typeof file==='string'&&file.endsWith('.sqlite')){
    try{const handle=inspectLedger({file});return{db:handle.db,close:()=>handle.close()};}catch{}
  }
  return{db:null,close:()=>{}};
}

/**
 * What the allocator of one workflow needs from the table: the other kernels' live ops per runtime (`loads`,
 * `ops`) and every shared cooldown (`cooling`). This workflow's own live entries are left out of `loads`,
 * because its allocator already counts those locally. Never throws: `ok:false` is an empty view, and a
 * non-ledger path - the retired `_local` file included - is never opened.
 */
export function readLoads({ledger,path:file,db,workflow=null,now=Date.now,alive=null}={}){
  const empty={ok:false,schema:RUNTIME_LOADS,revision:0,at:now(),runtimes:{},loads:{},ops:{},cooling:{},history:{},providers:{}};
  const {db:conn,close}=readerOf({ledger,path:file,db});
  if(!conn)return empty;
  try{
    const isAlive=alive??(id=>kernelAliveAt(conn,id));
    const rows=readRows(conn);
    const view=adopt(rows.runtimes,{now,own:workflow,alive:isAlive});
    view.revision=revisionOf(conn);
    const loads={},ops={},cooling={},history={};
    for(const [id,entry] of Object.entries(view.runtimes)){
      const outside=entry.live.filter(item=>item.workflow!==workflow);
      if(outside.length){loads[id]=outside.length;ops[id]=outside;}
      if(entry.history.length)history[id]=entry.history;
      if(entry.cooling)cooling[id]=entry.cooling;
    }
    return {ok:true,...view,loads,ops,cooling,history,providers:rows.providers};
  }catch{return empty;}
  finally{close();}
}

/**
 * One workflow's handle on the shared ledger. `ledger` is the kernel's bound handle; `path` is its file for a
 * caller that cannot hold one. A caller still pointing at the retired `_local` file gets null - local
 * allocation only, exactly what an unreadable ledger meant before.
 */
export function createLoadsLedger({ledger,path:file,workflow,now=Date.now,alive=null}={}){
  need(typeof workflow==='string'&&workflow.trim(),'A shared runtime ledger needs the workflow id that writes it');
  let own=null,bound=ledger??null;
  if(!bound&&typeof file==='string'&&file.endsWith('.sqlite')){try{own=openLedger({file,now});bound=own;}catch{bound=null;}}
  if(!bound?.db)return null;
  const isAlive=alive??(id=>kernelAliveAt(bound.db,id));
  const entryOf=(ledger,runtime)=>(ledger.runtimes[runtime]=ledger.runtimes[runtime]??{live:[],history:[],cooling:null,usedToday:0,day:utcDay(now())});
  const mutate=change=>{
    try{
      return bound.transaction(()=>{
        const doc=adopt(readRows(bound.db).runtimes,{now,own:workflow,alive:isAlive});
        doc.revision=revisionOf(bound.db);
        const result=change(doc);
        if(plain(result)&&result.skipWrite)return {ok:true,ledger:doc,...result};
        doc.revision+=1;
        writeRuntimes(bound.db,doc.runtimes,now());
        setSignal(bound.db,'*',REVISION_KEY,{value:{revision:doc.revision},at:now()});
        return {ok:true,ledger:doc,...(plain(result)?result:{})};
      });
    }catch(error){return {ok:false,reason:String(error?.message??error).slice(0,200)};}
  };
  return {
    schema:RUNTIME_LOADS,workflow,
    /** The other kernels' loads and every shared cooldown; an unreadable ledger reads as nothing shared. */
    read(){return readLoads({ledger:bound,workflow,now,alive:isAlive});},
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
    },
    close(){try{own?.close();}catch{}}
  };
}

/**
 * The supervisor's share of the sweep: live entries of a kernel that is gone are removed and reported, so an
 * orphan never holds a provider slot. Provider rows are not loads and are never swept here.
 */
export function sweepRuntimeLoads(ledger,{now=Date.now,alive=null}={}){
  need(ledger?.db&&ledger?.transaction,'sweepRuntimeLoads needs a ledger handle');
  const isAlive=alive??(id=>kernelAliveAt(ledger.db,id));
  return ledger.transaction(()=>{
    const rows=readRows(ledger.db),dropped=[];
    for(const [id,entry] of Object.entries(rows.runtimes))
      for(const item of Array.isArray(entry?.live)?entry.live:[])
        if(plain(item)&&typeof item.workflow==='string'&&item.workflow&&!isAlive(item.workflow))dropped.push({runtime:id,workflow:item.workflow,op:typeof item.op==='string'?item.op:null});
    if(!dropped.length)return{ok:true,dropped:[]};
    const doc=adopt(rows.runtimes,{now,own:null,alive:isAlive});
    writeRuntimes(ledger.db,doc.runtimes,now());
    return{ok:true,dropped,revision:revisionOf(ledger.db)};
  });
}

/** The probed provider quota, recorded as `provider:<name>` rows beside the load rows it bounds. */
export function recordProviderLoads(ledger,budget,{now=Date.now()}={}){
  need(ledger?.db,'recordProviderLoads needs a ledger handle');
  const providers=plain(budget?.providers)?budget.providers:{};
  return ledger.transaction(()=>{
    const at=now();
    const upsert=ledger.db.prepare('INSERT INTO runtime_loads(runtime,loads_json,at) VALUES(?,?,?) ON CONFLICT(runtime) DO UPDATE SET loads_json=excluded.loads_json,at=excluded.at');
    for(const [name,entry] of Object.entries(providers))if(plain(entry))upsert.run(`${PROVIDER_PREFIX}${name}`,JSON.stringify(entry),at);
    return{ok:true,providers:Object.keys(providers)};
  });
}

/**
 * What the allocator reads of the probe: `{at, providers}` in the shape `runtime-budget.json` carried, or
 * null when no supervisor ever recorded one. Freshness is the caller's `budgetIsFresh`/`budgetVerdict`.
 */
export function readProviderLoads({ledger,path:file,db}={}){
  const {db:conn,close}=readerOf({ledger,path:file,db});
  if(!conn)return null;
  try{
    const providers={},at=conn.prepare('SELECT max(at) at FROM runtime_loads WHERE runtime LIKE ?').get(PROVIDER_MATCH)?.at??null;
    for(const row of conn.prepare('SELECT runtime,loads_json FROM runtime_loads WHERE runtime LIKE ?').all(PROVIDER_MATCH)){
      try{providers[row.runtime.slice(PROVIDER_PREFIX.length)]=JSON.parse(row.loads_json);}catch{}
    }
    return Object.keys(providers).length?{schema:'starci/runtime-budget@1',at,providers}:null;
  }catch{return null;}
  finally{close();}
}
