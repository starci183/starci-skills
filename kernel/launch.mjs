// Launch bookkeeping on the ledger: every byte that used to sit in _local
// (kernel-startup.sqlite, kernel.lock, launch.json, coordinator-terminals.json,
// supervisor.lock) is one row in the signals table.
import fs from 'node:fs';
import crypto from 'node:crypto';
import {need,required,plain} from './common.mjs';

export const LAUNCH_WINDOW_MS=10*60*1000;
const newToken=()=>crypto.randomBytes(18).toString('hex');

const parse=row=>row?{scope:row.scope,key:row.key,pid:row.holder_pid,token:row.token,value:row.value_json===null?null:JSON.parse(row.value_json),at:row.at,expiresAt:row.expires_at}:null;
export function signalRow(db,scope,key){
  return parse(db.prepare('SELECT * FROM signals WHERE scope=? AND key=?').get(scope,key));
}
export function setSignal(db,scope,key,{pid=null,token=null,value=null,at=Date.now(),ttl=null}={}){
  db.prepare('INSERT INTO signals(scope,key,holder_pid,token,value_json,at,expires_at) VALUES(?,?,?,?,?,?,?) ON CONFLICT(scope,key) DO UPDATE SET holder_pid=excluded.holder_pid,token=excluded.token,value_json=excluded.value_json,at=excluded.at,expires_at=excluded.expires_at')
    .run(scope,key,pid,token,value===null?null:JSON.stringify(value),at,ttl===null?null:at+ttl);
  return signalRow(db,scope,key);
}
export function clearSignal(db,scope,key){db.prepare('DELETE FROM signals WHERE scope=? AND key=?').run(scope,key);}

// ---- kernel startup reservation (was kernel-startup.sqlite + kernel.lock; now one kernel-lock row) ----
export function inspectStartup(ledger,id){
  const row=signalRow(ledger.db,id,'kernel-lock');
  return row?{phase:row.value?.phase??'running',token:row.token,pid:row.pid,at:row.at,terminal:row.value?.terminal??null}:null;
}
/**
 * Whether an existing kernel-lock row still stands in the way of a new reservation. A running or child-bound
 * row is held by its process; a plain reservation by the process that made it, until the launch window passes;
 * a native reservation - its command sent to a coordinator terminal - until the window passes with no kernel
 * acquired. A row past those conditions is a dead launch and is reclaimed with its reason on the record.
 */
