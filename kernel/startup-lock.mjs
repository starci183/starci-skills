import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const fileFor=dir=>path.join(dir,'kernel-startup.sqlite');
const token=()=>crypto.randomBytes(18).toString('hex');
/**
 * How long a startup reservation may stay unacquired before it is a dead launch. A kernel acquires ownership
 * first thing, before it binds an Orca run or writes state, so a reservation still unacquired after this window
 * belongs to a kernel that never ran or died on the way in - never to one that is running.
 */
export const LAUNCH_WINDOW_MS=10*60*1000;
const LAUNCHING_PHASES=['launching','launching-child','launching-native'];
function database(dir){
  const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync(fileFor(dir));
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS ownership (slot INTEGER PRIMARY KEY CHECK(slot=1), phase TEXT NOT NULL, token TEXT NOT NULL, pid INTEGER NOT NULL, at INTEGER NOT NULL)');
  // A native (Orca) launch is bound to the coordinator terminal it was sent to; older files gain the column in place.
  if(!db.prepare('PRAGMA table_info(ownership)').all().some(column=>column.name==='terminal'))db.exec('ALTER TABLE ownership ADD COLUMN terminal TEXT');
  return db;
}
const transact=(db,fn)=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(error){try{db.exec('ROLLBACK')}catch{}throw error;}};
const readRow=db=>db.prepare('SELECT phase,token,pid,at,terminal FROM ownership WHERE slot=1').get()??null;

export function inspectStartup(dir){const db=database(dir);try{return readRow(db);}finally{db.close();}}

/** Whether a kernel process of this store is alive: the kernel writes its pid to kernel.lock once it owns startup. */
function kernelLockAlive(dir,alive){
  try{const lock=JSON.parse(fs.readFileSync(path.join(dir,'kernel.lock'),'utf8'));return Number.isInteger(lock?.pid)&&lock.pid>0?alive(Number(lock.pid)):false;}catch{return false;}
}

/**
 * Whether an existing ownership row still stands in the way of a new reservation. A running or child-bound row is
 * held by its process; a plain reservation by the process that made it, until the launch window passes; a native
 * reservation - its command sent to a coordinator terminal - until the window passes with no kernel holding the
 * lock. A row past those conditions is a dead launch and is reclaimed with its reason on the record.
 */
export function startupRowHolds(row,{now=Date.now,alive,kernelAlive=()=>false,launchWindowMs=LAUNCH_WINDOW_MS}={}){
  if(!row)return {holds:false,reason:null};
  const age=now()-Number(row.at),holderAlive=alive(Number(row.pid));
  if(row.phase==='running')return holderAlive?{holds:true,reason:'kernel process already runs'}:{holds:false,reason:'the kernel process that owned startup is gone'};
  if(row.phase==='launching-child')return holderAlive?{holds:true,reason:'kernel launch has unresolved ownership'}:{holds:false,reason:'the launched child exited before acquiring startup'};
  if(row.phase==='launching')return holderAlive||age<launchWindowMs?{holds:true,reason:'kernel launch has unresolved ownership'}:{holds:false,reason:'the reserving process is gone and the launch window passed without a kernel acquiring startup'};
  if(row.phase==='launching-native')return kernelAlive()||age<launchWindowMs?{holds:true,reason:'kernel launch has unresolved ownership'}:{holds:false,reason:'the launch window passed without the native kernel acquiring startup and no kernel process holds the lock'};
  return {holds:true,reason:`unknown startup phase ${row.phase}`};
}

export function reserveStartup(dir,{pid=process.pid,now=Date.now,alive=value=>{try{process.kill(value,0);return true}catch{return false}},launchWindowMs=LAUNCH_WINDOW_MS}={}){
  const db=database(dir),next=token();try{return transact(db,()=>{
    const row=readRow(db);
    let reclaimed=null;
    if(row){
      const standing=startupRowHolds(row,{now,alive,kernelAlive:()=>kernelLockAlive(dir,alive),launchWindowMs});
      if(standing.holds)return {ok:false,reason:standing.reason,row};
      db.prepare('DELETE FROM ownership WHERE slot=1 AND phase=? AND token=? AND pid=?').run(row.phase,row.token,row.pid);
      reclaimed={...row,reason:standing.reason};
    }
    db.prepare('INSERT INTO ownership(slot,phase,token,pid,at) VALUES(1,?,?,?,?)').run('launching',next,pid,now());
    return {ok:true,phase:'launching',token:next,pid,reclaimed};
  });}finally{db.close();}
}

export function acquireStartup(dir,{launchToken=null,pid=process.pid,now=Date.now}={}){
  const db=database(dir),next=launchToken??token();try{return transact(db,()=>{
    const row=readRow(db);
    if(row){
      if(!launchToken||!LAUNCHING_PHASES.includes(row.phase)||row.token!==launchToken)throw Object.assign(Error('another kernel or unresolved launch owns workflow startup'),{code:'STARCI_KERNEL_ALREADY_RUNNING',owner:row});
      db.prepare("UPDATE ownership SET phase='running',pid=?,at=? WHERE slot=1 AND phase IN ('launching','launching-child','launching-native') AND token=?").run(pid,now(),launchToken);
    }else{
      if(launchToken)throw Object.assign(Error('kernel launch token is no longer current'),{code:'STARCI_KERNEL_STARTUP_STALE'});
      db.prepare('INSERT INTO ownership(slot,phase,token,pid,at) VALUES(1,?,?,?,?)').run('running',next,pid,now());
    }
    return {ok:true,phase:'running',token:next,pid};
  });}finally{db.close();}
}

export function bindStartupProcess(dir,{token:launchToken,pid,now=Date.now}={}){
  if(!launchToken||!Number.isInteger(pid)||pid<=0)return {ok:false,reason:'launch token and child pid are required'};
  const db=database(dir);try{return transact(db,()=>{
    const changed=db.prepare("UPDATE ownership SET phase='launching-child',pid=?,at=? WHERE slot=1 AND phase='launching' AND token=?").run(pid,now(),launchToken).changes;
    return changed===1?{ok:true,phase:'launching-child',token:launchToken,pid}:{ok:false,reason:'startup ownership is no longer launching'};
  });}finally{db.close();}
}

/** A native launch: the kernel command went into this coordinator terminal; the row remembers which one, so a dead launch can close it. */
export function bindStartupTerminal(dir,{token:launchToken,terminal,now=Date.now}={}){
  if(!launchToken||typeof terminal!=='string'||!terminal)return {ok:false,reason:'launch token and coordinator terminal are required'};
  const db=database(dir);try{return transact(db,()=>{
    const changed=db.prepare("UPDATE ownership SET phase='launching-native',terminal=?,at=? WHERE slot=1 AND phase='launching' AND token=?").run(terminal,now(),launchToken).changes;
    return changed===1?{ok:true,phase:'launching-native',token:launchToken,terminal}:{ok:false,reason:'startup ownership is no longer launching'};
  });}finally{db.close();}
}

export function releaseLaunchingStartup(dir,owner){
  if(!owner?.token||!Number.isInteger(owner.pid)||owner.pid<=0)return false;
  const db=database(dir);try{return transact(db,()=>db.prepare("DELETE FROM ownership WHERE slot=1 AND phase='launching-child' AND token=? AND pid=?").run(owner.token,owner.pid).changes===1);}finally{db.close();}
}

export function releaseStartup(dir,owner){
  if(!owner?.token)return false;const db=database(dir);try{return transact(db,()=>db.prepare('DELETE FROM ownership WHERE slot=1 AND token=? AND pid=?').run(owner.token,owner.pid).changes===1);}finally{db.close();}
}
