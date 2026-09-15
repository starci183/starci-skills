import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);

const fileFor=dir=>path.join(dir,'kernel-startup.sqlite');
const token=()=>crypto.randomBytes(18).toString('hex');
function database(dir){
  const {DatabaseSync}=require('node:sqlite');
  const db=new DatabaseSync(fileFor(dir));
  db.exec('PRAGMA busy_timeout=5000; PRAGMA journal_mode=DELETE; PRAGMA synchronous=FULL; CREATE TABLE IF NOT EXISTS ownership (slot INTEGER PRIMARY KEY CHECK(slot=1), phase TEXT NOT NULL, token TEXT NOT NULL, pid INTEGER NOT NULL, at INTEGER NOT NULL)');
  return db;
}
const transact=(db,fn)=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value;}catch(error){try{db.exec('ROLLBACK')}catch{}throw error;}};

export function inspectStartup(dir){const db=database(dir);try{return db.prepare('SELECT phase,token,pid,at FROM ownership WHERE slot=1').get()??null;}finally{db.close();}}

export function reserveStartup(dir,{pid=process.pid,now=Date.now,alive=value=>{try{process.kill(value,0);return true}catch{return false}}}={}){
  const db=database(dir),next=token();try{return transact(db,()=>{
    const row=db.prepare('SELECT phase,token,pid,at FROM ownership WHERE slot=1').get();
    if(row){
      if(row.phase==='launching'||alive(Number(row.pid)))return {ok:false,reason:row.phase.startsWith('launching')?'kernel launch has unresolved ownership':'kernel process already runs',row};
      db.prepare('DELETE FROM ownership WHERE slot=1 AND phase=? AND token=? AND pid=?').run(row.phase,row.token,row.pid);
    }
    db.prepare('INSERT INTO ownership(slot,phase,token,pid,at) VALUES(1,?,?,?,?)').run('launching',next,pid,now());
    return {ok:true,phase:'launching',token:next,pid};
  });}finally{db.close();}
}

export function acquireStartup(dir,{launchToken=null,pid=process.pid,now=Date.now}={}){
  const db=database(dir),next=launchToken??token();try{return transact(db,()=>{
    const row=db.prepare('SELECT phase,token,pid,at FROM ownership WHERE slot=1').get();
    if(row){
      if(!launchToken||!['launching','launching-child'].includes(row.phase)||row.token!==launchToken)throw Object.assign(Error('another kernel or unresolved launch owns workflow startup'),{code:'STARCI_KERNEL_ALREADY_RUNNING',owner:row});
      db.prepare("UPDATE ownership SET phase='running',pid=?,at=? WHERE slot=1 AND phase IN ('launching','launching-child') AND token=?").run(pid,now(),launchToken);
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

export function releaseLaunchingStartup(dir,owner){
  if(!owner?.token||!Number.isInteger(owner.pid)||owner.pid<=0)return false;
  const db=database(dir);try{return transact(db,()=>db.prepare("DELETE FROM ownership WHERE slot=1 AND phase='launching-child' AND token=? AND pid=?").run(owner.token,owner.pid).changes===1);}finally{db.close();}
}

export function releaseStartup(dir,owner){
  if(!owner?.token)return false;const db=database(dir);try{return transact(db,()=>db.prepare('DELETE FROM ownership WHERE slot=1 AND token=? AND pid=?').run(owner.token,owner.pid).changes===1);}finally{db.close();}
}