export function startupRowHolds(row,{now=Date.now,alive=value=>{try{process.kill(value,0);return true;}catch{return false;}},kernelAlive=()=>false,launchWindowMs=LAUNCH_WINDOW_MS}={}){
  if(!row)return {holds:false,reason:null};
  const age=now()-Number(row.at),holderAlive=alive(Number(row.pid));
  if(row.phase==='running')return holderAlive?{holds:true,reason:'kernel process already runs'}:{holds:false,reason:'the kernel process that owned startup is gone'};
  if(row.phase==='launching-child')return holderAlive?{holds:true,reason:'kernel launch has unresolved ownership'}:{holds:false,reason:'the launched child exited before acquiring startup'};
  if(row.phase==='launching')return holderAlive||age<launchWindowMs?{holds:true,reason:'kernel launch has unresolved ownership'}:{holds:false,reason:'the reserving process is gone and the launch window passed without a kernel acquiring startup'};
  if(row.phase==='launching-native')return kernelAlive()||age<launchWindowMs?{holds:true,reason:'kernel launch has unresolved ownership'}:{holds:false,reason:'the launch window passed without the native kernel acquiring startup and no kernel process holds the lock'};
  return {holds:true,reason:`unknown startup phase ${row.phase}`};
}
export function reserveStartup(ledger,id,{pid=process.pid,now=Date.now,alive=value=>{try{process.kill(value,0);return true;}catch{return false}},launchWindowMs=LAUNCH_WINDOW_MS}={}){
  return ledger.transaction(()=>{
    const row=inspectStartup(ledger,id);
    let reclaimed=null;
    if(row){
      const standing=startupRowHolds(row,{now,alive,launchWindowMs});
      if(standing.holds)return {ok:false,reason:standing.reason,row};
      clearSignal(ledger.db,id,'kernel-lock');
      reclaimed={...row,reason:standing.reason};
    }
    const next=newToken();
    setSignal(ledger.db,id,'kernel-lock',{pid,token:next,value:{phase:'launching'},at:now()});
    return {ok:true,phase:'launching',token:next,pid,reclaimed};
  });
}
export function acquireStartup(ledger,id,{launchToken=null,pid=process.pid,now=Date.now}={}){
  return ledger.transaction(()=>{
    const row=inspectStartup(ledger,id),next=launchToken??newToken();
    if(row){
      if(!launchToken||!LAUNCHING_PHASES.has(row.phase)||row.token!==launchToken)
        throw Object.assign(Error('another kernel or unresolved launch owns workflow startup'),{code:'STARCI_KERNEL_ALREADY_RUNNING',owner:row});
      setSignal(ledger.db,id,'kernel-lock',{pid,token:next,value:{phase:'running'},at:now()});
    }else{
      if(launchToken)throw Object.assign(Error('kernel launch token is no longer current'),{code:'STARCI_KERNEL_STARTUP_STALE'});
      setSignal(ledger.db,id,'kernel-lock',{pid,token:next,value:{phase:'running'},at:now()});
    }
    return {ok:true,phase:'running',token:next,pid};
  });
}
export function bindStartupProcess(ledger,id,{token:launchToken,pid,now=Date.now}={}){
  if(!launchToken||!Number.isInteger(pid)||pid<=0)return {ok:false,reason:'launch token and child pid are required'};
  return ledger.transaction(()=>{
    const row=inspectStartup(ledger,id);
    if(!row||row.phase!=='launching'||row.token!==launchToken)return {ok:false,reason:'startup ownership is no longer launching'};
    setSignal(ledger.db,id,'kernel-lock',{pid,token:launchToken,value:{phase:'launching-child'},at:now()});
    return {ok:true,phase:'launching-child',token:launchToken,pid};
  });
}
/** A native launch: the kernel command went into this coordinator terminal; the row remembers which one, so a dead launch can close it. */
export function bindStartupTerminal(ledger,id,{token:launchToken,terminal,now=Date.now}={}){
  if(!launchToken||typeof terminal!=='string'||!terminal)return {ok:false,reason:'launch token and coordinator terminal are required'};
  return ledger.transaction(()=>{
    const row=inspectStartup(ledger,id);
    if(!row||row.phase!=='launching'||row.token!==launchToken)return {ok:false,reason:'startup ownership is no longer launching'};
    setSignal(ledger.db,id,'kernel-lock',{pid:row.pid,token:launchToken,value:{phase:'launching-native',terminal},at:now()});
    return {ok:true,phase:'launching-native',token:launchToken,terminal};
  });
}
export function releaseLaunchingStartup(ledger,id,owner){
  if(!owner?.token||!Number.isInteger(owner.pid)||owner.pid<=0)return false;
  return ledger.transaction(()=>{
    const row=inspectStartup(ledger,id);
    if(!row||row.phase!=='launching-child'||row.token!==owner.token||row.pid!==owner.pid)return false;
    clearSignal(ledger.db,id,'kernel-lock');
    return true;
  });
}
export function releaseStartup(ledger,id,owner){
  if(!owner?.token)return false;
  return ledger.transaction(()=>{
    const row=inspectStartup(ledger,id);
    if(!row||row.token!==owner.token||row.pid!==owner.pid)return false;
    clearSignal(ledger.db,id,'kernel-lock');
    return true;
  });
}
const LAUNCHING_PHASES=new Set(['launching','launching-child','launching-native']);

// ---- the launch hand-off record (was launch.json; now the workflow's 'launch' signal) ----
export function writeLaunch(ledger,id,value,{now=Date.now()}={}){
  need(plain(value),'writeLaunch needs a launch record');
  ledger.transaction(()=>setSignal(ledger.db,id,'launch',{value,at:now()}));
  return{ok:true};
}
export function readLaunch(ledger,id){
  const row=signalRow(ledger.db,id,'launch');
  return row?.value??null;
}
export async function awaitLaunch(ledger,id,{wait=false,timeoutMs=15*60*1000,intervalMs=250,now=Date.now}={}){
  const deadline=now()+timeoutMs;
  for(;;){
    const launch=readLaunch(ledger,id);
    if(launch)return launch;
    if(!wait||now()>=deadline)return null;
    await new Promise(resolve=>setTimeout(resolve,Math.min(intervalMs,Math.max(1,deadline-now()))));
  }
}

// ---- the single-supervisor signal (was supervisor.lock; one '*' row per ledger) ----
export function claimSupervisor(ledger,{pid,round=null,ttl=3*60*1000,now=Date.now(),alive=pid=>{try{process.kill(pid,0);return true;}catch{return false;}}}={}){
  need(pid,'claimSupervisor needs a pid');
  return ledger.transaction(()=>{
    const at=now(),row=signalRow(ledger.db,'*','supervisor-lock');
    const stale=!row||row.pid===pid||(row.expiresAt!==null&&row.expiresAt<=at)||!alive(row.pid);
    if(!stale)return{ok:false,holder:row};
    setSignal(ledger.db,'*','supervisor-lock',{pid,token:row?.token??newToken(),value:{round},at,ttl});
    return{ok:true,round};
  });
}
export function readSupervisor(ledger){
  return signalRow(ledger.db,'*','supervisor-lock');
}

// ---- the coordinator-terminal record (was coordinator-terminals.json + supervisor.log) ----
export function readCoordinatorTerminals(ledger,id){
  const row=signalRow(ledger.db,id,'coordinator-terminals');
  return Array.isArray(row?.value?.open)?row.value.open.filter(name=>typeof name==='string'&&name):[];
}
export function readClosedCoordinatorTerminals(ledger,id){
  const row=signalRow(ledger.db,id,'coordinator-terminals');
  return Array.isArray(row?.value?.closed)?row.value.closed.filter(name=>typeof name==='string'&&name):[];
}
export function recordCoordinatorTerminal(ledger,id,handle,{now=Date.now()}={}){
  const name=required(handle,'coordinator terminal name');
  return ledger.transaction(()=>{
    const open=readCoordinatorTerminals(ledger,id),closed=readClosedCoordinatorTerminals(ledger,id);
    if(open.includes(name))return{ok:true,opened:open};
    setSignal(ledger.db,id,'coordinator-terminals',{value:{open:[...open,name],closed:closed.filter(item=>item!==name)},at:now()});
    return{ok:true,opened:[...open,name]};
  });
}
export function closeStaleCoordinatorTerminals(ledger,id,{keep=[],close,known,now=Date.now()}={}){
  need(typeof close==='function','closeStaleCoordinatorTerminals needs a close callback');
  const keepSet=new Set([keep].flat().filter(Boolean)),listed=known?new Set(known):null;
  return ledger.transaction(()=>{
    const open=readCoordinatorTerminals(ledger,id),closed=readClosedCoordinatorTerminals(ledger,id);
    const stale=open.filter(name=>!keepSet.has(name)&&(listed===null||listed.has(name)));
    const closedNow=[];
    for(const name of stale)try{if(close(name))closedNow.push(name);}catch{}
    const stillOpen=open.filter(name=>!closedNow.includes(name));
    setSignal(ledger.db,id,'coordinator-terminals',{value:{open:stillOpen,closed:[...new Set([...closed,...closedNow])]},at:now()});
    return{ok:true,closed:closedNow,open:stillOpen};
  });
}
export function pruneClosedCoordinatorTerminals(ledger,id,listed,{now=Date.now()}={}){
  const set=new Set([listed].flat().filter(Boolean));
  return ledger.transaction(()=>{
    const open=readCoordinatorTerminals(ledger,id),closed=readClosedCoordinatorTerminals(ledger,id);
    const nextClosed=closed.filter(name=>set.has(name));
    if(nextClosed.length===closed.length)return{ok:true,closed:nextClosed};
    setSignal(ledger.db,id,'coordinator-terminals',{value:{open,closed:nextClosed},at:now()});
    return{ok:true,closed:nextClosed};
  });
}
// Recovery for coordinators opened before the signal existed: the supervisor's own
// log still names them (the log is an audit stream, not state).
export function seedCoordinatorTerminals(ledger,id,{logFile,now=Date.now(),readFile=fs.readFileSync}={}){
  if(!logFile||!fs.existsSync(logFile))return{ok:true,seeded:[]};
  const lines=String(readFile(logFile,'utf8')).split('\n'),seeded=[];
  for(const line of lines){
    let record;try{record=JSON.parse(line);}catch{continue;}
    if(record.event!=='kernel-started-in-coordinator'||record.id!==id||typeof record.terminal!=='string'||!record.terminal)continue;
    if(seeded.includes(record.terminal))continue;
    recordCoordinatorTerminal(ledger,id,record.terminal,{now});
    seeded.push(record.terminal);
  }
  return{ok:true,seeded};
}
